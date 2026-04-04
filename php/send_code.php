<?php
// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

// Database configuration
// Use config.php for database connection
require_once __DIR__ . '/config.php';

try {
    $pdo = getPDODatabaseConnection();
} catch (Exception $e) {
    error_log("Database connection error: " . $e->getMessage());
    header('Location: ../forgotpass.html?error=' . urlencode('Database connection failed. Please try again later.'));
    exit();
}

// Include PHPMailer
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/email_config.php';
require_once __DIR__ . '/rich_smtp.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email']);
    
    // Debug: Log the received email
    error_log("Received email for password reset: " . $email);
    
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
        
        // Debug: Log user lookup result
        error_log("User lookup result: " . ($user ? "Found user: " . $user['name'] : "User not found"));
        
        if (!$user) {
            header('Location: ../forgotpass.html?error=' . urlencode('Email address not found in our system'));
            exit();
        }
        
        // Generate unique verification code (6 digits)
        $verification_code = sprintf('%06d', mt_rand(100000, 999999));
        
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

        $sent = rich_smtp_send_with_gmail_fallback(static function (\PHPMailer\PHPMailer\PHPMailer $mail) use ($email, $user, $html, $plain) {
            $mail->setFrom(SMTP_FROM_EMAIL, SMTP_FROM_NAME);
            $mail->addAddress($email, $user['name']);
            $mail->isHTML(true);
            $mail->Subject = 'Password Reset Verification Code';
            $mail->Body = $html;
            $mail->AltBody = $plain;
        });

        if ($sent) {
            error_log('Email sent successfully to: ' . $email);
            header('Location: ../verify_code.html?email=' . urlencode($email) . '&success=' . urlencode('Verification code sent to your email'));
            exit();
        }

        error_log('Email sending failed after SMTP retries for: ' . $email);
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
