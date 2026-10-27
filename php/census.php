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
function ensureCensusColumns(PDO $connection) {
    $defs = [
        'house_no' => 'VARCHAR(50)',
        'street' => 'VARCHAR(255)',
        'sitio' => 'VARCHAR(150)',
        'barangay' => 'VARCHAR(100)',
        'municipality' => 'VARCHAR(100)',
        'province' => 'VARCHAR(100)',
    ];
    foreach ($defs as $col => $def) {
        $connection->exec("ALTER TABLE census_form ADD COLUMN IF NOT EXISTS $col $def");
    }
}

/**
 * Soft-remove: rows with archived_at set are excluded from active census; admin can restore.
 */
function ensureArchivedAtColumn(PDO $connection) {
    $connection->exec('ALTER TABLE census_form ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP NULL DEFAULT NULL');
}

/**
 * Census workflow: status (Censused | Blocked | Archived), blocked_at, return_at.
 */
function ensureCensusStatusColumns(PDO $connection) {
    $cols = [
        'status' => "VARCHAR(30) NOT NULL DEFAULT 'Censused'",
        'blocked_at' => 'TIMESTAMP NULL',
        'return_at' => 'TIMESTAMP NULL',
    ];
    foreach ($cols as $col => $def) {
        $connection->exec("ALTER TABLE census_form ADD COLUMN IF NOT EXISTS $col $def");
    }
    $connection->query("UPDATE census_form SET status = 'Archived' WHERE archived_at IS NOT NULL");
    $connection->query("UPDATE census_form SET status = 'Censused' WHERE archived_at IS NULL AND (status IS NULL OR status = '')");
}

