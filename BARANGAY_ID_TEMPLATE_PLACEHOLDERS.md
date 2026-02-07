# Barangay ID PowerPoint Template Placeholders

## Overview
This document lists all the placeholders that should be used in the PowerPoint template (`BRGY.-ID.pptx`) to ensure proper data replacement when generating Barangay ID documents.

## Front Side Placeholders

### Personal Information
- `{{FULL_NAME}}` - Complete name (First + Middle + Last)
- `{{FIRST_NAME}}` - Given name only
- `{{MIDDLE_NAME}}` - Middle name only  
- `{{LAST_NAME}}` - Surname only
- `{{ADDRESS}}` - Complete address
- `{{BIRTH_DATE}}` - Birth date (formatted as "MMM DD, YYYY")
- `{{BID_NUMBER}}` - Barangay ID number (format: "2025-XXXX")

## Back Side Placeholders

### Personal Details
- `{{GENDER}}` - Gender (MALE/FEMALE)
- `{{HEIGHT}}` - Height in CM
- `{{WEIGHT}}` - Weight in KLS
- `{{NATIONALITY}}` - Nationality (default: FILIPINO)
- `{{CIVIL_STATUS}}` - Civil status (SINGLE/MARRIED/WIDOW)

### Contact Information
- `{{CONTACT_NUMBER}}` - Contact number
- `{{EMERGENCY_CONTACT_NAME}}` - Emergency contact person name
- `{{EMERGENCY_CONTACT_NUMBER}}` - Emergency contact number
- `{{EMERGENCY_CONTACT_FULL}}` - Full emergency contact (Name - Number)

### Dates
- `{{DATE_ISSUED}}` - Date when ID was issued (current date)
- `{{EXP_DATE}}` - Expiration date (1 year from issue date)
- `{{CURRENT_DATE}}` - Current date
- `{{CURRENT_YEAR}}` - Current year

### Additional Information
- `{{RESIDENCY_DURATION}}` - How long living in barangay
- `{{IS_CENSUSED}}` - Census status (YES/NO)
- `{{VALID_ID}}` - Type of valid ID provided

### Official Information
- `{{OFFICIAL_NAME}}` - Official's name (ROSEMARIE M. CAPA)
- `{{OFFICIAL_TITLE}}` - Official's title (PUNONG BARANGAY)

## Template Design Requirements

### Front Side Layout
1. **Header**: "BARANGAY HALL OF BIGTE"
2. **Seal**: Circular seal with "BARANGAY BIGTE" and emblem
3. **Photo Area**: Placeholder for resident photo
4. **BID Number**: Format "BID #: 2025-XXXX"
5. **Personal Info**: NAME, BIRTHDAY, ADDRESS with underlined fields
6. **Signature Line**: "SIGNATURE" label
7. **Philippine Flag Banner**: Bottom banner with flag colors

### Back Side Layout
1. **Personal Details Grid**: GENDER, HEIGHT, NATIONALITY, DATE ISSUED
2. **Status Info**: CIVIL STATUS, CONTACT NUMBER, WEIGHT
3. **Emergency Contact**: Person and contact number
4. **Expiration Date**: "EXP. DATE: MMM DD, YYYY"
5. **Official Section**: Signature line with official name and title
6. **Official Photo**: Placeholder for official photo
7. **Philippine Flag Banner**: Bottom banner

## Data Formatting Rules

### Text Formatting
- All text should be in UPPERCASE
- Names should be properly formatted (First Middle Last)
- Dates should be in "MMM DD, YYYY" format
- Numbers should include appropriate units (CM, KLS)

### Default Values
- Nationality: "FILIPINO" (if not specified)
- Date Issued: Current date
- Expiration: 1 year from issue date
- BID Number: "2025-" + padded ID number

## Template File Location
- Template: `brgy_forms/BRGY.-ID.pptx`
- Output: `uploads/generated_documents/BRGY_ID_[Name]_[Date].pptx`

## Usage Example
When a user clicks "Process" on a Barangay ID request:
1. System fetches user data from database
2. Replaces all placeholders with actual data
3. Generates new PowerPoint file
4. Updates request status to "Processing"
5. Provides download link for generated document

## Notes
- All placeholders are case-sensitive
- Use double curly braces: `{{PLACEHOLDER}}`
- Ensure template maintains exact design as shown in preview
- Test with sample data to verify all placeholders work correctly
