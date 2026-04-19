<?php
// Barangay ID Document Generation Script
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Start output buffering to catch any unexpected output
ob_start();

// Include database configuration
require_once 'config.php';
require_once __DIR__ . '/generated_document_temp.php';

// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

// Include PhpWord for proper image handling
try {
    require_once __DIR__ . '/../vendor/autoload.php';
    error_log("generateBarangayIdDocument: PhpWord loaded successfully");
} catch (Exception $e) {
    error_log("generateBarangayIdDocument: PhpWord loading failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'PhpWord loading failed: ' . $e->getMessage()]);
    exit;
}

use PhpOffice\PhpWord\TemplateProcessor;

// Set headers early
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') { 
    http_response_code(204); 
    exit; 
}

// Debug: Log that script started
error_log("generateBarangayIdDocument: Script started");

// Function to create temporary image file from database LONGBLOB data and resize to 1x1 square
function createTempImageFile($imageData) {
    try {
        // Create temporary file
        $tempFile = tempnam(sys_get_temp_dir(), 'resident_photo_');
        
        // Determine file extension based on image data
        $extension = 'jpg'; // Default to jpg
        
        // Check if it's a data URL (base64 encoded)
        if (strpos($imageData, 'data:image') === 0) {
            // Extract base64 data
            $base64Data = substr($imageData, strpos($imageData, ',') + 1);
            $imageData = base64_decode($base64Data);
            
            // Try to determine extension from data URL
            if (strpos($imageData, 'data:image/png') === 0) {
                $extension = 'png';
            } elseif (strpos($imageData, 'data:image/gif') === 0) {
                $extension = 'gif';
            }
        }
        
        // For LONGBLOB data, try to detect image type from binary data
        if (strlen($imageData) > 4) {
            // Check for PNG signature
            if (substr($imageData, 0, 8) === "\x89PNG\r\n\x1a\n") {
                $extension = 'png';
            }
            // Check for GIF signature
            elseif (substr($imageData, 0, 6) === "GIF87a" || substr($imageData, 0, 6) === "GIF89a") {
                $extension = 'gif';
            }
            // Check for JPEG signature
            elseif (substr($imageData, 0, 2) === "\xFF\xD8") {
                $extension = 'jpg';
            }
        }
        
        // Write original image data to temporary file first
        $originalFile = $tempFile . '_original.' . $extension;
        if (file_put_contents($originalFile, $imageData) === false) {
            error_log("createTempImageFile: Failed to write original image data to: " . $originalFile);
            unlink($tempFile);
            return false;
        }
        
        // Create a 1x1 (square) resized version that fills the container
        $squareFile = $tempFile . '.' . $extension;
        
        // Check if GD extension is available
        if (!extension_loaded('gd')) {
            error_log("createTempImageFile: GD extension not loaded, using original image");
            // If GD is not available, just copy the original file
            if (copy($originalFile, $squareFile)) {
                unlink($originalFile);
                unlink($tempFile);
                return $squareFile;
            } else {
                error_log("createTempImageFile: Failed to copy original file");
                unlink($originalFile);
                unlink($tempFile);
                return false;
            }
        }
        
        // Use GD to resize image to square (1x1 aspect ratio)
        $sourceImage = null;
        switch ($extension) {
            case 'png':
                $sourceImage = imagecreatefrompng($originalFile);
                break;
            case 'gif':
                $sourceImage = imagecreatefromgif($originalFile);
                break;
            case 'jpg':
            default:
                $sourceImage = imagecreatefromjpeg($originalFile);
                break;
        }
        
        if ($sourceImage === false) {
            error_log("createTempImageFile: Failed to create image resource from: " . $originalFile);
            // Fallback: use original image
            if (copy($originalFile, $squareFile)) {
                unlink($originalFile);
                unlink($tempFile);
                return $squareFile;
            } else {
                unlink($originalFile);
                unlink($tempFile);
                return false;
            }
        }
        
        try {
            // Get original dimensions
            $originalWidth = imagesx($sourceImage);
            $originalHeight = imagesy($sourceImage);
            
            // Calculate square dimensions (use the larger dimension to ensure it fills the container)
            $squareSize = max($originalWidth, $originalHeight);
            
            // For 2.54cm (1 inch) container, we want a larger square to ensure it fills completely
            // Use 300px minimum to ensure no gaps in the container
            $squareSize = max($squareSize, 300); // Minimum 300px to ensure it fills the container completely
            
            // Create square image
            $squareImage = imagecreatetruecolor($squareSize, $squareSize);
            if ($squareImage === false) {
                throw new Exception("Failed to create square image");
            }
            
            // Fill with white background
            $white = imagecolorallocate($squareImage, 255, 255, 255);
            if ($white === false) {
                throw new Exception("Failed to allocate white color");
            }
            imagefill($squareImage, 0, 0, $white);
            
            // Instead of centering, crop the image to fill the square completely
            // Calculate crop dimensions to fill the square
            $cropSize = min($originalWidth, $originalHeight);
            $cropX = ($originalWidth - $cropSize) / 2;
            $cropY = ($originalHeight - $cropSize) / 2;
            
            // Copy cropped image to fill the entire square
            $copyResult = imagecopyresampled($squareImage, $sourceImage, 0, 0, $cropX, $cropY, $squareSize, $squareSize, $cropSize, $cropSize);
            if (!$copyResult) {
                throw new Exception("Failed to crop and resize image to square");
            }
            
            // Save resized square image
            $success = false;
            switch ($extension) {
                case 'png':
                    $success = imagepng($squareImage, $squareFile);
                    break;
                case 'gif':
                    $success = imagegif($squareImage, $squareFile);
                    break;
                case 'jpg':
                default:
                    $success = imagejpeg($squareImage, $squareFile, 90);
                    break;
            }
            
            if (!$success) {
                throw new Exception("Failed to save square image to: " . $squareFile);
            }
            
        } catch (Exception $e) {
            error_log("createTempImageFile: GD processing error: " . $e->getMessage());
            // Fallback: use original image
            if (copy($originalFile, $squareFile)) {
                error_log("createTempImageFile: Using original image as fallback");
            } else {
                error_log("createTempImageFile: Fallback also failed");
                unlink($originalFile);
                unlink($tempFile);
                return false;
            }
        } finally {
            // Clean up
            if (isset($sourceImage) && $sourceImage !== false) {
                imagedestroy($sourceImage);
            }
            if (isset($squareImage) && $squareImage !== false) {
                imagedestroy($squareImage);
            }
            unlink($originalFile);
            unlink($tempFile);
        }
        
        // Verify file was created and is readable
        if (!file_exists($squareFile) || !is_readable($squareFile)) {
            error_log("createTempImageFile: Square file not accessible: " . $squareFile);
            return false;
        }
        
        error_log("createTempImageFile: Created 1x1 square image: " . $squareFile . " (size: " . $squareSize . "x" . $squareSize . ")");
        return $squareFile;
        
    } catch (Exception $e) {
        error_log("createTempImageFile error: " . $e->getMessage());
        return false;
    }
}

