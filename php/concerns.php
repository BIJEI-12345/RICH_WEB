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

// Same session storage as login.php / userSession.php (required or PHP uses a different save path and loses login)
require_once __DIR__ . '/init_session.php';
require_once __DIR__ . '/config.php';

if (session_status() === PHP_SESSION_NONE) {
    rich_session_start();
}

function rich_session_position_normalized() {
    if (!isset($_SESSION['position'])) {
        return '';
    }
    return strtolower(trim((string) $_SESSION['position']));
}

function rich_session_is_admin() {
    $p = rich_session_position_normalized();
    return $p === 'admin' || $p === 'administrator';
}

function rich_session_is_concerns_reporting_role() {
    $p = preg_replace('/\s+/', ' ', rich_session_position_normalized());
    return $p === 'concerns & reporting' || $p === 'concern & reporting';
}

// Simple permission helper mirrored with frontend rules
function canEdit($module) {
    if (rich_session_is_admin()) {
        return true;
    }
    $position = rich_session_position_normalized();
    if ($module === 'reqDocu') {
        return $position === 'document request category';
    }
    if ($module === 'concerns') {
        return rich_session_is_concerns_reporting_role();
    }
    if ($module === 'emergency') {
        return ($position === 'emergency' || $position === 'emergency category');
    }
    return false;
}

/**
 * Keyword-only HIGH detection (used when Groq is unavailable or fails).
 */
function concernStatementIndicatesHighRiskByKeywords($statementLower) {
    $highRiskKeywords = [
        'nabagok', 'natamaan', 'nabunggo', 'nabugbog', 'nabasag', 'nasugatan', 'nasaktan', 'nabalian',
        'nabali', 'naputol', 'nakagat', 'natapilok',
        'hospital', 'emergency', 'nahihimatay', 'dumudugo', 'unconscious', 'kailangan ng doktor',
        'may nasugatan', 'may nasaktan', 'may sugat',
        'sakuna', 'trahedya', 'disgrasya', 'malubhang aksidente',
        'nadulas na motor', 'nadulas na sasakyan', 'naaksidente', 'nabangga', 'nabunggo na motor',
        'nabunggo na sasakyan', 'accident', 'crash', 'collision', 'natumba',
        'may aksidente', 'may nabangga', 'may nabunggo',
        'sunog', 'fire', 'nagliliyab', 'burning', 'nasusunog', 'may sunog', 'nagkasunog',
        'nag-away', 'nagaway', 'may away', 'may nag-away', 'may nagaway', 'may nananakit',
        'may nagbabangga', 'violence', 'nag-away at may nasaktan', 'nagaway at may nasugatan',
        'gumuguho', 'nagguho', 'bumagsak', 'nabagsak', 'nagiba', 'nagiba na bahay',
        'nagiba na gusali', 'collapse', 'collapsed', 'may gumuguho',
        'nabagok ang ulo', 'natamaan ang ulo', 'nabunggo ang ulo', 'nabugbog ang ulo',
        'nasaktan ang ulo', 'nasugatan ang ulo', 'nabalian ng ulo',
        'kuryente', 'nakakuryente', 'nakuryente', 'electrocution', 'electrical shock',
        'nagliyab ang kuryente', 'sunog sa kuryente', 'electrical fire',
        'live wire', 'exposed wire', 'nakalutang na wire', 'poste ng kuryente',
        'transformer', 'power line', 'high voltage',
        'nasira ang tulay', 'sira ang tulay', 'delikadong tulay', 'delikadong imprastraktura',
        'delikadong istruktura', 'mabagsak na gusali', 'gumuho ang kalsada'
    ];
    
    foreach ($highRiskKeywords as $keyword) {
        if (mb_stripos($statementLower, $keyword) !== false) {
            return true;
        }
    }
    
    if ((mb_stripos($statementLower, 'ulo') !== false || mb_stripos($statementLower, 'head') !== false)
        && (mb_stripos($statementLower, 'nabagok') !== false || mb_stripos($statementLower, 'natamaan') !== false
            || mb_stripos($statementLower, 'nabunggo') !== false || mb_stripos($statementLower, 'nasugatan') !== false
            || mb_stripos($statementLower, 'nasaktan') !== false)) {
        return true;
    }
    
    if ((mb_stripos($statementLower, 'motor') !== false || mb_stripos($statementLower, 'motorcycle') !== false
        || mb_stripos($statementLower, 'sasakyan') !== false || mb_stripos($statementLower, 'vehicle') !== false)
        && (mb_stripos($statementLower, 'nadulas') !== false || mb_stripos($statementLower, 'accident') !== false
            || mb_stripos($statementLower, 'nabangga') !== false || mb_stripos($statementLower, 'nabunggo') !== false
            || mb_stripos($statementLower, 'crash') !== false || mb_stripos($statementLower, 'collision') !== false)) {
        return true;
    }
    
    if ((mb_stripos($statementLower, 'tulay') !== false || mb_stripos($statementLower, 'bridge') !== false)
        && (mb_stripos($statementLower, 'nasira') !== false || mb_stripos($statementLower, 'sira') !== false
            || mb_stripos($statementLower, 'delikado') !== false || mb_stripos($statementLower, 'gumuho') !== false)) {
        return true;
    }
    
    if ((mb_stripos($statementLower, 'imprastraktura') !== false || mb_stripos($statementLower, 'istruktura') !== false)
        && (mb_stripos($statementLower, 'delikado') !== false || mb_stripos($statementLower, 'mabagsak') !== false
            || mb_stripos($statementLower, 'gumuho') !== false || mb_stripos($statementLower, 'bumagsak') !== false)) {
        return true;
    }
    
    $imminentHarmKeywords = [
        'nakakamatay', 'panganib sa buhay', 'delikado ang buhay', 'malubhang pinsala',
        'life-threatening', 'critical condition', 'nagbabanta ng patay', 'may baril',
        'may sandata', 'hostage', 'kidnap', 'nakakulong na biktima',
        'banta sa buhay', 'binabanta', 'pagbabanta', 'pagbabanta ng', 'binanta',
        'may biktima', 'maraming nasaktan'
    ];
    foreach ($imminentHarmKeywords as $keyword) {
        if (mb_stripos($statementLower, $keyword) !== false) {
            return true;
        }
    }
    
    // Fallen / damaged utility pole with electrical hazard cues
    if (mb_stripos($statementLower, 'poste') !== false) {
        if (mb_stripos($statementLower, 'wire') !== false
            || mb_stripos($statementLower, 'kawad') !== false
            || mb_stripos($statementLower, 'naputol') !== false
            || mb_stripos($statementLower, 'kuryente') !== false
            || mb_stripos($statementLower, 'transformer') !== false
            || mb_stripos($statementLower, 'high voltage') !== false) {
            return true;
        }
        if (mb_stripos($statementLower, 'natumba') !== false
            || mb_stripos($statementLower, 'tumumba') !== false
            || mb_stripos($statementLower, 'bumagsak') !== false
            || mb_stripos($statementLower, 'nabagsak') !== false) {
            return true;
        }
    }
    
    return false;
}

