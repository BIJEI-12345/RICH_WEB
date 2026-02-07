# Indigency Certificate Template Placeholders

## Overview
This document lists all the placeholders that should be used in the Indigency certificate template (`Indigency_new.docx`) to ensure proper data replacement when generating Indigency certificates.

## Certificate Content Placeholders

### Personal Information
- `{{FULL_NAME}}` - Complete name (First + Middle + Last)
- `{{FIRST_NAME}}` - Given name only
- `{{MIDDLE_NAME}}` - Middle name only  
- `{{LAST_NAME}}` - Surname only
- `{{AGE}}` - Age in years
- `{{GENDER}}` - Gender (MALE/FEMALE)
- `{{CIVIL_STATUS}}` - Civil status (SINGLE/MARRIED/WIDOW)
- `{{BIRTHDAY}}` - Birth date (formatted as "MMMM DD, YYYY")
- `{{BIRTH_PLACE}}` - Place of birth
- `{{ADDRESS}}` - Complete address

### Certificate Details
- `{{PURPOSE}}` - Purpose of the certificate
- `{{CERTIFICATE_DATE}}` - Date when certificate was issued (current date)
- `{{CURRENT_DATE}}` - Current date
- `{{CURRENT_YEAR}}` - Current year

### Official Information
- `{{OFFICIAL_NAME}}` - Official's name (ROSEMARIE M. CAPA)
- `{{OFFICIAL_TITLE}}` - Official's title (PUNONG BARANGAY)

## Template Design Requirements

### Certificate Layout
1. **Header**: "BARANGAY HALL OF BIGTE"
2. **Seal**: Circular seal with "BARANGAY BIGTE" and emblem
3. **Title**: "CERTIFICATE OF INDIGENCY"
4. **Content**: Formal certificate text with placeholders
5. **Signature Section**: Signature line with official name and title
6. **Philippine Flag Banner**: Bottom banner with flag colors

### Certificate Text Format
```
TO WHOM IT MAY CONCERN:

This is to certify that [FULL_NAME], [AGE] years old, [GENDER], [CIVIL_STATUS], Filipino citizen, born on [BIRTHDAY] at [BIRTH_PLACE], and residing at [ADDRESS], is a bonafide resident of this Barangay.

This certification is being issued upon the request of the above-named person for [PURPOSE] purposes only.

Given this [CERTIFICATE_DATE] at Barangay Bigte, Norzagaray, Bulacan.

[SIGNATURE LINE]
ROSEMARIE M. CAPA
PUNONG BARANGAY
```

## Data Formatting Rules

### Text Formatting
- All text should be in UPPERCASE
- Names should be properly formatted (First Middle Last)
- Dates should be in "MMMM DD, YYYY" format
- Age should be numeric with "years old"

### Default Values
- Certificate Date: Current date
- Official Name: "ROSEMARIE M. CAPA"
- Official Title: "PUNONG BARANGAY"

## Template File Location
- Template: `brgy_forms/Indigency_new.docx`
- Output: `uploads/generated_documents/INDIGENCY_[Name]_[Date].docx`

## Usage Example
When a user clicks "Process" on an Indigency request:
1. System fetches user data from database
2. Shows preview with populated certificate text
3. Replaces all placeholders with actual data
4. Generates new Word document
5. Updates request status to "Processing"
6. Provides download link for generated certificate

## Notes
- All placeholders are case-sensitive
- Use double curly braces: `{{PLACEHOLDER}}`
- Ensure template maintains exact design as shown in preview
- Test with sample data to verify all placeholders work correctly
- The preview form shows exactly how the final certificate will look
