<?php
require_once __DIR__ . '/init_session.php';
rich_session_start();

// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

// Include PHPMailer
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/email_config.php';

// Database configuration
// Use config.php for database connection
require_once __DIR__ . '/config.php';

try {
    $pdo = getPDODatabaseConnection();
} catch (Exception $e) {
    error_log("Database connection error: " . $e->getMessage());
    die("Database connection failed: " . $e->getMessage());
}

// Get URL parameters
$action = $_GET['action'] ?? '';
$email = $_GET['email'] ?? '';
$token = $_GET['token'] ?? '';

// Validate parameters
if (empty($action) || empty($email) || empty($token)) {
    echo "Invalid verification link. Please try again.";
    exit();
}

// Validate action
if (!in_array($action, ['verify', 'deny'])) {
    echo "Invalid action. Please try again.";
    exit();
}

try {
    // Check if user exists and token matches
    $stmt = $pdo->prepare("SELECT id, name, verified_email FROM brgy_users WHERE email = ? AND verification_token = ?");
    $stmt->execute([$email, $token]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        echo "Invalid verification link or user not found.";
        exit();
    }
    
    // Check if already verified
    if ($user['verified_email'] == 1) {
        echo "Email already verified. You can proceed to login.";
        exit();
    }
    
    if ($action === 'verify') {
        // Verify the email
        $updateStmt = $pdo->prepare("UPDATE brgy_users SET verified_email = 1 WHERE email = ? AND verification_token = ?");
        $result = $updateStmt->execute([$email, $token]);
        
        if ($result) {
            echo "<!DOCTYPE html>
            <html lang='en'>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <title>Email Verified - RICH</title>
                <style>
                    body {
                        font-family: 'Segoe UI', sans-serif;
                        background: linear-gradient(168deg, #ffffff 0%, #f8f8f8 20%, #f0f0f0 40%, #e8e8b5 60%, #d4e6a0 80%, #c8e0a0 100%);
                        margin: 0;
                        padding: 40px 20px;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .container {
                        background: white;
                        padding: 40px;
                        border-radius: 12px;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        text-align: center;
                        max-width: 500px;
                    }
                    .success-icon {
                        font-size: 60px;
                        color: #28a745;
                        margin-bottom: 20px;
                    }
                    h1 {
                        color: #333;
                        margin-bottom: 20px;
                    }
                    p� {
                        color: #666;
                        margin-bottom: 30px;
                        line-height: 1.6;
                    }
                    .btn {
                        background: #13e772;
                        color: black;
                        padding: 12px 24px;
                        border: none;
                        border-radius: 8px;
                        font-weight: bold;
                        text-decoration: none;
                        display: inline-block;
                    }
                    .btn:hover {
                        background: #03e167;
                    }
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='success-icon'>✓</div>
                    <h1>Email Verified Successfully!</h1>
                    <p>Thank you, " . htmlspecialchars($user['name']) . "!<br>Your email has been verified and your account is now active.</p>
                    <a href='signup2.html' class='btn'>Continue to Next Step</a>
                </div>
            </body>
            </html>";
        } else {
            echo "Failed to verify email. Please try again.";
        }
    } else {
        // Deny verification - delete the user
        $deleteStmt = $pdo->prepare("DELETE FROM brgy_users WHERE email = ? AND verification_token = ?");
        $result = $deleteStmt->execute([$email, $token]);
        
        if ($result) {
            echo "<!DOCTYPE html>
            <html lang='en'>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <title>Account Denied - RICH</title>
                <style>
                    body {
                        font-family: 'Segoe UI', sans-serif;
                        background: linear-gradient(168deg, #ffffff 0%, #f8f8f8 20%, #f0f0f0 40%, #e8e8b5 60%, #d4e6a0 80%, #c8e0a0 100%);
                        margin: 0;
                        padding: 40px 20px;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .container {
                        background: white;
                        padding: 40px;
                        border-radius: 12px;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        text-align: center;
                        max-width: 500px;
                    }
                    .info-icon {
                        font-size: 60px;
                        color: #17a2b8;
                        margin-bottom: 20px;
                    }
                    h1 {
                        color: #333;
                        margin-bottom: 20px;
                    }
                    p {
                        color: #666;
                        margin-bottom: 30px;
                        line-height: 1.6;
                    }
                    .btn {
                        background: #13e772;
                        color: black;
                        padding: 12px 24px;
                        border: none;
                        border-radius: 8px;
                        font-weight: bold;
                        text-decoration: none;
                        display: inline-block;
                    }
                    .btn:hover {
                        background: #03e167;
                    }
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='info-icon'>ℹ</div>
                    <h1>Account Registration Denied</h1>
                    <p>Your account registration has been denied as requested.<br>Your information has been removed from our system.</p>
                    <a href='signup1.html' class='btn'>Register Again</a>
                </div>
            </body>
            </html>";
        } else {
            echo "Failed to process your request. Please contact support.";
        }
    }
    
} catch (PDOException $e) {
    echo "Database error occurred. Please try again.";
}
?>
