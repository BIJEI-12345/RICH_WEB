<?php
/**
 * Announcement `image` column: store binary in PostgreSQL BYTEA and expose it through admin-dashboard.php.
 */

function migrateAnnouncementImagePathsToBlob(PDO $pdo) {
    try {
        $stmt = $pdo->query('SELECT id, image FROM announcements WHERE image IS NOT NULL AND octet_length(image) > 0');
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        return;
    }
    $baseReal = @realpath(__DIR__ . '/..');
    foreach ($rows as $row) {
        $val = $row['image'] ?? null;
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
        $upd = $pdo->prepare("UPDATE announcements SET image = decode(?, 'base64') WHERE id = ?");
        $upd->execute([base64_encode($bin), $row['id']]);
    }
}

function ensureAnnouncementImageBlob(PDO $pdo) {
    $stmt = $pdo->prepare(
        "SELECT data_type FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'announcements' AND column_name = 'image'"
    );
    $stmt->execute();
    $dataType = $stmt->fetchColumn();

    if ($dataType === false) {
        $pdo->exec('ALTER TABLE announcements ADD COLUMN image BYTEA NULL');
        return;
    }

    if ($dataType !== 'bytea') {
        throw new RuntimeException('The announcements.image column must use PostgreSQL BYTEA.');
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
    if (is_resource($image)) {
        $image = stream_get_contents($image);
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
