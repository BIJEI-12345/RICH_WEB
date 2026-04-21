<?php
require_once 'config.php';
require_once __DIR__ . '/emergency_heatmap_data.php';

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

/**
 * Buwan-buwang reported / resolved / new / processing / revoked (index 0 = Enero … 11 = Disyembre) sa date range.
 * Bucket: MONTH(date_and_time). Parehong lohika sa bySitio concerns (status mula sa DB).
 *
 * @return array{reported: int[], resolved: int[], new: int[], processing: int[], revoked: int[]}
 */
function fetchConcernsMonthlyReportedResolved(PDO $pdo, string $start, string $end): array {
    $reported = array_fill(0, 12, 0);
    $resolved = array_fill(0, 12, 0);
    $new = array_fill(0, 12, 0);
    $processing = array_fill(0, 12, 0);
    $revoked = array_fill(0, 12, 0);
    $stmt = $pdo->prepare("
        SELECT MONTH(date_and_time) AS m,
               COUNT(*) AS total,
               SUM(CASE WHEN LOWER(TRIM(COALESCE(status, ''))) = 'resolved' THEN 1 ELSE 0 END) AS resolved_count,
               SUM(CASE WHEN LOWER(TRIM(COALESCE(status, ''))) = 'new' THEN 1 ELSE 0 END) AS new_cnt,
               SUM(CASE WHEN LOWER(TRIM(COALESCE(status, ''))) = 'processing' THEN 1 ELSE 0 END) AS processing_cnt,
               SUM(CASE WHEN LOWER(TRIM(COALESCE(status, ''))) = 'revoked' THEN 1 ELSE 0 END) AS revoked_cnt
        FROM concerns
        WHERE date_and_time BETWEEN :start AND :end
        GROUP BY MONTH(date_and_time)
    ");
    $stmt->execute([':start' => $start, ':end' => $end]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $m = (int)($row['m'] ?? 0);
        if ($m >= 1 && $m <= 12) {
            $i = $m - 1;
            $reported[$i] = (int)($row['total'] ?? 0);
            $resolved[$i] = (int)($row['resolved_count'] ?? 0);
            $new[$i] = (int)($row['new_cnt'] ?? 0);
            $processing[$i] = (int)($row['processing_cnt'] ?? 0);
            $revoked[$i] = (int)($row['revoked_cnt'] ?? 0);
        }
    }
    return [
        'reported' => $reported,
        'resolved' => $resolved,
        'new' => $new,
        'processing' => $processing,
        'revoked' => $revoked,
    ];
}

/**
 * Buwan-buwang reported (lahat ng record) at resolved (status = resolved) — index 0 = Enero … 11 = Disyembre.
 * Parehong lohika ng fetchSummary() bawat buwan.
 *
 * @return array{reported: int[], resolved: int[]}
 */
function fetchEmergencyMonthlyReportedResolved(PDO $pdo, string $start, string $end): array {
    $reported = array_fill(0, 12, 0);
    $resolved = array_fill(0, 12, 0);
    $stmt = $pdo->prepare("
        SELECT MONTH(date_and_time) AS m,
               COUNT(*) AS total,
               SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'resolved' THEN 1 ELSE 0 END) AS resolved_count
        FROM emergency_reports
        WHERE date_and_time BETWEEN :start AND :end
        GROUP BY MONTH(date_and_time)
    ");
    $stmt->execute([':start' => $start, ':end' => $end]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $m = (int)($row['m'] ?? 0);
        if ($m >= 1 && $m <= 12) {
            $i = $m - 1;
            $reported[$i] = (int)($row['total'] ?? 0);
            $resolved[$i] = (int)($row['resolved_count'] ?? 0);
        }
    }
    return [
        'reported' => $reported,
        'resolved' => $resolved,
    ];
}

/**
 * Buwan 1–12 => location key => reported/resolved (hatian per sitio gaya ng documents monthly).
 *
 * @return array<int, array<string, array{reported:int, resolved:int}>>
 */
function fetchEmergencyMonthlyLocationKeyBuckets(PDO $pdo, string $start, string $end): array {
    $byMonth = [];
    for ($m = 1; $m <= 12; $m++) {
        $byMonth[$m] = [];
    }
    $stmt = $pdo->prepare("
        SELECT MONTH(date_and_time) AS m,
               LOWER(TRIM(COALESCE(location, ''))) AS k,
               COUNT(*) AS total,
               SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'resolved' THEN 1 ELSE 0 END) AS resolved_count
        FROM emergency_reports
        WHERE date_and_time BETWEEN :s AND :e
        GROUP BY MONTH(date_and_time), k
    ");
    $stmt->execute([':s' => $start, ':e' => $end]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $m = (int)($row['m'] ?? 0);
        if ($m < 1 || $m > 12) {
            continue;
        }
        $k = (string)($row['k'] ?? '');
        $byMonth[$m][$k] = [
            'reported' => (int)($row['total'] ?? 0),
            'resolved' => (int)($row['resolved_count'] ?? 0),
        ];
    }
    return $byMonth;
}

/**
 * @param array<int, array<string, array{reported:int, resolved:int}>> $byMonthBuckets
 * @return array{reported: int[], resolved: int[]}
 */
function aggregateEmergencyYearByMonthForSitio(array $byMonthBuckets, string $sitio): array {
    $reported = array_fill(0, 12, 0);
    $resolved = array_fill(0, 12, 0);
    for ($mi = 0; $mi < 12; $mi++) {
        $m = $mi + 1;
        $map = $byMonthBuckets[$m] ?? [];
        foreach ($map as $k => $row) {
            if (!analyticsLocationMatchesSitio((string)$k, $sitio)) {
                continue;
            }
            $reported[$mi] += (int)($row['reported'] ?? 0);
            $resolved[$mi] += (int)($row['resolved'] ?? 0);
        }
    }
    return [
        'reported' => $reported,
        'resolved' => $resolved,
    ];
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

/**
 * Concerns sa date range na hindi kasama ang status na "new" (case-insensitive).
 * Ginagamit sa Sentiment Analysis total — hiwalay sa buong "reported" count.
 */
function fetchConcernReportedExcludingNew(PDO $pdo, string $start, string $end): int {
    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS c
        FROM concerns
        WHERE date_and_time BETWEEN :start AND :end
          AND LOWER(TRIM(COALESCE(status, ''))) <> 'new'
    ");
    $stmt->execute([':start' => $start, ':end' => $end]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return (int)($row['c'] ?? 0);
}

/**
 * Canonical na listahan ng sitio (pareho sa analytics / census dropdown).
 *
 * @return list<string>
 */
function analyticsCensusSitioCanonicalNames(): array {
    return [
        'AHUNIN',
        'BALTAZAR',
        'BIAK NA BATO',
        'CALLE ONSE/SAMPAGUITA',
        'COC',
        'CRUSHER HIGHWAY',
        'INNER CRUSHER',
        'LOOBAN 1',
        'LOOBAN 2',
        'NABUS',
        'OLD BARRIO NPC',
        'OLD BARRIO 2',
        'OLD BARRIO EXT',
        'POBLACION',
        'KADAYUNAN',
        'MANGGAHAN',
        'RIVERSIDE',
        'SETTLING',
        'SPAR',
        'UPPER',
        'ALINSANGAN',
        'RCD',
        'BRIA PHASE 1',
        'BRIA PHASE 2',
    ];
}

function censusNormalizeTextForSitioMatch(string $text): string {
    $t = mb_strtoupper(trim($text));
    $t = str_replace(['/', '-', ',', '.'], ' ', $t);
    $t = preg_replace('/\s+/u', ' ', $t) ?? '';
    return trim($t);
}

/**
 * Tukuyin ang sitio: unahin ang `sitio` sa DB; kung walang laman, hanapin ang pangalan ng sitio sa address fields.
 *
 * @param array<string, mixed> $row
 * @param list<string> $canonicalSitios
 */
function censusResolveSitioLabelFromRow(array $row, array $canonicalSitios): string {
    $direct = trim((string)($row['sitio'] ?? ''));
    if ($direct !== '') {
        return $direct;
    }
    $parts = [
        (string)($row['complete_address'] ?? ''),
        (string)($row['street'] ?? ''),
        (string)($row['house_no'] ?? ''),
        (string)($row['barangay'] ?? ''),
    ];
    $blob = trim(implode(' ', array_filter($parts, static function ($v) {
        return trim((string)$v) !== '';
    })));
    if ($blob === '') {
        return '';
    }
    $hay = censusNormalizeTextForSitioMatch($blob);
    $sorted = $canonicalSitios;
    usort($sorted, static function (string $a, string $b): int {
        return mb_strlen($b) <=> mb_strlen($a);
    });
    foreach ($sorted as $name) {
        $needle = censusNormalizeTextForSitioMatch($name);
        if ($needle !== '' && mb_strpos($hay, $needle) !== false) {
            return $name;
        }
    }
    return '';
}

/**
 * Edad sa taon: unahin ang birthday (vs today); kung walang valid date, fallback sa column na `age`.
 *
 * @param array<string, mixed> $row
 */
function censusAnalyticsResidentAgeYears(array $row): ?int {
    $bd = trim((string)($row['birthday'] ?? ''));
    if ($bd !== '' && preg_match('/^\d{4}-\d{2}-\d{2}/', $bd)) {
        try {
            $b = new DateTime(substr($bd, 0, 10));
            $today = new DateTime('today');
            return (int)$b->diff($today)->y;
        } catch (Throwable $e) {
            // fallback sa age
        }
    }
    if (isset($row['age']) && $row['age'] !== null && $row['age'] !== '') {
        if (is_numeric($row['age'])) {
            $a = (int)$row['age'];
            if ($a >= 0 && $a <= 130) {
                return $a;
            }
        }
    }
    return null;
}

function censusFormColumnExists(PDO $pdo, string $col): bool {
    $st = $pdo->query('SHOW COLUMNS FROM census_form LIKE ' . $pdo->quote($col));

    return $st && $st->rowCount() > 0;
}

/** Pareho sa `memberOccupationColumnIsUnemployedStatus` sa census.js — `occupation` column lang; status na unemployed. */
function censusAnalyticsIsUnemployed(array $row): bool {
    $raw = trim((string)($row['occupation'] ?? ''));
    if ($raw === '') {
        return false;
    }
    if (preg_match('/\bemployed\b/i', $raw) && !preg_match('/\bunemployed\b/i', $raw)) {
        return false;
    }

    $t = strtolower($raw);

    return (bool) preg_match('/\bunemployed\b|walang\s+trabaho|walang\s+hanapbuhay|not\s+employed|no\s+work\b/i', $t);
}

/** Pareho sa `memberOccupationColumnIsEmployedStatus` sa census.js — `occupation` column lang; may salitang "employed". */
function censusAnalyticsIsEmployed(array $row): bool {
    $raw = trim((string)($row['occupation'] ?? ''));
    if ($raw === '') {
        return false;
    }
    $t = strtolower($raw);
    if (preg_match('/\bunemployed\b|walang\s+trabaho|not\s+employed|no\s+work|^n\/a$|^none$|^-$|^wala$/i', $t)) {
        return false;
    }

    return (bool) preg_match('/\bemployed\b/i', $raw);
}

/** Pareho sa `memberOccupationColumnIsStudentStatus` sa census.js — `occupation` column; student / estudyante / pupil. */
function censusAnalyticsIsStudent(array $row): bool {
    $raw = trim((string)($row['occupation'] ?? ''));
    if ($raw === '') {
        return false;
    }
    $t = strtolower($raw);
    if (preg_match('/\bnot\s+a\s+student\b|\bnon-?student\b/i', $t)) {
        return false;
    }

    return (bool) preg_match('/\bstudent\b|\bestudyante\b|\bpupil\b|studyante/i', $raw);
}

function censusAnalyticsIsWidowed(array $row): bool {
    $cs = strtolower(trim((string)($row['civil_status'] ?? '')));
    if ($cs === '') {
        return false;
    }

    return (bool) preg_match('/widowed|widow|balo/i', $cs);
}

/** Hindi PWD ang "None" / "N/A" — pareho sa census.js `censusDisabilitiesMeansNoDisability`. */
function censusAnalyticsDisabilitiesTextIsMeaningful(string $text): bool {
    $t = trim($text);
    if ($t === '') {
        return false;
    }
    $low = strtolower($t);
    $noneLike = ['null', 'none', 'n/a', 'n/a.', 'na', '-', '—', 'no', 'walang', 'wala', 'no disability', 'walang disability', 'without disability'];

    return !in_array($low, $noneLike, true);
}

/** Pareho sa `memberHasPwdRecord` sa census.js (disabilities text o yes/pwd flags). */
function censusAnalyticsHasPwdRecord(array $row): bool {
    $t = trim((string)($row['disabilities'] ?? $row['disability'] ?? ''));
    if ($t !== '' && censusAnalyticsDisabilitiesTextIsMeaningful($t)) {
        return true;
    }
    foreach (['pwd', 'disability', 'disabled', 'person_with_disability', 'has_disability', 'with_disability'] as $f) {
        $v = strtolower(trim((string)($row[$f] ?? '')));
        if ($v === '') {
            continue;
        }
        if ($v === 'yes' || $v === 'y' || $v === '1' || $v === 'true' || $v === 'pwd' || strpos($v, 'disab') !== false) {
            return true;
        }
    }

    return false;
}

function censusAnalyticsIsIndigenous(array $row): bool {
    if (!array_key_exists('indigenous', $row)) {
        return false;
    }
    $iv = $row['indigenous'];

    return $iv === true || $iv === 1 || $iv === '1';
}

/**
 * Snapshot ng active census: totals at bySitio ay batay sa mga **Censused** na resident.
 * Ang label ng sitio: `sitio` sa DB kung may laman; kung wala, tinitingnan ang **complete_address** (at kaugnay na address fields)
 * laban sa listahan ng sitio ng barangay.
 *
 * @return array{totalResidents:int, totalHouseholds:int, totalSeniorResidents:int, censusDemographics: array{seniorCitizens:int, widowed:int, employed:int, unemployed:int, students:int, pwd:int, indigenous:int}, bySitio: list<array{sitio:string, residents:int, count:int}>, seniorCitizensBySitio: list<array{sitio:string, residents:int, count:int}>, widowedBySitio: list<array{sitio:string, residents:int, count:int}>, employedBySitio: list<array{sitio:string, residents:int, count:int}>, unemployedBySitio: list<array{sitio:string, residents:int, count:int}>, studentsBySitio: list<array{sitio:string, residents:int, count:int}>, pwdBySitio: list<array{sitio:string, residents:int, count:int}>, indigenousBySitio: list<array{sitio:string, residents:int, count:int}>, byStatus: list<array{status:string, count:int}>}
 */
function fetchCensusAnalytics(PDO $pdo): array {
    $out = [
        'totalResidents' => 0,
        'totalHouseholds' => 0,
        'totalSeniorResidents' => 0,
        'censusDemographics' => [
            'seniorCitizens' => 0,
            'widowed' => 0,
            'employed' => 0,
            'unemployed' => 0,
            'students' => 0,
            'pwd' => 0,
            'indigenous' => 0,
        ],
        'bySitio' => [],
        'seniorCitizensBySitio' => [],
        'widowedBySitio' => [],
        'employedBySitio' => [],
        'unemployedBySitio' => [],
        'studentsBySitio' => [],
        'pwdBySitio' => [],
        'indigenousBySitio' => [],
        'byStatus' => [],
    ];
    try {
        $chk = $pdo->query("SHOW TABLES LIKE 'census_form'");
        if (!$chk || $chk->rowCount() === 0) {
            return $out;
        }
        $archWhere = '';
        $ac = $pdo->query("SHOW COLUMNS FROM census_form LIKE 'archived_at'");
        if ($ac && $ac->rowCount() > 0) {
            $archWhere = 'WHERE archived_at IS NULL';
        }

        /** WHERE para sa bilang ng Censused residents at breakdown by sitio (parehong lohika) */
        $censusedConds = [];
        if ($archWhere !== '') {
            $censusedConds[] = 'archived_at IS NULL';
        }
        $hasStatus = false;
        $stCheck = $pdo->query("SHOW COLUMNS FROM census_form LIKE 'status'");
        if ($stCheck && $stCheck->rowCount() > 0) {
            $hasStatus = true;
            $censusedConds[] = "(COALESCE(NULLIF(TRIM(status), ''), 'Censused') = 'Censused')";
        }
        $censusedWhere = count($censusedConds) > 0 ? ('WHERE ' . implode(' AND ', $censusedConds)) : '';

        $row = $pdo->query("SELECT COUNT(*) AS c FROM census_form $censusedWhere")->fetch(PDO::FETCH_ASSOC);
        $out['totalResidents'] = (int)($row['c'] ?? 0);

        $row2 = $pdo->query(
            "SELECT COUNT(DISTINCT NULLIF(TRIM(census_id), '')) AS c FROM census_form $censusedWhere"
        )->fetch(PDO::FETCH_ASSOC);
        $out['totalHouseholds'] = (int)($row2['c'] ?? 0);

        $sitioNames = analyticsCensusSitioCanonicalNames();
        $bySitioCounts = [];
        $seniorBySitioCounts = [];
        $widowedBySitioCounts = [];
        $employedBySitioCounts = [];
        $unemployedBySitioCounts = [];
        $studentsBySitioCounts = [];
        $pwdBySitioCounts = [];
        $indigenousBySitioCounts = [];
        $totalSenior = 0;
        $cntWidowed = 0;
        $cntEmployed = 0;
        $cntUnemployed = 0;
        $cntStudents = 0;
        $cntPwd = 0;
        $cntIndigenous = 0;

        $selectCols = ['sitio', 'complete_address', 'street', 'house_no', 'barangay'];
        $optionalCols = ['age', 'birthday', 'civil_status', 'occupation', 'place_of_work', 'disabilities', 'disability', 'pwd', 'indigenous'];
        foreach ($optionalCols as $col) {
            if (censusFormColumnExists($pdo, $col)) {
                $selectCols[] = $col;
            }
        }
        $selectList = implode(', ', $selectCols);

        $stmt = $pdo->query(
            "SELECT {$selectList} FROM census_form $censusedWhere"
        );
        if ($stmt) {
            while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $label = censusResolveSitioLabelFromRow($r, $sitioNames);
                if ($label === '') {
                    $label = '(Unspecified)';
                }
                if (!isset($bySitioCounts[$label])) {
                    $bySitioCounts[$label] = 0;
                }
                $bySitioCounts[$label]++;

                $ageYears = censusAnalyticsResidentAgeYears($r);
                if ($ageYears !== null && $ageYears >= 60) {
                    $totalSenior++;
                    if (!isset($seniorBySitioCounts[$label])) {
                        $seniorBySitioCounts[$label] = 0;
                    }
                    $seniorBySitioCounts[$label]++;
                }

                if (censusAnalyticsIsWidowed($r)) {
                    $cntWidowed++;
                    if (!isset($widowedBySitioCounts[$label])) {
                        $widowedBySitioCounts[$label] = 0;
                    }
                    $widowedBySitioCounts[$label]++;
                }
                if (censusAnalyticsIsEmployed($r)) {
                    $cntEmployed++;
                    if (!isset($employedBySitioCounts[$label])) {
                        $employedBySitioCounts[$label] = 0;
                    }
                    $employedBySitioCounts[$label]++;
                }
                if (censusAnalyticsIsUnemployed($r)) {
                    $cntUnemployed++;
                    if (!isset($unemployedBySitioCounts[$label])) {
                        $unemployedBySitioCounts[$label] = 0;
                    }
                    $unemployedBySitioCounts[$label]++;
                }
                if (censusAnalyticsIsStudent($r)) {
                    $cntStudents++;
                    if (!isset($studentsBySitioCounts[$label])) {
                        $studentsBySitioCounts[$label] = 0;
                    }
                    $studentsBySitioCounts[$label]++;
                }
                if (censusAnalyticsHasPwdRecord($r)) {
                    $cntPwd++;
                    if (!isset($pwdBySitioCounts[$label])) {
                        $pwdBySitioCounts[$label] = 0;
                    }
                    $pwdBySitioCounts[$label]++;
                }
                if (censusAnalyticsIsIndigenous($r)) {
                    $cntIndigenous++;
                    if (!isset($indigenousBySitioCounts[$label])) {
                        $indigenousBySitioCounts[$label] = 0;
                    }
                    $indigenousBySitioCounts[$label]++;
                }
            }
            arsort($bySitioCounts, SORT_NUMERIC);
            foreach ($bySitioCounts as $label => $n) {
                $out['bySitio'][] = [
                    'sitio' => $label,
                    'residents' => (int)$n,
                    'count' => (int)$n,
                ];
            }
            $out['totalSeniorResidents'] = $totalSenior;
            $out['censusDemographics'] = [
                'seniorCitizens' => $totalSenior,
                'widowed' => $cntWidowed,
                'employed' => $cntEmployed,
                'unemployed' => $cntUnemployed,
                'students' => $cntStudents,
                'pwd' => $cntPwd,
                'indigenous' => $cntIndigenous,
            ];
            foreach ($out['bySitio'] as $row) {
                $s = (string)($row['sitio'] ?? '');
                $sn = (int)($seniorBySitioCounts[$s] ?? 0);
                $out['seniorCitizensBySitio'][] = [
                    'sitio' => $s,
                    'residents' => $sn,
                    'count' => $sn,
                ];
                $wn = (int)($widowedBySitioCounts[$s] ?? 0);
                $out['widowedBySitio'][] = [
                    'sitio' => $s,
                    'residents' => $wn,
                    'count' => $wn,
                ];
                $en = (int)($employedBySitioCounts[$s] ?? 0);
                $out['employedBySitio'][] = [
                    'sitio' => $s,
                    'residents' => $en,
                    'count' => $en,
                ];
                $un = (int)($unemployedBySitioCounts[$s] ?? 0);
                $out['unemployedBySitio'][] = [
                    'sitio' => $s,
                    'residents' => $un,
                    'count' => $un,
                ];
                $stn = (int)($studentsBySitioCounts[$s] ?? 0);
                $out['studentsBySitio'][] = [
                    'sitio' => $s,
                    'residents' => $stn,
                    'count' => $stn,
                ];
                $pn = (int)($pwdBySitioCounts[$s] ?? 0);
                $out['pwdBySitio'][] = [
                    'sitio' => $s,
                    'residents' => $pn,
                    'count' => $pn,
                ];
                $in = (int)($indigenousBySitioCounts[$s] ?? 0);
                $out['indigenousBySitio'][] = [
                    'sitio' => $s,
                    'residents' => $in,
                    'count' => $in,
                ];
            }
        }

        if ($hasStatus) {
            $stStmt = $pdo->query(
                "SELECT COALESCE(NULLIF(TRIM(status), ''), 'Censused') AS st, COUNT(*) AS cnt
                 FROM census_form
                 $archWhere
                 GROUP BY COALESCE(NULLIF(TRIM(status), ''), 'Censused')
                 ORDER BY cnt DESC"
            );
            if ($stStmt) {
                while ($r = $stStmt->fetch(PDO::FETCH_ASSOC)) {
                    $out['byStatus'][] = [
                        'status' => (string)($r['st'] ?? ''),
                        'count' => (int)($r['cnt'] ?? 0),
                    ];
                }
            }
        }
    } catch (Throwable $e) {
        error_log('fetchCensusAnalytics: ' . $e->getMessage());
    }
    return $out;
}

/**
 * Generate AI interpretation text for Concerns charts via Groq.
 * Returns keys used by frontend modes: bySitio and period.
 *
 * @param array{month: array, year: array, yearByMonth?: array} $concernsData
 * @param array<int, array{sitio:string, concerns?:array}> $bySitio
 * @return array{bySitio:string, period:string}
 */
function buildConcernsAiInterpretation(array $concernsData, array $bySitio): array {
    $empty = ['bySitio' => '', 'period' => ''];
    $apiKey = defined('GROQ_API_KEY') ? trim((string) GROQ_API_KEY) : '';
    if ($apiKey === '') {
        return $empty;
    }

    $monthReported = (int)($concernsData['month']['reported'] ?? 0);
    $monthResolved = (int)($concernsData['month']['resolved'] ?? 0);
    $yearReported = (int)($concernsData['year']['reported'] ?? 0);
    $yearResolved = (int)($concernsData['year']['resolved'] ?? 0);
    $ybm = is_array($concernsData['yearByMonth'] ?? null) ? $concernsData['yearByMonth'] : [];
    $yearNew = array_sum(array_map('intval', (array)($ybm['new'] ?? [])));
    $yearProcessing = array_sum(array_map('intval', (array)($ybm['processing'] ?? [])));
    $yearRevoked = array_sum(array_map('intval', (array)($ybm['revoked'] ?? [])));
    $yearUnresolved = max(0, $yearNew + $yearProcessing);

    $top = [];
    foreach ($bySitio as $row) {
        $name = trim((string)($row['sitio'] ?? ''));
        if ($name === '') {
            continue;
        }
        $reported = (int)($row['concerns']['year']['reported'] ?? 0);
        $resolved = (int)($row['concerns']['year']['resolved'] ?? 0);
        if ($reported <= 0 && $resolved <= 0) {
            continue;
        }
        $top[] = ['sitio' => $name, 'reported' => $reported, 'resolved' => $resolved];
    }
    usort($top, static function ($a, $b) {
        return ($b['reported'] <=> $a['reported']) ?: ($b['resolved'] <=> $a['resolved']);
    });
    $top = array_slice($top, 0, 3);
    $topLines = [];
    foreach ($top as $t) {
        $topLines[] = "{$t['sitio']} (reported {$t['reported']}, resolved {$t['resolved']})";
    }
    $topSummary = count($topLines) > 0 ? implode('; ', $topLines) : 'No sitio has non-zero concerns yet.';

    $prompt = "You are generating interpretation text for barangay concerns analytics charts.\n";
    $prompt .= "Use this data:\n";
    $prompt .= "- This month: reported={$monthReported}, resolved={$monthResolved}\n";
    $prompt .= "- This year: reported={$yearReported}, resolved={$yearResolved}, unresolved={$yearUnresolved}, revoked={$yearRevoked}\n";
    $prompt .= "- Top sitios this year: {$topSummary}\n\n";
    $prompt .= "Return STRICT JSON only with keys bySitio and period.\n";
    $prompt .= "Rules:\n";
    $prompt .= "- bySitio: 2 concise sentences about sitio distribution and what high/low means.\n";
    $prompt .= "- period: 2 concise sentences about month vs year and reported vs resolved comparison.\n";
    $prompt .= "- Plain text only, no markdown, no HTML, no code fences.\n";
    $prompt .= "JSON schema: {\"bySitio\":\"...\",\"period\":\"...\"}";

    $requestData = [
        'model' => 'llama-3.1-8b-instant',
        'messages' => [
            ['role' => 'system', 'content' => 'Return strict JSON only. Keep wording clear, factual, and concise.'],
            ['role' => 'user', 'content' => $prompt],
        ],
        'temperature' => 0.2,
        'max_tokens' => 280,
    ];

    $ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 14);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || $curlError !== '' || $httpCode !== 200) {
        error_log("Groq AI API error (analytics concerns): HTTP {$httpCode}, Error: {$curlError}");
        return $empty;
    }

    $result = json_decode((string)$response, true);
    $content = trim((string)($result['choices'][0]['message']['content'] ?? ''));
    if ($content === '') {
        return $empty;
    }
    if (preg_match('/\{[\s\S]*\}/', $content, $m)) {
        $content = trim($m[0]);
    }
    $decoded = json_decode($content, true);
    if (!is_array($decoded)) {
        return $empty;
    }

    $bySitioText = trim((string)($decoded['bySitio'] ?? ''));
    $periodText = trim((string)($decoded['period'] ?? ''));
    if ($bySitioText === '' && $periodText === '') {
        return $empty;
    }

    $sanitize = static function (string $s): string {
        $s = preg_replace('/\s+/', ' ', trim($s));
        if ($s === null) {
            return '';
        }
        return mb_substr($s, 0, 700);
    };
    return [
        'bySitio' => $sanitize($bySitioText),
        'period' => $sanitize($periodText),
    ];
}