/**
 * Road / public infrastructure / local environment issues that should be at least MEDIUM (not LOW).
 * Used after Groq when the model under-rates, and for re-analysis of stored LOW concerns.
 */
function concernStatementIndicatesMediumInfrastructureOrEnvironment($statementLower) {
    if (concernStatementIndicatesHighRiskByKeywords($statementLower)) {
        return false;
    }
    $phrases = [
        'sirang kalsada', 'sirang kalye', 'sirang daan', 'sirang imprastraktura', 'sirang calsada',
        'sira ang kalsada', 'nasira ang kalsada', 'problema sa kalsada', 'kalsadang sira',
        'butas sa kalsada', 'may butas sa kalsada', 'maraming lubak', 'kalat sa kalsada',
    ];
    foreach ($phrases as $p) {
        if (mb_stripos($statementLower, $p) !== false) {
            return true;
        }
    }
    $hasRoad = mb_stripos($statementLower, 'kalsada') !== false
        || mb_stripos($statementLower, 'kalye') !== false
        || mb_stripos($statementLower, 'highway') !== false;
    if ($hasRoad) {
        if (mb_stripos($statementLower, 'sirang') !== false
            || mb_stripos($statementLower, 'nasira') !== false
            || mb_stripos($statementLower, 'sira ang') !== false
            || mb_stripos($statementLower, 'lubak') !== false
            || mb_stripos($statementLower, 'butas') !== false) {
            return true;
        }
        if (mb_stripos($statementLower, 'truck') !== false
            || mb_stripos($statementLower, 'trailer') !== false
            || mb_stripos($statementLower, 'dump truck') !== false) {
            return true;
        }
    }
    if (mb_stripos($statementLower, 'kapaligiran') !== false) {
        if (mb_stripos($statementLower, 'basura') !== false
            || mb_stripos($statementLower, 'marumi') !== false
            || mb_stripos($statementLower, 'usok') !== false
            || mb_stripos($statementLower, 'pollution') !== false
            || (mb_stripos($statementLower, 'tubig') !== false && mb_stripos($statementLower, 'marumi') !== false)) {
            return true;
        }
    }
    return false;
}

