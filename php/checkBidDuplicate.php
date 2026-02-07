<?php
// Check if BID number already exists in database
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_errors.log');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') { 
    http_response_code(204); 
    exit; 
}

require_once 'config.php';

// Function to ensure bid column exists
function ensureBidColumnExists($connection) {
    // Check if bid column exists
    $checkColumn = $connection->query("SHOW COLUMNS FROM barangay_id_forms LIKE 'bid'");
    if ($checkColumn && $checkColumn->num_rows === 0) {
        // Column doesn't exist, create it
        $alterSql = "ALTER TABLE barangay_id_forms ADD COLUMN bid VARCHAR(50) NULL AFTER id";
        if (!$connection->query($alterSql)) {
            throw new Exception("Failed to create bid column: " . $connection->error);
        }
        error_log("checkBidDuplicate: Created bid column in barangay_id_forms table");
    }
}

try {
    $bidValue = $_POST['bid'] ?? null;
    $requestId = $_POST['requestId'] ?? null;
    
    if (!$bidValue) {
        echo json_encode(['exists' => false, 'error' => 'BID value is required']);
        exit;
    }
    
    // Database connection using the function from config.php
    $connection = getDatabaseConnection();
    
    // Ensure bid column exists
    ensureBidColumnExists($connection);
    
    // Check if BID already exists (excluding current request if updating)
    if ($requestId) {
        $checkBidSql = "SELECT id FROM barangay_id_forms WHERE bid = ? AND id != ?";
        $checkBidStmt = $connection->prepare($checkBidSql);
        if (!$checkBidStmt) {
            throw new Exception("Failed to prepare statement: " . $connection->error);
        }
        $checkBidStmt->bind_param("si", $bidValue, $requestId);
    } else {
        $checkBidSql = "SELECT id FROM barangay_id_forms WHERE bid = ?";
        $checkBidStmt = $connection->prepare($checkBidSql);
        if (!$checkBidStmt) {
            throw new Exception("Failed to prepare statement: " . $connection->error);
        }
        $checkBidStmt->bind_param("s", $bidValue);
    }
    
    $checkBidStmt->execute();
    $bidCheckResult = $checkBidStmt->get_result();
    
    $exists = $bidCheckResult->num_rows > 0;
    $existingRequestId = null;
    
    if ($exists) {
        $row = $bidCheckResult->fetch_assoc();
        $existingRequestId = $row['id'];
    }
    
    $checkBidStmt->close();
    $connection->close();
    
    echo json_encode([
        'exists' => $exists,
        'bid' => $bidValue,
        'existingRequestId' => $existingRequestId
    ]);
    
} catch (Exception $e) {
    error_log("checkBidDuplicate Error: " . $e->getMessage());
    error_log("checkBidDuplicate Stack trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'exists' => false,
        'error' => $e->getMessage()
    ]);
} catch (Error $e) {
    error_log("checkBidDuplicate Fatal Error: " . $e->getMessage());
    error_log("checkBidDuplicate Stack trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'exists' => false,
        'error' => 'Fatal error: ' . $e->getMessage()
    ]);
}
?>

