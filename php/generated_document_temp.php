<?php
/**
 * Generated DOCX: written under the system temp dir, served once via temp_document_download.php
 * (not stored under project uploads/).
 */

function rich_temp_generated_dir(): string {
    $dir = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'rich_generated';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    return $dir;
}

function rich_temp_docx_path(string $basename): string {
    $base = preg_replace('/[^a-zA-Z0-9._-]/', '_', $basename);
    if ($base === '' || strcasecmp(substr($base, -5), '.docx') !== 0) {
        $base = 'doc_' . date('Ymd_His') . '.docx';
    }
    return rich_temp_generated_dir() . DIRECTORY_SEPARATOR . uniqid('g_', true) . '_' . $base;
}

function rich_path_is_under_generated_temp(string $path): bool {
    $real = @realpath($path);
    if ($real === false || !is_file($real)) {
        return false;
    }
    $base = @realpath(rich_temp_generated_dir());
    if ($base === false) {
        return false;
    }
    return strpos($real, $base) === 0;
}

/**
 * @throws InvalidArgumentException|RuntimeException
 */
function rich_register_temp_download(string $absPath): string {
    if (!rich_path_is_under_generated_temp($absPath)) {
        throw new InvalidArgumentException('Invalid download path');
    }
    $token = bin2hex(random_bytes(24));
    $metaDir = rich_temp_generated_dir() . DIRECTORY_SEPARATOR . '_tokens';
    if (!is_dir($metaDir)) {
        @mkdir($metaDir, 0700, true);
    }
    $metaFile = $metaDir . DIRECTORY_SEPARATOR . $token;
    if (file_put_contents($metaFile, $absPath) === false) {
        throw new RuntimeException('Could not register download');
    }
    return $token;
}

function rich_temp_download_public_url(string $token): string {
    return 'php/temp_document_download.php?t=' . rawurlencode($token);
}