function getMediumRiskKeywordsForConcernFallback() {
    return [
        'barado', 'baradong', 'blocked', 'blockage', 'drainage', 'drain', 'kanal', 'sewer',
        'baradong kanal', 'baradong drainage', 'barado ang kanal', 'barado ang drainage',
        'blocked drainage', 'blocked kanal', 'blocked sewer', 'blocked drain',
        'sira ang', 'sira ang ilaw', 'broken', 'damaged', 'nasira', 'nasira ang',
        'sira ang poste', 'sira ang ilaw sa kalye', 'sira ang streetlight',
        'broken light', 'broken streetlight', 'broken lamp post',
        'may tumutulo', 'tumutulo', 'leak', 'leaking', 'water leak',
        'may tumutulo na tubig', 'tumutulo ang tubig', 'may leak sa tubig',
        'leaking water', 'leaking pipe', 'water pipe leak',
        'may lubak', 'lubak', 'pothole', 'potholes', 'damaged road',
        'may lubak sa kalsada', 'may pothole', 'may potholes', 'may damaged road',
        'damaged kalsada', 'sira ang kalsada', 'nasira ang kalsada',
        'sirang kalsada', 'sirang kalye', 'sirang daan', 'problema sa kalsada', 'kalsadang sira',
        'walang ilaw', 'wala ng ilaw', 'streetlight', 'street light', 'streetlight broken',
        'walang ilaw sa kalye', 'wala ng streetlight', 'sira ang streetlight',
        'broken streetlight', 'damaged streetlight',
        'hindi nakolekta', 'nakolekta', 'garbage', 'basura', 'trash',
        'hindi nakolekta ang basura', 'hindi nakolekta ang garbage', 'hindi nakolekta ang trash',
        'walang nagkokolekta ng basura', 'walang nagkokolekta ng garbage',
        'walang tubig', 'wala ng tubig', 'water supply', 'problema sa tubig',
        'walang tubig sa area', 'wala ng tubig supply', 'problema sa tubig supply',
        'walang tubig sa lugar', 'wala ng tubig sa amin',
        'may ingay', 'ingay', 'noise', 'trapiko', 'traffic',
        'may ingay gabi-gabi', 'may ingay sa gabi', 'may malakas na ingay',
        'problema sa trapiko', 'problema sa traffic', 'heavy traffic',
        'vandalism', 'graffiti', 'nasira ang', 'damaged',
        'may vandalism', 'may graffiti', 'nasira ang public property',
        'damaged public facility', 'damaged bench', 'damaged playground',
        'may baha', 'baha', 'flooding', 'flood',
        'may baha sa area', 'may flooding', 'may flood', 'baha sa lugar',
        'sidewalk', 'walkway', 'damaged sidewalk', 'damaged walkway',
        'sira ang sidewalk', 'nasira ang sidewalk', 'sira ang walkway',
        'broken sidewalk', 'broken walkway',
        'may problema sa', 'problema sa', 'may issue sa',
        'hindi gumagana', 'not working', 'may sira'
    ];
}

// Groq first when API key is set; keyword fallback when key missing or Groq fails
function analyzeRiskLevel($statement) {
    if (empty($statement) || strlen(trim($statement)) < 5) {
        return 'low';
    }
    
    $statementLower = mb_strtolower($statement, 'UTF-8');
    $mediumRiskKeywords = getMediumRiskKeywordsForConcernFallback();
    
    $apiKey = (defined('GROQ_API_KEY') && GROQ_API_KEY !== '') ? trim((string) GROQ_API_KEY) : '';
    if ($apiKey !== '') {
        $groqLevel = groqClassifyConcernRiskFromStatement($statement, $apiKey);
        if ($groqLevel !== null) {
            // Safety net: keyword HIGH overrides Groq low/medium (model can misclassify life-safety cases)
            if (concernStatementIndicatesHighRiskByKeywords($statementLower)) {
                return 'high';
            }
            // Road / infrastructure / environment: Groq sometimes returns LOW — bump to MEDIUM when cues match
            if ($groqLevel === 'low' && concernStatementIndicatesMediumInfrastructureOrEnvironment($statementLower)) {
                return 'medium';
            }
            return $groqLevel;
        }
        error_log('Groq risk classification failed; using keyword fallback');
    }
    
    if (concernStatementIndicatesHighRiskByKeywords($statementLower)) {
        return 'high';
    }
    
    foreach ($mediumRiskKeywords as $keyword) {
        if (mb_stripos($statementLower, $keyword) !== false) {
            return 'medium';
        }
    }
    
    return 'low';
}

/**
 * Classify concern risk via Groq OpenAI-compatible Chat Completions API.
 * Returns low|medium|high or null on HTTP/parse failure.
 */
