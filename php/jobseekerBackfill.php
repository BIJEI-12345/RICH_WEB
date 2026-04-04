<?php
// One-time/backfill script to populate job_seeker_report
// from existing rows in certification_forms where
// purpose = 'jobseeker' and status = 'Finished'.
//
// Usage (once): open in browser or call via HTTP:
//   http://localhost/RICH/php/jobseekerBackfill.php

require_once 'config.php';

header('Content-Type: application/json');

try {
    $connection = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

    if ($connection->connect_error) {
        throw new Exception('Database connection failed: ' . $connection->connect_error);
    }

    // Get all finished jobseeker certifications that might not yet be in job_seeker_report
    $sql = "SELECT * FROM certification_forms WHERE LOWER(purpose) = 'jobseeker' AND status = 'Finished'";
    $result = $connection->query($sql);

    if ($result === false) {
        throw new Exception('Query failed: ' . $connection->error);
    }

    $inserted = 0;
    $skippedExisting = 0;
    $errors = [];

    while ($certData = $result->fetch_assoc()) {
        $id = (int)($certData['id'] ?? 0);

        $lastName = $certData['last_name'] ?? $certData['lastname'] ?? '';
        $firstName = $certData['first_name'] ?? $certData['firstname'] ?? '';
        $middleName = $certData['middle_name'] ?? $certData['middlename'] ?? '';
        $birthDate = $certData['birth_date'] ?? $certData['birthday'] ?? '';
        $educationalLevel = $certData['educational_level'] ?? $certData['educationalLevel'] ?? $certData['educationallevel'] ?? '';
        $course = $certData['course'] ?? '';

        // Map gender from certification_forms to sex column in job_seeker_report
        $genderRaw = $certData['gender'] ?? '';
        $sex = '';
        if (!empty($genderRaw)) {
            $g = strtolower(trim($genderRaw));
            if (in_array($g, ['male', 'm'], true)) {
                $sex = 'Male';
            } elseif (in_array($g, ['female', 'f'], true)) {
                $sex = 'Female';
            } else {
                $sex = $certData['gender'];
            }
        }

        // Calculate age from birth_date
        $age = 0;
        if (!empty($birthDate) && $birthDate !== '0000-00-00') {
            try {
                $birth = new DateTime($birthDate);
                $today = new DateTime();
                $age = $today->diff($birth)->y;
            } catch (Exception $e) {
                // Ignore age calculation errors; keep age = 0
            }
        }

        // Check if a similar record already exists
        $checkSql = "SELECT id FROM job_seeker_report WHERE 
                     (first_name = ? OR first_name = ?) AND 
                     (last_name = ? OR last_name = ?) AND 
                     birth_date = ?";
        $checkStmt = $connection->prepare($checkSql);
        if (!$checkStmt) {
            $errors[] = "ID $id: Failed to prepare check statement: " . $connection->error;
            continue;
        }

        $firstNameAlt = isset($certData['firstname']) ? $certData['firstname'] : '';
        $lastNameAlt = isset($certData['lastname']) ? $certData['lastname'] : '';

        $checkStmt->bind_param(
            'sssss',
            $firstName,
            $firstNameAlt,
            $lastName,
            $lastNameAlt,
            $birthDate
        );
        $checkStmt->execute();
        $checkResult = $checkStmt->get_result();

        if ($checkResult && $checkResult->num_rows > 0) {
            // If record already exists, optionally update missing sex/education/course
            $existingRow = $checkResult->fetch_assoc();
            $existingId = (int)$existingRow['id'];
            $skippedExisting++;
            $checkStmt->close();

            // If sex is NULL or empty in existing row, update it from current data
            $updateNeeded = false;
            $updateSqlParts = [];
            $updateParams = [];
            $updateTypes = '';

            // We can't see existing row's columns here without another query,
            // so perform a dedicated select to check current sex value.
            $curRowRes = $connection->query("SELECT sex FROM job_seeker_report WHERE id = " . $existingId);
            if ($curRowRes && $curRow = $curRowRes->fetch_assoc()) {
                $currentSex = $curRow['sex'] ?? '';
                if (empty($currentSex) && !empty($sex)) {
                    $updateNeeded = true;
                    $updateSqlParts[] = "sex = ?";
                    $updateParams[] = $sex;
                    $updateTypes .= 's';
                }
            }

            if ($updateNeeded) {
                $updateSql = "UPDATE job_seeker_report SET " . implode(', ', $updateSqlParts) . " WHERE id = ?";
                $updateStmt = $connection->prepare($updateSql);
                if ($updateStmt) {
                    $updateTypes .= 'i';
                    $updateParams[] = $existingId;
                    $updateStmt->bind_param($updateTypes, ...$updateParams);
                    if ($updateStmt->execute()) {
                        // updated
                    } else {
                        $errors[] = "ID $id: Failed to update existing jobseeker record: " . $updateStmt->error;
                    }
                    $updateStmt->close();
                }
            }

            continue;
        }
        $checkStmt->close();

        // Compute next sequential number for "no" column (start from 1)
        $no = 1;
        $noSql = "SELECT MAX(no) AS max_no FROM job_seeker_report";
        $noResult = $connection->query($noSql);
        if ($noResult && $rowNo = $noResult->fetch_assoc()) {
            $currentMax = (int)($rowNo['max_no'] ?? 0);
            $no = $currentMax + 1;
        }

        // Insert into job_seeker_report (including no and sex)
        $insertSql = "INSERT INTO job_seeker_report 
                      (no, last_name, first_name, middle_name, sex, age, birth_date, educational_level, course) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $insertStmt = $connection->prepare($insertSql);
        if (!$insertStmt) {
            $errors[] = "ID $id: Failed to prepare insert statement: " . $connection->error;
            continue;
        }

        $insertStmt->bind_param(
            'issssisss',
            $no,
            $lastName,
            $firstName,
            $middleName,
            $sex,
            $age,
            $birthDate,
            $educationalLevel,
            $course
        );

        if ($insertStmt->execute()) {
            $inserted++;
        } else {
            $errors[] = "ID $id: Insert failed: " . $insertStmt->error;
        }

        $insertStmt->close();
    }

    echo json_encode([
        'success' => true,
        'inserted' => $inserted,
        'skipped_existing' => $skippedExisting,
        'errors' => $errors
    ]);

    $connection->close();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}


