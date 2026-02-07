<?php
require_once 'config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

$timezone = new DateTimeZone('Asia/Manila');
$now = new DateTime('now', $timezone);
$monthStart = (clone $now)->modify('first day of this month')->setTime(0, 0, 0)->format('Y-m-d H:i:s');
$monthEnd = (clone $now)->modify('last day of this month')->setTime(23, 59, 59)->format('Y-m-d H:i:s');
$yearStart = (clone $now)->setDate((int)$now->format('Y'), 1, 1)->setTime(0, 0, 0)->format('Y-m-d H:i:s');
$yearEnd = (clone $now)->setDate((int)$now->format('Y'), 12, 31)->setTime(23, 59, 59)->format('Y-m-d H:i:s');

function parseCustomDate(?string $value, DateTimeZone $timezone, string $defaultTime): ?string {
    if (!$value) {
        return null;
    }
    $date = DateTime::createFromFormat('Y-m-d H:i:s', $value, $timezone);
    if (!$date) {
        $date = DateTime::createFromFormat('Y-m-d', $value, $timezone);
        if ($date) {
            [$hour, $minute, $second] = explode(':', $defaultTime);
            $date->setTime((int)$hour, (int)$minute, (int)$second);
        }
    }
    if ($date) {
        $date->setTimezone($timezone);
        return $date->format('Y-m-d H:i:s');
    }
    return null;
}

function fetchSummary(PDO $pdo, string $table, string $dateColumn, string $start, string $end): array {
    $stmt = $pdo->prepare("
        SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN LOWER(status) = 'resolved' THEN 1 ELSE 0 END) AS resolved 
        FROM {$table}
        WHERE {$dateColumn} BETWEEN :start AND :end
    ");
    $stmt->execute([':start' => $start, ':end' => $end]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return [
        'reported' => (int)($row['total'] ?? 0),
        'resolved' => (int)($row['resolved'] ?? 0)
    ];
}

function fetchDocumentCounts(PDO $pdo, string $table, string $start, string $end): int {
    $stmt = $pdo->prepare("SELECT COUNT(*) AS total FROM {$table} WHERE submitted_at BETWEEN :start AND :end");
    $stmt->execute([':start' => $start, ':end' => $end]);
    return (int)$stmt->fetchColumn();
}

function getColumnNames(PDO $pdo, string $table): array {
    $stmt = $pdo->query("SHOW COLUMNS FROM {$table}");
    return $stmt ? array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'Field') : [];
}

function findColumn(array $columns, array $candidates): ?string {
    foreach ($candidates as $candidate) {
        if (in_array($candidate, $columns, true)) {
            return $candidate;
        }
    }
    return null;
}

function calculateDelta(int $current, int $previous): array {
    $value = $current - $previous;
    $percent = null;
    if ($previous !== 0) {
        $percent = round(($value / abs($previous)) * 100, 1);
    }
    return [
        'value' => $value,
        'percent' => $percent
    ];
}

function getPreviousRange(string $start, string $end, string $period, DateTimeZone $timezone): array {
    try {
        $startDt = new DateTime($start, $timezone);
        $endDt = new DateTime($end, $timezone);
    } catch (Exception $e) {
        $startDt = new DateTime($start);
        $endDt = new DateTime($end);
        $startDt->setTimezone($timezone);
        $endDt->setTimezone($timezone);
    }

    if ($period === 'year') {
        $prevStart = (clone $startDt)->modify('-1 year');
        $prevEnd = (clone $endDt)->modify('-1 year');
    } elseif ($period === 'month') {
        $prevStart = (clone $startDt)->modify('-1 month')->modify('first day of this month')->setTime(0, 0, 0);
        $prevEnd = (clone $prevStart)->modify('last day of this month')->setTime(23, 59, 59);
    } else {
        $startTs = $startDt->getTimestamp();
        $endTs = $endDt->getTimestamp();
        $interval = max(0, $endTs - $startTs);
        $prevEndTs = $startTs - 1;
        $prevStartTs = $prevEndTs - $interval;
        $prevStart = DateTime::createFromFormat('U', (string)$prevStartTs, $timezone);
        $prevEnd = DateTime::createFromFormat('U', (string)$prevEndTs, $timezone);
    }

    return [$prevStart->format('Y-m-d H:i:s'), $prevEnd->format('Y-m-d H:i:s')];
}

$documentTables = [
    'Barangay ID' => 'barangay_id_forms',
    'Clearance' => 'clearance_forms',
    'Indigency' => 'indigency_forms',
    'COE' => 'coe_forms',
    'Certification' => 'certification_forms'
];

