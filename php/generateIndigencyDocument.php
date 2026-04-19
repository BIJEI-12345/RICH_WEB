<?php
// Indigency Document Generation
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Function to format date with proper ordinal suffix
function formatIssuedDate($timestamp = null, $language = 'english') {
    $timestamp = $timestamp ?? time();
    
    if ($language === 'tagalog') {
        // Tagalog format: "ika-22 ng Oktubre taong 2025"
        $day = date('j', $timestamp);
        $year = date('Y', $timestamp);
        $monthNamesTagalog = [
            'Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo',
            'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'
        ];
        $month = $monthNamesTagalog[date('n', $timestamp) - 1];
        
        return sprintf("ika-%d ng %s taong %d", $day, $month, $year);
    } else {
        // English format: "22nd day of October 2025"
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
}

// Start output buffering to catch any unexpected output
ob_start();

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/generated_document_temp.php';

// Fatal errors often yield HTTP 500 with an empty body; surface JSON for the client
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err === null || !in_array((int) $err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    while (ob_get_level() > 0) {
        @ob_end_clean();
    }
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
    }
    echo json_encode([
        'success' => false,
        'error' => $err['message'] . ' (' . basename($err['file']) . ':' . $err['line'] . ')',
        'debug_info' => [
            'file' => $err['file'],
            'line' => $err['line'],
            'type' => $err['type'],
        ],
    ], JSON_UNESCAPED_UNICODE);
});

// PhpWord (Composer): vendor must contain phpoffice/phpword — run `composer install` if TemplateProcessor is missing
require_once __DIR__ . '/../vendor/autoload.php';
if (!class_exists(\PhpOffice\PhpWord\TemplateProcessor::class)) {
    while (ob_get_level() > 0) {
        @ob_end_clean();
    }
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'PHPWord is not installed correctly. Open a terminal in the project folder and run: composer install',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

use PhpOffice\PhpWord\TemplateProcessor;

header('Content-Type: application/json; charset=utf-8');

/**
 * Hinati ang halaga ng column `position` ("MAYOR / TL", o maraming "|" — EN = unang segment, TL = huli).
 * @return array{en: string, tl: string}
 */
function indigencySplitPositionEnTl(string $raw): array
{
    $s = trim(preg_replace('/\s+/u', ' ', $raw));
    if ($s === '') {
        return ['en' => '', 'tl' => ''];
    }
    if (strpos($s, '|') !== false) {
        $segments = preg_split('/\s*\|\s*/u', $s);
        $segments = array_values(array_filter(array_map('trim', $segments), static function ($p) {
            return $p !== '';
        }));
        if (count($segments) >= 2) {
            $tl = $segments[count($segments) - 1];
            $first = $segments[0];
            $en = $first;
            if (strpos($first, '/') !== false) {
                $en = trim(explode('/', $first, 2)[0]);
            }

            return ['en' => $en, 'tl' => $tl];
        }
    }
    if (preg_match('#\s/\s#u', $s)) {
        $parts = preg_split('#\s/\s#u', $s, 2);

        return ['en' => trim($parts[0]), 'tl' => isset($parts[1]) ? trim($parts[1]) : ''];
    }

    return ['en' => $s, 'tl' => ''];
}

/** Isang value lang para sa {{position}} depende sa wika ng dokumento. */
function indigencyResolvePositionForLanguage(string $raw, string $language): string
{
    $sp = indigencySplitPositionEnTl($raw);
    if ($language === 'tagalog') {
        return $sp['tl'] !== '' ? $sp['tl'] : $sp['en'];
    }

    return $sp['en'] !== '' ? $sp['en'] : $sp['tl'];
}

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

/**
 * Convert {{name}} to ${name} in all main Word XML parts so PhpWord can merge macros.
 * Also covers headers/footers/notes, not only document.xml.
 */
function indigencyPatchDocxDoubleBracesToDollarMacros($docxPath) {
    $zip = new ZipArchive();
    if ($zip->open($docxPath) !== true) {
        throw new Exception('Cannot open Word document as ZIP for placeholder normalization');
    }
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = $zip->getNameIndex($i);
        if (!preg_match('#^word/(document\\.xml|header\\d+\\.xml|footer\\d+\\.xml|endnotes\\.xml|footnotes\\.xml)$#', $name)) {
            continue;
        }
        $xml = $zip->getFromIndex($i);
        if ($xml === false) {
            continue;
        }
        $updated = preg_replace('/\{\{([^}]+)\}\}/', '${$1}', $xml);
        if ($updated !== $xml) {
            $zip->addFromString($name, $updated);
        }
    }
    $zip->close();
}

