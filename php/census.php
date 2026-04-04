<?php
// Suppress errors and warnings to prevent HTML output
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

@ob_clean();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/config.php';

/**
 * Add address columns if missing (house_no, street, sitio, barangay, municipality, province).
 */
function ensureCensusColumns(mysqli $connection) {
    $defs = [
        'house_no' => 'VARCHAR(50) NULL',
        'street' => 'VARCHAR(255) NULL',
        'sitio' => 'VARCHAR(150) NULL',
        'barangay' => 'VARCHAR(100) NULL',
        'municipality' => 'VARCHAR(100) NULL',
        'province' => 'VARCHAR(100) NULL',
    ];
    foreach ($defs as $col => $def) {
        $colEsc = $connection->real_escape_string($col);
        $r = $connection->query("SHOW COLUMNS FROM census_form LIKE '$colEsc'");
        if ($r && $r->num_rows === 0) {
            $connection->query("ALTER TABLE census_form ADD COLUMN `$col` $def");
        }
    }
}

/**
 * Soft-remove: rows with archived_at set are excluded from active census; admin can restore.
 */
function ensureArchivedAtColumn(mysqli $connection) {
    $r = $connection->query("SHOW COLUMNS FROM census_form LIKE 'archived_at'");
    if ($r && $r->num_rows === 0) {
        $connection->query("ALTER TABLE census_form ADD COLUMN archived_at DATETIME NULL DEFAULT NULL");
    }
}

function censusPositionNorm() {
    if (empty($_SESSION['position'])) {
        return '';
    }
    return strtolower(trim((string) $_SESSION['position']));
}

/** Admin or Mother Leader may remove (archive) residents from active census. */
function censusCanArchiveResident() {
    $p = censusPositionNorm();
    return $p === 'admin' || $p === 'mother leader';
}

/** Only Admin may list archive and restore residents. */
function censusCanManageArchive() {
    return censusPositionNorm() === 'admin';
}

function ageFromBirthday($birthday) {
    if (empty($birthday)) {
        return null;
    }
    try {
        $b = new DateTime(substr($birthday, 0, 10));
        $today = new DateTime('today');
        return (int) $b->diff($today)->y;
    } catch (Exception $e) {
        return null;
    }
}

