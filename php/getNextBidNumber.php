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
function ensureBidColumnExists($connection) {
    // Check if bid column exists
    $checkColumn = $connection->query("SHOW COLUMNS FROM barangay_id_forms LIKE 'bid'");
    if ($checkColumn && $checkColumn->num_rows === 0) {
        // Column doesn't exist, create it
        $alterSql = "ALTER TABLE barangay_id_forms ADD COLUMN bid VARCHAR(50) NULL AFTER id";
        if (!$connection->query($alterSql)) {
            throw new Exception("Failed to create bid column: " . $connection->error);
        }
        error_log("getNextBidNumber: Created bid column in barangay_id_forms table");
    }
}

try {
    // Get current year
    $currentYear = date('Y');
    
    // Database connection using the function from config.php
    $connection = getDatabaseConnection();
    
    // Ensure bid column exists
    ensureBidColumnExists($connection);
    
    // Get the highest BID number for the current year
      // Simple query: get all BIDs that start with current year
    $yearPrefix = $currentYear . '-';
    $sql = "SELECT bid FROM barangay_id_forms WHERE bid LIKE '" . $connection->real_escape_string($yearPrefix) . "%' AND bid IS NOT NULL AND bid != ''";
    
    $result = $connection->query($sql);
    
    $nextNumber = 1; // Default to 0001 if no BID exists for this year
    $maxNumber = 0;
    
    if ($result && $result->num_rows > 0) {
        // Find the highest number for this year
        while ($row = $result->fetch_assoc()) {
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
    
    $connection->close();
    
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