/**
 * Final pass: replace any remaining {{key}} / ${key} in XML (handles split runs / editors that keep {{}}).
 */
function indigencyApplyDirectXmlPlaceholderReplacements($docxPath, array $templateData) {
    $keys = array_keys($templateData);
    usort($keys, function ($a, $b) {
        return strlen($b) - strlen($a);
    });
    $zip = new ZipArchive();
    if ($zip->open($docxPath) !== true) {
        error_log('indigencyApplyDirectXmlPlaceholderReplacements: could not open docx: ' . $docxPath);
        return;
    }
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = $zip->getNameIndex($i);
        if (!preg_match('#^word/(document\\.xml|header\\d+\\.xml|footer\\d+\\.xml|endnotes\\.xml|footnotes\\.xml)$#', $name)) {
            continue;
        }
        $xml = $zip->getFromIndex($i);
        if ($xml === false) {
            continue;
        }
        $orig = $xml;
        foreach ($keys as $key) {
            $value = $templateData[$key];
            $str = ($value !== null && $value !== '') ? (string)$value : '';
            $safe = htmlspecialchars($str, ENT_XML1 | ENT_QUOTES, 'UTF-8');
            $xml = str_replace('{{' . $key . '}}', $safe, $xml);
            $xml = str_replace('${' . $key . '}', $safe, $xml);
        }
        if ($xml !== $orig) {
            $zip->addFromString($name, $xml);
        }
    }
    $zip->close();
}

