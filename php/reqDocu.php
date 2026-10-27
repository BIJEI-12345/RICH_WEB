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

function ensure_doc_request_revoke_columns($connection, $tableName) {
    $safeTable = preg_replace('/[^a-zA-Z0-9_]/', '', $tableName);
    if ($safeTable === '') {
        return;
    }

    $connection->exec("ALTER TABLE \"$safeTable\" ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP NULL");
    $connection->exec("ALTER TABLE \"$safeTable\" ADD COLUMN IF NOT EXISTS reason_revoke TEXT NULL");
}

try {
    // Include database configuration
    require_once __DIR__ . '/config.php';
    
    $connection = getPostgreSQLDatabaseConnection();
    
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
            $reasonRevoke = trim((string)($input['reason_revoke'] ?? ''));
            
            if ($action !== 'update_status' || !$table || !$id || !$status) {
                throw new Exception('Missing required parameters');
            }
            
            // Normalize status to handle values like "finished", "FINISHED", etc.
            $normalizedStatus = ucfirst(strtolower(trim($status)));
            
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
            ensure_doc_request_revoke_columns($connection, $actualTable);
            
            // Update status with timestamp tracking
            // Get current time using PHP timezone (Philippine time)
            $currentTime = date('Y-m-d H:i:s');
            
            if ($normalizedStatus === 'Processing') {
                // Set status to Processing and update process_at timestamp (using PHP timezone)
                // certification_forms: is_permanent = 1 for jobseeker (retained after retention cleanup), 0 otherwise
                if ($actualTable === 'certification_forms') {
                    $sql = "UPDATE $actualTable SET status = ?, process_at = ?, is_permanent = CASE WHEN LOWER(TRIM(COALESCE(purpose,''))) = 'jobseeker' THEN 1 ELSE 0 END WHERE id = ?";
                } else {
                    $sql = "UPDATE $actualTable SET status = ?, process_at = ? WHERE id = ?";
                }
            } elseif ($normalizedStatus === 'Finished') {
                // Set status to Finished and update finish_at timestamp (using PHP timezone)
                if ($actualTable === 'certification_forms') {
                    $sql = "UPDATE $actualTable SET status = ?, finish_at = ?, is_permanent = CASE WHEN LOWER(TRIM(COALESCE(purpose,''))) = 'jobseeker' THEN 1 ELSE 0 END WHERE id = ?";
                } else {
                    $sql = "UPDATE $actualTable SET status = ?, finish_at = ? WHERE id = ?";
                }
            } elseif ($normalizedStatus === 'Revoked') {
                if ($actualTable === 'certification_forms') {
                    $sql = "UPDATE $actualTable SET status = ?, revoked_at = ?, reason_revoke = ?, is_permanent = CASE WHEN LOWER(TRIM(COALESCE(purpose,''))) = 'jobseeker' THEN 1 ELSE 0 END WHERE id = ?";
                } else {
                    $sql = "UPDATE $actualTable SET status = ?, revoked_at = ?, reason_revoke = ? WHERE id = ?";
                }
            } else {
                // Regular status update without timestamp
                if ($actualTable === 'certification_forms') {
                    $sql = "UPDATE $actualTable SET status = ?, is_permanent = CASE WHEN LOWER(TRIM(COALESCE(purpose,''))) = 'jobseeker' THEN 1 ELSE 0 END WHERE id = ?";
                } else {
                    $sql = "UPDATE $actualTable SET status = ? WHERE id = ?";
                }
            }
            
            $params = $normalizedStatus === 'Revoked'
                ? [$normalizedStatus, $currentTime, $reasonRevoke, $id]
                : (in_array($normalizedStatus, ['Processing', 'Finished'], true)
                    ? [$normalizedStatus, $currentTime, $id]
                    : [$normalizedStatus, $id]);
            $stmt = $connection->prepare($sql);
            $stmt->execute($params);
            
            if ($stmt->rowCount() === 0) {
                throw new Exception('No rows updated - ID may not exist');
            }
            
            // If status is Finished and this is a certification with purpose='jobseeker', insert into job_seeker_report
            if ($normalizedStatus === 'Finished' && $table === 'certification' && $actualTable === 'certification_forms') {
                try {
                    // Get certification data
                    $certSql = "SELECT * FROM certification_forms WHERE id = ?";
                    $certStmt = $connection->prepare($certSql);
                    $certStmt->execute([$id]);
                    $certData = $certStmt->fetch(PDO::FETCH_ASSOC);
                        
                    if ($certData) {
                            $purpose = strtolower($certData['purpose'] ?? '');
                            
                            // Check if purpose is jobseeker
                            if ($purpose === 'jobseeker') {
                                // Get data from certification_forms
                                $lastName = $certData['last_name'] ?? $certData['lastname'] ?? '';
                                $firstName = $certData['first_name'] ?? $certData['firstname'] ?? '';
                                $middleName = $certData['middle_name'] ?? $certData['middlename'] ?? '';
                                $birthDate = $certData['birth_date'] ?? $certData['birthday'] ?? '';
                                $educationalLevel = $certData['educational_level'] ?? $certData['educationalLevel'] ?? $certData['educationallevel'] ?? '';
                                $course = $certData['course'] ?? '';
                                
                                // Map gender from certification_forms to sex column in job_seeker_report
                                $genderRaw = $certData['gender'] ?? '';
                                $sex = '';
                                if (!empty($genderRaw)) {
                                    $g = strtolower(trim($genderRaw));
                                    if (in_array($g, ['male', 'm'], true)) {
                                        $sex = 'Male';
                                    } elseif (in_array($g, ['female', 'f'], true)) {
                                        $sex = 'Female';
                                    } else {
                                        // Keep original text if it's something else (e.g., prefer not to say)
                                        $sex = $certData['gender'];
                                    }
                                }
                                
                                // Calculate age from birth_date (current date - birth_date)
                                $age = 0;
                                if (!empty($birthDate) && $birthDate !== '0000-00-00') {
                                    try {
                                        $birth = new DateTime($birthDate);
                                        $today = new DateTime();
                                        $age = $today->diff($birth)->y;
                                    } catch (Exception $e) {
                                        error_log("Error calculating age: " . $e->getMessage());
                                    }
                                }
                                
                                // Check if record already exists (to avoid duplicates)
                                $checkSql = "SELECT id FROM job_seeker_report WHERE 
                                            (first_name = ? OR first_name = ?) AND 
                                            (last_name = ? OR last_name = ?) AND 
                                            birth_date = ?";
                                $checkStmt = $connection->prepare($checkSql);
                                if ($checkStmt) {
                                    $firstNameAlt = isset($certData['firstname']) ? $certData['firstname'] : '';
                                    $lastNameAlt = isset($certData['lastname']) ? $certData['lastname'] : '';

                                    $checkStmt->execute([
                                        $firstName,
                                        $firstNameAlt,
                                        $lastName,
                                        $lastNameAlt,
                                        $birthDate
                                    ]);
                                    
                                    // Only insert if record doesn't exist
                                    if (!$checkStmt->fetch(PDO::FETCH_ASSOC)) {
                                        // Compute next sequential number for "no" column (start from 1)
                                        $no = 1;
                                        $noSql = "SELECT MAX(no) AS max_no FROM job_seeker_report";
                                        $rowNo = $connection->query($noSql)->fetch(PDO::FETCH_ASSOC);
                                        if ($rowNo) {
                                            $currentMax = (int)($rowNo['max_no'] ?? 0);
                                            $no = $currentMax + 1;
                                        }
                                        
                                        // Insert into job_seeker_report (including no and sex)
                                        $insertSql = "INSERT INTO job_seeker_report 
                                                      (no, last_name, first_name, middle_name, sex, age, birth_date, educational_level, course) 
                                                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
                                        $insertStmt = $connection->prepare($insertSql);
                                        if ($insertStmt->execute([
                                                $no,
                                                $lastName, 
                                                $firstName, 
                                                $middleName, 
                                                $sex,
                                                $age, 
                                                $birthDate, 
                                                $educationalLevel, 
                                                $course
                                            ])) {
                                            error_log("Successfully inserted jobseeker report for certification ID: $id");
                                        }
                                    } else {
                                        error_log("Jobseeker report already exists for certification ID: $id");
                                    }
                                }
                            }
                    }
                } catch (Exception $e) {
                    error_log("Error inserting jobseeker report: " . $e->getMessage());
                    // Don't throw - allow status update to continue even if jobseeker report insert fails
                }
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
    $tableCheck = $connection->prepare(
        'SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = current_schema() AND table_name = ?
        )'
    );
    $tableCheck->execute([$tableName]);
    if (!$tableCheck->fetchColumn()) {
        error_log("Table $tableName does not exist");
        echo json_encode(['requests' => []]);
        exit;
    }
    ensure_doc_request_revoke_columns($connection, $tableName);

    // Fetch data based on table parameter
    switch ($table) {
        case 'barangay_id':
            // Try SELECT * first to get all data, then map columns
            $sql = "SELECT *, encode(id_image, 'base64') AS id_image_base64, encode(res_picture, 'base64') AS res_picture_base64 FROM barangay_id_forms ORDER BY submitted_at DESC LIMIT 100";
            $result = $connection->query($sql);
            
            foreach ($result->fetchAll(PDO::FETCH_ASSOC) as $row) {
                    // Map columns with fallbacks for different naming conventions
                    $id = $row['id'] ?? $row['form_id'] ?? $row['request_id'] ?? '';
                    $lastName = $row['last_name'] ?? $row['surname'] ?? $row['lastname'] ?? '';
                    $givenName = $row['given_name'] ?? $row['givenname'] ?? $row['first_name'] ?? $row['firstname'] ?? '';
                    $middleName = $row['middle_name'] ?? $row['middlename'] ?? '';
                    $birthDate = $row['birth_date'] ?? $row['birthdate'] ?? $row['birthday'] ?? '';
                    $birthPlace = $row['birth_place'] ?? $row['birthplace'] ?? $row['birthPlace'] ?? '';
                    
                    $requests[] = [
                        'id' => $id,
                        'documentType' => 'BARANGAY_ID',
                        'bid' => $row['bid'] ?? '',
                        'surname' => $lastName,
                        'givenname' => $givenName,
                        'middlename' => $middleName,
                        'birthday' => $birthDate,
                        'birthplace' => $birthPlace,
                        'birthPlace' => $birthPlace,
                        'address' => $row['address'] ?? '',
                        'civilStatus' => $row['civil_status'] ?? $row['civilstatus'] ?? '',
                        'height' => normalize_barangay_id_height_string($row['height'] ?? ''),
                        'weight' => $row['weight'] ?? '',
                        'gender' => $row['gender'] ?? '',
                        'emergencyContactName' => $row['emergency_contact_name'] ?? $row['emergencyContactName'] ?? '',
                        'emergencyContactNumber' => $row['emergency_contact_number'] ?? $row['emergencyContactNumber'] ?? '',
                        'isCensused' => isset($row['is_censused']) ? (int)$row['is_censused'] : (isset($row['isCensused']) ? (int)$row['isCensused'] : 0),
                        'residencyDuration' => $row['residency_duration'] ?? $row['residencyDuration'] ?? '',
                        'validId' => $row['valid_id'] ?? $row['validId'] ?? '',
                        'idImage' => null, // Don't include large BLOB data in list view
                        'resPicture' => !empty($row['res_picture_base64']) ? safeImageData(base64_decode($row['res_picture_base64'], true)) : null,
                        'status' => $row['status'] ?? 'New',
                        'submittedAt' => $row['submitted_at'] ?? $row['submittedAt'] ?? date('Y-m-d H:i:s'),
                        'processAt' => $row['process_at'] ?? $row['processAt'] ?? null,
                        'finishAt' => $row['finish_at'] ?? $row['finishAt'] ?? null,
                        'revoked_at' => $row['revoked_at'] ?? null,
                        'reason_revoke' => $row['reason_revoke'] ?? ''
                    ];
            }
            break;
            
        case 'certification':
            // Get certification data - with complete error handling
            try {
                error_log("Fetching certification data...");
                
                $sql = "SELECT * FROM certification_forms ORDER BY id DESC LIMIT 100";
                $result = $connection->query($sql);
                foreach ($result->fetchAll(PDO::FETCH_ASSOC) as $row) {
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
                            'revoked_at' => $row['revoked_at'] ?? null,
                            'reason_revoke' => $row['reason_revoke'] ?? '',
                            // Purpose-specific fields
                            'start_year' => $startYear,
                            'job_position' => $jobPosition,
                            'start_of_work' => $startOfWork,
                            'monthly_income' => $monthlyIncome,
                            'month_year' => $monthYear
                        ];
                }
                error_log("Certification processing complete. Total requests: " . count($requests));
                
            } catch (Exception $e) {
                error_log("Exception in certification: " . $e->getMessage() . " at line " . $e->getLine());
                error_log("Stack trace: " . $e->getTraceAsString());
                echo json_encode(['requests' => []]);
                exit;
            }
            break;
            
        case 'coe':
            $sql = "SELECT id, first_name, middle_name, last_name, address, age, gender, civil_status, employment_type, position, date_started, monthly_salary, valid_id, status, submitted_at, process_at, finish_at, revoked_at, reason_revoke FROM coe_forms ORDER BY submitted_at DESC";
            $result = $connection->query($sql);
            foreach ($result->fetchAll(PDO::FETCH_ASSOC) as $row) {
                    $requests[] = [
                        'id' => $row['id'] ?? '',
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
                        'finishAt' => $row['finish_at'] ?? null,
                        'revoked_at' => $row['revoked_at'] ?? null,
                        'reason_revoke' => $row['reason_revoke'] ?? ''
                    ];
            }
            break;
            
        case 'clearance':
            $sql = "SELECT id, first_name, middle_name, last_name, address, birth_date, birth_place, civil_status, age, gender, citizenship, purpose, valid_id, status, submitted_at, process_at, finish_at, revoked_at, reason_revoke FROM clearance_forms ORDER BY submitted_at DESC";
            $result = $connection->query($sql);
            foreach ($result->fetchAll(PDO::FETCH_ASSOC) as $row) {
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
                        'finish_at' => $row['finish_at'] ?? null,
                        'revoked_at' => $row['revoked_at'] ?? null,
                        'reason_revoke' => $row['reason_revoke'] ?? ''
                    ];
            }
            break;
            
        case 'indigency':
            $sql = 'SELECT id, first_name, middle_name, last_name, address, birth_date, birth_place, civil_status, age, gender, purpose, valid_id, status, submitted_at, process_at, finish_at, revoked_at, reason_revoke, para_kay, "position", hall_address, document_language FROM indigency_forms ORDER BY submitted_at DESC';
            $result = $connection->query($sql);
            foreach ($result->fetchAll(PDO::FETCH_ASSOC) as $row) {
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
                        'finishAt' => $row['finish_at'] ?? null,
                        'revoked_at' => $row['revoked_at'] ?? null,
                        'reason_revoke' => $row['reason_revoke'] ?? '',
                        'para_kay' => $row['para_kay'] ?? '',
                        'position' => $row['position'] ?? '',
                        'hall_address' => $row['hall_address'] ?? '',
                        'document_language' => $row['document_language'] ?? ''
                    ];
            }
            break;
            
        default:
            throw new Exception("Invalid table parameter: " . $table);
    }

    $connection = null;

    // Debug: Log the final result
    error_log("Final result for table $table: " . count($requests) . " requests");
    
    // Return the data
    echo json_encode(['requests' => $requests]);

} catch (Throwable $e) {
    error_log("Exception in reqDocu.php: " . $e->getMessage() . " at " . $e->getFile() . ":" . $e->getLine());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'requests' => []
    ]);
}

?>