function createRangeLabel(string $start, string $end, DateTimeZone $timezone): string {
    try {
        $startDt = new DateTime($start, $timezone);
        $endDt = new DateTime($end, $timezone);
    } catch (Exception $e) {
        return '';
    }
    if ($startDt->format('Y') === $endDt->format('Y') && $startDt->format('m') === $endDt->format('m')) {
        return $startDt->format('F Y');
    }
    if ($startDt->format('Y') === $endDt->format('Y')) {
        return $startDt->format('F') . ' – ' . $endDt->format('F Y');
    }
    return $startDt->format('M j, Y') . ' – ' . $endDt->format('M j, Y');
}

$customStart = parseCustomDate($_GET['start'] ?? null, $timezone, '00:00:00');
$customEnd = parseCustomDate($_GET['end'] ?? null, $timezone, '23:59:59');
$period = $_GET['period'] ?? 'month';
$allowedPeriods = ['month', 'year', 'custom'];
if (!in_array($period, $allowedPeriods, true)) {
    $period = 'month';
}
$rangeStart = $customStart ?? $monthStart;
$rangeEnd = $customEnd ?? $monthEnd;
if ($period === 'year' && !$customStart && !$customEnd) {
    $rangeStart = $yearStart;
    $rangeEnd = $yearEnd;
}
$rangeLabel = createRangeLabel($rangeStart, $rangeEnd, $timezone);
[$previousRangeStart, $previousRangeEnd] = getPreviousRange($rangeStart, $rangeEnd, $period, $timezone);
$previousRangeLabel = createRangeLabel($previousRangeStart, $previousRangeEnd, $timezone);

$documentsRange = [];
$documentsYear = [];
$documentsPrev = [];
$docRangeTotal = 0;
$docYearTotal = 0;
$docPrevTotal = 0;
foreach ($documentTables as $label => $table) {
    $rangeCount = fetchDocumentCounts($pdo, $table, $rangeStart, $rangeEnd);
    $yearCount = fetchDocumentCounts($pdo, $table, $yearStart, $yearEnd);
    $prevCount = fetchDocumentCounts($pdo, $table, $previousRangeStart, $previousRangeEnd);
    $documentsRange[$label] = $rangeCount;
    $documentsYear[$label] = $yearCount;
    $documentsPrev[$label] = $prevCount;
    $docRangeTotal += $rangeCount;
    $docYearTotal += $yearCount;
    $docPrevTotal += $prevCount;
}
$documentsRange['total'] = $docRangeTotal;
$documentsYear['total'] = $docYearTotal;
$documentsPrev['total'] = $docPrevTotal;

$concernsRange = fetchSummary($pdo, 'concerns', 'date_and_time', $rangeStart, $rangeEnd);
$concernsYear = fetchSummary($pdo, 'concerns', 'date_and_time', $yearStart, $yearEnd);
$concernsPrev = fetchSummary($pdo, 'concerns', 'date_and_time', $previousRangeStart, $previousRangeEnd);

$emergenciesRange = fetchSummary($pdo, 'emergency_reports', 'date_and_time', $rangeStart, $rangeEnd);
$emergenciesYear = fetchSummary($pdo, 'emergency_reports', 'date_and_time', $yearStart, $yearEnd);
$emergenciesPrev = fetchSummary($pdo, 'emergency_reports', 'date_and_time', $previousRangeStart, $previousRangeEnd);

$userColumns = getColumnNames($pdo, 'brgy_users');
// Prioritize exact column names first
$lastOnlineCol = findColumn($userColumns, ['last_login', 'last_logout', 'last_online', 'last_seen', 'last_active', 'last_activity', 'last_logged_in']);
$hoursCol = findColumn($userColumns, ['total_active_hours', 'hours_active', 'active_hours', 'total_hours']);

$hoursActive = null;
if ($hoursCol) {
    $stmt = $pdo->query("SELECT COALESCE(SUM({$hoursCol}), 0) AS total_hours FROM brgy_users");
    $hoursActive = $stmt ? (float)$stmt->fetchColumn() : null;
}

 $lastOnline = null;
if ($lastOnlineCol) {
    $stmt = $pdo->query("SELECT {$lastOnlineCol} FROM brgy_users WHERE {$lastOnlineCol} IS NOT NULL ORDER BY {$lastOnlineCol} DESC LIMIT 1");
    $value = $stmt ? $stmt->fetchColumn() : null;
    if ($value) {
        $dt = new DateTime($value, $timezone);
        $dt->setTimezone($timezone);
        $lastOnline = $dt->format('Y-m-d H:i:s');
    }
}

