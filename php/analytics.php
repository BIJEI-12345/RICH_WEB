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
    $pdo = getPDODatabaseConnection();
} catch (Exception $e) {
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

/** 24 sitios — pareho sa analytics / census dropdown */
$analyticsSitioList = [
    'AHUNIN', 'BALTAZAR', 'BIAK NA BATO', 'CALLE ONSE/SAMPAGUITA', 'COC', 'CRUSHER HIGHWAY',
    'INNER CRUSHER', 'LOOBAN 1', 'LOOBAN 2', 'NABUS', 'OLD BARRIO NPC', 'OLD BARRIO 2',
    'OLD BARRIO EXT', 'POBLACION', 'KADAYUNAN', 'MANGGAHAN', 'RIVERSIDE', 'SETTLING', 'SPAR',
    'UPPER', 'ALINSANGAN', 'RCD', 'BRIA PHASE 1', 'BRIA PHASE 2',
];

/**
 * Tugma ang naka-group na location/address key sa isang sitio (eksakto o substring).
 */
function analyticsLocationMatchesSitio(string $dbKey, string $sitio): bool {
    $a = strtolower(trim($dbKey));
    $b = strtolower(trim($sitio));
    if ($a === '' || $b === '') {
        return false;
    }
    if ($a === $b) {
        return true;
    }
    return strpos($a, $b) !== false || strpos($b, $a) !== false;
}

/**
 * @return array<string, array{total:int, resolved:int}>
 */
function fetchConcernLocationGroups(PDO $pdo, string $start, string $end): array {
    $sql = "
        SELECT LOWER(TRIM(COALESCE(location, ''))) AS k,
               COUNT(*) AS total,
               SUM(CASE WHEN LOWER(TRIM(COALESCE(status, ''))) = 'resolved' THEN 1 ELSE 0 END) AS resolved
        FROM concerns
        WHERE date_and_time BETWEEN :s AND :e
        GROUP BY k
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':s' => $start, ':e' => $end]);
    $out = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $k = (string)($row['k'] ?? '');
        $out[$k] = [
            'total' => (int)($row['total'] ?? 0),
            'resolved' => (int)($row['resolved'] ?? 0),
        ];
    }
    return $out;
}

/**
 * @return array<string, array{total:int, resolved:int}>
 */
function fetchEmergencyLocationGroups(PDO $pdo, string $start, string $end): array {
    $sql = "
        SELECT LOWER(TRIM(COALESCE(location, ''))) AS k,
               COUNT(*) AS total,
               SUM(CASE WHEN LOWER(TRIM(COALESCE(status, ''))) = 'resolved' THEN 1 ELSE 0 END) AS resolved
        FROM emergency_reports
        WHERE date_and_time BETWEEN :s AND :e
        GROUP BY k
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':s' => $start, ':e' => $end]);
    $out = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $k = (string)($row['k'] ?? '');
        $out[$k] = [
            'total' => (int)($row['total'] ?? 0),
            'resolved' => (int)($row['resolved'] ?? 0),
        ];
    }
    return $out;
}

/**
 * @return array<string, int> address key => count
 */
function fetchDocumentAddressGroups(PDO $pdo, string $table, string $start, string $end): array {
    $cols = getColumnNames($pdo, $table);
    $addrCol = findColumn($cols, ['sitio', 'location', 'address']);
    if (!$addrCol) {
        return [];
    }
    $sql = "
        SELECT LOWER(TRIM(COALESCE(`{$addrCol}`, ''))) AS k, COUNT(*) AS c
        FROM {$table}
        WHERE submitted_at BETWEEN :s AND :e
        GROUP BY k
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':s' => $start, ':e' => $end]);
    $out = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $k = (string)($row['k'] ?? '');
        $out[$k] = (int)($row['c'] ?? 0);
    }
    return $out;
}

/**
 * @param array<string, array{total:int, resolved:int}> $groups
 * @return array{reported:int, resolved:int}
 */
