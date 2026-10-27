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
function ensureBidColumnExists(PDO $connection): void {
    $checkColumn = $connection->prepare(
        "SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'barangay_id_forms' AND column_name = 'bid'"
    );
    $checkColumn->execute();
    if (!$checkColumn->fetchColumn()) {
        $connection->exec("ALTER TABLE barangay_id_forms ADD COLUMN bid VARCHAR(50) NULL");
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
    $connection = getPostgreSQLDatabaseConnection();
    
    // Ensure bid column exists
    ensureBidColumnExists($connection);
    
    // Check if BID already exists (excluding current request if updating)
    if ($requestId) {
        $checkBidSql = "SELECT id FROM barangay_id_forms WHERE bid = ? AND id != ?";
        $checkBidStmt = $connection->prepare($checkBidSql);
        $checkBidStmt->execute([$bidValue, $requestId]);
    } else {
        $checkBidSql = "SELECT id FROM barangay_id_forms WHERE bid = ?";
        $checkBidStmt = $connection->prepare($checkBidSql);
        $checkBidStmt->execute([$bidValue]);
    }
    
    $row = $checkBidStmt->fetch(PDO::FETCH_ASSOC);
    $exists = $row !== false;
    $existingRequestId = null;
    
    if ($exists) {
        $existingRequestId = $row['id'];
    }
    
    $connection = null;
    
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
