<?php
function rich_resend_send_email(string $to, string $subject, string $html, string $plain): bool
{
    if (RESEND_API_KEY === '' || RESEND_FROM_EMAIL === '') {
        error_log('Resend is not configured: set RESEND_API_KEY and a verified RESEND_FROM_EMAIL in .env');
        return false;
    }

    if (filter_var(RESEND_FROM_EMAIL, FILTER_VALIDATE_EMAIL) === false) {
        error_log('Resend email failed: RESEND_FROM_EMAIL must be a sender email address, not just a domain or display name');
        return false;
    }

    if (!function_exists('curl_init')) {
        error_log('Resend email failed: PHP cURL extension is not enabled');
        return false;
    }

    $from = RESEND_FROM_NAME !== ''
        ? RESEND_FROM_NAME . ' <' . RESEND_FROM_EMAIL . '>'
        : RESEND_FROM_EMAIL;
    $body = json_encode([
        'from' => $from,
        'to' => [$to],
        'subject' => $subject,
        'html' => $html,
        'text' => $plain,
    ], JSON_UNESCAPED_UNICODE);

    if ($body === false) {
        error_log('Resend email failed: could not encode request');
        return false;
    }

    $curl = curl_init('https://api.resend.com/emails');
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . RESEND_API_KEY,
            'Content-Type: application/json',
            'Accept: application/json',
        ],
        CURLOPT_POSTFIELDS => $body,
    ]);

    $response = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);

    if ($response === false || $status < 200 || $status >= 300) {
        $errorData = is_string($response) ? json_decode($response, true) : null;
        $apiMessage = is_array($errorData) ? (string) ($errorData['message'] ?? '') : '';
        error_log('Resend email failed: ' . ($curlError !== '' ? $curlError : 'HTTP ' . $status . ($apiMessage !== '' ? ' - ' . $apiMessage : '')));
        return false;
    }

    return true;
}