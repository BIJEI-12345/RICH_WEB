<?php
// Returns the id_image (LONGBLOB) as data URL for a given table and id
// Usage: php/getIdImage.php?table=barangay_id|certification|coe|clearance|indigency&id=123

require_once 'config.php';

header('Content-Type: application/json');

function safeImageData($imageData) {
    if (!$imageData) {
        return null;
    }
    
    // Check if it's already a data URL
    if (strpos($imageData, 'data:image') === 0) {
        return $imageData;
    }
    
    $dataLength = strlen($imageData);
    
    // Check if it's a file path (short strings are likely file paths, not binary)
    if ($dataLength < 500) {
        // Get the base directory (parent of php directory)
        $baseDir = dirname(__DIR__);
        
        // Try to treat it as a file path - check various possible locations
        $possiblePaths = [
            $baseDir . '/' . $imageData,
            $baseDir . '/Images/' . $imageData,
            $baseDir . '/Pictures/' . $imageData,
            $baseDir . '/Images/' . $imageData . '.jpg',
            $baseDir . '/Images/' . $imageData . '.jpeg',
            $baseDir . '/Images/' . $imageData . '.png',
            $imageData . '.jpg',
            $imageData . '.jpeg',
            $imageData . '.png'
        ];
        
        foreach ($possiblePaths as $path) {
            if (file_exists($path) && is_file($path)) {
                // Read the file and convert to base64
                $fileData = file_get_contents($path);
                if ($fileData !== false && strlen($fileData) > 0) {
                    // Detect MIME type
                    if (function_exists('finfo_open')) {
                        $finfo = finfo_open(FILEINFO_MIME_TYPE);
                        $mimeType = finfo_file($finfo, $path);
                        finfo_close($finfo);
                    } else {
                        // Fallback: guess from extension
                        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
                        $mimeType = ($ext === 'png') ? 'image/png' : (($ext === 'gif') ? 'image/gif' : 'image/jpeg');
                    }
                    
                    if (strpos($mimeType, 'image/') === 0) {
                        return 'data:' . $mimeType . ';base64,' . base64_encode($fileData);
                    }
                }
            }
        }
        
        // If it looks like a path but file doesn't exist, return null
        return null;
    }
    
    // Check if image is too large (> 500KB) - return placeholder instead
    if ($dataLength > 500000) {
        return 'image_too_large';
    }
    
    // If it's binary data (long string), detect MIME type and convert to data URL
    if ($dataLength > 100) {
        try {
            // Detect MIME type from binary signature (magic bytes)
            $mimeType = 'image/jpeg'; // default
            if ($dataLength >= 4) {
                $header = substr($imageData, 0, 4);
                // Check for PNG signature: 89 50 4E 47
                if ($header[0] === "\x89" && $header[1] === "\x50" && $header[2] === "\x4E" && $header[3] === "\x47") {
                    $mimeType = 'image/png';
                }
                // Check for GIF signature: GIF8
                elseif (substr($imageData, 0, 4) === "GIF8") {
                    $mimeType = 'image/gif';
                }
                // Check for JPEG signature: FF D8 FF
                elseif (substr($imageData, 0, 3) === "\xFF\xD8\xFF") {
                    $mimeType = 'image/jpeg';
                }
            }
            
            return 'data:' . $mimeType . ';base64,' . base64_encode($imageData);
        } catch (Exception $e) {
            error_log("Error encoding image data: " . $e->getMessage());
            return 'image_encoding_error';
        }
    }
    
    return $imageData;
}

try {
    $table = $_GET['table'] ?? '';
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    if (!$table || !$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing table or id']);
        exit;
    }

    $allowed = [
        'barangay_id' => 'barangay_id_forms',
        'certification' => 'certification_forms',
        'coe' => 'coe_forms',
        'clearance' => 'clearance_forms',
        'indigency' => 'indigency_forms'
    ];

    if (!isset($allowed[$table])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid table']);
        exit;
    }

    $actualTable = $allowed[$table];

    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
        throw new Exception('Connection failed: ' . $conn->connect_error);
    }
    $conn->set_charset('utf8mb4');

    // Forms store the uploaded ID image in `id_image` column (LONGBLOB)
    // Need to fetch as binary data
    $sql = "SELECT id_image FROM $actualTable WHERE id = ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('Failed to prepare statement: ' . $conn->error);
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    
    // For LONGBLOB, we need to bind result to handle binary data properly
    $stmt->store_result();
    $stmt->bind_result($imageBlob);
    $stmt->fetch();
    
    if (!$imageBlob) {
        echo json_encode(['success' => true, 'imageData' => null, 'hasImage' => false]);
        exit;
    }

    // Process the LONGBLOB binary data
    $imageData = safeImageData($imageBlob);
    
    $stmt->close();
    $conn->close();
    
    echo json_encode(['success' => true, 'imageData' => $imageData, 'hasImage' => ($imageData !== null)]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage(), 'imageData' => null]);
}
?>


