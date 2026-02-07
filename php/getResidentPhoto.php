<?php
// Get Resident Photo Script
error_reporting(0);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');

// Include database configuration
require_once 'config.php';

// Function to safely handle image data
function safeImageData($imageData) {
    if (!$imageData) {
        return null;
    }
    
    $dataLength = strlen($imageData);
    
    // Check if image is too large (> 1MB)
    if ($dataLength > 1000000) {
        return 'image_too_large';
    }
    
    // Check if it's already a data URL
    if (strpos($imageData, 'data:image') === 0) {
        return $imageData;
    }
    
    // If it's binary data, convert to data URL
    if ($dataLength > 100) {
        return 'data:image/jpeg;base64,' . base64_encode($imageData);
    }
    
    return $imageData;
}

try {
    // Get request ID from query parameter
    $requestId = $_GET['requestId'] ?? null;
    
    if (!$requestId) {
        throw new Exception('Request ID is required');
    }
    
    // Database connection
    $connection = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    
    if ($connection->connect_error) {
        throw new Exception("Connection failed: " . $connection->connect_error);
    }
    
    $connection->set_charset('utf8mb4');
    
    // Get resident photo data
    $sql = "SELECT res_picture FROM barangay_id_forms WHERE id = ?";
    $stmt = $connection->prepare($sql);
    
    if (!$stmt) {
        throw new Exception("Failed to prepare statement: " . $connection->error);
    }
    
    $stmt->bind_param("i", $requestId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($row = $result->fetch_assoc()) {
        $imageData = safeImageData($row['res_picture']);
        
        echo json_encode([
            'success' => true,
            'imageData' => $imageData,
            'hasImage' => $imageData !== null
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'Request not found',
            'imageData' => null,
            'hasImage' => false
        ]);
    }
    
    $stmt->close();
    $connection->close();
    
} catch (Exception $e) {
    error_log("getResidentPhoto ERROR: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'imageData' => null,
        'hasImage' => false
    ]);
}
?>