try {
    $connection = getDatabaseConnection();
    if ($connection->connect_error) {
        throw new Exception("Database connection failed: " . $connection->connect_error);
    }
    $connection->set_charset('utf8mb4');
} catch (Exception $e) {
    error_log("Database connection error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Database connection failed"]);
    exit;
}

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($requestMethod === 'GET') {
    try {
        $tableCheck = $connection->query("SHOW TABLES LIKE 'census_form'");
        if (!$tableCheck || $tableCheck->num_rows === 0) {
            echo json_encode(["success" => true, "census" => [], "households" => []]);
            $connection->close();
            exit;
        }

        ensureCensusColumns($connection);
        ensureArchivedAtColumn($connection);

        $viewArchive = isset($_GET['view']) && $_GET['view'] === 'archive';
        if ($viewArchive) {
            require_once __DIR__ . '/init_session.php';
            rich_session_start();
            if (empty($_SESSION['logged_in']) || !censusCanManageArchive()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Archive is only available to administrators.']);
                $connection->close();
                exit;
            }
            $whereArchived = ' WHERE archived_at IS NOT NULL ';
        } else {
            $whereArchived = ' WHERE archived_at IS NULL ';
        }

        $columnsResult = $connection->query("SHOW COLUMNS FROM census_form");
        $existingColumns = [];
        if ($columnsResult) {
            while ($col = $columnsResult->fetch_assoc()) {
                $existingColumns[] = strtolower($col['Field']);
            }
        }

        $orderBy = [];
        if (in_array('sitio', $existingColumns, true)) {
            $orderBy[] = 'sitio ASC';
        }
        if (in_array('house_no', $existingColumns) || in_array('houseno', $existingColumns)) {
            $houseNoCol = in_array('house_no', $existingColumns) ? 'house_no' : 'houseno';
            $orderBy[] = "CAST($houseNoCol AS UNSIGNED)";
            $orderBy[] = $houseNoCol;
        }

        $lastNameCol = null;
        $firstNameCol = null;
        if (in_array('last_name', $existingColumns)) {
            $lastNameCol = 'last_name';
        } elseif (in_array('lastname', $existingColumns)) {
            $lastNameCol = 'lastname';
        }

        if (in_array('first_name', $existingColumns)) {
            $firstNameCol = 'first_name';
        } elseif (in_array('firstname', $existingColumns)) {
            $firstNameCol = 'firstname';
        }

        if ($lastNameCol) {
            $orderBy[] = $lastNameCol;
        }
        if ($firstNameCol) {
            $orderBy[] = $firstNameCol;
        }

        if (empty($orderBy)) {
            $orderBy[] = 'id';
        }

        $sql = 'SELECT * FROM census_form' . $whereArchived . 'ORDER BY ' . implode(', ', $orderBy);
        $result = $connection->query($sql);

        if (!$result) {
            throw new Exception("Database query failed: " . $connection->error);
        }

        function extractHouseNumber($address) {
            if (empty($address)) {
                return '';
            }
            if (preg_match('/^(\d+)/', trim($address), $matches)) {
                return $matches[1];
            }
            return '';
        }

        $groupedData = [];

        if ($result->num_rows > 0) {
            while ($row = $result->fetch_assoc()) {
                $completeAddress = $row['complete_address'] ?? $row['completeAddress'] ?? '';
                $lastName = $row['last_name'] ?? $row['lastname'] ?? $row['lastName'] ?? '';

                $houseNo = $row['house_no'] ?? $row['houseNo'] ?? $row['house_number'] ?? '';
                if ($houseNo === '' || $houseNo === null) {
                    $houseNo = extractHouseNumber($completeAddress);
                }

                $familyName = !empty($lastName) ? trim($lastName) : 'Unknown Family';
                $addressForFolder = !empty($completeAddress) ? trim($completeAddress) : 'Unknown Address';
                $folderKey = $familyName . ' Family - ' . $addressForFolder;

                if (!isset($groupedData[$folderKey])) {
                    $groupedData[$folderKey] = [
                        'complete_address' => $completeAddress,
                        'address_display' => $folderKey,
                        'house_number' => $houseNo,
                        'family_name' => $familyName,
                        'sitio' => $row['sitio'] ?? '',
                        'members' => [],
                    ];
                }

                $censusRecord = [];
                foreach ($row as $key => $value) {
                    if (stripos($key, 'image') !== false || stripos($key, 'photo') !== false) {
                        if (!empty($value)) {
                            $censusRecord[$key] = 'data:image/jpeg;base64,' . base64_encode($value);
                        } else {
                            $censusRecord[$key] = '';
                        }
                    } else {
                        $censusRecord[$key] = $value ?? '';
                    }
                }

                $groupedData[$folderKey]['members'][] = $censusRecord;
            }
        }

        $totalCount = 0;
        $maleCount = 0;
        $femaleCount = 0;
        $disabilityCount = 0;

        $formattedData = [];
        foreach ($groupedData as $addressKey => $addressData) {
            foreach ($addressData['members'] as $member) {
                $totalCount++;

                $sex = strtolower((string) ($member['sex'] ?? $member['gender'] ?? ''));
                if ($sex === 'male' || $sex === 'm') {
                    $maleCount++;
                } elseif ($sex === 'female' || $sex === 'f') {
                    $femaleCount++;
                }

                $hasDisability = false;
                $disStr = trim((string) ($member['disabilities'] ?? ''));
                if ($disStr !== '') {
                    $hasDisability = true;
                }
                if (!$hasDisability) {
                    $disabilityFields = ['disability', 'disabled', 'pwd', 'person_with_disability', 'has_disability', 'with_disability'];
                    foreach ($disabilityFields as $field) {
                        $value = strtolower((string) ($member[$field] ?? ''));
                        if ($value !== '' && ($value === 'yes' || $value === 'y' || $value === '1' || $value === 'true' || $value === 'with disability' || $value === 'pwd')) {
                            $hasDisability = true;
                            break;
                        }
                    }
                }
                if ($hasDisability) {
                    $disabilityCount++;
                }
            }

            $firstSitio = '';
            if (!empty($addressData['members'][0]['sitio'])) {
                $firstSitio = (string) $addressData['members'][0]['sitio'];
            }

            $formattedData[] = [
                'complete_address' => $addressData['complete_address'],
                'address_display' => $addressData['address_display'],
                'sitio' => $firstSitio,
                'members' => $addressData['members'],
            ];
        }

        usort($formattedData, function ($a, $b) {
            $sa = isset($a['sitio']) ? (string) $a['sitio'] : '';
            $sb = isset($b['sitio']) ? (string) $b['sitio'] : '';
            $c = strcmp($sa, $sb);
            if ($c !== 0) {
                return $c;
            }
            return strcmp((string) ($a['address_display'] ?? ''), (string) ($b['address_display'] ?? ''));
        });

        $households = [];
        $hhRes = $connection->query("SELECT census_id, MIN(complete_address) AS address_label FROM census_form WHERE archived_at IS NULL GROUP BY census_id ORDER BY census_id DESC");
        if ($hhRes) {
            while ($hr = $hhRes->fetch_assoc()) {
                $households[] = [
                    'census_id' => (int) $hr['census_id'],
                    'label' => (string) ($hr['address_label'] ?? ('Household #' . $hr['census_id'])),
                ];
            }
        }

        $statistics = [
            'total' => $totalCount,
            'male' => $maleCount,
            'female' => $femaleCount,
            'with_disabilities' => $disabilityCount,
        ];

        echo json_encode([
            'success' => true,
            'view' => $viewArchive ? 'archive' : 'active',
            'census' => $formattedData,
            'statistics' => $statistics,
            'households' => $households,
        ]);
        $connection->close();
        exit;

    } catch (Exception $e) {
        error_log("Census query error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Database query failed: " . $e->getMessage()]);
        $connection->close();
        exit;
    }
}

