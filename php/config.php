<?php
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

// PostgreSQL — only from project root .env (no credentials in source).
define('POSTGRES_HOST', rich_env('POSTGRES_HOST'));
define('POSTGRES_PORT', rich_env('POSTGRES_PORT', '5432'));
define('POSTGRES_DATABASE', rich_env('POSTGRES_DATABASE', 'postgres'));
define('POSTGRES_USER', rich_env('POSTGRES_USER', 'postgres'));
$postgresPassword = rich_env('POSTGRES_PASSWORD');
// Keep the password fallback for existing local .env files; database connections are PostgreSQL-only.
define('POSTGRES_PASSWORD', $postgresPassword !== '' ? $postgresPassword : rich_env('DB_PASS_AWS'));

function getPostgreSQLDatabaseConnection(): PDO
{
    if (trim(POSTGRES_HOST) === '' || trim(POSTGRES_USER) === '' || trim(POSTGRES_DATABASE) === '' || POSTGRES_PASSWORD === '') {
        throw new Exception('PostgreSQL is not configured. Set POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DATABASE, POSTGRES_USER, and POSTGRES_PASSWORD in the project root .env.');
    }

    $dsn = 'pgsql:host=' . POSTGRES_HOST . ';port=' . POSTGRES_PORT . ';dbname=' . POSTGRES_DATABASE . ';sslmode=require';

    try {
        return new PDO($dsn, POSTGRES_USER, POSTGRES_PASSWORD, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 10,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (PDOException $e) {
        error_log('PostgreSQL connection failed: ' . $e->getMessage());
        throw new Exception('PostgreSQL connection failed: ' . $e->getMessage(), 0, $e);
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

// Resend email settings — secrets and the verified sender address belong in .env.
define('RESEND_API_KEY', trim(rich_env('RESEND_API_KEY', '')));
define('RESEND_FROM_EMAIL', trim(rich_env('RESEND_FROM_EMAIL', '')));
define('RESEND_FROM_NAME', trim(rich_env('RESEND_FROM_NAME', APP_NAME)));

// Minimum seconds between signup OTP resend requests (session + server enforced)
define('SIGNUP_OTP_RESEND_COOLDOWN_SEC', 60);

// Groq AI API settings for risk assessment and similarity analysis (Concern's Department)
// Load from .env file, fallback to empty string if not set
$groqApiKey = rich_env('GROQ_API_KEY', '');
if (empty($groqApiKey)) {
    error_log("Warning: GROQ_API_KEY is not set in .env file");
}
define('GROQ_API_KEY', $groqApiKey);

// Groq key para sa AI interpretation ng Emergency Reports (analytics + emergency page) — opsyonal na hiwalay sa concerns
$emergencyGraphGroqKey = trim(rich_env('EMERGENCY_GRAPH_GROQ_API_KEY', ''));
define('EMERGENCY_GRAPH_GROQ_API_KEY', $emergencyGraphGroqKey);
// Mula sa .env: unahin ang EMERGENCY_GRAPH_GROQ_API_KEY; kung blanko, fallback sa GROQ_API_KEY
$groqEmergencyResolved = $emergencyGraphGroqKey !== '' ? $emergencyGraphGroqKey : trim($groqApiKey);
define('GROQ_API_KEY_EMERGENCY', $groqEmergencyResolved);

// Census Analytics (Groq) — hiwalay na key bawat Demographic; .env: GROQ_API_KEY_CENSUS_* (tingnan ang komento doon)
define('GROQ_API_KEY_CENSUS_SENIOR_CITIZENS', trim(rich_env('GROQ_API_KEY_CENSUS_SENIOR_CITIZENS', '')));
define('GROQ_API_KEY_CENSUS_WIDOWED', trim(rich_env('GROQ_API_KEY_CENSUS_WIDOWED', '')));
define('GROQ_API_KEY_CENSUS_EMPLOYED', trim(rich_env('GROQ_API_KEY_CENSUS_EMPLOYED', '')));
define('GROQ_API_KEY_CENSUS_UNEMPLOYED', trim(rich_env('GROQ_API_KEY_CENSUS_UNEMPLOYED', '')));
define('GROQ_API_KEY_CENSUS_STUDENTS', trim(rich_env('GROQ_API_KEY_CENSUS_STUDENTS', '')));
define('GROQ_API_KEY_CENSUS_PWD', trim(rich_env('GROQ_API_KEY_CENSUS_PWD', '')));
define('GROQ_API_KEY_CENSUS_INDIGENOUS', trim(rich_env('GROQ_API_KEY_CENSUS_INDIGENOUS', '')));

// Sentiment Analysis (Concerns.statement text mining)
define('SENTIMENT_ANALYSIS_API_KEY', trim(rich_env('SENTIMENT_ANALYSIS_API_KEY', '')));

/**
 * Ensure barangay_id_forms.height is VARCHAR for values like 5'8 (no "cm"/"foot" in stored data).
 */
function ensure_barangay_id_height_varchar(PDO $connection): void {
    if (!$connection->query("SELECT to_regclass('public.barangay_id_forms')")->fetchColumn()) {
        return;
    }
    $stmt = $connection->prepare(
        "SELECT data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'barangay_id_forms' AND column_name = 'height'"
    );
    $stmt->execute();
    $type = $stmt->fetchColumn();
    if ($type === false) {
        $connection->exec("ALTER TABLE barangay_id_forms ADD COLUMN height VARCHAR(20) NULL");
        return;
    }
    if (in_array(strtolower((string) $type), ['character varying', 'character'], true)) {
        return;
    }
    $connection->exec("ALTER TABLE barangay_id_forms ALTER COLUMN height TYPE VARCHAR(20) USING height::text");
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
