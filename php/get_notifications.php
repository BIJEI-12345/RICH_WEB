<?php
// Disable error reporting to prevent HTML output
error_reporting(0);
ini_set('display_errors', 0);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

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

try {
    // Check if user is logged in and is an admin
    if (!isset($_SESSION['logged_in']) || !$_SESSION['logged_in'] || !isset($_SESSION['position']) || $_SESSION['position'] !== 'Admin') {
        echo json_encode([
            'success' => true,
            'notifications' => [],
            'count' => 0
        ]);
        exit;
    }

    // Get pending user requests (action = 'pending' means pending approval)
    $sql = "SELECT id, name, email, position, created_at, verified_email 
            FROM brgy_users 
            WHERE verified_email = 1 AND (action = 'pending' OR action IS NULL OR action = '')
            ORDER BY created_at DESC 
            LIMIT 10";
    
    $result = $connection->query($sql);
    
    $notifications = [];
    $count = 0;
    
    if ($result !== false) {
        while ($row = $result->fetch_assoc()) {
            $count++;
            
            // Calculate time ago
            $createdAt = new DateTime($row['created_at']);
            $now = new DateTime();
            $interval = $now->diff($createdAt);
            
            $timeAgo = '';
            if ($interval->days > 0) {
                $timeAgo = $interval->days . ' day' . ($interval->days > 1 ? 's' : '') . ' ago';
            } elseif ($interval->h > 0) {
                $timeAgo = $interval->h . ' hour' . ($interval->h > 1 ? 's' : '') . ' ago';
            } elseif ($interval->i > 0) {
                $timeAgo = $interval->i . ' minute' . ($interval->i > 1 ? 's' : '') . ' ago';
            } else {
                $timeAgo = 'Just now';
            }
            
            $notifications[] = [
                'id' => $row['id'],
                'title' => 'New Pending User for <strong>' . htmlspecialchars($row['position']) . '</strong>',
                'time' => $timeAgo,
                'user_name' => htmlspecialchars($row['name']),
                'user_email' => htmlspecialchars($row['email']),
                'position' => htmlspecialchars($row['position']),
                'verified_email' => $row['verified_email']
            ];
        }
    }
    
    echo json_encode([
        'success' => true,
        'notifications' => $notifications,
        'count' => $count
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch notifications: ' . $e->getMessage()
    ]);
} finally {
    $connection->close();
}
?>
