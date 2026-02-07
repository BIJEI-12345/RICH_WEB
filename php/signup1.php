<?php
session_start();

// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

const TOTAL_ACCOUNT_LIMIT = 8;
const POSITION_ACCOUNT_LIMITS = [
    'Admin' => 2,
    'Concerns & Reporting' => 2,
    'Emergency Category' => 2,
    'Document Request Category' => 2
];

// Include PHPMailer
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/email_config.php';

use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Database configuration
$host = "rich.cmxcoo6yc8nh.us-east-1.rds.amazonaws.com";
$port = "3306"; // Default MySQL port for RDS
$dbname = "rich_db"; 
$username = "admin";
$password = "4mazonb33j4y!";

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4", $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 10,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    $pdo->setAttribute(PDO::MYSQL_ATTR_INIT_COMMAND, "SET NAMES utf8mb4");
} catch (PDOException $e) {
    error_log("Database connection error: " . $e->getMessage());
    die("Database connection failed: " . $e->getMessage());
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['slot_status'])) {
    header('Content-Type: application/json');
    try {
        $status = getSlotStatus($pdo);
        echo json_encode([
            'success' => true,
            'status' => $status
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Slot status lookup failed: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Unable to retrieve slot availability. Please try again later.'
        ]);
    }
    exit;
}

// Function to validate email
function validateEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL);
}

// Function to validate password strength
function validatePasswordStrength($password) {
    $requirements = [
        'length' => strlen($password) >= 8,
        'uppercase' => preg_match('/[A-Z]/', $password),
        'lowercase' => preg_match('/[a-z]/', $password),
        'number' => preg_match('/\d/', $password),
        'special' => preg_match('/[!@#$%^&*()_+\-=\[\]{};:\'"\\|,.<>\/?]/', $password)
    ];
    
    $satisfiedCount = count(array_filter($requirements));
    return $satisfiedCount >= 4; // Require at least 4 out of 5 requirements
}

// Function to generate 6-digit OTP
function generateOTP() {
    return sprintf('%06d', rand(100000, 999999));
}

// Function to get OTP expiration time (5 minutes from now)
function getOTPExpirationTime() {
    return date('Y-m-d H:i:s', strtotime('+5 minutes'));
}