function groqClassifyConcernRiskFromStatement($statement, $apiKey) {
    $apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    
    $prompt = "You classify a barangay (community) resident's concern statement for triage. Base your answer ONLY on the statement text.\n\n";
    
    $prompt .= "HIGH — Mataas na tyansa ng kapahamakan sa tao (serious harm, imminent danger, or life-safety emergency):\n";
    $prompt .= "- May nasaktan, nasugatan, biktima, malubhang pinsala, sakuna/trahedya/disgrasya na may panganib sa tao\n";
    $prompt .= "- Sunog, medical emergency, himatay, malubhang pagdurugo, karahasan na may nasaktan\n";
    $prompt .= "- KURYENTE / electrical hazard: nakakuryente, bukas o live na kawad, poste/transformer na natumba o nagliyab, sunog dahil sa kuryente, high voltage na delikado sa publiko\n";
    $prompt .= "- NASIRANG IMPRASTRAKTURA na puwedeng magdulot ng malubhang pinsala o kamatayan: gumuguhong gusali/tulay, tulay o kalsadang delikado at mabagsak, istruktura na malapit nang bumagsak\n";
    $prompt .= "- BANTA SA BUHAY, pagbabanta, hostage, kidnapan, may baril/sandata, life-threatening na sitwasyon\n";
    $prompt .= "English: electrocution risk, fallen power lines, electrical fire, bridge/building collapse risk, disaster with casualties.\n\n";
    
    $prompt .= "MEDIUM — Hindi masyadong direktang malubhang kapahamakan sa tao kumpara sa HIGH, pero may tunay na problema sa serbisyo o imprastraktura o kapaligiran:\n";
    $prompt .= "- Baradong kanal, tumutulo na tubig (hindi electrical), ordinaryong sira ng streetlight, lubak, walang tubig, basura, ingay, trapiko\n";
    $prompt .= "- SIRANG o NASIRANG KALSADA / KALYE / DAAN: kasama kung dahil sa mabibigat na sasakyan, malalaking truck, dump truck, o pasada — palaging MEDIUM (hindi LOW)\n";
    $prompt .= "- Halimbawa MEDIUM: 'Sirang kalsada dahil sa malalaking truck na dumadaan', 'may lubak sa kalsada', 'sira ang kalye'\n";
    $prompt .= "- Baha o ulan na abala kung hindi inilarawan bilang delikado sa buhay o guho\n";
    $prompt .= "- Isyu sa kapaligiran (basura, maruming tubig, usok) na nangangailangan ng aksyon ng barangay — MEDIUM kung may konkretong problema\n";
    $prompt .= "- Sira sa pasilidad na hindi tinutukoy na may kuryente o delikadong pagbagsak\n";
    $prompt .= "HINDI MEDIUM kung may malinaw na panganib sa kuryente o banta sa buhay — doon ay HIGH.\n\n";
    
    $prompt .= "LOW — Minor concerns lamang:\n";
    $prompt .= "- Tanong, permiso, dokumento, suggestion, kosmetiko/aesthetic, napakaliit na isyu na walang malinaw na panganib o abala sa serbisyo\n\n";
    
    $prompt .= "RULES:\n";
    $prompt .= "- Use HIGH for electricity hazards, life threats, serious injury/victims, disasters implying harm, or critically dangerous damaged infrastructure.\n";
    $prompt .= "- Use MEDIUM for routine public works issues without those HIGH signals.\n";
    $prompt .= "- NEVER use LOW for damaged roads, potholes, or heavy vehicles damaging streets — those are MEDIUM.\n";
    $prompt .= "- Use LOW only for inquiries or trivial matters.\n";
    $prompt .= "- If unsure between LOW and MEDIUM, prefer MEDIUM when a concrete public problem is described.\n\n";
    
    $prompt .= "Statement:\n\"" . addslashes($statement) . "\"\n\n";
    $prompt .= "Reply with exactly one word, lowercase: low, medium, or high";
    
    $requestData = [
        'model' => 'llama-3.1-8b-instant',
        'messages' => [
            [
                'role' => 'system',
                'content' => 'You are a risk triage assistant for barangay concerns. Output exactly one word: low, medium, or high. No punctuation or explanation.'
            ],
            [
                'role' => 'user',
                'content' => $prompt
            ]
        ],
        'temperature' => 0.15,
        'max_tokens' => 12
    ];
    
    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($response === false || !empty($curlError) || $httpCode !== 200) {
        error_log("Groq AI API error (risk): HTTP $httpCode, Error: $curlError, Response: " . substr((string) $response, 0, 200));
        return null;
    }
    
    $result = json_decode($response, true);
    
    if (isset($result['choices'][0]['message']['content'])) {
        $aiResponse = trim(strtolower($result['choices'][0]['message']['content']));
        
        if (preg_match('/\bhigh\b/', $aiResponse)) {
            return 'high';
        }
        if (preg_match('/\bmedium\b/', $aiResponse)) {
            return 'medium';
        }
        if (preg_match('/\blow\b/', $aiResponse)) {
            return 'low';
        }
    }
    
    error_log('Could not parse Groq risk response: ' . substr(json_encode($result), 0, 500));
    return null;
}

/**
 * Normalize location strings for comparison (spacing, case-insensitive UTF-8, optional Barangay prefix).
 */
function normalizeLocationForComparison($loc) {
    $s = trim((string) $loc);
    if (function_exists('mb_strtolower')) {
        $s = mb_strtolower($s, 'UTF-8');
    } else {
        $s = strtolower($s);
    }
    $s = preg_replace('/\s+/', ' ', $s);
    $s = preg_replace('/^(brgy\.?|barangay)\s+/iu', '', $s);
    return trim($s);
}

/**
 * True when two location strings likely refer to the same place (fuzzy, not only exact match).
 */
function locationsReferToSamePlace($baseRaw, $otherRaw) {
    $a = normalizeLocationForComparison($baseRaw);
    $b = normalizeLocationForComparison($otherRaw);
    if ($a === '' && $b === '') {
        return true;
    }
    if ($a === '' || $b === '') {
        return false;
    }
    if ($a === $b) {
        return true;
    }
    $lenA = strlen($a);
    $lenB = strlen($b);
    $shorter = $lenA <= $lenB ? $a : $b;
    $longer = $lenA <= $lenB ? $b : $a;
    if (strlen($shorter) >= 4 && strpos($longer, $shorter) !== false) {
        return true;
    }
    $maxLen = max($lenA, $lenB);
    if ($maxLen > 64) {
        return false;
    }
    $dist = levenshtein($a, $b);
    $maxAllowed = $maxLen <= 18 ? 3 : (int) max(4, min(12, round($maxLen * 0.18)));
    return $dist <= $maxAllowed;
}

