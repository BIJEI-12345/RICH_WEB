<?php
/**
 * Session storage: on Windows/XAMPP, Apache often cannot read/write files in the project
 * `php/sessions` folder (or stale sess_* files have wrong ACLs). Prefer system temp first.
 */
if (!defined('RICH_SESSION_INITIALIZED')) {
    define('RICH_SESSION_INITIALIZED', true);

    /**
     * True if we can create and delete a file in the directory (stronger than is_writable on Windows).
     */
    function rich_session_dir_is_usable($dir) {
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        if (!is_dir($dir)) {
            return false;
        }
        $test = $dir . DIRECTORY_SEPARATOR . '.rich_w' . bin2hex(random_bytes(4));
        if (@file_put_contents($test, '1') === false) {
            return false;
        }
        @unlink($test);
        return true;
    }

    /**
     * Ordered candidate session save paths.
     */
    function rich_session_candidate_dirs() {
        $tmpRich = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'rich_php_sessions';
        $candidates = [];
        if (PHP_OS_FAMILY === 'Windows') {
            $drive = getenv('SystemDrive') ?: 'C:';
            $candidates[] = $tmpRich;
            $candidates[] = $drive . '\\xampp\\tmp\\rich_sessions';
            $candidates[] = $drive . '\\xampp\\tmp';
        }
        $candidates[] = __DIR__ . DIRECTORY_SEPARATOR . 'sessions';
        if (!in_array($tmpRich, $candidates, true)) {
            $candidates[] = $tmpRich;
        }
        return $candidates;
    }

    /**
     * All usable dirs in order (cached).
     */
    function rich_session_usable_dirs() {
        static $cached = null;
        if ($cached !== null) {
            return $cached;
        }
        $cached = [];
        foreach (rich_session_candidate_dirs() as $dir) {
            if (rich_session_dir_is_usable($dir)) {
                $cached[] = $dir;
            }
        }
        if ($cached === []) {
            $fallback = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'rich_php_sessions';
            if ($fallback !== '' && (@mkdir($fallback, 0775, true) || is_dir($fallback)) && rich_session_dir_is_usable($fallback)) {
                $cached[] = $fallback;
            }
        }
        return $cached;
    }

    /**
     * Start session; retry alternate save paths if a sess_* file has bad ACLs (e.g. Windows).
     */
    function rich_session_start() {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return true;
        }
        $dirs = rich_session_usable_dirs();
        foreach ($dirs as $dir) {
            session_save_path($dir);
            @session_start();
            if (session_status() === PHP_SESSION_ACTIVE) {
                return true;
            }
        }
        @session_start();
        return session_status() === PHP_SESSION_ACTIVE;
    }

    $usable = rich_session_usable_dirs();
    if ($usable !== []) {
        session_save_path($usable[0]);
    }
}