/**
 * AI interpretation (Filipino) para sa Emergency Reports graphs — Groq; key: GROQ_API_KEY_EMERGENCY (.env)
 *
 * @param array{month: array, year: array, yearByMonth?: array, previous?: array, delta?: array, monthLabel?: string, yearLabel?: string} $emergenciesData
 * @param array<int, array{sitio: string, emergencies?: array}> $bySitio
 */
function buildEmergencyAiInterpretation(array $emergenciesData, array $bySitio): string {
    $apiKey = defined('GROQ_API_KEY_EMERGENCY') ? trim((string) GROQ_API_KEY_EMERGENCY) : '';
    if ($apiKey === '') {
        return '';
    }

    $monthR = (int)($emergenciesData['month']['reported'] ?? 0);
    $monthRes = (int)($emergenciesData['month']['resolved'] ?? 0);
    $yearR = (int)($emergenciesData['year']['reported'] ?? 0);
    $yearRes = (int)($emergenciesData['year']['resolved'] ?? 0);
    $prev = is_array($emergenciesData['previous'] ?? null) ? $emergenciesData['previous'] : [];
    $prevR = (int)($prev['reported'] ?? 0);
    $prevRes = (int)($prev['resolved'] ?? 0);
    $delta = is_array($emergenciesData['delta'] ?? null) ? $emergenciesData['delta'] : [];
    $deltaUnresolved = (int)($delta['value'] ?? 0);

    $ybm = is_array($emergenciesData['yearByMonth'] ?? null) ? $emergenciesData['yearByMonth'] : [];
    $repMonthly = is_array($ybm['reported'] ?? null) ? $ybm['reported'] : [];
    $maxMonthIdx = 0;
    $maxMonthVal = 0;
    foreach ($repMonthly as $idx => $v) {
        $v = (int)$v;
        if ($v > $maxMonthVal) {
            $maxMonthVal = $v;
            $maxMonthIdx = (int)$idx;
        }
    }
    $monthNames = ['Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo', 'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'];
    $peakMonthName = isset($monthNames[$maxMonthIdx]) ? $monthNames[$maxMonthIdx] : '—';

    $top = [];
    foreach ($bySitio as $row) {
        $name = trim((string)($row['sitio'] ?? ''));
        if ($name === '') {
            continue;
        }
        $er = (int)($row['emergencies']['year']['reported'] ?? 0);
        if ($er > 0) {
            $top[] = ['sitio' => $name, 'reported' => $er];
        }
    }
    usort($top, static function ($a, $b) {
        return ($b['reported'] <=> $a['reported']);
    });
    $top = array_slice($top, 0, 3);
    $topLines = [];
    foreach ($top as $t) {
        $topLines[] = "{$t['sitio']}: {$t['reported']} na ulat";
    }
    $topSummary = count($topLines) > 0 ? implode('; ', $topLines) : 'Walang sitio na may emergency report sa taon (0).';

    $monthLabel = trim((string)($emergenciesData['monthLabel'] ?? ''));
    $yearLabel = trim((string)($emergenciesData['yearLabel'] ?? ''));

    $prompt = "You are generating a short interpretation for barangay emergency_reports analytics (Philippines).\n";
    $prompt .= "Scope labels: month period ≈ \"{$monthLabel}\", calendar year = \"{$yearLabel}\".\n";
    $prompt .= "Counts:\n";
    $prompt .= "- Selected month range: reported={$monthR}, resolved={$monthRes}\n";
    $prompt .= "- Calendar year to date: reported={$yearR}, resolved={$yearRes}\n";
    $prompt .= "- Previous month period (for trend): reported={$prevR}, resolved={$prevRes}\n";
    $prompt .= "- Delta of (reported−resolved) vs previous period: {$deltaUnresolved} (positive means backlog gap widened vs previous)\n";
    $prompt .= "- Busiest calendar month by reported count this year: {$peakMonthName} (max {$maxMonthVal})\n";
    $prompt .= "- Top sitios this year by reported: {$topSummary}\n\n";
    $prompt .= "Return STRICT JSON only: {\"summary\":\"...\"}.\n";
    $prompt .= "Rules for summary:\n";
    $prompt .= "- 2-4 sentences in Filipino (Tagalog), professional, plain text only, no markdown/HTML.\n";
    $prompt .= "- Mention month vs year, resolution, trend vs previous period if useful, and sitio concentration if clear.\n";
    $prompt .= "- If all zeros, say plainly that there are no/minimal reports in the data shown.\n";

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
        error_log("Groq AI API error (analytics emergency): HTTP {$httpCode}, Error: {$curlError}");
        return '';
    }

    $result = json_decode((string)$response, true);
    $content = trim((string)($result['choices'][0]['message']['content'] ?? ''));
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

    $summary = trim((string)($decoded['summary'] ?? ''));
    if ($summary === '') {
        return '';
    }

    $summary = preg_replace('/\s+/', ' ', $summary);
    if ($summary === null) {
        return '';
    }
    return mb_substr($summary, 0, 1200);
}

