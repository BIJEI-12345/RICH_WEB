<?php
/**
 * Shared helpers para sa emergency heat map (araw-araw na buckets) — ginagamit ng analytics.php at emergency_heatmap_interpretation.php.
 */

/**
 * Bahagi ng location bago ang unang dash (ASCII hyphen, en dash, em dash) — lowercase, trimmed.
 */
function analyticsLocationLeftKey(string $raw): string
{
    $v = strtolower(trim($raw));
    if ($v === '') {
        return '';
    }
    $parts = preg_split('/\s*[\x{002D}\x{2013}\x{2014}]+\s*/u', $v, 2);
    return trim($parts[0] ?? '');
}

/**
 * Concerns at emergency reports: tugma ang kaliwang bahagi ng location (bago ang dash) sa sitio.
 */
function analyticsLocationMatchesSitio(string $dbKey, string $sitio): bool
{
    $a = analyticsLocationLeftKey($dbKey);
    $b = analyticsLocationLeftKey($sitio);
    if ($a === '' || $b === '') {
        return false;
    }
    return $a === $b;
}

/**
 * Araw ng buwan (1–31) => location key => bilang ng emergency reports (lahat ng row sa araw na iyon).
 *
 * @return array<int, array<string, int>>
 */
function fetchEmergencyDailyDayKeyBuckets(PDO $pdo, string $start, string $end): array
{
    $stmt = $pdo->prepare("
        SELECT DAY(date_and_time) AS d,
               LOWER(TRIM(COALESCE(location, ''))) AS k,
               COUNT(*) AS c
        FROM emergency_reports
        WHERE date_and_time BETWEEN :s AND :e
        GROUP BY DAY(date_and_time), k
    ");
    $stmt->execute([':s' => $start, ':e' => $end]);
    $out = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $d = (int)($row['d'] ?? 0);
        if ($d < 1 || $d > 31) {
            continue;
        }
        $k = (string)($row['k'] ?? '');
        if (!isset($out[$d])) {
            $out[$d] = [];
        }
        $out[$d][$k] = (int)($row['c'] ?? 0);
    }
    return $out;
}

/**
 * Heat map: isang kalendaryong buwan — reported lang bawat araw; optional isang sitio.
 *
 * @param array<int, array<string, int>> $bucketsByDay
 * @return array{
 *   daysInMonth: int,
 *   year: int,
 *   month: int,
 *   monthLabel: string,
 *   counts: int[],
 *   peakDay: int|null,
 *   peakCount: int,
 *   peakDateLabel: string
 * }
 */
function buildEmergencyCurrentMonthDailyPayload(array $bucketsByDay, string $monthStart, DateTimeZone $timezone, ?string $sitioOnly): array
{
    $startDt = new DateTime($monthStart, $timezone);
    $dim = (int)$startDt->format('t');
    $y = (int)$startDt->format('Y');
    $m = (int)$startDt->format('n');
    $counts = array_fill(0, $dim, 0);
    for ($day = 1; $day <= $dim; $day++) {
        $map = $bucketsByDay[$day] ?? [];
        foreach ($map as $k => $c) {
            $n = (int)$c;
            if ($sitioOnly === null || $sitioOnly === '') {
                $counts[$day - 1] += $n;
            } elseif (analyticsLocationMatchesSitio((string)$k, $sitioOnly)) {
                $counts[$day - 1] += $n;
            }
        }
    }
    $peakIdx = -1;
    $peakCount = 0;
    for ($i = 0; $i < $dim; $i++) {
        if ($counts[$i] > $peakCount) {
            $peakCount = $counts[$i];
            $peakIdx = $i;
        }
    }
    $peakDay = $peakCount > 0 ? $peakIdx + 1 : null;
    $peakDateLabel = '';
    if ($peakDay !== null) {
        $pd = clone $startDt;
        $pd->setDate($y, $m, $peakDay);
        $peakDateLabel = $pd->format('M j, Y');
    }
    return [
        'daysInMonth' => $dim,
        'year' => $y,
        'month' => $m,
        'monthLabel' => $startDt->format('F Y'),
        'counts' => $counts,
        'peakDay' => $peakDay,
        'peakCount' => $peakCount,
        'peakDateLabel' => $peakDateLabel,
    ];
}
