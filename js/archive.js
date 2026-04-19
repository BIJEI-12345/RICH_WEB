// Archive Management JavaScript

// Global variables
let allArchiveData = [];
let filteredArchiveData = [];
let currentPage = 1;
let currentCategory = '';
let currentDocumentType = '';
const itemsPerPage = 20;

// Check if user is admin
document.addEventListener('DOMContentLoaded', async function() {
    // Wait for Session object to be available
    let retries = 0;
    while (typeof Session === 'undefined' && retries < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
    }
    
    if (typeof Session === 'undefined') {
        console.error('Session object not found');
        return;
    }
    
    // Load session if not already loaded
    if (!Session.data || !Session.data.logged_in) {
        await Session.load();
    }
    
    // Now check position
    const position = (Session.data.position || '').toLowerCase();
    if (position !== 'admin') {
        // Redirect non-admin users
        window.location.href = 'admin-dashboard.html';
        return;
    }
    
    // Initialize archive page
    initializeArchive();
});

// Navigation functions
function goToDashboard() {
    window.location.href = 'admin-dashboard.html';
}

// Initialize archive page
function initializeArchive() {
    // Set default active button
    const buttons = document.querySelectorAll('.action-btn');
    buttons.forEach(btn => btn.classList.remove('selected'));
    
    // Load default category (concern)
    loadArchiveData('concern');
}

/**
 * Flatten grouped census API payload into table rows (removed residents only).
 * Fields align with the main census member row (Name … Benefits) + Removed At.
 */
function flattenCensusArchiveRows(data) {
    const rows = [];
    if (!data || !Array.isArray(data.census)) {
        return rows;
    }
    for (const house of data.census) {
        const addr = house.address_display || house.complete_address || house.address || '';
        for (const m of house.members || []) {
            const lastName = (m.last_name || m.lastname || m.lastName || '').trim();
            const firstName = (m.first_name || m.firstname || m.firstName || '').trim();
            const middle = (m.middle_name || m.middlename || m.middleName || '').trim();
            let fullName = '—';
            if (lastName && firstName) {
                fullName = `${lastName}, ${firstName}${middle ? ' ' + middle : ''}`;
            } else if (lastName || firstName) {
                fullName = `${lastName}${firstName}`.trim();
            }
            const id = m.id != null && m.id !== '' ? Number(m.id) : 0;
            if (!id) {
                continue;
            }

            const contact = m.contact_number || m.contact || m.contactNumber || m.phone || m.phone_number || m.mobile || '';
            const occupation = m.occupation || m.job || '';
            const placeOfWork = m.place_of_work || m.placeOfWork || '';
            const relation = m.relation_to_household || m.relationToHousehold || m.relation || '';
            const civilStatus = m.civil_status || m.civilStatus || '';
            const disabilities = m.disabilities || m.disability || '';
            const benefits = m.barangay_supported_benefits || m.barangay_supported || m.benefits || '';

            let ageDisp = '—';
            if (m.age != null && m.age !== '') {
                ageDisp = String(m.age);
            }

            const sex = (m.sex || m.gender || '').trim() || '—';

            rows.push({
                id,
                full_name: fullName,
                address: addr || '—',
                birthday: m.birthday || m.birth_date || m.birthDate || '',
                age: ageDisp,
                sex,
                relation: relation || '—',
                civil_status: civilStatus || '—',
                contact: contact || '—',
                occupation: occupation || '—',
                place_of_work: placeOfWork || '—',
                disabilities: disabilities || '—',
                benefits: benefits || '—',
                census_status: (m.status && String(m.status).trim() !== '') ? String(m.status).trim() : 'Archived',
                archived_at: m.archived_at || ''
            });
        }
    }
    return rows;
}

