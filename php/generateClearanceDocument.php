<?php
require_once __DIR__ . '/init_session.php';
// Clearance Document Generation
error_reporting(0);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Include required files
require_once 'config.php';
require_once __DIR__ . '/generated_document_temp.php';
require_once '../vendor/autoload.php';

// Start output buffering to catch any unexpected output
ob_start();

// Log the start of the script
error_log("=== CLEARANCE GENERATION START ===");

try {
    error_log("Setting headers...");
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST');
    header('Access-Control-Allow-Headers: Content-Type');
    
    // Start session
    rich_session_start();
    
    error_log("Getting database connection...");
    $connection = getDatabaseConnection();
    $connection->set_charset('utf8mb4');
    
    error_log("Setting timezone...");
    date_default_timezone_set('Asia/Manila');
    
    error_log("Getting POST data...");
    $input = json_decode(file_get_contents('php://input'), true);
    $clearanceId = $input['clearance_id'] ?? null;
    $updateStatus = $input['update_status'] ?? true;
    
    error_log("Clearance ID: " . ($clearanceId ?? 'NULL'));
    
    if (!$clearanceId) {
        throw new Exception('Clearance ID is required');
    }
    
    // Validate clearance ID is numeric
    if (!is_numeric($clearanceId)) {
        throw new Exception('Invalid clearance ID format');
    }
    
    error_log("Starting status update...");
    // First, update status to Processing if requested
    if ($updateStatus) {
        $currentTime = date('Y-m-d H:i:s');
        $updateSql = "UPDATE clearance_forms SET status = 'Processing', process_at = ? WHERE id = ?";
        $updateStmt = $connection->prepare($updateSql);
        if (!$updateStmt) {
            throw new Exception('Failed to prepare status update query: ' . $connection->error);
        }
        $updateStmt->bind_param('si', $currentTime, $clearanceId);
        
        if (!$updateStmt->execute()) {
            throw new Exception('Failed to update status to Processing: ' . $updateStmt->error);
        }
        
        error_log("Updated clearance ID $clearanceId status to Processing");
    }
    
    error_log("Getting clearance data...");
    // Get clearance data from database
    $sql = "SELECT * FROM clearance_forms WHERE id = ?";
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception('Failed to prepare data query: ' . $connection->error);
    }
    $stmt->bind_param('i', $clearanceId);
    $stmt->execute();
    $result = $stmt->get_result();
    $clearanceData = $result->fetch_assoc();
    
    if (!$clearanceData) {
        throw new Exception('Clearance record not found for ID: ' . $clearanceId);
    }
    
    // Get the purpose field to determine which template to use
    $purpose = $clearanceData['purpose'] ?? '';
    $expiration_date = $input['expiration_date'] ?? '';
    error_log("Purpose: $purpose, Expiration Date: $expiration_date");
    
    error_log("Preparing data for template...");
    
    // Determine which template and data structure to use based on purpose
    
    // Base data for all clearance types
    $baseData = [
        'first_name' => strtoupper($clearanceData['first_name'] ?? ''),
        'middle_name' => strtoupper($clearanceData['middle_name'] ?? ''),
        'last_name' => strtoupper($clearanceData['last_name'] ?? ''),
        'address' => strtoupper($clearanceData['address'] ?? ''),
        'birth_date' => formatDateToCaps($clearanceData['birth_date'] ?? ''),
        'birth_place' => strtoupper($clearanceData['birth_place'] ?? ''),
        'gender' => strtoupper($clearanceData['gender'] ?? ''),
        'citizenship' => strtoupper($clearanceData['citizenship'] ?? ''),
        'civil_status' => strtoupper($clearanceData['civil_status'] ?? ''),
    ];
    
    // Prepare data based on purpose
    $data = $baseData;
    
    if ($purpose === 'business-clearance') {
        // Business Clearance specific data
        $data['business_name'] = strtoupper($clearanceData['business_name'] ?? '');
        $data['location'] = strtoupper($clearanceData['location'] ?? '');
        $data['month_day'] = formatMonthDay(date('Y-m-d'));
        $data['date_issued'] = formatDateToCaps(date('Y-m-d'));
        $data['expiration'] = !empty($expiration_date) ? formatDateToCaps($expiration_date) : formatDateToCaps(date('Y-m-d', strtotime('+1 year')));
    } elseif ($purpose === 'proof-of-residency') {
        // Proof of Residency specific data
        $data['start_year'] = $clearanceData['start_year'] ?? '';
        $data['date_issued'] = formatDateWithOrdinal(date('Y-m-d'));
    } else {
        // Default Barangay Clearance
        $data['date_issued'] = formatDateToCaps(date('Y-m-d'));
        $data['expiration'] = formatDateToCaps(date('Y-m-d', strtotime('+1 year')));
    }
    
    error_log("Generating document...");
    // Generate document with purpose-based template
    $outputPath = generateClearanceDocument($data, $purpose);
    
    if ($outputPath && file_exists($outputPath)) {
        error_log("Document generated successfully: $outputPath");
        
        // Don't update to Finished here - status will be updated when Ready to Receive is clicked
        
        // Clear any output buffer content
        ob_clean();
        
        $tok = rich_register_temp_download($outputPath);
        echo json_encode([
            'success' => true,
            'message' => 'Clearance document generated successfully',
            'download_url' => rich_temp_download_public_url($tok)
        ]);
    } else {
        throw new Exception('Failed to generate clearance document');
    }
    
} catch (Exception $e) {
    error_log("generateClearanceDocument Error: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    // Clear any output buffer content
    ob_clean();
    
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ]);
} finally {
    // End output buffering
    ob_end_flush();
    error_log("=== CLEARANCE GENERATION END ===");
}

