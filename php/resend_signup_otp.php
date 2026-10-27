<?php
ob_start();
require_once __DIR__ . '/init_session.php';
rich_session_start();

function resend_signup_json(array $payload): void
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

// Database configuration
// Use config.php for database connection
require_once __DIR__ . '/config.php';

try {
    $pdo = getPostgreSQLDatabaseConnection();
} catch (Exception $e) {
    error_log("Database connection error: " . $e->getMessage());
    resend_signup_json(['success' => false, 'message' => 'Database connection failed']);
}

require_once __DIR__ . '/rich_resend.php';

// Function to generate 6-digit OTP
function generateOTP() {
    return sprintf('%06d', rand(100000, 999999));
}

// Function to get OTP expiration time (3 minutes from now)
function getOTPExpirationTime() {
    return date('Y-m-d H:i:s', strtotime('+3 minutes'));
}

// Check if POST request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    resend_signup_json(['success' => false, 'message' => 'Invalid request method']);
}

// Get user email from session
$email = $_SESSION['signup_email'] ?? '';
$name = $_SESSION['signup_name'] ?? '';

if (empty($email) || empty($name)) {
    resend_signup_json(['success' => false, 'message' => 'Session expired. Please register again.']);
}

$cooldownSec = (int) (defined('SIGNUP_OTP_RESEND_COOLDOWN_SEC') ? SIGNUP_OTP_RESEND_COOLDOWN_SEC : 60);
$lastSent = (int) ($_SESSION['signup_otp_last_sent'] ?? 0);
if ($lastSent > 0) {
    $wait = $cooldownSec - (time() - $lastSent);
    if ($wait > 0) {
        resend_signup_json([
            'success' => false,
            'message' => 'You can request a new code in ' . $wait . ' second(s).',
            'retry_after_seconds' => $wait,
            'cooldown' => true
        ]);
    }
}

try {
    // Generate new OTP and expiration
    $newOTP = generateOTP();
    $newExpiration = getOTPExpirationTime();
    
    // Update OTP in database
    $updateStmt = $pdo->prepare("
        UPDATE brgy_users 
        SET otp_code = ?, otp_expires_at = ? 
        WHERE email = ? AND verified_email = 0
    ");
    
    if ($updateStmt->execute([$newOTP, $newExpiration, $email]) && $updateStmt->rowCount() > 0) {
        $html = "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <title>New OTP Verification - RICH Barangay System</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; }
                    .content { padding: 20px 0; }
                    .otp-box { 
                        background: #007bff; 
                        color: white; 
                        padding: 20px; 
                        text-align: center; 
                        border-radius: 8px; 
                        margin: 20px 0; 
                        font-size: 24px; 
                        font-weight: bold; 
                        letter-spacing: 5px;
                    }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                    .warning { background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px; border: 1px solid #ffeaa7; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='header'>
                        <h1>RICH Barangay System</h1>
                        <p>New OTP Verification Code</p>
                    </div>
                    
                    <div class='content'>
                        <p>Dear <strong>" . htmlspecialchars($name) . "</strong>,</p>
                        
                        <p>A new One-Time Password (OTP) has been requested for your account verification:</p>
                        
                        <div class='otp-box'>
                            " . $newOTP . "
                        </div>
                        
                        <div class='warning'>
                            <strong>Important:</strong> This OTP code will expire in 3 minutes. Please use it as soon as possible.
                        </div>
                        
                        <p>Enter this code in the verification page to activate your account.</p>
                        
                        <p><strong>Security Notice:</strong> Never share this code with anyone. RICH Barangay System will never ask for your OTP via phone or email.</p>
                    </div>
                    
                    <div class='footer'>
                        <p>© " . date('Y') . " RICH Barangay System. All rights reserved.</p>
                        <p>If you did not request this code, please ignore this email.</p>
                    </div>
                </div>
            </html>";

        $plain = "RICH Barangay System — New OTP\n\nYour code: {$newOTP}\n(Expires in 3 minutes.)\n";

        $sent = rich_resend_send_email($email, 'New OTP Verification Code - RICH Barangay System', $html, $plain);

        if ($sent) {
            $_SESSION['signup_otp_last_sent'] = time();
            resend_signup_json(['success' => true, 'message' => 'New verification code sent to your email!']);
        }
        resend_signup_json([
            'success' => false,
            'message' => 'OTP was updated but email could not be sent. Check the Resend API key and verified sender address in .env.'
        ]);
    }
    resend_signup_json(['success' => false, 'message' => 'Could not update OTP. Register again or contact support.']);
} catch (PDOException $e) {
    error_log('resend_signup_otp: ' . $e->getMessage());
    resend_signup_json(['success' => false, 'message' => 'Database error occurred. Please try again.']);
}
