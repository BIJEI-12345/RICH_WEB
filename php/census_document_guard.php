<?php
/**
 * Census vs document requests: status Blocked on census_form means the resident
 * must not submit new document requests. Link rows with column account_email
 * (same as brgy_users / resident login email).
 */
declare(strict_types=1);

/**
 * @param PDO $connection
 */
function census_ensure_account_email_column($connection): void
{
    $exists = $connection->query("SELECT to_regclass('public.census_form')")->fetchColumn();
    if ($exists === null) {
        return;
    }

    $stmt = $connection->prepare(
        "SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'census_form' AND column_name = 'account_email'"
    );
    $stmt->execute();
    if (!$stmt->fetchColumn()) {
        $connection->exec('ALTER TABLE census_form ADD COLUMN account_email VARCHAR(255) NULL');
    }
}

/**
 * Returns census workflow status for this email, or null if no active row matches.
 *
 * @param PDO $connection
 */
function rich_census_status_for_requester_email($connection, string $email): ?string
{
    $email = trim($email);
    if ($email === '') {
        return null;
    }

    if (!$connection->query("SELECT to_regclass('public.census_form')")->fetchColumn()) {
        return null;
    }

    census_ensure_account_email_column($connection);

    $columnStmt = $connection->prepare(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'census_form'"
    );
    $columnStmt->execute();
    $columns = $columnStmt->fetchAll(PDO::FETCH_COLUMN);
    $cols = array_fill_keys($columns, true);

    $wheres = [];
    $params = [];

    if (isset($cols['account_email'])) {
        $wheres[] = 'LOWER(TRIM("account_email")) = LOWER(?)';
        $params[] = $email;
    }
    foreach (['email', 'resident_email', 'user_email'] as $alt) {
        if (isset($cols[$alt])) {
            $wheres[] = 'LOWER(TRIM("' . $alt . '")) = LOWER(?)';
            $params[] = $email;
        }
    }

    if ($wheres === []) {
        return null;
    }

    $archivedColumn = isset($cols['archived_at']) ? 'archived_at IS NULL AND ' : '';
    $sql = 'SELECT status FROM census_form WHERE ' . $archivedColumn . '(' . implode(' OR ', $wheres) . ') ORDER BY id DESC LIMIT 1';
    $stmt = $connection->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || !isset($row['status'])) {
        return null;
    }

    return trim((string) $row['status']) !== '' ? trim((string) $row['status']) : null;
}

/**
 * @param PDO $connection
 */
function rich_census_email_is_blocked_for_documents($connection, string $email): bool
{
    $st = rich_census_status_for_requester_email($connection, $email);

    return $st !== null && strcasecmp($st, 'Blocked') === 0;
}

/**
 * Uses logged-in session email (user_id holds email in this project).
 *
 * @param PDO $connection
 */
function rich_session_user_blocked_from_documents($connection): bool
{
    if (empty($_SESSION['logged_in']) || empty($_SESSION['user_id'])) {
        return false;
    }

    return rich_census_email_is_blocked_for_documents($connection, (string) $_SESSION['user_id']);
}
