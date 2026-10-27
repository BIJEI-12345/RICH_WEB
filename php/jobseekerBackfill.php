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
    $connection = getPostgreSQLDatabaseConnection();

    // Align is_permanent with purpose (jobseeker = permanent retention)
    $connection->query(
        "UPDATE certification_forms SET is_permanent = CASE WHEN LOWER(TRIM(COALESCE(purpose,''))) = 'jobseeker' THEN 1 ELSE 0 END"
    );

    // Get all finished jobseeker certifications that might not yet be in job_seeker_report
    $sql = "SELECT * FROM certification_forms WHERE LOWER(purpose) = 'jobseeker' AND status = 'Finished'";
    $result = $connection->query($sql);

    $inserted = 0;
    $skippedExisting = 0;
    $errors = [];

    while ($certData = $result->fetch(PDO::FETCH_ASSOC)) {
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
        $firstNameAlt = isset($certData['firstname']) ? $certData['firstname'] : '';
        $lastNameAlt = isset($certData['lastname']) ? $certData['lastname'] : '';

        $checkStmt->execute([
            $firstName,
            $firstNameAlt,
            $lastName,
            $lastNameAlt,
            $birthDate
        ]);
        if ($existingRow = $checkStmt->fetch(PDO::FETCH_ASSOC)) {
            // If record already exists, optionally update missing sex/education/course
            $existingId = (int)$existingRow['id'];
            $skippedExisting++;

            // If sex is NULL or empty in existing row, update it from current data
            $updateNeeded = false;
            $updateSqlParts = [];
            $updateParams = [];

            // We can't see existing row's columns here without another query,
            // so perform a dedicated select to check current sex value.
            $curStmt = $connection->prepare("SELECT sex FROM job_seeker_report WHERE id = ?");
            $curStmt->execute([$existingId]);
            if ($curRow = $curStmt->fetch(PDO::FETCH_ASSOC)) {
                $currentSex = $curRow['sex'] ?? '';
                if (empty($currentSex) && !empty($sex)) {
                    $updateNeeded = true;
                    $updateSqlParts[] = "sex = ?";
                    $updateParams[] = $sex;
                }
            }

            if ($updateNeeded) {
                $updateSql = "UPDATE job_seeker_report SET " . implode(', ', $updateSqlParts) . " WHERE id = ?";
                $updateStmt = $connection->prepare($updateSql);
                $updateParams[] = $existingId;
                $updateStmt->execute($updateParams);
            }

            continue;
        }
        // Compute next sequential number for "no" column (start from 1)
        $no = 1;
        $noSql = "SELECT MAX(no) AS max_no FROM job_seeker_report";
        $noResult = $connection->query($noSql);
        if ($rowNo = $noResult->fetch(PDO::FETCH_ASSOC)) {
            $currentMax = (int)($rowNo['max_no'] ?? 0);
            $no = $currentMax + 1;
        }

        // Insert into job_seeker_report (including no and sex)
        $insertSql = "INSERT INTO job_seeker_report 
                      (no, last_name, first_name, middle_name, sex, age, birth_date, educational_level, course) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $insertStmt = $connection->prepare($insertSql);
        $insertStmt->execute([
            $no,
            $lastName,
            $firstName,
            $middleName,
            $sex,
            $age,
            $birthDate,
            $educationalLevel,
            $course
        ]);
        $inserted++;
    }

    echo json_encode([
        'success' => true,
        'inserted' => $inserted,
        'skipped_existing' => $skippedExisting,
        'errors' => $errors
    ]);

    $connection = null;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