async function loadCensusArchiveData() {
    const buttons = document.querySelectorAll('.action-btn');
    buttons.forEach(btn => btn.classList.remove('selected'));
    const censusBtn = document.querySelector('.archive-census-btn');
    if (censusBtn) {
        censusBtn.classList.add('selected');
    }

    try {
        const response = await fetch('php/census.php?view=archive', {
            credentials: 'same-origin',
            cache: 'no-store'
        });
        if (response.status === 403) {
            showError('You do not have permission to view census archive.');
            return;
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            showError(data.error || 'Failed to load census archive.');
            return;
        }
        allArchiveData = flattenCensusArchiveRows(data);
        filteredArchiveData = allArchiveData;
        renderArchiveTable();
    } catch (error) {
        console.error('Error loading census archive:', error);
        showError('Failed to load census archive. Please try again.');
    }
}

// Load archive data based on category
async function loadArchiveData(category) {
    currentCategory = category;
    currentPage = 1;
    currentDocumentType = '';
    
    // Show/hide document type tabs
    const documentTypeTabs = document.getElementById('documentTypeTabs');
    if (category === 'census') {
        if (documentTypeTabs) {
            documentTypeTabs.style.display = 'none';
        }
        const docTabs = document.querySelectorAll('.doc-type-tab');
        docTabs.forEach(tab => tab.classList.remove('active'));
        await loadCensusArchiveData();
        return;
    }

    if (category === 'document') {
        if (documentTypeTabs) {
            documentTypeTabs.style.display = 'flex';
        }
        // Load all documents first, then filter by default tab (barangay_id)
        await loadDocumentType('barangay_id');
        return;
    } else {
        if (documentTypeTabs) {
            documentTypeTabs.style.display = 'none';
        }
        // Reset document type tabs
        const docTabs = document.querySelectorAll('.doc-type-tab');
        docTabs.forEach(tab => tab.classList.remove('active'));
    }
    
    // Update active button
    const buttons = document.querySelectorAll('.action-btn');
    buttons.forEach(btn => btn.classList.remove('selected'));
    
    const categoryMap = {
        'concern': 'archive-concern-btn',
        'emergency': 'archive-emergency-btn',
        'document': 'archive-docu-btn',
        'census': 'archive-census-btn'
    };
    
    const activeBtn = document.querySelector(`.${categoryMap[category]}`);
    if (activeBtn) {
        activeBtn.classList.add('selected');
    }
    
    try {
        const response = await fetch(`php/archive.php?category=${category}`);
        
        // Check if response is OK
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error('Response is not JSON. Received: ' + text.substring(0, 100));
        }
        
        const data = await response.json();
        
        if (data.success && data.archive) {
            allArchiveData = data.archive;
            filteredArchiveData = allArchiveData;
            renderArchiveTable();
        } else {
            showError('Failed to load archive data: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error loading archive data:', error);
        showError('Failed to load archive data. Please try again.');
    }
}

// Load specific document type
async function loadDocumentType(documentType) {
    if (currentCategory !== 'document') {
        return;
    }
    
    // Show loading overlay with document type-specific message
    const documentTypeNames = {
        'barangay_id': 'Barangay ID',
        'coe': 'COE',
        'certification': 'Certification',
        'clearance': 'Clearance',
        'indigency': 'Indigency'
    };
    currentDocumentType = documentType;
    currentPage = 1;
    
    // Ensure document request button is selected
    const buttons = document.querySelectorAll('.action-btn');
    buttons.forEach(btn => btn.classList.remove('selected'));
    const docuBtn = document.querySelector('.archive-docu-btn');
    if (docuBtn) {
        docuBtn.classList.add('selected');
    }
    
    // Update active tab
    const docTabs = document.querySelectorAll('.doc-type-tab');
    docTabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-type') === documentType) {
            tab.classList.add('active');
        }
    });
    
    try {
        const response = await fetch(`php/archive.php?category=document&document_type=${documentType}`);
        
        // Check if response is OK
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error('Response is not JSON. Received: ' + text.substring(0, 100));
        }
        
        const data = await response.json();
        
        if (data.success && data.archive) {
            allArchiveData = data.archive;
            filteredArchiveData = allArchiveData;
            renderArchiveTable();
        } else {
            showError('Failed to load archive data: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error loading document type archive:', error);
        showError('Failed to load archive data. Please try again.');
    }
}

