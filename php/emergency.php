<?php
header('Content-Type: application/json');

// Start session for permission checks
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Simple permission helper mirrored with frontend rules
function canEdit($module) {
    $position = isset($_SESSION['position']) ? strtolower($_SESSION['position']) : '';
    if ($position === 'admin') return true;
    if ($module === 'reqDocu') {
        return $position === 'document request category';
    }
    if ($module === 'concerns' || $module === 'emergency') {
        return ($position === 'concerns & reporting' || $position === 'emergency' || $position === 'emergency category');
    }
    return false;
}

// Database configuration
$host = "rich.cmxcoo6yc8nh.us-east-1.rds.amazonaws.com";
$port = 3306; // Default MySQL port for RDS
$user = "admin";
$pass = "4mazonb33j4y!";
$db   = "rich_db";

try {
    // Create connection
    $conn = new mysqli($host, $user, $pass, $db, $port);
    
    // Check connection
    if ($conn->connect_error) {
        throw new Exception("Connection failed: " . $conn->connect_error);
    }
    
    // Check if this is an image request
    if (isset($_GET['image']) && $_GET['image'] === 'true') {
        // Serve emergency image
        $emergencyId = $_GET['id'] ?? null;
        
        if (!$emergencyId) {
            http_response_code(400);
            echo "Missing emergency ID";
            exit;
        }
        
        // Get the image data from database
        $sql = "SELECT emergency_image FROM emergency_reports WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $emergencyId);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        
        if (!$result || !$result['emergency_image']) {
            http_response_code(404);
            echo "Image not found";
            exit;
        }
        
        $imageData = $result['emergency_image'];
        
        // Check if it's a file path or binary data
        if (strpos($imageData, 'Images/') === 0 || strpos($imageData, 'Pictures/') === 0) {
            // It's a file path, serve the file directly
            $filePath = str_replace('Pictures/', 'Images/', $imageData);
            if (file_exists($filePath)) {
                $mimeType = mime_content_type($filePath);
                header('Content-Type: ' . $mimeType);
                header('Content-Length: ' . filesize($filePath));
                readfile($filePath);
            } else {
                http_response_code(404);
                echo "File not found";
            }
        } else if (strlen($imageData) > 100) {
            // It's binary data, serve it directly
            header('Content-Type: image/jpeg');
            header('Content-Length: ' . strlen($imageData));
            echo $imageData;
        } else {
            http_response_code(404);
            echo "Invalid image data";
        }
        exit;
    }
    
    // Check if this is a resolve request
    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
        // Check user permissions before allowing emergency resolution
        
        
        // Check if this is an admin user accessing via email-based auth
        $adminEmail = $_GET['admin_email'] ?? $_SERVER['HTTP_X_ADMIN_EMAIL'] ?? null;
        $isAdmin = false;
        
        if ($adminEmail) {
            // Verify this email has admin position in database
            try {
                $emailEsc = $conn->real_escape_string($adminEmail);
                $sql = "SELECT position FROM brgy_users WHERE email='{$emailEsc}' AND action='accepted'";
                $res = $conn->query($sql);
                
                if ($res && $row = $res->fetch_assoc()) {
                    if ($row['position'] === 'Admin') {
                        $isAdmin = true;
                    }
                }
            } catch (Exception $e) {
                // Database error, continue with normal flow
            }
        }
        
        if (!$isAdmin && !canEdit('emergency')) {
            echo json_encode(['success' => false, 'message' => 'You do not have permission to modify emergency reports']);
            exit;
        }
        
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (isset($input['action']) && $input['action'] === 'resolve') {
            // Handle resolve emergency request
            if (!isset($input['emergencyType']) || !isset($input['reporterName']) || !isset($input['location']) || !isset($input['dateTime'])) {
                throw new Exception("Missing required fields");
            }
            
            $emergencyType = $input['emergencyType'];
            $reporterName = $input['reporterName'];
            $location = $input['location'];
            $dateTime = $input['dateTime'];
            
            // Get current timestamp in Philippine time
            date_default_timezone_set('Asia/Manila');
            $resolvedDateTime = date('Y-m-d H:i:s');
            
            // Use the dates as they are (already in Philippine time)
            $utcDateTime = $dateTime;
            $utcResolvedDateTime = $resolvedDateTime;
            
            // Update the emergency report status and resolved_datetime
            $sql = "UPDATE emergency_reports 
                    SET status = 'RESOLVED', resolved_datetime = ? 
                    WHERE emergency_type = ? AND reporter_name = ? AND location = ? AND date_and_time = ?";
            
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("sssss", $utcResolvedDateTime, $emergencyType, $reporterName, $location, $utcDateTime);
            
            if ($stmt->execute()) {
                if ($stmt->affected_rows > 0) {
                    echo json_encode([
                        'success' => true, 
                        'message' => 'Emergency resolved successfully',
                        'resolvedDateTime' => $resolvedDateTime
                    ]);
                } else {
                    echo json_encode([
                        'success' => false, 
                        'message' => 'No emergency report found to update'
                    ]);
                }
            } else {
                throw new Exception("Failed to update emergency report: " . $stmt->error);
            }
            
            $stmt->close();
            $conn->close();
            exit;
        }
    }
    
    // Default: Fetch data from emergency_reports table
    // Use dates as they are stored (already in Philippine time)
    // Sort by resolved_datetime DESC for resolved emergencies, then by date_and_time DESC for others
    $sql = "SELECT id, emergency_type, location, reporter_name, 
            date_and_time, 
            description, status, 
            resolved_datetime, emergency_image, landmark
            FROM emergency_reports 
            ORDER BY 
                CASE WHEN status = 'RESOLVED' THEN resolved_datetime ELSE date_and_time END DESC";
    $result = $conn->query($sql);
    
    $reports = [];
    
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            // Handle emergency_image - could be binary data or file path
            $emergencyImage = null;
            if (!empty($row['emergency_image'])) {
                if (strlen($row['emergency_image']) > 100) {
                    // Binary data - return URL to fetch it
                    $emergencyImage = 'php/emergency.php?image=true&id=' . $row['id'];
                } else if (strpos($row['emergency_image'], 'Images/') === 0 || strpos($row['emergency_image'], 'Pictures/') === 0) {
                    // File path
                    $emergencyImage = str_replace('Pictures/', 'Images/', $row['emergency_image']);
                }
            }
            
            // Map database field names to interface field names
            $reports[] = [
                'emergencyType' => $row['emergency_type'],
                'reporterName' => $row['reporter_name'],
                'location' => $row['location'],
                'dateTime' => $row['date_and_time'],
                'description' => $row['description'],
                'status' => strtolower($row['status']), // Convert NEW/RESOLVED to new/resolved
                'resolvedDateTime' => $row['resolved_datetime'],
                'emergencyImage' => $emergencyImage,
                'landmark' => $row['landmark']
            ];
        }
    }
    
    $conn->close();
    
    echo json_encode(['reports' => $reports]);
    
} catch (Exception $e) {
    // Return empty array if database connection fails
    echo json_encode(['reports' => []]);
}
?>