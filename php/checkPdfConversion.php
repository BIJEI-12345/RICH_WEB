<?php
/**
 * Check if PDF conversion is available
 * Run this script to verify if LibreOffice or other PDF conversion tools are installed
 */

header('Content-Type: application/json');

require_once __DIR__ . '/convertDocxToPdf.php';

$results = [
    'libreoffice' => false,
    'libreoffice_path' => null,
    'com_available' => false,
    'pandoc_available' => false,
    'status' => 'not_available',
    'message' => ''
];

// Check LibreOffice
$libreOfficePaths = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files\\LibreOffice 7\\program\\soffice.exe',
    'C:\\Program Files\\LibreOffice 6\\program\\soffice.exe',
    '/usr/bin/libreoffice',
    '/usr/local/bin/libreoffice',
    'libreoffice',
    'soffice'
];

foreach ($libreOfficePaths as $path) {
    if (file_exists($path) || (PHP_OS_FAMILY === 'Windows' && file_exists($path))) {
        $results['libreoffice'] = true;
        $results['libreoffice_path'] = $path;
        $results['status'] = 'available';
        $results['message'] = 'LibreOffice found at: ' . $path;
        break;
    }
}

// Check if in PATH
if (!$results['libreoffice']) {
    $output = [];
    $returnVar = 0;
    if (PHP_OS_FAMILY === 'Windows') {
        exec('where soffice.exe 2>nul', $output, $returnVar);
        if ($returnVar === 0 && !empty($output[0])) {
            $results['libreoffice'] = true;
            $results['libreoffice_path'] = trim($output[0]);
            $results['status'] = 'available';
            $results['message'] = 'LibreOffice found in PATH: ' . $results['libreoffice_path'];
        }
    } else {
        exec('which libreoffice 2>/dev/null', $output, $returnVar);
        if ($returnVar === 0 && !empty($output[0])) {
            $results['libreoffice'] = true;
            $results['libreoffice_path'] = trim($output[0]);
            $results['status'] = 'available';
            $results['message'] = 'LibreOffice found in PATH: ' . $results['libreoffice_path'];
        }
    }
}

// Check COM (Windows only)
if (PHP_OS_FAMILY === 'Windows' && class_exists('COM')) {
    $results['com_available'] = true;
    if (!$results['libreoffice']) {
        $results['status'] = 'available';
        $results['message'] = 'COM object available (can use Microsoft Word for conversion)';
    }
}

// Check pandoc
$pandocPaths = ['pandoc', '/usr/bin/pandoc', '/usr/local/bin/pandoc'];
foreach ($pandocPaths as $pandocPath) {
    $output = [];
    $returnVar = 0;
    exec("$pandocPath --version 2>&1", $output, $returnVar);
    if ($returnVar === 0) {
        $results['pandoc_available'] = true;
        if (!$results['libreoffice'] && !$results['com_available']) {
            $results['status'] = 'available';
            $results['message'] = 'Pandoc found: ' . $pandocPath;
        }
        break;
    }
}

if ($results['status'] === 'not_available') {
    $results['message'] = 'No PDF conversion tool found. Please install LibreOffice from https://www.libreoffice.org/download/';
}

echo json_encode($results, JSON_PRETTY_PRINT);
