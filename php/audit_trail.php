<?php
require_once __DIR__ . '/init_session.php';
// Comprehensive Audit Trail Handler
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
require_once __DIR__ . '/audit_trail_helper.php';

// Set timezone
date_default_timezone_set('Asia/Manila');

// Check if user is logged in via session (all authenticated staff/residents may view auth activity log)
$isLoggedIn = isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
$hasUserId = isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);

if (!$isLoggedIn || !$hasUserId) {
    http_response_code(403);
    echo json_encode([
        'success' => false, 
        'error' => 'Access denied. Please log in.'
    ]);
    exit;
}

$position = isset($_SESSION['position']) ? strtolower(trim((string)$_SESSION['position'])) : '';
if ($position !== 'admin') {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'Access denied. Audit trail is available to administrators only.'
    ]);
    exit;
}

try {
    $connection = getDatabaseConnection();
    $connection->set_charset('utf8mb4');
    
    // Create audit trail table if it doesn't exist
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
    
} catch (Exception $e) {
    error_log("Database connection error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// Handle GET request - Retrieve audit trail
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $userId = $_GET['user_id'] ?? null;
        $actionType = $_GET['action_type'] ?? null;
        $module = $_GET['module'] ?? null;
        $userEmail = $_GET['user_email'] ?? null;
        $targetType = $_GET['target_type'] ?? null;
        $scope = isset($_GET['scope']) ? trim($_GET['scope']) : 'all';
        $limit = intval($_GET['limit'] ?? 100);
        $offset = intval($_GET['offset'] ?? 0);
        
        // scope: all | login_history (login, logout, failed) | password (password_changed only)
        if ($scope === 'login_history') {
            $actionFilter = " AND at.action_type IN ('login', 'logout', 'login_failed')";
        } elseif ($scope === 'password') {
            $actionFilter = " AND at.action_type IN ('password_changed')";
        } else {
            $actionFilter = " AND at.action_type IN ('login', 'logout', 'login_failed', 'password_changed')";
        }
        
        // Auth-only events (see audit_trail_helper.php allowed list)
        $sql = "SELECT 
                    at.id,
                    at.user_id,
                    COALESCE(u.name, at.user_name) as full_name,
                    COALESCE(u.position, at.user_position) as position,
                    at.user_email as email,
                    at.action_type,
                    at.module,
                    at.description,
                    at.created_at
                FROM audit_trail at
                LEFT JOIN brgy_users u ON at.user_id = u.id
                WHERE at.module = 'auth'
                  $actionFilter";
        
        $params = [];
        $types = '';
        
        if ($userEmail !== null && $userEmail !== '') {
            $sql .= " AND (at.user_email LIKE ? OR u.email LIKE ?)";
            $params[] = '%' . $userEmail . '%';
            $params[] = '%' . $userEmail . '%';
            $types .= 'ss';
        }
        
        $sql .= " ORDER BY at.created_at DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        $types .= 'ii';
        
        $stmt = $connection->prepare($sql);
        
        if (!$stmt) {
            throw new Exception("Failed to prepare statement: " . $connection->error);
        }
        
        if (!empty($params)) {
            $stmt->bind_param($types, ...$params);
        }
        
        if (!$stmt->execute()) {
            throw new Exception("Failed to execute statement: " . $stmt->error);
        }
        
        $result = $stmt->get_result();
        
        $auditTrail = [];
        while ($row = $result->fetch_assoc()) {
            $auditTrail[] = [
                'id' => $row['id'],
                'user_id' => $row['user_id'],
                'full_name' => $row['full_name'],
                'position' => $row['position'],
                'email' => $row['email'],
                'action_type' => $row['action_type'],
                'module' => $row['module'],
                'description' => $row['description'],
                'created_at' => $row['created_at']
            ];
        }
        
        // Get total count for pagination
        $countSql = "SELECT COUNT(*) as total 
                    FROM audit_trail at
                    LEFT JOIN brgy_users u ON at.user_id = u.id
                    WHERE at.module = 'auth'
                      $actionFilter";
        $countParams = [];
        $countTypes = '';
        
        if ($userEmail !== null && $userEmail !== '') {
            $countSql .= " AND (at.user_email LIKE ? OR u.email LIKE ?)";
            $countParams[] = '%' . $userEmail . '%';
            $countParams[] = '%' . $userEmail . '%';
            $countTypes .= 'ss';
        }
        
        $countStmt = $connection->prepare($countSql);
        if (!$countStmt) {
            throw new Exception("Failed to prepare count statement: " . $connection->error);
        }
        
        if (!empty($countParams)) {
            $countStmt->bind_param($countTypes, ...$countParams);
        }
        
        if (!$countStmt->execute()) {
            throw new Exception("Failed to execute count statement: " . $countStmt->error);
        }
        
        $countResult = $countStmt->get_result();
        $totalRow = $countResult->fetch_assoc();
        $total = $totalRow ? $totalRow['total'] : 0;
        
        echo json_encode([
            'success' => true,
            'data' => $auditTrail,
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset
        ]);
        
    } catch (Exception $e) {
        error_log("Error fetching audit trail: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to fetch audit trail: ' . $e->getMessage()
        ]);
    }
    exit;
}

$connection->close();
?>