function fetchDocumentCounts(PDO $pdo, string $table, string $start, string $end): int {
    $stmt = $pdo->prepare("SELECT COUNT(*) AS total FROM {$table} WHERE submitted_at BETWEEN :start AND :end");
    $stmt->execute([':start' => $start, ':end' => $end]);
    return (int)$stmt->fetchColumn();
}

/** 24 sitios — pareho sa analytics / census dropdown (isang source: analyticsCensusSitioCanonicalNames) */
$analyticsSitioList = analyticsCensusSitioCanonicalNames();

/**
 * Pull concern statements with location in a date range.
 *
 * @return array<int, array{location:string, statement:string}>
 */
function fetchConcernStatementRows(PDO $pdo, string $start, string $end): array {
    $stmt = $pdo->prepare("
        SELECT LOWER(TRIM(COALESCE(location, ''))) AS location_key,
               TRIM(COALESCE(statement, '')) AS statement_text
        FROM concerns
        WHERE date_and_time BETWEEN :start AND :end
          AND TRIM(COALESCE(statement, '')) <> ''
    ");
    $stmt->execute([':start' => $start, ':end' => $end]);
    $rows = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $rows[] = [
            'location' => (string)($row['location_key'] ?? ''),
            'statement' => (string)($row['statement_text'] ?? ''),
        ];
    }
    return $rows;
}

