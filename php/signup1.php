<?php
ob_start();
require_once __DIR__ . '/init_session.php';
rich_session_start();

// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

const TOTAL_ACCOUNT_LIMIT = 10;
const POSITION_ACCOUNT_LIMITS = [
    'Admin' => 2,
    'Concerns & Reporting' => 2,
    'Emergency Category' => 2,
    'Document Request Category' => 2,
    'Mother Leader' => 2
];

// Load config first (.env); email_config also pulls config if loaded alone
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/email_config.php';
require_once __DIR__ . '/rich_smtp.php';

try {
    $pdo = getPDODatabaseConnection();
} catch (Exception $e) {
    error_log("Database connection error: " . $e->getMessage());
    die("Database connection failed: " . $e->getMessage());
}

/**
 * Send JSON and exit. Clears output buffers so PHP notices/warnings do not break JSON parsing in the browser.
 */
function signup_json_exit(array $payload, int $httpCode = 200): void
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code($httpCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['slot_status'])) {
    try {
        $status = getSlotStatus($pdo);
        signup_json_exit([
            'success' => true,
            'status' => $status
        ]);
    } catch (PDOException $e) {
        error_log("Slot status lookup failed: " . $e->getMessage());
        signup_json_exit([
            'success' => false,
            'message' => 'Unable to retrieve slot availability. Please try again later.'
        ], 500);
    }
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

// Function to get OTP expiration time (3 minutes from now)
function getOTPExpirationTime() {
    return date('Y-m-d H:i:s', strtotime('+3 minutes'));
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
        $errors['general'] = 'The maximum number of user accounts (' . TOTAL_ACCOUNT_LIMIT . ') has been reached. Please contact the administrator.';
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

// Function to send OTP verification email (to the address the user typed — e.g. beejay@...; uses .env only for SMTP login)
function sendOTPEmail($email, $name, $otpCode) {
    if (!rich_smtp_configured()) {
        error_log(
            'sendOTPEmail: SMTP not configured. In the project root .env set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL. Gmail: use an App Password (Google Account → Security → 2-Step Verification → App passwords), not your normal password.'
        );
        return false;
    }

    $html = "
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
                        <strong>Important:</strong> This OTP code will expire in 3 minutes. Please use it as soon as possible.
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

    $plain = "RICH Barangay System — OTP Verification\n\n"
        . "Your verification code is: {$otpCode}\n\n"
        . "This code expires in 3 minutes.\n";

    return rich_smtp_send_with_gmail_fallback(static function (\PHPMailer\PHPMailer\PHPMailer $mail) use ($email, $name, $html, $plain) {
        $mail->setFrom(SMTP_FROM_EMAIL, SMTP_FROM_NAME);
        $mail->addAddress($email, $name);
        $mail->isHTML(true);
        $mail->Subject = 'OTP Verification Code - RICH Barangay System';
        $mail->Body = $html;
        $mail->AltBody = $plain;
    });
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
    } elseif (!in_array($position, ['Admin', 'Concerns & Reporting', 'Emergency Category', 'Document Request Category', 'Mother Leader'], true)) {
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
            
            // Prepare INSERT statement with OTP and action columns (save OTP in DB first; email can fail independently)
            $stmt = $pdo->prepare("
                INSERT INTO brgy_users 
                (email, name, age, position, gender, address, password, confirm_pass, created_at, verified_email, action, otp_code, otp_expires_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?)
            ");

            error_log("=== DATABASE INSERTION DEBUG ===");
            error_log("Inserting user data - Position: '" . $position . "', Email: " . $email);

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

                $verifyStmt = $pdo->prepare("SELECT id, name, position FROM brgy_users WHERE email = ? ORDER BY id DESC LIMIT 1");
                $verifyStmt->execute([$email]);
                $insertedUser = $verifyStmt->fetch(PDO::FETCH_ASSOC);

                if ($insertedUser) {
                    error_log("VERIFICATION: User ID " . $insertedUser['id'] . " inserted with position: '" . $insertedUser['position'] . "'");

                    require_once __DIR__ . '/audit_trail_helper.php';
                    logCategoryAuditTrail(
                        $insertedUser['id'],
                        $email,
                        $name,
                        'created',
                        $position,
                        null,
                        null,
                        null,
                        'System',
                        'User account created during registration'
                    );
                } else {
                    error_log("ERROR: Could not verify user insertion!");
                }

                $_SESSION['signup_email'] = $email;
                $_SESSION['signup_name'] = $name;

                $emailSent = sendOTPEmail($email, $name, $otpCode);
                if ($emailSent) {
                    $_SESSION['signup_otp_last_sent'] = time();
                    signup_json_exit([
                        'success' => true,
                        'message' => 'Registration successful! Please check your email for the OTP code and verify your account.',
                        'redirect' => 'signup2.html',
                        'email_sent' => true
                    ]);
                }

                error_log("signup1: User ID saved with OTP but email send failed for: " . $email);
                signup_json_exit([
                    'success' => true,
                    'message' => 'Account created. The verification email could not be sent. Continue to the next page and use Resend OTP, or ask your administrator to check SMTP settings.',
                    'redirect' => 'signup2.html',
                    'email_sent' => false
                ]);
            }

            error_log("Failed to insert user - PDO error: " . implode(', ', $stmt->errorInfo()));
            signup_json_exit([
                'success' => false,
                'errors' => ['general' => 'Failed to create account. Please try again.']
            ]);
            
        } catch (PDOException $e) {
            error_log("Database insertion error: " . $e->getMessage());
            error_log("Error code: " . $e->getCode());
            error_log("SQL State: " . $e->errorInfo[0]);
            signup_json_exit([
                'success' => false,
                'errors' => ['general' => 'Database error occurred. Please try again.']
            ]);
        }
    } else {
        // Return validation errors
        signup_json_exit([
            'success' => false,
            'errors' => $errors
        ]);
    }
    
} else {
    // If not POST request, redirect back to form
    header('Location: signup1.html');
    exit();
}
