<?php
// Temporary script to update password for a user
// DELETE THIS FILE AFTER USE FOR SECURITY

require_once __DIR__ . '/config.php';

// Get email and new password from GET parameters (for testing only)
$email = $_GET['email'] ?? '';
$newPassword = $_GET['password'] ?? '';

if (empty($email) || empty($newPassword)) {
    die("Usage: update_password.php?email=your@email.com&password=yourpassword");
}

try {
    $connection = getDatabaseConnection();
    
    // Hash the new password
    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
    
    // Update the password in database
    $emailEsc = $connection->real_escape_string($email);
    $hashedPasswordEsc = $connection->real_escape_string($hashedPassword);
    $sql = "UPDATE brgy_users SET password = '{$hashedPasswordEsc}' WHERE email = '{$emailEsc}'";
    
    if ($connection->query($sql)) {
        echo "Password updated successfully for: $email<br>";
        echo "New hash: " . substr($hashedPassword, 0, 30) . "...<br>";
        echo "You can now login with this password.<br>";
        echo "<br><strong>IMPORTANT: Delete this file (update_password.php) after use!</strong>";
    } else {
        echo "Error updating password: " . $connection->error;
    }
    $connection->close();
    
} catch (Exception $e) {
    die("Error: " . $e->getMessage());
}
?>

