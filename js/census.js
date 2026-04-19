// Global variables
let allCensusData = [];
let filteredCensusData = [];
let censusHouseholds = [];
let censusStatistics = null;

/** Cascading filter (benefits, PWDs, employed/unemployed, …) — applied bago ang text search */
let censusFilterActive = false;
let censusFilterCategory = '';
let censusFilterSubValue = '';
let censusFilterSitioValue = '';
/** Mga distinct na string ng benepisyo / PWD para sa 2nd dropdown (index = option value) */
let __censusBenefitList = [];
let __censusPwdList = [];
/** Snapshot ng lahat ng option sa pangalawang dropdown — para sa pag-filter habang nagta-type */
let __censusSubAllOptions = [];

const CENSUS_SITIO_OPTIONS = [
    'AHUNIN',
    'BALTAZAR',
    'BIAK NA BATO',
    'CALLE ONSE/SAMPAGUITA',
    'COC',
    'CRUSHER HIGHWAY',
    'INNER CRUSHER',
    'LOOBAN 1',
    'LOOBAN 2',
    'NABUS',
    'OLD BARRIO NPC',
    'OLD BARRIO 2',
    'OLD BARRIO EXT',
    'POBLACION',
    'KADAYUNAN',
    'MANGGAHAN',
    'RIVERSIDE',
    'SETTLING',
    'SPAR',
    'UPPER',
    'ALINSANGAN',
    'RCD',
    'BRIA PHASE 1',
    'BRIA PHASE 2'
];

const CENSUS_SIDEBAR_KEY = 'censusSidebarCollapsed';

function setupCensusSidebarCollapse() {
    const layout = document.getElementById('censusPageLayout');
    const hideBtn = document.getElementById('censusSidebarHide');
    const showBtn = document.getElementById('censusSidebarShow');
    if (!layout || !hideBtn || !showBtn) return;

    function applyCollapsed(collapsed) {
        layout.classList.toggle('is-sidebar-collapsed', collapsed);
        hideBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        showBtn.hidden = !collapsed;
        showBtn.setAttribute('aria-expanded', collapsed ? 'true' : 'false');
        try {
            localStorage.setItem(CENSUS_SIDEBAR_KEY, collapsed ? '1' : '0');
        } catch (e) {
            /* ignore */
        }
        requestAnimationFrame(() => {
            updateCensusScrollToTopVisibility();
        });
    }

    let collapsed = false;
    try {
        collapsed = localStorage.getItem(CENSUS_SIDEBAR_KEY) === '1';
    } catch (e) {
        collapsed = false;
    }
    applyCollapsed(collapsed);

    hideBtn.addEventListener('click', () => applyCollapsed(true));
    showBtn.addEventListener('click', () => applyCollapsed(false));
}

const CENSUS_SCROLL_TOP_THRESHOLD = 200;

function updateCensusScrollToTopVisibility() {
    const scrollEl = document.getElementById('censusMainScroll');
    const btn = document.getElementById('censusScrollToTop');
    if (!scrollEl || !btn) {
        return;
    }
    if (scrollEl.scrollTop > CENSUS_SCROLL_TOP_THRESHOLD) {
        btn.classList.add('show');
    } else {
        btn.classList.remove('show');
    }
}