$activeUsersStmt = $pdo->query("SELECT COUNT(*) FROM brgy_users WHERE action = 'accepted'");
$activeUsers = (int)$activeUsersStmt->fetchColumn();

// Fetch active users list with details
$activeUsersList = [];
$userListQuery = "SELECT name, position";
if ($hoursCol) {
    $userListQuery .= ", COALESCE({$hoursCol}, 0) AS hours";
} else {
    $userListQuery .= ", 0 AS hours";
}
if ($lastOnlineCol) {
    $userListQuery .= ", {$lastOnlineCol} AS last_login";
} else {
    $userListQuery .= ", NULL AS last_login";
}
// Include online_offline column if it exists
$userColumns = getColumnNames($pdo, 'brgy_users');
if (in_array('online_offline', $userColumns)) {
    $userListQuery .= ", COALESCE(online_offline, 'offline') AS online_offline";
} else {
    $userListQuery .= ", 'offline' AS online_offline";
}
$userListQuery .= " FROM brgy_users WHERE action = 'accepted' ORDER BY name ASC";

$userListStmt = $pdo->query($userListQuery);
if ($userListStmt) {
    while ($row = $userListStmt->fetch(PDO::FETCH_ASSOC)) {
        $lastLoginFormatted = null;
        if ($row['last_login']) {
            try {
                $dt = new DateTime($row['last_login'], $timezone);
                $dt->setTimezone($timezone);
                $lastLoginFormatted = $dt->format('Y-m-d H:i:s');
            } catch (Exception $e) {
                $lastLoginFormatted = $row['last_login'];
            }
        }
        $activeUsersList[] = [
            'name' => $row['name'] ?? 'Unknown',
            'position' => $row['position'] ?? 'N/A',
            'hours' => isset($row['hours']) ? (float)$row['hours'] : 0,
            'lastLogin' => $lastLoginFormatted,
            'status' => 'Active',
            'online_offline' => isset($row['online_offline']) ? strtolower($row['online_offline']) : 'offline'
        ];
    }
}

// Calculate difference between reported and resolved for current and previous month
$concernsCurrentDiff = $concernsRange['reported'] - $concernsRange['resolved'];
$concernsPrevDiff = $concernsPrev['reported'] - $concernsPrev['resolved'];
$concernsDelta = [
    'value' => $concernsCurrentDiff - $concernsPrevDiff,
    'currentDiff' => $concernsCurrentDiff,
    'prevDiff' => $concernsPrevDiff
];

$emergenciesCurrentDiff = $emergenciesRange['reported'] - $emergenciesRange['resolved'];
$emergenciesPrevDiff = $emergenciesPrev['reported'] - $emergenciesPrev['resolved'];
$emergenciesDelta = [
    'value' => $emergenciesCurrentDiff - $emergenciesPrevDiff,
    'currentDiff' => $emergenciesCurrentDiff,
    'prevDiff' => $emergenciesPrevDiff
];

// For documents, compare total requests
$documentsDelta = calculateDelta($documentsRange['total'], $documentsPrev['total'] ?? 0);

$data = [
    'users' => [
        'activeUsers' => $activeUsers,
        'hoursActive' => $hoursActive,
        'lastOnline' => $lastOnline,
        'activeUsersList' => $activeUsersList
    ],
    'concerns' => [
        'month' => $concernsRange,
        'year' => $concernsYear,
        'monthLabel' => $rangeLabel ?: (new DateTime($rangeStart, $timezone))->format('F Y'),
        'yearLabel' => $now->format('Y'),
        'previous' => $concernsPrev,
        'delta' => $concernsDelta
    ],
    'emergencies' => [
        'month' => $emergenciesRange,
        'year' => $emergenciesYear,
        'monthLabel' => $rangeLabel ?: (new DateTime($rangeStart, $timezone))->format('F Y'),
        'yearLabel' => $now->format('Y'),
        'previous' => $emergenciesPrev,
        'delta' => $emergenciesDelta
    ],
    'documents' => [
        'month' => $documentsRange,
        'year' => $documentsYear,
        'monthLabel' => $rangeLabel ?: (new DateTime($rangeStart, $timezone))->format('F Y'),
        'yearLabel' => $now->format('Y'),
        'previous' => $documentsPrev,
        'delta' => $documentsDelta
    ]
];
$data['previousRangeLabel'] = $previousRangeLabel;
$data['period'] = $period;

echo json_encode(['success' => true, 'data' => $data]);

