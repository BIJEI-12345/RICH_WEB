<?php
session_start();

// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

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
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed'
    ]);
    exit();
}

// Check if user email is in session (from signup1)
$email = $_SESSION['signup_email'] ?? '';

if (empty($email)) {
    echo json_encode([
        'success' => false,
        'error' => 'No email found in session',
        'redirect' => 'signup1.html'
    ]);
    exit();
}

try {
    // Check if user exists and their verification status
    $stmt = $pdo->prepare("SELECT id, name, verified_email, action FROM brgy_users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        // User not found, might have been denied during verification
        echo json_encode([
            'success' => false,
            'error' => 'Account not found. Please register again.',
            'redirect' => 'signup1.html'
        ]);
        exit();
    }
    
    if ($user['verified_email'] == 0) {
        // Email not verified yet
        echo json_encode([
            'success' => false,
            'verified' => false,
            'message' => 'Please check your email and verify your account first.',
            'user' => [
                'name' => $user['name'],
                'email' => $email
            ]
        ]);
        exit();
    }
    
    // Email is verified, check if admin approved
    if ($user['action'] === 'accepted') {
        // Admin approved
        echo json_encode([
            'success' => true,
            'verified' => true,
            'approved' => true,
            'message' => 'Account approved! You can now login.',
            'redirect' => 'index.html'
        ]);
    } elseif ($user['action'] === 'deactivated') {
        // Admin deactivated
        echo json_encode([
            'success' => false,
            'verified' => true,
            'approved' => false,
            'error' => 'Your account has been deactivated by the administrator.',
            'redirect' => 'signup1.html'
        ]);
    } elseif ($user['action'] === 'pending' || empty($user['action']) || $user['action'] === 'denied') {
        // Still waiting for admin approval (pending)
        // Note: 'denied' is treated as pending for legacy data compatibility
        echo json_encode([
            'success' => true,
            'verified' => true,
            'approved' => false,
            'message' => 'Email verified! Please wait for administrator approval.',
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $email
            ]
        ]);
    } else {
        // Default fallback - other statuses treated as pending
        echo json_encode([
            'success' => true,
            'verified' => true,
            'approved' => false,
            'message' => 'Email verified! Please wait for administrator approval.',
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $email
            ]
        ]);
    }
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Database error occurred'
    ]);
}
?>