/**
 * Line chart series: resident concern ratings — mababa (1–2) vs mataas (4–5) over time.
 *
 * @return array{
 *   labels: array<int,string>,
 *   low: array<int,int>,
 *   high: array<int,int>,
 *   totals: array{low:int,high:int,mid:int,rated:int,positive:int,negative:int},
 *   average: float|null,
 *   bucket: string,
 *   hasRatingColumn: bool
 * }
 */
function buildConcernRatingLineSeries(PDO $pdo, string $rangeStart, string $rangeEnd, string $period, DateTimeZone $timezone): array {
    $base = [
        'labels' => [],
        'low' => [],
        'high' => [],
        'totals' => ['low' => 0, 'high' => 0, 'mid' => 0, 'rated' => 0, 'positive' => 0, 'negative' => 0],
        'average' => null,
        'bucket' => 'day',
        'hasRatingColumn' => false,
    ];
    $cols = getColumnNames($pdo, 'concerns');
    if (!in_array('rating', $cols, true)) {
        return $base;
    }
    $base['hasRatingColumn'] = true;

    try {
        $startDt = new DateTime($rangeStart, $timezone);
        $endDt = new DateTime($rangeEnd, $timezone);
    } catch (Exception $e) {
        return $base;
    }

    $spanDays = max(1, (int) floor(($endDt->getTimestamp() - $startDt->getTimestamp()) / 86400) + 1);
    $useMonthlyBuckets = ($period === 'year') || $spanDays > 62;

    $totStmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(CASE WHEN CAST(rating AS SIGNED) BETWEEN 1 AND 2 THEN 1 ELSE 0 END), 0) AS low_cnt,
            COALESCE(SUM(CASE WHEN CAST(rating AS SIGNED) = 3 THEN 1 ELSE 0 END), 0) AS mid_cnt,
            COALESCE(SUM(CASE WHEN CAST(rating AS SIGNED) BETWEEN 4 AND 5 THEN 1 ELSE 0 END), 0) AS high_cnt,
            COALESCE(SUM(CASE WHEN CAST(rating AS SIGNED) BETWEEN 3 AND 5 THEN 1 ELSE 0 END), 0) AS positive_cnt,
            COALESCE(SUM(CASE WHEN CAST(rating AS SIGNED) BETWEEN 1 AND 2 THEN 1 ELSE 0 END), 0) AS negative_cnt,
            COALESCE(COUNT(*), 0) AS rated_cnt,
            AVG(CAST(rating AS SIGNED)) AS avg_rating
        FROM concerns
        WHERE date_and_time BETWEEN :start AND :end
          AND rating IS NOT NULL
          AND CAST(rating AS SIGNED) BETWEEN 1 AND 5
    ");
    $totStmt->execute([':start' => $rangeStart, ':end' => $rangeEnd]);
    $tr = $totStmt->fetch(PDO::FETCH_ASSOC);
    if ($tr) {
        $base['totals'] = [
            'low' => (int)($tr['low_cnt'] ?? 0),
            'mid' => (int)($tr['mid_cnt'] ?? 0),
            'high' => (int)($tr['high_cnt'] ?? 0),
            'rated' => (int)($tr['rated_cnt'] ?? 0),
            'positive' => (int)($tr['positive_cnt'] ?? 0),
            'negative' => (int)($tr['negative_cnt'] ?? 0),
        ];
        $avgRaw = $tr['avg_rating'] ?? null;
        $base['average'] = $avgRaw !== null && $avgRaw !== '' ? round((float)$avgRaw, 2) : null;
    }

    if ($useMonthlyBuckets) {
        $base['bucket'] = 'month';
        $stmt = $pdo->prepare("
            SELECT DATE_FORMAT(date_and_time, '%Y-%m') AS ym,
                   COALESCE(SUM(CASE WHEN CAST(rating AS SIGNED) BETWEEN 1 AND 2 THEN 1 ELSE 0 END), 0) AS low_cnt,
                   COALESCE(SUM(CASE WHEN CAST(rating AS SIGNED) BETWEEN 4 AND 5 THEN 1 ELSE 0 END), 0) AS high_cnt
            FROM concerns
            WHERE date_and_time BETWEEN :start AND :end
              AND rating IS NOT NULL
              AND CAST(rating AS SIGNED) BETWEEN 1 AND 5
            GROUP BY DATE_FORMAT(date_and_time, '%Y-%m')
        ");
        $stmt->execute([':start' => $rangeStart, ':end' => $rangeEnd]);
        $byYm = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $ym = (string)($row['ym'] ?? '');
            if ($ym !== '') {
                $byYm[$ym] = [
                    'low' => (int)($row['low_cnt'] ?? 0),
                    'high' => (int)($row['high_cnt'] ?? 0),
                ];
            }
        }
        $cur = (clone $startDt)->modify('first day of this month')->setTime(0, 0, 0);
        $endMonth = (clone $endDt)->modify('first day of this month')->setTime(0, 0, 0);
        while ($cur <= $endMonth) {
            $ym = $cur->format('Y-m');
            $base['labels'][] = $cur->format('M Y');
            $base['low'][] = (int)($byYm[$ym]['low'] ?? 0);
            $base['high'][] = (int)($byYm[$ym]['high'] ?? 0);
            $cur->modify('first day of next month');
        }
        return $base;
    }

    $base['bucket'] = 'day';
    $stmt = $pdo->prepare("
        SELECT DATE(date_and_time) AS d,
               COALESCE(SUM(CASE WHEN CAST(rating AS SIGNED) BETWEEN 1 AND 2 THEN 1 ELSE 0 END), 0) AS low_cnt,
               COALESCE(SUM(CASE WHEN CAST(rating AS SIGNED) BETWEEN 4 AND 5 THEN 1 ELSE 0 END), 0) AS high_cnt
        FROM concerns
        WHERE date_and_time BETWEEN :start AND :end
          AND rating IS NOT NULL
          AND CAST(rating AS SIGNED) BETWEEN 1 AND 5
        GROUP BY DATE(date_and_time)
    ");
    $stmt->execute([':start' => $rangeStart, ':end' => $rangeEnd]);
    $byDay = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $d = (string)($row['d'] ?? '');
        if ($d !== '') {
            $byDay[$d] = [
                'low' => (int)($row['low_cnt'] ?? 0),
                'high' => (int)($row['high_cnt'] ?? 0),
            ];
        }
    }
    $cur = (clone $startDt)->setTime(0, 0, 0);
    $endDay = (clone $endDt)->setTime(0, 0, 0);
    while ($cur <= $endDay) {
        $key = $cur->format('Y-m-d');
        $base['labels'][] = $cur->format('j');
        $base['low'][] = (int)($byDay[$key]['low'] ?? 0);
        $base['high'][] = (int)($byDay[$key]['high'] ?? 0);
        $cur->modify('+1 day');
    }

    return $base;
}

