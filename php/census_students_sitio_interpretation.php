<?php
/**
 * AI na paliwanag (Filipino) para sa bilang ng students (occupation field) bawat sitio — Groq.
 * Key: GROQ_API_KEY_CENSUS_STUDENTS (.env).
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

function census_students_interpretation_replace_pamamahagi(string $text): string
{
    if ($text === '') {
        return '';
    }
    $pairs = [
        '/\bpamamahagi\s+ng\s+mga\s+student\b/iu' => 'pagtukoy ng populasyon ng mga student',
        '/\bpamamahagi\s+ng\s+students\b/iu' => 'pagtukoy ng populasyon ng mga student',
        '/\bpamamahagi\s+ng\s+mga\s+students\b/iu' => 'pagtukoy ng populasyon ng mga student',
        '/\bpamamahagi\s+ng\s+mga\s+employed\b/iu' => 'pagtukoy ng populasyon ng mga employed',
        '/\bpamamahagi\s+ng\s+seniors\s+sa\s+mga\s+sitio\b/iu' => 'pagtukoy ng populasyon ng mga resident sa mga sitio',
        '/\bAng\s+pamamahagi\b/iu' => 'Ang pagtukoy ng populasyon',
    ];
    $out = $text;
    foreach ($pairs as $pattern => $replacement) {
        $out = preg_replace($pattern, $replacement, $out);
    }
    if (preg_match('/\bpamamahagi\b/iu', $out)) {
        $out = preg_replace('/\bpamamahagi\b/iu', 'pagtukoy ng populasyon', $out);
    }

    return trim((string) $out);
}

function census_students_normalize_interpretation_whitespace(string $s): string
{
    $s = str_replace(["\r\n", "\r"], "\n", $s);
    $lines = explode("\n", $s);
    $clean = [];
    foreach ($lines as $line) {
        $line = preg_replace('/[ \t]+/u', ' ', trim($line));
        if ($line !== '') {
            $clean[] = $line;
        }
    }

    return implode("\n", $clean);
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

$apiKey = defined('GROQ_API_KEY_CENSUS_STUDENTS') ? trim((string) GROQ_API_KEY_CENSUS_STUDENTS) : '';
if ($apiKey === '') {
    echo json_encode([
        'success' => true,
        'interpretation' => '',
        'recommendations' => '',
        'groqConfigured' => false,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$totalStudents = isset($data['totalStudents']) ? (int) $data['totalStudents'] : 0;
$rowsIn = $data['studentsBySitio'] ?? null;
if (!is_array($rowsIn)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing studentsBySitio'], JSON_UNESCAPED_UNICODE);
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

if ($totalStudents < 0) {
    $totalStudents = 0;
}

if (count($lines) === 0 || $totalStudents === 0) {
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
    $linesText[] = '- Sitio / lokasyon sa census: "' . $L['sitio'] . '" — ' . $L['count'] . ' na resident na nakatala bilang student (occupation / hanapbuhay) roon';
}
$breakdown = implode("\n", $linesText);

$prompt = "You are summarizing barangay census analytics for the Philippines.\n";
$prompt .= "Ang datos ay tungkol sa mga CENSUSED na resident na nakatala bilang **student** batay sa occupation field sa census (hal. Student, estudyante): kung ILAN sila at SAANG SITIO sila nakatala.\n\n";
$prompt .= "Breakdown — bilang ng student residents sa bawat sitio na may hindi bababa sa 1:\n{$breakdown}\n\n";
$prompt .= "KABUUAN ng lahat ng student residents sa aktibong census: {$totalStudents}\n";
if ($sumRows !== $totalStudents) {
    $prompt .= "Paalala: ang kabuuang {$totalStudents} ay opisyal na total; ang partial sum ng mga sitio sa listahan ay {$sumRows}.\n";
}
$prompt .= "\nReturn STRICT JSON only: {\"interpretation\":\"...\",\"recommendations\":\"...\"}.\n";
$prompt .= "ISTRUKTURA ng interpretation (mahigpit):\n";
$prompt .= "- Una: 1-2 pangungusap na buod — kabuuang students at konteksto ng pagtukoy ng populasyon (walang HTML).\n";
$prompt .= "- Pagkatapos, mag-iwan ng isang blangkong linya (newline), tapos maglista ng BAWAT sitio mula sa breakdown sa itaas gamit ang bullet na \"•\" sa simula ng linya.\n";
$prompt .= "- Bawat linya ng bullet: • [eksaktong pangalan ng sitio gaya sa datos]: [bilang] student — isang maikling pangungusap (hal. kung mas mataas o mas mababa kumpara sa iba).\n";
$prompt .= "- Isang bullet bawat sitio sa breakdown; sundin ang parehong pagkakasunud-sunod (mataas na bilang muna).\n";
$prompt .= "- TERMINOLOHIYA: \"pagtukoy ng populasyon\"; HUWAG \"pamamahagi\". Walang markdown na ** o #, walang HTML.\n";
$prompt .= "- Sa JSON string ng \"interpretation\", gumamit ng \\n para sa bagong linya pagitan ng buod at ng lista ng bullets.\n";
$prompt .= "- Huwag mag-imbento ng numero o pangalan ng sitio na wala sa datos.\n";
$prompt .= "\nHiwalay na string na \"recommendations\": 2-4 na pangungusap — posibleng implikasyon sa edukasyon/kabataan sa lebel ng barangay at praktikal na rekomendasyon (koordinasyon sa paaralan/LGU, scholarship info, youth program, transportasyon). Walang HTML.\n";

$requestData = [
    'model' => 'llama-3.1-8b-instant',
    'messages' => [
        ['role' => 'system', 'content' => 'Return strict JSON with keys interpretation and recommendations. Filipino. interpretation uses \\n and bullets •. Never use pamamahagi. Be factual.'],
        ['role' => 'user', 'content' => $prompt],
    ],
    'temperature' => 0.2,
    'max_tokens' => 1100,
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
    error_log("Groq census students sitio: HTTP {$httpCode} {$curlError}");
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
    $trimmed = trim(preg_replace('/[ \t]+/u', ' ', str_replace(["\r\n", "\r"], "\n", $content)));
    if ($trimmed !== '' && !preg_match('/^\s*\{/', $trimmed)) {
        $interpretation = mb_substr($trimmed, 0, 2500);
    }
}

$interpretation = census_students_normalize_interpretation_whitespace((string) $interpretation);
$interpretation = mb_substr($interpretation, 0, 2500);

$interpretation = census_students_interpretation_replace_pamamahagi($interpretation);
$interpretation = census_students_normalize_interpretation_whitespace($interpretation);

if ($interpretation !== '' && count($lines) > 0) {
    $hasBulletLine = false;
    foreach (explode("\n", $interpretation) as $ln) {
        $ln = trim($ln);
        if ($ln !== '' && preg_match('/^[•\x{2022}*\-]/u', $ln)) {
            $hasBulletLine = true;
            break;
        }
    }
    if (!$hasBulletLine) {
        $buf = [];
        foreach ($lines as $L) {
            $buf[] = '• ' . $L['sitio'] . ': ' . $L['count'] . ' na student na resident na nakatala sa sitio na ito.';
        }
        $interpretation = trim($interpretation) . "\n\n" . implode("\n", $buf);
        $interpretation = census_students_normalize_interpretation_whitespace($interpretation);
        $interpretation = mb_substr($interpretation, 0, 2500);
    }
}

$recommendations = preg_replace('/\s+/', ' ', $recommendations);
if ($recommendations === null) {
    $recommendations = '';
}
$recommendations = census_students_interpretation_replace_pamamahagi($recommendations);
$recommendations = mb_substr(trim($recommendations), 0, 900);

echo json_encode([
    'success' => true,
    'interpretation' => $interpretation,
    'recommendations' => $recommendations,
    'groqConfigured' => true,
], JSON_UNESCAPED_UNICODE);
