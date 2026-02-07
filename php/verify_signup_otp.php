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

// Set content type to JSON
header('Content-Type: application/json');

// Check if POST request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit();
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);
$otpCode = trim($input['otp'] ?? '');

// Validate OTP
if (empty($otpCode)) {
    echo json_encode(['success' => false, 'message' => 'Please enter the OTP code']);
    exit();
}

if (!preg_match('/^\d{6}$/', $otpCode)) {
    echo json_encode(['success' => false, 'message' => 'OTP code must be exactly 6 digits']);
    exit();
}

// Get user email from session
$email = $_SESSION['signup_email'] ?? '';

if (empty($email)) {
    echo json_encode(['success' => false, 'message' => 'Session expired. Please register again.']);
    exit();
}

try {
    // Find user with matching email and OTP
    $stmt = $pdo->prepare("
        SELECT id, otp_code, otp_expires_at, name
        FROM brgy_users 
        WHERE email = ? AND otp_code = ? AND verified_email = 0
    ");
    $stmt->execute([$email, $otpCode]);
    $user = $stmt->fetch();
    
    if ($user) {
        // Check if OTP has expired
        $currentTime = date('Y-m-d H:i:s');
        if ($currentTime <= $user['otp_expires_at']) {
            // OTP is valid, verify the user
            $updateStmt = $pdo->prepare("
                UPDATE brgy_users 
                SET verified_email = 1, otp_code = NULL, otp_expires_at = NULL 
                WHERE id = ?
            ");
            
            if ($updateStmt->execute([$user['id']])) {
                // Clear signup session data
                unset($_SESSION['signup_email']);
                unset($_SESSION['signup_name']);
                
                // Set verification success for login page
                $_SESSION['verification_success'] = true;
                $_SESSION['verified_email'] = $email;
                $_SESSION['verified_name'] = $user['name'];
                
                echo json_encode([
                    'success' => true, 
                    'message' => 'Account verified successfully! Redirecting to login...'
                ]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to verify account. Please try again.']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'OTP code has expired. Please request a new one.']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Invalid OTP code. Please check and try again.']);
    }
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database error occurred. Please try again.']);
}
?>
