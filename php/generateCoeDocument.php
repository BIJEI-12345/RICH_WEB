<?php
// COE Document Generation
error_reporting(0);
ini_set('display_errors', 0);

// Include PhpWord for proper document handling
try {
    require_once __DIR__ . '/../vendor/autoload.php';
    error_log("generateCoeDocument: PhpWord loaded successfully");
} catch (Exception $e) {
    error_log("generateCoeDocument: PhpWord loading failed: " . $e->getMessage());
}

use PhpOffice\PhpWord\TemplateProcessor;

// Function to convert number to words
function numberToWords($number) {
    $ones = array(
        0 => 'Zero', 1 => 'One', 2 => 'Two', 3 => 'Three', 4 => 'Four',
        5 => 'Five', 6 => 'Six', 7 => 'Seven', 8 => 'Eight', 9 => 'Nine',
        10 => 'Ten', 11 => 'Eleven', 12 => 'Twelve', 13 => 'Thirteen', 14 => 'Fourteen',
        15 => 'Fifteen', 16 => 'Sixteen', 17 => 'Seventeen', 18 => 'Eighteen', 19 => 'Nineteen'
    );
    
    $tens = array(
        20 => 'Twenty', 30 => 'Thirty', 40 => 'Forty', 50 => 'Fifty',
        60 => 'Sixty', 70 => 'Seventy', 80 => 'Eighty', 90 => 'Ninety'
    );
    
    $thousands = array('', 'Thousand', 'Million', 'Billion');
    
    if ($number == 0) {
        return 'Zero';
    }
    
    $number = (int)$number;
    $result = '';
    $thousandIndex = 0;
    
    while ($number > 0) {
        $group = $number % 1000;
        if ($group != 0) {
            $groupWords = convertGroup($group, $ones, $tens);
            if ($thousandIndex > 0) {
                $groupWords .= ' ' . $thousands[$thousandIndex];
            }
            $result = $groupWords . ' ' . $result;
        }
        $number = intval($number / 1000);
        $thousandIndex++;
    }
    
    return trim($result);
}

function convertGroup($number, $ones, $tens) {
    $result = '';
    
    $hundreds = intval($number / 100);
    $remainder = $number % 100;
    
    if ($hundreds > 0) {
        $result .= $ones[$hundreds] . ' Hundred';
        if ($remainder > 0) {
            $result .= ' ';
        }
    }
    
    if ($remainder >= 20) {
        $tensDigit = intval($remainder / 10) * 10;
        $onesDigit = $remainder % 10;
        $result .= $tens[$tensDigit];
        if ($onesDigit > 0) {
            $result .= ' ' . $ones[$onesDigit];
        }
    } elseif ($remainder > 0) {
        $result .= $ones[$remainder];
    }
    
    return $result;
}

// Function to format date with proper ordinal suffix (plain text for now)
function formatIssuedDate($timestamp = null) {
    $timestamp = $timestamp ?? time();
    
    // English format: "13rd day of October 2025" (plain text)
    $day = date('j', $timestamp); // Day without leading zero
    $suffix = 'th';
    
    if (!in_array($day % 100, [11, 12, 13])) {
        switch ($day % 10) {
            case 1: $suffix = 'st'; break;
            case 2: $suffix = 'nd'; break;
            case 3: $suffix = 'rd'; break;
        }
    }

    $month = date('F', $timestamp);
    $year = date('Y', $timestamp);

    return sprintf("%d%s day of %s %d", $day, $suffix, $month, $year);
}

// Function to get ordinal suffix for a number
function getOrdinalSuffix($number) {
    $suffix = 'th';
    
    if (!in_array($number % 100, [11, 12, 13])) {
        switch ($number % 10) {
            case 1: $suffix = 'st'; break;
            case 2: $suffix = 'nd'; break;
            case 3: $suffix = 'rd'; break;
        }
    }
    
    return $suffix;
}

// Start output buffering to catch any unexpected output
ob_start();

require_once 'config.php';

header('Content-Type: application/json');

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

