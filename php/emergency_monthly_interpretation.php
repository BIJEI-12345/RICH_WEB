<?php
/**
 * Buwanang bilang ng emergency reports + AI na interpretasyon (Groq).
 * Groq: GROQ_API_KEY_EMERGENCY sa config (EMERGENCY_GRAPH_GROQ_API_KEY o fallback GROQ_API_KEY sa .env).
 */
require_once __DIR__ . '/init_session.php';
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

rich_session_start();

function emergency_page_can_view(): bool
{
    $position = isset($_SESSION['position']) ? strtolower((string) $_SESSION['position']) : '';
    if ($position === 'admin') {
        return true;
    }
    return ($position === 'emergency' || $position === 'emergency category');
}

if (!emergency_page_can_view()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden'], JSON_UNESCAPED_UNICODE);
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
$now = new DateTime('now', $timezone);
$monthStart = (clone $now)->modify('first day of this month')->setTime(0, 0, 0)->format('Y-m-d H:i:s');
$monthEnd = (clone $now)->modify('last day of this month')->setTime(23, 59, 59)->format('Y-m-d H:i:s');

$prevStart = (clone $now)->modify('first day of this month')->modify('-1 month')->setTime(0, 0, 0)->format('Y-m-d H:i:s');
$prevEnd = (new DateTime($prevStart, $timezone))->modify('last day of this month')->setTime(23, 59, 59)->format('Y-m-d H:i:s');

$monthNames = ['Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo', 'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'];
$monthLabel = $monthNames[(int) $now->format('n') - 1] . ' ' . $now->format('Y');

function emergency_monthly_fetch_summary(PDO $pdo, string $start, string $end): array
{
    $stmt = $pdo->prepare('
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN LOWER(TRIM(COALESCE(status, \'\'))) = \'resolved\' THEN 1 ELSE 0 END) AS resolved
        FROM emergency_reports
        WHERE date_and_time BETWEEN :start AND :end
    ');
    $stmt->execute([':start' => $start, ':end' => $end]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return [
        'reported' => (int)($row['total'] ?? 0),
        'resolved' => (int)($row['resolved'] ?? 0),
    ];
}

function emergency_monthly_type_breakdown(PDO $pdo, string $start, string $end): array
{
    $stmt = $pdo->prepare('
        SELECT emergency_type, COUNT(*) AS c
        FROM emergency_reports
        WHERE date_and_time BETWEEN :start AND :end
        GROUP BY emergency_type
        ORDER BY c DESC
        LIMIT 6
    ');
    $stmt->execute([':start' => $start, ':end' => $end]);
    $out = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $out[] = [
            'type' => trim((string)($row['emergency_type'] ?? '')),
            'count' => (int)($row['c'] ?? 0),
        ];
    }
    return $out;
}

/**
 * @param array{reported: int, resolved: int} $current
 * @param array{reported: int, resolved: int} $previous
 * @param array<int, array{type: string, count: int}> $types
 */
function emergency_monthly_groq_interpretation(
    string $monthLabel,
    array $current,
    array $previous,
    array $types,
    string $apiKey
): string {
    $apiKey = trim($apiKey);
    if ($apiKey === '') {
        return '';
    }

    $mr = (int)($current['reported'] ?? 0);
    $mres = (int)($current['resolved'] ?? 0);
    $pr = (int)($previous['reported'] ?? 0);
    $pres = (int)($previous['resolved'] ?? 0);

    $typeLines = [];
    foreach ($types as $t) {
        if (($t['count'] ?? 0) > 0 && ($t['type'] ?? '') !== '') {
            $typeLines[] = "{$t['type']}: {$t['count']}";
        }
    }
    $typesSummary = count($typeLines) > 0 ? implode('; ', $typeLines) : 'walang hiwalay na tipo (0 ulat sa buwan)';

    $prompt = "You are helping barangay staff in the Philippines interpret emergency_reports volume for ONE calendar month.\n";
    $prompt .= "Month label: {$monthLabel}\n";
    $prompt .= "This month — total reports filed (by date_and_time): {$mr}; marked resolved in DB among those rows: {$mres}\n";
    $prompt .= "Previous calendar month — total filed: {$pr}; resolved among those: {$pres}\n";
    $prompt .= "Breakdown by emergency_type this month (top): {$typesSummary}\n\n";
    $prompt .= "Return STRICT JSON only: {\"summary\":\"...\"}.\n";
    $prompt .= "Rules for summary:\n";
    $prompt .= "- 2-4 sentences in Filipino (Tagalog), professional tone, plain text only, no markdown/HTML.\n";
    $prompt .= "- Focus on gaano kadami ang pumasok na ulat sa buwan na ito, kumpara kung may saysay ang nakaraang buwan, at kung ano ang nangingibabaw na uri kung may datos.\n";
    $prompt .= "- If this month count is 0, state clearly na walang bagong ulat sa buwan na iyon; huwag humula ng numero.\n";

    $requestData = [
        'model' => 'llama-3.1-8b-instant',
        'messages' => [
            ['role' => 'system', 'content' => 'Return strict JSON only. Be factual; do not invent numbers beyond what is given.'],
            ['role' => 'user', 'content' => $prompt],
        ],
        'temperature' => 0.25,
        'max_tokens' => 380,
    ];

    $ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 16);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || $curlError !== '' || $httpCode !== 200) {
        error_log("Groq AI API error (emergency monthly page): HTTP {$httpCode}, Error: {$curlError}");
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

$current = emergency_monthly_fetch_summary($pdo, $monthStart, $monthEnd);
$previous = emergency_monthly_fetch_summary($pdo, $prevStart, $prevEnd);
$types = emergency_monthly_type_breakdown($pdo, $monthStart, $monthEnd);

$apiKey = defined('GROQ_API_KEY_EMERGENCY') ? trim((string) GROQ_API_KEY_EMERGENCY) : '';
$aiText = '';

if ($apiKey === '') {
    $aiText = '';
} else {
    // Groq lamang (kasama ang kaso na 0 ang ulat — tinutukoy sa prompt)
    $aiText = emergency_monthly_groq_interpretation($monthLabel, $current, $previous, $types, $apiKey);
}

echo json_encode([
    'success' => true,
    'monthLabel' => $monthLabel,
    'monthStart' => $monthStart,
    'monthEnd' => $monthEnd,
    'currentMonth' => $current,
    'previousMonth' => $previous,
    'typesThisMonth' => $types,
    'aiInterpretation' => $aiText,
    'groqConfigured' => $apiKey !== '',
], JSON_UNESCAPED_UNICODE);
