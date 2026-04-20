<?php
/**
 * Parse ng Groq reply: strict JSON, markdown fence, o regex fallback.
 * Maiwasan ang paglalagay ng buong JSON string sa interpretation kapag nabigo ang json_decode.
 *
 * @return array{interpretation: string, recommendations: string}
 */
function census_groq_parse_interpretation_response(string $content): array
{
    $content = trim($content);
    if ($content === '') {
        return ['interpretation' => '', 'recommendations' => ''];
    }
    if (preg_match('/^```(?:json)?\s*/i', $content)) {
        $content = preg_replace('/^```(?:json)?\s*/i', '', $content);
        $content = preg_replace('/\s*```\s*$/s', '', $content);
        $content = trim($content);
    }

    $flags = defined('JSON_INVALID_UTF8_SUBSTITUTE') ? JSON_INVALID_UTF8_SUBSTITUTE : 0;
    $decoded = json_decode($content, true, 512, $flags);
    if (is_array($decoded) && (array_key_exists('interpretation', $decoded) || array_key_exists('recommendations', $decoded))) {
        $interp = isset($decoded['interpretation']) ? (string) $decoded['interpretation'] : '';
        $rec = isset($decoded['recommendations']) ? (string) $decoded['recommendations'] : '';
        $interpTrim = trim($interp);
        if ($interpTrim !== '' && substr($interpTrim, 0, 1) === '{' && strpos($interpTrim, '"interpretation"') !== false) {
            $nested = census_groq_parse_interpretation_response($interpTrim);
            if ($nested['interpretation'] !== '' || $nested['recommendations'] !== '') {
                return [
                    'interpretation' => $nested['interpretation'],
                    'recommendations' => ($rec !== '' ? trim($rec) : $nested['recommendations']),
                ];
            }
        }

        return ['interpretation' => trim($interp), 'recommendations' => trim($rec)];
    }

    if (preg_match('/"interpretation"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"\s*,\s*"recommendations"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/us', $content, $m)) {
        $interp = trim(stripcslashes($m[1]));
        $rec = trim(stripcslashes($m[2]));

        return ['interpretation' => $interp, 'recommendations' => $rec];
    }

    return ['interpretation' => '', 'recommendations' => ''];
}