/**
 * @return array{positiveWords:array<int,string>,negativeWords:array<int,string>,positiveInterpretation:string,negativeInterpretation:string}
 */
function defaultConcernSentimentInsight(): array {
    return [
        'positiveWords' => [],
        'negativeWords' => [],
        'positiveInterpretation' => '',
        'negativeInterpretation' => '',
    ];
}

/**
 * @return array{positive:array<string,array<int,string>>,negative:array<string,array<int,string>>}
 */
function concernSentimentWordLexicon(): array {
    return [
        'positive' => [
            'maayos' => ['maayos', 'organisado', 'organized'],
            'mabilis' => ['mabilis', 'agad', 'agarang', 'quick', 'fast'],
            'malinis' => ['malinis', 'malinaw', 'clear'],
            'maingat' => ['maingat', 'ingat', 'ingatang'],
            'maganda' => ['maganda', 'okay', 'ok', 'ayos', 'good'],
            'mahusay' => ['mahusay', 'epektibo', 'excellent'],
            'responsive' => ['responsive', 'tumutugon', 'sumasagot'],
            'helpful' => ['helpful', 'matulungin', 'tumulong'],
        ],
        'negative' => [
            'magulo' => ['magulo', 'gulo', 'disorganized'],
            'matagal' => ['matagal', 'mabagal', 'delay', 'delayed'],
            'mahirap' => ['mahirap', 'hirap', 'complicated'],
            'marumi' => ['marumi', 'dumi', 'madumi'],
            'mapanganib' => ['mapanganib', 'delikado', 'danger'],
            'kulang' => ['kulang', 'insufficient', 'bitin'],
            'sira' => ['sira', 'sirang', 'broken'],
            'reklamo' => ['reklamo', 'complaint'],
        ],
    ];
}

/**
 * @param array<int,string> $statements
 * @param 'positive'|'negative' $sentiment
 * @param int|null $limit
 * @return array<int,string>
 */
function extractFrequentSentimentWordsFromStatements(array $statements, string $sentiment, ?int $limit = null): array {
    $lexicon = concernSentimentWordLexicon();
    $bucket = isset($lexicon[$sentiment]) && is_array($lexicon[$sentiment]) ? $lexicon[$sentiment] : [];
    if (count($bucket) === 0 || count($statements) === 0) {
        return [];
    }

    $counts = [];
    foreach ($bucket as $canonical => $variants) {
        $counts[(string)$canonical] = 0;
        $list = is_array($variants) ? $variants : [];
        foreach ($statements as $statement) {
            $text = mb_strtolower(trim((string)$statement));
            if ($text === '') {
                continue;
            }
            foreach ($list as $variant) {
                $needle = mb_strtolower(trim((string)$variant));
                if ($needle === '') {
                    continue;
                }
                if (mb_strpos($text, $needle) !== false) {
                    $counts[(string)$canonical]++;
                    break;
                }
            }
        }
    }

    arsort($counts);
    $out = [];
    foreach ($counts as $word => $count) {
        if ((int)$count <= 0) {
            continue;
        }
        $out[] = mb_strtoupper((string)$word);
        if ($limit !== null && $limit > 0 && count($out) >= $limit) {
            break;
        }
    }
    return $out;
}

/**
 * Sentiment word filtering from concerns.statement via Groq.
 *
 * @param array<int, array{location:string, statement:string}> $rows
 * @return array{positiveWords:array<int,string>,negativeWords:array<int,string>,positiveInterpretation:string,negativeInterpretation:string}
 */
