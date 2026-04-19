<?php
require_once __DIR__ . '/init_session.php';
// Disable error reporting to prevent HTML output
error_reporting(0);
ini_set('display_errors', 0);

// Configure session timeout before starting session
ini_set('session.gc_maxlifetime', 3600); // 1 hour (3600 seconds)

rich_session_start();

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

// No automatic session expiration - session stays alive as long as logged_in is true
$loggedIn = false;

if (isset($_SESSION['logged_in']) && $_SESSION['logged_in']) {
    // Always keep session alive - no expiration check
    $loggedIn = true;
    // Update last activity on each check to track usage
    if (!isset($_SESSION['last_activity'])) {
        $_SESSION['last_activity'] = time();
    } else {
        $_SESSION['last_activity'] = time(); // Update last activity on each check
    }
}

$censusDocumentRequestsAllowed = true;
if ($loggedIn) {
    try {
        require_once __DIR__ . '/config.php';
        require_once __DIR__ . '/census_document_guard.php';
        $conn = getDatabaseConnection();
        if ($conn && !@$conn->connect_error) {
            $conn->set_charset('utf8mb4');
            if (rich_session_user_blocked_from_documents($conn)) {
                $censusDocumentRequestsAllowed = false;
            }
            $conn->close();
        }
    } catch (Throwable $e) {
        error_log('userSession census guard: ' . $e->getMessage());
    }
}

$response = [
    'logged_in' => $loggedIn,
    'name' => $loggedIn && isset($_SESSION['user_name']) ? $_SESSION['user_name'] : null,
    'position' => $loggedIn && isset($_SESSION['position']) ? $_SESSION['position'] : null,
    'email' => $loggedIn && isset($_SESSION['user_id']) ? $_SESSION['user_id'] : null,
    'census_document_requests_allowed' => $censusDocumentRequestsAllowed,
];

http_response_code(200);
echo json_encode($response);
exit;
?>


