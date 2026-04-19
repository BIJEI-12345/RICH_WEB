<?php
/**
 * Permanent retention cleanup for finished document requests.
 *
 * Rule:
 * - Jobseeker (certification only): is_permanent = 1 → never deleted.
 * - Everything else: all other certification purposes + Barangay ID, COE, Clearance, Indigency
 *   → deleted after interval (Finished, finish_at older than 1 year + 1 week).
 *
 * is_permanent exists only on certification_forms; other tables have no permanent rows.
 *
 * Run manually or via cron (e.g. monthly):
 *   php cleanup_certification_retention.php
 */
date_default_timezone_set('Asia/Manila');

require_once __DIR__ . '/config.php';

try {
    $pdo = getPDODatabaseConnection();
} catch (Exception $e) {
    error_log('cleanup_document_retention: DB error: ' . $e->getMessage());
    fwrite(STDERR, "Database connection failed.\n");
    exit(1);
}

// Finished rows older than this are eligible for deletion (except jobseeker certifications).
$cutoffExpr = 'DATE_SUB(DATE_SUB(NOW(), INTERVAL 1 YEAR), INTERVAL 1 WEEK)';

// --- certification_forms: sync is_permanent from purpose (jobseeker = 1) ---
try {
    $synced = $pdo->exec(
        "UPDATE certification_forms SET is_permanent = IF(LOWER(TRIM(COALESCE(purpose,''))) = 'jobseeker', 1, 0)"
    );
    echo "certification_forms: synced is_permanent from purpose (" . (int) $synced . " row(s) affected).\n";
} catch (Exception $e) {
    error_log('cleanup_document_retention: sync is_permanent failed: ' . $e->getMessage());
    fwrite(STDERR, "Warning: could not sync is_permanent: " . $e->getMessage() . "\n");
}

$finishedCond = "UPPER(TRIM(status)) = 'FINISHED' AND finish_at IS NOT NULL AND finish_at < $cutoffExpr";

$deleteSpecs = [
    [
        'table' => 'certification_forms',
        // is_permanent = 1 (jobseeker) → never deleted; = 0 → eligible. Extra: never delete jobseeker by purpose.
        'sql'   => "
            DELETE FROM certification_forms
            WHERE IFNULL(is_permanent, 0) = 0
              AND LOWER(TRIM(COALESCE(purpose,''))) <> 'jobseeker'
              AND $finishedCond
        ",
    ],
    [
        'table' => 'barangay_id_forms',
        'sql'   => "DELETE FROM barangay_id_forms WHERE $finishedCond",
    ],
    [
        'table' => 'coe_forms',
        'sql'   => "DELETE FROM coe_forms WHERE $finishedCond",
    ],
    [
        'table' => 'clearance_forms',
        'sql'   => "DELETE FROM clearance_forms WHERE $finishedCond",
    ],
    [
        'table' => 'indigency_forms',
        'sql'   => "DELETE FROM indigency_forms WHERE $finishedCond",
    ],
];

$total = 0;
foreach ($deleteSpecs as $spec) {
    $name = $spec['table'];
    try {
        $n = $pdo->exec($spec['sql']);
        $n = (int) $n;
        $total += $n;
        echo "$name: deleted $n row(s) (Finished, older than 1 year + 1 week).\n";
    } catch (Exception $e) {
        error_log("cleanup_document_retention: DELETE failed for $name: " . $e->getMessage());
        fwrite(STDERR, "Delete failed ($name): " . $e->getMessage() . "\n");
        exit(1);
    }
}

echo "Total deleted: $total. Done.\n";
