// Global variables
let allCensusData = [];
let filteredCensusData = [];
let censusHouseholds = [];
let currentPage = 1;
const itemsPerPage = 20;
let censusStatistics = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadCensusData();
    const bd = document.getElementById('add_birthday');
    if (bd) {
        bd.addEventListener('change', updateAddAgeFromBirthdate);
        bd.addEventListener('input', updateAddAgeFromBirthdate);
    }
});

// Navigation functions
function goBack() {
    window.location.href = 'admin-dashboard.html';
}

function goToUsers() {
    window.location.href = 'resident-info.html';
}

function goToCensus() {
    window.location.href = 'census.html';
}

// Load census data from API
async function loadCensusData() {
    try {
        const response = await fetch('php/census.php', { credentials: 'same-origin', cache: 'no-store' });
        
        // Check if response is ok
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        
        // Try to parse as JSON
        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Response text:', text.substring(0, 200));
            throw new Error('Invalid JSON response from server');
        }
        
        if (data.success !== false && data.census !== undefined) {
            allCensusData = Array.isArray(data.census) ? data.census : [];
            filteredCensusData = allCensusData;
            censusHouseholds = Array.isArray(data.households) ? data.households : [];
            populateHouseholdSelect();
            
            // Store statistics
            if (data.statistics) {
                censusStatistics = data.statistics;
            }
            
            renderCensusTable();
            
            // Update statistics display
            if (censusStatistics) {
                updateStatistics(censusStatistics);
            }
        } else {
            const errorMsg = data.error || 'Unknown error';
            console.error('API error:', errorMsg);
            showError('Failed to load census data: ' + errorMsg);
        }
    } catch (error) {
        console.error('Error loading census data:', error);
        showError('Failed to load census data. Please try again.');
    }
}

