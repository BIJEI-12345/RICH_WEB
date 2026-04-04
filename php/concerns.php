<?php
// Disable error reporting to prevent HTML output
error_reporting(0);
ini_set('display_errors', 0);

// Set execution time limit
set_time_limit(60); // 60 seconds max
ini_set('memory_limit', '256M');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

// Include configuration file
require_once 'config.php';

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
    if ($module === 'concerns') {
        return $position === 'concerns & reporting';
    }
    if ($module === 'emergency') {
        return ($position === 'emergency' || $position === 'emergency category');
    }
    return false;
}

// Function to analyze statement and determine risk level using Groq AI
function analyzeRiskLevel($statement) {
    if (empty($statement) || strlen(trim($statement)) < 5) {
        return 'low'; // Default to low for empty or very short statements
    }
    
    $statementLower = mb_strtolower($statement, 'UTF-8');
    
    // ========================================================================
    // KEYWORD-BASED PRE-CHECK FOR HIGH RISK SCENARIOS
    // Safety-critical: Injuries, accidents, emergencies requiring immediate response
    // ========================================================================
    
    // High risk keywords - check these FIRST for public safety
    $highRiskKeywords = [
        // Injuries and medical emergencies
        'nabagok', 'natamaan', 'nabunggo', 'nabugbog', 'nabasag', 'nasugatan', 'nasaktan', 'nabalian',
        'nabali', 'naputol', 'nabugbog', 'nasaktan', 'nasugatan', 'nakagat', 'natapilok',
        'hospital', 'emergency', 'nahihimatay', 'dumudugo', 'unconscious', 'kailangan ng doktor',
        'may nasugatan', 'may nasaktan', 'may nasugatan', 'may nasugatan', 'may sugat',
        // Vehicle accidents
        'nadulas na motor', 'nadulas na sasakyan', 'naaksidente', 'nabangga', 'nabunggo na motor',
        'nabunggo na sasakyan', 'accident', 'naaksidente', 'crash', 'collision', 'natumba',
        'may aksidente', 'may nabangga', 'may nabunggo',
        // Fire and structural emergencies
        'sunog', 'fire', 'nagliliyab', 'burning', 'nasusunog', 'may sunog', 'nagkasunog',
        // Violence and fights
        'nag-away', 'nagaway', 'may away', 'may nag-away', 'may nagaway', 'may nananakit',
        'may nagbabangga', 'violence', 'nag-away at may nasaktan', 'nagaway at may nasugatan',
        // Structural collapse
        'gumuguho', 'nagguho', 'bumagsak', 'nabagsak', 'nagiba', 'nagiba na bahay',
        'nagiba na gusali', 'collapse', 'collapsed', 'may gumuguho',
        // Head injuries (specific safety concern)
        'nabagok ang ulo', 'natamaan ang ulo', 'nabunggo ang ulo', 'nabugbog ang ulo',
        'nasaktan ang ulo', 'nasugatan ang ulo', 'nabalian ng ulo'
    ];
    
    // Check for HIGH risk keywords - IMMEDIATE RETURN for safety
    foreach ($highRiskKeywords as $keyword) {
        if (mb_stripos($statementLower, $keyword) !== false) {
            return 'high'; // CRITICAL: Safety emergencies are always HIGH risk
        }
    }
    
    // Additional checks for compound high-risk phrases
    // Head injury patterns
    if ((mb_stripos($statementLower, 'ulo') !== false || mb_stripos($statementLower, 'head') !== false) 
        && (mb_stripos($statementLower, 'nabagok') !== false || mb_stripos($statementLower, 'natamaan') !== false 
            || mb_stripos($statementLower, 'nabunggo') !== false || mb_stripos($statementLower, 'nasugatan') !== false
            || mb_stripos($statementLower, 'nasaktan') !== false)) {
        return 'high';
    }
    
    // Vehicle accident patterns
    if ((mb_stripos($statementLower, 'motor') !== false || mb_stripos($statementLower, 'motorcycle') !== false 
        || mb_stripos($statementLower, 'sasakyan') !== false || mb_stripos($statementLower, 'vehicle') !== false)
        && (mb_stripos($statementLower, 'nadulas') !== false || mb_stripos($statementLower, 'accident') !== false
            || mb_stripos($statementLower, 'nabangga') !== false || mb_stripos($statementLower, 'nabunggo') !== false
            || mb_stripos($statementLower, 'crash') !== false || mb_stripos($statementLower, 'collision') !== false)) {
        return 'high';
    }
    
    // ========================================================================
    // KEYWORD-BASED PRE-CHECK FOR MEDIUM RISK SCENARIOS
    // Infrastructure and service problems affecting daily life and public service
    // ========================================================================
    
    $mediumRiskKeywords = [
        // Drainage and sewer problems (critical for public health)
        'barado', 'baradong', 'blocked', 'blockage', 'drainage', 'drain', 'kanal', 'sewer',
        'baradong kanal', 'baradong drainage', 'barado ang kanal', 'barado ang drainage',
        'blocked drainage', 'blocked kanal', 'blocked sewer', 'blocked drain',
        // Infrastructure damage (affects public safety)
        'sira ang', 'sira ang ilaw', 'broken', 'damaged', 'nasira', 'nasira ang',
        'sira ang poste', 'sira ang ilaw sa kalye', 'sira ang streetlight',
        'broken light', 'broken streetlight', 'broken lamp post',
        // Water leaks (waste and safety hazard)
        'may tumutulo', 'tumutulo', 'leak', 'leaking', 'water leak',
        'may tumutulo na tubig', 'tumutulo ang tubig', 'may leak sa tubig',
        'leaking water', 'leaking pipe', 'water pipe leak',
        // Road problems (traffic and safety)
        'may lubak', 'lubak', 'pothole', 'potholes', 'damaged road',
        'may lubak sa kalsada', 'may pothole', 'may potholes', 'may damaged road',
        'damaged kalsada', 'sira ang kalsada', 'nasira ang kalsada',
        // Street lighting (public safety at night)
        'walang ilaw', 'wala ng ilaw', 'streetlight', 'street light', 'streetlight broken',
        'walang ilaw sa kalye', 'wala ng streetlight', 'sira ang streetlight',
        'broken streetlight', 'damaged streetlight',
        // Garbage collection (public health)
        'hindi nakolekta', 'nakolekta', 'garbage', 'basura', 'trash',
        'hindi nakolekta ang basura', 'hindi nakolekta ang garbage', 'hindi nakolekta ang trash',
        'walang nagkokolekta ng basura', 'walang nagkokolekta ng garbage',
        // Water supply problems (basic necessity)
        'walang tubig', 'wala ng tubig', 'water supply', 'problema sa tubig',
        'walang tubig sa area', 'wala ng tubig supply', 'problema sa tubig supply',
        'walang tubig sa lugar', 'wala ng tubig sa amin',
        // Noise and traffic issues (quality of life)
        'may ingay', 'ingay', 'noise', 'trapiko', 'traffic',
        'may ingay gabi-gabi', 'may ingay sa gabi', 'may malakas na ingay',
        'problema sa trapiko', 'problema sa traffic', 'heavy traffic',
        // Property damage (public property)
        'vandalism', 'graffiti', 'nasira ang', 'damaged',
        'may vandalism', 'may graffiti', 'nasira ang public property',
        'damaged public facility', 'damaged bench', 'damaged playground',
        // Environmental issues (flooding affects public safety)
        'may baha', 'baha', 'flooding', 'flood',
        'may baha sa area', 'may flooding', 'may flood', 'baha sa lugar',
        // Sidewalk and walkway damage (pedestrian safety)
        'sidewalk', 'walkway', 'damaged sidewalk', 'damaged walkway',
        'sira ang sidewalk', 'nasira ang sidewalk', 'sira ang walkway',
        'broken sidewalk', 'broken walkway',
        // Additional infrastructure problems
        'may problema sa', 'problema sa', 'may issue sa',
        'hindi gumagana', 'not working', 'may sira'
    ];
    
    // Check for MEDIUM risk keywords - if found, return MEDIUM immediately
    foreach ($mediumRiskKeywords as $keyword) {
        if (mb_stripos($statementLower, $keyword) !== false) {
            return 'medium'; // Infrastructure/service problems affecting public service are MEDIUM risk
        }
    }
    
    // Check if API key is defined
    if (!defined('GROQ_API_KEY')) {
        error_log("GROQ_API_KEY not defined");
        return 'low'; // Default to low if API key not available
    }
    
    $apiKey = GROQ_API_KEY;
    // Groq AI API endpoint
    $apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    
    // Create prompt for reasonable and appropriate risk assessment for barangay concerns
    $prompt = "You are analyzing a barangay (community) resident concern statement. Classify the risk level as LOW, MEDIUM, or HIGH based on actual severity and urgency.\n\n";
    
    $prompt .= "RISK LEVEL CLASSIFICATION FOR BARANGAY CONCERNS:\n\n";
    
    $prompt .= "HIGH RISK - Serious emergencies requiring immediate response:\n";
    $prompt .= "- Physical injuries to people: head injuries, broken bones, wounds requiring medical attention\n";
    $prompt .= "- Vehicle accidents with people involved: motorcycle accidents, car crashes with injuries\n";
    $prompt .= "- Medical emergencies: unconscious person, severe bleeding, life-threatening conditions\n";
    $prompt .= "- Fires: active fires, burning structures\n";
    $prompt .= "- Violence or fights with injuries: physical altercations resulting in harm\n";
    $prompt .= "- Structural collapse: buildings or structures falling or in danger of falling\n";
    $prompt .= "Examples: 'nabagok ang ulo', 'nadulas na motor at may nasugatan', 'may sunog sa bahay', 'may nag-away at may nasaktan'\n\n";
    
    $prompt .= "MEDIUM RISK - Problems causing inconvenience, need attention within days (THIS IS THE MOST COMMON LEVEL FOR BARANGAY CONCERNS):\n";
    $prompt .= "- Infrastructure issues: water leaks ('may tumutulo na tubig'), broken street lights ('sira ang ilaw sa kalye'), damaged roads ('may lubak sa kalsada'), blocked drainage ('barado ang kanal'), potholes on roads\n";
    $prompt .= "- Public services: garbage not collected ('hindi nakolekta ang basura'), persistent noise ('may ingay gabi-gabi'), parking issues, water supply problems ('walang tubig' or 'mahina ang tubig'), electricity issues\n";
    $prompt .= "- Property damage: broken street signs, damaged public facilities, vandalism, damaged benches or playground equipment\n";
    $prompt .= "- Ongoing problems: issues that disrupt daily activities but are not emergencies ('nakakaabala', 'hindi makadaan', 'problema sa trapiko')\n";
    $prompt .= "- Safety concerns: dark areas without lights, slippery walkways, low-hanging wires, damaged sidewalks (non-immediate danger)\n";
    $prompt .= "- Environmental issues: flooding ('may baha'), drainage problems, water accumulation, stagnant water\n";
    $prompt .= "KEY INDICATORS FOR MEDIUM: Problems that need repair, affect daily activities, cause inconvenience, visible issues requiring action\n";
    $prompt .= "Examples: 'may tumutulo na tubig sa poste', 'sira ang ilaw sa kalye', 'barado ang kanal', 'hindi nakolekta ang basura ng ilang araw na', 'may ingay gabi-gabi', 'may problema sa tubig', 'may lubak sa kalsada', 'sira ang sidewalk'\n\n";
    
    $prompt .= "LOW RISK - Minor issues, routine requests, can wait weeks/months with no impact:\n";
    $prompt .= "- Simple requests: permit applications ('gusto ko pong kumuha ng permit'), information inquiries ('tanong lang po'), document requests\n";
    $prompt .= "- Minor complaints: very small potholes, minor graffiti, cosmetic issues, aesthetic improvements, landscaping suggestions\n";
    $prompt .= "- Non-urgent matters: suggestions for improvement, routine maintenance requests, planning matters, general feedback\n";
    $prompt .= "- Administrative: general inquiries, clarifications, non-critical requests, simple questions\n";
    $prompt .= "- No impact on daily activities or safety\n";
    $prompt .= "Examples: 'gusto ko pong magtanong tungkol sa permit', 'tanong lang po tungkol sa', 'suggestion lang po para sa improvement', 'may tanong ako'\n\n";
    
    $prompt .= "IMPORTANT GUIDELINES:\n";
    $prompt .= "- MEDIUM RISK is the MOST COMMON level for barangay infrastructure and service problems\n";
    $prompt .= "- If the statement describes a problem that needs repair or affects daily life, it's usually MEDIUM\n";
    $prompt .= "- HIGH should ONLY be for real emergencies (injuries, fires, accidents with harm)\n";
    $prompt .= "- LOW is ONLY for simple requests/inquiries or very minor issues with no real impact\n";
    $prompt .= "- When between LOW and MEDIUM, choose MEDIUM (most concerns are MEDIUM)\n";
    $prompt .= "- If it mentions broken/fixed infrastructure, service problems, or visible issues = MEDIUM\n";
    $prompt .= "- If it's just asking a question or making a suggestion = LOW\n\n";
    
    $prompt .= "ANALYSIS STEPS:\n";
    $prompt .= "1. Is there injury to a person, fire, medical emergency, or violence with harm? → If YES = HIGH\n";
    $prompt .= "2. If NO to step 1: Does this describe a problem (broken, damaged, leaking, blocked, missing service, noise, etc.) that needs attention? → If YES = MEDIUM (this is common)\n";
    $prompt .= "3. If NO to both: Is this just a simple question, request, or suggestion with no problem described? → If YES = LOW\n\n";
    
    $prompt .= "Statement: \"" . addslashes($statement) . "\"\n\n";
    $prompt .= "Analyze this barangay concern statement carefully. Remember: MEDIUM is the most common level for problems that need repair or affect daily activities.\n";
    $prompt .= "Respond with ONLY one word: low, medium, or high";
    
    $requestData = [
        'model' => 'llama-3.1-8b-instant',
        'messages' => [
            [
                'role' => 'user',
                'content' => $prompt
            ]
        ],
        'temperature' => 0.2,
        'max_tokens' => 10
    ];
    
    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10); // 10 second timeout
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    // If API call fails, default to 'low'
    if ($response === false || !empty($curlError) || $httpCode !== 200) {
        error_log("Groq AI API error: HTTP $httpCode, Error: $curlError, Response: " . substr($response, 0, 200));
        return 'low'; // Default to low on error
    }
    
    $result = json_decode($response, true);
    
    // Extract the response text from Groq API format
    if (isset($result['choices'][0]['message']['content'])) {
        $aiResponse = trim(strtolower($result['choices'][0]['message']['content']));
        
        // Extract risk level from response (check for 'high' first, then 'medium', then 'low')
        if (preg_match('/\bhigh\b/', $aiResponse)) {
            return 'high';
        } elseif (preg_match('/\bmedium\b/', $aiResponse)) {
            return 'medium';
        } elseif (preg_match('/\blow\b/', $aiResponse)) {
            return 'low';
        }
    }
    
    // Default to 'low' if we can't parse the response
    error_log("Could not parse Groq AI response. Raw response: " . substr(json_encode($result), 0, 500));
    return 'low';
}