// Render archive table
function renderArchiveTable() {
    const tbody = document.getElementById('archive-body');
    const thead = document.getElementById('archiveTableHead');
    const tableContainer = document.querySelector('.table-container');
    
    if (filteredArchiveData.length === 0) {
        const emptyTable = document.getElementById('archiveTable');
        if (emptyTable) {
            emptyTable.classList.remove('archive-table--census');
        }
        // Add empty class to stretch the container
        if (tableContainer) {
            tableContainer.classList.add('empty');
        }
        thead.innerHTML = '<tr></tr>';
        tbody.innerHTML = `
            <tr style="height: 100%;">
                <td colspan="100%" style="text-align: center; padding: 4rem 2rem; color: #666; vertical-align: middle; height: 100%;">
                    <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; display: block; color: #ccc;"></i>
                    <p style="font-size: 1.1rem;">No archived records found</p>
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
    
    // Get column headers based on category
    const columns = getColumnsForCategory(currentCategory);
    
    const archiveTable = document.getElementById('archiveTable');
    if (archiveTable) {
        archiveTable.classList.toggle('archive-table--census', currentCategory === 'census');
    }

    // Create table header
    thead.innerHTML = `
        <tr>
            ${columns.map(col => `<th>${col.label}</th>`).join('')}
        </tr>
    `;
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredArchiveData.slice(startIndex, endIndex);
    
    // Create table rows
    tbody.innerHTML = pageData.map((record, index) => {
        const actualIndex = startIndex + index;
        return `
            <tr>
                ${columns.map(col => {
                    if (col.type === 'census_return') {
                        const rid = record.id;
                        return `<td class="archive-actions-cell"><button type="button" class="archive-census-return-btn" onclick="restoreCensusFromArchive(${rid})"><i class="fas fa-undo"></i> Return</button></td>`;
                    }

                    const value = record[col.key] || '';
                    let displayValue = value;

                    if (col.key === 'purpose') {
                        if (!value || String(value).trim() === '') {
                            displayValue = '—';
                        } else {
                            displayValue = String(value).replace(/-/g, ' ');
                        }
                    }
                    
                    // Format date values
                    if (col.type === 'date' && value) {
                        displayValue = formatDate(value);
                    }
                    
                    // Format status
                    if (col.type === 'status' && value) {
                        displayValue = formatStatus(value);
                    }
                    
                    // Truncate long values (per-column limit for wide census tables)
                    const maxLen = typeof col.truncate === 'number' ? col.truncate : 50;
                    if (typeof displayValue === 'string' && displayValue.length > maxLen) {
                        return `<td title="${escapeHtml(displayValue)}">${escapeHtml(displayValue.substring(0, maxLen))}...</td>`;
                    }
                    
                    return `<td>${escapeHtml(displayValue)}</td>`;
                }).join('')}
            </tr>
        `;
    }).join('');
    
    // Update pagination info
    updatePaginationInfo();
}

// Get columns based on category
function getColumnsForCategory(category) {
    const columnMap = {
        'concern': [
            { key: 'reporter_name', label: 'Reporter Name' },
            { key: 'contact', label: 'Contact' },
            { key: 'date_and_time', label: 'Date & Time', type: 'date' },
            { key: 'location', label: 'Location' },
            { key: 'statement', label: 'Statement' },
            { key: 'status', label: 'Status', type: 'status' },
            { key: 'resolved_at', label: 'Resolved At', type: 'date' }
        ],
        'emergency': [
            { key: 'reporter_name', label: 'Reporter Name' },
            { key: 'location', label: 'Location' },
            { key: 'date_and_time', label: 'Date & Time', type: 'date' },
            { key: 'description', label: 'Description' },
            { key: 'status', label: 'Status', type: 'status' },
            { key: 'resolved_datetime', label: 'Resolved At', type: 'date' }
        ],
        'document': [
            { key: 'documentType', label: 'Document Type' },
            { key: 'purpose', label: 'Purpose', truncate: 40 },
            { key: 'surname', label: 'Surname' },
            { key: 'givenname', label: 'Given Name' },
            { key: 'address', label: 'Address' },
            { key: 'status', label: 'Status', type: 'status' },
            { key: 'submittedAt', label: 'Submitted At', type: 'date' },
            { key: 'finishAt', label: 'Finished At', type: 'date' }
        ],
        'census': [
            { key: 'full_name', label: 'Name', truncate: 42 },
            { key: 'address', label: 'Household / Address', truncate: 96 },
            { key: 'census_status', label: 'Status', truncate: 14 },
            { key: 'birthday', label: 'Birthdate', type: 'date' },
            { key: 'age', label: 'Age' },
            { key: 'sex', label: 'Sex' },
            { key: 'relation', label: 'Relation', truncate: 28 },
            { key: 'civil_status', label: 'Civil status', truncate: 22 },
            { key: 'contact', label: 'Contact', truncate: 22 },
            { key: 'occupation', label: 'Occupation', truncate: 28 },
            { key: 'place_of_work', label: 'Place of Work', truncate: 36 },
            { key: 'disabilities', label: 'Disabilities', truncate: 28 },
            { key: 'benefits', label: 'Benefits', truncate: 28 },
            { key: 'archived_at', label: 'Archived at', type: 'date' },
            { key: 'id', label: 'Action', type: 'census_return' }
        ]
    };
    
    return columnMap[category] || [];
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

// Format status
function formatStatus(status) {
    if (!status) return 'N/A';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

// Escape HTML
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Pagination functions
function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderArchiveTable();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredArchiveData.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderArchiveTable();
    }
}

function updatePaginationInfo() {
    const totalPages = Math.ceil(filteredArchiveData.length / itemsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages || 1}`;
}

async function restoreCensusFromArchive(id) {
    const n = parseInt(id, 10);
    if (!n || Number.isNaN(n)) return;

    let confirmed = false;
    if (typeof Swal !== 'undefined' && Swal.fire) {
        const result = await Swal.fire({
            title: 'Return to active census?',
            html: 'This resident will appear again in the <strong>Census</strong> list.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, return',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#1e6b2b',
            cancelButtonColor: '#6c757d',
            focusCancel: true,
            reverseButtons: true
        });
        confirmed = result.isConfirmed === true;
    } else {
        confirmed = confirm('Return this resident to the active census list?');
    }
    if (!confirmed) return;

    try {
        const response = await fetch('php/census.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ action: 'restore', id: n })
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 403) {
            if (typeof Swal !== 'undefined' && Swal.fire) {
                Swal.fire({ icon: 'error', title: 'Not allowed', text: 'Only administrators can restore residents.' });
            } else {
                alert('Only administrators can restore residents.');
            }
            return;
        }
        if (!response.ok || data.success === false) {
            const msg = data.error || 'Could not restore resident.';
            if (typeof Swal !== 'undefined' && Swal.fire) {
                Swal.fire({ icon: 'error', title: 'Error', text: msg });
            } else {
                alert(msg);
            }
            return;
        }
        if (typeof Swal !== 'undefined' && Swal.fire) {
            await Swal.fire({
                icon: 'success',
                title: 'Restored',
                text: 'Resident is back on the active census list.',
                timer: 2000,
                showConfirmButton: false
            });
        }
        await loadCensusArchiveData();
    } catch (e) {
        console.error(e);
        if (typeof Swal !== 'undefined' && Swal.fire) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Could not restore resident. Please try again.' });
        } else {
            alert('Could not restore resident. Please try again.');
        }
    }
}

window.restoreCensusFromArchive = restoreCensusFromArchive;

// Show error
function showError(message) {
    const tbody = document.getElementById('archive-body');
    const thead = document.getElementById('archiveTableHead');
    thead.innerHTML = '<tr></tr>';
    tbody.innerHTML = `
        <tr>
            <td colspan="100%" style="text-align: center; padding: 2rem; color: #d32f2f;">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                <p>${escapeHtml(message)}</p>
            </td>
        </tr>
    `;
}
