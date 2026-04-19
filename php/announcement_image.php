<?php
/**
 * Announcement `image` column: store binary in LONGBLOB, expose URL via admin-dashboard.php?announcement_image=true&id=
 */

function migrateAnnouncementImagePathsToBlob(PDO $pdo) {
    try {
        $stmt = $pdo->query('SELECT id, image FROM announcements WHERE image IS NOT NULL AND LENGTH(image) > 0');
        if (!$stmt) {
            return;
        }
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        return;
    }
    $baseReal = @realpath(__DIR__ . '/..');
    foreach ($rows as $row) {
        $val = $row['image'];
        if (!is_string($val) || $val === '') {
            continue;
        }
        if (strlen($val) > 512) {
            continue;
        }
        if (strpos($val, 'uploads/') === false && strpos($val, 'uploads\\') === false) {
            continue;
        }
        if (preg_match('/[^\x09\x0A\x0D\x20-\x7E]/', substr($val, 0, min(200, strlen($val))))) {
            continue;
        }
        $norm = str_replace('\\', '/', $val);
        $full = @realpath(__DIR__ . '/../' . ltrim($norm, '/'));
        if (!$full || !$baseReal || strpos($full, $baseReal) !== 0 || !is_file($full)) {
            continue;
        }
        $bin = @file_get_contents($full);
        if ($bin === false || $bin === '') {
            continue;
        }
        $upd = $pdo->prepare('UPDATE announcements SET image = ? WHERE id = ?');
        if ($upd->execute([$bin, $row['id']])) {
            @unlink($full);
        }
    }
}

function ensureAnnouncementImageBlob(PDO $pdo) {
    try {
        $st = $pdo->query("SHOW COLUMNS FROM announcements LIKE 'image'");
        $col = $st ? $st->fetch(PDO::FETCH_ASSOC) : false;
    } catch (Throwable $e) {
        return;
    }
    if (!$col) {
        try {
            $pdo->exec('ALTER TABLE announcements ADD COLUMN image LONGBLOB NULL');
        } catch (Throwable $e) {
        }
        return;
    }
    $type = strtolower((string)($col['Type'] ?? ''));
    if (strpos($type, 'varchar') !== false || strpos($type, 'char') !== false || strpos($type, 'text') !== false) {
        try {
            $rows = $pdo->query('SELECT id, image FROM announcements WHERE image IS NOT NULL AND image != \'\'')->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {
            $rows = [];
        }
        $baseReal = @realpath(__DIR__ . '/..');
        foreach ($rows as $row) {
            $val = $row['image'];
            if (!is_string($val) || $val === '' || strlen($val) >= 600) {
                continue;
            }
            if (strpos($val, 'uploads/') === false && strpos($val, 'uploads\\') === false) {
                continue;
            }
            $norm = str_replace('\\', '/', $val);
            $full = @realpath(__DIR__ . '/../' . ltrim($norm, '/'));
            if ($full && $baseReal && strpos($full, $baseReal) === 0 && is_file($full)) {
                $bin = @file_get_contents($full);
                if ($bin !== false && $bin !== '') {
                    $upd = $pdo->prepare('UPDATE announcements SET image = ? WHERE id = ?');
                    if ($upd->execute([$bin, $row['id']])) {
                        @unlink($full);
                    }
                }
            }
        }
        try {
            $pdo->exec('ALTER TABLE announcements MODIFY COLUMN image LONGBLOB NULL');
        } catch (Throwable $e) {
        }
    }
    migrateAnnouncementImagePathsToBlob($pdo);
}

/**
 * @param mixed $image Raw DB value
 * @param int|string $announcementId
 */
function normalizeAnnouncementImageForJson($image, $announcementId) {
    if ($image === null || $image === '') {
        return '';
    }
    if (!is_string($image)) {
        return '';
    }
    if (strlen($image) < 512
        && (strpos($image, 'uploads/') !== false || strpos($image, 'uploads\\') !== false)
        && !preg_match('/[^\x09\x0A\x0D\x20-\x7E]/', substr($image, 0, min(200, strlen($image))))) {
        return 'php/admin-dashboard.php?announcement_image=true&id=' . (int) $announcementId;
    }
    if (strlen($image) > 100) {
        return 'php/admin-dashboard.php?announcement_image=true&id=' . (int)$announcementId;
    }
    return '';
}
