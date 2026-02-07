<?php
require "config.php";

try {
    $mysqli = getDatabaseConnection();
    
    $tables = [
        'registration_logs',
        'resident_information'
    ];
    
    foreach ($tables as $table) {
        echo "Columns for $table:\n";
        $res = $mysqli->query("SHOW COLUMNS FROM $table");
        if (!$res) {
            echo "  query failed: " . $mysqli->error . "\n";
            continue;
        }
        while ($row = $res->fetch_assoc()) {
            echo "  " . $row['Field'] . "\n";
        }
        echo "\n";
    }
    
    $mysqli->close();
} catch (Exception $e) {
    echo "Database connection failed: " . $e->getMessage() . PHP_EOL;
    exit(1);
}
?>

