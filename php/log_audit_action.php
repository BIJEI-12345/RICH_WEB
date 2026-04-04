<?php
require_once __DIR__ . '/init_session.php';
// Log user action to audit trail
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { 
    http_response_code(204); 
    exit; 
}

// Start session
rich_session_start();

// Audit trail rows are only written server-side for auth events (see audit_trail_helper.php).
// Page-view / client-side logging is intentionally not persisted.

// Only process POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid JSON input');
    }
    
    $module = $input['module'] ?? '';
    $action = $input['action'] ?? '';
    $description = $input['description'] ?? '';
    
    if (empty($module) || empty($action) || empty($description)) {
        throw new Exception('Missing required fields');
    }
    
    echo json_encode(['success' => true]);
    
} catch (Exception $e) {
    error_log("Error logging audit action: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>

