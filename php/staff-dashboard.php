<?php
require_once __DIR__ . '/init_session.php';
// Staff Dashboard PHP Backend
// This file handles read-only data retrieval for staff dashboard

rich_session_start();

// Check if user is logged in as staff
if (!isset($_SESSION['user_type']) || $_SESSION['user_type'] !== 'staff') {
    header('Location: index.php');
    exit();
}

// Database connection
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/announcement_image.php';

// Get database connection
try {
    $conn = getDatabaseConnection();
} catch (Exception $e) {
    error_log("Database connection error: " . $e->getMessage());
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Database connection failed']);
    exit();
}

// Function to get document requests (read-only)
function getDocumentRequests() {
    global $conn;
    
    $sql = "SELECT * FROM document_requests ORDER BY created_at DESC LIMIT 10";
    $result = $conn->query($sql);
    
    $requests = [];
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $requests[] = $row;
        }
    }
    
    return $requests;
}

// Function to get feedback and concerns (read-only)
function getFeedbackAndConcerns() {
    global $conn;
    
    $sql = "SELECT * FROM feedback_concerns ORDER BY created_at DESC LIMIT 10";
    $result = $conn->query($sql);
    
    $feedback = [];
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $feedback[] = $row;
        }
    }
    
    return $feedback;
}

// Function to get emergency reports (read-only)
function getEmergencyReports() {
    global $conn;
    
    $sql = "SELECT * FROM emergency_reports ORDER BY created_at DESC LIMIT 10";
    $result = $conn->query($sql);
    
    $reports = [];
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $reports[] = $row;
        }
    }
    
    return $reports;
}

// Function to get user information (read-only)
function getUserInformation() {
    global $conn;
    
    $sql = "SELECT id, username, email, user_type, created_at FROM users ORDER BY created_at DESC LIMIT 10";
    $result = $conn->query($sql);
    
    $users = [];
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $users[] = $row;
        }
    }
    
    return $users;
}

// Function to get announcements (read-only)
function getAnnouncements() {
    global $conn;
    
    try {
        ensureAnnouncementImageBlob(getPDODatabaseConnection());
    } catch (Throwable $e) {
    }
    
    $sql = "SELECT * FROM announcements ORDER BY created_at DESC LIMIT 5";
    $result = $conn->query($sql);
    
    $announcements = [];
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $aid = (int) ($row['id'] ?? 0);
            $row['image'] = normalizeAnnouncementImageForJson($row['image'] ?? '', $aid);
            $announcements[] = $row;
        }
    }
    
    return $announcements;
}

// Function to get notifications for staff
function getStaffNotifications() {
    global $conn;
    
    $sql = "SELECT * FROM notifications WHERE user_type = 'staff' OR user_type = 'all' ORDER BY created_at DESC LIMIT 5";
    $result = $conn->query($sql);
    
    $notifications = [];
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $notifications[] = $row;
        }
    }
    
    return $notifications;
}

// Handle AJAX requests
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    
    switch($action) {
        case 'get_documents':
            echo json_encode(getDocumentRequests());
            break;
            
        case 'get_feedback':
            echo json_encode(getFeedbackAndConcerns());
            break;
            
        case 'get_emergency':
            echo json_encode(getEmergencyReports());
            break;
            
        case 'get_users':
            echo json_encode(getUserInformation());
            break;
            
        case 'get_announcements':
            echo json_encode(getAnnouncements());
            break;
            
        case 'get_notifications':
            echo json_encode(getStaffNotifications());
            break;
            
        default:
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
    exit();
}

// Get dashboard data for initial load
$dashboardData = [
    'documents' => getDocumentRequests(),
    'feedback' => getFeedbackAndConcerns(),
    'emergency' => getEmergencyReports(),
    'users' => getUserInformation(),
    'announcements' => getAnnouncements(),
    'notifications' => getStaffNotifications()
];

// Return JSON data
header('Content-Type: application/json');
echo json_encode($dashboardData);
?>
