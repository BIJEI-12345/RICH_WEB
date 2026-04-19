<?php
require_once __DIR__ . '/generated_document_temp.php';

$token = isset($_GET['t']) ? (string) $_GET['t'] : '';
if (!preg_match('/^[a-f0-9]{48}$/', $token)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Invalid request');
}

$metaDir = rich_temp_generated_dir() . DIRECTORY_SEPARATOR . '_tokens';
$metaFile = $metaDir . DIRECTORY_SEPARATOR . $token;
if (!is_file($metaFile)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Not found or expired');
}

$path = trim((string) file_get_contents($metaFile));
@unlink($metaFile);

if ($path === '' || !rich_path_is_under_generated_temp($path)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Invalid');
}

$real = realpath($path);
if ($real === false || !is_file($real)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Gone');
}

$mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
if (function_exists('mime_content_type')) {
    $m = @mime_content_type($real);
    if (is_string($m) && $m !== '') {
        $mime = $m;
    }
}
$bn = basename($real);
header('Content-Type: ' . $mime);
header('Content-Disposition: attachment; filename="' . str_replace(['"', "\r", "\n"], '', $bn) . '"');
header('Content-Length: ' . (string) filesize($real));
readfile($real);
@unlink($real);
exit;
