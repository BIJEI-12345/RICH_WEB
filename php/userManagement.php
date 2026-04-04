<?php
require_once __DIR__ . '/init_session.php';
rich_session_start();

// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
header('Last-Modified: ' . gmdate('D, d M Y H:i:s') . ' GMT');
header('Cache-Control: post-check=0, pre-check=0', false);

// Database configuration
// Use config.php for database connection
require_once __DIR__ . '/config.php';

try {
    $connection = getDatabaseConnection();
} catch (Exception $e) {
    error_log("Database connection error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed."]); 
    exit;
}

// Include audit trail helper
require_once __DIR__ . '/audit_trail_helper.php';

// ✅ User action handler (accept, deactivate, activate, deny)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $input = json_decode(file_get_contents("php://input"), true);
  $userId = intval($input['id'] ?? 0);
  $action = $input['action'] ?? '';

  if ($userId > 0 && in_array($action, ['approve', 'deactivate', 'activate', 'reject'])) {
    // Get user information before making changes
    $userStmt = $connection->prepare("SELECT id, email, name, position, action FROM brgy_users WHERE id = ?");
    $userStmt->bind_param("i", $userId);
    $userStmt->execute();
    $userResult = $userStmt->get_result();
    $userData = $userResult->fetch_assoc();
    $userStmt->close();
    
    if (!$userData) {
        echo json_encode(["success" => false, "message" => "User not found."]);
        exit;
    }
    
    // Get current user (admin) information
    $changedByUserId = isset($_SESSION['user_id']) ? $_SESSION['user_id'] : null;
    $changedByName = isset($_SESSION['user_name']) ? $_SESSION['user_name'] : 'System';
    $changedByEmail = isset($_SESSION['user_id']) ? $_SESSION['user_id'] : null;
    
    $newAction = '';
    $message = '';
    $auditActionType = '';
    
    switch($action) {
      case 'approve':
        $newAction = 'accepted';
        $message = 'User accepted successfully.';
        $auditActionType = 'approved';
        break;
      case 'deactivate':
        $newAction = 'deactivated';
        $message = 'User deactivated successfully.';
        $auditActionType = 'deactivated';
        break;
      case 'activate':
        $newAction = 'accepted';
        $message = 'User activated successfully.';
        $auditActionType = 'activated';
        break;
      case 'reject':
        // Log audit trail before deletion
        logCategoryAuditTrail(
            $userData['id'],
            $userData['email'],
            $userData['name'],
            'rejected',
            $userData['position'],
            null,
            $changedByUserId,
            $changedByEmail,
            $changedByName,
            'User account rejected and deleted'
        );
        
        // Delete the user account
        $stmt = $connection->prepare("DELETE FROM brgy_users WHERE id = ?");
        $stmt->bind_param("i", $userId);
        
        if ($stmt->execute()) {
          echo json_encode([
            "success" => true, 
            "message" => "User account deleted successfully.",
            "updatedAction" => 'deleted'
          ]);
        } else {
          echo json_encode(["success" => false, "message" => "Failed to delete user account."]);
        }
        $stmt->close();
        exit;
    }
    
    // Update user action for accept, deactivate, activate
    if ($newAction) {
      $oldAction = $userData['action'] ?? 'pending';
      
      $stmt = $connection->prepare("UPDATE brgy_users SET action = ? WHERE id = ?");
      $stmt->bind_param("si", $newAction, $userId);
      
      if ($stmt->execute()) {
        // Log audit trail
        logCategoryAuditTrail(
            $userData['id'],
            $userData['email'],
            $userData['name'],
            $auditActionType,
            $userData['position'],
            null,
            $changedByUserId,
            $changedByEmail,
            $changedByName,
            "User status changed from '{$oldAction}' to '{$newAction}'"
        );
        
        echo json_encode([
          "success" => true, 
          "message" => $message,
          "updatedAction" => $newAction
        ]);
      } else {
        echo json_encode(["success" => false, "message" => "Failed to update user."]);
      }
      $stmt->close();
    }
    exit;
  } else {
    echo json_encode(["success" => false, "message" => "Invalid request."]);
    exit;
  }
}

// ✅ Get users based on type parameter
$userType = $_GET['type'] ?? 'pending';
$users = [];

// Build SQL query based on user type
switch($userType) {
    case 'pending':
        // Users with verified email and pending action (pending approval)
        $sql = "SELECT id, email, name, age, position, gender, address, action, verified_email 
                FROM brgy_users 
                WHERE verified_email = 1 AND (action = 'pending' OR action IS NULL OR action = '' OR action = 'denied')
                ORDER BY id DESC";
        break;
    case 'active':
        // Users with accepted action
        $sql = "SELECT id, email, name, age, position, gender, address, action, verified_email 
                FROM brgy_users 
                WHERE action = 'accepted'
                ORDER BY id DESC";
        break;
    case 'deactivated':
        // Users with deactivated action only
        // Note: 'denied' users appear in pending tab, not here
        $sql = "SELECT id, email, name, age, position, gender, address, action, verified_email 
                FROM brgy_users 
                WHERE action = 'deactivated'
                ORDER BY id DESC";
        break;
    default:
        // Default to pending users
        // Note: 'denied' is treated as pending for legacy data compatibility
        $sql = "SELECT id, email, name, age, position, gender, address, action, verified_email 
                FROM brgy_users 
                WHERE verified_email = 1 AND (action = 'pending' OR action IS NULL OR action = '' OR action = 'denied')
                ORDER BY id DESC";
}

$result = $connection->query($sql);

if ($result !== false) {
  while ($row = $result->fetch_assoc()) {
    // Derive first/last name from name field
    $full = trim($row['name'] ?? '');
    $firstName = '';
    $lastName = '';
    if ($full !== '') {
      $parts = preg_split('/\s+/', $full, 2);
      $firstName = $parts[0] ?? '';
      $lastName = $parts[1] ?? '';
    }

    $users[] = [
      "id"        => $row['id'],
      "firstName" => $firstName,
      "lastName"  => $lastName,
      "email"     => $row['email'],
      "age"       => $row['age'],
      "position"  => $row['position'],
      "gender"    => $row['gender'],
      "address"   => $row['address'],
      "action"    => $row['action'], // 'accepted', 'denied', or NULL
      "verified_email" => $row['verified_email'], // 1 = verified, 0 = not verified
      "approved"  => $row['action'] === 'accepted' ? 1 : 0 // For frontend compatibility
    ];
  }
}

 
$connection->close();
echo json_encode(["users" => $users]);
exit;
?>