function buildConcernSentimentInsight(array $rows): array {
    $empty = defaultConcernSentimentInsight();
    $apiKey = defined('SENTIMENT_ANALYSIS_API_KEY') ? trim((string) SENTIMENT_ANALYSIS_API_KEY) : '';
    if ($apiKey === '' || count($rows) === 0) {
        return $empty;
    }

    $statements = [];
    foreach ($rows as $row) {
        $text = trim((string)($row['statement'] ?? ''));
        if ($text === '') {
            continue;
        }
        $statements[] = $text;
        if (count($statements) >= 80) {
            break;
        }
    }
    if (count($statements) === 0) {
        return $empty;
    }

    $freqPositiveWords = extractFrequentSentimentWordsFromStatements($statements, 'positive');
    $freqNegativeWords = extractFrequentSentimentWordsFromStatements($statements, 'negative');

    $prompt = "Analyze these concern statements from a barangay system.\n";
    $prompt .= "Return STRICT JSON only with keys: positiveWords, negativeWords, positiveInterpretation, negativeInterpretation.\n";
    $prompt .= "Rules:\n";
    $prompt .= "- positiveWords: array of concise Filipino words that indicate positive interpretation/action (single word each, no duplicates), ordered by most frequent first.\n";
    $prompt .= "- negativeWords: array of concise Filipino words reflecting common negative sentiment in statements, ordered by most frequent first.\n";
    $prompt .= "- positiveInterpretation: 1 short Filipino sentence reframing the feedback into constructive positive direction.\n";
    $prompt .= "- negativeInterpretation: 1 short Filipino sentence summarizing the negative tone.\n";
    $prompt .= "- No markdown, no backticks, no extra keys.\n";
    if (count($freqPositiveWords) > 0) {
        $prompt .= "- Priority hint: frequent positive words detected from statements = " . implode(', ', $freqPositiveWords) . ". Keep aligned.\n";
    }
    $prompt .= "Statements:\n- " . implode("\n- ", $statements);

    $requestData = [
        'model' => 'llama-3.1-8b-instant',
        'messages' => [
            ['role' => 'system', 'content' => 'Return strict JSON only. Keep responses concise and in Filipino.'],
            ['role' => 'user', 'content' => $prompt],
        ],
        'temperature' => 0.2,
        'max_tokens' => 280,
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
        error_log("Groq API error (concern sentiment): HTTP {$httpCode}, Error: {$curlError}");
        return $empty;
    }

    $parsed = json_decode((string)$response, true);
    $content = trim((string)($parsed['choices'][0]['message']['content'] ?? ''));
    if ($content === '') {
        return $empty;
    }
    if (preg_match('/\{[\s\S]*\}/', $content, $m)) {
        $content = trim($m[0]);
    }
    $decoded = json_decode($content, true);
    if (!is_array($decoded)) {
        return $empty;
    }

    $sanitizeWord = static function ($word): string {
        $w = trim((string)$word);
        $w = preg_replace('/[^[:alpha:]\- ]/u', '', $w) ?? '';
        $w = preg_replace('/\s+/', ' ', $w) ?? '';
        $w = trim($w);
        if ($w === '') {
            return '';
        }
        return mb_strtoupper(mb_substr($w, 0, 20));
    };
    $sanitizeText = static function ($text): string {
        $s = preg_replace('/\s+/', ' ', trim((string)$text));
        if ($s === null) {
            return '';
        }
        return mb_substr($s, 0, 220);
    };
    $sanitizeWords = static function ($items) use ($sanitizeWord): array {
        $out = [];
        if (!is_array($items)) {
            return $out;
        }
        foreach ($items as $item) {
            $w = $sanitizeWord($item);
            if ($w === '' || in_array($w, $out, true)) {
                continue;
            }
            $out[] = $w;
        }
        return $out;
    };

    $positiveWords = count($freqPositiveWords) > 0 ? $freqPositiveWords : $sanitizeWords($decoded['positiveWords'] ?? []);
    $negativeWords = count($freqNegativeWords) > 0 ? $freqNegativeWords : $sanitizeWords($decoded['negativeWords'] ?? []);

    return [
        'positiveWords' => $positiveWords,
        'negativeWords' => $negativeWords,
        'positiveInterpretation' => $sanitizeText($decoded['positiveInterpretation'] ?? ''),
        'negativeInterpretation' => $sanitizeText($decoded['negativeInterpretation'] ?? ''),
    ];
}

/**
 * @return array<string, array{label:string, recommendation:string, keywords:string[]}>
 */
function concernStatementTopicCatalog(): array {
    return [
        'crime_safety' => [
            'label' => 'Crime and public safety',
            'recommendation' => 'Dagdagan ang ronda ng tanod sa mga lugar na madalas ireklamo, at siguraduhing mabilis ang aksyon kapag paulit-ulit ang concern.',
            'keywords' => ['nakaw', 'magnanakaw', 'krimen', 'crime', 'holdap', 'snatching', 'baril', 'away', 'violence', 'gulo', 'suntukan', 'threat', 'banta']
        ],
        'environment' => [
            'label' => 'Environment and pollution',
            'recommendation' => 'Mag-schedule ng regular na linis sa area, paalalahanan ang mga tao tungkol sa tamang pagtatapon, at bantayan ang mga lugar na laging may reklamo.',
            'keywords' => ['basura', 'garbage', 'pollution', 'polusyon', 'marumi', 'usok', 'smoke', 'ilog', 'creek', 'environment', 'kapaligiran', 'dumi']
        ],
        'drainage_flood' => [
            'label' => 'Drainage and flooding',
            'recommendation' => 'Maglinis ng kanal nang regular, i-check ito kada linggo, at maghanda ng quick clearing team lalo na bago at habang tag-ulan.',
            'keywords' => ['baha', 'flood', 'drain', 'drainage', 'kanal', 'barado', 'clog', 'tubig', 'tumutulo']
        ],
        'road_infra' => [
            'label' => 'Road and infrastructure',
            'recommendation' => 'Unahin ang pag-ayos ng pinaka delikadong sira, lagyan muna ng pansamantalang warning o harang, at ipa-check agad kung paulit-ulit ang problema.',
            'keywords' => ['kalsada', 'kalye', 'lubak', 'road', 'street', 'sirang daan', 'bridge', 'tulay', 'poste', 'streetlight', 'ilaw']
        ],
        'utilities' => [
            'label' => 'Utilities and services',
            'recommendation' => 'Makipag-ugnayan agad sa utility provider, magbigay ng malinaw na update sa residents, at i-follow up ang mga report na hindi pa naaayos.',
            'keywords' => ['kuryente', 'electric', 'brownout', 'water', 'tubig', 'internet', 'signal', 'linya', 'power']
        ],
        'other' => [
            'label' => 'General community concern',
            'recommendation' => 'Basahin nang maigi ang mga report, pagsamahin ang magkakaparehong concern, at gumawa ng simpleng follow-up plan para sa mga paulit-ulit na issue.',
            'keywords' => []
        ],
    ];
}

function classifyConcernStatementTopic(string $statement): string {
    $text = strtolower(trim($statement));
    if ($text === '') {
        return 'other';
    }
    $catalog = concernStatementTopicCatalog();
    foreach ($catalog as $key => $def) {
        $keywords = $def['keywords'] ?? [];
        foreach ($keywords as $kw) {
            if ($kw !== '' && strpos($text, strtolower((string)$kw)) !== false) {
                return $key;
            }
        }
    }
    return 'other';
}

/**
 * @return array{topicKey:string, topicLabel:string, topicCount:int, totalStatements:int, recommendation:string}
 */
function defaultConcernStatementInsight(): array {
    $catalog = concernStatementTopicCatalog();
    return [
        'topicKey' => 'other',
        'topicLabel' => (string)($catalog['other']['label'] ?? 'General community concern'),
        'topicCount' => 0,
        'totalStatements' => 0,
        'recommendation' => (string)($catalog['other']['recommendation'] ?? ''),
    ];
}

/**
 * Build per-sitio statement insight summary from concerns.statement.
 *
 * @param array<int, string> $sitioList
 * @param array<int, array{location:string, statement:string}> $rows
 * @return array<string, array{topicKey:string, topicLabel:string, topicCount:int, totalStatements:int, recommendation:string}>
 */
function buildConcernStatementInsightsBySitio(array $sitioList, array $rows): array {
    $catalog = concernStatementTopicCatalog();
    $topicCounts = [];
    foreach ($sitioList as $sitio) {
        $topicCounts[$sitio] = ['total' => 0, 'topics' => []];
    }

    foreach ($rows as $row) {
        $loc = (string)($row['location'] ?? '');
        $statement = (string)($row['statement'] ?? '');
        if ($loc === '' || $statement === '') {
            continue;
        }
        $topicKey = classifyConcernStatementTopic($statement);
        foreach ($sitioList as $sitio) {
            if (!analyticsLocationMatchesSitio($loc, (string)$sitio)) {
                continue;
            }
            $topicCounts[$sitio]['total']++;
            if (!isset($topicCounts[$sitio]['topics'][$topicKey])) {
                $topicCounts[$sitio]['topics'][$topicKey] = 0;
            }
            $topicCounts[$sitio]['topics'][$topicKey]++;
            break;
        }
    }

    $out = [];
    foreach ($sitioList as $sitio) {
        $base = defaultConcernStatementInsight();
        $total = (int)($topicCounts[$sitio]['total'] ?? 0);
        $map = (array)($topicCounts[$sitio]['topics'] ?? []);
        if ($total <= 0 || count($map) === 0) {
            $out[$sitio] = $base;
            continue;
        }
        arsort($map);
        $topKey = (string)array_key_first($map);
        $topCount = (int)($map[$topKey] ?? 0);
        $def = $catalog[$topKey] ?? $catalog['other'];
        $out[$sitio] = [
            'topicKey' => $topKey,
            'topicLabel' => (string)($def['label'] ?? $base['topicLabel']),
            'topicCount' => $topCount,
            'totalStatements' => $total,
            'recommendation' => (string)($def['recommendation'] ?? $base['recommendation']),
        ];
    }
    return $out;
}

