<?php
require_once __DIR__ . '/init_session.php';
// Comprehensive Audit Trail Helper Functions
require_once __DIR__ . '/config.php';

/** Only these auth events are persisted to audit_trail (all other calls are no-ops). */
function audit_trail_allowed_actions() {
    return ['login', 'logout', 'login_failed', 'password_changed'];
}

/**
 * Log a failed login (no session yet). Uses actor override so the row is attributed correctly.
 *
 * @param string $email Attempted email
 * @param string $reason Machine-readable reason (e.g. invalid_password, unknown_email)
 * @param array|null $row Optional brgy_users row when the user exists
 */
function logFailedLoginAttempt($email, $reason, $row = null) {
    $email = trim((string)$email);
    $details = ['reason' => $reason];
    $name = ($row && !empty($row['name'])) ? $row['name'] : 'Unknown';
    $uid = ($row && isset($row['id'])) ? (int)$row['id'] : null;
    $desc = $uid
        ? "Failed login attempt: {$name} ({$email})"
        : "Failed login attempt: {$email}";
    $actorOverride = [
        'email' => $email !== '' ? $email : 'unknown',
        'name' => $name,
        'position' => ($row && isset($row['position'])) ? $row['position'] : null,
        'user_id' => $uid,
    ];
    return logAuditTrail('login_failed', 'auth', $desc, $details, $uid, 'user', null, null, $actorOverride);
}

/**
 * Log any system action to audit trail
 * 
 * @param string $actionType Action type (e.g., 'document_created', 'document_processed', 'status_updated', 'user_approved', 'concern_resolved', 'emergency_reported', 'login', 'logout')
 * @param string $module Module name (e.g., 'documents', 'users', 'concerns', 'emergency', 'auth')
 * @param string $description Human-readable description of the action
 * @param array $details Additional details (JSON will be stored)
 * @param int|null $targetId ID of the target record (optional)
 * @param string|null $targetType Type of target (e.g., 'document_request', 'user', 'concern', 'emergency')
 * @param string|null $oldValue Old value (for updates)
 * @param string|null $newValue New value (for updates)
 * @param array|null $actorOverride Optional ['email','name','position','user_id'] when no session (e.g. failed login, password reset)
 * @return bool Success status
 */
