<?php
/**
 * Ordinance & Full Disclosure Policy Board — JSON API + image bytes (LONGBLOB).
 * policy_board: image uploads only; resident comment/rating stored in policy_board_feedback.
 */
require_once __DIR__ . '/init_session.php';
require_once __DIR__ . '/config.php';

error_reporting(0);
ini_set('display_errors', 0);

/** Max size for ordinance & policy board image uploads (10 MiB). */
if (!defined('OP_MAX_IMAGE_UPLOAD_BYTES')) {
    define('OP_MAX_IMAGE_UPLOAD_BYTES', 10 * 1024 * 1024);
}

function op_require_login_json(): void {
    rich_session_start();
    if (empty($_SESSION['logged_in'])) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => 'Authentication required']);
        exit;
    }
}

function op_ensure_tables(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `ordinance` (
            `id` INT NOT NULL AUTO_INCREMENT,
            `image` LONGBLOB NULL,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `policy_board` (
            `id` INT NOT NULL AUTO_INCREMENT,
            `image` LONGBLOB NULL,
            `comment` TEXT NULL,
            `rating` INT NULL,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `policy_board_feedback` (
            `id` INT NOT NULL AUTO_INCREMENT,
            `policy_board_id` INT NOT NULL,
            `comment` TEXT NOT NULL,
            `rating` INT NOT NULL,
            `submitted_by` VARCHAR(255) NOT NULL,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_policy_resident` (`policy_board_id`, `submitted_by`),
            CONSTRAINT `fk_policy_feedback_policy` FOREIGN KEY (`policy_board_id`) REFERENCES `policy_board` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}

function op_read_image_blob(string $tmp, array $file): ?string {
    if (!isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
        return null;
    }
    $allowed = ['image/jpeg' => true, 'image/png' => true, 'image/gif' => true, 'image/webp' => true];
    $mime = '';
    if (class_exists('finfo')) {
        $fi = new finfo(FILEINFO_MIME_TYPE);
        $mime = (string) $fi->file($tmp);
    } elseif (function_exists('mime_content_type')) {
        $mime = (string) mime_content_type($tmp);
    }
    if ($mime === '' || !isset($allowed[$mime])) {
        return null;
    }
    if (!empty($file['size']) && (int) $file['size'] > OP_MAX_IMAGE_UPLOAD_BYTES) {
        return null;
    }
    $blob = @file_get_contents($tmp);

    return ($blob !== false && $blob !== '') ? $blob : null;
}

function op_output_image_blob(?string $imageData): void {
    if ($imageData === null || $imageData === '') {
        http_response_code(404);
        echo 'Image not found';
        exit;
    }
    if (is_string($imageData) && strlen($imageData) > 100) {
        $mime = 'image/jpeg';
        if (class_exists('finfo')) {
            $fi = new finfo(FILEINFO_MIME_TYPE);
            $detected = $fi->buffer($imageData);
            if ($detected) {
                $mime = $detected;
            }
        }
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . strlen($imageData));
        echo $imageData;
        exit;
    }
    http_response_code(404);
    echo 'Invalid image data';
    exit;
}

try {
    $pdo = getPDODatabaseConnection();
} catch (Exception $e) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Database connection failed']);
    exit;
}

op_ensure_tables($pdo);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ---- Serve image (binary) ----
if ($method === 'GET' && isset($_GET['serve']) && $_GET['serve'] === 'image' && isset($_GET['type'], $_GET['id'])) {
    op_require_login_json();
    $type = strtolower(trim((string) $_GET['type']));
    $id = (int) ($_GET['id'] ?? 0);
    if ($id < 1 || !in_array($type, ['ordinance', 'policy'], true)) {
        http_response_code(400);
        echo 'Invalid request';
        exit;
    }
    if ($type === 'ordinance') {
        $stmt = $pdo->prepare('SELECT image FROM ordinance WHERE id = ?');
    } else {
        $stmt = $pdo->prepare('SELECT image FROM policy_board WHERE id = ?');
    }
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    op_output_image_blob($row['image'] ?? null);
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function op_image_url(string $type, int $id): string {
    return 'php/ordinance_policy.php?serve=image&type=' . rawurlencode($type) . '&id=' . $id;
}

function op_list_ordinance(PDO $pdo): array {
    $stmt = $pdo->query('SELECT id, created_at FROM ordinance ORDER BY created_at ASC, id ASC');
    $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
    foreach ($rows as &$r) {
        $rid = (int) ($r['id'] ?? 0);
        $r['image'] = op_image_url('ordinance', $rid);
    }
    unset($r);

    return $rows;
}

function op_feedback_rows_for_policy(PDO $pdo, int $policyId): array {
    $rows = [];
    try {
        // Preferred source if project already uses comment_policy.
        $cols = [];
        try {
            $meta = $pdo->query('SHOW COLUMNS FROM comment_policy');
            $metaRows = $meta ? $meta->fetchAll(PDO::FETCH_ASSOC) : [];
            foreach ($metaRows as $mr) {
                $c = strtolower((string) ($mr['Field'] ?? ''));
                if ($c !== '') {
                    $cols[$c] = true;
                }
            }
        } catch (Throwable $eMeta) {
            $cols = [];
        }

        $fkCandidates = ['policy_board_id', 'policy_id', 'board_id', 'image_id', 'policy_image_id', 'policyboard_id'];
        $nameCandidates = ['name', 'full_name', 'resident_name', 'author_name', 'username', 'submitted_by'];
        $createdCandidates = ['created_at', 'createdon', 'created_date', 'date_created', 'timestamp'];

        $fkCol = '';
        foreach ($fkCandidates as $cand) {
            if (isset($cols[$cand])) {
                $fkCol = $cand;
                break;
            }
        }
        $nameCol = '';
        foreach ($nameCandidates as $cand) {
            if (isset($cols[$cand])) {
                $nameCol = $cand;
                break;
            }
        }
        $createdCol = '';
        foreach ($createdCandidates as $cand) {
            if (isset($cols[$cand])) {
                $createdCol = $cand;
                break;
            }
        }

        if ($fkCol !== '' && isset($cols['comment'])) {
            $selectName = $nameCol !== '' ? $nameCol : "''";
            $selectCreated = $createdCol !== '' ? $createdCol : 'NULL';
            $sql = "SELECT id, {$selectName} AS name, comment, {$selectCreated} AS created_at
                    FROM comment_policy
                    WHERE {$fkCol} = ?
                    ORDER BY id DESC";
            if ($createdCol !== '') {
                $sql = "SELECT id, {$selectName} AS name, comment, {$selectCreated} AS created_at
                        FROM comment_policy
                        WHERE {$fkCol} = ?
                        ORDER BY {$createdCol} DESC, id DESC";
            }
            $st = $pdo->prepare($sql);
            $st->execute([$policyId]);
            $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        }
    } catch (Throwable $e) {
        try {
            // Fallback to current feedback table and resolve name from user profile.
            $st = $pdo->prepare(
                'SELECT f.id, COALESCE(NULLIF(u.name, \'\'), f.submitted_by) AS name, f.comment, f.created_at
                 FROM policy_board_feedback f
                 LEFT JOIN brgy_users u ON u.email = f.submitted_by
                 WHERE f.policy_board_id = ?
                 ORDER BY f.created_at DESC, f.id DESC'
            );
            $st->execute([$policyId]);
            $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e2) {
            try {
                // Last fallback for old schema: no submitted_by join available.
                $st = $pdo->prepare(
                    'SELECT id, comment, created_at FROM policy_board_feedback WHERE policy_board_id = ? ORDER BY created_at DESC, id DESC'
                );
                $st->execute([$policyId]);
                $rows = $st->fetchAll(PDO::FETCH_ASSOC);
            } catch (Throwable $e3) {
                // Never break the whole page when feedback schema is different.
                return [];
            }
        }
    }
    if (!$rows) {
        try {
            $st = $pdo->prepare(
                'SELECT f.id, COALESCE(NULLIF(u.name, \'\'), f.submitted_by) AS name, f.comment, f.created_at
                 FROM policy_board_feedback f
                 LEFT JOIN brgy_users u ON u.email = f.submitted_by
                 WHERE f.policy_board_id = ?
                 ORDER BY f.created_at DESC, f.id DESC'
            );
            $st->execute([$policyId]);
            $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e4) {
            try {
                $st = $pdo->prepare(
                    'SELECT id, comment, created_at FROM policy_board_feedback WHERE policy_board_id = ? ORDER BY created_at DESC, id DESC'
                );
                $st->execute([$policyId]);
                $rows = $st->fetchAll(PDO::FETCH_ASSOC);
            } catch (Throwable $e5) {
                $rows = [];
            }
        }
    }
    foreach ($rows as &$row) {
        $row['name'] = trim((string) ($row['name'] ?? ''));
        $row['comment'] = (string) ($row['comment'] ?? '');
    }
    unset($row);

    return $rows;
}

function op_list_policy(PDO $pdo): array {
    $stmt = $pdo->query('SELECT id, created_at FROM policy_board ORDER BY created_at ASC, id ASC');
    $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
    foreach ($rows as &$r) {
        $rid = (int) ($r['id'] ?? 0);
        $r['image'] = op_image_url('policy', $rid);
        $r['feedbacks'] = op_feedback_rows_for_policy($pdo, $rid);
    }
    unset($r);

    return $rows;
}

// ---- GET list ----
if ($method === 'GET' && isset($_GET['list'])) {
    op_require_login_json();
    $list = strtolower(trim((string) $_GET['list']));
    try {
        if ($list === 'ordinance') {
            echo json_encode(['ok' => true, 'items' => op_list_ordinance($pdo)]);
        } elseif ($list === 'policy') {
            echo json_encode(['ok' => true, 'items' => op_list_policy($pdo)]);
        } else {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Invalid list parameter']);
        }
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Query failed']);
    }
    exit;
}

// ---- POST: resident feedback (JSON) ----
if ($method === 'POST') {
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($ct, 'application/json') !== false) {
        op_require_login_json();
        $raw = file_get_contents('php://input');
        $j = json_decode($raw, true);
        if (!is_array($j) || ($j['action'] ?? '') !== 'policy_feedback') {
            http_response_code(400);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['ok' => false, 'error' => 'Invalid JSON action']);
            exit;
        }
        $pid = (int) ($j['policy_board_id'] ?? 0);
        $comment = trim((string) ($j['comment'] ?? ''));
        $rating = (int) ($j['rating'] ?? 0);
        if ($pid < 1) {
            http_response_code(400);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['ok' => false, 'error' => 'Invalid policy image id']);
            exit;
        }
        if ($comment === '') {
            http_response_code(400);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['ok' => false, 'error' => 'Comment is required']);
            exit;
        }
        if ($rating < 1 || $rating > 5) {
            http_response_code(400);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['ok' => false, 'error' => 'Rating must be 1–5']);
            exit;
        }
        $by = trim((string) ($_SESSION['user_id'] ?? ''));
        if ($by === '') {
            http_response_code(400);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['ok' => false, 'error' => 'Session user id missing']);
            exit;
        }
        try {
            $chk = $pdo->prepare('SELECT id FROM policy_board WHERE id = ?');
            $chk->execute([$pid]);
            if (!$chk->fetchColumn()) {
                http_response_code(404);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['ok' => false, 'error' => 'Policy image not found']);
                exit;
            }
            $sql = 'INSERT INTO policy_board_feedback (policy_board_id, comment, rating, submitted_by) VALUES (?,?,?,?)
                ON DUPLICATE KEY UPDATE comment = VALUES(comment), rating = VALUES(rating), created_at = CURRENT_TIMESTAMP';
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$pid, $comment, $rating, $by]);
            $fbRows = op_feedback_rows_for_policy($pdo, $pid);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['ok' => true, 'message' => 'Feedback saved.', 'feedbacks' => $fbRows]);
        } catch (Throwable $e) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['ok' => false, 'error' => 'Save failed']);
        }
        exit;
    }

    op_require_login_json();
    $type = strtolower(trim((string) ($_POST['type'] ?? '')));
    if (!in_array($type, ['ordinance', 'policy'], true)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid type']);
        exit;
    }
    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Image file is required']);
        exit;
    }
    $blob = op_read_image_blob($_FILES['image']['tmp_name'], $_FILES['image']);
    if ($blob === null) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid image (JPG, PNG, GIF, WebP, max 10MB)']);
        exit;
    }
    try {
        if ($type === 'ordinance') {
            $stmt = $pdo->prepare('INSERT INTO ordinance (image) VALUES (?)');
            $stmt->execute([$blob]);
            $newId = (int) $pdo->lastInsertId();
            echo json_encode([
                'ok' => true,
                'message' => 'Barangay Ordinance saved.',
                'id' => $newId,
                'item' => [
                    'id' => $newId,
                    'created_at' => date('Y-m-d H:i:s'),
                    'image' => op_image_url('ordinance', $newId),
                ],
            ]);
        } else {
            $stmt = $pdo->prepare('INSERT INTO policy_board (image) VALUES (?)');
            $stmt->execute([$blob]);
            $newId = (int) $pdo->lastInsertId();
            echo json_encode([
                'ok' => true,
                'message' => 'Full Disclosure Policy Board image saved.',
                'id' => $newId,
                'item' => [
                    'id' => $newId,
                    'created_at' => date('Y-m-d H:i:s'),
                    'image' => op_image_url('policy', $newId),
                    'feedbacks' => [],
                ],
            ]);
        }
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Save failed']);
    }
    exit;
}

// ---- DELETE ----
if ($method === 'DELETE') {
    op_require_login_json();
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);
    if (!is_array($input)) {
        $input = [];
    }
    $type = strtolower(trim((string) ($input['type'] ?? '')));
    $id = (int) ($input['id'] ?? 0);
    if (!in_array($type, ['ordinance', 'policy'], true) || $id < 1) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid type or id']);
        exit;
    }
    try {
        if ($type === 'ordinance') {
            $stmt = $pdo->prepare('DELETE FROM ordinance WHERE id = ?');
        } else {
            $stmt = $pdo->prepare('DELETE FROM policy_board WHERE id = ?');
        }
        $stmt->execute([$id]);
        echo json_encode(['ok' => true, 'message' => 'Deleted']);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Delete failed']);
    }
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Invalid request']);