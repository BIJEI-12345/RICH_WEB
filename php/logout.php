<?php
require_once __DIR__ . '/init_session.php';
rich_session_start();

// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Use config.php for database connection
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/audit_trail_helper.php';

try {
    $connection = getDatabaseConnection();
} catch (Exception $e) {
    error_log("Database connection exception: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed."]);
    exit;
}

    // Check if this is a beacon request (browser close/tab close)
    $isBeaconRequest = isset($_POST['beacon']);
    
    // Get email from POST data (JSON body or FormData) or session (normal logout)
    $email = '';
    
    // First, try to get email from POST data (JSON body) - this is the primary source
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $rawInput = file_get_contents('php://input');
        if (!empty($rawInput)) {
            $input = json_decode($rawInput, true);
            if (isset($input['email']) && !empty($input['email'])) {
                $email = trim($input['email']);
            }
        }
    }
    
    // If not found in JSON body, try FormData (beacon request)
    if (empty($email) && $isBeaconRequest && isset($_POST['email'])) {
        $email = trim($_POST['email']);
    }
    
    // For normal logout (not beacon), ONLY use session if email is not provided in POST
    // IMPORTANT: We should NOT use session for normal logout if email is provided in POST
    // This ensures we use the email from the request, not the session of the viewer (e.g., Admin viewing analytics)
    if (empty($email) && !$isBeaconRequest && isset($_SESSION['user_id'])) {
        $email = $_SESSION['user_id'];
        error_log("Logout - Using session email as fallback: " . $email);
    }
    
    // Log for debugging - this helps identify which user is being logged out
    error_log("Logout request - Email from request: " . ($email ?: 'NOT FOUND') . ", Beacon: " . ($isBeaconRequest ? 'YES' : 'NO') . ", Session user_id: " . (isset($_SESSION['user_id']) ? $_SESSION['user_id'] : 'NOT SET'));
    
    // Check if user is logged in (allow beacon requests even if session expired)
    if (!$isBeaconRequest && (!isset($_SESSION['logged_in']) || !$_SESSION['logged_in'])) {
        http_response_code(401);
        echo json_encode(["error" => "Not logged in"]);
        $connection->close();
        exit;
    }

// For normal logout (not beacon), email is required
if (empty($email) && !$isBeaconRequest) {
    http_response_code(400);
    echo json_encode(["error" => "User email not found. Please provide email in request body."]);
    $connection->close();
    exit;
}

try {
    $now = date('Y-m-d H:i:s');
    $activeHours = 0;
    
    if ($isBeaconRequest && empty($email)) {
        // For beacon requests without email, update users with recent last_login
        // This handles cases where session expired but user was still logged in
        // Use COALESCE to handle NULL total_active_hours
        $updateQuery = "UPDATE brgy_users 
                       SET last_logout = '{$now}',
                           total_active_hours = COALESCE(total_active_hours, 0) + (TIMESTAMPDIFF(SECOND, last_login, '{$now}') / 3600),
                           online_offline = 'offline'
                       WHERE last_login IS NOT NULL 
                       AND last_login >= DATE_SUB('{$now}', INTERVAL 24 HOUR)
                       AND (last_logout IS NULL OR last_logout < last_login)";
        $connection->query($updateQuery);
    } else if (!empty($email)) {
        // Normal logout with email
        $emailEsc = $connection->real_escape_string($email);
        
        // Verify the email exists in database and get last_login
        $verifyQuery = "SELECT email, last_login FROM brgy_users WHERE email = '{$emailEsc}'";
        $verifyResult = $connection->query($verifyQuery);
        
        if (!$verifyResult || $verifyResult->num_rows === 0) {
            error_log("Logout failed: Email not found in database: " . $email);
            http_response_code(404);
            echo json_encode(["error" => "User not found"]);
            $connection->close();
            exit;
        }
        
        $row = $verifyResult->fetch_assoc();
        $lastLogin = $row['last_login'];
        
        // Log for debugging - this helps identify which user is being logged out
        error_log("Logout - Updating user: " . $email . " (verified in database). Session user_id: " . (isset($_SESSION['user_id']) ? $_SESSION['user_id'] : 'NOT SET'));
        
        // IMPORTANT: Make sure we're updating the correct user
        // The email from POST request should match the user being logged out
        // Do NOT use session user_id as it might be the viewer's session (e.g., Admin viewing analytics)
        
        if ($lastLogin) {
            // Calculate hours between last_login and now
            // Use DateTime for proper timezone handling
            $loginTime = new DateTime($lastLogin, new DateTimeZone('Asia/Manila'));
            $logoutTime = new DateTime('now', new DateTimeZone('Asia/Manila'));
            $diff = $logoutTime->diff($loginTime);
            
            // Calculate total seconds active
            $totalSeconds = ($diff->days * 24 * 3600) + ($diff->h * 3600) + ($diff->i * 60) + $diff->s;
            $activeHours = max(0, $totalSeconds / 3600); // Convert to hours
            
            // Update last_logout, ADD to total_active_hours (cumulative), and set online_offline to 'offline'
            // This keeps adding hours every logout, not replacing
            $updateQuery = "UPDATE brgy_users 
                           SET last_logout = '{$now}',
                               total_active_hours = COALESCE(total_active_hours, 0) + {$activeHours},
                               online_offline = 'offline'
                           WHERE email = '{$emailEsc}'";
            $connection->query($updateQuery);
        } else {
            // If no last_login, just set last_logout and online_offline to 'offline'
            $updateQuery = "UPDATE brgy_users SET last_logout = '{$now}', online_offline = 'offline' WHERE email = '{$emailEsc}'";
            $connection->query($updateQuery);
        }
        
        // Log audit trail for logout
        try {
            require_once __DIR__ . '/audit_trail_helper.php';
            $userSql = "SELECT id, name FROM brgy_users WHERE email = ?";
            $userStmt = $connection->prepare($userSql);
            $userStmt->bind_param('s', $emailEsc);
            $userStmt->execute();
            $userResult = $userStmt->get_result();
            $userData = $userResult->fetch_assoc();
            
            if ($userData) {
                logAuditTrail(
                    'logout',
                    'auth',
                    "{$userData['name']} exited system",
                    [
                        'user_id' => $userData['id'],
                        'active_hours' => round($activeHours, 2)
                    ],
                    $userData['id'],
                    'user'
                );
            }
        } catch (Exception $e) {
            error_log("Error logging audit trail: " . $e->getMessage());
        }
        
        // Destroy session
        session_destroy();
    }
    
    if (!$isBeaconRequest) {
        echo json_encode([
            "ok" => true,
            "message" => "Logout successful",
            "active_hours" => round($activeHours, 2)
        ]);
    } else {
        // For beacon, just return 200 OK (no body needed)
        http_response_code(200);
    }
    
    $connection->close();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "An error occurred during logout"]);
    if (isset($connection)) {
        $connection->close();
    }
}
?>

