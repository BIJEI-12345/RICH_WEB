<?php
require_once __DIR__ . '/mysqli_helpers.php';

// Load environment variables from .env file
function loadEnv($filePath) {
    if (!file_exists($filePath)) {
        error_log("Warning: .env file not found at: $filePath");
        return false;
    }
    
    if (!is_readable($filePath)) {
        error_log("Warning: .env file is not readable at: $filePath");
        return false;
    }
    
    $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        error_log("Warning: Failed to read .env file at: $filePath");
        return false;
    }
    
    foreach ($lines as $lineNum => $line) {
        $line = trim($line);
        
        // Skip empty lines and comments
        if (empty($line) || strpos($line, '#') === 0) {
            continue;
        }
        
        // Parse KEY=VALUE format
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            
            // Remove quotes if present
            if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
                (substr($value, 0, 1) === "'" && substr($value, -1) === "'")) {
                $value = substr($value, 1, -1);
            }
            
            // Apply .env so project settings win (fixes XAMPP/Windows when empty vars are preset)
            if (!empty($key)) {
                putenv("$key=$value");
                $_ENV[$key] = $value;
            }
        }
    }
    
    return true;
}

// Load .env file from project root
$envPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
loadEnv($envPath);

/**
 * Read a value from .env after loadEnv(). Prefer $_ENV (reliable on Windows/XAMPP); then getenv().
 */
function rich_env(string $key, ?string $default = null): string
{
    if (array_key_exists($key, $_ENV)) {
        return (string) $_ENV[$key];
    }
    $g = getenv($key);
    if ($g !== false) {
        return (string) $g;
    }
    return (string) ($default ?? '');
}

// Database configuration - Load from .env (use rich_env: getenv() is unreliable after putenv() on many Linux PHP-FPM setups)
define('DB_HOST', rich_env('DB_HOST_AWS', 'rich.cmxcoo6yc8nh.us-east-1.rds.amazonaws.com'));
define('DB_PORT', rich_env('DB_PORT_AWS', '3306'));
define('DB_USER', rich_env('DB_USER_AWS', 'admin'));
define('DB_PASS', rich_env('DB_PASS_AWS', '4mazonb33j4y!'));
define('DB_NAME', rich_env('DB_NAME_AWS', 'rich_db'));

// Function to get database connection (AWS RDS only)
function getDatabaseConnection() {
    try {
        $connection = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);
        if ($connection->connect_error) {
            throw new Exception("Database connection error: " . $connection->connect_error);
        }
        // Set charset to utf8mb4 to ensure proper encoding for password hashes
        $connection->set_charset("utf8mb4");
        // Align MySQL session time with Philippines (audit trail, timestamps)
        @$connection->query("SET time_zone = '+08:00'");
        error_log("Database connected successfully with charset: utf8mb4");
        return $connection;
    } catch (Exception $e) {
        error_log("Database connection failed: " . $e->getMessage());
        throw new Exception("Database connection failed: " . $e->getMessage());
    }
}

// Function to get PDO database connection (AWS RDS only)
function getPDODatabaseConnection() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 10,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        $pdo->setAttribute(PDO::MYSQL_ATTR_INIT_COMMAND, "SET NAMES utf8mb4");
        $pdo->exec("SET time_zone = '+08:00'");
        error_log("PDO database connected successfully");
        return $pdo;
    } catch (PDOException $e) {
        error_log("PDO database connection failed: " . $e->getMessage());
        throw new Exception("PDO Database connection failed: " . $e->getMessage());
    }
}


// Timezone configuration - Load from .env
define('DEFAULT_TIMEZONE', rich_env('APP_TIMEZONE', 'Asia/Manila'));
// Set default timezone to Philippine time
date_default_timezone_set(DEFAULT_TIMEZONE);

// Application settings - Load from .env
define('APP_NAME', rich_env('APP_NAME', 'Barangay Bigte'));
define('APP_VERSION', '1.0.0');

// File upload settings
define('UPLOAD_DIR', 'uploads/');
define('MAX_FILE_SIZE', 5 * 1024 * 1024); // 5MB

// Email settings - Load from .env (use rich_env for Windows/XAMPP)
define('SMTP_HOST', rich_env('SMTP_HOST', 'smtp.gmail.com'));
define('SMTP_PORT', (int) rich_env('SMTP_PORT', '587'));
define('SMTP_USERNAME', rich_env('SMTP_USERNAME', ''));
define('SMTP_PASSWORD', rich_env('SMTP_PASSWORD', ''));
define('SMTP_FROM_EMAIL', rich_env('SMTP_FROM_EMAIL', ''));
define('SMTP_FROM_NAME', rich_env('SMTP_FROM_NAME', 'RICH Bigte'));
// Set SMTP_SSL_VERIFY=false in .env if local XAMPP fails TLS (see php error log)
$sslVerifyEnv = rich_env('SMTP_SSL_VERIFY', '');
if ($sslVerifyEnv !== '') {
    define('SMTP_SSL_VERIFY', filter_var($sslVerifyEnv, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) !== false);
} else {
    define('SMTP_SSL_VERIFY', true);
}
define('SMTP_DEBUG', (int) rich_env('SMTP_DEBUG', '0'));

// Minimum seconds between signup OTP resend requests (session + server enforced)
define('SIGNUP_OTP_RESEND_COOLDOWN_SEC', 60);

// Groq AI API settings for risk assessment and similarity analysis (Concern's Department)
// Load from .env file, fallback to empty string if not set
$groqApiKey = rich_env('GROQ_API_KEY', '');
if (empty($groqApiKey)) {
    error_log("Warning: GROQ_API_KEY is not set in .env file");
}
define('GROQ_API_KEY', $groqApiKey);

// Google Vision API settings for signature detection
// Load from .env file, fallback to default key if not set
$googleVisionApiKey = rich_env('GOOGLE_VISION_API_KEY', 'AIzaSyAy07Us2x_47apERSvCfPT5gHRsrrXrhjs');
if (empty($googleVisionApiKey)) {
    error_log("Warning: GOOGLE_VISION_API_KEY is not set in .env file, using default key");
}
define('GOOGLE_VISION_API_KEY', $googleVisionApiKey);

/**
 * Ensure barangay_id_forms.height is VARCHAR for values like 5'8 (no "cm"/"foot" in stored data).
 */
function ensure_barangay_id_height_varchar(mysqli $connection) {
    $t = @$connection->query("SHOW TABLES LIKE 'barangay_id_forms'");
    if (!$t || $t->num_rows === 0) {
        return;
    }
    $r = @$connection->query("SHOW COLUMNS FROM barangay_id_forms LIKE 'height'");
    if (!$r) {
        return;
    }
    if ($r->num_rows === 0) {
        @$connection->query("ALTER TABLE barangay_id_forms ADD COLUMN height VARCHAR(20) NULL");
        return;
    }
    $row = $r->fetch_assoc();
    $type = strtolower($row['Type'] ?? '');
    if (preg_match('/^(varchar|char)\(/i', $type)) {
        return;
    }
    if (!$connection->query("ALTER TABLE barangay_id_forms MODIFY COLUMN height VARCHAR(20) NULL")) {
        error_log('ensure_barangay_id_height_varchar: MODIFY failed: ' . $connection->error);
    }
}

/** Strip accidental unit suffixes from height for API/UI (DB should hold e.g. 5'8 only). */
function normalize_barangay_id_height_string($value) {
    if ($value === null || $value === '') {
        return '';
    }
    $s = trim((string) $value);
    return trim(preg_replace('/\s*(cm|CM|foot|feet|ft\.?)\s*$/i', '', $s));
}
?>
