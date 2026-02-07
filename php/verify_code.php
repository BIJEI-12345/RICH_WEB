<?php
// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

// Database configuration
$host = "rich.cmxcoo6yc8nh.us-east-1.rds.amazonaws.com";
$port = "3306"; // Default MySQL port for RDS
$user = "admin";
$pass = "4mazonb33j4y!";
$db   = "rich_db";

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 10,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    error_log("Database connection error: " . $e->getMessage());
    header('Location: ../verify_code.html?error=' . urlencode('Database connection failed. Please try again later.'));
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email']);
    $verification_code = trim($_POST['verification_code']);
    $action = isset($_POST['action']) ? $_POST['action'] : '';
    
    if (empty($email) || empty($verification_code)) {
        header('Location: ../verify_code.html?email=' . urlencode($email) . '&error=' . urlencode('Please enter the valid 6-digit verification code'));
        exit();
    }
    
    if (!preg_match('/^[0-9]{6}$/', $verification_code)) {
        header('Location: ../verify_code.html?email=' . urlencode($email) . '&error=' . urlencode('Please enter a valid 6-digit code'));
        exit();
    }
    
    try {
        // First, clean up any expired OTPs
        $cleanupStmt = $pdo->prepare("UPDATE brgy_users SET otp_code = NULL, otp_expires_at = NULL WHERE otp_expires_at < NOW()");
        $cleanupStmt->execute();
        
        // Always verify OTP code first, regardless of action
        $stmt = $pdo->prepare("SELECT id, name, otp_code, otp_expires_at FROM brgy_users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        
        if (!$user) {
            header('Location: ../verify_code.html?email=' . urlencode($email) . '&error=' . urlencode('User not found. Please try again.'));
            exit();
        }
        
        // For password reset action, verify OTP code first
        if ($action === 'reset_password') {
            // Verify OTP code matches and hasn't expired
            if (empty($user['otp_code']) || $user['otp_code'] !== $verification_code) {
                header('Location: ../verify_code.html?email=' . urlencode($email) . '&code=' . urlencode($verification_code) . '&error=' . urlencode('Invalid verification code. Please check and try again.'));
                exit();
            }
            
            // Check if OTP has expired
            if (empty($user['otp_expires_at']) || strtotime($user['otp_expires_at']) < time()) {
                // Clear expired OTP
                $clearExpiredStmt = $pdo->prepare("UPDATE brgy_users SET otp_code = NULL, otp_expires_at = NULL WHERE email = ?");
                $clearExpiredStmt->execute([$email]);
                
                header('Location: ../verify_code.html?email=' . urlencode($email) . '&error=' . urlencode('Verification code has expired. Please request a new one.'));
                exit();
            }
        } else {
            // For verification, check if code matches and hasn't expired
            if (empty($user['otp_code']) || $user['otp_code'] !== $verification_code) {
                header('Location: ../verify_code.html?email=' . urlencode($email) . '&error=' . urlencode('Invalid verification code. Please check and try again.'));
                exit();
            }
            
            // Check if code has expired
            if (empty($user['otp_expires_at']) || strtotime($user['otp_expires_at']) < time()) {
                // Clear the expired OTP
                $clearExpiredStmt = $pdo->prepare("UPDATE brgy_users SET otp_code = NULL, otp_expires_at = NULL WHERE email = ?");
                $clearExpiredStmt->execute([$email]);
                
                header('Location: ../verify_code.html?email=' . urlencode($email) . '&error=' . urlencode('Verification code has expired. Please request a new one.'));
                exit();
            }
        }
        
        // If action is reset_password, handle password update
        if ($action === 'reset_password') {
            $new_password = trim($_POST['new_password']);
            $confirm_password = trim($_POST['confirm_password']);
            
            if (empty($new_password) || empty($confirm_password)) {
                header('Location: ../verify_code.html?email=' . urlencode($email) . '&code=' . urlencode($verification_code) . '&error=' . urlencode('Please enter both password fields'));
                exit();
            }
            
            if ($new_password !== $confirm_password) {
                header('Location: ../verify_code.html?email=' . urlencode($email) . '&code=' . urlencode($verification_code) . '&error=' . urlencode('Passwords do not match'));
                exit();
            }
            
            if (strlen($new_password) < 6) {
                header('Location: ../verify_code.html?email=' . urlencode($email) . '&code=' . urlencode($verification_code) . '&error=' . urlencode('Password must be at least 6 characters long'));
                exit();
            }
            
            // Hash passwords before storing in database
            $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
            $hashed_confirm_password = password_hash($confirm_password, PASSWORD_DEFAULT);
            
            // Log password reset attempt for debugging
            error_log("Password reset attempt for email: " . $email);
            error_log("New password length: " . strlen($new_password));
            
            // Update password in database as hashed and clear OTP
            $updateStmt = $pdo->prepare("UPDATE brgy_users SET password = ?, confirm_pass = ?, otp_code = NULL, otp_expires_at = NULL WHERE email = ?");
            $updateResult = $updateStmt->execute([$hashed_password, $hashed_confirm_password, $email]);
            
            if ($updateResult && $updateStmt->rowCount() > 0) {
                // Verify the password was actually updated by checking the stored hash
                $verifyStmt = $pdo->prepare("SELECT password FROM brgy_users WHERE email = ?");
                $verifyStmt->execute([$email]);
                $updatedUser = $verifyStmt->fetch();
                
                if ($updatedUser && !empty($updatedUser['password'])) {
                    $storedPasswordHash = trim($updatedUser['password']);
                    
                    // Verify hashed password using password_verify()
                    if (password_verify($new_password, $storedPasswordHash)) {
                        error_log("Password reset successful for email: " . $email);
                        header('Location: ../index.html?success=' . urlencode('Password reset successfully! You can now login with your new password.'));
                        exit();
                    } else {
                        error_log("Password reset verification failed for email: " . $email);
                        header('Location: ../index.html?success=' . urlencode('Password was updated. Please try logging in with your new password.'));
                        exit();
                    }
                } else {
                    error_log("Password reset failed: Could not retrieve updated password for email: " . $email);
                    header('Location: ../verify_code.html?email=' . urlencode($email) . '&code=' . urlencode($verification_code) . '&error=' . urlencode('Failed to verify password update. Please try again.'));
                    exit();
                }
            } else {
                error_log("Password reset database update failed for email: " . $email);
                header('Location: ../verify_code.html?email=' . urlencode($email) . '&code=' . urlencode($verification_code) . '&error=' . urlencode('Failed to update password. Please try again.'));
                exit();
            }
        } else {
            // Code is valid, show password reset form (don't clear OTP yet)
            error_log("OTP verification successful for email: " . $email . " with code: " . $verification_code);
            header('Location: ../verify_code.html?email=' . urlencode($email) . '&code=' . urlencode($verification_code) . '&verified=1');
            exit();
        }
        
    } catch (PDOException $e) {
        error_log("Database error in verify_code.php: " . $e->getMessage());
        header('Location: ../verify_code.html?email=' . urlencode($email) . '&error=' . urlencode('An error occurred. Please try again later.'));
        exit();
    }
} else {
    // Handle GET request - redirect to HTML file
    $email = isset($_GET['email']) ? $_GET['email'] : '';
    $error = isset($_GET['error']) ? $_GET['error'] : '';
    $success = isset($_GET['success']) ? $_GET['success'] : '';
    
    // Redirect to HTML file with parameters
    $redirect_url = '../verify_code.html';
    $params = [];
    
    if (!empty($email)) {
        $params[] = 'email=' . urlencode($email);
    }
    if (!empty($error)) {
        $params[] = 'error=' . urlencode($error);
    }
    if (!empty($success)) {
        $params[] = 'success=' . urlencode($success);
    }
    
    if (!empty($params)) {
        $redirect_url .= '?' . implode('&', $params);
    }
    
    header('Location: ' . $redirect_url);
    exit();
}
?>
