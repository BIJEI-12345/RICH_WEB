<?php
// Detect signature area in ID images using Google Vision API
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once 'config.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['imageData']) || empty($input['imageData'])) {
        throw new Exception('No image data provided');
    }
    
    $imageData = $input['imageData'];
    
    // Remove data URL prefix if present
    if (strpos($imageData, 'data:image') === 0) {
        $imageData = preg_replace('/^data:image\/\w+;base64,/', '', $imageData);
    }
    
    // Google Vision API key - Load from config.php
    $apiKey = defined('GOOGLE_VISION_API_KEY') ? GOOGLE_VISION_API_KEY : '';
    if (empty($apiKey)) {
        error_log("Error: GOOGLE_VISION_API_KEY is not configured");
        throw new Exception('Google Vision API key is not configured');
    }
    $apiUrl = 'https://vision.googleapis.com/v1/images:annotate?key=' . $apiKey;
    
    // Prepare request for Google Vision API
    $requestData = [
        'requests' => [
            [
                'image' => [
                    'content' => $imageData
                ],
                'features' => [
                    [
                        'type' => 'TEXT_DETECTION',
                        'maxResults' => 50
                    ],
                    [
                        'type' => 'DOCUMENT_TEXT_DETECTION',
                        'maxResults' => 50
                    ]
                ]
            ]
        ]
    ];
    
    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($requestData),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json'
        ],
        CURLOPT_TIMEOUT => 30
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($curlError || $httpCode !== 200) {
        error_log("Google Vision API error: HTTP $httpCode, Error: $curlError, Response: " . substr($response, 0, 200));
        // Fallback to default signature areas for common ID formats
        $fallbackSignatures = [
            ['x' => 3, 'y' => 78, 'width' => 40, 'height'  => 12],
            ['x' => 55, 'y' => 78, 'width' => 40, 'height' => 12]
        ];
        error_log("Using fallback signature coordinates due to API error");
        echo json_encode([
            'success' => true,
            'signatures' => $fallbackSignatures,
            'fallback' => true
        ]);
        exit;
    }
    
    $result = json_decode($response, true);
    
    if (!isset($result['responses'][0])) {
        throw new Exception('Invalid response from Google Vision API');
    }
    
    $annotations = $result['responses'][0];
    $signatures = [];
    
    // Get image dimensions from fullTextAnnotation if available
    $imageWidth = 0;
    $imageHeight = 0;
    
    if (isset($annotations['fullTextAnnotation']['pages'][0])) {
        $page = $annotations['fullTextAnnotation']['pages'][0];
        $imageWidth = isset($page['width']) ? $page['width'] : 0;
        $imageHeight = isset($page['height']) ? $page['height'] : 0;
    }
    
    // If dimensions not available, try to get from textAnnotations
    if (($imageWidth == 0 || $imageHeight == 0) && isset($annotations['textAnnotations'][0])) {
        $firstAnnotation = $annotations['textAnnotations'][0];
        if (isset($firstAnnotation['boundingPoly']['vertices'])) {
            $vertices = $firstAnnotation['boundingPoly']['vertices'];
            $maxX = 0;
            $maxY = 0;
            foreach ($vertices as $vertex) {
                if (isset($vertex['x']) && $vertex['x'] > $maxX) $maxX = $vertex['x'];
                if (isset($vertex['y']) && $vertex['y'] > $maxY) $maxY = $vertex['y'];
            }
            $imageWidth = $maxX;
            $imageHeight = $maxY;
        }
    }
    
    // Detect signature areas by analyzing text annotations
    // Signatures are typically handwritten (cursive) and appear in specific locations
    if (isset($annotations['textAnnotations']) && is_array($annotations['textAnnotations'])) {
        foreach ($annotations['textAnnotations'] as $index => $annotation) {
            // Skip the first annotation which contains all text
            if ($index === 0) continue;
            
            $text = isset($annotation['description']) ? $annotation['description'] : '';
            $boundingPoly = isset($annotation['boundingPoly']['vertices']) ? $annotation['boundingPoly']['vertices'] : [];
            
            if (empty($boundingPoly) || count($boundingPoly) < 2) continue;
            
            // Calculate bounding box
            $minX = PHP_INT_MAX;
            $minY = PHP_INT_MAX;
            $maxX = 0;
            $maxY = 0;
            
            foreach ($boundingPoly as $vertex) {
                if (isset($vertex['x'])) {
                    $minX = min($minX, $vertex['x']);
                    $maxX = max($maxX, $vertex['x']);
                }
                if (isset($vertex['y'])) {
                    $minY = min($minY, $vertex['y']);
                    $maxY = max($maxY, $vertex['y']);
                }
            }
            
            if ($imageWidth > 0 && $imageHeight > 0) {
                $width = $maxX - $minX;
                $height = $maxY - $minY;
                
                // Check if this looks like a signature area
                // Signatures are typically:
                // 1. Located in bottom portion of ID (y > 70% of height)
                // 2. Have irregular/handwritten appearance
                // 3. May contain words like "Signature", "Sign", etc. nearby
                
                $yPercent = ($minY / $imageHeight) * 100;
                $xPercent = ($minX / $imageWidth) * 100;
                $widthPercent = ($width / $imageWidth) * 100;
                $heightPercent = ($height / $imageHeight) * 100;
                
                // Check if text is in signature area (bottom portion) and has reasonable size
                // More flexible: Check bottom 20% of image (y > 80%) for better detection
                if ($yPercent > 80 && $widthPercent > 3 && $widthPercent < 35 && $heightPercent > 1 && $heightPercent < 15) {
                    $textLower = strtolower($text);
                    $textTrimmed = trim($text);
                    
                    // EARLY EXIT: Exclude ALL uppercase text that's NOT in the very bottom (y > 90%)
                    // This prevents "BLACK", "NONE", "A, A1" from being detected
                    if (strtoupper($textTrimmed) === $textTrimmed && strlen($textTrimmed) >= 3 && $yPercent <= 90) {
                        continue; // Skip immediately - this is printed text, not signature
                    }
                    
                    // EARLY EXIT: Exclude text in middle-right area (x > 40%, y < 90%)
                    // This is where "Eyes Color", "Conditions", "DL Codes" typically are
                    if ($xPercent > 40 && $yPercent < 90 && strtoupper($textTrimmed) === $textTrimmed) {
                        continue; // Skip - this is a field value, not signature
                    }
                    
                    // EXCLUDE ALL printed text patterns - be VERY aggressive
                    $excludePatterns = [
                        // ANY text with comma (printed names always have commas)
                        '/,/',
                        // ANY text with Roman numerals
                        '/\b[IVX]+\b/',
                        // ANY all uppercase text longer than 6 chars
                        '/^[A-Z\s]+$/',
                        // Text with multiple uppercase words
                        '/^([A-Z]+[\s\.]+)+[A-Z]+/',
                        // Text with periods followed by spaces (formatted names)
                        '/[A-Z]+\.[\s]+[A-Z]+/',
                        // Text that looks like a formatted name (Last, First format)
                        '/^[A-Z]+,\s*[A-Z]+/',
                        // Printed names (usually in ALL CAPS with commas)
                        '/^[A-Z\s,]+$/',
                        // License numbers (contains dashes and numbers)
                        '/^[A-Z0-9\-]+$/',
                        // DL codes pattern (A, A1, B, B1, etc.)
                        '/^[A-Z]\d*(\s*,\s*[A-Z]\d*)*$/',
                        // Dates (contains slashes)
                        '/\d{4}\/\d{2}\/\d{2}/',
                        // Addresses
                        '/\d+.*(street|st|avenue|ave|road|rd|barangay|brgy|city|province)/i',
                        // Common ID fields
                        '/^(phl|male|female|m|f|black|brown|blue|green|none|non)$/i',
                        // Numbers only
                        '/^\d+$/',
                        // Text with multiple commas
                        '/^[^,]*,[^,]*,[^,]+/',
                        // Text that looks like a title or label
                        '/^(atty|attorney|assistant|secretary|director|manager|chief|officer)/i',
                        // Text with periods in title format
                        '/^(mr|mrs|ms|dr|atty|attorney)\./i',
                        // Text that contains common ID field labels
                        '/(license|expiration|date of birth|address|nationality|sex|weight|height|blood|eyes|conditions)/i'
                    ];
                    
                    $shouldExclude = false;
                    foreach ($excludePatterns as $pattern) {
                        if (preg_match($pattern, $textTrimmed)) {
                            $shouldExclude = true;
                            break;
                        }
                    }
                    
                    // EXCLUDE if text contains comma (printed names have commas)
                    if (strpos($textTrimmed, ',') !== false) {
                        $shouldExclude = true;
                    }
                    
                    // EXCLUDE if text contains Roman numerals (II, III, IV, etc.)
                    if (preg_match('/\b[IVX]+\b/', $textTrimmed)) {
                        $shouldExclude = true;
                    }
                    
                    // EXCLUDE if text is all uppercase - STRICT: ANY length (3+ chars)
                    // This catches "BLACK", "NONE", "A, A1" etc.
                    if (strtoupper($textTrimmed) === $textTrimmed && strlen($textTrimmed) >= 3) {
                        $shouldExclude = true;
                    }
                    
                    // EXCLUDE text with comma and uppercase letters (DL codes like "A, A1", "B, B1, B2")
                    if (preg_match('/^[A-Z0-9,\s]+$/', $textTrimmed) && strpos($textTrimmed, ',') !== false) {
                        $shouldExclude = true;
                    }
                    
                    // EXCLUDE common ID field values (case-insensitive) - ALWAYS exclude these
                    $commonFieldValues = ['black', 'brown', 'blue', 'green', 'none', 'non', 'a', 'a1', 'b', 'b1', 'b2', 'c', 'c1', 'c2'];
                    if (in_array(strtolower($textTrimmed), $commonFieldValues)) {
                        $shouldExclude = true;
                    }
                    
                    // EXCLUDE single uppercase letters or letter+number combinations (DL codes)
                    // This catches "A", "A1", "B", "B1", "B2", etc. even if they pass other checks
                    if (preg_match('/^[A-Z]\d*$/', $textTrimmed)) {
                        $shouldExclude = true;
                    }
                    
                    // EXCLUDE if text is too long (signatures are very short)
                    if (strlen($textTrimmed) > 15) {
                        $shouldExclude = true;
                    }
                    
                    // EXCLUDE if text has multiple words AND all are uppercase (printed text)
                    $words = explode(' ', $textTrimmed);
                    if (count($words) > 1) {
                        $allUpperWords = true;
                        foreach ($words as $word) {
                            $wordClean = trim($word, '.,');
                            if ($wordClean !== '' && strtoupper($wordClean) !== $wordClean) {
                                $allUpperWords = false;
                                break;
                            }
                        }
                        // EXCLUDE if all words are uppercase (even short ones like "A, A1")
                        if ($allUpperWords) {
                            $shouldExclude = true;
                        }
                    }
                    
                    // Check for signature-related keywords (labels, not signatures)
                    $signatureKeywords = ['signature', 'sign', 'sig', 'licensee', 'official', 'authorized', 'of licensee', 'of official', 'assistant', 'secretary', 'atty', 'attorney', 'vigor', 'mendoza', 'vigoro'];
                    foreach ($signatureKeywords as $keyword) {
                        if (strpos($textLower, $keyword) !== false) {
                            $shouldExclude = true;
                            break;
                        }
                    }
                    
                    if ($shouldExclude) {
                        continue; // Skip this text annotation
                    }
                    
                    // NOW: Only detect if it's ACTUAL cursive/handwritten text
                    // Cursive text characteristics:
                    // 1. MUST have lowercase letters (handwritten signatures have mixed case)
                    // 2. Very short (2-12 characters)
                    // 3. Usually 1-2 words max
                    // 4. In bottom-left area only (licensee signature)
                    // 5. NO commas, NO Roman numerals, NO all uppercase
                    
                    $isLikelySignature = false;
                    
                    // MUST have lowercase letters - this is the KEY to detecting cursive text
                    $hasLowercase = preg_match('/[a-z]/', $textTrimmed);
                    
                    if ($hasLowercase && strlen($textTrimmed) >= 2 && strlen($textTrimmed) <= 15) {
                        // Check if it contains letters
                        if (preg_match('/[a-zA-Z]/', $textTrimmed)) {
                            // More flexible position - bottom area (licensee signature and official signature)
                            // x < 60%, y > 85% (bottom portion of image, both left and right sides)
                            if ($xPercent < 60 && $yPercent > 85) {
                                // Exclude if it looks like a formatted name or title
                                if (!preg_match('/^(atty|attorney|mr|mrs|ms|dr)\.?\s+/i', $textTrimmed)) {
                                    // Signatures are usually 1-2 words max
                                    $wordCount = count(array_filter($words, function($w) { return trim($w) !== ''; }));
                                    
                                    if ($wordCount <= 2) {
                                        // Final check: exclude if any word looks like a title
                                        $hasTitle = false;
                                        foreach ($words as $word) {
                                            $wordClean = strtolower(trim($word, '.,'));
                                            if (in_array($wordClean, ['atty', 'attorney', 'assistant', 'secretary', 'mr', 'mrs', 'ms', 'dr'])) {
                                                $hasTitle = true;
                                                break;
                                            }
                                        }
                                        
                                        if (!$hasTitle) {
                                            $isLikelySignature = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    if ($isLikelySignature) {
                        // SHRINK bounding box even more to focus ONLY on cursive text
                        // Reduce height by 50% and focus on upper part
                        $shrinkFactor = 0.5; // Keep only 50% of height
                        $originalHeight = $heightPercent;
                        $heightPercent = $heightPercent * $shrinkFactor;
                        
                        // Move Y up to focus on signature (not labels below)
                        $yAdjustment = $originalHeight * 0.3;
                        $yPercent = $yPercent - $yAdjustment;
                        
                        if ($yPercent < 0) {
                            $heightPercent = $heightPercent + $yPercent;
                            $yPercent = 0;
                        }
                        
                        // Reduce width by 20% to avoid adjacent text
                        $widthPercent = $widthPercent * 0.8;
                        
                        // Cap height at 8% of image
                        if ($heightPercent > 8) {
                            $heightPercent = 8;
                        }
                        
                        // Cap width at 25% of image
                        if ($widthPercent > 25) {
                            $widthPercent = 25;
                        }
                        
                        $signatures[] = [
                            'x' => $xPercent,
                            'y' => $yPercent,
                            'width' => $widthPercent,
                            'height' => $heightPercent
                        ];
                    }
                }
            }
        }
    }
    
    // If no signatures detected, use fallback
    if (empty($signatures)) {
        error_log("No signatures detected by Google Vision API, using fallback coordinates");
        $signatures = [
            ['x' => 3, 'y' => 78, 'width' => 40, 'height' => 12],
            ['x' => 55, 'y' => 78, 'width' => 40, 'height' => 12]
        ];
    } else {
        error_log("Successfully detected " . count($signatures) . " signature area(s)");
    }
    
    // Remove duplicates and merge overlapping signatures
    $mergedSignatures = [];
    foreach ($signatures as $sig) {
        $merged = false;
        foreach ($mergedSignatures as &$mergedSig) {
            // Check if signatures overlap
            if (abs($sig['x'] - $mergedSig['x']) < 20 && abs($sig['y'] - $mergedSig['y']) < 10) {
                // Merge overlapping signatures
                $mergedSig['x'] = min($sig['x'], $mergedSig['x']);
                $mergedSig['y'] = min($sig['y'], $mergedSig['y']);
                $mergedSig['width'] = max($sig['x'] + $sig['width'], $mergedSig['x'] + $mergedSig['width']) - $mergedSig['x'];
                $mergedSig['height'] = max($sig['y'] + $sig['height'], $mergedSig['y'] + $mergedSig['height']) - $mergedSig['y'];
                $merged = true;
                break;
            }
        }
        if (!$merged) {
            $mergedSignatures[] = $sig;
        }
    }
    
    echo json_encode([
        'success' => true,
        'signatures' => $mergedSignatures,
        'fallback' => empty($mergedSignatures) || (count($mergedSignatures) === 2 && 
                      $mergedSignatures[0]['x'] == 3 && $mergedSignatures[0]['y'] == 78)
    ]);
    
} catch (Exception $e) {
    error_log("Error in detectSignature.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    // Always return success with fallback coordinates to ensure signatures are blurred
    echo json_encode([
        'success' => true,
        'error' => $e->getMessage(),
        'fallback' => true,
        'signatures' => [
            ['x' => 3, 'y' => 78, 'width' => 40, 'height' => 12],
            ['x' => 55, 'y' => 78, 'width' => 40, 'height' => 12]
        ]
    ]);
}
?>
