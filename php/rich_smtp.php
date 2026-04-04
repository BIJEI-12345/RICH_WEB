<?php
/**
 * Shared PHPMailer SMTP settings for OTP mail (signup1, resend_signup_otp, etc.)
 * Requires: vendor/autoload.php, email_config.php (which loads config.php)
 */
use PHPMailer\PHPMailer\PHPMailer;

/**
 * Gmail app passwords are often stored as "xxxx xxxx xxxx xxxx" — spaces break auth.
 */
function rich_smtp_password(): string
{
    return preg_replace('/\s+/', '', (string) SMTP_PASSWORD);
}

function rich_smtp_configured(): bool
{
    $p = rich_smtp_password();
    return trim((string) SMTP_USERNAME) !== ''
        && $p !== ''
        && trim((string) SMTP_FROM_EMAIL) !== '';
}

/**
 * Apply host, auth, TLS/SMTPS, timeouts, debug.
 *
 * @param int $port Override port (465 = SMTPS, 587 = STARTTLS). Use 0 to read SMTP_PORT from config.
 * @param bool $forceRelaxSsl If true, disable peer verification (second pass when strict TLS fails on XAMPP).
 */
function rich_smtp_apply(PHPMailer $mail, int $port = 0, bool $forceRelaxSsl = false): void
{
    if (!rich_smtp_configured()) {
        throw new RuntimeException('SMTP not configured: set SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL in .env');
    }

    if (!extension_loaded('openssl')) {
        error_log('rich_smtp: PHP openssl extension is not enabled — enable extension=openssl in php.ini for SMTP TLS.');
    }

    $port = $port > 0 ? $port : (int) SMTP_PORT;

    $mail->CharSet = 'UTF-8';
    $mail->isSMTP();
    $mail->Host = SMTP_HOST;
    $mail->SMTPAuth = true;
    $mail->AuthType = 'LOGIN';
    $mail->Username = SMTP_USERNAME;
    $mail->Password = rich_smtp_password();

    $mail->Port = $port;
    // 465 = implicit TLS (SMTPS); 587 = STARTTLS (Gmail supports both)
    if ($port === 465) {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->SMTPAutoTLS = false;
    } else {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->SMTPAutoTLS = true;
    }

    $mail->Timeout = 60;

    $relax = $forceRelaxSsl || (defined('SMTP_SSL_VERIFY') && !SMTP_SSL_VERIFY);
    if ($relax) {
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true,
            ],
        ];
    }

    if (defined('SMTP_DEBUG') && SMTP_DEBUG > 0) {
        $mail->SMTPDebug = SMTP_DEBUG;
        $mail->Debugoutput = static function ($str, $level) {
            error_log('PHPMailer SMTP: ' . trim((string) $str));
        };
    }

    $hostLower = strtolower((string) SMTP_HOST);
    if (strpos($hostLower, 'gmail.com') !== false) {
        $from = strtolower(trim((string) SMTP_FROM_EMAIL));
        $user = strtolower(trim((string) SMTP_USERNAME));
        if ($from !== $user) {
            error_log('rich_smtp: For Gmail SMTP, SMTP_FROM_EMAIL should usually match SMTP_USERNAME (both set to the same Gmail address).');
        }
    }
}

/**
 * Port order to try for smtp.gmail.com when the first attempt fails (XAMPP often works with 465 or 587 only).
 *
 * @return int[]
 */
function rich_smtp_gmail_fallback_ports(): array
{
    $primary = (int) SMTP_PORT;
    $candidates = [$primary];
    foreach ([465, 587] as $p) {
        if ($p !== $primary) {
            $candidates[] = $p;
        }
    }
    return array_values(array_unique($candidates));
}

/**
 * Send mail; for smtp.gmail.com retries alternate ports (587 / 465) so OTP reaches the recipient's inbox on XAMPP.
 *
 * @param callable(PHPMailer): void $configure Set From, addAddress, Subject, Body, AltBody, isHTML as needed
 */
function rich_smtp_send_with_gmail_fallback(callable $configure): bool
{
    if (!rich_smtp_configured()) {
        return false;
    }

    $hostLower = strtolower((string) SMTP_HOST);
    $ports = (strpos($hostLower, 'gmail.com') !== false)
        ? rich_smtp_gmail_fallback_ports()
        : [(int) SMTP_PORT];

    $lastErr = '';
    $relaxPasses = [false];
    if (defined('SMTP_SSL_VERIFY') && SMTP_SSL_VERIFY) {
        $relaxPasses[] = true;
    }

    foreach ($relaxPasses as $passIdx => $forceRelax) {
        if ($passIdx === 1) {
            error_log('rich_smtp: retrying SMTP with relaxed SSL (helps XAMPP/Windows TLS)');
        }
        foreach ($ports as $port) {
            $mail = new PHPMailer(true);
            try {
                rich_smtp_apply($mail, $port, $forceRelax);
                $configure($mail);
                $mail->send();
                if ($port !== (int) SMTP_PORT) {
                    error_log("rich_smtp: message sent using fallback port {$port}");
                }
                return true;
            } catch (\Throwable $e) {
                $lastErr = $e->getMessage() . ' | ' . $mail->ErrorInfo;
                error_log("rich_smtp: SMTP attempt port {$port} (relax=" . ($forceRelax ? '1' : '0') . ") failed: " . $lastErr);
            }
        }
    }

    error_log('rich_smtp: all SMTP attempts failed. Last error: ' . $lastErr);
    return false;
}
