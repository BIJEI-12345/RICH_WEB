<?php
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/php_errors.log');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/config.php';

try {
    $connection = getPostgreSQLDatabaseConnection();
} catch (Throwable $e) {
    error_log('Resident information database connection failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($requestMethod === 'GET') {
    try {
        $sql = "SELECT first_name, middle_name, last_name, suffix, email, age, sex, birthday, civil_status, address, valid_id, encode(id_image, 'base64') AS id_image_base64
                FROM resident_information
                ORDER BY last_name, first_name";
        $residents = $connection->query($sql)->fetchAll();

        foreach ($residents as &$resident) {
            $resident['id_image'] = !empty($resident['id_image_base64'])
                ? 'data:image/jpeg;base64,' . $resident['id_image_base64']
                : '';
            unset($resident['id_image_base64']);
        }
        unset($resident);

        echo json_encode(['success' => true, 'residents' => $residents], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        error_log('Error fetching resident information: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to fetch residents']);
    }
    exit;
}

if ($requestMethod === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid request data.']);
        exit;
    }

    $firstName = trim($input['first_name'] ?? '');
    $middleName = trim($input['middle_name'] ?? '');
    $lastName = trim($input['last_name'] ?? '');
    $suffix = trim($input['suffix'] ?? '');
    $email = trim($input['email'] ?? '');
    $age = filter_var($input['age'] ?? null, FILTER_VALIDATE_INT);
    $sex = trim($input['sex'] ?? '');
    $birthday = trim($input['birthday'] ?? '');
    $civilStatus = trim($input['civil_status'] ?? '');
    $address = trim($input['address'] ?? '');
    $validId = trim($input['valid_id'] ?? '');

    if (
        $firstName === '' || $lastName === '' || $email === '' || $age === false || $age <= 0 ||
        $sex === '' || $birthday === '' || $civilStatus === '' || $address === '' || $validId === ''
    ) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'All required fields must be filled.']);
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid email format.']);
        exit;
    }

    try {
        $check = $connection->prepare('SELECT 1 FROM resident_information WHERE email = :email LIMIT 1');
        $check->execute(['email' => $email]);
        if ($check->fetchColumn()) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Email already exists in the system.']);
            exit;
        }

        $insert = $connection->prepare(
            'INSERT INTO resident_information
                (first_name, middle_name, last_name, suffix, email, age, sex, birthday, civil_status, address, valid_id)
             VALUES
                (:first_name, :middle_name, :last_name, :suffix, :email, :age, :sex, :birthday, :civil_status, :address, :valid_id)'
        );
        $insert->execute([
            'first_name' => $firstName,
            'middle_name' => $middleName,
            'last_name' => $lastName,
            'suffix' => $suffix,
            'email' => $email,
            'age' => $age,
            'sex' => $sex,
            'birthday' => $birthday,
            'civil_status' => $civilStatus,
            'address' => $address,
            'valid_id' => $validId,
        ]);

        echo json_encode(['success' => true, 'message' => 'Resident added successfully.'], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        error_log('Error adding resident: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to add resident']);
    }
    exit;
}

http_response_code(405);
header('Allow: GET, POST, OPTIONS');
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
