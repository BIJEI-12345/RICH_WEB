<?php
/**
 * AI na paliwanag (Filipino) para sa bilang ng senior citizens (60+) bawat sitio — Groq.
 * Key: GROQ_API_KEY_CENSUS_SENIOR_CITIZENS (.env).
 */
require_once __DIR__ . '/init_session.php';
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

rich_session_start();

$positionRaw = isset($_SESSION['position']) ? $_SESSION['position'] : '';
$position = trim(strtolower((string) $positionRaw));
$isAdmin = ($position === 'admin' || $position === 'administrator');
$isLoggedIn = isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
$hasUserId = isset($_SESSION['user_id']) && $_SESSION['user_id'] !== '';

if (!$isAdmin && (!$isLoggedIn || !$hasUserId)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied.'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/census_groq_json_parse.php';

/**
 * Palitan ang salitang "pamamahagi" ng pormal na "pagtukoy ng populasyon" (legacy output ng modelo).
 */
function census_senior_interpretation_replace_pamamahagi(string $text): string
{
    if ($text === '') {
        return '';
    }
    $pairs = [
        '/\bpamamahagi\s+ng\s+seniors\s+sa\s+mga\s+sitio\b/iu' => 'pagtukoy ng populasyon ng mga senior sa mga sitio',
        '/\bpamamahagi\s+ng\s+mga\s+senior\b/iu' => 'pagtukoy ng populasyon ng mga senior',
        '/\bpamamahagi\s+ng\s+seniors\b/iu' => 'pagtukoy ng populasyon ng mga senior',
        '/\bAng\s+pamamahagi\b/iu' => 'Ang pagtukoy ng populasyon',
    ];
    $out = $text;
    foreach ($pairs as $pattern => $replacement) {
        $out = preg_replace($pattern, $replacement, $out);
    }
    if (preg_match('/\bpamamahagi\b/iu', $out)) {
        $out = preg_replace('/\bpamamahagi\b/iu', 'pagtukoy ng populasyon', $out);
    }
    $out = preg_replace('/\s+/', ' ', trim((string) $out));

    return $out;
}

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > 65536) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid body'], JSON_UNESCAPED_UNICODE);
    exit;
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON'], JSON_UNESCAPED_UNICODE);
    exit;
}

