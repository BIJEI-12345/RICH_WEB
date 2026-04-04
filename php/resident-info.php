<?php
// Disable error display to prevent HTML output before JSON
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_errors.log');

// Set headers first, before any output
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { 
    http_response_code(204); 
    exit; 
}

// Start output buffering to catch any unexpected output
ob_start();

// Use config.php for database connection
require_once __DIR__ . '/config.php';

try {
    $connection = getDatabaseConnection();
    
    if ($connection->connect_error) {
        // Clear any output buffer
        ob_clean();
        error_log("Database connection error: " . $connection->connect_error);
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Database connection failed"]); 
        exit;
    }
    
    // Set charset to prevent encoding issues
    $connection->set_charset('utf8mb4');
    
} catch (Exception $e) {
    // Clear any output buffer
    ob_clean();
    error_log("Database connection exception: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Database connection failed"]); 
    exit;
}

// Handle different request methods
$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($requestMethod === 'GET') {
    try {
        // Clear any output buffer before JSON response
        ob_clean();
        
        // Query with id_image column to fetch image data
        $sql = "SELECT first_name, middle_name, last_name, suffix, email, age, sex, birthday, civil_status, address, valid_id, id_image FROM resident_information ORDER BY last_name, first_name";
        
        $result = $connection->query($sql);
        
        if (!$result) {
            error_log("Database query error: " . $connection->error);
            http_response_code(500);
            echo json_encode(["success" => false, "error" => "Database query failed"]);
            $connection->close();
            exit;
        }
        
        $residents = [];
        if ($result->num_rows > 0) {
            while ($row = $result->fetch_assoc()) {
                // Handle blob image data
                $idImage = '';
                if (!empty($row['id_image'])) {
                    try {
                        // Convert blob to base64 for JSON transmission
                        $idImage = 'data:image/jpeg;base64,' . base64_encode($row['id_image']);
                    } catch (Exception $e) {
                        error_log("Error encoding image: " . $e->getMessage());
                        $idImage = '';
                    }
                }
                
                $residents[] = [
                    'first_name' => $row['first_name'] ?? '',
                    'middle_name' => $row['middle_name'] ?? '',
                    'last_name' => $row['last_name'] ?? '',
                    'suffix' => $row['suffix'] ?? '',
                    'email' => $row['email'] ?? '',
                    'age' => $row['age'] ?? '',
                    'sex' => $row['sex'] ?? '',
                    'birthday' => $row['birthday'] ?? '',
                    'civil_status' => $row['civil_status'] ?? '',
                    'address' => $row['address'] ?? '',
                    'valid_id' => $row['valid_id'] ?? '',
                    'id_image' => $idImage
                ];
            }
        }
        
        echo json_encode(["success" => true, "residents" => $residents], JSON_UNESCAPED_UNICODE);
        
    } catch (Exception $e) {
        ob_clean();
        error_log("Error in GET request: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Failed to fetch residents"]);
        $connection->close();
        exit;
    }
    
} elseif ($requestMethod === 'POST') {
    try {
        // Clear any output buffer before JSON response
        ob_clean();
        
        // Handle adding new resident
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        
        $first_name = trim($input['first_name'] ?? '');
        $middle_name = trim($input['middle_name'] ?? '');
        $last_name = trim($input['last_name'] ?? '');
        $suffix = trim($input['suffix'] ?? '');
        $email = trim($input['email'] ?? '');
        $age = intval($input['age'] ?? 0);
        $sex = trim($input['sex'] ?? '');
        $birthday = trim($input['birthday'] ?? '');
        $civil_status = trim($input['civil_status'] ?? '');
        $address = trim($input['address'] ?? '');
        $valid_id = trim($input['valid_id'] ?? '');
        
        // Validate required fields
        if (empty($first_name) || empty($last_name) || empty($email) || $age <= 0 || empty($sex) || empty($birthday) || empty($civil_status) || empty($address) || empty($valid_id)) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "All required fields must be filled."]);
            $connection->close();
            exit;
        }
        
        // Validate email format
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "Invalid email format."]);
            $connection->close();
            exit;
        }
        
        // Check if email already exists
        $emailEsc = $connection->real_escape_string($email);
        $checkSql = "SELECT id FROM resident_information WHERE email = '{$emailEsc}'";
        $checkResult = $connection->query($checkSql);
        
        if ($checkResult && $checkResult->num_rows > 0) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "Email already exists in the system."]);
            $connection->close();
            exit;
        }
        
        // Insert new resident
        $first_nameEsc = $connection->real_escape_string($first_name);
        $middle_nameEsc = $connection->real_escape_string($middle_name);
        $last_nameEsc = $connection->real_escape_string($last_name);
        $suffixEsc = $connection->real_escape_string($suffix);
        $sexEsc = $connection->real_escape_string($sex);
        $birthdayEsc = $connection->real_escape_string($birthday);
        $civil_statusEsc = $connection->real_escape_string($civil_status);
        $addressEsc = $connection->real_escape_string($address);
        $valid_idEsc = $connection->real_escape_string($valid_id);
        
        $insertSql = "INSERT INTO resident_information (first_name, middle_name, last_name, suffix, email, age, sex, birthday, civil_status, address, valid_id) 
                      VALUES ('{$first_nameEsc}', '{$middle_nameEsc}', '{$last_nameEsc}', '{$suffixEsc}', '{$emailEsc}', {$age}, '{$sexEsc}', '{$birthdayEsc}', '{$civil_statusEsc}', '{$addressEsc}', '{$valid_idEsc}')";
        
        if ($connection->query($insertSql)) {
            echo json_encode(["success" => true, "message" => "Resident added successfully."], JSON_UNESCAPED_UNICODE);
        } else {
            error_log("Insert error: " . $connection->error);
            http_response_code(500);
            echo json_encode(["success" => false, "error" => "Failed to add resident"]);
        }
        
    } catch (Exception $e) {
        ob_clean();
        error_log("Error in POST request: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Failed to add resident"]);
        $connection->close();
        exit;
    }
}

// Close connection if still open
if (isset($connection) && $connection) {
    $connection->close();
}

// Fallback: if no method matched, return empty success response
if (!isset($requestMethod) || ($requestMethod !== 'GET' && $requestMethod !== 'POST')) {
    ob_clean();
    echo json_encode(["success" => true, "residents" => []], JSON_UNESCAPED_UNICODE);
}

// End output buffering and send output
ob_end_flush();
?>
