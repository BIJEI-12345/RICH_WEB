<?php
require_once __DIR__ . '/init_session.php';
// Disable error reporting to prevent HTML output
error_reporting(0);
ini_set('display_errors', 0);

// Database configuration - Use config.php
require_once __DIR__ . '/config.php';

// ===========================================
// ADMIN SESSION ESTABLISHMENT SECTION
// ===========================================

// Check if this is a request to establish admin session
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['action']) && $input['action'] === 'establish_session') {
        rich_session_start();
        
        header('Content-Type: application/json');
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { 
            http_response_code(204); 
            exit; 
        }
        
        $email = $input['email'] ?? '';
        
        if (empty($email)) {
            echo json_encode(['success' => false, 'message' => 'Email is required']);
            exit;
        }
        
        try {
            $connection = getDatabaseConnection();
            
            $emailEsc = $connection->real_escape_string($email);
            $sql = "SELECT email, name, position FROM brgy_users WHERE email='{$emailEsc}' AND action='accepted'";
            $res = $connection->query($sql);
            
            if ($res && $row = $res->fetch_assoc()) {
                // Allow all valid positions to establish session
                $validPositions = ['Admin', 'Document Request Category', 'Concerns & Reporting', 'Emergency Category', 'Mother Leader'];
                if (in_array($row['position'], $validPositions)) {
                    // Establish session for user
                    $_SESSION['user_id'] = $row['email'];
                    $_SESSION['user_name'] = $row['name'];
                    $_SESSION['position'] = $row['position'];
                    $_SESSION['logged_in'] = true;
                    $_SESSION['last_activity'] = time(); // Track last activity
                    
                    echo json_encode([
                        'success' => true, 
                        'message' => 'User session established',
                        'name' => $row['name'],
                        'position' => $row['position']
                    ]);
                } else {
                    echo json_encode(['success' => false, 'message' => 'User position not authorized']);
                }
            } else {
                echo json_encode(['success' => false, 'message' => 'User not found']);
            }
            
            $connection->close();
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => 'Database error']);
        }
        exit;
    }
}

// ===========================================
// ADMIN DATA SECTION
// ===========================================

