<?php
require_once __DIR__ . '/php/init_session.php';
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

// Set timezone to Philippine time
date_default_timezone_set('Asia/Manila');

// Handle AJAX login request
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') {
    define('RICH_LOGIN_AJAX', true);
    ob_start();
    register_shutdown_function(function () {
        if (!defined('RICH_LOGIN_AJAX')) {
            return;
        }
        $last = error_get_last();
        if ($last === null) {
            return;
        }
        $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
        if (!in_array((int) $last['type'], $fatalTypes, true)) {
            return;
        }
        $buf = ob_get_contents();
        if ($buf !== false && $buf !== '') {
            error_log('RICH_LOGIN_AJAX fatal with prior output: ' . substr($buf, 0, 2000));
        }
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=UTF-8');
        }
        http_response_code(500);
        echo json_encode(['error' => 'Server error. Please try again.']);
    });

    // Disable error reporting to prevent HTML output
    error_reporting(0);
    ini_set('display_errors', 0);
    
    header('Content-Type: application/json; charset=UTF-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { 
        http_response_code(204); 
        exit; 
    }
    
    try {
        require_once __DIR__ . '/php/mysqli_helpers.php';
        require_once __DIR__ . '/php/config.php';
        require_once __DIR__ . '/php/audit_trail_helper.php';
    } catch (Throwable $e) {
        error_log('Login AJAX bootstrap: ' . $e->getMessage());
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=UTF-8');
        }
        http_response_code(500);
        echo json_encode(['error' => 'Server configuration error. Please try again later.']);
        exit;
    }

    try {
        $connection = getDatabaseConnection();
        $host = $connection->host_info;
        error_log("Connected to database: " . $host);
    } catch (Throwable $e) {
        error_log("Database connection exception: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["error" => "Database connection failed."]); 
        exit;
    }
    
    try {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $email = trim($input['email'] ?? '');
        $password = (string)($input['password'] ?? '');
        
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
        $row = rich_mysqli_stmt_fetch_assoc($stmt);
        
        if ($row) {
            error_log("User found: " . $row['email'] . ", Verified: " . $row['verified_email'] . ", Action: " . ($row['action'] ?? 'null'));
            
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
            
            // Check if account action is accepted
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
            
            // Trim stored hash only
            $storedPasswordHash = trim($storedPasswordHash);
            $inputPassword = $password;
            
            // Check if stored password is hashed
            $isHashed = (strpos($storedPasswordHash, '$2y$') === 0 || 
                         strpos($storedPasswordHash, '$2a$') === 0 || 
                         strpos($storedPasswordHash, '$2b$') === 0);
            
            if ($isHashed) {
                // Password is hashed - use password_verify()
                $passwordValid = password_verify($inputPassword, $storedPasswordHash);
            } else {
                // Password is plain text - do direct comparison (backward compatibility)
                $passwordValid = ($storedPasswordHash === $inputPassword);
            }
            
            if ($passwordValid) {
                // Update last_login timestamp and set online_offline to 'online'
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
                $_SESSION['login_time'] = time();
                $_SESSION['last_activity'] = time();
                
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
                echo json_encode([
                    "error" => "Invalid email or password. Please check your credentials or reset your password."
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
    } catch (Throwable $e) {
        error_log("Login AJAX error: " . $e->getMessage() . " at " . $e->getFile() . ":" . $e->getLine());
        http_response_code(500);
        echo json_encode(["error" => "An unexpected error occurred. Please try again."]);
        if (isset($connection) && $connection instanceof mysqli) {
            $connection->close();
        }
    }
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RICH Login</title>
  <link rel="icon" href="Images/logo_app_2.jpg" type="image/x-icon">
  <link rel="stylesheet" type="text/css" href="Styles/login.css">
  <link rel="stylesheet" type="text/css" href="Styles/media.css">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
</head>
<body>
  <!--<header class="header">
    <h1>Barangay System</h1>
  </header>-->

  <main class="container">
    <nav class="top-info" aria-label="Top info">
      <!--a href="#questions" class="info-link">ABOUT</a-->
      <!--a href="#address" class="info-link">CONTACT US</a-->
    </nav>
      
    <div class="login-card">
      <div class="brand-container">
        <div class="brand-rich-text">
          <h1 class="rich-title">RICH</h1>
          <p class="rich-meaning">Resident Information and Concern Handling</p>
        </div>
      </div>
      <form id="loginForm" method="POST">
        <div class="input-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" placeholder="Email" required>
        </div>        

        <div class="input-group">
          <label for="password">Password</label>
          <div class="password-container">
            <input type="password" id="password" name="password" placeholder="Password" required>
            <button type="button" id="togglePassword" class="toggle-password" onclick="togglePasswordLogin()">
              <span class="password-icon show"></span>
            </button>
          </div>
        </div>
        <p class="forgot-text"><a href="forgotpass.html">Forgot Password?</a></p> 
        
     

        <button type="submit" class="btn">Login</button>
        
        <p class="signup-text">Don't have an account? <a href="signup1.html">Sign up</a></p>
      </form>
    </div>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  <script>
const SLOT_STATUS_ENDPOINT = 'php/signup1.php?slot_status=1';

// Function to toggle password visibility
function togglePasswordLogin() {
  const input = document.getElementById('password');
  const icon = document.querySelector('.password-icon');
  
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('show');
    icon.classList.add('hide');
  } else {
    input.type = 'password';
    icon.classList.remove('hide');
    icon.classList.add('show');
  }
}

// Function to show notification
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = 'success-notification';
  
  let iconClass = 'fas fa-check-circle';
  if (type === 'error') {
    iconClass = 'fas fa-times-circle';
    notification.classList.add('error');
  } else if (type === 'warning') {
    iconClass = 'fas fa-exclamation-triangle';
    notification.classList.add('warning');
  }
  
  notification.innerHTML = `
    <div class="notification-content">
      <i class="${iconClass}"></i>
      <span>${message}</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

function showSuccessNotification(message) {
  showNotification(message, 'success');
}

async function fetchSlotStatus() {
  const response = await fetch(SLOT_STATUS_ENDPOINT, {
    cache: 'no-cache'
  });

  if (!response.ok) {
    throw new Error('Slot status fetch failed');
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || 'Slot status unavailable');
  }

  return data.status ?? {};
}

async function handleSignupLink(event) {
  event.preventDefault();
  const targetUrl = event.currentTarget.href;

  try {
    const status = await fetchSlotStatus();
    if (status.totalFull) {
      const allPositionsHtml = (status.positions ?? [])
        .map(pos => `${pos.position} (${pos.active}/${pos.limit})`)
        .join('<br>');
      await Swal.fire({
        icon: 'warning',
        title: 'Account limit reached',
        html: `All ${status.totalLimit} user slots are occupied. Current slot usage:<br><strong>${allPositionsHtml}</strong>`,
        confirmButtonColor: '#1e40ff'
      });
      return;
    }

    window.location.href = targetUrl;
  } catch (error) {
    console.error('Slot status check failed', error);
    showNotification('Unable to verify slot availability. Redirecting to sign up...', 'warning');
    window.location.href = targetUrl;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const signupLink = document.querySelector('.signup-text a');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  if (signupLink) {
    signupLink.addEventListener('click', handleSignupLink);
  }
  
  function handleEnterKey(e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      
      if (email && password) {
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        loginForm.dispatchEvent(submitEvent);
      } else {
        showNotification('Please fill in all fields', 'error');
      }
    }
  }
  
  if (emailInput) {
    emailInput.addEventListener('keydown', handleEnterKey);
  }
  
  if (passwordInput) {
    passwordInput.addEventListener('keydown', handleEnterKey);
  }
  
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    console.log('Login attempt:', { email, passwordLength: password.length });
    
    if (!email || !password) {
      showNotification('Please fill in all fields', 'error');
      return;
    }
    
    // Send login data to index.php (same file)
    fetch('index.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({
        email: email,
        password: password
      })
    })
    .then(async (response) => {
      console.log('Response status:', response.status);
      const text = await response.text();
      let data = null;
      try {
        const trimmed = text.trim();
        data = trimmed ? JSON.parse(trimmed) : null;
      } catch (parseErr) {
        console.error('Non-JSON response:', text.slice(0, 500));
        throw new Error('Server error (HTTP ' + response.status + '). If this persists, check Apache/PHP logs on the server.');
      }
      return { ok: response.ok, status: response.status, data };
    })
    .then(({ ok, status, data }) => {
      console.log('Response data:', data);
      if (data && data.ok) {
        showSuccessNotification('Login successful! Welcome ' + data.name);
        localStorage.setItem('user_email', email);
        console.log('Login successful for:', data.name, 'Position:', data.position);
        setTimeout(() => {
          const redirectUrl = 'admin-dashboard.html';
          console.log('Redirecting to:', redirectUrl);
          window.location.href = redirectUrl;
        }, 2000);
        return;
      }
      if (data && data.error) {
        showNotification(data.error, 'error');
        return;
      }
      if (!ok) {
        showNotification('Login failed (HTTP ' + status + ').', 'error');
        return;
      }
      showNotification('Login failed', 'error');
    })
    .catch(error => {
      console.error('Error:', error);
      const msg = (error && error.message) ? error.message : 'Network error. Please try again.';
      showNotification(msg, 'error');
    });
  });
});
  </script>
</body>
</html>
