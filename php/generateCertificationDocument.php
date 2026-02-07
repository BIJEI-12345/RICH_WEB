<?php
// Certification Document Generation
error_reporting(0);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Include required files
require_once 'config.php';
require_once '../vendor/autoload.php';

// Start output buffering to catch any unexpected output
ob_start();

// Log the start of the script
error_log("=== CERTIFICATION GENERATION START ===");

try {
    error_log("Setting headers...");
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST');
    header('Access-Control-Allow-Headers: Content-Type');
    
    // Start session
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    error_log("Getting database connection...");
    $connection = getDatabaseConnection();
    $connection->set_charset('utf8mb4');
    
    error_log("Setting timezone...");
    date_default_timezone_set('Asia/Manila');
    
    error_log("Getting POST data...");
    $input = json_decode(file_get_contents('php://input'), true);
    $certificationId = $input['certification_id'] ?? null;
    $updateStatus = $input['update_status'] ?? true;
    
    // Additional inputs for specific certification types
    $trial_court = $input['trial_court'] ?? '';
    
    error_log("Certification ID: " . ($certificationId ?? 'NULL'));
    
    if (!$certificationId) {
        throw new Exception('Certification ID is required');
    }
    
    // Validate certification ID is numeric
    if (!is_numeric($certificationId)) {
        throw new Exception('Invalid certification ID format');
    }
    
    error_log("Starting status update...");
    // First, update status to Processing if requested
    if ($updateStatus) {
        $currentTime = date('Y-m-d H:i:s');
        $updateSql = "UPDATE certification_forms SET status = 'Processing', process_at = ? WHERE id = ?";
        $updateStmt = $connection->prepare($updateSql);
        if (!$updateStmt) {
            throw new Exception('Failed to prepare status update query: ' . $connection->error);
        }
        $updateStmt->bind_param('si', $currentTime, $certificationId);
        
        if (!$updateStmt->execute()) {
            throw new Exception('Failed to update status to Processing: ' . $updateStmt->error);
        }
        
        error_log("Updated certification ID $certificationId status to Processing");
    }
    
    error_log("Getting certification data...");
    // Get certification data from database
    $sql = "SELECT * FROM certification_forms WHERE id = ?";
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception('Failed to prepare data query: ' . $connection->error);
    }
    $stmt->bind_param('i', $certificationId);
    $stmt->execute();
    $result = $stmt->get_result();
    $certificationData = $result->fetch_assoc();
    
    if (!$certificationData) {
        throw new Exception('Certification record not found for ID: ' . $certificationId);
    }
    
    
    // Get the purpose field to determine which template to use
    $purpose = $certificationData['purpose'] ?? '';
    error_log("Purpose: $purpose");
    
    error_log("Preparing data for template...");
    
    // Base data for all certification types
    $baseData = [
        'first_name' => strtoupper($certificationData['first_name'] ?? $certificationData['firstname'] ?? ''),
        'middle_name' => strtoupper($certificationData['middle_name'] ?? $certificationData['middlename'] ?? ''),
        'last_name' => strtoupper($certificationData['last_name'] ?? $certificationData['lastname'] ?? ''),
        'address' => strtoupper($certificationData['address'] ?? ''),
        'birth_date' => formatDateToCaps($certificationData['birth_date'] ?? $certificationData['birthday'] ?? ''),
        'birth_place' => strtoupper($certificationData['birth_place'] ?? $certificationData['birthplace'] ?? ''),
        'gender' => strtoupper($certificationData['gender'] ?? ''),
        'citizenship' => strtoupper($certificationData['citizenship'] ?? 'FILIPINO'),
        'civil_status' => strtoupper($certificationData['civil_status'] ?? $certificationData['civilStatus'] ?? ''),
    ];
    
    // Prepare data based on purpose
    $data = $baseData;
    // Use ordinal format for certification date_issued (26th day of October, 2025)
    $data['date_issued'] = formatDateWithOrdinal(date('Y-m-d'));
    
    // Add Trial Court if provided
    if ($purpose === 'certification-for-bail') {
        $data['Trial_Court'] = strtoupper($trial_court);
    }
    
    // Handle additional fields for specific certification types
    if ($purpose === 'proof-of-residency') {
        $data['start_year'] = $certificationData['start_year'] ?? $certificationData['startYear'] ?? '';
    } elseif ($purpose === 'pag-ibig loan' || $purpose === 'pag-ibig-loan') {
        // Get job_position from database - handle all possible column name variations
        $jobPosition = '';
        if (isset($certificationData['job_position'])) $jobPosition = $certificationData['job_position'];
        elseif (isset($certificationData['jobPosition'])) $jobPosition = $certificationData['jobPosition'];
        elseif (isset($certificationData['jobposition'])) $jobPosition = $certificationData['jobposition'];
        elseif (isset($certificationData['Job_Position'])) $jobPosition = $certificationData['Job_Position'];
        $data['job_position'] = strtoupper($jobPosition);
        error_log("Job position value: {$data['job_position']}");
        // Format start_of_work as normal date (April 13, 2022)
        $startOfWork = $certificationData['start_of_work'] ?? $certificationData['startOfWork'] ?? $certificationData['startofwork'] ?? '';
        $data['start_of_work'] = formatDateNormal($startOfWork);
        $monthlyIncome = $certificationData['monthly_income'] ?? $certificationData['monthlyIncome'] ?? $certificationData['monthlyincome'] ?? '0';
        $incomeAmount = intval($monthlyIncome);
        // Format with commas for monthly_income (12,000)
        $data['monthly_income'] = number_format($incomeAmount);
        $data['amount_in_words'] = numberToWords($incomeAmount);
        error_log("PAG-IBIG LOAN DATA - job_position: {$data['job_position']}, start_of_work: {$data['start_of_work']}, monthly_income: {$data['monthly_income']}, amount_in_words: {$data['amount_in_words']}");
    } elseif ($purpose === 'certification-for-dead') {
        $data['month_year'] = $certificationData['month_year'] ?? $certificationData['monthYear'] ?? '';
    }
    
    error_log("Generating document...");
    // Generate document with purpose-based template
    $outputPath = generateCertificationDocument($data, $purpose);
    
    if ($outputPath && file_exists($outputPath)) {
        error_log("Document generated successfully: $outputPath");
        
        // Don't update to Finished here - status will be updated when Ready to Receive is clicked
        
        // Clear any output buffer content
        ob_clean();
        
        echo json_encode([
            'success' => true,
            'message' => 'Certification document generated successfully',
            'download_url' => 'uploads/generated_documents/certification/' . basename($outputPath)
        ]);
    } else {
        throw new Exception('Failed to generate certification document');
    }
    
} catch (Exception $e) {
    error_log("generateCertificationDocument Error: " . $e->getMessage());
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
    error_log("=== CERTIFICATION GENERATION END ===");
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
 * Format date to normal format (April 13, 2022)
 */
function formatDateNormal($dateString) {
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
        
        $month = $monthNames[(int)$date->format('n')];
        $day = $date->format('j');
        $year = $date->format('Y');
        
        return "$month $day, $year";
    } catch (Exception $e) {
        error_log("Date formatting error: " . $e->getMessage());
        return $dateString;
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
 * Convert number to words (PESOS) - handles up to millions
 */
function numberToWords($number) {
    $ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    $tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    $teens = ['TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    
    $number = (int)$number;
    
    if ($number == 0) {
        return 'ZERO';
    }
    
    if ($number < 20) {
        return $number < 10 ? $ones[$number] : $teens[$number - 10];
    } elseif ($number < 100) {
        $tensDigit = floor($number / 10);
        $onesDigit = $number % 10;
        return $tens[$tensDigit] . ($onesDigit > 0 ? ' ' . $ones[$onesDigit] : '');
    } elseif ($number < 1000) {
        $hundreds = floor($number / 100);
        $remainder = $number % 100;
        return $ones[$hundreds] . ' HUNDRED' . ($remainder > 0 ? ' ' . numberToWords($remainder) : '');
    } elseif ($number < 1000000) {
        $thousands = floor($number / 1000);
        $remainder = $number % 1000;
        return numberToWords($thousands) . ' THOUSAND' . ($remainder > 0 ? ' ' . numberToWords($remainder) : '');
    } elseif ($number < 1000000000) {
        $millions = floor($number / 1000000);
        $remainder = $number % 1000000;
        return numberToWords($millions) . ' MILLION' . ($remainder > 0 ? ' ' . numberToWords($remainder) : '');
    }
    
    return 'TOO LARGE';
}

/**
 * Generate certification document using template
 */
function generateCertificationDocument($data, $purpose) {
    try {
        error_log("Starting document generation...");
        error_log("Purpose: $purpose");
        
        // Determine template path based on purpose
        $templatePath = '';
        switch($purpose) {
            case 'proof-of-residency':
                $templatePath = '../brgy_forms/certification/PROOF_OF_RESIDENCY.docx';
                break;
            case 'pag-ibig-loan':
            case 'pag-ibig loan':
                $templatePath = '../brgy_forms/certification/CERTIFICATION_PAG_IBIG_LOAN.docx';
                break;
            case 'certification-for-dead':
                $templatePath = '../brgy_forms/certification/certification_for_dead.docx';
                break;
            case 'barangay-financial-assistance':
                // Use PROOF_OF_RESIDENCY as template for barangay financial assistance
                $templatePath = '../brgy_forms/certification/PROOF_OF_RESIDENCY.docx';
                break;
            default:
                // Use PROOF_OF_RESIDENCY as default template
                $templatePath = '../brgy_forms/certification/PROOF_OF_RESIDENCY.docx';
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
        
        // Create output directory if it doesn't exist
        $outputDir = '../uploads/generated_documents/certification';
        error_log("Output directory: $outputDir");
        
        if (!is_dir($outputDir)) {
            error_log("Creating output directory...");
            if (!mkdir($outputDir, 0755, true)) {
                throw new Exception("Failed to create output directory: $outputDir");
            }
        }
        
        // Generate unique filename based on purpose
        $timestamp = date('Y-m-d_H-i-s');
        
        // Create purpose-specific filename prefix
        $filenamePrefix = strtoupper(str_replace([' ', '-'], '_', $purpose));
        if (empty($filenamePrefix)) {
            $filenamePrefix = "CERTIFICATION";
        }
        
        $filename = $filenamePrefix . "_" . $data['last_name'] . "_" . $timestamp . ".docx";
        $outputPath = $outputDir . '/' . $filename;
        
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
        
        return $outputPath;
        
    } catch (Exception $e) {
        error_log("generateCertificationDocument function error: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        throw new Exception("Failed to generate certification document: " . $e->getMessage());
    }
}
?>

