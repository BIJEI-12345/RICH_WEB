<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_errors.log');

// Get the next available BID number for the current year
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
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
    // Get current year
    $currentYear = date('Y');
    
    // Database connection using the function from config.php
    $connection = getPostgreSQLDatabaseConnection();
    
    // Ensure bid column exists
    ensureBidColumnExists($connection);
    
    // Get the highest BID number for the current year
      // Simple query: get all BIDs that start with current year
    $yearPrefix = $currentYear . '-';
    $stmt = $connection->prepare("SELECT bid FROM barangay_id_forms WHERE bid LIKE ? AND bid IS NOT NULL AND bid <> ''");
    $stmt->execute([$yearPrefix . '%']);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $nextNumber = 1; // Default to 0001 if no BID exists for this year
    $maxNumber = 0;
    
    if ($rows) {
        // Find the highest number for this year
        foreach ($rows as $row) {
            $bid = trim($row['bid']);
            // Extract number after year and dash (e.g., "2026-0112" -> 112)
            if (preg_match('/^' . $currentYear . '-(\d+)$/', $bid, $matches)) {
                $number = (int)$matches[1];
                if ($number > $maxNumber) {
                    $maxNumber = $number;
                }
            }
        }
        
        if ($maxNumber > 0) {
            $nextNumber = $maxNumber + 1;
        }
    }
    
    $connection = null;
    
    // Format the next BID number with leading zeros (4 digits)
    $nextBid = $currentYear . '-' . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    
    echo json_encode([
        'success' => true,
        'nextBid' => $nextBid,
        'year' => $currentYear,
        'nextNumber' => $nextNumber
    ]);
    
} catch (Exception $e) {
    $errorMsg = $e->getMessage();
    $errorTrace = $e->getTraceAsString();
    error_log("getNextBidNumber Exception: " . $errorMsg);
    error_log("getNextBidNumber Stack trace: " . $errorTrace);
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $errorMsg,
        'nextBid' => date('Y') . '-0001', // Fallback
        'debug' => [
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]
    ]);
} catch (Error $e) {
    $errorMsg = $e->getMessage();
    $errorTrace = $e->getTraceAsString();
    error_log("getNextBidNumber Fatal Error: " . $errorMsg);
    error_log("getNextBidNumber Stack trace: " . $errorTrace);
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Fatal error: ' . $errorMsg,
        'nextBid' => date('Y') . '-0001', // Fallback
        'debug' => [
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]
    ]);
} catch (Throwable $e) {
    $errorMsg = $e->getMessage();
    error_log("getNextBidNumber Throwable: " . $errorMsg);
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error: ' . $errorMsg,
        'nextBid' => date('Y') . '-0001' // Fallback
    ]);
}
?>