// Function to cleanup expired unverified accounts
function cleanupExpiredAccounts($pdo) {
    try {
        $currentTime = date('Y-m-d H:i:s');
        
        // Delete accounts that are not verified and OTP has expired
        $stmt = $pdo->prepare("
            DELETE FROM brgy_users 
            WHERE verified_email = 0 
            AND otp_expires_at IS NOT NULL 
            AND otp_expires_at < ?
        ");
        
        $result = $stmt->execute([$currentTime]);
        
        if ($result) {
            $deletedCount = $stmt->rowCount();
            if ($deletedCount > 0) {
                error_log("Cleaned up $deletedCount expired unverified accounts");
            }
            return true;
        }
        return false;
    } catch (PDOException $e) {
        error_log("Error cleaning up expired accounts: " . $e->getMessage());
        return false;
    }
}

// Count active (verified + accepted) users, optionally filtered by position
function getActiveAccountCount($pdo, $position = null) {
    $sql = "
        SELECT COUNT(*) 
        FROM brgy_users 
        WHERE verified_email = 1 
          AND action = 'accepted'
    ";
    $params = [];

    if ($position !== null) {
        $sql .= " AND position = ?";
        $params[] = $position;
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return (int) $stmt->fetchColumn();
}

function getSlotLimitErrors($pdo, $position) {
    $errors = [];

    $totalActive = getActiveAccountCount($pdo);
    if ($totalActive >= TOTAL_ACCOUNT_LIMIT) {
        error_log("Slot limit reached: total active users = $totalActive");
        $errors['general'] = 'The maximum number of user accounts (8) has been reached. Please contact the administrator.';
        return $errors;
    }

    if (isset(POSITION_ACCOUNT_LIMITS[$position])) {
        $positionLimit = POSITION_ACCOUNT_LIMITS[$position];
        $positionActive = getActiveAccountCount($pdo, $position);
        if ($positionActive >= $positionLimit) {
            error_log("Slot limit reached for \"$position\": $positionActive / $positionLimit");
            $errors['position'] = "The {$position} position already has {$positionLimit} active users. Please choose another role or contact the administrator.";
        }
    }

    return $errors;
}

function getSlotStatus($pdo) {
    $totalActive = getActiveAccountCount($pdo);
    $positions = [];

    foreach (POSITION_ACCOUNT_LIMITS as $position => $limit) {
        $active = getActiveAccountCount($pdo, $position);
        $positions[] = [
            'position' => $position,
            'active' => $active,
            'limit' => $limit,
            'full' => $active >= $limit
        ];
    }

    return [
        'totalActive' => $totalActive,
        'totalLimit' => TOTAL_ACCOUNT_LIMIT,
        'totalFull' => $totalActive >= TOTAL_ACCOUNT_LIMIT,
        'positions' => $positions
    ];
}

// Function to send OTP verification email
function sendOTPEmail($email, $name, $otpCode) {
    
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
        $mail->Subject = "OTP Verification Code - RICH Barangay System";
        
        $mail->Body = "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            <title>OTP Verification - RICH Barangay System</title>
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
                    <p>Email Verification Required</p>
                </div>
                
                <div class='content'>
                    <p>Dear <strong>" . htmlspecialchars($name) . "</strong>,</p>
                    
                    <p>Thank you for registering for the RICH Barangay System. To complete your account activation, please use the following One-Time Password (OTP) to verify your email address:</p>
                    
                    <div class='otp-box'>
                        " . $otpCode . "
                    </div>
                    
                    <div class='warning'>
                        <strong>Important:</strong> This OTP code will expire in 5 minutes. Please use it as soon as possible.
                    </div>
                    
                    <p>Enter this code in the verification page to activate your account.</p>
                    
                    <p><strong>Security Notice:</strong> Never share this code with anyone. RICH Barangay System will never ask for your OTP via phone or email.</p>
                </div>
                
                <div class='footer'>
                    <p>© " . date('Y') . " RICH Barangay System. All rights reserved.</p>
                    <p>If you did not register for this account, please ignore this email.</p>
                </div>
            </div>
        </body>
        </html>";
        
        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("Email sending failed: " . $mail->ErrorInfo);
        return false;
    }
}

// Check if form was submitted
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Cleanup expired accounts first
    cleanupExpiredAccounts($pdo);
    
    // Get form data
    $email = trim($_POST['email'] ?? '');
    $name = trim($_POST['name'] ?? '');
    $age = intval($_POST['age'] ?? 0);
    $position = $_POST['position'] ?? '';
    $gender = $_POST['gender'] ?? '';
    $address = trim($_POST['address'] ?? '');
    $password = $_POST['pass'] ?? '';
    $confirmPass = $_POST['confirm'] ?? '';
    
    // Debug logging
    error_log("=== SIGNUP DEBUG START ===");
    error_log("Raw POST data: " . print_r($_POST, true));
    error_log("Signup attempt - Email: " . $email . ", Name: " . $name . ", Position: '" . $position . "'");
    error_log("Position length: " . strlen($position) . " characters");
    error_log("Position type: " . gettype($position));
    
    // Initialize error array
    $errors = [];
    
    // Validate email
    if (empty($email)) {
        $errors['email'] = 'Email is required';
    } elseif (!validateEmail($email)) {
        $errors['email'] = 'Please enter a valid email address';
    }
    
    // Validate name
    if (empty($name)) {
        $errors['name'] = 'Full name is required';
    } elseif (strlen($name) < 2) {
        $errors['name'] = 'Name must be at least 2 characters';
    }
    
    // Validate age
    if ($age <= 0 || $age > 120) {
        $errors['age'] = 'Please enter a valid age (1-120)';
    }
    
    // Validate position
    error_log("=== POSITION VALIDATION DEBUG ===");
    error_log("Position value: '" . $position . "'");
    error_log("Position empty check: " . (empty($position) ? 'TRUE' : 'FALSE'));
    error_log("Position length: " . strlen($position));
    
    if (empty($position)) {
        $errors['position'] = 'Please select your department';
        error_log("ERROR: Position is empty");
    } elseif (!in_array($position, ['Admin', 'Concerns & Reporting', 'Emergency Category', 'Document Request Category'])) {
        $errors['position'] = 'Invalid department selection';
        error_log("ERROR: Position '" . $position . "' is not in valid list");
    } else {
        error_log("SUCCESS: Position validation passed");
    }
    
    // Validate gender
    if (empty($gender)) {
        $errors['gender'] = 'Please select your gender';
    } elseif (!in_array($gender, ['Male', 'Female'])) {
        $errors['gender'] = 'Invalid gender selection';
    }
    
    // Validate address
    if (empty($address)) {
        $errors['address'] = 'Complete address is required';
    } elseif (strlen($address) < 10) {
        $errors['address'] = 'Address must be at least 10 characters';
    }
    
    // Validate password
    if (empty($password)) {
        $errors['password'] = 'Password is required';
    } elseif (!validatePasswordStrength($password)) {
        $errors['password'] = 'Password must meet at least 4 requirements (8+ chars, uppercase, lowercase, number, special char)';
    }
    
    // Validate password confirmation
    if (empty($confirmPass)) {
        $errors['confirm_pass'] = 'Please confirm your password';
    } elseif ($password !== $confirmPass) {
        $errors['confirm_pass'] = 'Passwords do not match';
    }
    
    // Check if email already exists (only for verified accounts)
    if (empty($errors['email'])) {
        try {
            // Check if email exists and is verified
            $stmt = $pdo->prepare("SELECT id, verified_email FROM brgy_users WHERE email = ?");
            $stmt->execute([$email]);
            $existingUser = $stmt->fetch();
            
            if ($existingUser) {
                if ($existingUser['verified_email'] == 1) {
                    // Only show error if the account is already verified
                    $errors['email'] = 'Email address already exists';
                } else {
                    // If account exists but not verified, delete it first (cleanup expired registrations)
                    $deleteStmt = $pdo->prepare("DELETE FROM brgy_users WHERE email = ? AND verified_email = 0");
                    $deleteStmt->execute([$email]);
                    
                    // Log the cleanup for reference
                    error_log("Cleaned up unverified account for email: " . $email);
                }
            }
        } catch (PDOException $e) {
            $errors['general'] = 'Database error occurred. Please try again.';
        }
    }
    
    // Debug validation results
    error_log("=== VALIDATION RESULTS ===");
    error_log("Errors count: " . count($errors));
    if (!empty($errors)) {
        error_log("Validation errors: " . print_r($errors, true));
    } else {
        error_log("Validation passed! Proceeding to database insertion.");
    }

    if (empty($errors)) {
        try {
            $slotLimitErrors = getSlotLimitErrors($pdo, $position);
            if (!empty($slotLimitErrors)) {
                $errors = array_merge($errors, $slotLimitErrors);
            }
        } catch (PDOException $e) {
            error_log("Slot limit check failed: " . $e->getMessage());
            $errors['general'] = 'Database error occurred. Please try again.';
        }
    }
    
    // If no errors, insert into database with verification token
    if (empty($errors)) {
        try {
            // Hash passwords before storing in database
            $hashed_password = password_hash($password, PASSWORD_DEFAULT);
            $hashed_confirm_password = password_hash($confirmPass, PASSWORD_DEFAULT);
            
            // Generate OTP and expiration time
            $otpCode = generateOTP();
            $otpExpiresAt = getOTPExpirationTime();
            
            // Get current Philippine time
            $philippineTime = date('Y-m-d H:i:s');
            
            // Prepare INSERT statement with OTP and action columns
            $stmt = $pdo->prepare("
                INSERT INTO brgy_users 
                (email, name, age, position, gender, address, password, confirm_pass, created_at, verified_email, action, otp_code, otp_expires_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?)
            ");
            
            // Send OTP email first to avoid creating account if email fails
            if (sendOTPEmail($email, $name, $otpCode)) {
                // Debug the data being inserted
                error_log("=== DATABASE INSERTION DEBUG ===");
                error_log("Inserting user data - Position: '" . $position . "', Email: " . $email);
                error_log("All insertion values:");
                error_log("Email: " . $email);
                error_log("Name: " . $name);
                error_log("Age: " . $age);
                error_log("Position: '" . $position . "'");
                error_log("Gender: " . $gender);
                error_log("Address: " . $address);
                
                // Execute the statement with hashed passwords
                $result = $stmt->execute([
                    $email,
                    $name,
                    $age,
                    $position,
                    $gender,
                    $address,
                    $hashed_password,
                    $hashed_confirm_password,
                    $philippineTime,
                    $otpCode,
                    $otpExpiresAt
                ]);
                
                if ($result) {
                    error_log("User inserted successfully with position: '" . $position . "'");
                    
                    // Verify the insertion by querying the database
                    $verifyStmt = $pdo->prepare("SELECT id, name, position FROM brgy_users WHERE email = ? ORDER BY id DESC LIMIT 1");
                    $verifyStmt->execute([$email]);
                    $insertedUser = $verifyStmt->fetch(PDO::FETCH_ASSOC);
                    
                    if ($insertedUser) {
                        error_log("VERIFICATION: User ID " . $insertedUser['id'] . " inserted with position: '" . $insertedUser['position'] . "'");
                    } else {
                        error_log("ERROR: Could not verify user insertion!");
                    }
                    
                    // Store user data in session for next step
                    $_SESSION['signup_email'] = $email;
                    $_SESSION['signup_name'] = $name;
                    
                    // Send success response
                    echo json_encode([
                        'success' => true,
                        'message' => 'Registration successful! Please check your email for the OTP code and verify your account.',
                        'redirect' => 'signup2.html'
                    ]);
                } else {
                    error_log("Failed to insert user - PDO error: " . implode(', ', $stmt->errorInfo()));
                    echo json_encode([
                        'success' => false,
                        'errors' => ['general' => 'Failed to create account. Please try again.']
                    ]);
                }
            } else {
                echo json_encode([
                    'success' => false,
                    'errors' => ['general' => 'Failed to send OTP email. Please check your email address and try again.']
                ]);
            }
            
        } catch (PDOException $e) {
            error_log("Database insertion error: " . $e->getMessage());
            error_log("Error code: " . $e->getCode());
            error_log("SQL State: " . $e->errorInfo[0]);
            echo json_encode([
                'success' => false,
                'errors' => ['general' => 'Database error occurred: ' . $e->getMessage()]
            ]);
        }
    } else {
        // Return validation errors
        echo json_encode([
            'success' => false,
            'errors' => $errors
        ]);
    }
    
} else {
    // If not POST request, redirect back to form
    header('Location: signup1.html');
    exit();
}
?>
