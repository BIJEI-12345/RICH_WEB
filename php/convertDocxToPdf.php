<?php
/**
 * Convert DOCX file to PDF
 * Uses LibreOffice command-line tool if available, otherwise returns false
 * 
 * @param string $docxPath Path to the DOCX file
 * @param string $pdfPath Path where PDF should be saved (optional, defaults to same location with .pdf extension)
 * @return string|false Path to PDF file on success, false on failure
 */
function convertDocxToPdf($docxPath, $pdfPath = null) {
    if (!file_exists($docxPath)) {
        error_log("convertDocxToPdf: DOCX file not found: $docxPath");
        return false;
    }
    
    // If no PDF path specified, use same location with .pdf extension
    if ($pdfPath === null) {
        $pdfPath = preg_replace('/\.docx$/i', '.pdf', $docxPath);
    }
    
    // Try LibreOffice (works on Windows, Linux, Mac)
    $libreOfficePaths = [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
        '/usr/bin/libreoffice',
        '/usr/local/bin/libreoffice',
        'libreoffice', // If in PATH
        'soffice' // Alternative command name
    ];
    
    $libreOfficeCmd = null;
    foreach ($libreOfficePaths as $path) {
        if (is_executable($path) || (PHP_OS_FAMILY === 'Windows' && file_exists($path))) {
            $libreOfficeCmd = $path;
            break;
        }
    }
    
    // Also try checking if command exists in PATH
    if ($libreOfficeCmd === null) {
        $output = [];
        $returnVar = 0;
        if (PHP_OS_FAMILY === 'Windows') {
            // Try multiple Windows methods
            exec('where soffice.exe 2>nul', $output, $returnVar);
            if ($returnVar !== 0) {
                exec('where soffice 2>nul', $output, $returnVar);
            }
            // Also check common installation paths
            $commonPaths = [
                'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
                'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
                'C:\\Program Files\\LibreOffice 7\\program\\soffice.exe',
                'C:\\Program Files\\LibreOffice 6\\program\\soffice.exe',
            ];
            foreach ($commonPaths as $path) {
                if (file_exists($path)) {
                    $libreOfficeCmd = $path;
                    break;
                }
            }
        } else {
            exec('which libreoffice 2>/dev/null', $output, $returnVar);
        }
        if ($returnVar === 0 && !empty($output[0]) && $libreOfficeCmd === null) {
            $libreOfficeCmd = trim($output[0]);
        }
    }
    
    if ($libreOfficeCmd) {
        // Use LibreOffice to convert
        $outputDir = dirname($pdfPath);
        $docxDir = dirname($docxPath);
        $docxFile = basename($docxPath);
        
        // Ensure output directory exists
        if (!is_dir($outputDir)) {
            mkdir($outputDir, 0755, true);
        }
        
        // LibreOffice command: soffice --headless --convert-to pdf --outdir <output_dir> <input_file>
        // On Windows, use full path and proper escaping
        if (PHP_OS_FAMILY === 'Windows') {
            $cmd = '"' . $libreOfficeCmd . '"' . 
                   ' --headless --convert-to pdf' . 
                   ' --outdir "' . $outputDir . '"' . 
                   ' "' . $docxPath . '"';
        } else {
            $cmd = escapeshellarg($libreOfficeCmd) . 
                   ' --headless --convert-to pdf' . 
                   ' --outdir ' . escapeshellarg($outputDir) . 
                   ' ' . escapeshellarg($docxPath);
        }
        
        error_log("convertDocxToPdf: Executing command: $cmd");
        
        $output = [];
        $returnVar = 0;
        $execOutput = '';
        if (PHP_OS_FAMILY === 'Windows') {
            // On Windows, use popen or exec with proper handling
            exec($cmd . ' 2>&1', $output, $returnVar);
            $execOutput = implode("\n", $output);
        } else {
            exec($cmd . ' 2>&1', $output, $returnVar);
            $execOutput = implode("\n", $output);
        }
        
        error_log("convertDocxToPdf: Command output: $execOutput");
        error_log("convertDocxToPdf: Return code: $returnVar");
        
        // Check for PDF file - LibreOffice might create it with slightly different name
        $expectedPdfPath = $outputDir . DIRECTORY_SEPARATOR . preg_replace('/\.docx$/i', '.pdf', $docxFile);
        
        // Wait a bit for file to be created (LibreOffice can be slow)
        $maxWait = 10; // seconds
        $waited = 0;
        while (!file_exists($pdfPath) && !file_exists($expectedPdfPath) && $waited < $maxWait) {
            usleep(500000); // 0.5 seconds
            $waited += 0.5;
        }
        
        if (file_exists($pdfPath)) {
            error_log("convertDocxToPdf: Successfully converted to PDF: $pdfPath");
            return $pdfPath;
        } elseif (file_exists($expectedPdfPath)) {
            // Rename to expected path
            if (rename($expectedPdfPath, $pdfPath)) {
                error_log("convertDocxToPdf: Found PDF at alternative path and renamed: $pdfPath");
                return $pdfPath;
            } else {
                error_log("convertDocxToPdf: Found PDF but failed to rename: $expectedPdfPath");
                return $expectedPdfPath; // Return the actual path
            }
        } else {
            error_log("convertDocxToPdf: LibreOffice conversion failed. Return code: $returnVar, Output: $execOutput");
            error_log("convertDocxToPdf: Expected PDF path: $pdfPath");
            error_log("convertDocxToPdf: Alternative PDF path: $expectedPdfPath");
        }
    }
    
    // If LibreOffice not available, try using alternative methods
    // Method 1: Try using COM object on Windows (if available)
    if (PHP_OS_FAMILY === 'Windows' && class_exists('COM')) {
        try {
            error_log("convertDocxToPdf: Attempting conversion using COM object");
            $word = new COM("Word.Application");
            $word->Visible = false;
            $word->Documents->Open($docxPath);
            $word->ActiveDocument->SaveAs2($pdfPath, 17); // 17 = PDF format
            $word->Quit(false);
            unset($word);
            
            if (file_exists($pdfPath)) {
                error_log("convertDocxToPdf: Successfully converted using COM: $pdfPath");
                return $pdfPath;
            }
        } catch (Exception $e) {
            error_log("convertDocxToPdf: COM conversion failed: " . $e->getMessage());
        }
    }
    
    // Method 2: Try using pandoc if available
    $pandocPaths = ['pandoc', '/usr/bin/pandoc', '/usr/local/bin/pandoc'];
    foreach ($pandocPaths as $pandocPath) {
        $output = [];
        $returnVar = 0;
        exec("$pandocPath --version 2>&1", $output, $returnVar);
        if ($returnVar === 0) {
            $cmd = escapeshellarg($pandocPath) . ' ' . escapeshellarg($docxPath) . ' -o ' . escapeshellarg($pdfPath);
            exec($cmd . ' 2>&1', $output, $returnVar);
            if ($returnVar === 0 && file_exists($pdfPath)) {
                error_log("convertDocxToPdf: Successfully converted using pandoc: $pdfPath");
                return $pdfPath;
            }
        }
    }
    
    // If all methods fail, log error and return false
    error_log("convertDocxToPdf: No PDF conversion tool available. LibreOffice, COM, and pandoc not found.");
    error_log("convertDocxToPdf: Please install LibreOffice for PDF conversion: https://www.libreoffice.org/download/");
    return false;
}