// Function to safely handle LONGBLOB image data
function safeImageData($imageData) {
    if (!$imageData) {
        return null;
    }
    
    $dataLength = strlen($imageData);
    
    // Check if image is too large (> 1MB)
    if ($dataLength > 1000000) {
        return 'image_too_large';
    }
    
    // Check if it's already a data URL (base64 encoded)
    if (strpos($imageData, 'data:image') === 0) {
        return $imageData;
    }
    
    // For LONGBLOB data, determine image type and convert to data URL
    if ($dataLength > 4) {
        $mimeType = 'image/jpeg'; // Default
        
        // Check for PNG signature
        if (substr($imageData, 0, 8) === "\x89PNG\r\n\x1a\n") {
            $mimeType = 'image/png';
        }
        // Check for GIF signature
        elseif (substr($imageData, 0, 6) === "GIF87a" || substr($imageData, 0, 6) === "GIF89a") {
            $mimeType = 'image/gif';
        }
        // Check for JPEG signature
        elseif (substr($imageData, 0, 2) === "\xFF\xD8") {
            $mimeType = 'image/jpeg';
        }
        
        return $mimeType . ';base64,' . base64_encode($imageData);
    }
    
    return $imageData;
}

// Function to save image data to file with 1x1 aspect ratio and return filename


    // Function to format birth date to readable format
function formatBirthDate($birthDate) {
    if (!$birthDate || $birthDate === '0000-00-00' || $birthDate === '') {
        return 'Not Specified';
    }
    
    try {
        $date = new DateTime($birthDate);
        return $date->format('F j, Y'); // Format: February 29, 2004
    } catch (Exception $e) {
        // If date parsing fails, return original value
        error_log("formatBirthDate error: " . $e->getMessage() . " for value: " . $birthDate);
        return $birthDate ?: 'Not Specified';
    }
}

