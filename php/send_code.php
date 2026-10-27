<?php
// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

// Database configuration
// Use config.php for database connection
require_once __DIR__ . '/config.php';

try {
    $pdo = getPostgreSQLDatabaseConnection();
} catch (Throwable $e) {
    error_log("Database connection error: " . $e->getMessage());
    header('Location: ../forgotpass.html?error=' . urlencode('Database connection failed. Please try again later.'));
    exit();
}

require_once __DIR__ . '/rich_resend.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim((string) ($_POST['email'] ?? ''));
    
    if (empty($email)) {
        header('Location: ../forgotpass.html?error=' . urlencode('Please enter your email address'));
        exit();
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        header('Location: ../forgotpass.html?error=' . urlencode('Please enter a valid email address'));
        exit();
    }
    
    try {
        // First, clean up any expired OTPs
        $cleanupStmt = $pdo->prepare("UPDATE brgy_users SET otp_code = NULL, otp_expires_at = NULL WHERE otp_expires_at < NOW()");
        $cleanupStmt->execute();
        
        // Check if email exists in database
        $stmt = $pdo->prepare("SELECT email, name FROM brgy_users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        
        if (!$user) {
            header('Location: ../forgotpass.html?error=' . urlencode('Email address not found in our system'));
            exit();
        }
        
        // Generate unique verification code (6 digits)
        $verification_code = sprintf('%06d', random_int(100000, 999999));
        
        // Set expiration time (3 minutes from now) in Philippine time military format
        $expires_at = date('Y-m-d H:i:s', time() + (3 * 60));
        
        // Store verification code in database
        $stmt = $pdo->prepare("UPDATE brgy_users SET otp_code = ?, otp_expires_at = ? WHERE email = ?");
        $stmt->execute([$verification_code, $expires_at, $email]);
        
        $html = "
            <html>
            <head>
                <title>Password Reset Verification Code</title>
            </head>
            <body>
                <h2>Password Reset Request</h2>
                <p>Hello " . htmlspecialchars($user['name']) . ",</p>
                <p>You have requested to reset your password. Please use the following verification code:</p>
                <h3 style='background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 24px; letter-spacing: 3px;'>" . $verification_code . "</h3>
                <p><strong>This code will expire in 3 minutes.</strong></p>
                <p>If you did not request this password reset, please ignore this email.</p>
                <p>Best regards,<br>Barangay System Team</p>
            </body>
            </html>
            ";
        $plain = "Password reset code: {$verification_code}\n(Expires in 3 minutes.)\n";

        $sent = rich_resend_send_email($email, 'Password Reset Verification Code', $html, $plain);

        if ($sent) {
            header('Location: ../verify_code.html?email=' . urlencode($email) . '&success=' . urlencode('Verification code sent to your email'));
            exit();
        }

        try {
            $clearStmt = $pdo->prepare("UPDATE brgy_users SET otp_code = NULL, otp_expires_at = NULL WHERE email = ? AND otp_code = ?");
            $clearStmt->execute([$email, $verification_code]);
        } catch (PDOException $clearError) {
            error_log('Unable to clear unsent password reset code: ' . $clearError->getMessage());
        }

        error_log('Email sending failed through Resend for password reset.');
        header('Location: ../forgotpass.html?error=' . urlencode('Failed to send verification code. Please try again.'));
        exit();
        
    } catch (PDOException $e) {
        error_log("Database error in send_code.php: " . $e->getMessage());
        header('Location: ../forgotpass.html?error=' . urlencode('An error occurred. Please try again later.'));
        exit();
    }
} else {
    header('Location: ../forgotpass.html');
    exit();
}
?>