/**
 * Format date to CAPS format (JANUARY 29, 2025)
 */
function formatDateToCaps($dateString) {
    if (empty($dateString)) {
        return '';
    }
    
    try {
        $date = new DateTime($dateString);
        $monthNames = [
            1 => 'JANUARY', 2 => 'FEBRUARY', 3 => 'MARCH', 4 => 'APRIL',
            5 => 'MAY', 6 => 'JUNE', 7 => 'JULY', 8 => 'AUGUST',
            9 => 'SEPTEMBER', 10 => 'OCTOBER', 11 => 'NOVEMBER', 12 => 'DECEMBER'
        ];
        
        $month = $monthNames[(int)$date->format('n')];
        $day = $date->format('j');
        $year = $date->format('Y');
        
        return "$month $day, $year";
    } catch (Exception $e) {
        error_log("Date formatting error: " . $e->getMessage());
        return strtoupper($dateString);
    }
}

/**
 * Format date to month and day only (OCTOBER 26)
 */
function formatMonthDay($dateString) {
    if (empty($dateString)) {
        return '';
    }
    
    try {
        $date = new DateTime($dateString);
        $monthNames = [
            1 => 'JANUARY', 2 => 'FEBRUARY', 3 => 'MARCH', 4 => 'APRIL',
            5 => 'MAY', 6 => 'JUNE', 7 => 'JULY', 8 => 'AUGUST',
            9 => 'SEPTEMBER', 10 => 'OCTOBER', 11 => 'NOVEMBER', 12 => 'DECEMBER'
        ];
        
        $month = $monthNames[(int)$date->format('n')];
        $day = $date->format('j');
        
        return "$month $day";
    } catch (Exception $e) {
        error_log("Date formatting error: " . $e->getMessage());
        return strtoupper($dateString);
    }
}

/**
 * Format date with ordinal (26th day of October, 2025)
 */