$apiKey = defined('GROQ_API_KEY_CENSUS_SENIOR_CITIZENS') ? trim((string) GROQ_API_KEY_CENSUS_SENIOR_CITIZENS) : '';
if ($apiKey === '') {
    echo json_encode([
        'success' => true,
        'interpretation' => '',
        'recommendations' => '',
        'groqConfigured' => false,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$totalSeniors = isset($data['totalSeniors']) ? (int) $data['totalSeniors'] : 0;
$rowsIn = $data['seniorBySitio'] ?? null;
if (!is_array($rowsIn)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing seniorBySitio'], JSON_UNESCAPED_UNICODE);
    exit;
}

$lines = [];
$sumRows = 0;
foreach ($rowsIn as $row) {
    if (!is_array($row)) {
        continue;
    }
    $sitio = isset($row['sitio']) ? trim((string) $row['sitio']) : '';
    $cnt = isset($row['count']) ? (int) $row['count'] : (isset($row['residents']) ? (int) $row['residents'] : 0);
    if ($sitio === '' || $cnt <= 0) {
        continue;
    }
    $sitio = mb_substr(preg_replace('/[\r\n\x00]+/', ' ', $sitio), 0, 120);
    $lines[] = ['sitio' => $sitio, 'count' => $cnt];
    $sumRows += $cnt;
}

if ($totalSeniors < 0) {
    $totalSeniors = 0;
}

if (count($lines) === 0 || $totalSeniors === 0) {
    echo json_encode([
        'success' => true,
        'interpretation' => '',
        'recommendations' => '',
        'groqConfigured' => true,
        'skipReason' => 'no_data',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

usort($lines, static function ($a, $b) {
    return ($b['count'] <=> $a['count']) ?: strcmp($a['sitio'], $b['sitio']);
});
$lines = array_slice($lines, 0, 48);

$linesText = [];
foreach ($lines as $L) {
    $linesText[] = '- Sitio / lokasyon sa census: "' . $L['sitio'] . '" — ' . $L['count'] . ' na resident na senior (edad 60+) na nakatala roon';
}
$breakdown = implode("\n", $linesText);

$prompt = "You are summarizing barangay census analytics for the Philippines.\n";
$prompt .= "Ang datos ay tungkol sa mga CENSUSED na resident na senior citizen (edad 60 pataas): kung ILAN sila at SAANG SITIO sila nakatala batay sa address / sitio field ng census.\n\n";
$prompt .= "Breakdown — bilang ng senior residents sa bawat sitio na may hindi bababa sa 1:\n{$breakdown}\n\n";
$prompt .= "KABUUAN ng lahat ng senior residents sa aktibong census: {$totalSeniors}\n";
if ($sumRows !== $totalSeniors) {
    $prompt .= "Paalala: ang kabuuang {$totalSeniors} ay opisyal na total; ang partial sum ng mga sitio sa listahan ay {$sumRows}.\n";
}
$prompt .= "\nReturn STRICT JSON only: {\"interpretation\":\"...\",\"recommendations\":\"...\"}.\n";
$prompt .= "Rules for interpretation (Filipino / Tagalog, propesyonal):\n";
$prompt .= "- LINAWIN: (1) kabuuang bilang ng senior residents, (2) pagtukoy kung ilan ang nakatala sa bawat sitio (saan mas marami o mas kaunti).\n";
$prompt .= "- TERMINOLOHIYA (mahigpit): Gumamit ng PORMAL na parirala na \"pagtukoy ng populasyon\" kapag tinatalakay ang bilang ng mga resident/senior sa iba't ibang sitio. HUWAG gamitin ang salitang \"pamamahagi\" o \"pamamahagi ng seniors\" — ito ay pinagbabawal sa output.\n";
$prompt .= "- Maaaring gamitin ang anyo: \"sa pagtukoy ng populasyon\", \"ayon sa pagtukoy ng populasyon\", \"tumutukoy sa populasyon ng mga senior sa mga sitio\".\n";
$prompt .= "- 4-6 na maikling pangungusap. Walang markdown, walang HTML.\n";
$prompt .= "- Huwag mag-imbento ng numero; gamitin lamang ang datos sa itaas.\n";
$prompt .= "\nSa parehong JSON, key na \"recommendations\": 2-4 na pangungusap sa Filipino — (a) posibleng implikasyon o pangangailangan sa lebel ng barangay/komunidad batay sa datos (hal. konsentrasyon ng seniors sa ilang sitio), (b) praktikal na rekomendasyon (programa, monitoring, koordinasyon sa health/social services). Propesyonal, walang medikal na diagnosis, walang HTML.\n";

$requestData = [
    'model' => 'llama-3.1-8b-instant',
    'messages' => [
        ['role' => 'system', 'content' => 'Return strict JSON with keys interpretation and recommendations. Filipino. Never use pamamahagi; use pagtukoy ng populasyon in interpretation. Be factual.'],
        ['role' => 'user', 'content' => $prompt],
    ],
    'temperature' => 0.22,
    'max_tokens' => 720,
];

$ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $apiKey,
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 18);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 8);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false || $curlError !== '' || $httpCode !== 200) {
    error_log("Groq census senior sitio: HTTP {$httpCode} {$curlError}");
    echo json_encode([
        'success' => true,
        'interpretation' => '',
        'recommendations' => '',
        'groqConfigured' => true,
        'error' => 'api',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$result = json_decode((string) $response, true);
$content = trim((string) ($result['choices'][0]['message']['content'] ?? ''));
if ($content === '') {
    echo json_encode([
        'success' => true,
        'interpretation' => '',
        'recommendations' => '',
        'groqConfigured' => true,
        'error' => 'empty',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
if (preg_match('/\{[\s\S]*\}/', $content, $m)) {
    $content = trim($m[0]);
}
$parsed = census_groq_parse_interpretation_response($content);
$interpretation = $parsed['interpretation'];
$recommendations = $parsed['recommendations'];
if ($interpretation === '') {
    $trimmed = trim(preg_replace('/\s+/', ' ', $content));
    if ($trimmed !== '' && !preg_match('/^\s*\{/', $trimmed)) {
        $interpretation = mb_substr($trimmed, 0, 1500);
    }
}

$interpretation = preg_replace('/\s+/', ' ', $interpretation);
if ($interpretation === null) {
    $interpretation = '';
}
$interpretation = mb_substr($interpretation, 0, 1500);

/** Pormal na terminolohiya: "pagtukoy ng populasyon" — hindi "pamamahagi" (legacy model output). */
$interpretation = census_senior_interpretation_replace_pamamahagi($interpretation);
$recommendations = preg_replace('/\s+/', ' ', $recommendations);
if ($recommendations === null) {
    $recommendations = '';
}
$recommendations = census_senior_interpretation_replace_pamamahagi($recommendations);
$recommendations = mb_substr(trim($recommendations), 0, 900);

echo json_encode([
    'success' => true,
    'interpretation' => $interpretation,
    'recommendations' => $recommendations,
    'groqConfigured' => true,
], JSON_UNESCAPED_UNICODE);