// Render census table - now displays as folders grouped by house_no and family
function renderCensusTable() {
    const tbody = document.getElementById('census-body');
    const thead = document.getElementById('censusTableHead');
    const tableContainer = document.querySelector('.table-container');
    
    if (filteredCensusData.length === 0) {
        // Add empty class to stretch the container
        if (tableContainer) {
            tableContainer.classList.add('empty');
        }
        // Clear the loading header
        thead.innerHTML = '<tr></tr>';
        const emptyMsg = 'No census records found';
        tbody.innerHTML = `
            <tr style="height: 100%;">
                <td colspan="100%" style="text-align: center; padding: 4rem 2rem; color: #666; vertical-align: middle; height: 100%;">
                    <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; display: block; color: #ccc;"></i>
                    <p style="font-size: 1.1rem;">${emptyMsg}</p>
                </td>
            </tr>
        `;
        updatePaginationInfo();
        return;
    }
    
    // Remove empty class when there's data
    if (tableContainer) {
        tableContainer.classList.remove('empty');
    }
    
    // Clear table header since we're using folder structure
    thead.innerHTML = '<tr></tr>';
    
    // Calculate pagination for houses
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredCensusData.slice(startIndex, endIndex);
    
    // Create folder structure HTML
    let html = '';
    
    pageData.forEach((houseData, houseIndex) => {
        // Use address_display from PHP, or fallback to complete_address or address
        const addressDisplay = houseData.address_display || houseData.complete_address || houseData.address || 'Unknown';
        const sitioLabel = (houseData.sitio || '').trim();
        const sitioBadge = sitioLabel
            ? `<span class="sitio-badge">${escapeHtml(sitioLabel)}</span>`
            : '';
        const houseId = `house-${startIndex + houseIndex}`;
        
        // Create house folder with address as label
        html += `
            <tr class="house-folder-row">
                <td colspan="100%" class="house-folder-cell">
                    <div class="house-folder" data-house-id="${houseId}">
                        <div class="folder-header" onclick="toggleHouseFolder('${houseId}')">
                            <i class="fas fa-folder folder-icon"></i>
                            <span class="folder-title">
                                ${sitioBadge}
                                <strong>${escapeHtml(addressDisplay)}</strong>
                            </span>
                            <i class="fas fa-chevron-down folder-arrow" id="arrow-${houseId}"></i>
                        </div>
                        <div class="folder-content" id="content-${houseId}" style="display: none;">
                                            <div class="members-list">
                                                <div class="member-row-header">
                                                    <div class="member-row-cell">Name</div>
                                                    <div class="member-row-cell">Birthdate</div>
                                                    <div class="member-row-cell">Age</div>
                                                    <div class="member-row-cell">Sex</div>
                                                    <div class="member-row-cell">Relation</div>
                                                    <div class="member-row-cell">Status</div>
                                                    <div class="member-row-cell">Contact</div>
                                                    <div class="member-row-cell">Occupation</div>
                                                    <div class="member-row-cell">Place of Work</div>
                                                    <div class="member-row-cell">Disabilities</div>
                                                    <div class="member-row-cell">Benefits</div>
                                                    <div class="member-row-cell member-actions-header">Action</div>
                                                </div>
                                                ${(houseData.members || []).map((member, memberIndex) => {
                                                    const firstName = member.first_name || member.firstname || member.firstName || '';
                                                    const middleName = member.middle_name || member.middlename || member.middleName || '';
                                                    const lastName = member.last_name || member.lastname || member.lastName || '';
                                                    const suffix = member.suffix || '';
                                                    const age = member.age || '';
                                                    const sex = member.sex || member.gender || '';
                                                    const birthday = member.birthday || member.birth_date || member.birthDate || '';
                                                    const civilStatus = member.civil_status || member.civilStatus || member.civilstatus || '';
                                                    // Use contact_number from census_form table
                                                    const contact = member.contact_number || member.contact || member.contactNumber || member.phone || member.phone_number || member.phoneNumber || member.mobile || member.mobile_number || member.mobileNumber || '';
                                                    // Use occupation from census_form table
                                                    const occupation = member.occupation || member.job || member.employment || member.work || '';
                                                    // Use place_of_work from census_form table
                                                    const placeOfWork = member.place_of_work || member.placeOfWork || member.place_of_employment || '';
                                                    // Use relation_to_household from census_form table
                                                    const relation = member.relation_to_household || member.relationToHousehold || member.relation || '';
                                                    // Use barangay_supported or barangay_supported_benefits
                                                    const benefits = member.barangay_supported_benefits || member.barangay_supported || member.benefits || '';
                                                    // Get status field
                                                    const status = member.status || '';
                                                    // Get disabilities field - check various possible field names
                                                    const disabilities = member.disability || member.disabled || member.disabilities || member.pwd || member.person_with_disability || member.has_disability || member.with_disability || '';
                                                    
                                                    // Format: Last Name, First Name Middle Name Suffix
                                                    let fullName = 'Unknown';
                                                    if (lastName && firstName) {
                                                        const nameParts = [lastName + ','];
                                                        if (firstName) nameParts.push(firstName);
                                                        if (middleName) nameParts.push(middleName);
                                                        if (suffix) nameParts.push(suffix);
                                                        fullName = nameParts.join(' ');
                                                    } else if (lastName) {
                                                        fullName = lastName;
                                                    } else if (firstName) {
                                                        fullName = firstName;
                                                    }
                                                    
                                                    const rowId = member.id != null && member.id !== '' ? Number(member.id) : 0;
                                                    return `
                                                        <div class="member-row" onclick="viewCensusMember(${startIndex + houseIndex}, ${memberIndex})">
                                                            <div class="member-row-cell member-name-cell">${escapeHtml(fullName)}</div>
                                                            <div class="member-row-cell member-birthday-cell">${birthday ? formatDate(birthday) : '-'}</div>
                                                            <div class="member-row-cell member-age-cell">${age !== '' && age != null ? escapeHtml(String(age)) : '-'}</div>
                                                            <div class="member-row-cell member-sex-cell">${sex ? escapeHtml(sex) : '-'}</div>
                                                            <div class="member-row-cell member-relation-cell">${relation ? escapeHtml(relation) : '-'}</div>
                                                            <div class="member-row-cell member-status-cell">${civilStatus ? escapeHtml(civilStatus) : '-'}</div>
                                                            <div class="member-row-cell member-contact-cell">${contact ? escapeHtml(contact) : '-'}</div>
                                                            <div class="member-row-cell member-occupation-cell">${occupation ? escapeHtml(occupation.length > 12 ? occupation.substring(0, 12) + '...' : occupation) : '-'}</div>
                                                            <div class="member-row-cell member-workplace-cell">${placeOfWork ? escapeHtml(placeOfWork.length > 15 ? placeOfWork.substring(0, 15) + '...' : placeOfWork) : '-'}</div>
                                                            <div class="member-row-cell member-disabilities-cell">${disabilities ? escapeHtml(disabilities.length > 15 ? disabilities.substring(0, 15) + '...' : disabilities) : '-'}</div>
                                                            <div class="member-row-cell member-benefits-cell">${benefits ? escapeHtml(benefits.length > 15 ? benefits.substring(0, 15) + '...' : benefits) : '-'}</div>
                                                            <div class="member-row-cell member-actions-cell" onclick="event.stopPropagation()">
                                                                ${rowId > 0 ? `<button type="button" class="member-remove-btn" title="Remove resident" aria-label="Remove resident" onclick="removeCensusMember(${rowId}, event)"><i class="fas fa-trash-alt"></i></button>` : ''}
                                                            </div>
                                                        </div>
                                                    `;
                                                }).join('')}
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    // Update pagination info
    updatePaginationInfo();
    
    // Show statistics on last page
    const totalPages = Math.ceil(filteredCensusData.length / itemsPerPage);
    const statisticsDiv = document.getElementById('censusStatistics');
    if (statisticsDiv) {
        if (currentPage === totalPages && totalPages > 0) {
            statisticsDiv.style.display = 'block';
        } else {
            statisticsDiv.style.display = 'none';
        }
    }
}

// Update statistics display
function updateStatistics(stats) {
    const statTotal = document.getElementById('statTotal');
    const statMale = document.getElementById('statMale');
    const statFemale = document.getElementById('statFemale');
    const statDisabilities = document.getElementById('statDisabilities');
    
    if (statTotal) statTotal.textContent = stats.total || 0;
    if (statMale) statMale.textContent = stats.male || 0;
    if (statFemale) statFemale.textContent = stats.female || 0;
    if (statDisabilities) statDisabilities.textContent = stats.with_disabilities || 0;
}

function populateHouseholdSelect() {
    const sel = document.getElementById('addCensusHousehold');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML =
        '<option value="">Select Household</option>' +
        '<option value="0">New Household</option>';
    censusHouseholds.forEach((h) => {
        const opt = document.createElement('option');
        opt.value = String(h.census_id);
        const label = (h.label || '').trim();
        opt.textContent = label ? `#${h.census_id} — ${label.length > 90 ? label.substring(0, 90) + '…' : label}` : `Household #${h.census_id}`;
        sel.appendChild(opt);
    });
    if (prev !== undefined && prev !== null && [...sel.options].some((o) => o.value === prev)) {
        sel.value = prev;
    } else {
        sel.value = '';
    }
}