/** Word tokens for statement overlap (aligned with js/concerns.js normalizeStatementWords). */
function normalizeStatementWordsPhp($text) {
    $text = strtolower((string) $text);
    $text = preg_replace('/[^a-z0-9\s]/u', ' ', $text);
    $parts = preg_split('/\s+/', trim($text), -1, PREG_SPLIT_NO_EMPTY);
    $out = [];
    foreach ($parts as $word) {
        if (mb_strlen($word, 'UTF-8') >= 3) {
            $out[] = $word;
        }
    }
    return $out;
}

/**
 * Broad issue buckets (Tagalog + English) so different phrasings still match, e.g. kinuha vs kumukolekta basura.
 *
 * @return array<string, list<string>>
 */
function getRelatableIssueCategoryDefinitions() {
    return [
        'waste' => ['basura', 'kalat', 'kolekta', 'kolektahin', 'kinuha', 'kumuha', 'kumukulekta', 'kumukolekta', 'nakolekta', 'pagkolekta', 'kolektor', 'trash', 'garbage', 'waste', 'segregat'],
        'drainage' => ['kanal', 'drainage', 'bara', 'barado', 'baradong', 'bumabaha', 'baha'],
        'water' => ['tubig', 'water', 'leak', 'tumutulo', 'tulo', 'walang tubig'],
        'light' => ['ilaw', 'light', 'streetlight', 'street light'],
        'road' => ['lubak', 'kalsada', 'road', 'pothole', 'sidewalk'],
        'noise' => ['ingay', 'noise', 'trapiko', 'traffic'],
    ];
}

/** @return list<string> */
function relatableIssueCategoryKeysForStatementPhp($statement) {
    $s = mb_strtolower((string) $statement, 'UTF-8');
    $found = [];
    foreach (getRelatableIssueCategoryDefinitions() as $key => $keywords) {
        foreach ($keywords as $kw) {
            if (mb_strlen($kw, 'UTF-8') < 2) {
                continue;
            }
            if (mb_stripos($s, $kw, 0, 'UTF-8') !== false) {
                $found[$key] = true;
                break;
            }
        }
    }
    return array_keys($found);
}

function relatableSameIssueCategoryPhp($statementA, $statementB) {
    $a = relatableIssueCategoryKeysForStatementPhp($statementA);
    $b = relatableIssueCategoryKeysForStatementPhp($statementB);
    if ($a === [] || $b === []) {
        return false;
    }
    return count(array_intersect($a, $b)) > 0;
}

/** Same 0–1+ scale as getConcernsSimilarityScore in js/concerns.js (location + word overlap). */
function relatableStatementLocationScorePhp($baseStatement, $baseLocation, $otherStatement, $otherLocation) {
    $baseWords = array_unique(normalizeStatementWordsPhp($baseStatement));
    $otherWords = array_unique(normalizeStatementWordsPhp($otherStatement));
    $baseSet = array_fill_keys($baseWords, true);
    $common = 0;
    foreach ($otherWords as $w) {
        if (isset($baseSet[$w])) {
            $common++;
        }
    }
    $wordMatchScore = count($baseWords) > 0 ? ($common / count($baseWords)) : 0;
    $locA = normalizeLocationForComparison($baseLocation);
    $locB = normalizeLocationForComparison($otherLocation);
    $sameArea = locationsReferToSamePlace($baseLocation, $otherLocation);
    $locationMatch = $sameArea && !($locA === '' && $locB === '');
    return min($wordMatchScore, 0.6) + ($locationMatch ? 0.4 : 0.0);
}

/** All concerns that meet score rule OR same-area + same issue category (handles different Tagalog phrasing). */
function findRuleBasedRelatableIds($baseConcern, $allConcerns, $minScore = 0.35) {
    $baseId = $baseConcern['concern_id'] ?? '';
    $baseStatement = $baseConcern['statement'] ?? '';
    $baseLocation = $baseConcern['location'] ?? '';
    $ids = [];
    foreach ($allConcerns as $c) {
        $cid = isset($c['concern_id']) ? $c['concern_id'] : ('CON-' . str_pad((string)$c['id'], 3, '0', STR_PAD_LEFT));
        if ($cid === $baseId) {
            continue;
        }
        $otherStatement = $c['statement'] ?? '';
        $otherLocation = $c['location'] ?? '';
        $score = relatableStatementLocationScorePhp(
            $baseStatement,
            $baseLocation,
            $otherStatement,
            $otherLocation
        );
        $sameArea = locationsReferToSamePlace($baseLocation, $otherLocation);
        $sameCategory = relatableSameIssueCategoryPhp($baseStatement, $otherStatement);
        if ($score >= $minScore || ($sameArea && $sameCategory)) {
            $ids[] = $cid;
        }
    }
    return $ids;
}

function enrichConcernRowForRelatableModal(array $concern) {
    $id = (int)($concern['id'] ?? 0);
    $concern['concern_id'] = 'CON-' . str_pad((string)$id, 3, '0', STR_PAD_LEFT);
    if (!empty($concern['concern_image'])) {
        $img = $concern['concern_image'];
        if (strpos($img, 'Images/') === 0 || strpos($img, 'Pictures/') === 0) {
            $concern['concern_image'] = str_replace('Pictures/', 'Images/', $img);
        } elseif (strlen($img) > 100) {
            $concern['concern_image'] = 'php/concerns.php?image=true&id=' . $concern['concern_id'];
        }
    }
    if (!isset($concern['risk_level'])) {
        $concern['risk_level'] = '';
    }
    return $concern;
}