/** Indigenous Peoples (IP) flag — TINYINT(1) DEFAULT 0 */
function ensureIndigenousColumn(PDO $connection) {
    $connection->exec('ALTER TABLE census_form ADD COLUMN IF NOT EXISTS indigenous INTEGER NOT NULL DEFAULT 0');
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

/** Hindi PWD ang halagang placeholder (None, N/A, atbp.) — pareho sa lohika sa census.js. */
function censusPhpDisabilitiesTextIsMeaningful(string $text): bool {
    $t = trim($text);
    if ($t === '') {
        return false;
    }
    $low = strtolower($t);
    $noneLike = ['null', 'none', 'n/a', 'n/a.', 'na', '-', '—', 'no', 'walang', 'wala', 'no disability', 'walang disability', 'without disability'];

    return !in_array($low, $noneLike, true);
}

/** Household key format: CEN-00001 (5-digit zero-padded suffix). */
function censusNextHouseholdId(PDO $connection) {
    $maxNum = 0;
    $res = $connection->query('SELECT census_id FROM census_form');
    if ($res) {
        while ($row = $res->fetch(PDO::FETCH_ASSOC)) {
            $cid = isset($row['census_id']) ? trim((string) $row['census_id']) : '';
            if ($cid === '') {
                continue;
            }
            if (preg_match('/^CEN-(\d+)$/i', $cid, $m)) {
                $n = (int) $m[1];
            } elseif (preg_match('/^\d+$/', $cid)) {
                $n = (int) $cid;
            } else {
                continue;
            }
            if ($n > $maxNum) {
                $maxNum = $n;
            }
        }
    }
    $next = $maxNum + 1;

    return 'CEN-' . str_pad((string) $next, 5, '0', STR_PAD_LEFT);
}

try {
    $connection = getPostgreSQLDatabaseConnection();
} catch (Throwable $e) {
    error_log("Database connection error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Database connection failed"]);
    exit;
}

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($requestMethod === 'GET') {
    try {
        $tableCheck = $connection->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'census_form'");
        $tableCheck->execute();
        if (!$tableCheck->fetchColumn()) {
            echo json_encode(["success" => true, "census" => [], "households" => []]);
            exit;
        }

        ensureCensusColumns($connection);
        ensureArchivedAtColumn($connection);
        ensureCensusStatusColumns($connection);
        ensureIndigenousColumn($connection);

        $viewArchive = isset($_GET['view']) && $_GET['view'] === 'archive';
        if ($viewArchive) {
            require_once __DIR__ . '/init_session.php';
            rich_session_start();
            if (empty($_SESSION['logged_in']) || !censusCanManageArchive()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Archive is only available to administrators.']);
                exit;
            }
            $whereArchived = ' WHERE archived_at IS NOT NULL ';
        } else {
            $whereArchived = ' WHERE archived_at IS NULL ';
        }

        $columnsResult = $connection->prepare("SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'census_form'");
        $columnsResult->execute();
        $existingColumns = array_map('strtolower', $columnsResult->fetchAll(PDO::FETCH_COLUMN));

        $orderBy = [];
        if (in_array('sitio', $existingColumns, true)) {
            $orderBy[] = 'sitio ASC';
        }
        if (in_array('house_no', $existingColumns) || in_array('houseno', $existingColumns)) {
            $houseNoCol = in_array('house_no', $existingColumns) ? 'house_no' : 'houseno';
            $orderBy[] = "CASE WHEN $houseNoCol ~ '^[0-9]+' THEN substring($houseNoCol from '^[0-9]+')::INTEGER END";
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

        foreach ($result->fetchAll(PDO::FETCH_ASSOC) as $row) {
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
                        if ($key === 'disabilities') {
                            $censusRecord[$key] = $value;
                        } else {
                            $censusRecord[$key] = $value ?? '';
                        }
                    }
                }

                $groupedData[$folderKey]['members'][] = $censusRecord;
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

                $disRaw = $member['disabilities'] ?? null;
                $hasDisability = $disRaw !== null && censusPhpDisabilitiesTextIsMeaningful((string) $disRaw);
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
            while ($hr = $hhRes->fetch(PDO::FETCH_ASSOC)) {
                $households[] = [
                    'census_id' => (string) ($hr['census_id'] ?? ''),
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
        exit;

    } catch (Throwable $e) {
        error_log("Census query error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Database query failed: " . $e->getMessage()]);
        exit;
    }
}

if ($requestMethod === 'POST') {
    require_once __DIR__ . '/init_session.php';
    rich_session_start();

    if (empty($_SESSION['logged_in'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Authentication required']);
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
        ensureCensusStatusColumns($connection);
        ensureIndigenousColumn($connection);

        if ($action === 'delete') {
            if (!censusCanArchiveResident()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'You do not have permission to remove residents.']);
                exit;
            }
            $id = isset($input['id']) ? (int) $input['id'] : 0;
            if ($id <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Invalid resident id']);
                exit;
            }
            $stmt = $connection->prepare("UPDATE census_form SET status = 'Archived', archived_at = NOW(), blocked_at = NULL WHERE id = ? AND archived_at IS NULL");
            $stmt->execute([$id]);
            $affected = $stmt->rowCount();
            echo json_encode(['success' => true, 'message' => $affected > 0 ? 'Resident moved to archive.' : 'No record updated.', 'archived' => $affected > 0]);
            exit;
        }

        if ($action === 'block') {
            if (!censusCanArchiveResident()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'You do not have permission to block residents.']);
                exit;
            }
            $id = isset($input['id']) ? (int) $input['id'] : 0;
            if ($id <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Invalid resident id']);
                exit;
            }
            $stmt = $connection->prepare("UPDATE census_form SET status = 'Blocked', blocked_at = NOW() WHERE id = ? AND archived_at IS NULL");
            $stmt->execute([$id]);
            $affected = $stmt->rowCount();
            echo json_encode(['success' => true, 'message' => $affected > 0 ? 'Resident marked as blocked.' : 'No record updated.', 'blocked' => $affected > 0]);
            exit;
        }

        if ($action === 'restore') {
            if (!censusCanManageArchive()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Only administrators can restore residents.']);
                exit;
            }
            $id = isset($input['id']) ? (int) $input['id'] : 0;
            if ($id <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Invalid resident id']);
                exit;
            }
            $stmt = $connection->prepare("UPDATE census_form SET status = 'Censused', archived_at = NULL, blocked_at = NULL, return_at = NOW() WHERE id = ? AND archived_at IS NOT NULL");
            $stmt->execute([$id]);
            $affected = $stmt->rowCount();
            echo json_encode(['success' => true, 'message' => $affected > 0 ? 'Resident returned to active census.' : 'No record restored.', 'restored' => $affected > 0]);
            exit;
        }

        if ($action !== 'add') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid action']);
            exit;
        }

        if (!censusCanArchiveResident()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'You do not have permission to add census residents.']);
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
            exit;
        }
        if ($birthday === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Birthdate is required.']);
            exit;
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $birthday)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid birthdate format.']);
            exit;
        }
        if ($sitio === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Sitio is required.']);
            exit;
        }

        if ($middleName === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Middle name is required.']);
            exit;
        }
        if ($civilStatus === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Civil status is required.']);
            exit;
        }
        if ($contactNumber === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Contact number is required.']);
            exit;
        }
        if ($occupation === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Occupation is required.']);
            exit;
        }
        if ($placeOfWork === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Place of work is required.']);
            exit;
        }
        if ($disabilities === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Disabilities is required (use None if not applicable).']);
            exit;
        }
        if ($relation === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Relation to household is required.']);
            exit;
        }
        if ($houseNo === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'House number is required.']);
            exit;
        }
        if ($street === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Street is required.']);
            exit;
        }
        if ($benefits === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Barangay supported benefits is required (use None if not applicable).']);
            exit;
        }

        $allowedSex = ['Male', 'Female', 'Other'];
        if (!in_array($sex, $allowedSex, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Sex must be Male, Female, or Other.']);
            exit;
        }

        $age = ageFromBirthday($birthday);
        if ($age === null) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Could not compute age from birthdate.']);
            exit;
        }

        $censusIdRaw = isset($input['census_id']) ? trim((string) $input['census_id']) : '';
        if ($censusIdRaw === '' || $censusIdRaw === '0') {
            $censusId = censusNextHouseholdId($connection);
        } elseif (preg_match('/^CEN-(\d+)$/i', $censusIdRaw, $m)) {
            $censusId = 'CEN-' . $m[1];
        } elseif (preg_match('/^\d+$/', $censusIdRaw)) {
            $censusId = $censusIdRaw;
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid household (census_id). Use format CEN-00001 or choose an existing household.']);
            exit;
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

        $indigenous = 0;
        if (isset($input['indigenous'])) {
            $iv = $input['indigenous'];
            $indigenous = ($iv === true || $iv === 1 || $iv === '1' || $iv === 'true') ? 1 : 0;
        }

        $sql = 'INSERT INTO census_form (
            census_id, first_name, last_name, suffix, middle_name, age, sex, birthday,
            civil_status, contact_number, occupation, place_of_work, disabilities,
            barangay_supported_benefits, complete_address, relation_to_household,
            house_no, street, sitio, barangay, municipality, province, indigenous
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id';

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

        $stmt = $connection->prepare($sql);
        $stmt->execute([
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
            $provinceFixed,
            $indigenous,
        ]);
        $newId = (int) $stmt->fetchColumn();

        echo json_encode([
            'success' => true,
            'message' => 'Resident added.',
            'id' => $newId,
            'census_id' => $censusId,
            'age' => $age,
        ]);
    } catch (Throwable $e) {
        error_log('Census POST error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Save failed: ' . $e->getMessage()]);
    }
    exit;
}
echo json_encode(['success' => true, 'census' => []]);
