<?php
require "config.php";

try {
    $pdo = getPostgreSQLDatabaseConnection();
    
    $tables = [
        'registration_logs',
        'resident_information'
    ];
    
    foreach ($tables as $table) {
        echo "Columns for $table:\n";
        $stmt = $pdo->prepare(
            'SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ? ORDER BY ordinal_position'
        );
        $stmt->execute([$table]);
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $column) {
            echo "  " . $column . "\n";
        }
        echo "\n";
    }
    
    $pdo = null;
} catch (Exception $e) {
    echo "Database connection failed: " . $e->getMessage() . PHP_EOL;
    exit(1);
}
?>
