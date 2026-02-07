<?php
// Cleanup script for expired unverified accounts
// This can be run manually or set up as a cron job

// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

// Database configuration
$host = "rich.cmxcoo6yc8nh.us-east-1.rds.amazonaws.com";
$port = "3306"; // Default MySQL port for RDS
$dbname = "rich_db"; 
$username = "admin";
$password = "4mazonb33j4y!";

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$dbname;charset=utf8", $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 10,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    echo "Database connected successfully.\n";
    
} catch (PDOException $e) {
    error_log("Database connection error: " . $e->getMessage());
    die("Database connection failed: " . $e->getMessage() . "\n");
}

// Function to cleanup expired OTPs
function cleanupExpiredOTPs($pdo) {
    try {
        $currentTime = date('Y-m-d H:i:s');
        
        // First, let's see what expired OTPs we're about to clear
        $checkStmt = $pdo->prepare("
            SELECT email, name, otp_code, otp_expires_at 
            FROM brgy_users 
            WHERE otp_code IS NOT NULL 
            AND otp_expires_at IS NOT NULL 
            AND otp_expires_at < ?
        ");
        $checkStmt->execute([$currentTime]);
        $expiredOTPs = $checkStmt->fetchAll();
        
        if (empty($expiredOTPs)) {
            echo "No expired OTPs found at " . $currentTime . "\n";
            return true;
        }
        
        echo "Found " . count($expiredOTPs) . " expired OTPs:\n";
        foreach ($expiredOTPs as $otp) {
            echo "- " . $otp['email'] . " (" . $otp['name'] . ") - OTP: " . $otp['otp_code'] . " - Expired: " . $otp['otp_expires_at'] . "\n";
        }
        
        // Now clear them
        $stmt = $pdo->prepare("
            UPDATE brgy_users 
            SET otp_code = NULL, otp_expires_at = NULL 
            WHERE otp_code IS NOT NULL 
            AND otp_expires_at IS NOT NULL 
            AND otp_expires_at < ?
        ");
        
        $result = $stmt->execute([$currentTime]);
        
        if ($result) {
            echo "Successfully cleared " . count($expiredOTPs) . " expired OTPs.\n";
            return true;
        } else {
            echo "Failed to clear expired OTPs.\n";
            return false;
        }
        
    } catch (PDOException $e) {
        echo "Error cleaning up expired OTPs: " . $e->getMessage() . "\n";
        return false;
    }
}

// Function to cleanup expired unverified accounts
function cleanupExpiredAccounts($pdo) {
    try {
        $currentTime = date('Y-m-d H:i:s');
        
        // First, let's see what we're about to delete
        $checkStmt = $pdo->prepare("
            SELECT email, name, created_at, otp_expires_at 
            FROM brgy_users 
            WHERE verified_email = 0 
            AND otp_expires_at IS NOT NULL 
            AND otp_expires_at < ?
        ");
        $checkStmt->execute([$currentTime]);
        $expiredAccounts = $checkStmt->fetchAll();
        
        if (empty($expiredAccounts)) {
            echo "No expired accounts found at " . $currentTime . "\n";
            return true;
        }
        
        echo "Found " . count($expiredAccounts) . " expired accounts:\n";
        foreach ($expiredAccounts as $account) {
            echo "- " . $account['email'] . " (" . $account['name'] . ") - Expired: " . $account['otp_expires_at'] . "\n";
        }
        
        // Now delete them
        $stmt = $pdo->prepare("
            DELETE FROM brgy_users 
            WHERE verified_email = 0 
            AND otp_expires_at IS NOT NULL 
            AND otp_expires_at < ?
        ");
        
        $result = $stmt->execute([$currentTime]);
        
        if ($result) {
            $deletedCount = $stmt->rowCount();
            echo "Successfully deleted $deletedCount expired unverified accounts.\n";
            return true;
        }
        return false;
        
    } catch (PDOException $e) {
        echo "Error cleaning up expired accounts: " . $e->getMessage() . "\n";
        return false;
    }
}

// Run cleanup
echo "Starting cleanup of expired data...\n";
echo "Current time: " . date('Y-m-d H:i:s') . "\n\n";

// Clean up expired OTPs first
echo "=== Cleaning up expired OTPs ===\n";
$otpSuccess = cleanupExpiredOTPs($pdo);
echo "\n";

// Then clean up expired unverified accounts
echo "=== Cleaning up expired unverified accounts ===\n";
$accountSuccess = cleanupExpiredAccounts($pdo);

if ($otpSuccess && $accountSuccess) {
    echo "\nAll cleanup completed successfully!\n";
} else {
    echo "\nSome cleanup operations failed!\n";
}

echo "\nCleanup script finished.\n";
?>
