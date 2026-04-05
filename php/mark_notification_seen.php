<?php
require_once __DIR__ . '/init_session.php';
require_once __DIR__ . '/notification_access.php';
error_reporting(0);
ini_set('display_errors', 0);

rich_session_start();

date_default_timezone_set('Asia/Manila');
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

$allowedIds = ['docu', 'concerns', 'emergency', 'user_mgmt'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!isset($_SESSION['logged_in']) || !$_SESSION['logged_in']) {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) {
    $body = [];
}

$position = $_SESSION['position'] ?? '';

/** Mark every category this user may access (e.g. after closing the notification dropdown). */
if (!empty($body['all'])) {
    $cats = rich_notification_categories_for_position($position);
    if (!isset($_SESSION['notif_seen']) || !is_array($_SESSION['notif_seen'])) {
        $_SESSION['notif_seen'] = [];
    }
    $now = date('Y-m-d H:i:s');
    foreach ($cats as $c) {
        $_SESSION['notif_seen'][$c] = $now;
    }
    echo json_encode(['success' => true, 'marked' => $cats, 'all' => true]);
    exit;
}

$category = isset($body['category']) ? trim((string) $body['category']) : '';

if (!in_array($category, $allowedIds, true)) {
    echo json_encode(['success' => false, 'error' => 'Invalid category']);
    exit;
}

if (!rich_notification_category_allowed_for_position($position, $category)) {
    echo json_encode(['success' => false, 'error' => 'Category not allowed for your role']);
    exit;
}

if (!isset($_SESSION['notif_seen']) || !is_array($_SESSION['notif_seen'])) {
    $_SESSION['notif_seen'] = [];
}
$_SESSION['notif_seen'][$category] = date('Y-m-d H:i:s');

echo json_encode(['success' => true, 'category' => $category]);
