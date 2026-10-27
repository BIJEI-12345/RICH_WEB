<?php
require_once __DIR__ . '/init_session.php';
error_reporting(0);
ini_set('display_errors', 0);

rich_session_start();

date_default_timezone_set('Asia/Manila');

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/notification_access.php';

function rich_postgres_table_exists(PDO $connection, string $table): bool
{
    $stmt = $connection->prepare(
        'SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = current_schema() AND table_name = ?
        )'
    );
    $stmt->execute([$table]);
    return (bool) $stmt->fetchColumn();
}

function rich_postgres_column_exists(PDO $connection, string $table, string $column): bool
{
    $stmt = $connection->prepare(
        'SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?
        )'
    );
    $stmt->execute([$table, $column]);
    return (bool) $stmt->fetchColumn();
}

function rich_count_pending_documents(PDO $connection, string $since): int
{
    $tables = [
        'barangay_id_forms',
        'certification_forms',
        'coe_forms',
        'clearance_forms',
        'indigency_forms',
    ];
    $total = 0;
    foreach ($tables as $t) {
        if (!rich_postgres_table_exists($connection, $t)
            || !rich_postgres_column_exists($connection, $t, 'submitted_at')
            || !rich_postgres_column_exists($connection, $t, 'status')) {
            continue;
        }
        $stmt = $connection->prepare(
            "SELECT COUNT(*) FROM \"$t\"
             WHERE LOWER(TRIM(COALESCE(status, ''))) = 'new' AND submitted_at > ?"
        );
        $stmt->execute([$since]);
        $total += (int) $stmt->fetchColumn();
    }
    return $total;
}

function rich_count_pending_concerns(PDO $connection, string $since): int
{
    if (!rich_postgres_table_exists($connection, 'concerns')) {
        return 0;
    }
    $stmt = $connection->prepare(
        "SELECT COUNT(*) FROM concerns WHERE status IN ('new', 'processing') AND date_and_time > ?"
    );
    $stmt->execute([$since]);
    return (int) $stmt->fetchColumn();
}

function rich_count_pending_emergency(PDO $connection, string $since): int
{
    if (!rich_postgres_table_exists($connection, 'emergency_reports')) {
        return 0;
    }
    $stmt = $connection->prepare(
        "SELECT COUNT(*) FROM emergency_reports
         WHERE UPPER(TRIM(COALESCE(status, ''))) = 'NEW' AND date_and_time > ?"
    );
    $stmt->execute([$since]);
    return (int) $stmt->fetchColumn();
}

function rich_count_pending_users(PDO $connection, string $since): int
{
    $stmt = $connection->prepare(
        "SELECT COUNT(*) FROM brgy_users
         WHERE verified_email = 1 AND (action = 'pending' OR action IS NULL OR action = '')
         AND created_at > ?"
    );
    $stmt->execute([$since]);
    return (int) $stmt->fetchColumn();
}

try {
    $connection = getPostgreSQLDatabaseConnection();
} catch (Throwable $e) {
    error_log("Database connection error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed.']);
    exit;
}

try {
    if (!isset($_SESSION['logged_in']) || !$_SESSION['logged_in']) {
        echo json_encode([
            'success' => true,
            'counts' => [],
            'total_unread' => 0,
            'accessible_categories' => [],
        ]);
        exit;
    }

    $position = $_SESSION['position'] ?? '';
    $accessible = rich_notification_categories_for_position($position);

    if ($accessible === []) {
        echo json_encode([
            'success' => true,
            'counts' => [],
            'total_unread' => 0,
            'accessible_categories' => [],
        ]);
        exit;
    }

    if (!isset($_SESSION['notif_seen']) || !is_array($_SESSION['notif_seen'])) {
        $_SESSION['notif_seen'] = [];
    }
    $seen = $_SESSION['notif_seen'];
    $epoch = '1970-01-01 00:00:00';
    $sinceDocu = $seen['docu'] ?? $epoch;
    $sinceConcerns = $seen['concerns'] ?? $epoch;
    $sinceEmergency = $seen['emergency'] ?? $epoch;
    $sinceUser = $seen['user_mgmt'] ?? $epoch;

    $counts = [];
    foreach ($accessible as $cat) {
        switch ($cat) {
            case 'docu':
                $counts['docu'] = rich_count_pending_documents($connection, $sinceDocu);
                break;
            case 'concerns':
                $counts['concerns'] = rich_count_pending_concerns($connection, $sinceConcerns);
                break;
            case 'emergency':
                $counts['emergency'] = rich_count_pending_emergency($connection, $sinceEmergency);
                break;
            case 'user_mgmt':
                $counts['user_mgmt'] = rich_count_pending_users($connection, $sinceUser);
                break;
            default:
                break;
        }
    }

    $total = 0;
    foreach ($counts as $v) {
        $total += (int) $v;
    }

    echo json_encode([
        'success' => true,
        'counts' => $counts,
        'total_unread' => $total,
        'accessible_categories' => $accessible,
    ]);
} catch (Throwable $e) {
    error_log("Notification query error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch notifications.',
    ]);
} finally {
    $connection = null;
}