if ($requestMethod === 'POST') {
    require_once __DIR__ . '/init_session.php';
    rich_session_start();

    if (empty($_SESSION['logged_in'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Authentication required']);
        $connection->close();
        exit;
    }

    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);
    if (!is_array($input)) {
        $input = [];
    }

    $action = isset($input['action']) ? trim((string) $input['action']) : '';

    try {
        ensureCensusColumns($connection);
        ensureArchivedAtColumn($connection);

        if ($action === 'delete') {
            if (!censusCanArchiveResident()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'You do not have permission to remove residents.']);
                $connection->close();
                exit;
            }
            $id = isset($input['id']) ? (int) $input['id'] : 0;
            if ($id <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Invalid resident id']);
                $connection->close();
                exit;
            }
            $stmt = $connection->prepare('UPDATE census_form SET archived_at = NOW() WHERE id = ? AND archived_at IS NULL LIMIT 1');
            if (!$stmt) {
                throw new Exception($connection->error);
            }
            $stmt->bind_param('i', $id);
            $stmt->execute();
            $affected = $stmt->affected_rows;
            $stmt->close();
            echo json_encode(['success' => true, 'message' => $affected > 0 ? 'Resident moved to archive.' : 'No record updated.', 'archived' => $affected > 0]);
            $connection->close();
            exit;
        }

        if ($action === 'restore') {
            if (!censusCanManageArchive()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Only administrators can restore residents.']);
                $connection->close();
                exit;
            }
            $id = isset($input['id']) ? (int) $input['id'] : 0;
            if ($id <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Invalid resident id']);
                $connection->close();
                exit;
            }
            $stmt = $connection->prepare('UPDATE census_form SET archived_at = NULL WHERE id = ? AND archived_at IS NOT NULL LIMIT 1');
            if (!$stmt) {
                throw new Exception($connection->error);
            }
            $stmt->bind_param('i', $id);
            $stmt->execute();
            $affected = $stmt->affected_rows;
            $stmt->close();
            echo json_encode(['success' => true, 'message' => $affected > 0 ? 'Resident returned to active census.' : 'No record restored.', 'restored' => $affected > 0]);
            $connection->close();
            exit;
        }

        if ($action !== 'add') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid action']);
            $connection->close();
            exit;
        }

        if (!censusCanArchiveResident()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'You do not have permission to add census residents.']);
            $connection->close();
            exit;
        }

        $firstName = trim((string) ($input['first_name'] ?? ''));
        $lastName = trim((string) ($input['last_name'] ?? ''));
        $middleName = trim((string) ($input['middle_name'] ?? ''));
        $suffix = trim((string) ($input['suffix'] ?? ''));
        $birthday = trim((string) ($input['birthday'] ?? $input['birthdate'] ?? ''));
        $sex = trim((string) ($input['sex'] ?? ''));
        $civilStatus = trim((string) ($input['civil_status'] ?? ''));
        $contactNumber = trim((string) ($input['contact_number'] ?? ''));
        $occupation = trim((string) ($input['occupation'] ?? ''));
        $placeOfWork = trim((string) ($input['place_of_work'] ?? ''));
        $disabilities = trim((string) ($input['disabilities'] ?? ''));
        $benefits = trim((string) ($input['barangay_supported_benefits'] ?? ''));
        $relation = trim((string) ($input['relation_to_household'] ?? ''));
        $houseNo = trim((string) ($input['house_no'] ?? ''));
        $street = trim((string) ($input['street'] ?? ''));
        $sitio = trim((string) ($input['sitio'] ?? ''));

        $barangayFixed = 'Bigte';
        $municipalityFixed = 'Norzagaray';
        $provinceFixed = 'Bulacan';

        if ($firstName === '' || $lastName === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'First name and last name are required.']);
            $connection->close();
            exit;
        }
        if ($birthday === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Birthdate is required.']);
            $connection->close();
            exit;
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $birthday)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid birthdate format.']);
            $connection->close();
            exit;
        }
        if ($sitio === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Sitio is required.']);
            $connection->close();
            exit;
        }

        if ($middleName === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Middle name is required.']);
            $connection->close();
            exit;
        }
        if ($civilStatus === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Civil status is required.']);
            $connection->close();
            exit;
        }
        if ($contactNumber === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Contact number is required.']);
            $connection->close();
            exit;
        }
        if ($occupation === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Occupation is required.']);
            $connection->close();
            exit;
        }
        if ($placeOfWork === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Place of work is required.']);
            $connection->close();
            exit;
        }
        if ($disabilities === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Disabilities is required (use None if not applicable).']);
            $connection->close();
            exit;
        }
        if ($relation === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Relation to household is required.']);
            $connection->close();
            exit;
        }
        if ($houseNo === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'House number is required.']);
            $connection->close();
            exit;
        }
        if ($street === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Street is required.']);
            $connection->close();
            exit;
        }
        if ($benefits === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Barangay supported benefits is required (use None if not applicable).']);
            $connection->close();
            exit;
        }

        $allowedSex = ['Male', 'Female', 'Other'];
        if (!in_array($sex, $allowedSex, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Sex must be Male, Female, or Other.']);
            $connection->close();
            exit;
        }

        $age = ageFromBirthday($birthday);
        if ($age === null) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Could not compute age from birthdate.']);
            $connection->close();
            exit;
        }

        $censusIdIn = isset($input['census_id']) ? (int) $input['census_id'] : 0;
        if ($censusIdIn <= 0) {
            $maxRes = $connection->query('SELECT COALESCE(MAX(census_id), 0) AS m FROM census_form');
            $rowMax = $maxRes ? $maxRes->fetch_assoc() : ['m' => 0];
            $censusId = (int) $rowMax['m'] + 1;
        } else {
            $censusId = $censusIdIn;
        }

        $addrParts = array_filter([
            $houseNo !== '' ? $houseNo : null,
            $street !== '' ? $street : null,
            $sitio !== '' ? $sitio : null,
            $barangayFixed,
            $municipalityFixed,
            $provinceFixed,
        ], function ($v) {
            return $v !== null && $v !== '';
        });
        $completeAddress = implode(', ', $addrParts);

        $sql = 'INSERT INTO census_form (
            census_id, first_name, last_name, suffix, middle_name, age, sex, birthday,
            civil_status, contact_number, occupation, place_of_work, disabilities,
            barangay_supported_benefits, complete_address, relation_to_household,
            house_no, street, sitio, barangay, municipality, province
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';

        $stmt = $connection->prepare($sql);
        if (!$stmt) {
            throw new Exception($connection->error);
        }

        $suffixNull = $suffix === '' ? null : $suffix;
        $middleNull = $middleName === '' ? null : $middleName;
        $civilNull = $civilStatus === '' ? null : $civilStatus;
        $contactNull = $contactNumber === '' ? null : $contactNumber;
        $occNull = $occupation === '' ? null : $occupation;
        $powNull = $placeOfWork === '' ? null : $placeOfWork;
        $disNull = $disabilities === '' ? null : $disabilities;
        $benNull = $benefits === '' ? null : $benefits;
        $relNull = $relation === '' ? null : $relation;
        $houseNull = $houseNo === '' ? null : $houseNo;
        $streetNull = $street === '' ? null : $street;

        $stmt->bind_param(
            'isssssisssssssssssssss',
            $censusId,
            $firstName,
            $lastName,
            $suffixNull,
            $middleNull,
            $age,
            $sex,
            $birthday,
            $civilNull,
            $contactNull,
            $occNull,
            $powNull,
            $disNull,
            $benNull,
            $completeAddress,
            $relNull,
            $houseNull,
            $streetNull,
            $sitio,
            $barangayFixed,
            $municipalityFixed,
            $provinceFixed
        );

        if (!$stmt->execute()) {
            $err = $stmt->error;
            $stmt->close();
            throw new Exception($err);
        }
        $newId = (int) $connection->insert_id;
        $stmt->close();

        echo json_encode([
            'success' => true,
            'message' => 'Resident added.',
            'id' => $newId,
            'census_id' => $censusId,
            'age' => $age,
        ]);
    } catch (Exception $e) {
        error_log('Census POST error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Save failed: ' . $e->getMessage()]);
    }
    $connection->close();
    exit;
}

$connection->close();
echo json_encode(['success' => true, 'census' => []]);
