<?php
require_once __DIR__ . '/init_session.php';

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

rich_session_start();

$position = strtolower(trim((string) ($_SESSION['position'] ?? '')));
$isAdmin = in_array($position, ['admin', 'administrator'], true);
$isLoggedIn = ($_SESSION['logged_in'] ?? false) === true;
$hasUserId = !empty($_SESSION['user_id']);

if (!$isAdmin && (!$isLoggedIn || !$hasUserId)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied. Admin only.']);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    header('Allow: GET, OPTIONS');
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/config.php';

try {
    $connection = getPostgreSQLDatabaseConnection();
} catch (Throwable $e) {
    error_log('Archive database connection failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

date_default_timezone_set('Asia/Manila');
$twentyFourHoursAgo = date('Y-m-d H:i:s', strtotime('-24 hours'));
$archiveData = [];
$category = $_GET['category'] ?? '';

try {
    if ($category === 'concern') {
        $stmt = $connection->prepare(
            "SELECT id, reporter_name, contact, date_and_time, location, statement, status, resolved_at
             FROM concerns
             WHERE UPPER(status) IN ('RESOLVED', 'FINISHED', 'FINISH')
               AND resolved_at IS NOT NULL
               AND resolved_at <= :cutoff
             ORDER BY resolved_at DESC
             LIMIT 500"
        );
        $stmt->execute(['cutoff' => $twentyFourHoursAgo]);
        $archiveData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } elseif ($category === 'emergency') {
        $stmt = $connection->prepare(
            "SELECT id, reporter_name, location, date_and_time, description, status, resolved_datetime
             FROM emergency_reports
             WHERE UPPER(status) IN ('RESOLVED', 'FINISHED', 'FINISH')
               AND resolved_datetime IS NOT NULL
               AND resolved_datetime <= :cutoff
             ORDER BY resolved_datetime DESC
             LIMIT 500"
        );
        $stmt->execute(['cutoff' => $twentyFourHoursAgo]);
        $archiveData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } elseif ($category === 'document') {
        $tableMap = [
            'barangay_id' => 'barangay_id_forms',
            'certification' => 'certification_forms',
            'coe' => 'coe_forms',
            'clearance' => 'clearance_forms',
            'indigency' => 'indigency_forms',
        ];
        $documentType = $_GET['document_type'] ?? '';
        $tables = isset($tableMap[$documentType])
            ? [$tableMap[$documentType]]
            : array_values($tableMap);

        foreach ($tables as $table) {
            $tableCheck = $connection->prepare(
                'SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = :table'
            );
            $tableCheck->execute(['table' => $table]);
            if (!$tableCheck->fetchColumn()) {
                continue;
            }

            $stmt = $connection->prepare(
                "SELECT * FROM \"$table\"
                 WHERE UPPER(status) = 'FINISHED'
                   AND finish_at IS NOT NULL
                   AND finish_at <= :cutoff
                 ORDER BY finish_at DESC
                 LIMIT 100"
            );
            $stmt->execute(['cutoff' => $twentyFourHoursAgo]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                unset($row['created_at']);

                $docType = strtoupper(str_replace('_forms', '', $table));
                $archiveData[] = [
                    'id' => $row['id'] ?? '',
                    'documentType' => $docType,
                    'purpose' => $row['purpose'] ?? '',
                    'source_table' => $table,
                    'surname' => $row['last_name'] ?? $row['surname'] ?? '',
                    'givenname' => $row['first_name'] ?? $row['given_name'] ?? $row['firstname'] ?? $row['givenname'] ?? '',
                    'middlename' => $row['middle_name'] ?? $row['middlename'] ?? '',
                    'address' => $row['address'] ?? '',
                    'status' => $row['status'] ?? 'Finished',
                    'submittedAt' => $row['submitted_at'] ?? '',
                    'finishAt' => $row['finish_at'] ?? '',
                    'data' => $row,
                ];
            }
        }

        usort($archiveData, static function ($a, $b) {
            return strtotime((string) ($b['finishAt'] ?? '')) <=> strtotime((string) ($a['finishAt'] ?? ''));
        });
        $archiveData = array_slice($archiveData, 0, 500);
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid category']);
        exit;
    }
} catch (Throwable $e) {
    error_log('Archive query failed for category ' . $category . ': ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database query failed']);
    exit;
}

$binaryFields = ['id_image', 'valid_id', 'res_picture', 'emergency_image', 'concern_image'];
$cleanArchiveData = [];
foreach ($archiveData as $item) {
    $cleanItem = [];
    foreach ($item as $key => $value) {
        if (in_array($key, $binaryFields, true)) {
            continue;
        }
        if ($key === 'data' && is_array($value)) {
            foreach ($binaryFields as $binaryField) {
                unset($value[$binaryField]);
            }
            unset($value['created_at']);
            foreach ($value as $dataKey => $dataValue) {
                if (is_string($dataValue) && strlen($dataValue) > 1000) {
                    unset($value[$dataKey]);
                }
            }
            $cleanItem[$key] = $value;
        } else {
            $cleanItem[$key] = $value;
        }
    }
    $cleanArchiveData[] = $cleanItem;
}

$jsonResponse = json_encode([
    'success' => true,
    'archive' => $cleanArchiveData,
    'count' => count($cleanArchiveData),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

if ($jsonResponse === false) {
    error_log('Archive JSON encoding error: ' . json_last_error_msg());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to encode archive data', 'archive' => [], 'count' => 0]);
    exit;
}

echo $jsonResponse;