/**
 * Buong taon: buwan (1–12) => araw => location key => count (isang query).
 *
 * @return array<int, array<int, array<string, int>>>
 */
function fetchEmergencyYearMonthDayLocationBuckets(PDO $pdo, string $yearStart, string $yearEnd): array {
    $stmt = $pdo->prepare("
        SELECT MONTH(date_and_time) AS mo,
               DAY(date_and_time) AS d,
               LOWER(TRIM(COALESCE(location, ''))) AS k,
               COUNT(*) AS c
        FROM emergency_reports
        WHERE date_and_time BETWEEN :s AND :e
        GROUP BY MONTH(date_and_time), DAY(date_and_time), k
    ");
    $stmt->execute([':s' => $yearStart, ':e' => $yearEnd]);
    $out = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $mo = (int)($row['mo'] ?? 0);
        $d = (int)($row['d'] ?? 0);
        if ($mo < 1 || $mo > 12 || $d < 1 || $d > 31) {
            continue;
        }
        if (!isset($out[$mo])) {
            $out[$mo] = [];
        }
        if (!isset($out[$mo][$d])) {
            $out[$mo][$d] = [];
        }
        $k = (string)($row['k'] ?? '');
        $out[$mo][$d][$k] = (int)($row['c'] ?? 0);
    }
    return $out;
}

/**
 * @param array<int, array<int, array<string, int>>> $yearMonthDayBuckets
 * @return array<string, array> keys YYYY-MM
 */
function buildEmergencyHeatmapByMonthForYear(array $yearMonthDayBuckets, int $calendarYear, DateTimeZone $timezone, ?string $sitioOnly): array {
    $out = [];
    for ($mo = 1; $mo <= 12; $mo++) {
        $dayBucketsForMonth = $yearMonthDayBuckets[$mo] ?? [];
        $monthStartStr = sprintf('%04d-%02d-01 00:00:00', $calendarYear, $mo);
        $key = sprintf('%04d-%02d', $calendarYear, $mo);
        $out[$key] = buildEmergencyCurrentMonthDailyPayload($dayBucketsForMonth, $monthStartStr, $timezone, $sitioOnly);
    }
    return $out;
}

/**
 * Document requests: dating logic — eksakto o substring sa address/sitio (para bumalik ang pie/bar by sitio).
 */
function analyticsLocationMatchesSitioDocuments(string $dbKey, string $sitio): bool {
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
 * Per location key:
 * - `resolved` = bilang ng rows na `status` (normalized) ay `resolved` → berdeng segment ng stacked bar.
 * - `new` / `processing` = hiwalay na bilang para sa tooltip; ang pulang segment = `new` + `processing`.
 *
 * @return array<string, array{total:int, resolved:int, new:int, processing:int, revoked:int}>
 */
function fetchConcernLocationGroups(PDO $pdo, string $start, string $end): array {
    $sql = "
        SELECT LOWER(TRIM(COALESCE(location, ''))) AS k,
               COUNT(*) AS total,
               SUM(CASE WHEN LOWER(TRIM(COALESCE(status, ''))) = 'resolved' THEN 1 ELSE 0 END) AS resolved,
               SUM(CASE WHEN LOWER(TRIM(COALESCE(status, ''))) = 'new' THEN 1 ELSE 0 END) AS new_cnt,
               SUM(CASE WHEN LOWER(TRIM(COALESCE(status, ''))) = 'processing' THEN 1 ELSE 0 END) AS processing,
               SUM(CASE WHEN LOWER(TRIM(COALESCE(status, ''))) = 'revoked' THEN 1 ELSE 0 END) AS revoked_cnt
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
            'new' => (int)($row['new_cnt'] ?? 0),
            'processing' => (int)($row['processing'] ?? 0),
            'revoked' => (int)($row['revoked_cnt'] ?? 0),
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
 * @param array<string, array{total:int, resolved:int, new?:int, processing?:int, revoked?:int}> $groups
 * @return array{reported:int, resolved:int, new?:int, processing?:int, revoked?:int}
 */
function aggregateConcernOrEmergencyGroupsForSitio(array $groups, string $sitio): array {
    $schemaHasProcessing = false;
    $schemaHasNew = false;
    $schemaHasRevoked = false;
    foreach ($groups as $row) {
        if (!is_array($row)) {
            continue;
        }
        if (array_key_exists('processing', $row)) {
            $schemaHasProcessing = true;
        }
        if (array_key_exists('new', $row)) {
            $schemaHasNew = true;
        }
        if (array_key_exists('revoked', $row)) {
            $schemaHasRevoked = true;
        }
    }
    $reported = 0;
    $resolved = 0;
    $processing = 0;
    $new = 0;
    $revoked = 0;
    foreach ($groups as $k => $row) {
        if (!analyticsLocationMatchesSitio((string)$k, $sitio)) {
            continue;
        }
        $reported += (int)($row['total'] ?? 0);
        $resolved += (int)($row['resolved'] ?? 0);
        if ($schemaHasProcessing) {
            $processing += (int)($row['processing'] ?? 0);
        }
        if ($schemaHasNew) {
            $new += (int)($row['new'] ?? 0);
        }
        if ($schemaHasRevoked) {
            $revoked += (int)($row['revoked'] ?? 0);
        }
    }
    $result = ['reported' => $reported, 'resolved' => $resolved];
    if ($schemaHasNew) {
        $result['new'] = $new;
    }
    if ($schemaHasProcessing) {
        $result['processing'] = $processing;
    }
    if ($schemaHasRevoked) {
        $result['revoked'] = $revoked;
    }
    return $result;
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
            if (analyticsLocationMatchesSitioDocuments((string)$k, $sitio)) {
                $n += (int)$c;
            }
        }
        $out[$label] = $n;
        $sumTotal += $n;
    }
    $out['total'] = $sumTotal;
    return $out;
}

/**
 * Buwan-buwang count (Enero = index 0 … Disyembre = 11) sa date range.
 *
 * @return array<int, int>
 */