function aggregateConcernOrEmergencyGroupsForSitio(array $groups, string $sitio): array {
    $reported = 0;
    $resolved = 0;
    foreach ($groups as $k => $row) {
        if (!analyticsLocationMatchesSitio((string)$k, $sitio)) {
            continue;
        }
        $reported += (int)($row['total'] ?? 0);
        $resolved += (int)($row['resolved'] ?? 0);
    }
    return ['reported' => $reported, 'resolved' => $resolved];
}

/**
 * @param array<string, array<string, int>> $mapsByLabel document label => key=>count
 */
function aggregateDocumentGroupsForSitio(array $mapsByLabel, string $sitio): array {
    $out = [];
    $sumTotal = 0;
    foreach ($mapsByLabel as $label => $map) {
        $n = 0;
        foreach ($map as $k => $c) {
            if (analyticsLocationMatchesSitio((string)$k, $sitio)) {
                $n += (int)$c;
            }
        }
        $out[$label] = $n;
        $sumTotal += $n;
    }
    $out['total'] = $sumTotal;
    return $out;
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

// Grouped by location/address — isang round ng queries, tapos hatian per sitio sa PHP
$concernsRangeGroups = fetchConcernLocationGroups($pdo, $rangeStart, $rangeEnd);
$concernsYearGroups = fetchConcernLocationGroups($pdo, $yearStart, $yearEnd);
$emergRangeGroups = fetchEmergencyLocationGroups($pdo, $rangeStart, $rangeEnd);
$emergYearGroups = fetchEmergencyLocationGroups($pdo, $yearStart, $yearEnd);

$docRangeMaps = [];
$docYearMaps = [];
foreach ($documentTables as $label => $table) {
    $docRangeMaps[$label] = fetchDocumentAddressGroups($pdo, $table, $rangeStart, $rangeEnd);
    $docYearMaps[$label] = fetchDocumentAddressGroups($pdo, $table, $yearStart, $yearEnd);
}

$bySitio = [];
foreach ($analyticsSitioList as $sitio) {
    $bySitio[] = [
        'sitio' => $sitio,
        'concerns' => [
            'month' => aggregateConcernOrEmergencyGroupsForSitio($concernsRangeGroups, $sitio),
            'year' => aggregateConcernOrEmergencyGroupsForSitio($concernsYearGroups, $sitio),
        ],
        'emergencies' => [
            'month' => aggregateConcernOrEmergencyGroupsForSitio($emergRangeGroups, $sitio),
            'year' => aggregateConcernOrEmergencyGroupsForSitio($emergYearGroups, $sitio),
        ],
        'documents' => [
            'month' => aggregateDocumentGroupsForSitio($docRangeMaps, $sitio),
            'year' => aggregateDocumentGroupsForSitio($docYearMaps, $sitio),
        ],
    ];
}

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
    ],
    'bySitio' => $bySitio,
    'sitioList' => $analyticsSitioList,
];
$data['previousRangeLabel'] = $previousRangeLabel;
$data['period'] = $period;

