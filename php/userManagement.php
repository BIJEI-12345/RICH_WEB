<?php
session_start();

// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
header('Last-Modified: ' . gmdate('D, d M Y H:i:s') . ' GMT');
header('Cache-Control: post-check=0, pre-check=0', false);

// Database configuration
$host = "rich.cmxcoo6yc8nh.us-east-1.rds.amazonaws.com";
$port = 3306; // Default MySQL port for RDS
$user = "admin";
$pass = "4mazonb33j4y!";
$db   = "rich_db";

$connection = new mysqli($host, $user, $pass, $db, $port);
if ($connection->connect_error) {
  error_log("Database connection error: " . $connection->connect_error);
  http_response_code(500);
  echo json_encode(["error" => "Database connection failed."]); 
  exit;
}

// ✅ User action handler (accept, deactivate, activate, deny)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $input = json_decode(file_get_contents("php://input"), true);
  $userId = intval($input['id'] ?? 0);
  $action = $input['action'] ?? '';

  if ($userId > 0 && in_array($action, ['approve', 'deactivate', 'activate', 'reject'])) {
    $newAction = '';
    $message = '';
    
    switch($action) {
      case 'approve':
        $newAction = 'accepted';
        $message = 'User accepted successfully.';
        break;
      case 'deactivate':
        $newAction = 'deactivated';
        $message = 'User deactivated successfully.';
        break;
      case 'activate':
        $newAction = 'accepted';
        $message = 'User activated successfully.';
        break;
      case 'reject':
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
      $stmt = $connection->prepare("UPDATE brgy_users SET action = ? WHERE id = ?");
      $stmt->bind_param("si", $newAction, $userId);
      
      if ($stmt->execute()) {
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