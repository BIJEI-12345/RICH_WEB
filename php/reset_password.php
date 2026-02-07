<?php
require_once 'config/database.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email']);
    $token = trim($_POST['token']);
    $new_password = trim($_POST['new_password']);
    $confirm_password = trim($_POST['confirm_password']);
    
    // Validate inputs
    if (empty($email) || empty($token) || empty($new_password) || empty($confirm_password)) {
        header('Location: reset_password.html?email=' . urlencode($email) . '&token=' . urlencode($token) . '&error=All fields are required');
        exit();
    }
    
    if ($new_password !== $confirm_password) {
        header('Location: reset_password.html?email=' . urlencode($email) . '&token=' . urlencode($token) . '&error=Passwords do not match');
        exit();
    }
    
    if (strlen($new_password) < 8) {
        header('Location: reset_password.html?email=' . urlencode($email) . '&token=' . urlencode($token) . '&error=Password must be at least 8 characters long');
        exit();
    }
    
    // Additional password strength validation
    if (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/', $new_password)) {
        header('Location: reset_password.html?email=' . urlencode($email) . '&token=' . urlencode($token) . '&error=Password must contain at least one lowercase letter, one uppercase letter, and one number');
        exit();
    }
    
    try {
        // Verify token and check expiration
        $stmt = $pdo->prepare("SELECT id, username FROM users WHERE email = ? AND verification_code = ? AND code_expires_at > NOW()");
        $stmt->execute([$email, $token]);
        $user = $stmt->fetch();
        
        if (!$user) {
            // Check if token exists but expired
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? AND verification_code = ?");
            $stmt->execute([$email, $token]);
            $expired_user = $stmt->fetch();
            
            if ($expired_user) {
                header('Location: reset_password.html?email=' . urlencode($email) . '&token=' . urlencode($token) . '&error=Verification token has expired. Please start the password reset process again.');
            } else {
                header('Location: reset_password.html?email=' . urlencode($email) . '&token=' . urlencode($token) . '&error=Invalid verification token. Please start the password reset process again.');
            }
            exit();
        }
        
        // Hash the new password
        $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
        
        // Update password and clear verification code
        $stmt = $pdo->prepare("UPDATE users SET password = ?, verification_code = NULL, code_expires_at = NULL WHERE email = ? AND verification_code = ?");
        $stmt->execute([$hashed_password, $email, $token]);
        
        // Send confirmation email
        $subject = "Password Successfully Reset";
        $message = "
        <html>
        <head>
            <title>Password Reset Confirmation</title>
        </head>
        <body>
            <h2>Password Reset Successful</h2>
            <p>Hello " . htmlspecialchars($user['username']) . ",</p>
            <p>Your password has been successfully reset.</p>
            <p>If you did not make this change, please contact our support team immediately.</p>
            <p>Best regards,<br>Barangay System Team</p>
        </body>
        </html>
        ";
        
        $headers = "MIME-Version: 1.0" . "\r\n";
        $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
        $headers .= "From: noreply@barangaysystem.com" . "\r\n";
        
        mail($email, $subject, $message, $headers);
        
        // Redirect to login page with success message
        header('Location: index.html?success=Password has been successfully reset. You can now login with your new password.');
        exit();
        
    } catch (PDOException $e) {
        error_log("Database error in reset_password.php: " . $e->getMessage());
        header('Location: reset_password.html?email=' . urlencode($email) . '&token=' . urlencode($token) . '&error=An error occurred. Please try again later.');
        exit();
    }
} else {
    header('Location: reset_password.html');
    exit();
}
?>
