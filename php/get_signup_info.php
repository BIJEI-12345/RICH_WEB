<?php
session_start();

// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

// Set content type to JSON
header('Content-Type: application/json');

// Get user data from session
$email = $_SESSION['signup_email'] ?? '';
$name = $_SESSION['signup_name'] ?? '';

if (empty($email) || empty($name)) {
    echo json_encode(['success' => false, 'message' => 'Session expired. Please register again.']);
    exit();
}

echo json_encode([
    'success' => true,
    'email' => $email,
    'name' => $name
]);
?>