function resetAddCensusForm() {
    const form = document.getElementById('addCensusForm');
    if (form) form.reset();
    const ageEl = document.getElementById('add_age');
    if (ageEl) ageEl.value = '';
    const hh = document.getElementById('addCensusHousehold');
    if (hh) hh.value = '';
    const br = document.getElementById('add_barangay');
    const mu = document.getElementById('add_municipality');
    const pr = document.getElementById('add_province');
    if (br) br.value = 'Bigte';
    if (mu) mu.value = 'Norzagaray';
    if (pr) pr.value = 'Bulacan';
}

function updateAddAgeFromBirthdate() {
    const input = document.getElementById('add_birthday');
    const ageEl = document.getElementById('add_age');
    if (!input || !ageEl) return;
    const v = input.value;
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        ageEl.value = '';
        return;
    }
    const b = new Date(v + 'T12:00:00');
    if (Number.isNaN(b.getTime())) {
        ageEl.value = '';
        return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let age = today.getFullYear() - b.getFullYear();
    const m = today.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < b.getDate())) {
        age--;
    }
    ageEl.value = age >= 0 ? String(age) : '';
}

function openAddCensusModal() {
    resetAddCensusForm();
    populateHouseholdSelect();
    const modal = document.getElementById('addCensusModal');
    if (modal) {
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeAddCensusModal() {
    const modal = document.getElementById('addCensusModal');
    if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    }
}

/** Returns labels of required fields that are empty (suffix only optional). */
function getAddCensusValidationErrors() {
    const missing = [];
    const req = (id) => ((document.getElementById(id) && document.getElementById(id).value.trim()) || '');
    const reqSelect = (id) => ((document.getElementById(id) && document.getElementById(id).value) || '');

    const hh = document.getElementById('addCensusHousehold');
    if (!hh || hh.value === '' || hh.value === null) {
        missing.push('Select Household');
    }
    if (!req('add_last_name')) missing.push('Last name');
    if (!req('add_first_name')) missing.push('First name');
    if (!req('add_middle_name')) missing.push('Middle name');
    if (!reqSelect('add_birthday')) missing.push('Birthdate');
    if (!reqSelect('add_sex')) missing.push('Sex');
    if (!req('add_civil_status')) missing.push('Civil status');
    if (!req('add_contact_number')) missing.push('Contact number');
    if (!req('add_occupation')) missing.push('Occupation');
    if (!req('add_place_of_work')) missing.push('Place of work');
    if (!req('add_disabilities')) missing.push('Disabilities');
    if (!req('add_relation_to_household')) missing.push('Relation to household');
    if (!req('add_house_no')) missing.push('House no.');
    if (!req('add_street')) missing.push('Street');
    if (!reqSelect('add_sitio')) missing.push('Sitio');
    if (!req('add_barangay_supported_benefits')) missing.push('Barangay supported benefits');
    return missing;
}

async function submitAddCensus(event) {
    event.preventDefault();
    const missing = getAddCensusValidationErrors();
    if (missing.length > 0) {
        const listHtml =
            '<ul style="text-align:left;margin:0.75em 0 0 1.25em;padding:0">' +
            missing.map((label) => `<li>${escapeHtml(label)}</li>`).join('') +
            '</ul>';
        if (typeof Swal !== 'undefined' && Swal.fire) {
            await Swal.fire({
                icon: 'warning',
                title: 'Please complete required fields',
                html: '<p style="margin:0">The following required fields are empty:</p>' + listHtml,
                confirmButtonColor: '#2c5aa0'
            });
        } else {
            alert('Please fill in: ' + missing.join(', '));
        }
        return;
    }

    const btn = document.getElementById('addCensusSubmitBtn');
    const hhRaw = document.getElementById('addCensusHousehold').value;
    const censusIdPayload = hhRaw === '' ? 0 : parseInt(hhRaw, 10);
    const payload = {
        action: 'add',
        census_id: Number.isNaN(censusIdPayload) ? 0 : censusIdPayload,
        first_name: document.getElementById('add_first_name').value.trim(),
        last_name: document.getElementById('add_last_name').value.trim(),
        middle_name: document.getElementById('add_middle_name').value.trim(),
        suffix: document.getElementById('add_suffix').value.trim(),
        birthday: document.getElementById('add_birthday').value,
        sex: document.getElementById('add_sex').value,
        civil_status: document.getElementById('add_civil_status').value.trim(),
        contact_number: document.getElementById('add_contact_number').value.trim(),
        occupation: document.getElementById('add_occupation').value.trim(),
        place_of_work: document.getElementById('add_place_of_work').value.trim(),
        disabilities: document.getElementById('add_disabilities').value.trim(),
        barangay_supported_benefits: document.getElementById('add_barangay_supported_benefits').value.trim(),
        relation_to_household: document.getElementById('add_relation_to_household').value.trim(),
        house_no: document.getElementById('add_house_no').value.trim(),
        street: document.getElementById('add_street').value.trim(),
        sitio: document.getElementById('add_sitio').value.trim()
    };

    if (btn) {
        btn.disabled = true;
    }
    try {
        const response = await fetch('php/census.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        });
        if (response.status === 403) {
            if (typeof Swal !== 'undefined' && Swal.fire) {
                await Swal.fire({ icon: 'warning', title: 'Session required', text: 'Please log in to add census records.', confirmButtonColor: '#2c5aa0' });
            } else {
                alert('Please log in to add census records.');
            }
            return;
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            const errMsg = data.error || 'Could not save resident.';
            if (typeof Swal !== 'undefined' && Swal.fire) {
                await Swal.fire({ icon: 'error', title: 'Could not save', text: errMsg, confirmButtonColor: '#2c5aa0' });
            } else {
                alert(errMsg);
            }
            return;
        }
        closeAddCensusModal();
        await loadCensusData();
    } catch (e) {
        console.error(e);
        if (typeof Swal !== 'undefined' && Swal.fire) {
            await Swal.fire({ icon: 'error', title: 'Error', text: 'Could not save resident. Please try again.', confirmButtonColor: '#2c5aa0' });
        } else {
            alert('Could not save resident. Please try again.');
        }
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function removeCensusMember(id, ev) {
    if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
    }
    const n = parseInt(id, 10);
    if (!n || Number.isNaN(n)) return;

    let confirmed = false;
    if (typeof Swal !== 'undefined' && Swal.fire) {
        const result = await Swal.fire({
            title: 'Remove from census?',
            html: 'This resident will be moved to the <strong>archive</strong>. An administrator can return them later from <strong>Archive → Census</strong>.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, remove',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#c0392b',
            cancelButtonColor: '#6c757d',
            focusCancel: true,
            reverseButtons: true
        });
        confirmed = result.isConfirmed === true;
    } else {
        confirmed = confirm('Remove this resident from the active census? They will be moved to the archive (admin can return them later).');
    }
    if (!confirmed) return;

    try {
        const response = await fetch('php/census.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ action: 'delete', id: n })
        });
        if (response.status === 403) {
            alert('Please log in to remove census records.');
            return;
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            alert(data.error || 'Could not remove resident.');
            return;
        }
        await loadCensusData();
    } catch (e) {
        console.error(e);
        alert('Could not remove resident. Please try again.');
    }
}

// Toggle house folder
function toggleHouseFolder(houseId) {
    const content = document.getElementById(`content-${houseId}`);
    const arrow = document.getElementById(`arrow-${houseId}`);
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        arrow.classList.remove('fa-chevron-down');
        arrow.classList.add('fa-chevron-up');
    } else {
        content.style.display = 'none';
        arrow.classList.remove('fa-chevron-up');
        arrow.classList.add('fa-chevron-down');
    }
}

// Toggle family folder
function toggleFamilyFolder(familyId) {
    const content = document.getElementById(`content-${familyId}`);
    const arrow = document.getElementById(`arrow-${familyId}`);
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        arrow.classList.remove('fa-chevron-down');
        arrow.classList.add('fa-chevron-up');
    } else {
        content.style.display = 'none';
        arrow.classList.remove('fa-chevron-up');
        arrow.classList.add('fa-chevron-down');
    }
}