function logAuditTrail($actionType, $module, $description, $details = [], $targetId = null, $targetType = null, $oldValue = null, $newValue = null, $actorOverride = null) {
    try {
        if ($module !== 'auth' || !in_array($actionType, audit_trail_allowed_actions(), true)) {
            return false;
        }

        rich_session_start();
        
        // Get current user info from session, or from actor override (no session)
        $userEmail = 'system';
        $userName = 'System';
        $userPosition = null;
        $userId = null;

        if ($actorOverride !== null && is_array($actorOverride)) {
            $userEmail = isset($actorOverride['email']) ? (string)$actorOverride['email'] : 'unknown';
            $userName = isset($actorOverride['name']) ? (string)$actorOverride['name'] : 'Unknown';
            $userPosition = isset($actorOverride['position']) ? $actorOverride['position'] : null;
            $userId = isset($actorOverride['user_id']) ? (int)$actorOverride['user_id'] : null;
        } else {
            // Note: $_SESSION['user_id'] contains email, not database ID
            $userEmail = isset($_SESSION['user_id']) ? $_SESSION['user_id'] : (isset($_SESSION['email']) ? $_SESSION['email'] : 'system');
            $userName = isset($_SESSION['name']) ? $_SESSION['name'] : (isset($_SESSION['user_name']) ? $_SESSION['user_name'] : 'System');
            $userPosition = isset($_SESSION['position']) ? $_SESSION['position'] : null;
        }
        
        $connection = getDatabaseConnection();
        $connection->set_charset('utf8mb4');
        
        // Resolve user id from email when missing (session path or override with email only)
        if ($userId === null && $userEmail && $userEmail !== 'system' && $userEmail !== 'unknown') {
            $userSql = "SELECT id FROM brgy_users WHERE email = ? LIMIT 1";
            $userStmt = $connection->prepare($userSql);
            if ($userStmt) {
                $userStmt->bind_param('s', $userEmail);
                $userStmt->execute();
                $userRow = rich_mysqli_stmt_fetch_assoc($userStmt);
                if ($userRow) {
                    $userId = $userRow['id'];
                }
                $userStmt->close();
            }
        }
        
        // Create comprehensive audit trail table if it doesn't exist
        $createTableSql = "CREATE TABLE IF NOT EXISTS audit_trail (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT DEFAULT NULL,
            user_email VARCHAR(255) NOT NULL,
            user_name VARCHAR(255) NOT NULL,
            user_position VARCHAR(255) DEFAULT NULL,
            action_type VARCHAR(100) NOT NULL,
            module VARCHAR(50) NOT NULL,
            description TEXT NOT NULL,
            details TEXT DEFAULT NULL,
            target_id INT DEFAULT NULL,
            target_type VARCHAR(50) DEFAULT NULL,
            old_value TEXT DEFAULT NULL,
            new_value TEXT DEFAULT NULL,
            ip_address VARCHAR(45) DEFAULT NULL,
            user_agent TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_id (user_id),
            INDEX idx_user_email (user_email),
            INDEX idx_action_type (action_type),
            INDEX idx_module (module),
            INDEX idx_target_id (target_id),
            INDEX idx_target_type (target_type),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        
        $connection->query($createTableSql);
        
        // Get IP address and user agent
        $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;
        
        // Convert details array to JSON
        $detailsJson = !empty($details) ? json_encode($details, JSON_UNESCAPED_UNICODE) : null;

        // Store event time in Asia/Manila (config.php sets date_default_timezone_set)
        $createdAt = date('Y-m-d H:i:s');
        
        $stmt = $connection->prepare("
            INSERT INTO audit_trail 
            (user_id, user_email, user_name, user_position, action_type, module, description, details, target_id, target_type, old_value, new_value, ip_address, user_agent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $bindTypes = 'i' . str_repeat('s', 7) . 'i' . str_repeat('s', 6);
        $stmt->bind_param(
            $bindTypes,
            $userId,
            $userEmail,
            $userName,
            $userPosition,
            $actionType,
            $module,
            $description,
            $detailsJson,
            $targetId,
            $targetType,
            $oldValue,
            $newValue,
            $ipAddress,
            $userAgent,
            $createdAt
        );
        
        $result = $stmt->execute();
        $stmt->close();
        $connection->close();
        
        return $result;
    } catch (Exception $e) {
        error_log("Error logging audit trail: " . $e->getMessage());
        return false;
    }
}

/**
 * Log category audit trail entry (for backward compatibility)
 * 
 * @param int $userId User ID
 * @param string $userEmail User email
 * @param string $userName User name
 * @param string $actionType Action type: 'created', 'updated', 'deleted', 'approved', 'deactivated', 'activated', 'rejected'
 * @param string $newCategory New category/position
 * @param string|null $oldCategory Old category/position (optional)
 * @param int|null $changedByUserId ID of user who made the change (optional)
 * @param string|null $changedByEmail Email of user who made the change (optional)
 * @param string|null $changedByName Name of user who made the change (optional)
 * @param string|null $notes Additional notes (optional)
 * @return bool Success status
 */
function logCategoryAuditTrail($userId, $userEmail, $userName, $actionType, $newCategory, $oldCategory = null, $changedByUserId = null, $changedByEmail = null, $changedByName = null, $notes = null) {
    // Map to new comprehensive audit trail
    $module = 'users';
    $description = "User {$actionType}: {$userName} ({$userEmail})";
    
    $details = [
        'user_id' => $userId,
        'user_email' => $userEmail,
        'user_name' => $userName,
        'old_category' => $oldCategory,
        'new_category' => $newCategory,
        'changed_by_user_id' => $changedByUserId,
        'changed_by_email' => $changedByEmail,
        'changed_by_name' => $changedByName,
        'notes' => $notes
    ];
    
    return logAuditTrail(
        "user_{$actionType}",
        $module,
        $description,
        $details,
        $userId,
        'user',
        $oldCategory,
        $newCategory
    );
}
?>
