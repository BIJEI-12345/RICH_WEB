<?php
// Test script to verify password hashing and database connection
// DELETE THIS FILE AFTER USE FOR SECURITY

require_once __DIR__ . '/config.php';

$email = $_GET['email'] ?? 'earljoshuauy041304@gmail.com';
$testPassword = $_GET['password'] ?? 'B33j4y!!';

echo "<h2>Password Verification Test</h2>";
echo "Email: $email<br>";
echo "Test Password: $testPassword<br><br>";

try {
    $connection = getDatabaseConnection();
    $host = $connection->host_info;
    echo "<strong>Connected to:</strong> $host<br><br>";
    
    // Get user from database
    $emailEsc = $connection->real_escape_string($email);
    $sql = "SELECT email, password, verified_email, action, name FROM brgy_users WHERE email='{$emailEsc}'";
    $res = $connection->query($sql);
    
    if ($res && $row = $res->fetch_assoc()) {
        echo "<strong>User found in database:</strong><br>";
        echo "Email: " . $row['email'] . "<br>";
        echo "Name: " . $row['name'] . "<br>";
        echo "Verified: " . $row['verified_email'] . "<br>";
        echo "Action: " . ($row['action'] ?? 'NULL') . "<br><br>";
        
        $hash = trim($row['password'] ?? '');
        echo "<strong>Password Hash Info:</strong><br>";
        echo "Hash length: " . strlen($hash) . "<br>";
        echo "Hash starts with: " . substr($hash, 0, 20) . "...<br>";
        echo "Hash format: " . (strpos($hash, '$2y$') === 0 ? "Valid bcrypt" : "Invalid format") . "<br><br>";
        
        // Test password verification
        echo "<strong>Password Verification:</strong><br>";
        $isValid = password_verify($testPassword, $hash);
        echo "Result: " . ($isValid ? "<span style='color:green'>VALID ✓</span>" : "<span style='color:red'>INVALID ✗</span>") . "<br><br>";
        
        if (!$isValid) {
            echo "<strong>Possible Issues:</strong><br>";
            echo "1. Password hash in database doesn't match the password<br>";
            echo "2. Password was hashed differently<br>";
            echo "3. Password contains special characters that need encoding<br>";
            echo "<br>";
            echo "<strong>Solution:</strong> Use update_password.php to reset the password<br>";
            echo "URL: update_password.php?email=$email&password=$testPassword<br>";
        } else {
            echo "<span style='color:green'>Password verification works! The issue might be elsewhere.</span><br>";
        }
        
    } else {
        echo "<span style='color:red'>User NOT found in database!</span><br>";
        echo "Make sure you're connected to the correct database (AWS).<br>";
    }
    
    $connection->close();
    
} catch (Exception $e) {
    echo "<span style='color:red'>Error: " . $e->getMessage() . "</span><br>";
}

echo "<br><br><strong>IMPORTANT: Delete this file after testing!</strong>";
?>