// View census member details
function viewCensusMember(houseIndex, memberIndex) {
    const houseData = filteredCensusData[houseIndex];
    if (!houseData || !houseData.members || !houseData.members[memberIndex]) {
        return;
    }
    
    const member = houseData.members[memberIndex];
    viewCensusRecordByMember(member);
}

// View census record by member data
function viewCensusRecordByMember(member) {
    const modal = document.getElementById('viewCensusModal');
    const content = document.getElementById('viewCensusContent');
    
    // Define priority order for display
    const priorityOrder = [
        'last_name', 'lastname', 'surname', 'apelyido', 'family_name',
        'suffix',
        'first_name', 'firstname', 'given_name', 'givenname',
        'middle_name', 'middlename',
        'address', 'residence', 'location', 'complete_address',
        'birthday', 'birth_date', 'birthdate',
        'age',
        'sex', 'gender'
    ];
    
    // Sort keys: priority first, then alphabetically
    const sortedKeys = Object.keys(member).sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        
        // Skip id, created_at, house_no, image, and photo fields
        if (aLower === 'id' || aLower === 'created_at' || aLower === 'archived_at' || aLower === 'house_no' || aLower === 'houseno' || aLower.includes('image') || aLower.includes('photo')) return 1;
        if (bLower === 'id' || bLower === 'created_at' || bLower === 'archived_at' || bLower === 'house_no' || bLower === 'houseno' || bLower.includes('image') || bLower.includes('photo')) return -1;
        
        const aIndex = priorityOrder.findIndex(p => {
            const pLower = p.toLowerCase();
            return aLower === pLower || aLower.includes(pLower) || pLower.includes(aLower);
        });
        const bIndex = priorityOrder.findIndex(p => {
            const pLower = p.toLowerCase();
            return bLower === pLower || bLower.includes(pLower) || pLower.includes(bLower);
        });
        
        // If both are in priority order, sort by priority index
        if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
        }
        // If only a is in priority, a comes first
        if (aIndex !== -1) return -1;
        // If only b is in priority, b comes first
        if (bIndex !== -1) return 1;
        // If neither is in priority, sort alphabetically
        return a.localeCompare(b);
    });
    
    // Generate view content dynamically
    let html = '<div class="form-grid">';
    
    sortedKeys.forEach(key => {
        const value = member[key];
        const lowerKey = key.toLowerCase();
        
        // Skip image fields, created_at, and house_no
        if (lowerKey.includes('image') || lowerKey.includes('photo') || lowerKey === 'created_at' || lowerKey === 'archived_at' || lowerKey === 'house_no' || lowerKey === 'houseno') {
            return;
        }
        
        html += `
            <div class="view-field">
                <label>${formatColumnName(key)}</label>
                <div class="field-value">${escapeHtml(value || 'N/A')}</div>
            </div>
        `;
    });
    
    html += '</div>';
    content.innerHTML = html;
    
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