// Function to find similar concerns using Groq AI
function findSimilarConcernsWithAI($baseConcern, $allConcerns) {
    if (!defined('GROQ_API_KEY')) {
        error_log("GROQ_API_KEY not defined for similarity analysis");
        return [];
    }
    
    $apiKey = GROQ_API_KEY;
    $apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    
    // Prepare the base concern data (statement, location, image)
    $baseStatement = $baseConcern['statement'] ?? '';
    $baseLocation = $baseConcern['location'] ?? '';
    $baseImage = !empty($baseConcern['concern_image']) ? 'Has image' : 'No image';
    $baseConcernId = $baseConcern['concern_id'] ?? '';
    
    if (empty($baseStatement)) {
        return [];
    }
    
    // Prepare list of other concerns for comparison (exclude base concern by comparing statement+location)
    $otherConcerns = [];
    foreach ($allConcerns as $concern) {
        $concernId = 'CON-' . str_pad($concern['id'], 3, '0', STR_PAD_LEFT);
        // Skip if it's the same concern (same statement and location)
        if ($concernId === $baseConcernId) {
            continue;
        }
        
        $otherConcerns[] = [
            'id' => $concernId,
            'statement' => $concern['statement'] ?? '',
            'location' => $concern['location'] ?? '',
            'image' => !empty($concern['concern_image']) ? 'Has image' : 'No image'
        ];
    }
    
    if (empty($otherConcerns)) {
        return [];
    }
    
    // Create prompt for Groq AI to find EXACTLY similar concerns based on statement, location, and image
    $prompt = "You are analyzing barangay (community) concerns to find EXACTLY similar ones using GROQ AI.\n\n";
    $prompt .= "BASE CONCERN:\n";
    $prompt .= "Statement: \"" . addslashes($baseStatement) . "\"\n";
    $prompt .= "Location: \"" . addslashes($baseLocation) . "\"\n";
    $prompt .= "Image: " . $baseImage . "\n\n";
    
    $prompt .= "OTHER CONCERNS TO COMPARE:\n";
    foreach ($otherConcerns as $idx => $concern) {
        $prompt .= ($idx + 1) . ". ID: " . $concern['id'] . "\n";
        $prompt .= "   Statement: \"" . addslashes($concern['statement']) . "\"\n";
        $prompt .= "   Location: \"" . addslashes($concern['location']) . "\"\n";
        $prompt .= "   Image: " . $concern['image'] . "\n\n";
    }
    
    $prompt .= "IMPORTANT: Find ONLY concerns that are EXACTLY similar to the BASE CONCERN using GROQ AI analysis.\n\n";
    $prompt .= "MATCHING RULES (based on Statement, Location, and Image):\n";
    $prompt .= "1. The concern type/issue (Statement) MUST be EXACTLY THE SAME:\n";
    $prompt .= "   - If BASE is about 'kanal' (drainage), only match other 'kanal' concerns\n";
    $prompt .= "   - If BASE is about 'street lights', only match other 'street lights' concerns\n";
    $prompt .= "   - If BASE is about 'water leak', only match other 'water leak' concerns\n";
    $prompt .= "   - DO NOT match different concern types (e.g., kanal vs street lights)\n\n";
    $prompt .= "2. The location/address MUST be EXACTLY THE SAME:\n";
    $prompt .= "   - Location must match word-for-word\n";
    $prompt .= "   - 'Bigte Circle' matches 'Bigte Circle' but NOT 'Old Bario'\n";
    $prompt .= "   - 'Old Bario' matches 'Old Bario' but NOT 'Bigte Circle'\n\n";
    $prompt .= "3. Image status can be considered (if both have images or both don't have images, it's a plus)\n\n";
    $prompt .= "4. BOTH Statement AND Location must match EXACTLY:\n";
    $prompt .= "   - Same concern type (Statement) AND same location = MATCH\n";
    $prompt .= "   - Different concern type OR different location = NO MATCH\n\n";
    $prompt .= "Examples:\n";
    $prompt .= "- BASE: 'kanal' at 'Bigte Circle' → Match: 'kanal' at 'Bigte Circle' ONLY\n";
    $prompt .= "- BASE: 'kanal' at 'Bigte Circle' → NO Match: 'street lights' at 'Bigte Circle' (different concern type)\n";
    $prompt .= "- BASE: 'kanal' at 'Bigte Circle' → NO Match: 'kanal' at 'Old Bario' (different location)\n\n";
    $prompt .= "Analyze using GROQ AI and respond with ONLY a comma-separated list of concern IDs that match EXACTLY (e.g., CON-001,CON-002).\n";
    $prompt .= "If no concerns match EXACTLY, respond with: NONE";
    
    $requestData = [
        'model' => 'llama-3.1-8b-instant',
        'messages' => [
            [
                'role' => 'user',
                'content' => $prompt
            ]
        ],
        'temperature' => 0.3,
        'max_tokens' => 200
    ];
    
    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15); // 15 second timeout for similarity analysis
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    // If API call fails, return empty array
    if ($response === false || !empty($curlError) || $httpCode !== 200) {
        error_log("Groq AI similarity API error: HTTP $httpCode, Error: $curlError");
        return [];
    }
    
    $result = json_decode($response, true);
    
    // Extract the response text from Groq API format
    if (isset($result['choices'][0]['message']['content'])) {
        $aiResponse = trim($result['choices'][0]['message']['content']);
        
        // Check if AI said "NONE"
        if (stripos($aiResponse, 'none') !== false && stripos($aiResponse, 'CON-') === false) {
            return [];
        }
        
        // Extract concern IDs from response (format: CON-001,CON-002,CON-005)
        preg_match_all('/CON-\d+/', $aiResponse, $matches);
        $similarIds = $matches[0] ?? [];
        
        // Post-process: Double-check that returned concerns are EXACTLY similar
        // (same concern type AND same location)
        $exactMatches = [];
        foreach ($similarIds as $concernId) {
            // Find the concern in allConcerns
            $matchedConcern = null;
            foreach ($allConcerns as $concern) {
                $concernIdFromData = 'CON-' . str_pad($concern['id'], 3, '0', STR_PAD_LEFT);
                if ($concernIdFromData === $concernId) {
                    $matchedConcern = $concern;
                    break;
                }
            }
            
            if (!$matchedConcern) {
                continue; // Skip if concern not found
            }
            
            $matchedStatement = strtolower(trim($matchedConcern['statement'] ?? ''));
            $matchedLocation = strtolower(trim($matchedConcern['location'] ?? ''));
            $baseStatementLower = strtolower(trim($baseStatement));
            $baseLocationLower = strtolower(trim($baseLocation));
            
            // Check if location matches exactly
            $locationMatch = ($matchedLocation === $baseLocationLower);
            
            // Check if concern type is similar (extract key words)
            // Simple check: if both contain same key words like "kanal", "street light", "tubig", etc.
            $baseKeywords = [];
            $matchedKeywords = [];
            
            // Extract key concern words - expanded list with more variations
            $concernKeywords = [
                'kanal', 'drainage', 'drain', 'bara', 'barado', 'blocked', 'baradong', 'malaking bara', 'maliit na bara',
                'street light', 'streetlight', 'ilaw', 'sira ang ilaw', 'broken light', 'walang ilaw', 'wala ng ilaw',
                'tubig', 'water', 'leak', 'tumutulo', 'leaking', 'walang tubig', 'wala ng tubig',
                'lubak', 'pothole', 'kalsada', 'road', 'sira ang kalsada', 'damaged road', 'sirang kalsada',
                'basura', 'garbage', 'trash', 'nakolekta', 'hindi nakolekta',
                'baha', 'flood', 'flooding',
                'ingay', 'noise', 'trapiko', 'traffic',
                'vandalism', 'graffiti', 'nasira', 'damaged',
                'sidewalk', 'walkway', 'sira ang sidewalk'
            ];
            
            foreach ($concernKeywords as $keyword) {
                if (stripos($baseStatementLower, $keyword) !== false) {
                    $baseKeywords[] = $keyword;
                }
                if (stripos($matchedStatement, $keyword) !== false) {
                    $matchedKeywords[] = $keyword;
                }
            }
            
            // Check if they share at least one key concern word (same concern type)
            $hasCommonKeyword = !empty(array_intersect($baseKeywords, $matchedKeywords));
            
            // If no keywords found, check word similarity (for concerns not in keyword list)
            if (!$hasCommonKeyword) {
                if (!empty($baseKeywords) && empty($matchedKeywords)) {
                    // If base has keywords but matched doesn't, they're different types
                    $hasCommonKeyword = false;
                } elseif (empty($baseKeywords) && empty($matchedKeywords)) {
                    // If neither has keywords, check word overlap (at least 2 common words)
                    $stopWords = ['ang', 'sa', 'na', 'ng', 'at', 'may', 'walang', 'wala', 'po', 'sir', 'the', 'a', 'an', 'is', 'are', 'was', 'were'];
                    $baseWords = array_filter(explode(' ', $baseStatementLower), function($w) use ($stopWords) {
                        $w = trim($w);
                        return strlen($w) >= 3 && !in_array($w, $stopWords);
                    });
                    $matchedWords = array_filter(explode(' ', $matchedStatement), function($w) use ($stopWords) {
                        $w = trim($w);
                        return strlen($w) >= 3 && !in_array($w, $stopWords);
                    });
                    $commonWords = array_intersect($baseWords, $matchedWords);
                    $hasCommonKeyword = count($commonWords) >= 2; // At least 2 common meaningful words
                }
            }
            
            // Only include if BOTH location matches AND concern type matches
            // Trust Groq AI's judgment - if AI says it's similar and location matches, include it
            if ($locationMatch && $hasCommonKeyword) {
                $exactMatches[] = $concernId;
            } else {
                // Log why it was filtered out for debugging
                error_log("Filtered out concern $concernId: locationMatch=" . ($locationMatch ? 'true' : 'false') . ", hasCommonKeyword=" . ($hasCommonKeyword ? 'true' : 'false'));
            }
        }
        
        // Return array of exactly similar concern IDs
        return $exactMatches;
    }
    
    error_log("Could not parse Groq AI similarity response. Raw response: " . substr(json_encode($result), 0, 500));
    return [];
}