// Check if this is a request for admin data
if (isset($_GET['action']) && $_GET['action'] === 'get_admin_data') {
    // Start session first before any output
    rich_session_start();
    
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { 
        http_response_code(204); 
        exit; 
    }
    
    try {
        $connection = getDatabaseConnection();
    } catch (Exception $e) {
        error_log("Database connection error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["error" => "Database connection failed."]); 
        exit;
    }
    
    // Start session first
    rich_session_start();
    
    // Get email from query parameter or from active PHP session
    $email = $_GET['email'] ?? '';
    
    // Check session for user_id - prioritize session over GET parameter
    if (empty($email) && isset($_SESSION['user_id']) && !empty($_SESSION['user_id'])) {
        $email = $_SESSION['user_id'];
    }
    
    // If no email found, user is not logged in
    if (empty($email)) {
        http_response_code(401);
        echo json_encode(["ok" => false, "error" => "User not logged in or session expired"]);
        $connection->close();
        exit;
    }
    
    // Check session expiration based on last activity
    $sessionTimeout = 3600; // 1 hour in seconds
    $sessionValid = false;
    
    if (isset($_SESSION['logged_in']) && $_SESSION['logged_in']) {
        // Check if last_activity is set and within timeout
        if (isset($_SESSION['last_activity'])) {
            $timeSinceLastActivity = time() - $_SESSION['last_activity'];
            if ($timeSinceLastActivity < $sessionTimeout) {
                $sessionValid = true;
                $_SESSION['last_activity'] = time(); // Update last activity on each request
            } else {
                // Session expired due to inactivity
                $_SESSION['logged_in'] = false;
                session_destroy();
            }
        } else {
            // No last_activity set, but session exists - set it now and allow
            $_SESSION['last_activity'] = time();
            $sessionValid = true;
        }
    }
    
    // Verify session is valid - be very lenient
    // If we have email from session, consider it valid
    // Only reject if we have absolutely no session data
    if (!$sessionValid) {
        // If we have user_id in session that matches email, still allow
        if (isset($_SESSION['user_id']) && $_SESSION['user_id'] === $email) {
            // Session might be valid, set last_activity and continue
            $_SESSION['last_activity'] = time();
            $sessionValid = true;
        } else {
            // No matching user_id, but we have email - still allow (might be from GET param)
            // Only reject if we have no session data at all
            if (!isset($_SESSION['user_id']) && empty($_GET['email'])) {
                http_response_code(401);
                echo json_encode(["ok" => false, "error" => "Session expired"]);
                $connection->close();
                exit;
            }
        }
    }
    
    $emailEsc = $connection->real_escape_string($email);
    $sql = "SELECT name, position, edit_profile FROM brgy_users WHERE email='{$emailEsc}' AND action='accepted'";
    $res = $connection->query($sql);
    
    // Debug the query result
    error_log("SQL Query: " . $sql);
    error_log("Query result: " . ($res ? 'success' : 'failed'));
    if ($res) {
        error_log("Number of rows: " . $res->num_rows);
    }
    
    if ($res && $row = $res->fetch_assoc()) {
        $name = $row['name'];
        $position = $row['position'];
        $editProfile = $row['edit_profile'];
        
        // Split name into firstname and lastname
        $nameParts = explode(' ', trim($name), 2);
        $firstname = $nameParts[0] ?? '';
        $lastname = $nameParts[1] ?? '';
        
        // Generate initials
        $initials = '';
        if (!empty($firstname)) {
            $initials .= strtoupper(substr($firstname, 0, 1));
        }
        if (!empty($lastname)) {
            $initials .= strtoupper(substr($lastname, 0, 1));
        }
        
        // Check if user has uploaded profile image
        // Check if edit_profile is not null and not empty string
        $hasProfileImage = ($editProfile !== null && $editProfile !== '' && strlen($editProfile) > 0);
        $profileImageData = null;
        
        // Debug logging
        error_log("Edit profile data length: " . strlen($editProfile));
        error_log("Edit profile is null: " . ($editProfile === null ? 'true' : 'false'));
        error_log("Edit profile is empty string: " . ($editProfile === '' ? 'true' : 'false'));
        error_log("Has profile image: " . ($hasProfileImage ? 'true' : 'false'));
        
        if ($hasProfileImage) {
            // Convert binary data to base64 for JSON response
            $profileImageData = 'data:image/jpeg;base64,' . base64_encode($editProfile);
            error_log("Profile image data length: " . strlen($profileImageData));
        }
        
        echo json_encode([
            "ok" => true, 
            "firstname" => $firstname,
            "lastname" => $lastname,
            "fullname" => $name,
            "position" => $position,
            "initials" => $initials,
            "hasProfileImage" => $hasProfileImage,
            "profileImage" => $profileImageData
        ]);
    } else {
        http_response_code(404);
        echo json_encode(["error" => "Admin user not found"]);
    }
    
    $connection->close();
    exit;
}

// Check if this is a request to update admin profile
if (isset($_GET['action']) && $_GET['action'] === 'update_admin_profile') {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { 
        http_response_code(204); 
        exit; 
    }
    
    try {
        $pdo = getPDODatabaseConnection();
    } catch(Exception $e) {
        error_log("Database connection error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["error" => "Database connection failed."]); 
        exit;
    }
    
    // Get email from query parameter
    $email = $_GET['email'] ?? '';
    
    if (empty($email)) {
        http_response_code(400);
        echo json_encode(["error" => "Email parameter is required"]);
        exit;
    }
    
    // Handle profile image upload
    if (isset($_FILES['profileImage']) && $_FILES['profileImage']['error'] === UPLOAD_ERR_OK) {
        $imageData = file_get_contents($_FILES['profileImage']['tmp_name']);
        
        // Debug logging
        error_log("Uploaded image size: " . strlen($imageData));
        error_log("Email: " . $email);
        
        // Update profile image in database using PDO
        $stmt = $pdo->prepare("UPDATE brgy_users SET edit_profile = ? WHERE email = ? AND action='accepted'");
        
        if ($stmt->execute([$imageData, $email])) {
            error_log("Profile image updated successfully");
            
            // Verify the image was saved by querying it back
            $verifyStmt = $pdo->prepare("SELECT LENGTH(edit_profile) as image_size FROM brgy_users WHERE email = ? AND action='accepted'");
            $verifyStmt->execute([$email]);
            $verifyRow = $verifyStmt->fetch(PDO::FETCH_ASSOC);
            if ($verifyRow) {
                error_log("Image size in database: " . $verifyRow['image_size']);
            }
            
            echo json_encode([
                "ok" => true,
                "message" => "Profile image updated successfully"
            ]);
        } else {
            error_log("Failed to update profile image");
            echo json_encode([
                "ok" => false,
                "error" => "Failed to update profile image"
            ]);
        }
    } else {
        echo json_encode([
            "ok" => false,
            "error" => "No image file provided"
        ]);
    }
    exit;
}

// ===========================================
// ANNOUNCEMENTS SECTION
// ===========================================

// Set headers for JSON responses
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

try {
    $pdo = getPDODatabaseConnection();
} catch(Exception $e) {
    error_log("Database connection error: " . $e->getMessage());
    echo json_encode(['ok' => false, 'error' => 'Database connection failed']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

switch($method) {
    case 'POST':
        // Create new announcement or update existing one
        $id = $_GET['id'] ?? null;
        $isUpdate = !empty($id);
        
        $title = trim($_POST['title'] ?? '');
        $description = trim($_POST['description'] ?? '');
        $datetime = trim($_POST['datetime'] ?? '');
        $image_path = '';
        
        // Handle image upload if provided (paths relative to this script, not CWD)
        if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $upload_dir = __DIR__ . '/../uploads/announcements/';
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, 0755, true);
            }
            
            $file_extension = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
            $filename = 'announcement_' . time() . '_' . uniqid() . '.' . $file_extension;
            $file_path = $upload_dir . $filename;
            
            if (move_uploaded_file($_FILES['image']['tmp_name'], $file_path)) {
                $image_path = 'uploads/announcements/' . $filename;
            }
        }
        
        try {
            if ($isUpdate) {
                // Update existing announcement
                if ($image_path) {
                    $stmt = $pdo->prepare("UPDATE announcements SET title = ?, date_and_time = ?, description = ?, image = ? WHERE id = ?");
                    $stmt->execute([$title, $datetime, $description, $image_path, $id]);
                } else {
                    $stmt = $pdo->prepare("UPDATE announcements SET title = ?, date_and_time = ?, description = ? WHERE id = ?");
                    $stmt->execute([$title, $datetime, $description, $id]);
                }
                
                echo json_encode([
                    'ok' => true, 
                    'message' => 'Announcement updated successfully'
                ]);
            } else {
                // Create new announcement
                $stmt = $pdo->prepare("INSERT INTO announcements (title, date_and_time, description, image) VALUES (?, ?, ?, ?)");
                $stmt->execute([$title, $datetime, $description, $image_path]);
                
                echo json_encode([
                    'ok' => true, 
                    'message' => 'Announcement created successfully',
                    'id' => $pdo->lastInsertId()
                ]);
            }
        } catch(PDOException $e) {
            $action = $isUpdate ? 'update' : 'create';
            echo json_encode(['ok' => false, 'error' => "Failed to {$action} announcement"]);
        }
        break;
        
        
    case 'GET':
        // Get all announcements ordered by date_and_time (earliest first)
        try {
            $stmt = $pdo->prepare("SELECT * FROM announcements ORDER BY date_and_time ASC");
            $stmt->execute();
            $announcements = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Validate image paths - remove invalid/missing images
            foreach ($announcements as &$announcement) {
                if (!empty($announcement['image'])) {
                    // Check if image file exists (same base path as upload)
                    $imagePath = __DIR__ . '/../' . str_replace(['\\', '//'], '/', $announcement['image']);
                    if (!file_exists($imagePath) || !is_file($imagePath)) {
                        // Image doesn't exist, set to empty
                        $announcement['image'] = '';
                    }
                }
            }
            unset($announcement); // Unset reference
            
            echo json_encode([
                'ok' => true,
                'announcements' => $announcements
            ]);
        } catch(PDOException $e) {
            echo json_encode(['ok' => false, 'error' => 'Failed to fetch announcements']);
        }
        break;
        
    case 'DELETE':
        // Delete announcement
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $input['id'] ?? null;
        
        if (!$id) {
            echo json_encode(['ok' => false, 'error' => 'Announcement ID is required']);
            exit;
        }
        
        try {
            $stmt = $pdo->prepare("DELETE FROM announcements WHERE id = ?");
            $stmt->execute([$id]);
            
            echo json_encode([
                'ok' => true, 
                'message' => 'Announcement deleted successfully'
            ]);
        } catch(PDOException $e) {
            echo json_encode(['ok' => false, 'error' => 'Failed to delete announcement']);
        }
        break;
        
    default:
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        break;
}
// ===========================================
// END ANNOUNCEMENTS SECTION
// ===========================================
?>