<?php
require_once __DIR__ . '/init_session.php';
// Suppress error display to prevent HTML output before JSON
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { 
    http_response_code(204); 
    exit; 
}

// Start session for permission checks
rich_session_start();

// Check if user is admin (case-insensitive check)
$positionRaw = isset($_SESSION['position']) ? $_SESSION['position'] : '';
$position = trim(strtolower($positionRaw));
$isAdmin = ($position === 'admin' || $position === 'administrator');

// Check if user is logged in via session
$isLoggedIn = isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
$hasUserId = isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);

// Allow access if user is admin OR if they have a valid logged-in session
// (This is more lenient for development/testing - you can make it stricter in production)
if (!$isAdmin && (!$isLoggedIn || !$hasUserId)) {
    http_response_code(403);
    echo json_encode([
        'success' => false, 
        'error' => 'Access denied. Admin only.'
    ]);
    exit;
}

// Use config.php for database connection
require_once __DIR__ . '/config.php';

try {
    $connection = getDatabaseConnection();
} catch (Exception $e) {
    error_log("Database connection error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed: " . $e->getMessage()]); 
    exit;
}

$connection->set_charset('utf8mb4');

// Handle different request methods
$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($requestMethod === 'GET') {
    $category = $_GET['category'] ?? '';
    
    // Set timezone to Philippine time
    date_default_timezone_set('Asia/Manila');
    
    // Calculate 24 hours ago timestamp (used for all archive queries)
    $twentyFourHoursAgo = date('Y-m-d H:i:s', strtotime('-24 hours'));
    
    $archiveData = [];
    
    switch ($category) {
        case 'concern':
            // Get archived concerns from concerns table that are 24+ hours old
            $sql = "SELECT id, reporter_name, contact, date_and_time, location, statement, status, resolved_at 
                    FROM concerns 
                    WHERE UPPER(status) IN ('RESOLVED', 'FINISHED', 'FINISH')
                    AND resolved_at IS NOT NULL
                    AND resolved_at <= ?
                    ORDER BY YEAR(resolved_at) DESC, MONTH(resolved_at) DESC, resolved_at DESC 
                    LIMIT 500";
            
            $stmt = $connection->prepare($sql);
            if ($stmt) {
                $stmt->bind_param("s", $twentyFourHoursAgo);
                if ($stmt->execute()) {
                    $result = $stmt->get_result();
                    if ($result && $result->num_rows > 0) {
                        while ($row = $result->fetch_assoc()) {
                            $archiveData[] = $row;
                        }
                    }
                } else {
                    error_log("Error executing concern query: " . $stmt->error);
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => 'Database query failed: ' . $stmt->error]);
                    $stmt->close();
                    $connection->close();
                    exit;
                }
                $stmt->close();
            } else {
                error_log("Error preparing concern query: " . $connection->error);
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Database query preparation failed: ' . $connection->error]);
                $connection->close();
                exit;
            }
            break;
            
        case 'emergency':
            // Get archived emergency reports from emergency_reports table that are 24+ hours old
            $sql = "SELECT id, reporter_name, location, date_and_time, description, status, resolved_datetime 
                    FROM emergency_reports 
                    WHERE UPPER(status) IN ('RESOLVED', 'FINISHED', 'FINISH')
                    AND resolved_datetime IS NOT NULL
                    AND resolved_datetime <= ?
                    ORDER BY YEAR(resolved_datetime) DESC, MONTH(resolved_datetime) DESC, resolved_datetime DESC 
                    LIMIT 500";
            
            $stmt = $connection->prepare($sql);
            if ($stmt) {
                $stmt->bind_param("s", $twentyFourHoursAgo);
                if ($stmt->execute()) {
                    $result = $stmt->get_result();
                    if ($result && $result->num_rows > 0) {
                        while ($row = $result->fetch_assoc()) {
                            $archiveData[] = $row;
                        }
                    }
                } else {
                    error_log("Error executing emergency query: " . $stmt->error);
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => 'Database query failed: ' . $stmt->error]);
                    $stmt->close();
                    $connection->close();
                    exit;
                }
                $stmt->close();
            } else {
                error_log("Error preparing emergency query: " . $connection->error);
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Database query preparation failed: ' . $connection->error]);
                $connection->close();
                exit;
            }
            break;
            
        case 'document':
            // Get archived/finished document requests that are at least 24 hours old
            $archiveData = [];
            
            // Get document type filter if provided
            $documentType = $_GET['document_type'] ?? '';
            
            // Map document type to table name
            $tableMap = [
                'barangay_id' => 'barangay_id_forms',
                'certification' => 'certification_forms',
                'coe' => 'coe_forms',
                'clearance' => 'clearance_forms',
                'indigency' => 'indigency_forms'
            ];
            
            // If specific document type is requested, only query that table
            if (!empty($documentType) && isset($tableMap[$documentType])) {
                $tables = [$tableMap[$documentType]];
            } else {
                // Otherwise, check all document tables
                $tables = ['barangay_id_forms', 'certification_forms', 'coe_forms', 'clearance_forms', 'indigency_forms'];
            }
            
            foreach ($tables as $table) {
                try {
                    // Use simple SELECT * query
                    $sql = "SELECT * FROM `{$table}` 
                            WHERE UPPER(status) = 'FINISHED'
                            AND finish_at IS NOT NULL
                            AND finish_at <= ?
                            ORDER BY finish_at DESC 
                            LIMIT 100";
                    
                    $stmt = $connection->prepare($sql);
                    if ($stmt) {
                        $stmt->bind_param("s", $twentyFourHoursAgo);
                        if ($stmt->execute()) {
                            $result = $stmt->get_result();
                            if ($result) {
                                while ($row = $result->fetch_assoc()) {
                                    // Remove created_at from the row data
                                    if (isset($row['created_at'])) {
                                        unset($row['created_at']);
                                    }
                                    
                                    // Determine document type
                                    $docType = 'UNKNOWN';
                                    if (strpos($table, 'barangay_id') !== false) $docType = 'BARANGAY_ID';
                                    elseif (strpos($table, 'certification') !== false) $docType = 'CERTIFICATION';
                                    elseif (strpos($table, 'coe') !== false) $docType = 'COE';
                                    elseif (strpos($table, 'clearance') !== false) $docType = 'CLEARANCE';
                                    elseif (strpos($table, 'indigency') !== false) $docType = 'INDIGENCY';
                                    
                                    // Map common field names
                                    $archiveData[] = [
                                        'id' => $row['id'] ?? '',
                                        'documentType' => $docType,
                                        'purpose' => $row['purpose'] ?? '',
                                        'source_table' => $table,
                                        'surname' => $row['last_name'] ?? $row['surname'] ?? '',
                                        'givenname' => $row['first_name'] ?? $row['given_name'] ?? $row['firstname'] ?? $row['givenname'] ?? '',
                                        'middlename' => $row['middle_name'] ?? $row['middlename'] ?? '',
                                        'address' => $row['address'] ?? '',
                                        'status' => $row['status'] ?? 'Finished',
                                        'submittedAt' => $row['submitted_at'] ?? '',
                                        'finishAt' => $row['finish_at'] ?? '',
                                        // Include all other fields from the row (created_at already removed)
                                        'data' => $row
                                    ];
                                }
                            }
                        } else {
                            error_log("Error executing document query for {$table}: " . $stmt->error);
                        }
                        $stmt->close();
                    } else {
                        error_log("Error preparing document query for {$table}: " . $connection->error);
                    }
                } catch (Exception $e) {
                    error_log("Exception processing table {$table}: " . $e->getMessage());
                }
            }
            
            // Sort by finish date (most recent first)
            usort($archiveData, function($a, $b) {
                $dateA = $a['finishAt'] ?? '';
                $dateB = $b['finishAt'] ?? '';
                
                if (empty($dateA) && empty($dateB)) return 0;
                if (empty($dateA)) return 1;
                if (empty($dateB)) return -1;
                
                return strtotime($dateB) - strtotime($dateA); // Descending
            });
            
            // Limit to 500 most recent
            $archiveData = array_slice($archiveData, 0, 500);
            break;
            
        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid category']);
            $connection->close();
            exit;
    }
    
    // Return success response with archive data (even if empty)
    // Clean data before encoding to avoid JSON errors
    $cleanArchiveData = [];
    foreach ($archiveData as $item) {
        $cleanItem = [];
        foreach ($item as $key => $value) {
            // Skip binary data fields that might cause JSON encoding issues
            if (in_array($key, ['id_image', 'valid_id', 'res_picture', 'emergency_image', 'concern_image'])) {
                // Skip binary image fields
                continue;
            }
            // Handle nested data array
            if ($key === 'data' && is_array($value)) {
                $cleanData = [];
                foreach ($value as $dataKey => $dataValue) {
                    // Skip binary and created_at fields
                    if (in_array($dataKey, ['id_image', 'valid_id', 'res_picture', 'emergency_image', 'concern_image', 'created_at'])) {
                        continue;
                    }
                    // Convert binary strings to null or skip
                    if (is_string($dataValue) && strlen($dataValue) > 1000) {
                        // Likely binary data, skip it
                        continue;
                    }
                    $cleanData[$dataKey] = $dataValue;
                }
                $cleanItem[$key] = $cleanData;
            } else {
                $cleanItem[$key] = $value;
            }
        }
        $cleanArchiveData[] = $cleanItem;
    }
    
    $jsonResponse = json_encode([
        "success" => true, 
        "archive" => $cleanArchiveData,
        "count" => count($cleanArchiveData)
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    
    if ($jsonResponse === false) {
        error_log("JSON encoding error: " . json_last_error_msg());
        http_response_code(500);
        echo json_encode([
            "success" => false, 
            "error" => "Failed to encode archive data",
            "archive" => [],
            "count" => 0
        ]);
    } else {
        echo $jsonResponse;
    }
    
} else {
    http_response_code(405);
    echo json_encode(["success" => false, "error" => "Method not allowed"]);
}

$connection->close();
?>
