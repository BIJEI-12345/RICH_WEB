<?php
require_once __DIR__ . '/init_session.php';
rich_session_start();

// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

require_once __DIR__ . '/config.php';

// Set content type to JSON
header('Content-Type: application/json');

// Get user data from session
$email = $_SESSION['signup_email'] ?? '';
$name = $_SESSION['signup_name'] ?? '';

if (empty($email) || empty($name)) {
    echo json_encode(['success' => false, 'message' => 'Session expired. Please register again.']);
    exit();
}

$cooldownSec = (int) (defined('SIGNUP_OTP_RESEND_COOLDOWN_SEC') ? SIGNUP_OTP_RESEND_COOLDOWN_SEC : 60);
$lastSent = (int) ($_SESSION['signup_otp_last_sent'] ?? 0);
$elapsed = $lastSent > 0 ? (time() - $lastSent) : $cooldownSec;
$resendIn = ($lastSent > 0 && $elapsed < $cooldownSec) ? ($cooldownSec - $elapsed) : 0;

echo json_encode([
    'success' => true,
    'email' => $email,
    'name' => $name,
    'resend_available_in_seconds' => $resendIn
]);
?>
