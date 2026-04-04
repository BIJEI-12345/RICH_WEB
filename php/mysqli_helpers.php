<?php
/**
 * Fetch one row as associative array from a prepared statement after execute().
 * Uses get_result() when mysqlnd is available; otherwise bind_result() + metadata.
 */
function rich_mysqli_stmt_fetch_assoc(mysqli_stmt $stmt): ?array
{
    if (method_exists($stmt, 'get_result')) {
        $res = $stmt->get_result();
        if (!$res) {
            return null;
        }
        $row = $res->fetch_assoc();
        return $row !== null ? $row : null;
    }

    $meta = $stmt->result_metadata();
    if (!$meta) {
        return null;
    }

    $row = [];
    $params = [];
    while ($field = $meta->fetch_field()) {
        $params[] = &$row[$field->name];
    }
    call_user_func_array([$stmt, 'bind_result'], $params);

    if (!$stmt->fetch()) {
        $meta->free();
        return null;
    }

    $meta->free();
    $out = [];
    foreach ($row as $k => $v) {
        $out[$k] = $v;
    }
    return $out;
}