// Database configuration
$host = DB_HOST;
$user = DB_USER;
$pass = DB_PASS;
$db   = DB_NAME;

try {
    // Use the database connection function from config.php
    $connection = getDatabaseConnection();
    $connection->set_charset('utf8mb4');
    
    // Handle different request methods
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    
    // Check if this is an image request
    if (isset($_GET['image']) && $_GET['image'] === 'true') {
        // Serve concern image
        $concernId = $_GET['id'] ?? null;
        
        if (!$concernId) {
            http_response_code(400);
            echo "Missing concern ID";
            exit;
        }
        
        // Extract the ID from concern_id (e.g., CON-001 -> 1)
        $id = intval(str_replace('CON-', '', $concernId));
        
        // Get the image data from database
        $sql = "SELECT concern_image FROM concerns WHERE id = ?";
        $stmt = $connection->prepare($sql);
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        
        if (!$result || !$result['concern_image']) {
            http_response_code(404);
            echo "Image not found";
            exit;
        }
        
        $imageData = $result['concern_image'];
        
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
    
    switch ($method) {
        case 'GET':
            // Check if risk_level column exists, if not, add it
            $checkColumn = $connection->query("SHOW COLUMNS FROM concerns LIKE 'risk_level'");
            if ($checkColumn->num_rows === 0) {
                $connection->query("ALTER TABLE concerns ADD COLUMN risk_level VARCHAR(10) DEFAULT NULL");
            }
            
            // Get concerns from concerns table with status filtering
            $status = isset($_GET['status']) ? $_GET['status'] : null;
            
            if ($status) {
                if ($status === 'resolved') {
                    // For resolved concerns, sort by resolved_at date (latest resolved first)
                    $sql = "SELECT id, concern_image, reporter_name, contact, date_and_time, location, statement, status, resolved_at, COALESCE(risk_level, '') as risk_level FROM concerns WHERE status = ? ORDER BY resolved_at DESC LIMIT 100";
                } else if ($status === 'processing') {
                    // For processing concerns, include process_at
                    $sql = "SELECT id, concern_image, reporter_name, contact, date_and_time, location, statement, status, resolved_at, process_at, COALESCE(risk_level, '') as risk_level FROM concerns WHERE status = ? ORDER BY date_and_time DESC LIMIT 100";
                } else {
                    // For other statuses, sort by original date_and_time (latest first)
                    $sql = "SELECT id, concern_image, reporter_name, contact, date_and_time, location, statement, status, resolved_at, COALESCE(risk_level, '') as risk_level FROM concerns WHERE status = ? ORDER BY date_and_time DESC LIMIT 100";
                }
                $stmt = $connection->prepare($sql);
                $stmt->bind_param('s', $status);
                $stmt->execute();
                $concerns = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            } else {
                // For all concerns, sort by date_and_time (latest first)
                $sql = "SELECT id, concern_image, reporter_name, contact, date_and_time, location, statement, status, resolved_at, COALESCE(risk_level, '') as risk_level FROM concerns ORDER BY date_and_time DESC LIMIT 100";
                $result = $connection->query($sql);
                $concerns = $result->fetch_all(MYSQLI_ASSOC);
            }
            
            // Check if we have too many records to process
            if (count($concerns) > 50) {
                echo json_encode(['success' => false, 'message' => 'Too many records to process. Please use pagination.']);
                exit;
            }
            
            // Helper function to check if statement contains MEDIUM risk keywords
            $hasMediumRiskKeywords = function($statement) {
                $statementLower = mb_strtolower($statement, 'UTF-8');
                $mediumRiskKeywords = [
                    // Infrastructure problems
                    'barado', 'baradong', 'blocked', 'blockage', 'drainage', 'drain', 'kanal', 'sewer',
                    'sira ang', 'sira ang ilaw', 'broken', 'damaged', 'nasira', 'nasira ang',
                    'may tumutulo', 'tumutulo', 'leak', 'leaking', 'water leak',
                    'may lubak', 'lubak', 'pothole', 'potholes', 'damaged road',
                    'walang ilaw', 'wala ng ilaw', 'streetlight', 'street light',
                    // Service problems
                    'hindi nakolekta', 'nakolekta', 'garbage', 'basura', 'trash',
                    'walang tubig', 'wala ng tubig', 'water supply', 'problema sa tubig',
                    'may ingay', 'ingay', 'noise', 'trapiko', 'traffic',
                    // Property damage
                    'vandalism', 'graffiti', 'nasira ang', 'damaged',
                    // Environmental issues
                    'may baha', 'baha', 'flooding', 'flood',
                    'sidewalk', 'walkway', 'damaged sidewalk'
                ];
                
                foreach ($mediumRiskKeywords as $keyword) {
                    if (mb_stripos($statementLower, $keyword) !== false) {
                        return true;
                    }
                }
                return false;
            };
            
            // Add concern_id and formatted_date for each concern, and auto-analyze risk level
            foreach ($concerns as $index => &$concern) {
                $concern['concern_id'] = 'CON-' . str_pad($concern['id'], 3, '0', STR_PAD_LEFT);
                $concern['priority'] = 'medium'; // Default priority
                
                $statement = $concern['statement'] ?? '';
                $currentRiskLevel = $concern['risk_level'] ?? '';
                
                // Auto-analyze and set risk level if not set, empty, or needs re-analysis
                $needsAnalysis = false;
                if (empty($currentRiskLevel) || $currentRiskLevel === '' || $currentRiskLevel === null) {
                    // Need analysis if risk level is not set
                    $needsAnalysis = true;
                } elseif ($currentRiskLevel === 'low' && !empty($statement) && strlen(trim($statement)) >= 5) {
                    // Re-analyze LOW concerns that have MEDIUM risk keywords
                    if ($hasMediumRiskKeywords($statement)) {
                        $needsAnalysis = true;
                    }
                }
                
                if ($needsAnalysis && !empty($statement) && strlen(trim($statement)) >= 5) {
                    try {
                        // Analyze statement using Groq AI API (with keyword pre-checks)
                        $detectedRiskLevel = analyzeRiskLevel($statement);
                        
                        // Update risk level in database
                        $updateSql = "UPDATE concerns SET risk_level = ? WHERE id = ?";
                        $updateStmt = $connection->prepare($updateSql);
                        if ($updateStmt) {
                            $updateStmt->bind_param('si', $detectedRiskLevel, $concern['id']);
                            $updateStmt->execute();
                            $updateStmt->close();
                            
                            // Set the risk level in the concern data
                            $concern['risk_level'] = $detectedRiskLevel;
                        } else {
                            $concern['risk_level'] = $currentRiskLevel ?: 'low'; // Keep current or default on database error
                        }
                    } catch (Exception $e) {
                        error_log("Error analyzing risk level: " . $e->getMessage());
                        $concern['risk_level'] = $currentRiskLevel ?: 'low'; // Keep current or default on exception
                    }
                } elseif (empty($concern['risk_level']) || $concern['risk_level'] === '' || $concern['risk_level'] === null) {
                    // If no statement or too short, default to 'low'
                    $concern['risk_level'] = 'low';
                }
                
                // Fix image path - convert Pictures/ to Images/ and handle binary data
                if ($concern['concern_image']) {
                    // Check if it's a file path or binary data
                    if (strpos($concern['concern_image'], 'Images/') === 0 || strpos($concern['concern_image'], 'Pictures/') === 0) {
                        // It's a file path, convert Pictures/ to Images/
                        $concern['concern_image'] = str_replace('Pictures/', 'Images/', $concern['concern_image']);
                    } else if (strlen($concern['concern_image']) > 100) {
                        // It's binary data - use the same file with image parameter
                        $concern['concern_image'] = 'php/concerns.php?image=true&id=' . $concern['concern_id'];
                    }
                }
                
                // Format the date for display
                if ($concern['date_and_time']) {
                    $date = new DateTime($concern['date_and_time']);
                    $concern['formatted_date'] = $date->format('M j, Y - g:i A');
                } else {
                    $concern['formatted_date'] = 'No date';
                }
                
                // Format the resolved date for display (AM/PM format)
                if ($concern['resolved_at']) {
                    $resolvedDate = new DateTime($concern['resolved_at']);
                    $concern['formatted_resolved_date'] = $resolvedDate->format('M j, Y - g:i A');
                } else {
                    $concern['formatted_resolved_date'] = null;
                }
                
                // Format the processed date for display (AM/PM format)
                if (isset($concern['process_at']) && $concern['process_at']) {
                    $processedDate = new DateTime($concern['process_at']);
                    $concern['formatted_processed_date'] = $processedDate->format('M j, Y - g:i A');
                } else {
                    $concern['formatted_processed_date'] = null;
                }
                
                // Clean UTF-8 encoding issues (simplified to avoid timeout)
                foreach ($concern as $key => $value) {
                    if (is_string($value)) {
                        // Simple UTF-8 cleaning without expensive operations
                        $concern[$key] = mb_convert_encoding($value, 'UTF-8', 'UTF-8');
                    }
                }
            }
            
            $countsQuery = "SELECT 
                COALESCE(SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END), 0) AS cnt_new,
                COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0) AS cnt_processing,
                COALESCE(SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END), 0) AS cnt_resolved,
                COUNT(*) AS cnt_total
                FROM concerns";
            $countsRes = $connection->query($countsQuery);
            $countsRow = $countsRes ? $countsRes->fetch_assoc() : null;
            $countsPayload = [
                'new' => (int)($countsRow['cnt_new'] ?? 0),
                'processing' => (int)($countsRow['cnt_processing'] ?? 0),
                'resolved' => (int)($countsRow['cnt_resolved'] ?? 0),
                'total' => (int)($countsRow['cnt_total'] ?? 0),
            ];
            
            echo json_encode(['success' => true, 'data' => $concerns, 'counts' => $countsPayload]);
            break;
            
        case 'PUT':
            // Check user permissions before allowing status changes
            
            
            // Check if this is an admin user accessing via email-based auth
            $adminEmail = $_GET['admin_email'] ?? $_SERVER['HTTP_X_ADMIN_EMAIL'] ?? null;
            $isAdmin = false;
            
            if ($adminEmail) {
                // Verify this email has admin position in database
                try {
                    $emailEsc = $connection->real_escape_string($adminEmail);
                    $sql = "SELECT position FROM brgy_users WHERE email='{$emailEsc}' AND action='accepted'";
                    $result = $connection->query($sql);
                    $row = $result->fetch_assoc();
                    
                    if ($row && $row['position'] === 'Admin') {
                        $isAdmin = true;
                    }
                } catch (Exception $e) {
                    // Database error, continue with normal flow
                }
            }
            
            if (!$isAdmin && !canEdit('concerns')) {
                echo json_encode(['success' => false, 'message' => 'You do not have permission to modify concerns']);
                break;
            }
            
            // Update concern status or risk level
            $rawInput = file_get_contents('php://input');
            $input = json_decode($rawInput, true);
            $concernId = $input['concern_id'] ?? null;
            $newStatus = $input['status'] ?? null;
            $riskLevel = $input['risk_level'] ?? null;
            
            if ($concernId) {
                // Extract the ID from concern_id (e.g., CON-001 -> 1)
                $id = intval(str_replace('CON-', '', $concernId));
                
                // Handle risk level update
                if ($riskLevel !== null) {
                    // Validate risk level
                    if (!in_array($riskLevel, ['low', 'medium', 'high', ''])) {
                        echo json_encode(['success' => false, 'message' => 'Invalid risk level']);
                        break;
                    }
                    
                    // Check if risk_level column exists, if not, add it
                    $checkColumn = $connection->query("SHOW COLUMNS FROM concerns LIKE 'risk_level'");
                    if ($checkColumn->num_rows === 0) {
                        $connection->query("ALTER TABLE concerns ADD COLUMN risk_level VARCHAR(10) DEFAULT NULL");
                    }
                    
                    $sql = "UPDATE concerns SET risk_level = ? WHERE id = ?";
                    $stmt = $connection->prepare($sql);
                    $riskValue = $riskLevel === '' ? null : $riskLevel;
                    $stmt->bind_param('si', $riskValue, $id);
                    $result = $stmt->execute();
                    
                    if ($result) {
                        echo json_encode(['success' => true, 'message' => 'Risk level updated successfully']);
                    } else {
                        echo json_encode(['success' => false, 'message' => 'Failed to update risk level']);
                    }
                    break;
                }
                
                // Handle status update
                if ($newStatus) {
                    // If status is 'resolved' or 'processing', set corresponding timestamp using PH time
                    if ($newStatus === 'resolved') {
                        $resolvedAt = new DateTime('now', new DateTimeZone(DEFAULT_TIMEZONE));
                        $sql = "UPDATE concerns SET status = ?, resolved_at = ? WHERE id = ?";
                        $stmt = $connection->prepare($sql);
                        // Store as DATETIME-safe format in Asia/Manila
                        $stmt->bind_param('ssi', $newStatus, $resolvedAt->format('Y-m-d H:i:s'), $id);
                        $result = $stmt->execute();
                    } elseif ($newStatus === 'processing') {
                        $processedAt = new DateTime('now', new DateTimeZone(DEFAULT_TIMEZONE));
                        $sql = "UPDATE concerns SET status = ?, process_at = ? WHERE id = ?";
                        $stmt = $connection->prepare($sql);
                        // Store as DATETIME-safe format in Asia/Manila
                        $stmt->bind_param('ssi', $newStatus, $processedAt->format('Y-m-d H:i:s'), $id);
                        $result = $stmt->execute();
                    } else {
                        $sql = "UPDATE concerns SET status = ? WHERE id = ?";
                        $stmt = $connection->prepare($sql);
                        $stmt->bind_param('si', $newStatus, $id);
                        $result = $stmt->execute();
                    }
                    
                    if ($result) {
                        echo json_encode(['success' => true, 'message' => 'Concern status updated successfully']);
                    } else {
                        echo json_encode(['success' => false, 'message' => 'Failed to update concern status']);
                    }
                } else {
                    echo json_encode(['success' => false, 'message' => 'Missing required parameters']);
                }
            } else {
                echo json_encode(['success' => false, 'message' => 'Missing concern ID']);
            }
            break;
            
        case 'POST':
            // Handle finding similar concerns using AI
            $rawInput = file_get_contents('php://input');
            $input = json_decode($rawInput, true);
            $action = $input['action'] ?? null;
            
            if ($action === 'find_similar') {
                $concernId = $input['concern_id'] ?? null;
                
                if (!$concernId) {
                    echo json_encode(['success' => false, 'message' => 'Missing concern ID']);
                    break;
                }
                
                // Extract the ID from concern_id (e.g., CON-001 -> 1)
                $id = intval(str_replace('CON-', '', $concernId));
                
                // Get the base concern
                $sql = "SELECT id, concern_image, reporter_name, contact, date_and_time, location, statement, status, COALESCE(risk_level, '') as risk_level FROM concerns WHERE id = ?";
                $stmt = $connection->prepare($sql);
                $stmt->bind_param('i', $id);
                $stmt->execute();
                $baseConcern = $stmt->get_result()->fetch_assoc();
                
                if (!$baseConcern) {
                    echo json_encode(['success' => false, 'message' => 'Concern not found']);
                    break;
                }
                
                // Add concern_id to base concern
                $baseConcern['concern_id'] = 'CON-' . str_pad($baseConcern['id'], 3, '0', STR_PAD_LEFT);
                
                // Get all concerns for comparison
                $sql = "SELECT id, concern_image, reporter_name, contact, date_and_time, location, statement, status, COALESCE(risk_level, '') as risk_level FROM concerns ORDER BY date_and_time DESC LIMIT 100";
                $result = $connection->query($sql);
                $allConcerns = $result->fetch_all(MYSQLI_ASSOC);
                
                // Add concern_id to all concerns
                foreach ($allConcerns as &$concern) {
                    $concern['concern_id'] = 'CON-' . str_pad($concern['id'], 3, '0', STR_PAD_LEFT);
                }
                
                // Use AI to find similar concerns
                $similarIds = findSimilarConcernsWithAI($baseConcern, $allConcerns);
                
                echo json_encode([
                    'success' => true,
                    'similar_ids' => $similarIds
                ]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Invalid action']);
            }
            break;
            
        default:
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
            break;
    }
    
} catch(mysqli_sql_exception $e) {
    // Check if it's a timeout error
    if (strpos($e->getMessage(), 'timeout') !== false || strpos($e->getMessage(), 'Maximum execution time') !== false) {
        echo json_encode(['success' => false, 'message' => 'Request timeout - database query took too long']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()]);
    }
} catch(Exception $e) {
    // Check if it's a timeout error
    if (strpos($e->getMessage(), 'timeout') !== false || strpos($e->getMessage(), 'Maximum execution time') !== false) {
        echo json_encode(['success' => false, 'message' => 'Request timeout - operation took too long']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
    }
}
?>