<?php
session_start();

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
} catch (PDOException $e) {
    error_log("Database connection error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}

// Include PHPMailer
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/email_config.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Set content type to JSON
header('Content-Type: application/json');

// Function to generate 6-digit OTP
function generateOTP() {
    return sprintf('%06d', rand(100000, 999999));
}

// Function to get OTP expiration time (5 minutes from now)
function getOTPExpirationTime() {
    return date('Y-m-d H:i:s', strtotime('+5 minutes'));
}

// Check if POST request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit();
}

// Get user email from session
$email = $_SESSION['signup_email'] ?? '';
$name = $_SESSION['signup_name'] ?? '';

if (empty($email) || empty($name)) {
    echo json_encode(['success' => false, 'message' => 'Session expired. Please register again.']);
    exit();
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
    
    if ($updateStmt->execute([$newOTP, $newExpiration, $email])) {
        // Send new OTP email
        $mail = new PHPMailer(true);
        
        try {
            // Server settings
            $mail->isSMTP();
            $mail->Host = SMTP_HOST;
            $mail->SMTPAuth = true;
            $mail->Username = SMTP_USERNAME;
            $mail->Password = SMTP_PASSWORD;
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = SMTP_PORT;
            
            // Recipients
            $mail->setFrom(SMTP_FROM_EMAIL, SMTP_FROM_NAME);
            $mail->addAddress($email, $name);
            
            // Content
            $mail->isHTML(true);
            $mail->Subject = "New OTP Verification Code - RICH Barangay System";
            
            $mail->Body = "
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
                            <strong>Important:</strong> This OTP code will expire in 5 minutes. Please use it as soon as possible.
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
            
            $mail->send();
            echo json_encode(['success' => true, 'message' => 'New verification code sent to your email!']);
        } catch (Exception $e) {
            error_log("Email sending failed: " . $mail->ErrorInfo);
            echo json_encode(['success' => false, 'message' => 'Failed to send new code. Please try again.']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to generate new code. Please try again.']);
    }
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database error occurred. Please try again.']);
}
?>