function formatDateWithOrdinal($dateString) {
    if (empty($dateString)) {
        return '';
    }
    
    try {
        $date = new DateTime($dateString);
        $monthNames = [
            1 => 'January', 2 => 'February', 3 => 'March', 4 => 'April',
            5 => 'May', 6 => 'June', 7 => 'July', 8 => 'August',
            9 => 'September', 10 => 'October', 11 => 'November', 12 => 'December'
        ];
        
        $day = (int)$date->format('j');
        $month = $monthNames[(int)$date->format('n')];
        $year = $date->format('Y');
        
        // Add ordinal suffix
        $suffix = 'th';
        if ($day % 10 == 1 && $day != 11) {
            $suffix = 'st';
        } elseif ($day % 10 == 2 && $day != 12) {
            $suffix = 'nd';
        } elseif ($day % 10 == 3 && $day != 13) {
            $suffix = 'rd';
        }
        
        return $day . $suffix . ' day of ' . $month . ', ' . $year;
    } catch (Exception $e) {
        error_log("Date formatting error: " . $e->getMessage());
        return $dateString;
    }
}

/**
 * Generate clearance document using template
 */
function generateClearanceDocument($data, $purpose = 'barangay-clearance') {
    try {
        error_log("Starting document generation...");
        error_log("Purpose: $purpose");
        
        // Determine template path based on purpose
        $templatePath = '';
        switch($purpose) {
            case 'business-clearance':
                $templatePath = '../brgy_forms/clearance/BUSINESS_CLEARANCE.docx';
                break;
            case 'proof-of-residency':
                $templatePath = '../brgy_forms/clearance/PROOF_OF_RESIDENCY.docx';
                break;
            case 'barangay-clearance':
            default:
                $templatePath = '../brgy_forms/clearance/BRGY_CLEARANCE.docx';
                break;
        }
        
        error_log("Template path: $templatePath");
        
        if (!file_exists($templatePath)) {
            throw new Exception("Template file not found: $templatePath");
        }
        
        error_log("Template file exists, checking permissions...");
        if (!is_readable($templatePath)) {
            throw new Exception("Template file is not readable: $templatePath");
        }
        
        // Generate unique filename based on purpose
        $timestamp = date('Y-m-d_H-i-s');
        
        // Create purpose-specific filename prefix
        switch($purpose) {
            case 'business-clearance':
                $filenamePrefix = "BUSINESS_CLEARANCE";
                break;
            case 'proof-of-residency':
                $filenamePrefix = "PROOF_OF_RESIDENCY";
                break;
            case 'barangay-clearance':
            default:
                $filenamePrefix = "BARANGAY_CLEARANCE";
                break;
        }
        
        $filename = $filenamePrefix . "_" . $data['last_name'] . "_" . $timestamp . ".docx";
        $outputPath = rich_temp_docx_path($filename);
        
        error_log("Output path: $outputPath");
        
        // Copy template to output location
        error_log("Copying template...");
        if (!copy($templatePath, $outputPath)) {
            throw new Exception("Failed to copy template");
        }
        
        error_log("Template copied successfully");
        
        // Process template using PhpWord TemplateProcessor (like Barangay ID)
        error_log("Processing template with PhpWord TemplateProcessor...");
        
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
        
        // Now use PhpWord TemplateProcessor with ${} syntax
        $template = new \PhpOffice\PhpWord\TemplateProcessor($tempTemplatePath);
        
        // Replace all placeholders
        foreach ($data as $key => $value) {
            try {
                $valueToSet = ($value !== null && $value !== '') ? (string)$value : '';
                $template->setValue($key, $valueToSet);
            } catch (Exception $e) {
                error_log("Warning - Failed to set placeholder '${$key}': " . $e->getMessage());
            }
        }
        
        // Save the template
        $template->saveAs($outputPath);
        
        // Clean up temporary file
        if (file_exists($tempTemplatePath)) {
            unlink($tempTemplatePath);
        }
        
        error_log("Document processed successfully: $outputPath");
        
        // Verify file was created and has content
        if (!file_exists($outputPath)) {
            throw new Exception("Output file was not created");
        }
        
        $fileSize = filesize($outputPath);
        error_log("Output file size: $fileSize bytes");
        
        if ($fileSize < 1000) { // Less than 1KB is suspicious
            throw new Exception("Output file is too small, may be corrupted");
        }
        
        // Keep DOCX file (no PDF conversion)
        return $outputPath;
        
    } catch (Exception $e) {
        error_log("generateClearanceDocument function error: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        throw new Exception("Failed to generate clearance document: " . $e->getMessage());
    }
}
?>