// Function to populate Word template with data using direct XML replacement
function populateWordTemplate($templatePath, $outputPath, $data) {
    error_log("generateBarangayIdDocument: Starting template population with direct XML replacement...");
    
    try {
        // Copy the original template to output path (preserves formatting)
        if (!copy($templatePath, $outputPath)) {
            throw new Exception("Failed to copy template");
        }
        
        // Open the Word document as ZIP
        $zip = new ZipArchive();
        if ($zip->open($outputPath) !== TRUE) {
            throw new Exception("Cannot open Word document as ZIP");
        }
        
        // Get the document.xml content
        $documentXml = $zip->getFromName('word/document.xml');
        if ($documentXml === false) {
            throw new Exception("Cannot read document.xml");
        }
        
        error_log("generateBarangayIdDocument: Document XML loaded, size: " . strlen($documentXml) . " bytes");
        
        // Debug XML content
        error_log("generateBarangayIdDocument: Contains birth_date placeholder: " . (strpos($documentXml, '{{birth_date}}') !== false ? 'YES' : 'NO'));
        error_log("generateBarangayIdDocument: Contains res_picture placeholder: " . (strpos($documentXml, '{{res_picture}}') !== false ? 'YES' : 'NO'));
        
        // Check for birth_date in different encodings/forms
        $birthDatePatterns = [
            '{{birth_date}}',
            '&lt;w:t&gt;{{birth_date}}&lt;/w:t&gt;',
            '<w:t>{{birth_date}}</w:t>',
            '&amp;lt;w:t&amp;gt;{{birth_date}}&amp;lt;/w:t&amp;gt;'
        ];
        
        foreach ($birthDatePatterns as $pattern) {
            if (strpos($documentXml, $pattern) !== false) {
                error_log("generateBarangayIdDocument: Found birth_date pattern: " . $pattern);
                $pos = strpos($documentXml, $pattern);
                $snippet = substr($documentXml, max(0, $pos - 50), 100);
                error_log("generateBarangayIdDocument: XML snippet around pattern: " . $snippet);
            }
        }
        
        // Convert {{placeholder}} to ${placeholder} for PhpWord TemplateProcessor
        $documentXml = preg_replace('/\{\{([^}]+)\}\}/', '${$1}', $documentXml);
        
        // Put the converted XML back
        if ($zip->addFromString('word/document.xml', $documentXml) === false) {
            throw new Exception("Failed to update document.xml");
        }
        $zip->close();
        
        // Create a temporary file for TemplateProcessor to work with
        $tempTemplatePath = $outputPath . '.template';
        if (file_exists($tempTemplatePath)) {
            unlink($tempTemplatePath);
        }
        if (!copy($outputPath, $tempTemplatePath)) {
            throw new Exception("Failed to copy template to temporary file");
        }
        
        // Now use PhpWord TemplateProcessor with ${} syntax - use temp file
        $template = new TemplateProcessor($tempTemplatePath);
        
        // Replace all placeholders
        error_log("generateBarangayIdDocument: Starting placeholder replacement for " . count($data) . " fields");
        foreach ($data as $key => $value) {
            if ($key === 'res_picture') continue; // Handle image separately
            
            // Don't format birth_date again - it's already formatted in the data array
            // Convert to string and handle empty values
            if ($value === null || $value === '') {
                $valueToSet = '';
            } else {
                $valueToSet = (string)$value;
            }
            
            error_log("generateBarangayIdDocument: Setting placeholder '${$key}' = '" . substr($valueToSet, 0, 50) . "'");
            
            try {
                // TemplateProcessor expects the key name without ${} - it will add it automatically
                // The XML already has ${key} format after conversion from {{key}}
                $template->setValue($key, $valueToSet);
                
                // For critical placeholders, also try variations to ensure replacement
                if ($key === 'bid') {
                    // Also try uppercase version
                    $template->setValue('BID', $valueToSet);
                } elseif ($key === 'birth_date') {
                    // Also try variations for birth date
                    $template->setValue('birth day', $valueToSet);
                    $template->setValue('birthday', $valueToSet);
                } elseif ($key === 'birth day') {
                    // Also try underscore version
                    $template->setValue('birth_date', $valueToSet);
                    $template->setValue('birthday', $valueToSet);
                } elseif ($key === 'weight') {
                    // Ensure weight is set (already handled, but keep for consistency)
                    // No variations needed
                } elseif ($key === 'expiration') {
                    // Also try expiration_date variation
                    $template->setValue('expiration_date', $valueToSet);
                }
            } catch (Exception $e) {
                error_log("generateBarangayIdDocument: Warning - Failed to set placeholder '${$key}': " . $e->getMessage());
                // Continue with other placeholders even if one fails
            }
        }
        error_log("generateBarangayIdDocument: Finished placeholder replacement");
        
        // Handle image separately
        if (!empty($data['res_picture'])) {
            $tempImage = createTempImageFile($data['res_picture']);
            if ($tempImage) {
                $template->setImageValue('res_picture', [
                    'path' => $tempImage,
                    'width' => 96,
                    'height' => 96,
                    'ratio' => false
                ]);
                unlink($tempImage);
            } else {
                $template->setValue('res_picture', '[NO PHOTO]');
            }
        } else {
            $template->setValue('res_picture', '[NO PHOTO]');
        }
        
        // Save to output
        error_log("generateBarangayIdDocument: About to save template to: " . $outputPath);
        error_log("generateBarangayIdDocument: Output directory exists: " . (is_dir(dirname($outputPath)) ? 'YES' : 'NO'));
        error_log("generateBarangayIdDocument: Output directory writable: " . (is_writable(dirname($outputPath)) ? 'YES' : 'NO'));
        
        // Check if we can write to the output directory
        if (!is_dir(dirname($outputPath))) {
            throw new Exception("Output directory does not exist: " . dirname($outputPath));
        }
        
        if (!is_writable(dirname($outputPath))) {
            throw new Exception("Output directory is not writable: " . dirname($outputPath));
        }
        
        // Delete existing output file if it exists to avoid conflicts
        if (file_exists($outputPath)) {
            error_log("generateBarangayIdDocument: Deleting existing output file: " . $outputPath);
            if (!unlink($outputPath)) {
                error_log("generateBarangayIdDocument: WARNING - Failed to delete existing file, but continuing...");
            }
        }
        
        // Save directly to output path - saveAs() should handle saving to a different path
        try {
            error_log("generateBarangayIdDocument: Saving template to: " . $outputPath);
        $template->saveAs($outputPath);
            error_log("generateBarangayIdDocument: saveAs() completed without exception");
            
            // Manual XML replacement for placeholders with spaces or special characters
            // TemplateProcessor may not handle placeholders with spaces correctly
            error_log("generateBarangayIdDocument: Starting manual XML replacement for placeholders with spaces");
            $zip = new ZipArchive();
            if ($zip->open($outputPath) === TRUE) {
                $documentXml = $zip->getFromName('word/document.xml');
                if ($documentXml !== false) {
                    $originalXml = $documentXml;
                    
                    // Comprehensive manual replacement for ALL placeholders
                    // This ensures that even if TemplateProcessor misses some, they will be replaced here
                    // Handle placeholders with spaces, underscores, and various formats
                    foreach ($data as $key => $value) {
                        if ($key === 'res_picture') continue; // Skip image
                        
                        // Convert value to string and escape for XML
                        $valueToReplace = htmlspecialchars((string)$value, ENT_XML1, 'UTF-8');
                        
                        // Replace ${key} format (after conversion from {{key}})
                        // Use direct string replacement for exact matching (more reliable than regex)
                        $documentXml = str_replace('${' . $key . '}', $valueToReplace, $documentXml);
                        
                        // Also handle case variations for the key
                        $documentXml = str_replace('${' . strtoupper($key) . '}', $valueToReplace, $documentXml);
                        $documentXml = str_replace('${' . strtolower($key) . '}', $valueToReplace, $documentXml);
                        
                        // Handle keys with spaces - try different variations
                        if (strpos($key, ' ') !== false) {
                            // For keys with spaces like "birth day"
                            $documentXml = str_replace('${' . $key . '}', $valueToReplace, $documentXml);
                            // Also try with underscores
                            $underscoreKey = str_replace(' ', '_', $key);
                            $documentXml = str_replace('${' . $underscoreKey . '}', $valueToReplace, $documentXml);
                            // Also try with XML space encoding
                            $xmlEncodedKey = str_replace(' ', '&#32;', $key);
                            $documentXml = str_replace('${' . $xmlEncodedKey . '}', $valueToReplace, $documentXml);
                        }
                        
                        // Handle underscore variations
                        if (strpos($key, '_') !== false) {
                            $spaceKey = str_replace('_', ' ', $key);
                            $documentXml = str_replace('${' . $spaceKey . '}', $valueToReplace, $documentXml);
                        }
                    }
                    
                    // Additional specific handling for critical placeholders that might have issues
                    // birth_date/birth day variations - CRITICAL: Handle space in placeholder name
                    $birthDateValue = '';
                    if (!empty($data['birth_date'])) {
                        $birthDateValue = htmlspecialchars((string)$data['birth_date'], ENT_XML1, 'UTF-8');
                    } elseif (!empty($data['birth day'])) {
                        $birthDateValue = htmlspecialchars((string)$data['birth day'], ENT_XML1, 'UTF-8');
                    }
                    if (!empty($birthDateValue)) {
                        // Direct string replacement for all birth date variations
                        $documentXml = str_replace('${birth day}', $birthDateValue, $documentXml);
                        $documentXml = str_replace('${birth_day}', $birthDateValue, $documentXml);
                        $documentXml = str_replace('${birth_date}', $birthDateValue, $documentXml);
                        $documentXml = str_replace('${birthday}', $birthDateValue, $documentXml);
                        $documentXml = str_replace('${BIRTH_DAY}', $birthDateValue, $documentXml);
                        $documentXml = str_replace('${BIRTH_DATE}', $birthDateValue, $documentXml);
                        // Also try with XML encoding
                        $documentXml = str_replace('${birth&#32;day}', $birthDateValue, $documentXml);
                        error_log("generateBarangayIdDocument: Manual replacement - birth date: " . substr($birthDateValue, 0, 50));
                    }
                    
                    // bid variations
                    $bidValue = '';
                    if (!empty($data['bid'])) {
                        $bidValue = htmlspecialchars((string)$data['bid'], ENT_XML1, 'UTF-8');
                    } elseif (!empty($data['BID'])) {
                        $bidValue = htmlspecialchars((string)$data['BID'], ENT_XML1, 'UTF-8');
                    }
                    if (!empty($bidValue)) {
                        $documentXml = str_replace('${bid}', $bidValue, $documentXml);
                        $documentXml = str_replace('${BID}', $bidValue, $documentXml);
                        $documentXml = str_replace('${BID_NUMBER}', $bidValue, $documentXml);
                        $documentXml = str_replace('${bid_number}', $bidValue, $documentXml);
                        error_log("generateBarangayIdDocument: Manual replacement - bid: " . $bidValue);
                    }
                    
                    // weight
                    $weightValue = '';
                    if (isset($data['weight']) && $data['weight'] !== '' && $data['weight'] !== null) {
                        $weightValue = htmlspecialchars((string)$data['weight'], ENT_XML1, 'UTF-8');
                    }
                    if (!empty($weightValue)) {
                        $documentXml = str_replace('${weight}', $weightValue, $documentXml);
                        $documentXml = str_replace('${WEIGHT}', $weightValue, $documentXml);
                        error_log("generateBarangayIdDocument: Manual replacement - weight: " . $weightValue);
                    }
                    
                    // expiration
                    $expirationValue = '';
                    if (!empty($data['expiration'])) {
                        $expirationValue = htmlspecialchars((string)$data['expiration'], ENT_XML1, 'UTF-8');
                    } elseif (!empty($data['expiration_date'])) {
                        $expirationValue = htmlspecialchars((string)$data['expiration_date'], ENT_XML1, 'UTF-8');
                    }
                    if (!empty($expirationValue)) {
                        $documentXml = str_replace('${expiration}', $expirationValue, $documentXml);
                        $documentXml = str_replace('${expiration_date}', $expirationValue, $documentXml);
                        $documentXml = str_replace('${EXPIRATION}', $expirationValue, $documentXml);
                        $documentXml = str_replace('${EXPIRATION_DATE}', $expirationValue, $documentXml);
                        error_log("generateBarangayIdDocument: Manual replacement - expiration: " . substr($expirationValue, 0, 50));
                    }
                    
                    // Check if XML was modified
                    if ($documentXml !== $originalXml) {
                        error_log("generateBarangayIdDocument: XML was modified by manual replacement");
                        $zip->deleteName('word/document.xml');
                        $zip->addFromString('word/document.xml', $documentXml);
                    } else {
                        error_log("generateBarangayIdDocument: No changes needed in manual replacement");
                    }
                }
                $zip->close();
            }
            
            // Clean up temporary template file
            if (file_exists($tempTemplatePath)) {
                unlink($tempTemplatePath);
            }
        } catch (Exception $saveException) {
            // Clean up temporary files if they exist
            if (file_exists($tempTemplatePath)) {
                unlink($tempTemplatePath);
            }
            error_log("generateBarangayIdDocument: saveAs() threw exception: " . $saveException->getMessage());
            throw new Exception("Failed to save template: " . $saveException->getMessage());
        }
        
        // Verify file was actually created
        if (!file_exists($outputPath)) {
            error_log("generateBarangayIdDocument: ERROR - File does not exist after saveAs(): " . $outputPath);
            throw new Exception("File was not created after saveAs(): " . $outputPath);
        }
        
        if (!is_readable($outputPath)) {
            error_log("generateBarangayIdDocument: ERROR - File is not readable after saveAs(): " . $outputPath);
            throw new Exception("File is not readable after saveAs(): " . $outputPath);
        }
        
        $fileSize = filesize($outputPath);
        if ($fileSize === 0 || $fileSize === false) {
            error_log("generateBarangayIdDocument: ERROR - File size is 0 or invalid after saveAs(): " . $outputPath);
            throw new Exception("File size is invalid after saveAs(): " . $outputPath);
        }
        
        error_log("generateBarangayIdDocument: Template population completed successfully - File size: " . $fileSize . " bytes");
        return true;
        
    } catch (Exception $e) {
        error_log("generateBarangayIdDocument: Direct XML processor error: " . $e->getMessage());
        throw new Exception("Failed to process template with direct XML processor: " . $e->getMessage());
    }
}

