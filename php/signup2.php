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
    die("Database connection failed: " . $e->getMessage());
}

// Check if form was submitted
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $otpCode = trim($_POST['otp_code'] ?? '');
    
    // Initialize variables
    $error = '';
    $success = '';
    
    // Validate OTP
    if (empty($otpCode)) {
        $error = 'Please enter the verification code';
    } elseif (!preg_match('/^\d{6}$/', $otpCode)) {
        $error = 'Please enter a valid 6-digit code';
    } else {
        // Get user email from session
        $email = $_SESSION['signup_email'] ?? '';
        
        if (empty($email)) {
            $error = 'Session expired. Please register again.';
        } else {
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
                            
                            $success = 'Account verified successfully! Redirecting to login...';
                            echo "<script>alert('$success'); window.location.href='../index.html';</script>";
                            exit();
                        } else {
                            $error = 'Failed to verify account. Please try again.';
                        }
                    } else {
                        $error = 'OTP code has expired. Please request a new one.';
                    }
                } else {
                    $error = 'Invalid verification code. Please check and try again.';
                }
            } catch (PDOException $e) {
                $error = 'Database error occurred. Please try again.';
            }
        }
    }
    
    // If there's an error, show it and redirect back
    if ($error) {
        echo "<script>alert('$error'); window.location.href='../signup2.html';</script>";
        exit();
    }
} else {
    // If not POST request, redirect back to form
    header('Location: ../signup2.html');
    exit();
}
?>