function fetchDocumentMonthlyCounts(PDO $pdo, string $table, string $start, string $end): array {
    $out = array_fill(0, 12, 0);
    $stmt = $pdo->prepare("
        SELECT MONTH(submitted_at) AS m, COUNT(*) AS c
        FROM `{$table}`
        WHERE submitted_at BETWEEN :start AND :end
        GROUP BY MONTH(submitted_at)
    ");
    $stmt->execute([':start' => $start, ':end' => $end]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $m = (int)($row['m'] ?? 0);
        if ($m >= 1 && $m <= 12) {
            $out[$m - 1] = (int)($row['c'] ?? 0);
        }
    }
    return $out;
}

/**
 * Buwan 1–12 => address key => count (para sa hatian ayon sa sitio).
 *
 * @return array<int, array<string, int>>
 */
function fetchDocumentMonthlyAddressGroups(PDO $pdo, string $table, string $start, string $end): array {
    $byMonth = [];
    for ($m = 1; $m <= 12; $m++) {
        $byMonth[$m] = [];
    }
    $cols = getColumnNames($pdo, $table);
    $addrCol = findColumn($cols, ['sitio', 'location', 'address']);
    if (!$addrCol) {
        return $byMonth;
    }
    $stmt = $pdo->prepare("
        SELECT MONTH(submitted_at) AS m, LOWER(TRIM(COALESCE(`{$addrCol}`, ''))) AS k, COUNT(*) AS c
        FROM `{$table}`
        WHERE submitted_at BETWEEN :s AND :e
        GROUP BY MONTH(submitted_at), k
    ");
    $stmt->execute([':s' => $start, ':e' => $end]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $m = (int)($row['m'] ?? 0);
        if ($m < 1 || $m > 12) {
            continue;
        }
        $k = (string)($row['k'] ?? '');
        $byMonth[$m][$k] = (int)($row['c'] ?? 0);
    }
    return $byMonth;
}

/**
 * @param array<string, array<int, array<string, int>>> $docMonthMapsByLabel
 * @return array<string, array<int, int>>
 */
function aggregateDocumentMonthlyGroupsForSitio(array $docMonthMapsByLabel, string $sitio): array {
    $out = [];
    $sumTotal = array_fill(0, 12, 0);
    foreach ($docMonthMapsByLabel as $label => $byMonth) {
        $series = array_fill(0, 12, 0);
        for ($mi = 0; $mi < 12; $mi++) {
            $m = $mi + 1;
            $map = $byMonth[$m] ?? [];
            foreach ($map as $k => $c) {
                if (analyticsLocationMatchesSitioDocuments((string)$k, $sitio)) {
                    $series[$mi] += (int)$c;
                }
            }
        }
        $out[$label] = $series;
        for ($mi = 0; $mi < 12; $mi++) {
            $sumTotal[$mi] += $series[$mi];
        }
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

$documentsYearByMonth = [];
$documentsYearByMonthTotals = array_fill(0, 12, 0);
foreach ($documentTables as $label => $table) {
    $ym = fetchDocumentMonthlyCounts($pdo, $table, $yearStart, $yearEnd);
    $documentsYearByMonth[$label] = $ym;
    for ($i = 0; $i < 12; $i++) {
        $documentsYearByMonthTotals[$i] += $ym[$i];
    }
}
$documentsYearByMonth['total'] = $documentsYearByMonthTotals;

$concernsRange = fetchSummary($pdo, 'concerns', 'date_and_time', $rangeStart, $rangeEnd);
$concernsRange['reportedExcludingNew'] = fetchConcernReportedExcludingNew($pdo, $rangeStart, $rangeEnd);
$concernsYear = fetchSummary($pdo, 'concerns', 'date_and_time', $yearStart, $yearEnd);
$concernsYear['reportedExcludingNew'] = fetchConcernReportedExcludingNew($pdo, $yearStart, $yearEnd);
$concernsPrev = fetchSummary($pdo, 'concerns', 'date_and_time', $previousRangeStart, $previousRangeEnd);
$concernsYearByMonth = fetchConcernsMonthlyReportedResolved($pdo, $yearStart, $yearEnd);

$emergenciesRange = fetchSummary($pdo, 'emergency_reports', 'date_and_time', $rangeStart, $rangeEnd);
$emergenciesYear = fetchSummary($pdo, 'emergency_reports', 'date_and_time', $yearStart, $yearEnd);
$emergenciesPrev = fetchSummary($pdo, 'emergency_reports', 'date_and_time', $previousRangeStart, $previousRangeEnd);
$emergenciesYearByMonth = fetchEmergencyMonthlyReportedResolved($pdo, $yearStart, $yearEnd);
$emergencyYearMonthLocBuckets = fetchEmergencyMonthlyLocationKeyBuckets($pdo, $yearStart, $yearEnd);
$heatmapCalendarYear = (int)$now->format('Y');
$emergencyYearMonthDayLocBuckets = fetchEmergencyYearMonthDayLocationBuckets($pdo, $yearStart, $yearEnd);
$emergencyHeatmapByMonth = buildEmergencyHeatmapByMonthForYear($emergencyYearMonthDayLocBuckets, $heatmapCalendarYear, $timezone, null);
$currentMonthKey = sprintf('%04d-%02d', $heatmapCalendarYear, (int)$now->format('n'));
$emergencyCurrentMonthDaily = $emergencyHeatmapByMonth[$currentMonthKey] ?? buildEmergencyCurrentMonthDailyPayload([], $monthStart, $timezone, null);

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
$concernsMonthStatementRows = fetchConcernStatementRows($pdo, $rangeStart, $rangeEnd);
$concernsYearStatementRows = fetchConcernStatementRows($pdo, $yearStart, $yearEnd);
$concernsMonthSentimentInsight = buildConcernSentimentInsight($concernsMonthStatementRows);
$concernsYearSentimentInsight = buildConcernSentimentInsight($concernsYearStatementRows);
$concernsStatementInsightsBySitioMonth = buildConcernStatementInsightsBySitio($analyticsSitioList, $concernsMonthStatementRows);
$concernsStatementInsightsBySitioYear = buildConcernStatementInsightsBySitio($analyticsSitioList, $concernsYearStatementRows);
$emergRangeGroups = fetchEmergencyLocationGroups($pdo, $rangeStart, $rangeEnd);
$emergYearGroups = fetchEmergencyLocationGroups($pdo, $yearStart, $yearEnd);

$docRangeMaps = [];
$docYearMaps = [];
foreach ($documentTables as $label => $table) {
    $docRangeMaps[$label] = fetchDocumentAddressGroups($pdo, $table, $rangeStart, $rangeEnd);
    $docYearMaps[$label] = fetchDocumentAddressGroups($pdo, $table, $yearStart, $yearEnd);
}

$docYearMonthAddrMaps = [];
foreach ($documentTables as $label => $table) {
    $docYearMonthAddrMaps[$label] = fetchDocumentMonthlyAddressGroups($pdo, $table, $yearStart, $yearEnd);
}

$bySitio = [];
foreach ($analyticsSitioList as $sitio) {
    $sitioHeatmapByMonth = buildEmergencyHeatmapByMonthForYear($emergencyYearMonthDayLocBuckets, $heatmapCalendarYear, $timezone, $sitio);
    $bySitio[] = [
        'sitio' => $sitio,
        'concerns' => [
            'month' => aggregateConcernOrEmergencyGroupsForSitio($concernsRangeGroups, $sitio),
            'year' => aggregateConcernOrEmergencyGroupsForSitio($concernsYearGroups, $sitio),
            'statementInsights' => [
                'month' => $concernsStatementInsightsBySitioMonth[$sitio] ?? defaultConcernStatementInsight(),
                'year' => $concernsStatementInsightsBySitioYear[$sitio] ?? defaultConcernStatementInsight(),
            ],
        ],
        'emergencies' => [
            'month' => aggregateConcernOrEmergencyGroupsForSitio($emergRangeGroups, $sitio),
            'year' => aggregateConcernOrEmergencyGroupsForSitio($emergYearGroups, $sitio),
            'yearByMonth' => aggregateEmergencyYearByMonthForSitio($emergencyYearMonthLocBuckets, $sitio),
            'heatmapByMonth' => $sitioHeatmapByMonth,
            'currentMonthDaily' => $sitioHeatmapByMonth[$currentMonthKey] ?? buildEmergencyCurrentMonthDailyPayload([], $monthStart, $timezone, $sitio),
        ],
        'documents' => [
            'month' => aggregateDocumentGroupsForSitio($docRangeMaps, $sitio),
            'year' => aggregateDocumentGroupsForSitio($docYearMaps, $sitio),
            'yearByMonth' => aggregateDocumentMonthlyGroupsForSitio($docYearMonthAddrMaps, $sitio),
        ],
    ];
}

$concernsAiInterpretation = buildConcernsAiInterpretation(
    [
        'month' => $concernsRange,
        'year' => $concernsYear,
        'yearByMonth' => $concernsYearByMonth,
    ],
    $bySitio
);

$emergencyMonthLabelForAi = $rangeLabel ?: (new DateTime($rangeStart, $timezone))->format('F Y');
$emergencyAiInterpretation = buildEmergencyAiInterpretation(
    [
        'month' => $emergenciesRange,
        'year' => $emergenciesYear,
        'yearByMonth' => $emergenciesYearByMonth,
        'previous' => $emergenciesPrev,
        'delta' => $emergenciesDelta,
        'monthLabel' => $emergencyMonthLabelForAi,
        'yearLabel' => $now->format('Y'),
    ],
    $bySitio
);

$concernsRatingLineSeries = buildConcernRatingLineSeries($pdo, $rangeStart, $rangeEnd, $period, $timezone);

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
        'yearByMonth' => $concernsYearByMonth,
        'sentimentInsights' => [
            'month' => $concernsMonthSentimentInsight,
            'year' => $concernsYearSentimentInsight,
        ],
        'ratingLineSeries' => $concernsRatingLineSeries,
        'aiInterpretation' => $concernsAiInterpretation,
        'monthLabel' => $rangeLabel ?: (new DateTime($rangeStart, $timezone))->format('F Y'),
        'yearLabel' => $now->format('Y'),
        'previous' => $concernsPrev,
        'delta' => $concernsDelta
    ],
    'emergencies' => [
        'month' => $emergenciesRange,
        'year' => $emergenciesYear,
        'yearByMonth' => $emergenciesYearByMonth,
        'heatmapCalendarYear' => $heatmapCalendarYear,
        'heatmapByMonth' => $emergencyHeatmapByMonth,
        'currentMonthDaily' => $emergencyCurrentMonthDaily,
        'monthLabel' => $rangeLabel ?: (new DateTime($rangeStart, $timezone))->format('F Y'),
        'yearLabel' => $now->format('Y'),
        'previous' => $emergenciesPrev,
        'delta' => $emergenciesDelta,
        'aiInterpretation' => $emergencyAiInterpretation,
    ],
    'documents' => [
        'month' => $documentsRange,
        'year' => $documentsYear,
        'yearByMonth' => $documentsYearByMonth,
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
        WHERE LOWER(TRIM(COALESCE(purpose, ''))) = 'jobseeker'
        ORDER BY id DESC
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
$data['census'] = fetchCensusAnalytics($pdo);

echo json_encode(['success' => true, 'data' => $data]);