// Format column names for display
function formatColumnName(key) {
    if (String(key).toLowerCase() === 'birthday') {
        return 'Birthdate';
    }
    // Convert snake_case to Title Case
    let formatted = key
        .split('_')
        .map(word => {
            const lowerWord = word.toLowerCase();
            // Convert "id" to "ID"
            if (lowerWord === 'id') {
                return 'ID';
            }
            // Keep "of" and "to" lowercase
            if (lowerWord === 'of' || lowerWord === 'to') {
                return lowerWord;
            }
            // Capitalize first letter, rest lowercase
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
    
    return formatted;
}

// View census record details
function viewCensusRecord(index) {
    const record = filteredCensusData[index];
    const modal = document.getElementById('viewCensusModal');
    const content = document.getElementById('viewCensusContent');
    
    // Define priority order: lastname, suffix, first_name, middle_name, address, age, sex, etc.
    const priorityOrder = [
        'last_name', 'lastname', 'surname', 'apelyido', 'family_name',
        'suffix',
        'first_name', 'firstname', 'given_name', 'givenname',
        'middle_name', 'middlename',
        'address', 'residence', 'location',
        'age',
        'sex', 'gender'
    ];
    
    // Sort keys: priority first, then alphabetically
    const sortedKeys = Object.keys(record).sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        
        // Skip id, created_at, house_no, image, and photo fields
        if (aLower === 'id' || aLower === 'created_at' || aLower === 'archived_at' || aLower === 'house_no' || aLower === 'houseno' || aLower.includes('image') || aLower.includes('photo')) return 1;
        if (bLower === 'id' || bLower === 'created_at' || bLower === 'archived_at' || bLower === 'house_no' || bLower === 'houseno' || bLower.includes('image') || bLower.includes('photo')) return -1;
        
        const aIndex = priorityOrder.findIndex(p => {
            const pLower = p.toLowerCase();
            return aLower === pLower || aLower.includes(pLower) || pLower.includes(aLower);
        });
        const bIndex = priorityOrder.findIndex(p => {
            const pLower = p.toLowerCase();
            return bLower === pLower || bLower.includes(pLower) || pLower.includes(bLower);
        });
        
        // If both are in priority order, sort by priority index
        if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
        }
        // If only a is in priority, a comes first
        if (aIndex !== -1) return -1;
        // If only b is in priority, b comes first
        if (bIndex !== -1) return 1;
        // If neither is in priority, sort alphabetically
        return a.localeCompare(b);
    });
    
    // Generate view content dynamically
    let html = '<div class="form-grid">';
    
    sortedKeys.forEach(key => {
        const value = record[key];
        const lowerKey = key.toLowerCase();
        
        // Skip image fields, created_at, archived_at, and house_no
        if (lowerKey.includes('image') || lowerKey.includes('photo') || lowerKey === 'created_at' || lowerKey === 'archived_at' || lowerKey === 'house_no' || lowerKey === 'houseno') {
            return;
        }
        
        html += `
            <div class="view-field">
                <label>${formatColumnName(key)}</label>
                <div class="field-value">${escapeHtml(value || 'N/A')}</div>
            </div>
        `;
    });
    
    html += '</div>';
    content.innerHTML = html;
    
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