// Function to remove directory recursively
function removeDirectory($dir) {
    if (is_dir($dir)) {
        $files = array_diff(scandir($dir), array('.', '..'));
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            if (is_dir($path)) {
                removeDirectory($path);
            } else {
                unlink($path);
            }
        }
        rmdir($dir);
    }
}

// Function to ensure bid column exists
function ensureBidColumnExists($connection) {
    // Check if bid column exists
    $checkColumn = $connection->query("SHOW COLUMNS FROM barangay_id_forms LIKE 'bid'");
    if ($checkColumn && $checkColumn->num_rows === 0) {
        // Column doesn't exist, create it
        $alterSql = "ALTER TABLE barangay_id_forms ADD COLUMN bid VARCHAR(50) NULL AFTER id";
        if (!$connection->query($alterSql)) {
            throw new Exception("Failed to create bid column: " . $connection->error);
        }
        error_log("generateBarangayIdDocument: Created bid column in barangay_id_forms table");
    }
}

try {
    // Get request ID and BID from POST data
    $requestId = $_POST['requestId'] ?? null;
    $bidValue = $_POST['bid'] ?? null;
    
    // Debug logging
    error_log("generateBarangayIdDocument: Received requestId: " . $requestId);
    error_log("generateBarangayIdDocument: Received BID: " . $bidValue);
    
    if (!$requestId) {
        throw new Exception('Request ID is required');
    }
    
    if (!$bidValue) {
        throw new Exception('BID number is required');
    }
    
    // Validate BID format: must be YYYY-XXXX format (year followed by digits)
    if (!preg_match('/^\d{4}-\d+$/', $bidValue)) {
        throw new Exception('Invalid BID format. Must be in format: YYYY-XXXX (e.g., 2026-0112)');
    }
    
    // Database connection using the function from config.php
    $connection = getDatabaseConnection();
    
    // Ensure bid column exists
    ensureBidColumnExists($connection);
    ensure_barangay_id_height_varchar($connection);
    
    // Check if BID already exists (uniqueness check)
    $checkBidSql = "SELECT id FROM barangay_id_forms WHERE bid = ? AND id != ?";
    $checkBidStmt = $connection->prepare($checkBidSql);
    if (!$checkBidStmt) {
        throw new Exception("Failed to prepare BID uniqueness check: " . $connection->error);
    }
    $checkBidStmt->bind_param("si", $bidValue, $requestId);
    $checkBidStmt->execute();
    $bidCheckResult = $checkBidStmt->get_result();
    
    if ($bidCheckResult->num_rows > 0) {
        $checkBidStmt->close();
        $connection->close();
        throw new Exception('BID number already exists. Please use a different number.');
    }
    $checkBidStmt->close();
    
    // Get barangay ID form data - include bid, birth_date, weight, and check for expiration_date
    $sql = "SELECT id, bid, last_name, given_name, middle_name, birth_date, address, civil_status, height, weight, gender, emergency_contact_name, emergency_contact_number, is_censused, residency_duration, valid_id, id_image, res_picture, status, submitted_at, process_at FROM barangay_id_forms WHERE id = ?";
    
    error_log("generateBarangayIdDocument: Executing query for request ID: $requestId");
    
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare statement: " . $connection->error);
    }
    
    $stmt->bind_param("i", $requestId);
    
    if (!$stmt->execute()) {
        throw new Exception("Failed to execute statement: " . $stmt->error);
    }
    
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        // Check if table exists and has any data
        $checkSql = "SELECT COUNT(*) as count FROM barangay_id_forms";
        $checkResult = $connection->query($checkSql);
        $totalRecords = 0;
        if ($checkResult) {
            $row = $checkResult->fetch_assoc();
            $totalRecords = $row['count'];
        }
        
        error_log("generateBarangayIdDocument: No data found for request ID $requestId. Total records in table: $totalRecords");
        
        // Check what IDs exist
        $idSql = "SELECT id FROM barangay_id_forms ORDER BY id LIMIT 10";
        $idResult = $connection->query($idSql);
        $availableIds = [];
        if ($idResult && $idResult->num_rows > 0) {
            while ($row = $idResult->fetch_assoc()) {
                $availableIds[] = $row['id'];
            }
        }
        
        error_log("generateBarangayIdDocument: Available IDs: " . implode(', ', $availableIds));
        
        throw new Exception("No data found for request ID: $requestId. Available IDs: " . implode(', ', $availableIds));
    }
    
    $row = $result->fetch_assoc();
    $stmt->close();
    
    // Use BID from database if it exists, otherwise use POST value
    $BID = !empty($row['bid']) ? $row['bid'] : $bidValue;
    
    // Log BID source for debugging
    if (!empty($row['bid'])) {
        error_log("generateBarangayIdDocument: Using BID from database: " . $row['bid']);
    } else {
        error_log("generateBarangayIdDocument: BID not in database, using POST value: " . $bidValue);
    }
    
    // Get current year for year field
    $currentYear = date('Y');
    
    // Check if expiration_date column exists in the table
    $checkExpirationColumn = $connection->query("SHOW COLUMNS FROM barangay_id_forms LIKE 'expiration_date'");
    $hasExpirationColumn = $checkExpirationColumn && $checkExpirationColumn->num_rows > 0;
    
    // Get expiration date from database if column exists, otherwise calculate it
    $currentDate = new DateTime();
    if ($hasExpirationColumn && !empty($row['expiration_date'])) {
        try {
            $expirationDate = new DateTime($row['expiration_date']);
            error_log("generateBarangayIdDocument: Using expiration_date from database: " . $row['expiration_date']);
        } catch (Exception $e) {
            // If parsing fails, calculate expiration date (1 year from current date)
            $expirationDate = clone $currentDate;
            $expirationDate->add(new DateInterval('P1Y'));
            error_log("generateBarangayIdDocument: Failed to parse expiration_date from database, calculating: " . $e->getMessage());
        }
    } else {
        // Calculate expiration date (1 year from current date)
        $expirationDate = clone $currentDate;
        $expirationDate->add(new DateInterval('P1Y')); // Add 1 year
        error_log("generateBarangayIdDocument: Calculating expiration_date (1 year from now)");
    }
    
    // Function to remove .00 decimal places
    function removeDecimalZeros($value) {
        if (is_numeric($value)) {
            return rtrim(rtrim($value, '0'), '.');
        }
        return $value;
    }

    // Prepare data for document population - use values from database
    // Ensure birth_date has value from database
    $birthDateValue = '';
    if (!empty($row['birth_date']) && $row['birth_date'] !== '0000-00-00' && $row['birth_date'] !== '') {
        $birthDateValue = formatBirthDate($row['birth_date']);
        error_log("generateBarangayIdDocument: Birth date formatted: " . $birthDateValue);
    } else {
        error_log("generateBarangayIdDocument: WARNING - Birth date is empty or invalid: " . var_export($row['birth_date'] ?? 'NULL', true));
    }
    
    // Ensure weight has value from database
    $weightValue = '';
    if (isset($row['weight']) && $row['weight'] !== '' && $row['weight'] !== null) {
        $weightValue = removeDecimalZeros($row['weight']);
        error_log("generateBarangayIdDocument: Weight processed: " . $weightValue);
    } else {
        error_log("generateBarangayIdDocument: WARNING - Weight is empty or null: " . var_export($row['weight'] ?? 'NULL', true));
    }
    
    // Height: ft/in (e.g. 5'8) stored without unit words; strip legacy cm/foot suffixes; plain numbers = legacy cm, no suffix added
    $heightValue = '';
    if (isset($row['height']) && $row['height'] !== '' && $row['height'] !== null) {
        $hs = normalize_barangay_id_height_string($row['height']);
        if ($hs !== '') {
            $hsNorm = str_replace(',', '.', $hs);
            if (preg_match('/^-?\d+(\.\d+)?$/', $hsNorm)) {
                $heightValue = removeDecimalZeros($hsNorm);
            } else {
                $heightValue = $hs;
            }
        }
    } else {
        error_log("generateBarangayIdDocument: WARNING - Height is empty or null: " . var_export($row['height'] ?? 'NULL', true));
    }
    
    $data = [
        'id' => $row['id'] ?? '',
        'first_name' => $row['given_name'] ?? '',
        'middle_name' => $row['middle_name'] ?? '',
        'last_name' => $row['last_name'] ?? '',
        'birth_date' => $birthDateValue, // Format birth date from database
        'birth day' => $birthDateValue, // Support {{birth day}} placeholder with space
        'birthday' => $birthDateValue, // Support {{birthday}} placeholder without space
        'address' => $row['address'] ?? '',
        'gender' => $row['gender'] ?? '',
        'height' => $heightValue,
        'nationality' => 'Filipino', // Default nationality
        'emergency_contact_number' => $row['emergency_contact_number'] ?? '',
        'emergency_contact_name' => $row['emergency_contact_name'] ?? '',
        'civil_status' => $row['civil_status'] ?? '',
        'weight' => $weightValue, // From database
        'BID' => $BID, // From database or POST
        'BID_NUMBER' => $BID, // Support both BID and BID_NUMBER placeholders
        'bid_number' => $BID, // Support lowercase variant
        'bid' => $BID, // Support lowercase bid placeholder - this is for {{bid}}
        'date_issued' => $currentDate->format('F d, Y'), // Current date in readable format
        'expiration_date' => $expirationDate->format('F d, Y'), // Expiration date from database or calculated
        'expiration' => strtoupper($expirationDate->format('F d, Y')), // This is for {{expiration}} placeholder
        'year' => $currentYear,
        'res_picture' => $row['res_picture'] // Use raw LONGBLOB data directly
    ];
    
    // Debug logging - Log all data values to ensure they're not empty
    error_log("generateBarangayIdDocument: ===== DATA ARRAY CONTENTS =====");
    foreach ($data as $key => $value) {
        if ($key !== 'res_picture') { // Skip binary image data
            $displayValue = is_string($value) ? substr($value, 0, 100) : $value;
            error_log("generateBarangayIdDocument: Data['{$key}'] = '" . $displayValue . "'");
        } else {
            error_log("generateBarangayIdDocument: Data['res_picture'] = [BINARY DATA - " . strlen($value) . " bytes]");
        }
    }
    error_log("generateBarangayIdDocument: ===== END DATA ARRAY =====");
    // Debug logging - Log raw database values and processed values
    error_log("generateBarangayIdDocument: ===== RAW DATABASE VALUES =====");
    error_log("generateBarangayIdDocument: row['birth_date'] = " . var_export($row['birth_date'], true));
    error_log("generateBarangayIdDocument: row['bid'] = " . var_export($row['bid'], true));
    error_log("generateBarangayIdDocument: row['weight'] = " . var_export($row['weight'], true));
    error_log("generateBarangayIdDocument: ===== PROCESSED VALUES =====");
    error_log("generateBarangayIdDocument: BID value from database: " . ($row['bid'] ?? 'NULL'));
    error_log("generateBarangayIdDocument: BID value from POST: " . $bidValue);
    error_log("generateBarangayIdDocument: BID value to be used in document: " . $BID);
    error_log("generateBarangayIdDocument: BID in data array - bid: " . ($data['bid'] ?? 'NOT SET') . ", BID: " . ($data['BID'] ?? 'NOT SET'));
    error_log("generateBarangayIdDocument: Birth date from DB: " . ($row['birth_date'] ?? 'NULL'));
    error_log("generateBarangayIdDocument: Formatted birth date in data array: " . $data['birth_date']);
    error_log("generateBarangayIdDocument: Weight from DB: " . ($row['weight'] ?? 'NULL'));
    error_log("generateBarangayIdDocument: Weight in data array: " . $data['weight']);
    error_log("generateBarangayIdDocument: Expiration date in data array: " . $data['expiration']);
    error_log("generateBarangayIdDocument: ===== END DEBUG VALUES =====");
    
    // Template and output paths
    $templatePath = __DIR__ . '/../brgy_forms/BRGY_ID.docx';
    
    // Create filename with person's name and date
    $fullName = trim(($row['given_name'] ?? '') . ' ' . ($row['middle_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
    $fullName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $fullName); // Replace special chars with underscore
    $fullName = preg_replace('/_+/', '_', $fullName); // Replace multiple underscores with single
    $fullName = trim($fullName, '_'); // Remove leading/trailing underscores
    
    if (empty($fullName)) {
        $fullName = 'Unknown';
    }
    
    $filename = 'BRGY_ID_' . $fullName . '_' . date('Y-m-d_H-i-s') . '.docx';
    $fullOutputPath = rich_temp_docx_path($filename);
    
    // Debug template path
    error_log("generateBarangayIdDocument: Template path: " . $templatePath);
    error_log("generateBarangayIdDocument: Template exists: " . (file_exists($templatePath) ? 'YES' : 'NO'));
    error_log("generateBarangayIdDocument: Template readable: " . (is_readable($templatePath) ? 'YES' : 'NO'));
    
    // Include PDF conversion function
    require_once __DIR__ . '/convertDocxToPdf.php';
    
    // Check if template exists
    if (!file_exists($templatePath)) {
        throw new Exception("Template file not found: " . $templatePath);
    }
    
    // Debug logging
    error_log("generateBarangayIdDocument: Template path: " . $templatePath);
    error_log("generateBarangayIdDocument: Output path: " . $fullOutputPath);
    
    // Populate the template with actual data
    try {
        error_log("generateBarangayIdDocument: Starting template population...");
        $success = populateWordTemplate($templatePath, $fullOutputPath, $data);
        error_log("generateBarangayIdDocument: Template population result: " . ($success ? 'SUCCESS' : 'FAILED'));
        
        if (!$success) {
            throw new Exception("Template population returned false");
        }
    } catch (Exception $e) {
        error_log("generateBarangayIdDocument: Error populating template: " . $e->getMessage());
        error_log("generateBarangayIdDocument: Stack trace: " . $e->getTraceAsString());
        throw new Exception("Failed to populate template: " . $e->getMessage());
    }
    
    if ($success) {
        // Verify the file was actually created and is accessible
        if (!file_exists($fullOutputPath)) {
            error_log("generateBarangayIdDocument: ERROR - File was not created: " . $fullOutputPath);
            throw new Exception("Generated file does not exist: " . $filename);
        }
        
        if (!is_readable($fullOutputPath)) {
            error_log("generateBarangayIdDocument: ERROR - File is not readable: " . $fullOutputPath);
            throw new Exception("Generated file is not readable: " . $filename);
        }
        
        $fileSize = filesize($fullOutputPath);
        if ($fileSize === 0) {
            error_log("generateBarangayIdDocument: ERROR - File is empty: " . $fullOutputPath);
            throw new Exception("Generated file is empty: " . $filename);
        }
        
        error_log("generateBarangayIdDocument: File verification successful - Size: " . $fileSize . " bytes");
        
        $finalFilename = $filename;
        $finalDownloadUrl = rich_temp_download_public_url(rich_register_temp_download($fullOutputPath));
        
        // Update the request status to Processing, set process_at datetime, and save BID if not already in database (using PHP timezone)
        $currentTime = date('Y-m-d H:i:s');
        // Only update BID if it's not already in the database or if POST value is different
        if (empty($row['bid']) || $row['bid'] !== $bidValue) {
            $updateSql = "UPDATE barangay_id_forms SET status = 'Processing', process_at = ?, bid = ? WHERE id = ?";
            $updateStmt = $connection->prepare($updateSql);
            if (!$updateStmt) {
                error_log("Failed to prepare update statement: " . $connection->error);
                throw new Exception("Failed to prepare update statement: " . $connection->error);
            }
            
            $updateStmt->bind_param("ssi", $currentTime, $bidValue, $requestId);
            if (!$updateStmt->execute()) {
                error_log("Failed to execute update statement: " . $updateStmt->error);
                $updateStmt->close();
                throw new Exception("Failed to execute update statement: " . $updateStmt->error);
            }
            
            error_log("generateBarangayIdDocument: BID saved to database successfully - BID: " . $bidValue);
            $updateStmt->close();
        } else {
            // BID already exists in database, just update status and process_at
            $updateSql = "UPDATE barangay_id_forms SET status = 'Processing', process_at = ? WHERE id = ?";
            $updateStmt = $connection->prepare($updateSql);
            if (!$updateStmt) {
                error_log("Failed to prepare update statement: " . $connection->error);
                throw new Exception("Failed to prepare update statement: " . $connection->error);
            }
            
            $updateStmt->bind_param("si", $currentTime, $requestId);
            if (!$updateStmt->execute()) {
                error_log("Failed to execute update statement: " . $updateStmt->error);
                $updateStmt->close();
                throw new Exception("Failed to execute update statement: " . $updateStmt->error);
            }
            
            error_log("generateBarangayIdDocument: Status updated, BID already exists in database - BID: " . $row['bid']);
            $updateStmt->close();
        }
        
        // Verify the BID was actually saved correctly
        $verifySql = "SELECT bid FROM barangay_id_forms WHERE id = ?";
        $verifyStmt = $connection->prepare($verifySql);
        if ($verifyStmt) {
            $verifyStmt->bind_param("i", $requestId);
            $verifyStmt->execute();
            $verifyResult = $verifyStmt->get_result();
            if ($verifyResult->num_rows > 0) {
                $verifyRow = $verifyResult->fetch_assoc();
                $savedBid = $verifyRow['bid'];
                error_log("generateBarangayIdDocument: BID verification - Saved BID: " . $savedBid . ", Expected: " . $bidValue);
                if ($savedBid !== $bidValue) {
                    error_log("generateBarangayIdDocument: WARNING - BID mismatch! Saved: " . $savedBid . ", Expected: " . $bidValue);
                } else {
                    error_log("generateBarangayIdDocument: BID verification PASSED - Correctly saved: " . $bidValue);
                }
            }
            $verifyStmt->close();
        }
        
        // Don't update to Finished here - status will be updated when Ready to Receive is clicked
        $connection->close();
        
        error_log("Barangay ID Document generated successfully: " . $finalFilename);
        error_log("About to send JSON response...");
        
        // Clear any unexpected output and send JSON response
        ob_clean();
        
        // Ensure headers are set properly
        if (!headers_sent()) {
            header('Content-Type: application/json');
            error_log("Headers set successfully");
        } else {
            error_log("Headers already sent, cannot set Content-Type");
        }
        
        // Create response data without binary content
        $responseData = $data;
        unset($responseData['res_picture']); // Remove binary image data
        
        $response = [
            'success' => true,
            'message' => 'Barangay ID generated successfully',
            'filename' => $finalFilename,
            'downloadUrl' => $finalDownloadUrl,
            'data' => $responseData
        ];
        
        // Debug the response data
        error_log("Response data: " . print_r($response, true));
        
        $jsonResponse = json_encode($response);
        if ($jsonResponse === false) {
            error_log("JSON encode failed: " . json_last_error_msg());
            $jsonResponse = json_encode(['success' => false, 'error' => 'JSON encoding failed: ' . json_last_error_msg()]);
        }
        
        error_log("Sending JSON response: " . $jsonResponse);
        echo $jsonResponse;
        error_log("JSON response sent, exiting...");
        exit;
    } else {
        throw new Exception('Failed to generate document');
    }
    
} catch (Exception $e) {
    // Clear any unexpected output and send error response
    ob_clean();
    http_response_code(500);
    
    // Ensure headers are set properly
    if (!headers_sent()) {
        header('Content-Type: application/json');
    }
    
    $errorResponse = [
        'success' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ];
    
    echo json_encode($errorResponse);
    exit;
} catch (Error $e) {
    // Handle fatal errors
    ob_clean();
    http_response_code(500);
    
    // Ensure headers are set properly
    if (!headers_sent()) {
        header('Content-Type: application/json');
    }
    
    $errorResponse = [
        'success' => false,
        'error' => 'Fatal error: ' . $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ];
    
    echo json_encode($errorResponse);
    exit;
}
?>
