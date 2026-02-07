<?php
// Enable error reporting for debugging (disable in production)
error_reporting(0);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_errors.log');

// Set execution time limit
set_time_limit(300); // 300 seconds (5 minutes) max
ini_set('memory_limit', '512M'); // Increased for large indigency responses

header('Content-Type: application/json');

// Function to safely handle image data
function safeImageData($imageData) {
    if (!$imageData) {
        return null;
    }
    
    $dataLength = strlen($imageData);
    
    // Check if image is too large (> 500KB) - return placeholder instead
    if ($dataLength > 500000) {
        return 'image_too_large';
    }
    
    // Check if it's already a data URL
    if (strpos($imageData, 'data:image') === 0) {
        return $imageData;
    }
    
    // If it's binary data, convert to data URL
    if ($dataLength > 100) { // Assume it's binary if > 100 chars
        try {
            return 'data:image/jpeg;base64,' . base64_encode($imageData);
        } catch (Exception $e) {
            error_log("Error encoding image data: " . $e->getMessage());
            return 'image_encoding_error';
        }
    }
    
    return $imageData;
}

try {
    // Include database configuration
    require_once 'config.php';
    
    // Try to get database connection with fallback
    $connection = null;
    $maxRetries = 3;
    $retryCount = 0;
    
    while ($retryCount < $maxRetries && !$connection) {
        try {
            $connection = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
            if ($connection->connect_error) {
                throw new Exception("Connection failed: " . $connection->connect_error);
            }
            // Set connection timeout
            $connection->options(MYSQLI_OPT_CONNECT_TIMEOUT, 10);
            $connection->options(MYSQLI_OPT_READ_TIMEOUT, 30);
            break;
        } catch (Exception $e) {
            $retryCount++;
            error_log("Database connection attempt $retryCount failed: " . $e->getMessage());
            if ($retryCount < $maxRetries) {
                sleep(1); 
            }
        }
    }
    
    if (!$connection) {
        throw new Exception("Failed to connect to database after $maxRetries attempts");
    }

    $connection->set_charset('utf8mb4');
    
    // Handle POST requests for status updates FIRST
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input) {
                throw new Exception('Invalid JSON input');
            }
            
            $action = $input['action'] ?? '';
            $table = $input['table'] ?? '';
            $id = $input['id'] ?? '';
            $status = $input['status'] ?? '';
            
            if ($action !== 'update_status' || !$table || !$id || !$status) {
                throw new Exception('Missing required parameters');
            }
            
            // Validate table name
            $allowedTables = ['clearance', 'indigency', 'coe', 'barangay_id', 'certification'];
            if (!in_array($table, $allowedTables)) {
                throw new Exception('Invalid table name');
            }
            
            // Map table names to actual table names
            $tableMap = [
                'clearance' => 'clearance_forms',
                'indigency' => 'indigency_forms',
                'coe' => 'coe_forms',
                'barangay_id' => 'barangay_id_forms',
                'certification' => 'certification_forms'
            ];
            
            $actualTable = $tableMap[$table];
            
            // Update status with timestamp tracking
            // Get current time using PHP timezone (Philippine time)
            $currentTime = date('Y-m-d H:i:s');
            
            if ($status === 'Processing') {
                // Set status to Processing and update process_at timestamp (using PHP timezone)
                $sql = "UPDATE $actualTable SET status = ?, process_at = ? WHERE id = ?";
                $stmt = $connection->prepare($sql);
                
                if (!$stmt) {
                    throw new Exception('Failed to prepare update statement: ' . $connection->error);
                }
                
                $stmt->bind_param('ssi', $status, $currentTime, $id);
            } elseif ($status === 'Finished') {
                // Set status to Finished and update finish_at timestamp (using PHP timezone)
                $sql = "UPDATE $actualTable SET status = ?, finish_at = ? WHERE id = ?";
                $stmt = $connection->prepare($sql);
                
                if (!$stmt) {
                    throw new Exception('Failed to prepare update statement: ' . $connection->error);
                }
                
                $stmt->bind_param('ssi', $status, $currentTime, $id);
            } else {
                // Regular status update without timestamp
                $sql = "UPDATE $actualTable SET status = ? WHERE id = ?";
                $stmt = $connection->prepare($sql);
                
                if (!$stmt) {
                    throw new Exception('Failed to prepare update statement: ' . $connection->error);
                }
                
                $stmt->bind_param('si', $status, $id);
            }
            
            if (!$stmt->execute()) {
                throw new Exception('Failed to update status: ' . $stmt->error);
            }
            
            if ($stmt->affected_rows === 0) {
                throw new Exception('No rows updated - ID may not exist');
            }
            
            echo json_encode([
                'success' => true,
                'message' => 'Status updated successfully'
            ]);
            
        } catch (Exception $e) {
            error_log("Error updating status: " . $e->getMessage());
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        }
        
        exit;
    }
    
    // Get table parameter to determine which table to fetch
    $table = $_GET['table'] ?? 'barangay_id';
    
    $requests = [];
    
    // Debug: Log the table being queried
    error_log("Querying table: " . $table);
    
    // Check if table exists first (handle special cases)
    $tableName = $table . '_forms';
    if ($table === 'indigency') {
        $tableName = 'indigency_forms';
    }
    $checkTable = $connection->query("SHOW TABLES LIKE '$tableName'");
    if (!$checkTable || $checkTable->num_rows === 0) {
        error_log("Table $tableName does not exist");
        echo json_encode(['requests' => []]);
        exit;
    }

    // Fetch data based on table parameter
    switch ($table) {
        case 'barangay_id':
            // First, try to get all columns to see what actually exists
            $describeResult = $connection->query("DESCRIBE barangay_id_forms");
            $actualColumns = [];
            if ($describeResult) {
                while ($col = $describeResult->fetch_assoc()) {
                    $actualColumns[] = $col['Field'];
                }
                error_log("Barangay ID table columns: " . implode(', ', $actualColumns));
            }
            
            // Try SELECT * first to get all data, then map columns
            $sql = "SELECT * FROM barangay_id_forms ORDER BY submitted_at DESC LIMIT 100";
            $result = $connection->query($sql);
            
            if ($result === false) {
                $error = $connection->error;
                error_log("SQL Error for barangay_id: " . $error);
                // Return error info for debugging
                echo json_encode([
                    'requests' => [],
                    'error' => $error,
                    'debug' => 'Query failed: ' . $sql
                ]);
                exit;
            }
            
            error_log("Barangay ID query successful, rows: " . $result->num_rows);
            
            if ($result && $result->num_rows > 0) {
                while ($row = $result->fetch_assoc()) {
                    // Map columns with fallbacks for different naming conventions
                    $id = $row['id'] ?? $row['form_id'] ?? $row['request_id'] ?? '';
                    $lastName = $row['last_name'] ?? $row['surname'] ?? $row['lastname'] ?? '';
                    $givenName = $row['given_name'] ?? $row['givenname'] ?? $row['first_name'] ?? $row['firstname'] ?? '';
                    $middleName = $row['middle_name'] ?? $row['middlename'] ?? '';
                    $birthDate = $row['birth_date'] ?? $row['birthdate'] ?? $row['birthday'] ?? '';
                    
                    $requests[] = [
                        'id' => $id,
                        'documentType' => 'BARANGAY_ID',
                        'bid' => $row['bid'] ?? '',
                        'surname' => $lastName,
                        'givenname' => $givenName,
                        'middlename' => $middleName,
                        'birthday' => $birthDate,
                        'address' => $row['address'] ?? '',
                        'civilStatus' => $row['civil_status'] ?? $row['civilstatus'] ?? '',
                        'height' => $row['height'] ?? '',
                        'weight' => $row['weight'] ?? '',
                        'gender' => $row['gender'] ?? '',
                        'emergencyContactName' => $row['emergency_contact_name'] ?? $row['emergencyContactName'] ?? '',
                        'emergencyContactNumber' => $row['emergency_contact_number'] ?? $row['emergencyContactNumber'] ?? '',
                        'isCensused' => isset($row['is_censused']) ? (int)$row['is_censused'] : (isset($row['isCensused']) ? (int)$row['isCensused'] : 0),
                        'residencyDuration' => $row['residency_duration'] ?? $row['residencyDuration'] ?? '',
                        'validId' => $row['valid_id'] ?? $row['validId'] ?? '',
                        'idImage' => null, // Don't include large BLOB data in list view
                        'resPicture' => isset($row['res_picture']) ? safeImageData($row['res_picture']) : (isset($row['resPicture']) ? safeImageData($row['resPicture']) : null),
                        'status' => $row['status'] ?? 'New',
                        'submittedAt' => $row['submitted_at'] ?? $row['submittedAt'] ?? date('Y-m-d H:i:s'),
                        'processAt' => $row['process_at'] ?? $row['processAt'] ?? null,
                        'finishAt' => $row['finish_at'] ?? $row['finishAt'] ?? null
                    ];
                }
                error_log("Successfully processed " . count($requests) . " barangay ID requests");
            } else {
                error_log("Barangay ID query returned 0 rows - table may be empty or query issue");
            }
            break;
            
        case 'certification':
            // Get certification data - with complete error handling
            try {
                error_log("Fetching certification data...");
                
                // Try with ORDER BY first for latest requests
                $sql = "SELECT * FROM certification_forms ORDER BY id DESC LIMIT 100";
                $result = $connection->query($sql);
                
                // If ORDER BY fails, try without it
                if ($result === false) {
                    error_log("SQL Error with ORDER BY, trying without: " . $connection->error);
                    $sql = "SELECT * FROM certification_forms LIMIT 100";
                    $result = $connection->query($sql);
                }
                
                if ($result === false) {
                    error_log("SQL Error for certification: " . $connection->error);
                    echo json_encode(['requests' => []]);
                    exit;
                }
                
                error_log("Certification query successful, rows: " . $result->num_rows);
                
                if ($result && $result->num_rows > 0) {
                    while ($row = $result->fetch_assoc()) {
                        // Map all possible column name variations
                        $lastname = $row['lastname'] ?? $row['last_name'] ?? $row['lastName'] ?? '';
                        $firstname = $row['firstname'] ?? $row['first_name'] ?? $row['firstName'] ?? '';
                        $middlename = $row['middlename'] ?? $row['middle_name'] ?? $row['middleName'] ?? '';
                        $birthday = $row['birthday'] ?? $row['birth_date'] ?? $row['birthDate'] ?? '';
                        $birthplace = $row['birthplace'] ?? $row['birth_place'] ?? $row['birthPlace'] ?? '';
                        $civilStatus = $row['civilStatus'] ?? $row['civil_status'] ?? $row['civilstatus'] ?? '';
                        $validId = $row['validId'] ?? $row['valid_id'] ?? $row['validid'] ?? '';
                        $submittedAt = isset($row['submitted_at']) ? $row['submitted_at'] : (isset($row['submittedAt']) ? $row['submittedAt'] : date('Y-m-d H:i:s'));
                        $processAt = $row['process_at'] ?? $row['processAt'] ?? null;
                        $finishAt = $row['finish_at'] ?? $row['finishAt'] ?? null;
                        
                        // Map purpose-specific fields with various naming conventions
                        $startYear = $row['start_year'] ?? $row['startYear'] ?? $row['startyear'] ?? '';
                        $jobPosition = $row['job_position'] ?? $row['jobPosition'] ?? $row['jobposition'] ?? $row['Job_Position'] ?? '';
                        $startOfWork = $row['start_of_work'] ?? $row['startOfWork'] ?? $row['startofwork'] ?? '';
                        $monthlyIncome = $row['monthly_income'] ?? $row['monthlyIncome'] ?? $row['monthlyincome'] ?? '';
                        $monthYear = $row['month_year'] ?? $row['monthYear'] ?? $row['monthyear'] ?? '';
                        
                        $requests[] = [
                            'id' => $row['id'] ?? '',
                            'documentType' => 'CERTIFICATION',
                            'surname' => $lastname,
                            'givenname' => $firstname,
                            'middlename' => $middlename,
                            'birthday' => $birthday,
                            'birthplace' => $birthplace,
                            'address' => $row['address'] ?? '',
                            'civilStatus' => $civilStatus,
                            'age' => (int)($row['age'] ?? 0),
                            'gender' => $row['gender'] ?? '',
                            'citizenship' => $row['citizenship'] ?? 'FILIPINO',
                            'purpose' => $row['purpose'] ?? '',
                            'validId' => $validId,
                            'idImage' => null,
                            'status' => $row['status'] ?? 'New',
                            'submittedAt' => $submittedAt,
                            'processAt' => $processAt,
                            'finishAt' => $finishAt,
                            // Purpose-specific fields
                            'start_year' => $startYear,
                            'job_position' => $jobPosition,
                            'start_of_work' => $startOfWork,
                            'monthly_income' => $monthlyIncome,
                            'month_year' => $monthYear
                        ];
                    }
                }
                
                error_log("Certification processing complete. Total requests: " . count($requests));
                
            } catch (Exception $e) {
                error_log("Exception in certification: " . $e->getMessage() . " at line " . $e->getLine());
                error_log("Stack trace: " . $e->getTraceAsString());
                echo json_encode(['requests' => []]);
                exit;
            } catch (Error $e) {
                error_log("Fatal error in certification: " . $e->getMessage() . " at line " . $e->getLine());
                error_log("Stack trace: " . $e->getTraceAsString());
                echo json_encode(['requests' => []]);
                exit;
            }
            break;
            
        case 'coe':
            // Try different possible field names for ID
            $possibleIdFields = ['id', 'form_id', 'request_id'];
            $result = false;
            $usedIdField = '';
            
            foreach ($possibleIdFields as $idField) {
                $sql = "SELECT $idField, first_name, middle_name, last_name, address, age, gender, civil_status, employment_type, position, date_started, monthly_salary, valid_id, status, submitted_at, process_at, finish_at FROM coe_forms ORDER BY submitted_at DESC";
                $result = $connection->query($sql);
                
                if ($result !== false) {
                    $usedIdField = $idField;
                    error_log("COE query successful with ID field: $idField");
                    break;
                } else {
                    error_log("COE query failed with ID field $idField: " . $connection->error);
                }
            }
            
            if ($result === false) {
                error_log("SQL Error for coe: " . $connection->error);
                // Return empty array instead of throwing exception
                echo json_encode(['requests' => []]);
                exit;
            }
            
            error_log("COE query successful, rows: " . $result->num_rows);
            
            if ($result !== false) {
                while ($row = $result->fetch_assoc()) {
                    $requests[] = [
                        'id' => $row[$usedIdField] ?? '',
                        'documentType' => 'COE',
                        'surname' => $row['last_name'] ?? '',
                        'givenname' => $row['first_name'] ?? '',
                        'middlename' => $row['middle_name'] ?? '',
                        'address' => $row['address'] ?? '',
                        'age' => (int)($row['age'] ?? 0),
                        'gender' => $row['gender'] ?? '',
                        'civilStatus' => $row['civil_status'] ?? '',
                        'employmentType' => $row['employment_type'] ?? '',
                        'position' => $row['position'] ?? '',
                        'dateStarted' => $row['date_started'] ?? '',
                        'monthlySalary' => $row['monthly_salary'] ?? '',
                        'validId' => $row['valid_id'] ?? '',
                        'idImage' => null,
                        'status' => $row['status'] ?? 'New',
                        'submittedAt' => $row['submitted_at'] ?? date('Y-m-d H:i:s'),
                        'processAt' => $row['process_at'] ?? null,
                        'finishAt' => $row['finish_at'] ?? null
                    ];
                }
            }
            break;
            
        case 'clearance':
            $sql = "SELECT id, first_name, middle_name, last_name, address, birth_date, birth_place, civil_status, age, gender, citizenship, purpose, valid_id, status, submitted_at, process_at, finish_at FROM clearance_forms ORDER BY submitted_at DESC";
            $result = $connection->query($sql);
            
            if ($result === false) {
                error_log("SQL Error for clearance: " . $connection->error);
                // Return empty array instead of throwing exception
                echo json_encode(['requests' => []]);
                exit;
            }
            
            error_log("Clearance query successful, rows: " . $result->num_rows);
            
            if ($result !== false) {
                while ($row = $result->fetch_assoc()) {
                    $requests[] = [
                        'id' => $row['id'] ?? '',
                        'documentType' => 'CLEARANCE',
                        'first_name' => $row['first_name'] ?? '',
                        'middle_name' => $row['middle_name'] ?? '',
                        'last_name' => $row['last_name'] ?? '',
                        'birth_date' => $row['birth_date'] ?? '',
                        'birth_place' => $row['birth_place'] ?? '',
                        'address' => $row['address'] ?? '',
                        'civil_status' => $row['civil_status'] ?? '',
                        'age' => (int)($row['age'] ?? 0),
                        'gender' => $row['gender'] ?? '',
                        'citizenship' => $row['citizenship'] ?? '',
                        'purpose' => $row['purpose'] ?? '',
                        'valid_id' => $row['valid_id'] ?? '',
                        'id_image' => null,
                        'status' => $row['status'] ?? 'New',
                        'submitted_at' => $row['submitted_at'] ?? date('Y-m-d H:i:s'),
                        'process_at' => $row['process_at'] ?? null,
                        'finish_at' => $row['finish_at'] ?? null
                    ];
                }
            }
            break;
            
        case 'indigency':
            $sql = "SELECT id, first_name, middle_name, last_name, address, birth_date, birth_place, civil_status, age, gender, purpose, valid_id, status, submitted_at, process_at, finish_at FROM indigency_forms ORDER BY submitted_at DESC";
            $result = $connection->query($sql);
            
            if ($result === false) {
                error_log("SQL Error for indigency: " . $connection->error);
                // Return empty array instead of throwing exception
                echo json_encode(['requests' => []]);
                exit;
            }
            
            if ($result !== false) {
                while ($row = $result->fetch_assoc()) {
                    $requests[] = [
                        'id' => $row['id'] ?? '',
                        'documentType' => 'INDIGENCY',
                        'surname' => $row['last_name'] ?? '',
                        'givenname' => $row['first_name'] ?? '',
                        'middlename' => $row['middle_name'] ?? '',
                        'birthday' => $row['birth_date'] ?? '',
                        'birthplace' => $row['birth_place'] ?? '',
                        'address' => $row['address'] ?? '',
                        'civilStatus' => $row['civil_status'] ?? '',
                        'age' => (int)($row['age'] ?? 0),
                        'gender' => $row['gender'] ?? '',
                        'purpose' => $row['purpose'] ?? '',
                        'validId' => $row['valid_id'] ?? '',
                        'idImage' => null,
                        'status' => $row['status'] ?? 'New',
                        'submittedAt' => $row['submitted_at'] ?? date('Y-m-d H:i:s'),
                        'processAt' => $row['process_at'] ?? null,
                        'finishAt' => $row['finish_at'] ?? null
                    ];
                }
            }
            break;
            
        default:
            throw new Exception("Invalid table parameter: " . $table);
    }

    $connection->close();

    // Debug: Log the final result
    error_log("Final result for table $table: " . count($requests) . " requests");
    
    // Return the data
    echo json_encode(['requests' => $requests]);

} catch (Exception $e) {
    error_log("Exception in reqDocu.php: " . $e->getMessage() . " at " . $e->getFile() . ":" . $e->getLine());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'requests' => []
    ]);
} catch (Error $e) {
    error_log("Fatal error in reqDocu.php: " . $e->getMessage() . " at " . $e->getFile() . ":" . $e->getLine());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'requests' => []
    ]);
}

?>