// Function to populate Word document template using PhpWord TemplateProcessor (like Barangay ID)
function populateWordTemplate($templatePath, $outputPath, $data, $language = 'english') {
    try {
        error_log("Starting Word template processing with PhpWord TemplateProcessor");
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

        indigencyPatchDocxDoubleBracesToDollarMacros($outputPath);
        
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
        $age = $data['age'] ?? 'NOT SPECIFIED';
        $address = $data['address'] ?? 'NO ADDRESS PROVIDED';
        $purpose = $data['purpose'] ?? 'NOT SPECIFIED';
        
        // Format birthday
        $birthday = 'NOT PROVIDED';
        if ($data['birthday']) {
            try {
                $date = new DateTime($data['birthday']);
                $birthday = $date->format('F j, Y');
            } catch (Exception $e) {
                $birthday = $data['birthday'];
            }
        }
        
        // Current date
        $currentDate = new DateTime();
        
        // Replace all placeholders using TemplateProcessor
        $templateData = [
            'first_name' => strtoupper($data['first_name'] ?? ''),
            'middle_name' => strtoupper($data['middle_name'] ?? ''),
            'last_name' => strtoupper($data['last_name'] ?? ''),
            'first_name middle_name last_name' => strtoupper($fullName),
            'FULL_NAME' => strtoupper($fullName),
            'NAME' => strtoupper($fullName),
            'RESIDENT_NAME' => strtoupper($fullName),
            'age' => strtoupper($age),
            'AGE' => strtoupper($age),
            'address' => strtoupper($address),
            'ADDRESS' => strtoupper($address),
            'RESIDENT_ADDRESS' => strtoupper($address),
            'purpose' => strtoupper($purpose),
            'PURPOSE' => strtoupper($purpose),
            'REASON' => strtoupper($purpose),
            '07th' => formatIssuedDate(null, $language),
            'date_issued' => formatIssuedDate(null, $language),
            'DAY' => date('j'),
            '2025' => date('Y'),
            'YEAR' => date('Y'),
            'CURRENT_YEAR' => date('Y'),
            'October' => date('F'),
            'MONTH' => date('F'),
            'Norzagaray' => 'Norzagaray',
            'NORZAGARAY' => 'NORZAGARAY',
            'LOCATION' => 'NORZAGARAY',
            'birthday' => strtoupper($birthday),
            'BIRTHDAY' => strtoupper($birthday),
            'BIRTH_DATE' => strtoupper($birthday),
            'gender' => strtoupper($data['gender'] ?? 'NOT SPECIFIED'),
            'GENDER' => strtoupper($data['gender'] ?? 'NOT SPECIFIED'),
            'civil_status' => strtoupper($data['civilStatus'] ?? 'NOT SPECIFIED'),
            'CIVIL_STATUS' => strtoupper($data['civilStatus'] ?? 'NOT SPECIFIED'),
            'birthplace' => strtoupper($data['birthplace'] ?? 'NOT SPECIFIED'),
            'BIRTHPLACE' => strtoupper($data['birthplace'] ?? 'NOT SPECIFIED'),
            'BIRTH_PLACE' => strtoupper($data['birthplace'] ?? 'NOT SPECIFIED'),
            'current_date' => strtoupper($currentDate->format('F j, Y')),
            'CURRENT_DATE' => strtoupper($currentDate->format('F j, Y')),
            'DATE_ISSUED' => strtoupper($currentDate->format('F j, Y')),
            'TODAY' => strtoupper($currentDate->format('F j, Y')),
            'OFFICIAL_NAME' => 'ROSEMARIE M. CAPA',
            'PUNONG_BARANGAY' => 'ROSEMARIE M. CAPA',
            'BARANGAY_CAPTAIN' => 'ROSEMARIE M. CAPA',
            'BARANGAY_NAME' => 'BIGTE',
            'BARANGAY' => 'BIGTE',
            'BARANGAY_BIGTE' => 'BARANGAY BIGTE',
            'para_kay' => strtoupper((string)($data['para_kay'] ?? '')),
            'position' => strtoupper(indigencyResolvePositionForLanguage((string)($data['position'] ?? ''), $language)),
            'hall_address' => strtoupper((string)($data['hall_address'] ?? '')),
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

        indigencyApplyDirectXmlPlaceholderReplacements($outputPath, $templateData);
        
        // Clean up temporary file
        if (file_exists($tempTemplatePath)) {
            unlink($tempTemplatePath);
        }
        
        error_log("Word document processed successfully with PhpWord TemplateProcessor");
        return true;
        
    } catch (Throwable $e) {
        error_log("Error in populateWordTemplate: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        throw $e;
    }
}

// Function to process Word document with placeholder replacement
function processWordDocument($templatePath, $outputPath, $placeholders) {
    try {
        error_log("Processing Word document with ZipArchive method");
        
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
                    
                    // Debug: Check if date_issued placeholder exists in XML
                    if (strpos($xmlContent, '{{date_issued}}') !== false) {
                        error_log("Found {{date_issued}} placeholder in XML");
                    } else {
                        error_log("{{date_issued}} placeholder NOT found in XML");
                        // Let's check for variations
                        if (strpos($xmlContent, 'date_issued') !== false) {
                            error_log("Found 'date_issued' text in XML (without braces)");
                        }
                        if (strpos($xmlContent, 'date') !== false) {
                            error_log("Found 'date' text in XML");
                        }
                    }
                    
                    // Debug: Log the date value being generated
                    error_log("Generated date_issued value: " . $placeholders['{{date_issued}}']);
                    
                    // Replace placeholders in XML content using a comprehensive approach
                    // The placeholders are embedded within complex XML formatting tags
                
                // Step 1: Handle simple placeholders first
                foreach ($placeholders as $placeholder => $value) {
                    $xmlContent = str_replace($placeholder, htmlspecialchars($value), $xmlContent);
                }
                
                // Debug: Check if date_issued was replaced in Step 1
                if (strpos($xmlContent, '{{date_issued}}') === false) {
                    error_log("Step 1: {{date_issued}} placeholder successfully replaced");
                } else {
                    error_log("Step 1: {{date_issued}} placeholder still present");
                }
                
                // Step 2: Handle XML-embedded placeholders using multiple strategies
                
                // Strategy 1: Direct regex replacement for simple placeholders
                $simplePlaceholders = ['first_name', 'middle_name', 'last_name', 'age', 'address', 'purpose', 'date_issued'];
                foreach ($simplePlaceholders as $placeholder) {
                    $pattern = '/\{\{' . $placeholder . '\}\}/';
                    $replacement = htmlspecialchars($placeholders['{{' . $placeholder . '}}']);
                    $xmlContent = preg_replace($pattern, $replacement, $xmlContent);
                }
                
                // Strategy 2: Handle placeholders that are split across XML tags
                // This handles the complex case where placeholders are embedded in XML formatting
                $xmlContent = preg_replace_callback('/\{\{([^}]+)\}\}/', function($matches) use ($placeholders) {
                    $placeholderKey = '{{' . $matches[1] . '}}';
                    if (isset($placeholders[$placeholderKey])) {
                        return htmlspecialchars($placeholders[$placeholderKey]);
                    }
                    return $matches[0];
                }, $xmlContent);
                
                // Strategy 3: More aggressive replacement for XML-embedded placeholders
                // Handle cases where placeholders are split by XML tags
                $xmlContent = preg_replace_callback('/\{\{([^<{}]*?)\}\}/', function($matches) use ($placeholders) {
                    $placeholderKey = '{{' . $matches[1] . '}}';
                    if (isset($placeholders[$placeholderKey])) {
                        return htmlspecialchars($placeholders[$placeholderKey]);
                    }
                    return $matches[0];
                }, $xmlContent);
                
                // Strategy 4: Handle the most complex XML-embedded placeholders
                // These are placeholders that are completely embedded within XML formatting tags
                $complexReplacements = [
                    '{{first_name}}' => htmlspecialchars($placeholders['{{first_name}}']),
                    '{{middle_name}}' => htmlspecialchars($placeholders['{{middle_name}}']),
                    '{{last_name}}' => htmlspecialchars($placeholders['{{last_name}}']),
                    '{{age}}' => htmlspecialchars($placeholders['{{age}}']),
                    '{{address}}' => htmlspecialchars($placeholders['{{address}}']),
                    '{{purpose}}' => htmlspecialchars($placeholders['{{purpose}}']),
                    '{{date_issued}}' => htmlspecialchars($placeholders['{{date_issued}}'])
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
                
                // Strategy 5: Special handling for XML-embedded placeholders
                // These placeholders have very specific XML structures that need exact patterns
                
                // Handle first_name - exact pattern from debug
                $firstNameValue = htmlspecialchars($placeholders['{{first_name}}']);
                $xmlContent = preg_replace('/\{\{<\/w:t><\/w:r><w:r><w:rPr><w:rFonts w:hint="default" w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"\/><w:b\/><w:bCs\/><w:color w:val="000000"\/><w:sz w:val="24"\/><w:szCs w:val="24"\/><w:lang w:val="en-US"\/><\/w:rPr><w:t>first_name\}\}/', $firstNameValue, $xmlContent);
                $xmlContent = preg_replace('/\{\{first_name\}\}/', $firstNameValue, $xmlContent);
                
                // Handle middle_name - similar pattern
                $middleNameValue = htmlspecialchars($placeholders['{{middle_name}}']);
                $xmlContent = preg_replace('/\{\{<\/w:t><\/w:r><w:r><w:rPr><w:rFonts w:hint="default" w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"\/><w:b\/><w:bCs\/><w:color w:val="000000"\/><w:sz w:val="24"\/><w:szCs w:val="24"\/><w:lang w:val="en-US"\/><\/w:rPr><w:t>middle_name\}\}/', $middleNameValue, $xmlContent);
                $xmlContent = preg_replace('/\{\{middle_name\}\}/', $middleNameValue, $xmlContent);
                
                // Handle last_name - similar pattern
                $lastNameValue = htmlspecialchars($placeholders['{{last_name}}']);
                $xmlContent = preg_replace('/\{\{<\/w:t><\/w:r><w:r><w:rPr><w:rFonts w:hint="default" w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"\/><w:b\/><w:bCs\/><w:color w:val="000000"\/><w:sz w:val="24"\/><w:szCs w:val="24"\/><w:lang w:val="en-US"\/><\/w:rPr><w:t>last_name\}\}/', $lastNameValue, $xmlContent);
                $xmlContent = preg_replace('/\{\{last_name\}\}/', $lastNameValue, $xmlContent);
                
                // Additional aggressive replacement for last_name
                $xmlContent = str_replace('{{last_name}}', $lastNameValue, $xmlContent);
                $xmlContent = preg_replace('/\{\{[^}]*last_name[^}]*\}\}/', $lastNameValue, $xmlContent);
                $xmlContent = preg_replace('/last_name/', $lastNameValue, $xmlContent);
                
                // Handle address - this one is split across TWO w:t elements!
                $addressValue = htmlspecialchars($placeholders['{{address}}']);
                $xmlContent = preg_replace('/\{\{<\/w:t><\/w:r><w:r><w:rPr><w:rFonts w:hint="default" w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"\/><w:b\/><w:bCs\/><w:color w:val="000000"\/><w:sz w:val="24"\/><w:szCs w:val="24"\/><w:lang w:val="en-US"\/><\/w:rPr><w:t>address<\/w:t><\/w:r><w:r><w:rPr><w:rFonts w:hint="default" w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"\/><w:b\/><w:bCs\/><w:color w:val="000000"\/><w:sz w:val="24"\/><w:szCs w:val="24"\/><w:lang w:val="en-US"\/><\/w:rPr><w:t>\}\}/', $addressValue, $xmlContent);
                $xmlContent = preg_replace('/\{\{address\}\}/', $addressValue, $xmlContent);
                
                // Handle purpose - this one has a bookmark element!
                $purposeValue = htmlspecialchars($placeholders['{{purpose}}']);
                $xmlContent = preg_replace('/\{\{<\/w:t><\/w:r><w:bookmarkEnd w:id="0"\/><w:r><w:rPr><w:rFonts w:hint="default" w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"\/><w:b\/><w:bCs w:val="0"\/><w:color w:val="000000"\/><w:sz w:val="24"\/><w:szCs w:val="24"\/><w:lang w:val="en-US"\/><\/w:rPr><w:t>purpose\}\}/', $purposeValue, $xmlContent);
                $xmlContent = preg_replace('/\{\{purpose\}\}/', $purposeValue, $xmlContent);
                
                // Handle date_issued - add specific pattern handling
                $dateIssuedValue = htmlspecialchars($placeholders['{{date_issued}}']);
                error_log("Date issued value: " . $dateIssuedValue);
                $xmlContent = preg_replace('/\{\{date_issued\}\}/', $dateIssuedValue, $xmlContent);
                
                // Debug: Check if date_issued was replaced after specific handling
                if (strpos($xmlContent, '{{date_issued}}') === false) {
                    error_log("Specific date_issued handling: placeholder successfully replaced");
                } else {
                    error_log("Specific date_issued handling: placeholder still present");
                }
                
                // Additional fallback patterns for any remaining cases
                $fallbackPatterns = [
                    'first_name' => $firstNameValue,
                    'middle_name' => $middleNameValue,
                    'last_name' => $lastNameValue,
                    'address' => $addressValue,
                    'purpose' => $purposeValue,
                    'date_issued' => $dateIssuedValue
                ];
                
                foreach ($fallbackPatterns as $placeholder => $value) {
                    // Try to match any remaining patterns
                    $xmlContent = preg_replace('/\{\{[^}]*' . $placeholder . '[^}]*\}\}/', $value, $xmlContent);
                }
                
                // Final aggressive replacement for any remaining placeholders
                $xmlContent = str_replace('{{first_name}}', $firstNameValue, $xmlContent);
                $xmlContent = str_replace('{{middle_name}}', $middleNameValue, $xmlContent);
                $xmlContent = str_replace('{{last_name}}', $lastNameValue, $xmlContent);
                $xmlContent = str_replace('{{address}}', $addressValue, $xmlContent);
                $xmlContent = str_replace('{{purpose}}', $purposeValue, $xmlContent);
                $xmlContent = str_replace('{{date_issued}}', $dateIssuedValue, $xmlContent);
                
                // Log the replacements for debugging
                error_log("Placeholder replacements applied:");
                foreach ($complexReplacements as $search => $replace) {
                    error_log("  $search => $replace");
                }
                
                // Final debug check before saving
                if (strpos($xmlContent, '{{date_issued}}') === false) {
                    error_log("FINAL CHECK: {{date_issued}} placeholder successfully replaced");
                } else {
                    error_log("FINAL CHECK: {{date_issued}} placeholder STILL PRESENT - replacement failed");
                    // Let's try one more aggressive replacement
                    $xmlContent = str_replace('{{date_issued}}', $dateIssuedValue, $xmlContent);
                    error_log("Applied final aggressive replacement for {{date_issued}}");
                }
                
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
                    
                    error_log("Word document processed successfully with placeholder replacement using ZipArchive");
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
        
    } catch (Throwable $e) {
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
    // Get request ID and language from POST data
    $requestId = $_POST['requestId'] ?? null;
    $language = $_POST['language'] ?? 'english';
    
    // Debug logging
    error_log("generateIndigencyDocument: Received requestId: " . $requestId);
    error_log("generateIndigencyDocument: Received language: " . $language);
    
    if (!$requestId) {
        throw new Exception('Request ID is required');
    }
    
    // Validate language parameter
    if (!in_array($language, ['english', 'tagalog'])) {
        $language = 'english'; // Default to English if invalid
    }
    
    // Database connection
    $connection = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, (int) DB_PORT);
    
    if ($connection->connect_error) {
        throw new Exception("Connection failed: " . $connection->connect_error);
    }

    $connection->set_charset('utf8mb4');
    
    // Try different possible table names for indigency
    $possibleTables = ['indigency_forms'];
    $row = null;
    $usedTable = '';
    
    foreach ($possibleTables as $table) {
        $sql = "SELECT id, first_name, middle_name, last_name, address, birth_date, birth_place, civil_status, age, gender, purpose, valid_id, id_image, status, submitted_at, para_kay, `position`, hall_address, document_language FROM $table WHERE id = ?";
        
        $stmt = $connection->prepare($sql);
        if ($stmt) {
            $stmt->bind_param("i", $requestId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows > 0) {
                $row = $result->fetch_assoc();
                $usedTable = $table;
                $stmt->close();
                error_log("generateIndigencyDocument: Found data in table: $table");
                break;
            }
            $stmt->close();
        } else {
            error_log("generateIndigencyDocument: Table $table not found or error: " . $connection->error);
        }
    }
    
    if (!$row) {
        error_log("generateIndigencyDocument: No indigency data found for ID: $requestId");
        throw new Exception("Request not found for ID: " . $requestId);
    }
    
    // Prepare data for document population
    $data = [
        'id' => $row['id'] ?? '',
        'first_name' => $row['first_name'] ?? '',
        'middle_name' => $row['middle_name'] ?? '',
        'last_name' => $row['last_name'] ?? '',
        'birthday' => $row['birth_date'] ?? '',
        'birthplace' => $row['birth_place'] ?? '',
        'address' => $row['address'] ?? '',
        'civilStatus' => $row['civil_status'] ?? '',
        'age' => $row['age'] ?? '',
        'gender' => $row['gender'] ?? '',
        'purpose' => $row['purpose'] ?? '',
        'validId' => $row['valid_id'] ?? '',
        'idImage' => safeImageData($row['id_image']),
        'status' => $row['status'] ?? 'New',
        'submittedAt' => $row['submitted_at'] ?? date('Y-m-d H:i:s'),
        'para_kay' => $row['para_kay'] ?? '',
        'position' => $row['position'] ?? '',
        'hall_address' => $row['hall_address'] ?? '',
        'document_language' => $row['document_language'] ?? '',
    ];
    
    // Merge POST overrides (process form / API) when provided
    if (isset($_POST['para_kay'])) {
        $data['para_kay'] = trim((string)$_POST['para_kay']);
    }
    if (isset($_POST['position'])) {
        $data['position'] = trim((string)$_POST['position']);
    }
    if (isset($_POST['hall_address'])) {
        $data['hall_address'] = trim((string)$_POST['hall_address']);
    }
    
    // Persist addressee fields and chosen document language on the form row (same table)
    $upd = $connection->prepare("UPDATE $usedTable SET para_kay = ?, `position` = ?, hall_address = ?, document_language = ? WHERE id = ?");
    if ($upd) {
        $pk = $data['para_kay'];
        $pos = $data['position'];
        $hall = $data['hall_address'];
        $upd->bind_param('ssssi', $pk, $pos, $hall, $language, $requestId);
        if (!$upd->execute()) {
            error_log('generateIndigencyDocument: Failed to save para_kay fields: ' . $upd->error);
        }
        $upd->close();
    } else {
        error_log('generateIndigencyDocument: Could not prepare UPDATE for para_kay (missing columns?): ' . $connection->error);
    }
    
    // Preset officials: use *_officials templates ONLY for the three specific officials; any other value uses regular indigency_{lang}.docx
    $officialParaKay = [
        'Igg. DANIEL FERNANDO',
        'Igg. ADOR PLEYTO',
        'Igg. MARIA ELENA GERMAR',
    ];
    $paraKayTrimmed = trim((string)($data['para_kay'] ?? ''));
    $useOfficialsTemplate = in_array($paraKayTrimmed, $officialParaKay, true);
    $templateSuffix = $useOfficialsTemplate ? '_officials' : '';
    
    // Generate the document file - select template based on language (paths relative to this file, not CWD)
    $templatePath = __DIR__ . '/../brgy_forms/indigency/indigency_' . $language . $templateSuffix . '.docx';
    
    // Generate unique filename with language indicator
    $fullName = trim($data['first_name'] . ' ' . $data['middle_name'] . ' ' . $data['last_name']);
    $filename = 'INDIGENCY_' . strtoupper($language) . '_' . preg_replace('/[^a-zA-Z0-9_]/', '_', $data['last_name']) . '_' . preg_replace('/[^a-zA-Z0-9_]/', '_', $data['first_name']) . '_' . date('Ymd_His') . '.docx';
    $fullOutputPath = rich_temp_docx_path($filename);
    
    // Check if template exists
    if (!file_exists($templatePath)) {
        error_log("Template file not found at: " . $templatePath);
        throw new Exception('Indigency template not found at: ' . $templatePath);
    }
    
    error_log("Template found at: " . $templatePath);
    error_log("Output path: " . $fullOutputPath);
    
    // Populate the template with actual data
    try {
        $success = populateWordTemplate($templatePath, $fullOutputPath, $data, $language);
    } catch (Throwable $e) {
        error_log("generateIndigencyDocument: Error populating template: " . $e->getMessage());
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
        
        $finalFilename = $filename;
        $dlToken = rich_register_temp_download($fullOutputPath);
        
        error_log("Document generated successfully: " . $finalFilename);
        
        // Clear any unexpected output and send JSON response
        ob_clean();
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => true,
            'message' => 'Indigency certificate generated successfully in ' . ucfirst($language) . ' with personal details',
            'filename' => $finalFilename,
            'downloadUrl' => rich_temp_download_public_url($dlToken),
            'language' => $language,
            'data' => $data
        ]);
    } else {
        throw new Exception('Failed to generate document');
    }
    
} catch (Throwable $e) {
    // Log detailed error information
    error_log("INDIGENCY ERROR: " . $e->getMessage());
    error_log("INDIGENCY ERROR FILE: " . $e->getFile() . " LINE: " . $e->getLine());
    error_log("INDIGENCY ERROR TRACE: " . $e->getTraceAsString());
    
    // Clear any unexpected output and send error response
    while (ob_get_level() > 0) {
        @ob_end_clean();
    }
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'debug_info' => [
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ]
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
?>