function setupCensusScrollToTop() {
    const scrollEl = document.getElementById('censusMainScroll');
    const btn = document.getElementById('censusScrollToTop');
    if (!scrollEl || !btn) {
        return;
    }
    scrollEl.addEventListener(
        'scroll',
        () => {
            updateCensusScrollToTopVisibility();
        },
        { passive: true }
    );
    btn.addEventListener('click', () => {
        scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
    });
    updateCensusScrollToTopVisibility();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadCensusData();
    setupCensusFilterControls();
    setupCensusSidebarCollapse();
    setupCensusScrollToTop();
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
            buildCensusFilterOptionLists();
            populateSitioFilterOptions();
            censusHouseholds = Array.isArray(data.households) ? data.households : [];
            populateHouseholdSelect();
            
            // Store statistics
            if (data.statistics) {
                censusStatistics = data.statistics;
            }
            
            recomputeFilteredCensusData();
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

/** Kapag may piniling uri mula sa kaliwang tabs (hindi "ALL"), flat na listahan ng resident — walang folder */
function censusUsesFlatMemberListView() {
    return !!censusFilterCategory;
}

/** DB `indigenous` TINYINT(1): 1 = Yes, 0 = No */
function formatIndigenousYesNo(member) {
    const v = member && member.indigenous;
    if (v === 1 || v === '1' || v === true) return 'Yes';
    if (v === 0 || v === '0' || v === false) return 'No';
    return '—';
}

/** Parehong field extraction para sa folder member row at flat table row */
function getCensusMemberDisplayFields(member, houseData) {
    const addressDisplay = houseData.address_display || houseData.complete_address || houseData.address || 'Unknown';
    const sitioLabel = (houseData.sitio || '').trim();
    const addressForTable = sitioLabel ? `${sitioLabel} — ${addressDisplay}` : addressDisplay;
    const firstName = member.first_name || member.firstname || member.firstName || '';
    const middleName = member.middle_name || member.middlename || member.middleName || '';
    const lastName = member.last_name || member.lastname || member.lastName || '';
    const suffix = member.suffix || '';
    const age = member.age || '';
    const sex = member.sex || member.gender || '';
    const birthday = member.birthday || member.birth_date || member.birthDate || '';
    const civilStatus = member.civil_status || member.civilStatus || member.civilstatus || '';
    const contact =
        member.contact_number ||
        member.contact ||
        member.contactNumber ||
        member.phone ||
        member.phone_number ||
        member.phoneNumber ||
        member.mobile ||
        member.mobile_number ||
        member.mobileNumber ||
        '';
    const occupation = member.occupation || member.job || member.employment || member.work || '';
    const placeOfWork = member.place_of_work || member.placeOfWork || member.place_of_employment || '';
    const relation = member.relation_to_household || member.relationToHousehold || member.relation || '';
    const benefits = member.barangay_supported_benefits || member.barangay_supported || member.benefits || '';
    const recordStatusRaw = String(member.status != null ? member.status : 'Censused').trim() || 'Censused';
    const isBlocked = recordStatusRaw === 'Blocked';
    const disabilities = getDisabilitiesColumnText(member);
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
    return {
        addressForTable,
        fullName,
        birthdayFmt: birthday ? formatDate(birthday) : '-',
        ageStr: age !== '' && age != null ? String(age) : '-',
        sex: sex ? escapeHtml(sex) : '-',
        relation: relation ? escapeHtml(relation) : '-',
        civilStatus: civilStatus ? escapeHtml(civilStatus) : '-',
        recordStatus: escapeHtml(recordStatusRaw),
        isBlocked,
        contact: contact ? escapeHtml(contact) : '-',
        occupationShort: occupation
            ? escapeHtml(occupation.length > 12 ? occupation.substring(0, 12) + '...' : occupation)
            : '-',
        placeOfWorkShort: placeOfWork
            ? escapeHtml(placeOfWork.length > 15 ? placeOfWork.substring(0, 15) + '...' : placeOfWork)
            : '-',
        disabilitiesShort: disabilities
            ? escapeHtml(disabilities.length > 15 ? disabilities.substring(0, 15) + '...' : disabilities)
            : '-',
        benefitsShort: benefits
            ? escapeHtml(benefits.length > 15 ? benefits.substring(0, 15) + '...' : benefits)
            : '-',
        indigenousShort: escapeHtml(formatIndigenousYesNo(member)),
        rowId
    };
}

// Render census table - folders ("ALL") o flat na listahan (anumang kaliwang filter maliban sa ALL)
function renderCensusTable() {
    const tbody = document.getElementById('census-body');
    const thead = document.getElementById('censusTableHead');
    const tableContainer = document.querySelector('#censusTable')?.closest('.table-container');
    const censusTable = document.getElementById('censusTable');
    
    if (filteredCensusData.length === 0) {
        // Add empty class to stretch the container
        if (tableContainer) {
            tableContainer.classList.add('empty');
        }
        if (censusTable) {
            censusTable.classList.remove('census-table--flat');
        }
        if (tableContainer) {
            tableContainer.classList.remove('census-list-flat');
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
        const statisticsDivEmpty = document.getElementById('censusStatistics');
        if (statisticsDivEmpty) {
            statisticsDivEmpty.style.display = 'none';
        }
        updateCensusScrollToTopVisibility();
        return;
    }
    
    // Remove empty class when there's data
    if (tableContainer) {
        tableContainer.classList.remove('empty');
    }

    const useFlat = censusUsesFlatMemberListView();

    if (censusTable) {
        censusTable.classList.toggle('census-table--flat', useFlat);
    }
    if (tableContainer) {
        tableContainer.classList.toggle('census-list-flat', useFlat);
    }

    if (useFlat) {
        const allRefs = [];
        filteredCensusData.forEach((houseData, hi) => {
            (houseData.members || []).forEach((member, mi) => {
                allRefs.push({ houseData, hi, mi, member });
            });
        });
        const pageRefs = allRefs;

        thead.innerHTML = `
            <tr>
                <th>Address</th>
                <th>Name</th>
                <th>Birthdate</th>
                <th>Age</th>
                <th>Sex</th>
                <th>Indigenous (IP)</th>
                <th>Relation</th>
                <th>Civil status</th>
                <th>Status</th>
                <th>Contact</th>
                <th>Occupation</th>
                <th>Place of Work</th>
                <th>Disabilities</th>
                <th>Benefits</th>
                <th class="census-flat-actions-col">Action</th>
            </tr>
        `;

        let flatHtml = '';
        pageRefs.forEach(({ houseData, hi, mi, member }) => {
            const f = getCensusMemberDisplayFields(member, houseData);
            const actions =
                f.rowId > 0
                    ? `<span class="member-action-btns">
                        <button type="button" class="member-block-btn" title="Block resident" aria-label="Block resident" ${f.isBlocked ? 'disabled' : ''} onclick="blockCensusMember(${f.rowId}, event)"><i class="fas fa-ban"></i></button>
                        <button type="button" class="member-remove-btn" title="Archive resident" aria-label="Archive resident" onclick="removeCensusMember(${f.rowId}, event)"><i class="fas fa-trash-alt"></i></button>
                        </span>`
                    : '';
            flatHtml += `
                <tr class="census-flat-member-row" onclick="viewCensusMember(${hi}, ${mi})">
                    <td class="census-flat-address">${escapeHtml(f.addressForTable)}</td>
                    <td>${escapeHtml(f.fullName)}</td>
                    <td>${f.birthdayFmt === '-' ? '-' : escapeHtml(String(f.birthdayFmt))}</td>
                    <td>${f.ageStr === '-' ? '-' : escapeHtml(f.ageStr)}</td>
                    <td>${f.sex}</td>
                    <td>${f.indigenousShort}</td>
                    <td>${f.relation}</td>
                    <td>${f.civilStatus}</td>
                    <td>${f.recordStatus}</td>
                    <td>${f.contact}</td>
                    <td>${f.occupationShort}</td>
                    <td>${f.placeOfWorkShort}</td>
                    <td>${f.disabilitiesShort}</td>
                    <td>${f.benefitsShort}</td>
                    <td class="census-flat-actions" onclick="event.stopPropagation()">${actions}</td>
                </tr>
            `;
        });
        tbody.innerHTML = flatHtml;

        const statisticsDiv = document.getElementById('censusStatistics');
        if (statisticsDiv) {
            statisticsDiv.style.display = 'flex';
        }
        updateCensusScrollToTopVisibility();
        return;
    }

    // Folder view (ALL tab / walang category filter sa kaliwa)
    thead.innerHTML = '<tr></tr>';

    const pageData = filteredCensusData;
    
    // Create folder structure HTML
    let html = '';
    
    pageData.forEach((houseData, houseIndex) => {
        // Use address_display from PHP, or fallback to complete_address or address
        const addressDisplay = houseData.address_display || houseData.complete_address || houseData.address || 'Unknown';
        const sitioLabel = (houseData.sitio || '').trim();
        const sitioBadge = sitioLabel
            ? `<span class="sitio-badge">${escapeHtml(sitioLabel)}</span>`
            : '';
        const houseId = `house-${houseIndex}`;
        
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
                                                    <div class="member-row-cell">Indigenous (IP)</div>
                                                    <div class="member-row-cell">Relation</div>
                                                    <div class="member-row-cell">Civil status</div>
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
                                                    const recordStatus = String(member.status != null ? member.status : 'Censused').trim() || 'Censused';
                                                    const indigenousLabel = formatIndigenousYesNo(member);
                                                    const disabilities = getDisabilitiesColumnText(member);
                                                    
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
                                                        <div class="member-row" onclick="viewCensusMember(${houseIndex}, ${memberIndex})">
                                                            <div class="member-row-cell member-name-cell">${escapeHtml(fullName)}</div>
                                                            <div class="member-row-cell member-birthday-cell">${birthday ? formatDate(birthday) : '-'}</div>
                                                            <div class="member-row-cell member-age-cell">${age !== '' && age != null ? escapeHtml(String(age)) : '-'}</div>
                                                            <div class="member-row-cell member-sex-cell">${sex ? escapeHtml(sex) : '-'}</div>
                                                            <div class="member-row-cell member-indigenous-cell">${escapeHtml(indigenousLabel)}</div>
                                                            <div class="member-row-cell member-relation-cell">${relation ? escapeHtml(relation) : '-'}</div>
                                                            <div class="member-row-cell member-civil-status-cell">${civilStatus ? escapeHtml(civilStatus) : '-'}</div>
                                                            <div class="member-row-cell member-status-cell">${escapeHtml(recordStatus)}</div>
                                                            <div class="member-row-cell member-contact-cell">${contact ? escapeHtml(contact) : '-'}</div>
                                                            <div class="member-row-cell member-occupation-cell">${occupation ? escapeHtml(occupation.length > 12 ? occupation.substring(0, 12) + '...' : occupation) : '-'}</div>
                                                            <div class="member-row-cell member-workplace-cell">${placeOfWork ? escapeHtml(placeOfWork.length > 15 ? placeOfWork.substring(0, 15) + '...' : placeOfWork) : '-'}</div>
                                                            <div class="member-row-cell member-disabilities-cell">${disabilities ? escapeHtml(disabilities.length > 15 ? disabilities.substring(0, 15) + '...' : disabilities) : '-'}</div>
                                                            <div class="member-row-cell member-benefits-cell">${benefits ? escapeHtml(benefits.length > 15 ? benefits.substring(0, 15) + '...' : benefits) : '-'}</div>
                                                            <div class="member-row-cell member-actions-cell" onclick="event.stopPropagation()">
                                                                ${rowId > 0 ? `<span class="member-action-btns">
                                                                <button type="button" class="member-block-btn" title="Block resident" aria-label="Block resident" ${recordStatus === 'Blocked' ? 'disabled' : ''} onclick="blockCensusMember(${rowId}, event)"><i class="fas fa-ban"></i></button>
                                                                <button type="button" class="member-remove-btn" title="Archive resident" aria-label="Archive resident" onclick="removeCensusMember(${rowId}, event)"><i class="fas fa-trash-alt"></i></button>
                                                                </span>` : ''}
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

    const statisticsDivFolder = document.getElementById('censusStatistics');
    if (statisticsDivFolder) {
        statisticsDivFolder.style.display = 'flex';
    }
    updateCensusScrollToTopVisibility();
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

/** Kapag may filter tab (PWD, atbp.), i-sync ang stats bar sa filteredCensusData — hindi sa buong database. */
function refreshCensusStatisticsBar() {
    const statisticsDiv = document.getElementById('censusStatistics');
    if (!statisticsDiv || statisticsDiv.style.display === 'none') {
        return;
    }
    if (!censusFilterActive || !censusFilterCategory) {
        if (censusStatistics) {
            updateStatistics(censusStatistics);
        }
        return;
    }
    let total = 0;
    let male = 0;
    let female = 0;
    let pwd = 0;
    filteredCensusData.forEach((h) => {
        (h.members || []).forEach((m) => {
            total++;
            const sex = String(m.sex || m.gender || '').toLowerCase();
            if (sex === 'male' || sex === 'm') {
                male++;
            } else if (sex === 'female' || sex === 'f') {
                female++;
            }
            if (memberDisabilitiesColumnHasValue(m)) {
                pwd++;
            }
        });
    });
    const statTotal = document.getElementById('statTotal');
    const statMale = document.getElementById('statMale');
    const statFemale = document.getElementById('statFemale');
    const statDisabilities = document.getElementById('statDisabilities');
    if (statTotal) statTotal.textContent = String(total);
    if (statMale) statMale.textContent = String(male);
    if (statFemale) statFemale.textContent = String(female);
    if (statDisabilities) statDisabilities.textContent = String(pwd);
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
    const hhRaw = document.getElementById('addCensusHousehold').value.trim();
    /** Empty or "0" = bagong household; otherwise CEN-00001 mula sa dropdown. */
    const censusIdPayload = hhRaw === '' || hhRaw === '0' ? '' : hhRaw;
    const payload = {
        action: 'add',
        census_id: censusIdPayload,
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
        sitio: document.getElementById('add_sitio').value.trim(),
        indigenous: document.getElementById('add_indigenous')?.checked ? 1 : 0
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

async function blockCensusMember(id, ev) {
    if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
    }
    const n = parseInt(id, 10);
    if (!n || Number.isNaN(n)) return;

    let confirmed = false;
    if (typeof Swal !== 'undefined' && Swal.fire) {
        const result = await Swal.fire({
            title: 'Block this resident?',
            html: 'Their <strong>census record status</strong> will be set to <strong>Blocked</strong> (with timestamp). They can still be archived later.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, block',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#b9770e',
            cancelButtonColor: '#6c757d',
            focusCancel: true,
            reverseButtons: true
        });
        confirmed = result.isConfirmed === true;
    } else {
        confirmed = confirm('Mark this resident as Blocked on the census?');
    }
    if (!confirmed) return;

    try {
        const response = await fetch('php/census.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ action: 'block', id: n })
        });
        if (response.status === 403) {
            alert('Please log in or you do not have permission to block census records.');
            return;
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            alert(data.error || 'Could not block resident.');
            return;
        }
        await loadCensusData();
    } catch (e) {
        console.error(e);
        alert('Could not block resident. Please try again.');
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
        
        let displayText = 'N/A';
        if (lowerKey === 'indigenous') {
            displayText = formatIndigenousYesNo(member);
        } else if (value !== null && value !== undefined && value !== '') {
            displayText = String(value);
        } else if (value === 0 || value === '0') {
            displayText = '0';
        }

        html += `
            <div class="view-field">
                <label>${formatColumnName(key)}</label>
                <div class="field-value">${escapeHtml(displayText)}</div>
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
    const k = String(key).toLowerCase();
    if (k === 'birthday') {
        return 'Birthdate';
    }
    if (k === 'status') {
        return 'Status';
    }
    if (k === 'civil_status') {
        return 'Civil status';
    }
    if (k === 'indigenous') {
        return 'Indigenous (IP)';
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

function getBenefitsStr(m) {
    return String(m.barangay_supported_benefits || m.barangay_supported || m.benefits || '').trim();
}

function isBeneficiaryMember(m) {
    const b = getBenefitsStr(m);
    if (!b) {
        return false;
    }
    const low = b.toLowerCase();
    if (/^(none|n\/a|n\/a\.|wala|walang|no|no benefits|-)$/i.test(low)) {
        return false;
    }
    return true;
}

function getOccupationStr(m) {
    const direct = String(m.occupation || m.job || m.employment || m.work || '').trim();
    if (direct) {
        return direct;
    }
    const obj = m || {};
    for (const k of Object.keys(obj)) {
        if (/occupation|employment|work_status|job_title|hanapbuhay/i.test(k)) {
            const v = obj[k];
            if (v != null && String(v).trim() !== '') {
                return String(v).trim();
            }
        }
    }
    return '';
}

/** May trabaho kung may makabuluhang lugar ng trabaho kahit blangko ang occupation (karaniwan sa census) */
function hasMeaningfulPlaceOfWork(m) {
    const p = String(m.place_of_work || m.placeOfWork || m.place_of_employment || '').trim().toLowerCase();
    if (!p) {
        return false;
    }
    if (/^(none|n\/a|n\/a\.|wala|walang|no|-|\.{1,3})$/i.test(p)) {
        return false;
    }
    return true;
}

/** Walang trabaho / blangko / obvious na unemployed */
function isMemberUnemployed(m) {
    if (hasMeaningfulPlaceOfWork(m)) {
        return false;
    }
    const occ = getOccupationStr(m).toLowerCase();
    if (!occ) {
        return true;
    }
    if (/^(none|n\/a|n\/a\.|wala|walang|no|-|\.{1,3})$/i.test(occ)) {
        return true;
    }
    if (/\bunemployed\b|walang\s+trabaho|walang\s+hanapbuhay|not\s+employed|no\s+work\b/i.test(occ)) {
        return true;
    }
    return false;
}

function isMemberEmployed(m) {
    if (hasMeaningfulPlaceOfWork(m)) {
        return true;
    }
    return !isMemberUnemployed(m);
}

/** Teksto mula sa DB column na `occupation` lamang (Employed tab). */
function getOccupationColumnText(m) {
    if (!m || !Object.prototype.hasOwnProperty.call(m, 'occupation')) {
        return '';
    }
    const v = m.occupation;
    if (v === null || v === undefined) {
        return '';
    }
    return String(v).trim();
}

/**
 * Employed tab: kasama lang kung ang `occupation` ay nagpapakita ng employed (may salitang "employed"),
 * hindi "Unemployed" / placeholder. Hal. "Employed", "Self-employed", "Student | Employed".
 */
function memberOccupationColumnIsEmployedStatus(m) {
    const raw = getOccupationColumnText(m);
    if (raw === '') {
        return false;
    }
    const t = raw.toLowerCase();
    if (/\bunemployed\b|walang\s+trabaho|not\s+employed|no\s+work|^n\/a$|^none$|^-$|^wala$/i.test(t)) {
        return false;
    }
    return /\bemployed\b/i.test(raw);
}

/**
 * Unemployed tab: `occupation` column lang — kasama kung ang status ay unemployed (may salitang "unemployed" o katumbas).
 * Hindi kasama ang blangko; hindi kasama kung malinaw na "employed" lang (hindi "unemployed").
 */
function memberOccupationColumnIsUnemployedStatus(m) {
    const raw = getOccupationColumnText(m);
    if (raw === '') {
        return false;
    }
    const t = raw.toLowerCase();
    if (/\bemployed\b/i.test(raw) && !/\bunemployed\b/i.test(raw)) {
        return false;
    }
    return /\bunemployed\b|walang\s+trabaho|walang\s+hanapbuhay|not\s+employed|no\s+work\b/i.test(t);
}

/**
 * Students tab: `occupation` column lang — kasama kung ang status ay student (hal. "Student", "estudyante", "pupil").
 */
function memberOccupationColumnIsStudentStatus(m) {
    const raw = getOccupationColumnText(m);
    if (raw === '') {
        return false;
    }
    const t = raw.toLowerCase();
    if (/\bnot\s+a\s+student\b|\bnon-?student\b/i.test(t)) {
        return false;
    }
    return /\bstudent\b|\bestudyante\b|\bpupil\b|studyante/i.test(t);
}

/** Edad mula sa field na `age` o sa birthday — para sa senior / iba pang filter */
function getMemberAgeYears(m) {
    const raw = m.age;
    if (raw !== undefined && raw !== null && raw !== '') {
        const num = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
        if (!Number.isNaN(num) && num >= 0 && num < 150) {
            return num;
        }
    }
    const bdRaw =
        m.birthday ||
        m.birth_date ||
        m.birthDate ||
        m.birthdate ||
        m.date_of_birth ||
        m.dateOfBirth;
    if (!bdRaw) {
        return null;
    }
    const s = String(bdRaw).trim();
    let d = null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        d = new Date(s.slice(0, 10) + 'T12:00:00');
    } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) {
        const parts = s.split(/[\/\-]/);
        const a = parseInt(parts[0], 10);
        const b = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (a > 12) {
            d = new Date(y, b - 1, a, 12, 0, 0, 0);
        } else if (b > 12) {
            d = new Date(y, a - 1, b, 12, 0, 0, 0);
        } else {
            d = new Date(y, a - 1, b, 12, 0, 0, 0);
        }
    } else {
        d = new Date(s.replace(' ', 'T'));
    }
    if (!d || Number.isNaN(d.getTime())) {
        return null;
    }
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const b = new Date(d);
        b.setHours(0, 0, 0, 0);
        let age = today.getFullYear() - b.getFullYear();
        const md = today.getMonth() - b.getMonth();
        if (md < 0 || (md === 0 && today.getDate() < b.getDate())) {
            age--;
        }
        return age >= 0 ? age : null;
    } catch (e) {
        return null;
    }
}

/** PH: senior citizen discount — 60 pataas */
const SENIOR_CITIZEN_MIN_AGE = 60;

function isMemberSeniorCitizen(m) {
    const age = getMemberAgeYears(m);
    if (age === null || age === undefined) {
        return false;
    }
    return age >= SENIOR_CITIZEN_MIN_AGE;
}

/** Legacy: dating broad search; Students tab ay `memberOccupationColumnIsStudentStatus` (occupation column) na. */
function isMemberStudent(m) {
    return memberOccupationColumnIsStudentStatus(m);
}

function getDisabilityText(m) {
    const d =
        m.disabilities ||
        m.disability ||
        m.pwd ||
        m.person_with_disability ||
        m.has_disability ||
        m.with_disability ||
        '';
    return String(d || '').trim();
}

/** Teksto mula sa DB column na `disabilities` lamang (para sa PWD tab / filter). */
function getDisabilitiesColumnText(m) {
    if (!m || !Object.prototype.hasOwnProperty.call(m, 'disabilities')) {
        return '';
    }
    const v = m.disabilities;
    if (v === null || v === undefined) {
        return '';
    }
    const s = String(v).trim();
    if (s === '' || /^null$/i.test(s)) {
        return '';
    }
    return s;
}

/**
 * Hindi itinuturing na PWD ang placeholder sa DB (hal. "None", "N/A") — dapat hindi lumabas sa PWD filter.
 */
function censusDisabilitiesMeansNoDisability(text) {
    const t = String(text || '').trim().toLowerCase();
    if (t === '') {
        return true;
    }
    if (t === 'null') {
        return true;
    }
    if (
        t === 'none' ||
        t === 'n/a' ||
        t === 'na' ||
        t === '-' ||
        t === '—' ||
        t === 'no' ||
        t === 'walang' ||
        t === 'wala' ||
        t === 'no disability' ||
        t === 'walang disability' ||
        t === 'without disability'
    ) {
        return true;
    }
    return false;
}

/** PWD tab: may tunay na disability text (hindi None / N/A / blangko). */
function memberDisabilitiesColumnHasValue(m) {
    const s = getDisabilitiesColumnText(m);
    if (s === '') {
        return false;
    }
    return !censusDisabilitiesMeansNoDisability(s);
}

function memberHasPwdRecord(m) {
    return memberDisabilitiesColumnHasValue(m);
}

function normalizeSitio(value) {
    return String(value || '').trim().toLowerCase();
}

function populateSitioFilterOptions() {
    const sitioSelect = document.getElementById('censusFilterSitio');
    if (!sitioSelect) {
        return;
    }

    const selected = sitioSelect.value || '';
    const sitioSet = new Set(CENSUS_SITIO_OPTIONS);

    allCensusData.forEach((house) => {
        const houseSitio = String(house.sitio || '').trim();
        if (houseSitio) {
            sitioSet.add(houseSitio);
        }
        (house.members || []).forEach((member) => {
            const memberSitio = String(member.sitio || '').trim();
            if (memberSitio) {
                sitioSet.add(memberSitio);
            }
        });
    });

    const sitioList = Array.from(sitioSet).sort((a, b) => a.localeCompare(b));
    sitioSelect.innerHTML = '<option value="">All Sitio</option>';
    sitioList.forEach((sitio) => {
        const option = document.createElement('option');
        option.value = sitio;
        option.textContent = sitio;
        sitioSelect.appendChild(option);
    });

    if (selected && sitioList.includes(selected)) {
        sitioSelect.value = selected;
    } else {
        sitioSelect.value = '';
        censusFilterSitioValue = '';
    }
}

function applySitioFilter(houseDataList, selectedSitio) {
    const targetSitio = normalizeSitio(selectedSitio);
    if (!targetSitio) {
        return houseDataList;
    }

    return houseDataList
        .map((house) => {
            const houseSitio = normalizeSitio(house.sitio);
            const addressText = normalizeSitio(
                `${house.address_display || ''} ${house.complete_address || ''} ${house.address || ''}`
            );
            // If selected sitio appears in address text, keep full household.
            if (addressText.includes(targetSitio)) {
                return house;
            }
            if (houseSitio === targetSitio) {
                return house;
            }
            const members = (house.members || []).filter((member) => {
                const memberSitio = normalizeSitio(member.sitio || house.sitio);
                if (memberSitio === targetSitio) {
                    return true;
                }
                const memberAddress = normalizeSitio(
                    `${member.address || ''} ${member.complete_address || ''} ${house.address_display || ''} ${house.complete_address || ''}`
                );
                return memberAddress.includes(targetSitio);
            });
            return {
                ...house,
                members
            };
        })
        .filter((house) => (house.members || []).length > 0);
}

function buildCensusFilterOptionLists() {
    const benSet = new Set();
    const pwdSet = new Set();
    allCensusData.forEach(h => {
        (h.members || []).forEach(m => {
            const b = getBenefitsStr(m);
            if (b && isBeneficiaryMember(m)) {
                benSet.add(b);
            }
            const dt = getDisabilitiesColumnText(m);
            if (dt && !censusDisabilitiesMeansNoDisability(dt)) {
                pwdSet.add(dt);
                dt.split(/[,;/|]+/).forEach(part => {
                    const p = part.trim();
                    if (p.length >= 2 && !censusDisabilitiesMeansNoDisability(p)) {
                        pwdSet.add(p);
                    }
                });
            }
        });
    });
    __censusBenefitList = Array.from(benSet).sort((a, b) => a.localeCompare(b));
    __censusPwdList = Array.from(pwdSet).sort((a, b) => a.localeCompare(b));
}

function memberMatchesActiveFilter(m) {
    if (!censusFilterActive || !censusFilterCategory) {
        return true;
    }
    if (censusFilterSubValue === '__no_match__') {
        return false;
    }
    const cat = censusFilterCategory;
    const sub = censusFilterSubValue;

    if (cat === 'beneficiaries') {
        if (sub === 'ben_any') {
            return isBeneficiaryMember(m);
        }
        if (sub.startsWith('benidx:')) {
            const i = parseInt(sub.slice(7), 10);
            if (Number.isNaN(i) || !__censusBenefitList[i]) {
                return false;
            }
            return getBenefitsStr(m) === __censusBenefitList[i];
        }
        return false;
    }
    if (cat === 'non_beneficiaries') {
        return sub === 'non_all' && !isBeneficiaryMember(m);
    }
    if (cat === 'solo_parent') {
        const cs = String(m.civil_status || m.civilStatus || '').toLowerCase();
        const rel = String(m.relation_to_household || m.relationToHousehold || m.relation || '').toLowerCase();
        const q = String(sub || '').trim().toLowerCase();
        const isWidowed = cs.includes('widowed') || cs.includes('widow') || cs.includes('balo');
        if (!q) {
            return isWidowed;
        }
        return isWidowed && (cs.includes(q) || rel.includes(q));
    }
    if (cat === 'pwds') {
        if (sub === 'pwd_any') {
            return memberDisabilitiesColumnHasValue(m);
        }
        if (sub.startsWith('pwdidx:')) {
            const i = parseInt(sub.slice(7), 10);
            if (Number.isNaN(i) || !__censusPwdList[i]) {
                return false;
            }
            const needle = __censusPwdList[i].toLowerCase();
            const hay = getDisabilitiesColumnText(m).toLowerCase();
            return hay.includes(needle) || hay === needle;
        }
        return false;
    }
    if (cat === 'employed') {
        return memberOccupationColumnIsEmployedStatus(m);
    }
    if (cat === 'unemployed') {
        return memberOccupationColumnIsUnemployedStatus(m);
    }
    if (cat === 'senior_citizen') {
        return isMemberSeniorCitizen(m);
    }
    if (cat === 'students') {
        return memberOccupationColumnIsStudentStatus(m);
    }
    return true;
}

/**
 * Kapag may specific na filter (edad, PWD, atbp.), sa folder ay matching members lang ang ipapakita.
 */
function sliceHousesToMatchingMembers(houseList, pred) {
    return houseList
        .map(h => ({
            ...h,
            members: (h.members || []).filter(pred)
        }))
        .filter(h => (h.members || []).length > 0);
}

function applyTextSearchFilter(houseDataList, searchTerm) {
    if (!searchTerm) {
        return houseDataList;
    }
    const term = searchTerm.toLowerCase();
    return houseDataList.filter(houseData => {
        const houseNo = String(houseData.house_no || '').toLowerCase();
        const sitio = String(houseData.sitio || '').toLowerCase();
        const address = String(houseData.complete_address || '').toLowerCase();
        if (houseNo.includes(term) || sitio.includes(term) || address.includes(term)) {
            return true;
        }
        if (houseData.members && Array.isArray(houseData.members)) {
            return houseData.members.some(member =>
                Object.values(member).some(value => {
                    if (value === null || value === undefined) {
                        return false;
                    }
                    return String(value).toLowerCase().includes(term);
                })
            );
        }
        return false;
    });
}

/**
 * Itugma ang censusFilter* sa hidden input / sub-dropdown kung may piniling category sa UI
 * pero hindi pa naka-activate ang memory state (resulta: lahat ng resident lumilitaw).
 */
function syncCensusFilterStateFromDom() {
    const catEl = document.getElementById('censusFilterCategoryInput');
    const subEl = document.getElementById('censusFilterSub');
    const soloInpEl = document.getElementById('censusFilterSoloInput');
    if (!catEl) {
        return;
    }
    const domCat = (catEl.value || '').trim();
    if (!domCat) {
        return;
    }
    if (censusFilterActive && censusFilterCategory === domCat) {
        return;
    }
    let subVal = '';
    if (domCat === 'solo_parent') {
        subVal = (soloInpEl && soloInpEl.value.trim()) || '';
    } else if (domCat === 'employed') {
        subVal = 'emp';
    } else if (domCat === 'unemployed') {
        subVal = 'unemp';
    } else if (domCat === 'senior_citizen') {
        subVal = 'sc';
    } else if (domCat === 'students') {
        subVal = 'stu';
    } else if (subEl) {
        subVal = subEl.value || '';
    }
    if (!subVal && domCat === 'pwds') {
        subVal = 'pwd_any';
    }
    if (!subVal && domCat === 'beneficiaries') {
        subVal = 'ben_any';
    }
    if (!subVal && domCat === 'non_beneficiaries') {
        subVal = 'non_all';
    }
    const noSubSelect =
        domCat === 'employed' ||
        domCat === 'unemployed' ||
        domCat === 'senior_citizen' ||
        domCat === 'students';
    if (!subVal && domCat !== 'solo_parent' && !noSubSelect) {
        return;
    }
    censusFilterCategory = domCat;
    censusFilterSubValue = subVal;
    censusFilterActive = true;
}

function recomputeFilteredCensusData() {
    syncCensusFilterStateFromDom();
    let data = allCensusData;
    if (censusFilterSitioValue) {
        data = applySitioFilter(data, censusFilterSitioValue);
    }
    if (censusFilterActive && censusFilterCategory) {
        data = sliceHousesToMatchingMembers(data, memberMatchesActiveFilter);
    }
    const term = (document.getElementById('searchInput') && document.getElementById('searchInput').value) || '';
    const t = term.toLowerCase().trim();
    if (t) {
        data = applyTextSearchFilter(data, t);
    }
    filteredCensusData = data;
    renderCensusTable();
    refreshCensusStatisticsBar();
}

function runCensusFilterSearch() {
    const catEl = document.getElementById('censusFilterCategoryInput');
    const subEl = document.getElementById('censusFilterSub');
    const soloInpEl = document.getElementById('censusFilterSoloInput');
    if (!catEl || !subEl) {
        return;
    }
    const cat = catEl.value;
    let subVal = '';
    if (cat === 'solo_parent') {
        subVal = (soloInpEl && soloInpEl.value.trim()) || '';
    } else if (cat === 'employed') {
        subVal = 'emp';
    } else if (cat === 'unemployed') {
        subVal = 'unemp';
    } else if (cat === 'senior_citizen') {
        subVal = 'sc';
    } else if (cat === 'students') {
        subVal = 'stu';
    } else {
        subVal = subEl.value;
    }
    /* Default sub kapag may 2nd dropdown pero walang napiling value (madalas pagkatapos mag-populate — kung hindi, lalabas ang lahat ng resident). */
    if (!subVal && cat === 'pwds') {
        subVal = 'pwd_any';
    }
    if (!subVal && cat === 'beneficiaries') {
        subVal = 'ben_any';
    }
    if (!subVal && cat === 'non_beneficiaries') {
        subVal = 'non_all';
    }
    if (!cat) {
        censusFilterActive = false;
        censusFilterCategory = '';
        censusFilterSubValue = '';
        recomputeFilteredCensusData();
        return;
    }
    const noSubSelect =
        cat === 'employed' ||
        cat === 'unemployed' ||
        cat === 'senior_citizen' ||
        cat === 'students';
    if (!subVal && cat !== 'solo_parent' && !noSubSelect) {
        return;
    }
    censusFilterCategory = cat;
    censusFilterSubValue = subVal;
    censusFilterActive = true;
    recomputeFilteredCensusData();
}

function finalizeCensusSubDropdown() {
    const sub = document.getElementById('censusFilterSub');
    const searchInp = document.getElementById('censusFilterSubSearch');
    if (!sub) {
        return;
    }
    __censusSubAllOptions = Array.from(sub.options).map((o) => ({
        value: o.value,
        label: o.textContent
    }));
    if (searchInp) {
        searchInp.value = '';
        const show = !sub.hidden && __censusSubAllOptions.length >= 2;
        searchInp.hidden = !show;
    }
}

function applyCensusSubSearchFilter(query) {
    const sub = document.getElementById('censusFilterSub');
    if (!sub || __censusSubAllOptions.length === 0) {
        return;
    }
    const q = String(query || '').toLowerCase().trim();
    const prev = sub.value;
    const snapshot = __censusSubAllOptions;
    sub.innerHTML = '';
    const matches = !q ? snapshot.slice() : snapshot.filter((o) => o.label.toLowerCase().includes(q));
    if (matches.length === 0) {
        const o = document.createElement('option');
        o.value = '__no_match__';
        o.textContent = '(Walang tumugma sa hanap)';
        sub.appendChild(o);
        sub.value = '__no_match__';
    } else {
        matches.forEach(({ value, label }) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            sub.appendChild(opt);
        });
        if (matches.some((m) => m.value === prev)) {
            sub.value = prev;
        } else {
            sub.value = matches[0].value;
        }
    }
    runCensusFilterSearch();
}

function populateCensusSubDropdown(cat) {
    const sub = document.getElementById('censusFilterSub');
    const wrap = document.getElementById('censusFilterSubWrap');
    const searchInp = document.getElementById('censusFilterSubSearch');
    if (!sub || !wrap) {
        return;
    }
    sub.innerHTML = '';
    __censusSubAllOptions = [];
    const soloInp = document.getElementById('censusFilterSoloInput');
    if (soloInp) {
        soloInp.hidden = true;
        soloInp.value = '';
    }
    if (searchInp) {
        searchInp.value = '';
        searchInp.hidden = true;
    }
    sub.hidden = false;

    if (!cat) {
        wrap.hidden = true;
        return;
    }

    const addOpt = (value, label) => {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = label;
        sub.appendChild(o);
    };

    if (cat === 'beneficiaries') {
        addOpt('ben_any', 'Lahat ng may benepisyo');
        __censusBenefitList.forEach((text, i) => {
            const short = text.length > 70 ? `${text.slice(0, 67)}…` : text;
            addOpt(`benidx:${i}`, short);
        });
        if (sub.options.length) {
            sub.selectedIndex = 0;
        }
        wrap.hidden = false;
        finalizeCensusSubDropdown();
        return;
    }
    if (cat === 'non_beneficiaries') {
        addOpt('non_all', 'Walang benepisyo / none / blangko');
        if (sub.options.length) {
            sub.selectedIndex = 0;
        }
        wrap.hidden = false;
        finalizeCensusSubDropdown();
        return;
    }
    if (cat === 'solo_parent') {
        sub.hidden = true;
        sub.innerHTML = '';
        if (soloInp) {
            soloInp.hidden = false;
            soloInp.value = '';
        }
        wrap.hidden = false;
        return;
    }
    if (cat === 'pwds') {
        addOpt('pwd_any', 'Anumang PWD');
        __censusPwdList.forEach((text, i) => {
            const short = text.length > 70 ? `${text.slice(0, 67)}…` : text;
            addOpt(`pwdidx:${i}`, short);
        });
        if (sub.options.length) {
            sub.selectedIndex = 0;
        }
        wrap.hidden = false;
        finalizeCensusSubDropdown();
        return;
    }
    if (cat === 'employed' || cat === 'unemployed' || cat === 'senior_citizen' || cat === 'students') {
        sub.hidden = true;
        sub.innerHTML = '';
        wrap.hidden = true;
        return;
    }

    wrap.hidden = true;
}

function censusTabDataToCat(dataCat) {
    if (dataCat === '__all__' || dataCat === null || dataCat === '') {
        return '';
    }
    return String(dataCat);
}

function syncCensusFilterTabs(selectedCat) {
    const root = document.getElementById('censusFilterBar');
    if (!root) {
        return;
    }
    root.querySelectorAll('.census-filter-tab').forEach((btn) => {
        const v = censusTabDataToCat(btn.getAttribute('data-cat'));
        const isSel = v === selectedCat;
        btn.classList.toggle('is-active', isSel);
        btn.setAttribute('aria-selected', isSel ? 'true' : 'false');
    });
}

function applyCensusCategoryChange(cat) {
    const catEl = document.getElementById('censusFilterCategoryInput');
    if (catEl) {
        catEl.value = cat;
    }
    syncCensusFilterTabs(cat);
    censusFilterCategory = '';
    censusFilterSubValue = '';
    censusFilterActive = false;
    if (!cat) {
        const wrap = document.getElementById('censusFilterSubWrap');
        const si = document.getElementById('censusFilterSoloInput');
        const sub = document.getElementById('censusFilterSub');
        const ss = document.getElementById('censusFilterSubSearch');
        __censusSubAllOptions = [];
        if (wrap) {
            wrap.hidden = true;
        }
        if (si) {
            si.hidden = true;
            si.value = '';
        }
        if (sub) {
            sub.hidden = false;
        }
        if (ss) {
            ss.hidden = true;
            ss.value = '';
        }
        recomputeFilteredCensusData();
        return;
    }
    populateCensusSubDropdown(cat);
    runCensusFilterSearch();
}

function setupCensusFilterControls() {
    const sitioEl = document.getElementById('censusFilterSitio');
    const catEl = document.getElementById('censusFilterCategoryInput');
    const subEl = document.getElementById('censusFilterSub');
    if (!sitioEl || !catEl || !subEl) {
        return;
    }

    const soloInpEl = document.getElementById('censusFilterSoloInput');
    const subSearchEl = document.getElementById('censusFilterSubSearch');

    let soloFilterDebounce = null;
    let subSearchDebounce = null;
    const runSoloFilterDebounced = () => {
        if (soloFilterDebounce) {
            clearTimeout(soloFilterDebounce);
        }
        soloFilterDebounce = setTimeout(() => {
            if (catEl.value === 'solo_parent') {
                runCensusFilterSearch();
            }
        }, 200);
    };

    sitioEl.addEventListener('change', () => {
        censusFilterSitioValue = sitioEl.value || '';
        recomputeFilteredCensusData();
    });

    document.querySelectorAll('#censusFilterBar .census-filter-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
            const cat = censusTabDataToCat(btn.getAttribute('data-cat'));
            applyCensusCategoryChange(cat);
        });
    });
    syncCensusFilterTabs(censusTabDataToCat(catEl.value));

    subEl.addEventListener('change', runCensusFilterSearch);

    if (soloInpEl) {
        soloInpEl.addEventListener('input', runSoloFilterDebounced);
        soloInpEl.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (soloFilterDebounce) {
                    clearTimeout(soloFilterDebounce);
                }
                runCensusFilterSearch();
            }
        });
    }

    if (subSearchEl) {
        subSearchEl.addEventListener('input', () => {
            if (subSearchDebounce) {
                clearTimeout(subSearchDebounce);
            }
            subSearchDebounce = setTimeout(() => {
                applyCensusSubSearchFilter(subSearchEl.value);
            }, 200);
        });
        subSearchEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (subSearchDebounce) {
                    clearTimeout(subSearchDebounce);
                }
                applyCensusSubSearchFilter(subSearchEl.value);
            }
        });
    }
}

// Search functions
function searchCensus() {
    recomputeFilteredCensusData();
}

function clearSearch() {
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = '';
    }
    recomputeFilteredCensusData();
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
                        <th>Civil status</th>
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
                        const recordStatus = String(member.status != null ? member.status : 'Censused').trim() || 'Censused';
                        const contact = member.contact_number || member.contact || member.contactNumber || member.phone || member.phone_number || member.phoneNumber || member.mobile || member.mobile_number || member.mobileNumber || '';
                        const occupation = member.occupation || member.job || member.employment || member.work || '';
                        const placeOfWork = member.place_of_work || member.placeOfWork || member.place_of_employment || '';
                        const relation = member.relation_to_household || member.relationToHousehold || member.relation || '';
                        const benefits = member.barangay_supported_benefits || member.barangay_supported || member.benefits || '';
                        const disabilities = getDisabilitiesColumnText(member);
                        
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
                                <td>${escapeHtml(recordStatus)}</td>
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

