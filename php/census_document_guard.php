<?php
/**
 * Census vs document requests: status Blocked on census_form means the resident
 * must not submit new document requests. Link rows with column account_email
 * (same as brgy_users / resident login email).
 */
declare(strict_types=1);

/**
 * @param mysqli $connection
 */
function census_ensure_account_email_column($connection): void
{
    if (!$connection) {
        return;
    }
    $r = @$connection->query("SHOW COLUMNS FROM census_form LIKE 'account_email'");
    if ($r && $r->num_rows === 0) {
        @$connection->query('ALTER TABLE census_form ADD COLUMN account_email VARCHAR(255) NULL DEFAULT NULL');
    }
}

/**
 * Returns census workflow status for this email, or null if no active row matches.
 *
 * @param mysqli $connection
 */
function rich_census_status_for_requester_email($connection, string $email): ?string
{
    $email = trim($email);
    if ($email === '' || !$connection) {
        return null;
    }

    $table = @$connection->query("SHOW TABLES LIKE 'census_form'");
    if (!$table || $table->num_rows === 0) {
        return null;
    }

    census_ensure_account_email_column($connection);

    $cols = [];
    $cr = @$connection->query('SHOW COLUMNS FROM census_form');
    if ($cr) {
        while ($row = $cr->fetch_assoc()) {
            $cols[strtolower((string) ($row['Field'] ?? ''))] = (string) ($row['Field'] ?? '');
        }
    }

    $wheres = [];
    $types = '';
    $params = [];

    if (!empty($cols['account_email'])) {
        $wheres[] = 'LOWER(TRIM(`account_email`)) = LOWER(?)';
        $types .= 's';
        $params[] = $email;
    }
    foreach (['email', 'resident_email', 'user_email'] as $alt) {
        if (!empty($cols[$alt])) {
            $colName = $cols[$alt];
            $wheres[] = 'LOWER(TRIM(`' . str_replace('`', '``', $colName) . '`)) = LOWER(?)';
            $types .= 's';
            $params[] = $email;
        }
    }

    if ($wheres === []) {
        return null;
    }

    $sql = 'SELECT `status` FROM census_form WHERE archived_at IS NULL AND (' . implode(' OR ', $wheres) . ') ORDER BY id DESC LIMIT 1';
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$row || !isset($row['status'])) {
        return null;
    }

    return trim((string) $row['status']) !== '' ? trim((string) $row['status']) : null;
}

/**
 * @param mysqli $connection
 */
function rich_census_email_is_blocked_for_documents($connection, string $email): bool
{
    $st = rich_census_status_for_requester_email($connection, $email);

    return $st !== null && strcasecmp($st, 'Blocked') === 0;
}

/**
 * Uses logged-in session email (user_id holds email in this project).
 *
 * @param mysqli $connection
 */
function rich_session_user_blocked_from_documents($connection): bool
{
    if (empty($_SESSION['logged_in']) || empty($_SESSION['user_id'])) {
        return false;
    }

    return rich_census_email_is_blocked_for_documents($connection, (string) $_SESSION['user_id']);
}