// Close view census modal
function closeViewCensusModal() {
    const modal = document.getElementById('viewCensusModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

// Search functions
function toggleSearchBar() {
    const searchContainer = document.getElementById('searchContainer');
    if (searchContainer.style.display === 'none') {
        searchContainer.style.display = 'block';
        document.getElementById('searchInput').focus();
    } else {
        searchContainer.style.display = 'none';
        clearSearch();
    }
}

function searchCensus() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (!searchTerm) {
        filteredCensusData = allCensusData;
    } else {
        filteredCensusData = allCensusData.filter(houseData => {
            // Search in house_no, sitio, complete_address
            const houseNo = String(houseData.house_no || '').toLowerCase();
            const sitio = String(houseData.sitio || '').toLowerCase();
            const address = String(houseData.complete_address || '').toLowerCase();
            
            // Check if house matches
            if (houseNo.includes(searchTerm) || sitio.includes(searchTerm) || address.includes(searchTerm)) {
                return true;
            }
            
            // Search in members
            if (houseData.members && Array.isArray(houseData.members)) {
                return houseData.members.some(member => {
                    return Object.values(member).some(value => {
                        if (value === null || value === undefined) return false;
                        return String(value).toLowerCase().includes(searchTerm);
                    });
                });
            }
            
            return false;
        });
    }
    
    currentPage = 1;
    renderCensusTable();
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    filteredCensusData = allCensusData;
    currentPage = 1;
    renderCensusTable();
}

// Pagination functions
function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderCensusTable();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredCensusData.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderCensusTable();
    }
}