/** @return list<array<string,mixed>> */
function fetchConcernsByNumericIds(mysqli $connection, array $idsInt) {
    $idsInt = array_values(array_unique(array_filter(array_map('intval', $idsInt))));
    if (empty($idsInt)) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($idsInt), '?'));
    $sql = "SELECT id, concern_image, reporter_name, contact, date_and_time, location, statement, status, COALESCE(risk_level, '') as risk_level FROM concerns WHERE id IN ($placeholders)";
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        return [];
    }
    $types = str_repeat('i', count($idsInt));
    $stmt->bind_param($types, ...$idsInt);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    return $rows;
}

// Function to find similar concerns using Groq AI
function findSimilarConcernsWithAI($baseConcern, $allConcerns) {
    if (!defined('GROQ_API_KEY') || (string) GROQ_API_KEY === '') {
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
    
    // Same-area candidates only; sort by statement+location score so the top 75 are most likely related.
    $scored = [];
    foreach ($allConcerns as $concern) {
        $concernId = 'CON-' . str_pad($concern['id'], 3, '0', STR_PAD_LEFT);
        if ($concernId === $baseConcernId) {
            continue;
        }
        if (!locationsReferToSamePlace($baseLocation, $concern['location'] ?? '')) {
            continue;
        }
        $relScore = relatableStatementLocationScorePhp(
            $baseStatement,
            $baseLocation,
            $concern['statement'] ?? '',
            $concern['location'] ?? ''
        );
        $scored[] = [
            'rel_score' => $relScore,
            'row' => [
                'id' => $concernId,
                'statement' => $concern['statement'] ?? '',
                'location' => $concern['location'] ?? '',
                'image' => !empty($concern['concern_image']) ? 'Has image' : 'No image'
            ]
        ];
    }
    
    if (empty($scored)) {
        return [];
    }
    
    usort($scored, function ($a, $b) {
        return $b['rel_score'] <=> $a['rel_score'];
    });
    
    $maxCandidates = 75;
    if (count($scored) > $maxCandidates) {
        $scored = array_slice($scored, 0, $maxCandidates);
    }
    
    $otherConcerns = array_map(function ($s) {
        return $s['row'];
    }, $scored);
    
    $sentIdSet = [];
    foreach ($otherConcerns as $row) {
        $sentIdSet[$row['id']] = true;
    }
    
    $normBaseLoc = normalizeLocationForComparison($baseLocation);
    $locNote = $normBaseLoc !== ''
        ? 'All concerns listed below are already filtered to the same general area as the base (addresses may be worded differently).'
        : 'Location was not specified on some records; treat same-area as already applied by the system.';
    
    // Semantic same-issue matching at the same place; wording need not be identical.
    $prompt = "You triage barangay (community) concerns. {$locNote}\n\n";
    $prompt .= "BASE CONCERN:\n";
    $prompt .= "Statement: \"" . addslashes($baseStatement) . "\"\n";
    $prompt .= "Location: \"" . addslashes($baseLocation) . "\"\n";
    $prompt .= "Image: " . $baseImage . "\n\n";
    
    $prompt .= "OTHER CONCERNS (same general area as base):\n";
    foreach ($otherConcerns as $idx => $concern) {
        $prompt .= ($idx + 1) . ". ID: " . $concern['id'] . "\n";
        $prompt .= "   Statement: \"" . addslashes($concern['statement']) . "\"\n";
        $prompt .= "   Location: \"" . addslashes($concern['location']) . "\"\n";
        $prompt .= "   Image: " . $concern['image'] . "\n\n";
    }
    
    $prompt .= "TASK: Return IDs where the reported problem is substantively the SAME underlying issue as the base (same hazard, same infrastructure, same service problem), even if phrasing differs.\n\n";
    $prompt .= "Rules:\n";
    $prompt .= "- Match: same issue type (e.g. drainage/kanal, street lights, water leak, road damage) described for the same place.\n";
    $prompt .= "- Do NOT match a clearly different issue at that place (e.g. garbage vs street lights, noise vs flooding).\n";
    $prompt .= "- Prefer precision: when unsure, exclude the ID.\n";
    $prompt .= "- Image presence is a weak hint only; do not decide mainly on image.\n";
    $prompt .= "- Include EVERY qualifying ID from the numbered list (all rows that match), separated by commas — not only the single closest match.\n\n";
    $prompt .= "Output ONLY a comma-separated list of matching concern IDs (e.g. CON-001,CON-002,CON-003). No other text.\n";
    $prompt .= "If none qualify, output exactly: NONE";
    
    $requestData = [
        'model' => 'llama-3.1-8b-instant',
        'messages' => [
            [
                'role' => 'user',
                'content' => $prompt
            ]
        ],
        'temperature' => 0.3,
        'max_tokens' => 512
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
        $similarIds = array_values(array_unique($matches[0] ?? []));
        
        // Post-process: ID must have been sent to the model; location must still match fuzzily.
        $exactMatches = [];
        foreach ($similarIds as $concernId) {
            if (!isset($sentIdSet[$concernId])) {
                continue;
            }
            $matchedConcern = null;
            foreach ($allConcerns as $concern) {
                $concernIdFromData = 'CON-' . str_pad($concern['id'], 3, '0', STR_PAD_LEFT);
                if ($concernIdFromData === $concernId) {
                    $matchedConcern = $concern;
                    break;
                }
            }
            if (!$matchedConcern) {
                continue;
            }
            if (!locationsReferToSamePlace($baseLocation, $matchedConcern['location'] ?? '')) {
                error_log("Filtered out concern $concernId: location no longer matches fuzzy same-place check");
                continue;
            }
            $exactMatches[] = $concernId;
        }
        
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
            $checkRevokedColumn = $connection->query("SHOW COLUMNS FROM concerns LIKE 'revoked_at'");
            if ($checkRevokedColumn->num_rows === 0) {
                $connection->query("ALTER TABLE concerns ADD COLUMN revoked_at DATETIME NULL");
            }
            $checkRevokeReasonColumn = $connection->query("SHOW COLUMNS FROM concerns LIKE 'reason_revoke'");
            if ($checkRevokeReasonColumn->num_rows === 0) {
                $connection->query("ALTER TABLE concerns ADD COLUMN reason_revoke TEXT NULL");
            }
            
            // Get concerns from concerns table with status filtering
            $status = isset($_GET['status']) ? $_GET['status'] : null;
            
            if ($status) {
                if ($status === 'resolved') {
                    // For resolved concerns, sort by resolved_at date (latest resolved first)
                    $sql = "SELECT id, concern_image, reporter_name, contact, date_and_time, location, statement, status, resolved_at, process_at, revoked_at, reason_revoke, COALESCE(risk_level, '') as risk_level FROM concerns WHERE status = ? ORDER BY resolved_at DESC LIMIT 100";
                } else if ($status === 'revoked') {
                    // For revoked concerns, sort by revoked_at date (latest revoked first)
                    $sql = "SELECT id, concern_image, reporter_name, contact, date_and_time, location, statement, status, resolved_at, process_at, revoked_at, reason_revoke, COALESCE(risk_level, '') as risk_level FROM concerns WHERE status = ? ORDER BY revoked_at DESC LIMIT 100";
                } else if ($status === 'processing') {
                    // For processing concerns, include process_at
                    $sql = "SELECT id, concern_image, reporter_name, contact, date_and_time, location, statement, status, resolved_at, process_at, revoked_at, reason_revoke, COALESCE(risk_level, '') as risk_level FROM concerns WHERE status = ? ORDER BY date_and_time DESC LIMIT 100";
                } else {
                    // For other statuses, sort by original date_and_time (latest first)
                    $sql = "SELECT id, concern_image, reporter_name, contact, date_and_time, location, statement, status, resolved_at, process_at, revoked_at, reason_revoke, COALESCE(risk_level, '') as risk_level FROM concerns WHERE status = ? ORDER BY date_and_time DESC LIMIT 100";
                }
                $stmt = $connection->prepare($sql);
                $stmt->bind_param('s', $status);
                $stmt->execute();
                $concerns = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            } else {
                // For all concerns, sort by date_and_time (latest first)
                $sql = "SELECT id, concern_image, reporter_name, contact, date_and_time, location, statement, status, resolved_at, process_at, revoked_at, reason_revoke, COALESCE(risk_level, '') as risk_level FROM concerns ORDER BY date_and_time DESC LIMIT 100";
                $result = $connection->query($sql);
                $concerns = $result->fetch_all(MYSQLI_ASSOC);
            }
            
            // Check if we have too many records to process
            if (count($concerns) > 50) {
                echo json_encode(['success' => false, 'message' => 'Too many records to process. Please use pagination.']);
                exit;
            }
            
            $hasMediumRiskKeywords = function($statement) {
                $statementLower = mb_strtolower($statement, 'UTF-8');
                foreach (getMediumRiskKeywordsForConcernFallback() as $keyword) {
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
                    if ($hasMediumRiskKeywords($statement)) {
                        $needsAnalysis = true;
                    }
                    $stmtLower = mb_strtolower($statement, 'UTF-8');
                    if (concernStatementIndicatesHighRiskByKeywords($stmtLower)) {
                        $needsAnalysis = true;
                    }
                    if (concernStatementIndicatesMediumInfrastructureOrEnvironment($stmtLower)) {
                        $needsAnalysis = true;
                    }
                }
                
                if ($needsAnalysis && !empty($statement) && strlen(trim($statement)) >= 5) {
                    try {
                        // Risk level: Groq API first when GROQ_API_KEY is set; keyword fallback otherwise
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

                // Format the revoked date for display (AM/PM format)
                if (isset($concern['revoked_at']) && $concern['revoked_at']) {
                    $revokedDate = new DateTime($concern['revoked_at']);
                    $concern['formatted_revoked_date'] = $revokedDate->format('M j, Y - g:i A');
                } else {
                    $concern['formatted_revoked_date'] = null;
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
                COALESCE(SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END), 0) AS cnt_revoked,
                COUNT(*) AS cnt_total
                FROM concerns";
            $countsRes = $connection->query($countsQuery);
            $countsRow = $countsRes ? $countsRes->fetch_assoc() : null;
            $countsPayload = [
                'new' => (int)($countsRow['cnt_new'] ?? 0),
                'processing' => (int)($countsRow['cnt_processing'] ?? 0),
                'resolved' => (int)($countsRow['cnt_resolved'] ?? 0),
                'revoked' => (int)($countsRow['cnt_revoked'] ?? 0),
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
                    
                    $dbPos = strtolower(trim((string)($row['position'] ?? '')));
                    if ($row && ($dbPos === 'admin' || $dbPos === 'administrator')) {
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
            $reasonRevoke = isset($input['reason_revoke']) ? trim((string)$input['reason_revoke']) : '';
            
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
                    } elseif ($newStatus === 'revoked') {
                        if ($reasonRevoke === '') {
                            echo json_encode(['success' => false, 'message' => 'Reason for revoke is required']);
                            break;
                        }
                        $revokedAt = new DateTime('now', new DateTimeZone(DEFAULT_TIMEZONE));
                        $sql = "UPDATE concerns SET status = ?, revoked_at = ?, reason_revoke = ? WHERE id = ?";
                        $stmt = $connection->prepare($sql);
                        $revokedAtValue = $revokedAt->format('Y-m-d H:i:s');
                        $stmt->bind_param('sssi', $newStatus, $revokedAtValue, $reasonRevoke, $id);
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
                
                // Latest rows + every row at the same trimmed location (case-insensitive) so pairs like COC/COc are never split by LIMIT
                $sql = "SELECT id, concern_image, reporter_name, contact, date_and_time, location, statement, status, COALESCE(risk_level, '') as risk_level FROM concerns ORDER BY date_and_time DESC LIMIT 350";
                $result = $connection->query($sql);
                $allConcerns = $result->fetch_all(MYSQLI_ASSOC);
                
                $baseLocTrim = trim((string)($baseConcern['location'] ?? ''));
                if ($baseLocTrim !== '') {
                    $sqlSameLoc = "SELECT id, concern_image, reporter_name, contact, date_and_time, location, statement, status, COALESCE(risk_level, '') as risk_level FROM concerns WHERE LOWER(TRIM(location)) = LOWER(?)";
                    $stmtLoc = $connection->prepare($sqlSameLoc);
                    if ($stmtLoc) {
                        $stmtLoc->bind_param('s', $baseLocTrim);
                        $stmtLoc->execute();
                        $sameLocRows = $stmtLoc->get_result()->fetch_all(MYSQLI_ASSOC);
                        $stmtLoc->close();
                        $byId = [];
                        foreach ($allConcerns as $row) {
                            $byId[(int)$row['id']] = $row;
                        }
                        foreach ($sameLocRows as $row) {
                            $byId[(int)$row['id']] = $row;
                        }
                        $allConcerns = array_values($byId);
                    }
                }
                
                foreach ($allConcerns as &$concern) {
                    $concern['concern_id'] = 'CON-' . str_pad($concern['id'], 3, '0', STR_PAD_LEFT);
                }
                unset($concern);
                
                $groqIds = findSimilarConcernsWithAI($baseConcern, $allConcerns);
                if (!is_array($groqIds)) {
                    $groqIds = [];
                }
                $ruleIds = findRuleBasedRelatableIds($baseConcern, $allConcerns);
                $baseCid = $baseConcern['concern_id'];
                $mergedIds = array_values(array_unique(array_merge($groqIds, $ruleIds)));
                $mergedIds = array_values(array_filter($mergedIds, function ($cid) use ($baseCid) {
                    return $cid !== $baseCid;
                }));
                
                $numericIds = [];
                foreach ($mergedIds as $cid) {
                    $numericIds[] = (int) str_replace('CON-', '', $cid);
                }
                $rows = fetchConcernsByNumericIds($connection, $numericIds);
                foreach ($rows as &$r) {
                    $r = enrichConcernRowForRelatableModal($r);
                }
                unset($r);
                usort($rows, function ($a, $b) {
                    return strcmp((string)($b['date_and_time'] ?? ''), (string)($a['date_and_time'] ?? ''));
                });
                
                if (count($rows) === 0) {
                    echo json_encode([
                        'success' => true,
                        'similar_ids' => [],
                        'similar_concerns' => [],
                        'related_only_count' => 0,
                        'base_concern_id' => $baseCid
                    ]);
                    break;
                }
                
                $relatedOnlyCount = count($rows);
                $baseEnriched = enrichConcernRowForRelatableModal($baseConcern);
                $rowsForTable = $rows;
                $rowsForTable[] = $baseEnriched;
                usort($rowsForTable, function ($a, $b) {
                    return strcmp((string)($b['date_and_time'] ?? ''), (string)($a['date_and_time'] ?? ''));
                });
                $orderedIds = array_map(function ($r) {
                    return $r['concern_id'];
                }, $rowsForTable);
                
                echo json_encode([
                    'success' => true,
                    'similar_ids' => $orderedIds,
                    'related_only_count' => $relatedOnlyCount,
                    'base_concern_id' => $baseCid,
                    'similar_concerns' => $rowsForTable
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