<?php
require_once __DIR__ . '/init_session.php';
// Category Audit Trail Handler
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { 
    http_response_code(204); 
    exit; 
}

// Start session for permission checks
rich_session_start();

// Include configuration file
require_once __DIR__ . '/config.php';

// Set timezone
date_default_timezone_set('Asia/Manila');

// Check if user is admin (case-insensitive check)
$positionRaw = isset($_SESSION['position']) ? $_SESSION['position'] : '';
$position = trim(strtolower($positionRaw));
$isAdmin = ($position === 'admin' || $position === 'administrator');

// Check if user is logged in via session
$isLoggedIn = isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
$hasUserId = isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);

// Only admins can view audit trail
if (!$isAdmin && (!$isLoggedIn || !$hasUserId)) {
    http_response_code(403);
    echo json_encode([
        'success' => false, 
        'error' => 'Access denied. Admin only.'
    ]);
    exit;
}

try {
    $connection = getDatabaseConnection();
    $connection->set_charset('utf8mb4');
} catch (Exception $e) {
    error_log("Database connection error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

// Create audit trail table if it doesn't exist
function createAuditTrailTable($connection) {
    $sql = "CREATE TABLE IF NOT EXISTS category_audit_trail (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        action_type ENUM('created', 'updated', 'deleted', 'approved', 'deactivated', 'activated', 'rejected') NOT NULL,
        old_category VARCHAR(255) DEFAULT NULL,
        new_category VARCHAR(255) NOT NULL,
        changed_by_user_id INT DEFAULT NULL,
        changed_by_email VARCHAR(255) DEFAULT NULL,
        changed_by_name VARCHAR(255) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_user_email (user_email),
        INDEX idx_action_type (action_type),
        INDEX idx_created_at (created_at),
        INDEX idx_changed_by_user_id (changed_by_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    if ($connection->query($sql)) {
        error_log("Category audit trail table created successfully");
        return true;
    } else {
        error_log("Error creating audit trail table: " . $connection->error);
        return false;
    }
}

// Create table if it doesn't exist
createAuditTrailTable($connection);

// Function to log audit trail entry
function logCategoryChange($connection, $userId, $userEmail, $userName, $actionType, $newCategory, $oldCategory = null, $changedByUserId = null, $changedByEmail = null, $changedByName = null, $notes = null) {
    try {
        $stmt = $connection->prepare("
            INSERT INTO category_audit_trail 
            (user_id, user_email, user_name, action_type, old_category, new_category, changed_by_user_id, changed_by_email, changed_by_name, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $stmt->bind_param(
            "issssssiss",
            $userId,
            $userEmail,
            $userName,
            $actionType,
            $oldCategory,
            $newCategory,
            $changedByUserId,
            $changedByEmail,
            $changedByName,
            $notes
        );
        
        if ($stmt->execute()) {
            return true;
        } else {
            error_log("Error logging audit trail: " . $stmt->error);
            return false;
        }
    } catch (Exception $e) {
        error_log("Exception logging audit trail: " . $e->getMessage());
        return false;
    }
}

// Handle GET request - Retrieve audit trail
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $userId = $_GET['user_id'] ?? null;
        $actionType = $_GET['action_type'] ?? null;
        $userEmail = $_GET['user_email'] ?? null;
        $limit = intval($_GET['limit'] ?? 100);
        $offset = intval($_GET['offset'] ?? 0);
        
        // Build query
        $sql = "SELECT 
                    cat.*,
                    u.name as user_full_name,
                    u.position as current_position
                FROM category_audit_trail cat
                LEFT JOIN brgy_users u ON cat.user_id = u.id
                WHERE 1=1";
        
        $params = [];
        $types = '';
        
        if ($userId !== null) {
            $sql .= " AND cat.user_id = ?";
            $params[] = $userId;
            $types .= 'i';
        }
        
        if ($actionType !== null && $actionType !== '') {
            $sql .= " AND cat.action_type = ?";
            $params[] = $actionType;
            $types .= 's';
        }
        
        if ($userEmail !== null && $userEmail !== '') {
            $sql .= " AND cat.user_email LIKE ?";
            $params[] = '%' . $userEmail . '%';
            $types .= 's';
        }
        
        $sql .= " ORDER BY cat.created_at DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        $types .= 'ii';
        
        $stmt = $connection->prepare($sql);
        
        if (!empty($params)) {
            $stmt->bind_param($types, ...$params);
        }
        
        $stmt->execute();
        $result = $stmt->get_result();
        
        $auditTrail = [];
        while ($row = $result->fetch_assoc()) {
            $auditTrail[] = [
                'id' => $row['id'],
                'user_id' => $row['user_id'],
                'user_email' => $row['user_email'],
                'user_name' => $row['user_name'],
                'user_full_name' => $row['user_full_name'],
                'current_position' => $row['current_position'],
                'action_type' => $row['action_type'],
                'old_category' => $row['old_category'],
                'new_category' => $row['new_category'],
                'changed_by_user_id' => $row['changed_by_user_id'],
                'changed_by_email' => $row['changed_by_email'],
                'changed_by_name' => $row['changed_by_name'],
                'notes' => $row['notes'],
                'created_at' => $row['created_at']
            ];
        }
        
        // Get total count for pagination
        $countSql = "SELECT COUNT(*) as total FROM category_audit_trail WHERE 1=1";
        $countParams = [];
        $countTypes = '';
        
        if ($userId !== null) {
            $countSql .= " AND user_id = ?";
            $countParams[] = $userId;
            $countTypes .= 'i';
        }
        
        if ($actionType !== null && $actionType !== '') {
            $countSql .= " AND action_type = ?";
            $countParams[] = $actionType;
            $countTypes .= 's';
        }
        
        if ($userEmail !== null && $userEmail !== '') {
            $countSql .= " AND user_email LIKE ?";
            $countParams[] = '%' . $userEmail . '%';
            $countTypes .= 's';
        }
        
        $countStmt = $connection->prepare($countSql);
        if (!empty($countParams)) {
            $countStmt->bind_param($countTypes, ...$countParams);
        }
        $countStmt->execute();
        $countResult = $countStmt->get_result();
        $total = $countResult->fetch_assoc()['total'];
        
        echo json_encode([
            'success' => true,
            'data' => $auditTrail,
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset
        ]);
        
    } catch (Exception $e) {
        error_log("Error fetching audit trail: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to fetch audit trail'
        ]);
    }
    exit;
}

// Handle POST request - This is used internally by other scripts to log changes
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $userId = $input['user_id'] ?? null;
    $userEmail = $input['user_email'] ?? null;
    $userName = $input['user_name'] ?? null;
    $actionType = $input['action_type'] ?? null;
    $newCategory = $input['new_category'] ?? null;
    $oldCategory = $input['old_category'] ?? null;
    $changedByUserId = $input['changed_by_user_id'] ?? null;
    $changedByEmail = $input['changed_by_email'] ?? null;
    $changedByName = $input['changed_by_name'] ?? null;
    $notes = $input['notes'] ?? null;
    
    // Validate required fields
    if (!$userId || !$userEmail || !$userName || !$actionType || !$newCategory) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Missing required fields'
        ]);
        exit;
    }
    
    // Log the change
    if (logCategoryChange($connection, $userId, $userEmail, $userName, $actionType, $newCategory, $oldCategory, $changedByUserId, $changedByEmail, $changedByName, $notes)) {
        echo json_encode([
            'success' => true,
            'message' => 'Audit trail entry created successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to create audit trail entry'
        ]);
    }
    exit;
}

$connection->close();
?>