function updatePaginationInfo() {
    const totalPages = Math.ceil(filteredCensusData.length / itemsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages || 1}`;
}

// Print function - creates a print-friendly list view
function printData() {
    // Create a print-friendly version of the data
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
        alert('Please allow popups to print the census data');
        return;
    }
    
    // Flatten all members from all families and sort
    const allMembers = [];
    
    filteredCensusData.forEach(houseData => {
        if (houseData.members && Array.isArray(houseData.members)) {
            const completeAddress = houseData.address_display || houseData.complete_address || houseData.address || '';
                houseData.members.forEach(member => {
                const lastName = (member.last_name || member.lastname || member.lastName || '').toUpperCase();
                const firstName = (member.first_name || member.firstname || member.firstName || '').toUpperCase();
                const middleName = (member.middle_name || member.middlename || member.middleName || '').toUpperCase();
                const houseNo = houseData.house_number || extractHouseNumberFromAddress(completeAddress) || 'Unknown';
                const sitioSort = (member.sitio || houseData.sitio || '').toUpperCase();
                
                allMembers.push({
                    ...member,
                    _sortLastName: lastName,
                    _sortFirstName: firstName,
                    _sortMiddleName: middleName,
                    _sortHouseNo: parseInt(houseNo, 10) || 999999,
                    _sortSitio: sitioSort,
                    _houseNo: houseNo,
                    _familyName: houseData.family_name || lastName || 'Unknown Family',
                    _completeAddress: completeAddress
                });
            });
        }
    });
    
    // Sort: sitio, then house number, then name
    allMembers.sort((a, b) => {
        const sitioCmp = (a._sortSitio || '').localeCompare(b._sortSitio || '');
        if (sitioCmp !== 0) {
            return sitioCmp;
        }
        if (a._sortHouseNo !== b._sortHouseNo) {
            return a._sortHouseNo - b._sortHouseNo;
        }
        if (a._sortLastName !== b._sortLastName) {
            return a._sortLastName.localeCompare(b._sortLastName);
        }
        if (a._sortFirstName !== b._sortFirstName) {
            return a._sortFirstName.localeCompare(b._sortFirstName);
        }
        return a._sortMiddleName.localeCompare(b._sortMiddleName);
    });
    
    const printHeading = 'Census Data - Barangay Bigte';

    // Generate print HTML
    const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${escapeHtml(printHeading)}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    font-size: 11px;
                    background: white;
                    color: black;
                }
                
                h1 {
                    text-align: center;
                    margin-bottom: 20px;
                    color: #2c5aa0;
                    font-size: 1.5rem;
                }
                
                .print-date {
                    text-align: right;
                    margin-bottom: 10px;
                    color: #666;
                    font-size: 0.9rem;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    table-layout: auto;
                }
                
                th {
                    background-color: #2c5aa0;
                    color: white;
                    padding: 8px 6px;
                    text-align: left;
                    font-weight: bold;
                    border: 1px solid #ddd;
                    white-space: nowrap;
                    font-size: 9px;
                }
                
                td {
                    padding: 6px;
                    border: 1px solid #ddd;
                    white-space: nowrap;
                    font-size: 9px;
                }
                
                tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                
                tr:hover {
                    background-color: #f5f5f5;
                }
                
                .family-separator {
                    background-color: #e3f2fd !important;
                    font-weight: bold;
                }
                
                .print-statistics {
                    text-align: right;
                    margin-top: 20px;
                    padding-top: 15px;
                    border-top: 2px solid #ddd;
                    font-size: 12px;
                    page-break-inside: avoid;
                }
                
                .print-statistics span {
                    margin-right: 2.5rem;
                    color: #000;
                }
                
                .print-statistics span:last-child {
                    margin-right: 0;
                }
                
                .print-statistics strong {
                    color: #2c5aa0;
                    font-weight: 700;
                }
                
                @media print {
                    @page {
                        size: 13in 8.5in landscape;
                        margin: 1cm;
                    }
                    
                    body {
                        margin: 0;
                        padding: 20px;
                    }
                    
                    h1 {
                        page-break-after: avoid;
                    }
                    
                    table {
                        page-break-inside: auto;
                    }
                    
                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                    
                    thead {
                        display: table-header-group;
                    }
                    
                    .print-statistics {
                        page-break-inside: avoid;
                        page-break-before: auto;
                    }
                }
            </style>
        </head>
        <body>
            <h1>${escapeHtml(printHeading)}</h1>
            <div class="print-date">Printed: ${new Date().toLocaleString()}</div>
            <table>
                <thead>
                    <tr>
                        <th>Address</th>
                        <th>Name</th>
                        <th>Birthdate</th>
                        <th>Age</th>
                        <th>Sex</th>
                        <th>Relation</th>
                        <th>Status</th>
                        <th>Contact</th>
                        <th>Occupation</th>
                        <th>Place of Work</th>
                        <th>Disabilities</th>
                        <th>Benefits</th>
                    </tr>
                </thead>
                <tbody>
                    ${allMembers.map((member, index) => {
                        const firstName = member.first_name || member.firstname || member.firstName || '';
                        const middleName = member.middle_name || member.middlename || member.middleName || '';
                        const lastName = member.last_name || member.lastname || member.lastName || '';
                        const suffix = member.suffix || '';
                        
                        // Format: Last Name, First Name Middle Name Suffix
                        let fullName = 'Unknown';
                        if (lastName && firstName) {
                            const nameParts = [lastName + ','];
                            if (firstName) nameParts.push(firstName);
                            if (middleName) nameParts.push(middleName);
                            if (suffix) nameParts.push(suffix);
                            fullName = nameParts.join(' ');
                        } else if (lastName) {
                            fullName = lastName;
                        } else if (firstName) {
                            fullName = firstName;
                        }
                        
                        const age = member.age || '';
                        const sex = member.sex || member.gender || '';
                        const birthday = member.birthday || member.birth_date || member.birthDate || '';
                        const civilStatus = member.civil_status || member.civilStatus || member.civilstatus || '';
                        const contact = member.contact_number || member.contact || member.contactNumber || member.phone || member.phone_number || member.phoneNumber || member.mobile || member.mobile_number || member.mobileNumber || '';
                        const occupation = member.occupation || member.job || member.employment || member.work || '';
                        const placeOfWork = member.place_of_work || member.placeOfWork || member.place_of_employment || '';
                        const relation = member.relation_to_household || member.relationToHousehold || member.relation || '';
                        const benefits = member.barangay_supported_benefits || member.barangay_supported || member.benefits || '';
                        // Get disabilities field - check various possible field names
                        const disabilities = member.disability || member.disabled || member.disabilities || member.pwd || member.person_with_disability || member.has_disability || member.with_disability || '';
                        
                        // Get complete address from the stored address (same for whole household; show every row)
                        const completeAddress = member._completeAddress || member.complete_address || member.completeAddress || member.address || '';
                        
                        const prevMember = index > 0 ? allMembers[index - 1] : null;
                        const isNewFamily = !prevMember ||
                            prevMember._houseNo !== member._houseNo ||
                            prevMember._sortLastName !== member._sortLastName;
                        
                        const rowClass = isNewFamily ? 'family-separator' : '';
                        
                        return `
                            <tr class="${rowClass}">
                                <td>${escapeHtml(completeAddress)}</td>
                                <td>${escapeHtml(fullName)}</td>
                                <td>${birthday ? formatDate(birthday) : '-'}</td>
                                <td>${age ? escapeHtml(age) : '-'}</td>
                                <td>${sex ? escapeHtml(sex) : '-'}</td>
                                <td>${relation ? escapeHtml(relation) : '-'}</td>
                                <td>${civilStatus ? escapeHtml(civilStatus) : '-'}</td>
                                <td>${contact ? escapeHtml(contact) : '-'}</td>
                                <td>${occupation ? escapeHtml(occupation) : '-'}</td>
                                <td>${placeOfWork ? escapeHtml(placeOfWork) : '-'}</td>
                                <td>${disabilities ? escapeHtml(disabilities) : '-'}</td>
                                <td>${benefits ? escapeHtml(benefits) : '-'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            ${censusStatistics ? `
            <div class="print-statistics">
                <span>Total: <strong>${censusStatistics.total || 0}</strong></span>
                <span>Male: <strong>${censusStatistics.male || 0}</strong></span>
                <span>Female: <strong>${censusStatistics.female || 0}</strong></span>
                <span>PWDs: <strong>${censusStatistics.with_disabilities || 0}</strong></span>
            </div>
            ` : ''}
        </body>
        </html>
    `;
    
    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    // Wait for content to load, then print
    printWindow.onload = function() {
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };
}

// Helper function to extract house number from address
function extractHouseNumberFromAddress(address) {
    if (!address) return '';
    // Try to find house number at the start of address (e.g., "1686, Castillo Road" -> "1686")
    const match = address.match(/^(\d+)/);
    return match ? match[1] : '';
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    const tbody = document.getElementById('census-body');
    tbody.innerHTML = `
        <tr>
            <td colspan="100%" style="text-align: center; padding: 2rem; color: #d32f2f;">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                <p>${escapeHtml(message)}</p>
            </td>
        </tr>
    `;
}

// Close modal on outside click
document.addEventListener('click', function(event) {
    const viewModal = document.getElementById('viewCensusModal');
    if (event.target === viewModal) {
        closeViewCensusModal();
    }
    const addModal = document.getElementById('addCensusModal');
    if (event.target === addModal) {
        closeAddCensusModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeViewCensusModal();
        closeAddCensusModal();
    }
});

