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

/**
 * @param mysqli $conn
 * @return int
 */
function rich_count_pending_documents($conn, $since) {
    $tables = [
        'barangay_id_forms',
        'certification_forms',
        'coe_forms',
        'clearance_forms',
        'indigency_forms',
    ];
    $total = 0;
    foreach ($tables as $t) {
        $chk = $conn->query("SHOW TABLES LIKE '" . $conn->real_escape_string($t) . "'");
        if (!$chk || $chk->num_rows === 0) {
            continue;
        }
        $colSubmitted = $conn->query("SHOW COLUMNS FROM `$t` LIKE 'submitted_at'");
        if (!$colSubmitted || $colSubmitted->num_rows === 0) {
            continue;
        }
        $colStatus = $conn->query("SHOW COLUMNS FROM `$t` LIKE 'status'");
        if (!$colStatus || $colStatus->num_rows === 0) {
            continue;
        }
        // Notifications: "New" requests only (exclude Processing / Finished)
        $sql = "SELECT COUNT(*) AS c FROM `$t` WHERE LOWER(TRIM(COALESCE(status, ''))) = 'new' AND submitted_at > ?";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            continue;
        }
        $stmt->bind_param('s', $since);
        if (!$stmt->execute()) {
            $stmt->close();
            continue;
        }
        $res = $stmt->get_result();
        if ($res) {
            $row = $res->fetch_assoc();
            $total += (int) ($row['c'] ?? 0);
        }
        $stmt->close();
    }
    return $total;
}

/**
 * @param mysqli $conn
 * @return int
 */
function rich_count_pending_concerns($conn, $since) {
    $chk = $conn->query("SHOW TABLES LIKE 'concerns'");
    if (!$chk || $chk->num_rows === 0) {
        return 0;
    }
    $sql = "SELECT COUNT(*) AS c FROM concerns WHERE status IN ('new', 'processing') AND date_and_time > ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param('s', $since);
    if (!$stmt->execute()) {
        $stmt->close();
        return 0;
    }
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return (int) ($row['c'] ?? 0);
}

/**
 * @param mysqli $conn
 * @return int
 */
function rich_count_pending_emergency($conn, $since) {
    $chk = $conn->query("SHOW TABLES LIKE 'emergency_reports'");
    if (!$chk || $chk->num_rows === 0) {
        return 0;
    }
    // New emergency reports only (not processing / resolved)
    $sql = "SELECT COUNT(*) AS c FROM emergency_reports WHERE UPPER(TRIM(COALESCE(status, ''))) = 'NEW' AND date_and_time > ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param('s', $since);
    if (!$stmt->execute()) {
        $stmt->close();
        return 0;
    }
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return (int) ($row['c'] ?? 0);
}

/**
 * @param mysqli $conn
 * @return int
 */
function rich_count_pending_users($conn, $since) {
    $sql = "SELECT COUNT(*) AS c FROM brgy_users 
            WHERE verified_email = 1 AND (action = 'pending' OR action IS NULL OR action = '')
            AND created_at > ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param('s', $since);
    if (!$stmt->execute()) {
        $stmt->close();
        return 0;
    }
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return (int) ($row['c'] ?? 0);
}

try {
    $connection = getDatabaseConnection();
} catch (Exception $e) {
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
        $connection->close();
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
        $connection->close();
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
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch notifications: ' . $e->getMessage(),
    ]);
} finally {
    if (isset($connection) && $connection) {
        $connection->close();
    }
}
