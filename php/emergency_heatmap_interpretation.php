<?php
/**
 * Buod ng Emergency heat map (araw-araw) — Groq lamang; key: GROQ_API_KEY_EMERGENCY (.env).
 */
require_once __DIR__ . '/init_session.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/emergency_heatmap_data.php';

header('Content-Type: application/json; charset=utf-8');

rich_session_start();

function emergency_heatmap_ai_can_view(): bool
{
    $p = isset($_SESSION['position']) ? strtolower(trim((string) $_SESSION['position'])) : '';
    return $p === 'admin';
}

if (!emergency_heatmap_ai_can_view()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
}

$year = (int)($_GET['year'] ?? 0);
$month = (int)($_GET['month'] ?? 0);
$sitio = trim((string)($_GET['sitio'] ?? ''));

if ($year < 2000 || $year > 2100 || $month < 1 || $month > 12) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid year or month'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = getPDODatabaseConnection();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$timezone = new DateTimeZone('Asia/Manila');
$monthStart = sprintf('%04d-%02d-01 00:00:00', $year, $month);
$startDt = new DateTime($monthStart, $timezone);
$endDt = clone $startDt;
$endDt->modify('last day of this month')->setTime(23, 59, 59);
$rangeEnd = $endDt->format('Y-m-d H:i:s');

$buckets = fetchEmergencyDailyDayKeyBuckets($pdo, $monthStart, $rangeEnd);
$sitioOnly = $sitio !== '' ? $sitio : null;
$daily = buildEmergencyCurrentMonthDailyPayload($buckets, $monthStart, $timezone, $sitioOnly);

$apiKey = defined('GROQ_API_KEY_EMERGENCY') ? trim((string) GROQ_API_KEY_EMERGENCY) : '';
if ($apiKey === '') {
    echo json_encode([
        'success' => true,
        'interpretation' => '',
        'groqConfigured' => false,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$interpretation = emergency_heatmap_groq_interpret($daily, $sitio, $apiKey);

echo json_encode([
    'success' => true,
    'interpretation' => $interpretation,
    'groqConfigured' => true,
], JSON_UNESCAPED_UNICODE);

/**
 * @param array $daily buildEmergencyCurrentMonthDailyPayload
 */
function emergency_heatmap_groq_interpret(array $daily, string $sitioFilter, string $apiKey): string
{
    $apiKey = trim($apiKey);
    if ($apiKey === '') {
        return '';
    }

    $counts = is_array($daily['counts'] ?? null) ? $daily['counts'] : [];
    $total = 0;
    $nonZero = [];
    foreach ($counts as $i => $c) {
        $c = (int)$c;
        $total += $c;
        if ($c > 0) {
            $nonZero[] = 'araw ' . ((int)$i + 1) . ': ' . $c . ' na ulat';
        }
    }
    $nonZeroStr = count($nonZero) > 0 ? implode('; ', array_slice($nonZero, 0, 40)) : 'walang araw na may ulat';
    if (count($nonZero) > 40) {
        $nonZeroStr .= ' …';
    }

    $monthLabel = trim((string)($daily['monthLabel'] ?? ''));
    $peakDay = $daily['peakDay'] ?? null;
    $peakCount = (int)($daily['peakCount'] ?? 0);
    $peakDateLabel = trim((string)($daily['peakDateLabel'] ?? ''));
    $dim = (int)($daily['daysInMonth'] ?? 0);

    $sitioEsc = htmlspecialchars($sitioFilter, ENT_QUOTES, 'UTF-8');
    $monthEsc = htmlspecialchars($monthLabel, ENT_QUOTES, 'UTF-8');
    $peakEsc = htmlspecialchars($peakDateLabel, ENT_QUOTES, 'UTF-8');

    $scope = $sitioFilter !== ''
        ? "Ang datos ay para lamang sa sitio na \"{$sitioEsc}\" (batay sa location field)."
        : 'Ang datos ay para sa buong barangay (lahat ng sitio).';

    $prompt = "You are summarizing barangay emergency_reports heat map data (Philippines).\n";
    $prompt .= "{$scope}\n";
    $prompt .= "Calendar month label: {$monthEsc}. Days in month: {$dim}.\n";
    $prompt .= "Total reported count for the month (sum of daily cells): {$total}.\n";
    $prompt .= "Peak single-day count: {$peakCount}. Peak date label: {$peakEsc}. Peak day-of-month number: " . ($peakDay === null ? 'none' : (string)$peakDay) . ".\n";
    $prompt .= "Per-day non-zero counts: {$nonZeroStr}\n\n";
    $prompt .= "Return STRICT JSON only: {\"summary\":\"...\"}.\n";
    $prompt .= "Rules for summary:\n";
    $prompt .= "- 2-4 sentences in Filipino (Tagalog), professional, plain text only, no markdown/HTML.\n";
    $prompt .= "- Discuss volume for the month, which calendar day(s) show the highest intensity (most reports in one day), and overall pattern if clear.\n";
    $prompt .= "- If total is 0, say plainly that there were no reported emergencies on any day that month.\n";
    $prompt .= "- Do not invent numbers; use only the data given.\n";

    $requestData = [
        'model' => 'llama-3.1-8b-instant',
        'messages' => [
            ['role' => 'system', 'content' => 'Return strict JSON only. Be factual; do not invent numbers beyond what is given.'],
            ['role' => 'user', 'content' => $prompt],
        ],
        'temperature' => 0.25,
        'max_tokens' => 420,
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
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || $curlError !== '' || $httpCode !== 200) {
        error_log("Groq AI API error (emergency heatmap): HTTP {$httpCode}, Error: {$curlError}");
        return '';
    }

    $result = json_decode((string) $response, true);
    $content = trim((string) ($result['choices'][0]['message']['content'] ?? ''));
    if ($content === '') {
        return '';
    }
    if (preg_match('/\{[\s\S]*\}/', $content, $m)) {
        $content = trim($m[0]);
    }
    $decoded = json_decode($content, true);
    if (!is_array($decoded)) {
        return '';
    }

    $summary = trim((string) ($decoded['summary'] ?? ''));
    if ($summary === '') {
        return '';
    }
    $summary = preg_replace('/\s+/', ' ', $summary);
    return mb_substr($summary, 0, 1200);
}