// Fetch jobseeker report data directly from certification_forms
$jobseekerReports = [];
try {
    $sql = "
        SELECT *
        FROM certification_forms
        WHERE LOWER(purpose) = 'jobseeker'
          AND LOWER(status) = 'finished'
        ORDER BY id ASC
    ";
    $stmt = $pdo->query($sql);
    if ($stmt) {
        $no = 1;
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            // Map name fields with fallbacks
            $lastName = $row['last_name'] ?? $row['lastname'] ?? $row['lastName'] ?? '';
            $firstName = $row['first_name'] ?? $row['firstname'] ?? $row['firstName'] ?? '';
            $middleName = $row['middle_name'] ?? $row['middlename'] ?? $row['middleName'] ?? '';

            // Birthdate handling
            $birthDate = $row['birth_date'] ?? $row['birthday'] ?? $row['birthDate'] ?? '';
            $birthMonth = '';
            $birthDay = '';
            $birthYear = '';
            if (!empty($birthDate) && $birthDate !== '0000-00-00') {
                try {
                    $date = new DateTime($birthDate);
                    $birthMonth = $date->format('m');
                    $birthDay = $date->format('d');
                    $birthYear = $date->format('Y');
                } catch (Exception $e) {
                    $birthMonth = '';
                    $birthDay = '';
                    $birthYear = '';
                }
            }

            // Age: prefer stored age, otherwise compute from birthdate
            $age = isset($row['age']) ? (int)$row['age'] : 0;
            if ($age === 0 && !empty($birthYear)) {
                try {
                    $birth = new DateTime($birthDate);
                    $today = new DateTime('now', $timezone);
                    $age = $today->diff($birth)->y;
                } catch (Exception $e) {
                    $age = 0;
                }
            }

            // Educational level
            $educationalLevel = $row['educational_level'] ?? $row['educationalLevel'] ?? $row['educationallevel'] ?? '';

            // Course - extract acronym similar to previous logic
            $courseRaw = $row['course'] ?? '';
            $course = '';
            if (!empty($courseRaw)) {
                if (preg_match('/^([A-Z0-9]{2,}(?:\s+[A-Z0-9]+)*)(?:\s*[-–—]|\s|$)/i', $courseRaw, $acronymMatch)) {
                    $course = strtoupper(trim($acronymMatch[1]));
                } elseif (preg_match_all('/\b([A-Z0-9]{2,}(?:\s+[A-Z0-9]+)*)\b/', strtoupper($courseRaw), $acronymMatches)) {
                    $course = $acronymMatches[1][0];
                } else {
                    $words = preg_split('/[\s\-–—]+/', $courseRaw);
                    $acronym = '';
                    foreach ($words as $word) {
                        if (!empty($word) && preg_match('/[A-Za-z0-9]/', $word)) {
                            $acronym .= strtoupper($word[0]);
                        }
                    }
                    $course = !empty($acronym) ? $acronym : '';
                }
            }

            // Sex from gender
            $genderRaw = $row['gender'] ?? '';
            $sex = '';
            if (!empty($genderRaw)) {
                $g = strtolower(trim($genderRaw));
                if (in_array($g, ['male', 'm'], true)) {
                    $sex = 'Male';
                } elseif (in_array($g, ['female', 'f'], true)) {
                    $sex = 'Female';
                } else {
                    $sex = $genderRaw;
                }
            }

            // Out of school youth - check various possible column names
            $outOfSchoolYouth = 0;
            if (isset($row['out_of_school_youth'])) {
                $outOfSchoolYouth = (int)$row['out_of_school_youth'];
            } elseif (isset($row['outOfSchoolYouth'])) {
                $outOfSchoolYouth = (int)$row['outOfSchoolYouth'];
            } elseif (isset($row['out_of_school'])) {
                $outOfSchoolYouth = (int)$row['out_of_school'];
            }

            // Normalize educational level for checkmark logic
            $educationalLevelNormalized = strtolower(trim($educationalLevel));
            $isElementary = ($educationalLevelNormalized === 'elementary');
            $isHighSchool = ($educationalLevelNormalized === 'high school' || $educationalLevelNormalized === 'highschool');
            $isCollege = ($educationalLevelNormalized === 'college');

            // Structure data in the correct column order: No., Last Name, First Name, Middle Name, Age, Month, Day, Year, Sex, Educational Level (for reference), Course, Out of School Youth
            // Note: Educational level checkmarks (Elementary, High School, College) will be handled in frontend
            $jobseekerReports[] = [
                'no' => $no,
                'last_name' => $lastName,
                'first_name' => $firstName,
                'middle_name' => $middleName,
                'age' => $age,
                'birth_month' => $birthMonth,
                'birth_day' => $birthDay,
                'birth_year' => $birthYear,
                'sex' => $sex,
                'educational_level' => $educationalLevel, // Keep original for reference
                'elementary_check' => $isElementary ? 1 : 0,
                'high_school_check' => $isHighSchool ? 1 : 0,
                'college_check' => $isCollege ? 1 : 0,
                'course' => $course,
                'out_of_school_youth' => $outOfSchoolYouth
            ];

            $no++;
        }
    }
} catch (Exception $e) {
    error_log("Error fetching jobseeker reports from certification_forms: " . $e->getMessage());
}

$data['jobseekerReports'] = $jobseekerReports;

echo json_encode(['success' => true, 'data' => $data]);

