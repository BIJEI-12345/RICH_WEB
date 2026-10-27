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
    $connection = getPostgreSQLDatabaseConnection();
    
    // Get resident photo data
    $sql = "SELECT encode(res_picture, 'base64') FROM barangay_id_forms WHERE id = ?";
    $stmt = $connection->prepare($sql);
    $stmt->execute([$requestId]);
    
    $encodedImage = $stmt->fetchColumn();
    if ($encodedImage !== false) {
        $imageData = safeImageData($encodedImage === null ? null : base64_decode($encodedImage, true));
        
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
    
    $connection = null;
    
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
