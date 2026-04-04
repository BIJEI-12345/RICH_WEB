<?php
require_once __DIR__ . '/init_session.php';
// Configure session timeout before starting session
ini_set('session.gc_maxlifetime', 3600); // 1 hour (3600 seconds)
session_set_cookie_params([
    'lifetime' => 3600, // Cookie lifetime = 1 hour
    'path' => '/',
    'domain' => '',
    'secure' => false, // Set to true if using HTTPS
    'httponly' => true,
    'samesite' => 'Lax'
]);

rich_session_start();

// Disable error reporting to prevent HTML output
error_reporting(0);
ini_set('display_errors', 0);

// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// Use config.php for database connection (tries local first, then AWS)
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/audit_trail_helper.php';

try {
  $connection = getDatabaseConnection();
  // Log which database we're connected to
  $host = $connection->host_info;
  error_log("Connected to database: " . $host);
} catch (Exception $e) {
  error_log("Database connection exception: " . $e->getMessage());
  http_response_code(500);
  echo json_encode(["error" => "Database connection failed."]); 
  exit;
}

try {
  $input = json_decode(file_get_contents('php://input'), true) ?? [];
  $email = trim($input['email'] ?? '');
  $password = (string)($input['password'] ?? '');
  
  // Debug logging (remove in production)
  error_log("Login attempt - Email: " . $email . ", Password length: " . strlen($password));

  if ($email === '' || $password === '') {
    try {
      logFailedLoginAttempt($email !== '' ? $email : 'unknown', 'missing_credentials', null);
    } catch (Exception $e) {
      error_log("Audit login_failed: " . $e->getMessage());
    }
    http_response_code(400);
    echo json_encode(["error" => "Email and password are required", "received" => ["email" => $email, "password_len" => strlen($password)]]);
    $connection->close();
    exit;
  }

  // Use prepared statements to avoid encoding/corruption issues
  $stmt = $connection->prepare("SELECT id, email, password, verified_email, action, name, position FROM brgy_users WHERE email = ?");
  if (!$stmt) {
    error_log("Prepare failed: " . $connection->error);
    http_response_code(500);
    echo json_encode(["error" => "Database query error."]);
    $connection->close();
    exit;
  }
  
  $stmt->bind_param("s", $email);
  $stmt->execute();
  $result = $stmt->get_result();
  
  if ($result && $row = $result->fetch_assoc()) {
    error_log("User found: " . $row['email'] . ", Verified: " . $row['verified_email'] . ", Action: " . ($row['action'] ?? 'null'));
    
    // Log raw password hash from database
    $rawPassword = $row['password'] ?? '';
    error_log("Raw password from DB (type): " . gettype($rawPassword));
    error_log("Raw password from DB (length): " . strlen($rawPassword));
    error_log("Raw password from DB (first 50 chars): " . substr($rawPassword, 0, 50));
    error_log("Raw password from DB (full): " . $rawPassword); // Show full hash for debugging
    
    error_log("Password verification attempt with length: " . strlen($password));
    error_log("Input password: " . $password);
    
    // Check if account is verified
    if (intval($row['verified_email']) !== 1) {
      error_log("Login failed: Email not verified for " . $row['email']);
      try {
        logFailedLoginAttempt($email, 'email_not_verified', $row);
      } catch (Exception $e) {
        error_log("Audit login_failed: " . $e->getMessage());
      }
      http_response_code(403);
      echo json_encode(["error" => "Please verify your email first. Check your email for the verification link."]);
      $connection->close();
      exit;
    }
    
    // Check if account action is accepted (user set action ENUM to 'accepted', 'denied')
    $action = $row['action'] ?? null;
    $actionLower = $action !== null ? strtolower(trim($action)) : '';
    if ($actionLower !== 'accepted') {
      error_log("Login failed: Account not accepted for " . $row['email'] . ", action: " . ($action ?? 'NULL'));
      try {
        logFailedLoginAttempt($email, 'account_not_accepted', $row);
      } catch (Exception $e) {
        error_log("Audit login_failed: " . $e->getMessage());
      }
      http_response_code(403);
      $errorMsg = "Your account is pending approval. Please contact administrator.";
      if ($action === null || $action === '' || $actionLower === 'pending') {
        $errorMsg = "Your account is pending approval. Please contact administrator.";
      } elseif ($actionLower === 'denied') {
        $errorMsg = "Your account has been denied. Please contact administrator.";
      } elseif ($actionLower === 'deactivated') {
        $errorMsg = "Your account has been deactivated. Please contact administrator.";
      }
      echo json_encode(["error" => $errorMsg]);
      $connection->close();
      exit;
    }

    // Get stored password hash from database
    $storedPasswordHash = $row['password'] ?? '';
    if (empty($storedPasswordHash)) {
      error_log("Login failed: No password found for " . $row['email']);
      try {
        logFailedLoginAttempt($email, 'no_password_set', $row);
      } catch (Exception $e) {
        error_log("Audit login_failed: " . $e->getMessage());
      }
      http_response_code(401);
      echo json_encode(["error" => "Password not set. Please reset your password."]);
      $connection->close();
      exit;
    }
    
    // Trim stored hash only (don't trim input password - password_verify handles this)
    $storedPasswordHash = trim($storedPasswordHash);
    $inputPassword = $password; // Don't trim input - user might intentionally have leading/trailing spaces
    
    // Check if stored password is hashed (starts with $2y$, $2a$, or $2b$)
    $isHashed = (strpos($storedPasswordHash, '$2y$') === 0 || 
                 strpos($storedPasswordHash, '$2a$') === 0 || 
                 strpos($storedPasswordHash, '$2b$') === 0);
    
    if ($isHashed) {
      // Password is hashed - MUST use password_verify() 
      // Check if hash is complete (bcrypt hashes should be exactly 60 characters)
      if (strlen($storedPasswordHash) !== 60) {
        error_log("WARNING: Hash length is " . strlen($storedPasswordHash) . " (expected 60). Database column might be too short!");
      }
      
      // Verify using password_verify() - this is the ONLY correct way for hashed passwords
      // password_verify() will return FALSE if:
      // 1. Hash doesn't match the password
      // 2. Hash is corrupted/truncated
      // 3. Hash format is invalid
      $passwordValid = password_verify($inputPassword, $storedPasswordHash);
      
      if (!$passwordValid) {
        error_log("Password verification FAILED for hashed password");
        error_log("Hash length: " . strlen($storedPasswordHash));
        error_log("Hash FULL VALUE: " . $storedPasswordHash);
        error_log("Hash preview (first 30 chars): " . substr($storedPasswordHash, 0, 30));
        error_log("Input password: " . $inputPassword);
        error_log("Input password length: " . strlen($inputPassword));
        
        // Check if hash is valid format
        if (substr($storedPasswordHash, 0, 4) !== '$2y$' && 
            substr($storedPasswordHash, 0, 4) !== '$2a$' && 
            substr($storedPasswordHash, 0, 4) !== '$2b$') {
          error_log("CRITICAL: Hash format is invalid! Does not start with $2y$, $2a$, or $2b$");
        }
        
        // Check if hash is truncated - if so, that's the problem!
        $isTruncated = strlen($storedPasswordHash) !== 60;
        if ($isTruncated) {
          error_log("CRITICAL: Hash is truncated! Length: " . strlen($storedPasswordHash) . ", Expected: 60");
        }
        
        // Check if hash contains all zeros (corrupted)
        if (strpos($storedPasswordHash, '0000000000000000000000') !== false) {
          error_log("CRITICAL: Hash appears corrupted! Contains many zeros.");
        }
      }
    } else {
      // Password is plain text - do direct comparison (backward compatibility)
      $passwordValid = ($storedPasswordHash === $inputPassword);
    }
    
    if ($passwordValid) {
      // Update last_login timestamp and set online_offline to 'online' using prepared statement
      $now = date('Y-m-d H:i:s');
      $updateStmt = $connection->prepare("UPDATE brgy_users SET last_login = ?, online_offline = 'online' WHERE email = ?");
      $updateStmt->bind_param("ss", $now, $email);
      $updateStmt->execute();
      $updateStmt->close();
      
      // Set session variables
      $_SESSION['user_id'] = $row['email'];
      $_SESSION['user_name'] = $row['name'];
      $_SESSION['position'] = $row['position'];
      $_SESSION['logged_in'] = true;
      $_SESSION['login_time'] = time(); // Store login timestamp for calculating hours
      $_SESSION['last_activity'] = time(); // Track last activity to prevent timeout during active use
      
      // Log audit trail for login (actor from DB row so INSERT is reliable even if session keys differ)
      try {
          logAuditTrail(
              'login',
              'auth',
              "{$row['name']} accessed system",
              [
                  'user_id' => $row['id'],
                  'position' => $row['position'] ?? null
              ],
              $row['id'],
              'user',
              null,
              null,
              [
                  'email' => $row['email'],
                  'name' => $row['name'],
                  'position' => $row['position'] ?? null,
                  'user_id' => (int)$row['id'],
              ]
          );
      } catch (Exception $e) {
          error_log("Error logging audit trail: " . $e->getMessage());
      }
      
      echo json_encode([
        "ok" => true, 
        "message" => "Login successful", 
        "name" => $row['name'],
        "position" => $row['position']
      ]);
    } else {
      error_log("Login failed: Password verification failed for " . $row['email']);
      try {
        logFailedLoginAttempt($email, 'invalid_password', $row);
      } catch (Exception $e) {
        error_log("Audit login_failed: " . $e->getMessage());
      }
      http_response_code(401);
      
      // Return debug info to help diagnose the issue
      $debugInfo = [];
      if (isset($isHashed) && $isHashed) {
        $debugInfo = [
          "hash_length" => strlen($storedPasswordHash),
          "expected_length" => 60,
          "is_truncated" => strlen($storedPasswordHash) !== 60,
          "hash_preview" => substr($storedPasswordHash, 0, 30) . "...",
          "input_password_length" => strlen($inputPassword),
          "password_format" => "hashed"
        ];
        
        // If truncated, add warning
        if (strlen($storedPasswordHash) !== 60) {
          $debugInfo["warning"] = "Hash is truncated! Database column might be too short. Need to ALTER TABLE brgy_users MODIFY password VARCHAR(255);";
        }
      } else {
        $debugInfo = [
          "password_format" => "plain_text",
          "stored_length" => strlen($storedPasswordHash),
          "input_length" => strlen($inputPassword)
        ];
      }
      
      echo json_encode([
        "error" => "Invalid email or password. Please check your credentials or reset your password.",
        "debug" => $debugInfo
      ]);
    }
  } else {
    try {
      logFailedLoginAttempt($email, 'unknown_email', null);
    } catch (Exception $e) {
      error_log("Audit login_failed: " . $e->getMessage());
    }
    http_response_code(404);
    echo json_encode(["error" => "Account not found. Please check your email or register first."]);
  }

  if (isset($stmt)) {
    $stmt->close();
  }
  $connection->close();
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["error" => "An unexpected error occurred. Please try again."]);
  if (isset($connection)) {
    $connection->close();
  }
}
?>