// Function to populate Word document template using PhpWord TemplateProcessor (like Barangay ID)
function populateWordTemplate($templatePath, $outputPath, $data) {
    try {
        error_log("Starting COE Word template processing with PhpWord TemplateProcessor");
        error_log("Template path: " . $templatePath);
        error_log("Output path: " . $outputPath);
        
        // Check if template file exists
        if (!file_exists($templatePath)) {
            error_log("Template file not found: " . $templatePath);
            throw new Exception("Template file not found: " . $templatePath);
        }
        
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
        $template = new TemplateProcessor($tempTemplatePath);
        
        // Prepare data for replacement
        $fullName = trim($data['first_name'] . ' ' . $data['middle_name'] . ' ' . $data['last_name']);
        $address = $data['address'] ?? 'NO ADDRESS PROVIDED';
        $employmentType = $data['employment_type'] ?? 'NOT SPECIFIED';
        $position = $data['position'] ?? 'NOT SPECIFIED';
        $monthlySalary = $data['monthly_salary'] ?? '0';
        
        // Convert salary to words
        $amountInWords = numberToWords($monthlySalary) . ' Pesos';
        
        // Format salary with peso sign and amount in words in parentheses
        $formattedSalary = '₱ ' . number_format($monthlySalary, 2) . '(' . $amountInWords . ')';
        
        // Format date started
        $dateStarted = 'NOT PROVIDED';
        if ($data['date_started']) {
            try {
                $date = new DateTime($data['date_started']);
                $dateStarted = $date->format('F j, Y');
            } catch (Exception $e) {
                $dateStarted = $data['date_started'];
            }
        }
        
        // Current date
        $currentDate = new DateTime();
        $day = $currentDate->format('j');
        $month = $currentDate->format('F');
        $year = $currentDate->format('Y');
        
        // Create date with ordinal suffix
        $ordinalDay = getOrdinalSuffix($day);
        $dateIssued = "{$day}{$ordinalDay} day of {$month} {$year}";
        
        // Replace all placeholders using TemplateProcessor
        $templateData = [
            'first_name' => strtoupper($data['first_name'] ?? ''),
            'middle_name' => strtoupper($data['middle_name'] ?? ''),
            'last_name' => strtoupper($data['last_name'] ?? ''),
            'first_name middle_name last_name' => strtoupper($fullName),
            'FULL_NAME' => strtoupper($fullName),
            'NAME' => strtoupper($fullName),
            'EMPLOYEE_NAME' => strtoupper($fullName),
            'address' => ucwords(strtolower($address)),
            'ADDRESS' => ucwords(strtolower($address)),
            'EMPLOYEE_ADDRESS' => ucwords(strtolower($address)),
            'employment_type' => ucwords(str_replace('_', '-', strtolower($employmentType))),
            'EMPLOYMENT_TYPE' => ucwords(str_replace('_', '-', strtolower($employmentType))),
            'position' => ucwords(strtolower($position)),
            'POSITION' => ucwords(strtolower($position)),
            'JOB_POSITION' => ucwords(strtolower($position)),
            'date_started' => ucwords(strtolower($dateStarted)),
            'DATE_STARTED' => ucwords(strtolower($dateStarted)),
            'START_DATE' => ucwords(strtolower($dateStarted)),
            'monthly_salary' => $formattedSalary,
            'MONTHLY_SALARY' => $formattedSalary,
            'SALARY' => $formattedSalary,
            '(amount_in_words)' => '',
            'AMOUNT_IN_WORDS' => '',
            'SALARY_IN_WORDS' => '',
            'date_issued' => $dateIssued,
            'DATE_ISSUED' => $dateIssued,
            'ISSUED_DATE' => $dateIssued,
            'current_date' => ucwords(strtolower($currentDate->format('F j, Y'))),
            'CURRENT_DATE' => ucwords(strtolower($currentDate->format('F j, Y'))),
            'TODAY' => ucwords(strtolower($currentDate->format('F j, Y'))),
            'OFFICIAL_NAME' => 'ROSEMARIE M. CAPA',
            'PUNONG_BARANGAY' => 'ROSEMARIE M. CAPA',
            'BARANGAY_CAPTAIN' => 'ROSEMARIE M. CAPA',
            'BARANGAY_NAME' => 'BIGTE',
            'BARANGAY' => 'BIGTE',
            'BARANGAY_BIGTE' => 'BARANGAY BIGTE'
        ];
        
        // Set all values
        foreach ($templateData as $key => $value) {
            try {
                $template->setValue($key, $value !== null && $value !== '' ? (string)$value : '');
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
        
        error_log("COE Word document processed successfully with PhpWord TemplateProcessor");
        return true;
        
    } catch (Exception $e) {
        error_log("Error in populateWordTemplate: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        throw $e;
    }
}

// Function to process Word document with placeholder replacement
function processWordDocument($templatePath, $outputPath, $placeholders) {
    try {
        error_log("Processing COE Word document with ZipArchive method");
        
        // Create a temporary directory for extraction
        $tempDir = sys_get_temp_dir() . '/word_process_' . uniqid();
        if (!mkdir($tempDir, 0777, true)) {
            error_log("Failed to create temporary directory: " . $tempDir);
            return false;
        }
        
        // Copy template to temp directory
        $tempTemplate = $tempDir . '/template.docx';
        if (!copy($templatePath, $tempTemplate)) {
            error_log("Failed to copy template to temp directory");
            removeDirectory($tempDir);
            return false;
        }
        
        // Extract the DOCX file (it's a ZIP file)
        $zip = new ZipArchive();
        if ($zip->open($tempTemplate) === TRUE) {
            $zip->extractTo($tempDir);
            $zip->close();
            
            // Find and process document.xml
            $documentXmlPath = $tempDir . '/word/document.xml';
            if (file_exists($documentXmlPath)) {
                $xmlContent = file_get_contents($documentXmlPath);
                
                // Replace placeholders in XML content using a comprehensive approach
                // Step 1: Handle simple placeholders first
                foreach ($placeholders as $placeholder => $value) {
                    $xmlContent = str_replace($placeholder, htmlspecialchars($value), $xmlContent);
                }
                
                // Step 2: Handle XML-embedded placeholders using multiple strategies
                
                // Strategy 1: Direct regex replacement for simple placeholders
                $simplePlaceholders = ['first_name', 'middle_name', 'last_name', 'address', 'employment_type', 'position', 'date_started', 'monthly_salary', '(amount_in_words)', 'date_issued'];
                foreach ($simplePlaceholders as $placeholder) {
                    $pattern = '/\{\{' . preg_quote($placeholder, '/') . '\}\}/';
                    $replacement = htmlspecialchars($placeholders['{{' . $placeholder . '}}']);
                    $xmlContent = preg_replace($pattern, $replacement, $xmlContent);
                }
                
                // Strategy 2: Handle placeholders that are split across XML tags
                $xmlContent = preg_replace_callback('/\{\{([^}]+)\}\}/', function($matches) use ($placeholders) {
                    $placeholderKey = '{{' . $matches[1] . '}}';
                    if (isset($placeholders[$placeholderKey])) {
                        return htmlspecialchars($placeholders[$placeholderKey]);
                    }
                    return $matches[0];
                }, $xmlContent);
                
                // Strategy 3: More aggressive replacement for XML-embedded placeholders
                $xmlContent = preg_replace_callback('/\{\{([^<{}]*?)\}\}/', function($matches) use ($placeholders) {
                    $placeholderKey = '{{' . $matches[1] . '}}';
                    if (isset($placeholders[$placeholderKey])) {
                        return htmlspecialchars($placeholders[$placeholderKey]);
                    }
                    return $matches[0];
                }, $xmlContent);
                
                // Strategy 4: Handle the most complex XML-embedded placeholders
                $complexReplacements = [
                    '{{first_name}}' => htmlspecialchars($placeholders['{{first_name}}']),
                    '{{middle_name}}' => htmlspecialchars($placeholders['{{middle_name}}']),
                    '{{last_name}}' => htmlspecialchars($placeholders['{{last_name}}']),
                    '{{address}}' => htmlspecialchars($placeholders['{{address}}']),
                    '{{employment_type}}' => htmlspecialchars($placeholders['{{employment_type}}']),
                    '{{position}}' => htmlspecialchars($placeholders['{{position}}']),
                    '{{date_started}}' => htmlspecialchars($placeholders['{{date_started}}']),
                    '{{monthly_salary}}' => htmlspecialchars($placeholders['{{monthly_salary}}']),
                    '{{(amount_in_words)}}' => htmlspecialchars($placeholders['{{(amount_in_words)}}']),
                    '{{date_issued}}' => $placeholders['{{date_issued}}'] // Don't escape HTML for date_issued to preserve XML
                ];
                
                // Apply replacements multiple times with different approaches
                for ($i = 0; $i < 5; $i++) {
                    foreach ($complexReplacements as $search => $replace) {
                        // Direct string replacement
                        $xmlContent = str_replace($search, $replace, $xmlContent);
                        
                        // Regex replacement
                        $pattern = '/' . preg_quote($search, '/') . '/';
                        $xmlContent = preg_replace($pattern, $replace, $xmlContent);
                    }
                }
                
                // Final aggressive replacement for any remaining placeholders
                $xmlContent = str_replace('{{first_name}}', htmlspecialchars($placeholders['{{first_name}}']), $xmlContent);
                $xmlContent = str_replace('{{middle_name}}', htmlspecialchars($placeholders['{{middle_name}}']), $xmlContent);
                $xmlContent = str_replace('{{last_name}}', htmlspecialchars($placeholders['{{last_name}}']), $xmlContent);
                $xmlContent = str_replace('{{address}}', htmlspecialchars($placeholders['{{address}}']), $xmlContent);
                $xmlContent = str_replace('{{employment_type}}', htmlspecialchars($placeholders['{{employment_type}}']), $xmlContent);
                $xmlContent = str_replace('{{position}}', htmlspecialchars($placeholders['{{position}}']), $xmlContent);
                $xmlContent = str_replace('{{date_started}}', htmlspecialchars($placeholders['{{date_started}}']), $xmlContent);
                $xmlContent = str_replace('{{monthly_salary}}', htmlspecialchars($placeholders['{{monthly_salary}}']), $xmlContent);
                $xmlContent = str_replace('{{(amount_in_words)}}', htmlspecialchars($placeholders['{{(amount_in_words)}}']), $xmlContent);
                $xmlContent = str_replace('{{date_issued}}', $placeholders['{{date_issued}}'], $xmlContent); // Don't escape to preserve XML
                
                // Save the modified XML
                file_put_contents($documentXmlPath, $xmlContent);
                
                // Recreate the DOCX file
                $zip = new ZipArchive();
                if ($zip->open($outputPath, ZipArchive::CREATE) === TRUE) {
                    // Add all files from temp directory
                    $files = new RecursiveIteratorIterator(
                        new RecursiveDirectoryIterator($tempDir),
                        RecursiveIteratorIterator::LEAVES_ONLY
                    );
                    
                    foreach ($files as $name => $file) {
                        if (!$file->isDir()) {
                            $filePath = $file->getRealPath();
                            $relativePath = substr($filePath, strlen($tempDir) + 1);
                            $zip->addFile($filePath, $relativePath);
                        }
                    }
                    
                    $zip->close();
                    
                    // Clean up temp directory
                    removeDirectory($tempDir);
                    
                    error_log("COE Word document processed successfully with placeholder replacement using ZipArchive");
                    return true;
                } else {
                    error_log("Failed to create output ZIP file");
                    removeDirectory($tempDir);
                    return false;
                }
            } else {
                error_log("document.xml not found in extracted files");
                removeDirectory($tempDir);
                return false;
            }
        } else {
            error_log("Failed to open template as ZIP file");
            removeDirectory($tempDir);
            return false;
        }
        
    } catch (Exception $e) {
        error_log("Error in processWordDocument: " . $e->getMessage());
        if (isset($tempDir) && is_dir($tempDir)) {
            removeDirectory($tempDir);
        }
        return false;
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

try {
    // Get request ID from POST data
    $requestId = $_POST['requestId'] ?? null;
    
    // Debug logging
    error_log("generateCoeDocument: Received requestId: " . $requestId);
    
    if (!$requestId) {
        throw new Exception('Request ID is required');
    }
    
    // Database connection
    $connection = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    
    if ($connection->connect_error) {
        throw new Exception("Connection failed: " . $connection->connect_error);
    }

    $connection->set_charset('utf8mb4');
    
    // Try different possible table names for COE
    $possibleTables = ['coe_forms'];
    $row = null;
    $usedTable = '';
    
    foreach ($possibleTables as $table) {
        $sql = "SELECT id, first_name, middle_name, last_name, address, age, gender, civil_status, employment_type, position, date_started, monthly_salary, valid_id, id_image, status, submitted_at FROM $table WHERE id = ?";
        
        $stmt = $connection->prepare($sql);
        if ($stmt) {
            $stmt->bind_param("i", $requestId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows > 0) {
                $row = $result->fetch_assoc();
                $usedTable = $table;
                $stmt->close();
                error_log("generateCoeDocument: Found data in table: $table");
                break;
            }
            $stmt->close();
        } else {
            error_log("generateCoeDocument: Table $table not found or error: " . $connection->error);
        }
    }
    
    if (!$row) {
        error_log("generateCoeDocument: No COE data found for ID: $requestId");
        throw new Exception("Request not found for ID: " . $requestId);
    }
    
    // Prepare data for document population
    $data = [
        'id' => $row['id'] ?? '',
        'first_name' => $row['first_name'] ?? '',
        'middle_name' => $row['middle_name'] ?? '',
        'last_name' => $row['last_name'] ?? '',
        'address' => $row['address'] ?? '',
        'age' => $row['age'] ?? '',
        'gender' => $row['gender'] ?? '',
        'civilStatus' => $row['civil_status'] ?? '',
        'employment_type' => $row['employment_type'] ?? '',
        'position' => $row['position'] ?? '',
        'date_started' => $row['date_started'] ?? '',
        'monthly_salary' => $row['monthly_salary'] ?? '0',
        'validId' => $row['valid_id'] ?? '',
        'idImage' => safeImageData($row['id_image']),
        'status' => $row['status'] ?? 'New',
        'submittedAt' => $row['submitted_at'] ?? date('Y-m-d H:i:s')
    ];
    
    // Generate the document file
    $templatePath = '../brgy_forms/coe/coe.docx';
    $outputPath = '../uploads/generated_documents/';
    
    // Create output directory if it doesn't exist
    if (!file_exists($outputPath)) {
        mkdir($outputPath, 0777, true);
    }
    
    // Generate unique filename
    $fullName = trim($data['first_name'] . ' ' . $data['middle_name'] . ' ' . $data['last_name']);
    $filename = 'COE_' . preg_replace('/[^a-zA-Z0-9_]/', '_', $data['last_name']) . '_' . preg_replace('/[^a-zA-Z0-9_]/', '_', $data['first_name']) . '_' . date('Ymd_His') . '.docx';
    $fullOutputPath = $outputPath . $filename;
    
    // Check if template exists
    if (!file_exists($templatePath)) {
        error_log("Template file not found at: " . $templatePath);
        throw new Exception('COE template not found at: ' . $templatePath);
    }
    
    error_log("Template found at: " . $templatePath);
    error_log("Output path: " . $fullOutputPath);
    
    // Populate the template with actual data
    try {
        $success = populateWordTemplate($templatePath, $fullOutputPath, $data);
    } catch (Exception $e) {
        error_log("generateCoeDocument: Error populating template: " . $e->getMessage());
        throw new Exception("Failed to populate template: " . $e->getMessage());
    }
    
    if ($success) {
        // Update the request status to Processing and set process_at datetime (using PHP timezone)
        $currentTime = date('Y-m-d H:i:s');
        $updateSql = "UPDATE $usedTable SET status = 'Processing', process_at = ? WHERE id = ?";
        $updateStmt = $connection->prepare($updateSql);
        if (!$updateStmt) {
            error_log("Failed to prepare update statement: " . $connection->error);
            throw new Exception("Failed to prepare update statement: " . $connection->error);
        }
        
        $updateStmt->bind_param("si", $currentTime, $requestId);
        if (!$updateStmt->execute()) {
            error_log("Failed to execute update statement: " . $updateStmt->error);
            throw new Exception("Failed to execute update statement: " . $updateStmt->error);
        }
        
        $updateStmt->close();
        $connection->close();
        
        error_log("COE Document generated successfully: " . $filename);
        
        // Clear any unexpected output and send JSON response
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'message' => 'Certificate of Employment generated successfully with personal details',
            'filename' => $filename,
            'downloadUrl' => 'uploads/generated_documents/' . $filename,
            'data' => $data
        ]);
    } else {
        throw new Exception('Failed to generate document');
    }
    
} catch (Exception $e) {
    // Clear any unexpected output and send error response
    ob_clean();
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
    exit;
}
?>
