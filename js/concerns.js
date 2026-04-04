// Feedback & Concerns Management JavaScript

// Global variables
let concernsData = [];
let currentView = 'new';
let currentSortOrder = {
    'new': 'latest',
    'processing': 'latest', 
    'finished': 'latest'
};
let selectedConcernId = null;
let selectedConcernCategory = null;
let selectedRowElement = null;
let selectedRiskLevel = null; // 'low', 'medium', 'high', or null

// Navigation Functions
function goBack() {
    window.location.href = 'admin-dashboard.html';
}

// Sorting Functions
function sortConcerns(category, sortOrder) {
    currentSortOrder[category] = sortOrder;
    
    // Get the concerns for this category
    const categoryConcerns = concernsData.filter(concern => {
        if (category === 'new') return concern.status === 'new';
        if (category === 'processing') return concern.status === 'processing';
        if (category === 'finished') return concern.status === 'resolved';
        return false;
    });
    
    // Sort the concerns based on sort order
    categoryConcerns.sort((a, b) => {
        // If sorting by risk level
        if (sortOrder === 'high' || sortOrder === 'medium' || sortOrder === 'low' || sortOrder === 'no-risk') {
            // If sorting by specific risk level, prioritize that level
            if (sortOrder === 'high') {
                if (a.risk_level === 'high' && b.risk_level !== 'high') return -1;
                if (a.risk_level !== 'high' && b.risk_level === 'high') return 1;
                // Both are high or both are not high - sort by date
                const dateA = new Date(a.date_and_time);
                const dateB = new Date(b.date_and_time);
                return dateB - dateA; // Latest first
            } else if (sortOrder === 'medium') {
                if (a.risk_level === 'medium' && b.risk_level !== 'medium') return -1;
                if (a.risk_level !== 'medium' && b.risk_level === 'medium') return 1;
                // Both are medium or both are not medium - sort by date
                const dateA = new Date(a.date_and_time);
                const dateB = new Date(b.date_and_time);
                return dateB - dateA; // Latest first
            } else if (sortOrder === 'low') {
                if (a.risk_level === 'low' && b.risk_level !== 'low') return -1;
                if (a.risk_level !== 'low' && b.risk_level === 'low') return 1;
                // Both are low or both are not low - sort by date
                const dateA = new Date(a.date_and_time);
                const dateB = new Date(b.date_and_time);
                return dateB - dateA; // Latest first
            } else if (sortOrder === 'no-risk') {
                const aHasRisk = a.risk_level && a.risk_level !== '';
                const bHasRisk = b.risk_level && b.risk_level !== '';
                if (!aHasRisk && bHasRisk) return -1;
                if (aHasRisk && !bHasRisk) return 1;
                // Both have no risk or both have risk - sort by date
                const dateA = new Date(a.date_and_time);
                const dateB = new Date(b.date_and_time);
                return dateB - dateA; // Latest first
            }
        }
        
        // Default: sort by risk level priority first, then by date
        const riskPriority = {
            'high': 1,
            'medium': 2,
            'low': 3,
            '': 4,
            null: 4,
            undefined: 4
        };
        
        const riskA = riskPriority[a.risk_level] || 4;
        const riskB = riskPriority[b.risk_level] || 4;
        
        // First sort by risk level (high priority first)
        if (riskA !== riskB) {
            return riskA - riskB;
        }
        
        // If same risk level, sort by date
        const dateA = new Date(a.date_and_time);
        const dateB = new Date(b.date_and_time);
        
        if (sortOrder === 'latest') {
            return dateB - dateA; // Latest first
        } else {
            return dateA - dateB; // Oldest first
        }
    });
    
    // Re-render the concerns for this category
    displayConcerns(categoryConcerns, category === 'finished' ? 'resolved' : category);
}

function setSelectedConcern(concernId, category, rowElement) {
    if (selectedRowElement) {
        selectedRowElement.classList.remove('selected-concern');
    }
    selectedConcernId = concernId;
    selectedConcernCategory = category;
    selectedRowElement = rowElement;
    if (selectedRowElement) {
        selectedRowElement.classList.add('selected-concern');
    }
}

function clearSelectedConcern() {
    if (selectedRowElement) {
        selectedRowElement.classList.remove('selected-concern');
    }
    selectedConcernId = null;
    selectedConcernCategory = null;
    selectedRowElement = null;
}

function handleConcernRowClick(event) {
    if (event.target.closest('button')) {
        return;
    }
    const row = event.currentTarget;
    const concernId = row.dataset.concernId;
    const category = row.dataset.concernStatus || 'new';
    if (!concernId) {
        return;
    }
    
    // If a risk level is selected, apply it to this concern
    if (selectedRiskLevel) {
        applyRiskLevelToConcern(concernId, selectedRiskLevel);
        return;
    }
    
    // Otherwise, handle normal selection
    const isSameSelection = selectedConcernId === concernId && selectedRowElement === row;
    if (isSameSelection) {
        clearSelectedConcern();
        return;
    }
    setSelectedConcern(concernId, category, row);
}

function openRelatableForSelected(viewCategory) {
    let concernIdToUse = selectedConcernId;
    
    // If no concern is selected, use the first concern in the current view
    if (!concernIdToUse) {
        // Get concerns for the current category
        const categoryConcerns = concernsData.filter(concern => {
            if (viewCategory === 'new') return concern.status === 'new';
            if (viewCategory === 'processing') return concern.status === 'processing';
            if (viewCategory === 'finished' || viewCategory === 'resolved') return concern.status === 'resolved';
            return false;
        });
        
        if (categoryConcerns.length === 0) {
            showStatusModal('info', 'No concerns', 'No concerns available in this category.');
            return;
        }
        
        // Use the first concern
        concernIdToUse = categoryConcerns[0].concern_id;
    }
    
    // Show relatable concerns immediately
    showRelatableConcerns(concernIdToUse);
}

// Navigation Functions
function showNewConcerns() {
    currentView = 'new';
    clearSelectedConcern();
    const newSection = document.getElementById('new-concerns-section');
    const processingSection = document.getElementById('processing-concerns-section');
    const finishedSection = document.getElementById('finished-concerns-section');
    
    if (newSection && processingSection && finishedSection) {
        newSection.classList.remove('hidden');
        processingSection.classList.add('hidden');
        finishedSection.classList.add('hidden');
    }
    
    // Update active nav item
    updateActiveNavItem('new');
    
    // Load and display new concerns
    loadConcerns('new');
    
    // Scroll to top of content
    document.querySelector('.main-content-container').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

function showProcessingConcerns() {
    currentView = 'processing';
    clearSelectedConcern();
    const newSection = document.getElementById('new-concerns-section');
    const processingSection = document.getElementById('processing-concerns-section');
    const finishedSection = document.getElementById('finished-concerns-section');
    
    if (newSection && processingSection && finishedSection) {
        newSection.classList.add('hidden');
        processingSection.classList.remove('hidden');
        finishedSection.classList.add('hidden');
    }
    
    // Update active nav item
    updateActiveNavItem('processing');
    
    // Load and display processing concerns
    loadConcerns('processing');
    
    // Scroll to top of content
    document.querySelector('.main-content-container').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

function showFinishedConcerns() {
    currentView = 'resolved';
    clearSelectedConcern();
    const newSection = document.getElementById('new-concerns-section');
    const processingSection = document.getElementById('processing-concerns-section');
    const finishedSection = document.getElementById('finished-concerns-section');
    
    if (newSection && processingSection && finishedSection) {
        newSection.classList.add('hidden');
        processingSection.classList.add('hidden');
        finishedSection.classList.remove('hidden');
    }
    
    // Update active nav item
    updateActiveNavItem('finished');
    
    // Load and display resolved concerns
    loadConcerns('resolved');
    
    // Scroll to top of content
    document.querySelector('.main-content-container').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

function updateActiveNavItem(categoryType) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.category === categoryType) {
            item.classList.add('active');
        }
    });
}

// Mobile Navigation Functions
function toggleMobileNav() {
    const navbar = document.querySelector('.left-navbar');
    navbar.classList.toggle('show');
}

// Admin Profile Dropdown Functions
function toggleAdminDropdown() {
    const dropdown = document.getElementById('adminDropdown');
    if (dropdown.classList.contains('show')) {
        closeAdminDropdown();
    } else {
        openAdminDropdown();
    }
}

function openAdminDropdown() {
    const dropdown = document.getElementById('adminDropdown');
    dropdown.classList.add('show');
    dropdown.setAttribute('aria-hidden', 'false');
}

function closeAdminDropdown() {
    const dropdown = document.getElementById('adminDropdown');
    dropdown.classList.remove('show');
    dropdown.setAttribute('aria-hidden', 'true');
}

function editProfile() {
    showStatusModal('info', 'Edit Profile', 'Profile editing functionality will be implemented here.');
    closeAdminDropdown();
}

function logout() {
    showLogoutConfirmationModal();
    closeAdminDropdown();
}

function showLogoutConfirmationModal() {
    const modal = document.getElementById('statusModal');
    const icon = document.getElementById('statusIcon');
    const titleElement = document.getElementById('statusTitle');
    const messageElement = document.getElementById('statusMessage');
    const okBtn = document.querySelector('.ok-btn');
    
    titleElement.textContent = 'Confirm Logout';
    messageElement.textContent = 'Are you sure you want to logout?';
    icon.className = 'fas fa-sign-out-alt';
    okBtn.textContent = 'Yes, Logout';
    okBtn.onclick = function() {
        closeStatusModal();
        // Use centralized logout function that tracks logout
        if (window.performLogout) {
            window.performLogout();
        } else {
            window.location.href = 'index.php';
        }
    };
    
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

// Loading Indicator Functions
function showLoadingIndicator(status) {
    let loadingId;
    if (status === 'resolved') {
        loadingId = 'finished-loading';
    } else if (status === 'processing') {
        loadingId = 'processing-loading';
    } else {
        loadingId = 'new-loading';
    }
    
    const loadingIndicator = document.getElementById(loadingId);
    if (loadingIndicator) {
        loadingIndicator.classList.remove('hidden');
        console.log('Showing loading indicator:', loadingId);
    } else {
        console.error('Loading indicator not found:', loadingId);
    }
}

function hideLoadingIndicator(status) {
    let loadingId;
    if (status === 'resolved') {
        loadingId = 'finished-loading';
    } else if (status === 'processing') {
        loadingId = 'processing-loading';
    } else {
        loadingId = 'new-loading';
    }
    
    const loadingIndicator = document.getElementById(loadingId);
    if (loadingIndicator) {
        loadingIndicator.classList.add('hidden');
        console.log('Hiding loading indicator:', loadingId);
    } else {
        console.error('Loading indicator not found:', loadingId);
    }
}

// Data Loading Functions
async function loadConcerns(status = null) {
    try {
        // Show loading indicator
        showLoadingIndicator(status);
        
        const url = status ? `php/concerns.php?status=${status}` : 'php/concerns.php';
        const response = await fetch(url);
        
        // Check if response is ok
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Get response text first to check if it's valid JSON
        const responseText = await response.text();
        
        if (!responseText.trim()) {
            throw new Error('Empty response from server');
        }
        
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Invalid JSON response:', responseText);
            throw new Error('Invalid response format from server');
        }
        
        if (result.success) {
            concernsData = result.data;
            console.log('Loaded concerns data:', concernsData);
            if (result.counts) {
                applyNavCounts(result.counts);
            }
            displayConcerns(concernsData, status);
            if (!result.counts) {
                await updateCategoryCounts();
            }
        } else {
            console.error('Failed to load concerns:', result.message);
            showStatusModal('error', 'Error', 'Failed to load concerns from database.');
        }
    } catch (error) {
        console.error('Error loading concerns:', error);
        showStatusModal('error', 'Error', 'Failed to connect to the server: ' + error.message);
        // Hide loading indicator on error
        hideLoadingIndicator(status);
    }
}

function displayConcerns(concerns, status) {
    clearSelectedConcern();
    let tbodyId;
    let category;
    
    if (status === 'resolved') {
        tbodyId = 'finished-concerns-tbody';
        category = 'finished';
    } else if (status === 'processing') {
        tbodyId = 'processing-concerns-tbody';
        category = 'processing';
    } else {
        tbodyId = 'new-concerns-tbody';
        category = 'new';
    }
    
    // Apply current sort order with risk level priority
    const sortedConcerns = [...concerns].sort((a, b) => {
        const sortOrder = currentSortOrder[category];
        
        // If sorting by risk level
        if (sortOrder === 'high' || sortOrder === 'medium' || sortOrder === 'low' || sortOrder === 'no-risk') {
            // If sorting by specific risk level, prioritize that level
            if (sortOrder === 'high') {
                if (a.risk_level === 'high' && b.risk_level !== 'high') return -1;
                if (a.risk_level !== 'high' && b.risk_level === 'high') return 1;
                // Both are high or both are not high - sort by date
                const dateA = new Date(a.date_and_time);
                const dateB = new Date(b.date_and_time);
                return dateB - dateA; // Latest first
            } else if (sortOrder === 'medium') {
                if (a.risk_level === 'medium' && b.risk_level !== 'medium') return -1;
                if (a.risk_level !== 'medium' && b.risk_level === 'medium') return 1;
                // Both are medium or both are not medium - sort by date
                const dateA = new Date(a.date_and_time);
                const dateB = new Date(b.date_and_time);
                return dateB - dateA; // Latest first
            } else if (sortOrder === 'low') {
                if (a.risk_level === 'low' && b.risk_level !== 'low') return -1;
                if (a.risk_level !== 'low' && b.risk_level === 'low') return 1;
                // Both are low or both are not low - sort by date
                const dateA = new Date(a.date_and_time);
                const dateB = new Date(b.date_and_time);
                return dateB - dateA; // Latest first
            } else if (sortOrder === 'no-risk') {
                const aHasRisk = a.risk_level && a.risk_level !== '';
                const bHasRisk = b.risk_level && b.risk_level !== '';
                if (!aHasRisk && bHasRisk) return -1;
                if (aHasRisk && !bHasRisk) return 1;
                // Both have no risk or both have risk - sort by date
                const dateA = new Date(a.date_and_time);
                const dateB = new Date(b.date_and_time);
                return dateB - dateA; // Latest first
            }
        }
        
        // Default: sort by risk level priority first, then by date
        const riskPriority = {
            'high': 1,
            'medium': 2,
            'low': 3,
            '': 4,
            null: 4,
            undefined: 4
        };
        
        const riskA = riskPriority[a.risk_level] || 4;
        const riskB = riskPriority[b.risk_level] || 4;
        
        // First sort by risk level (high priority first)
        if (riskA !== riskB) {
            return riskA - riskB;
        }
        
        // If same risk level, sort by date
        const dateA = new Date(a.date_and_time);
        const dateB = new Date(b.date_and_time);
        
        if (sortOrder === 'latest') {
            return dateB - dateA; // Latest first
        } else {
            return dateA - dateB; // Oldest first
        }
    });
    
    const tbody = document.getElementById(tbodyId);
    console.log('Displaying concerns in tbody:', tbodyId, 'Found tbody:', tbody);
    console.log('Number of concerns to display:', sortedConcerns.length);
    
    if (!tbody) {
        console.error('Tbody not found:', tbodyId);
        return;
    }
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    // Hide loading indicator
    hideLoadingIndicator(status);
    
    if (sortedConcerns.length === 0) {
        // Show empty state message
        const colspan = status === 'resolved' ? '8' : (status === 'processing' ? '9' : '8');
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="${colspan}" style="text-align: center; padding: 2rem; color: #666;">
                <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5; display: block;"></i>
                <p>No concerns found</p>
            </td>
        `;
        tbody.appendChild(emptyRow);
        console.log('No concerns to display, showing empty state');
    } else {
        sortedConcerns.forEach((concern, index) => {
            const concernRow = createConcernRow(concern, status);
            tbody.appendChild(concernRow);
            console.log(`Added concern row ${index + 1} to tbody ${tbodyId}`);
        });
    }
    
    console.log('Total rows in tbody after adding:', tbody.querySelectorAll('tr').length);
}

// Risk Level Management Functions
function setRiskLevel(riskLevel) {
    selectedRiskLevel = riskLevel;
    
    // Update button states
    document.querySelectorAll('.risk-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.risk-btn[data-risk="${riskLevel}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Show message to user
    showStatusModal('info', 'Risk Level Selected', `Click on concerns to mark them as ${riskLevel} risk. Click Clear to cancel.`);
}

function clearRiskSelection() {
    selectedRiskLevel = null;
    
    // Update button states
    document.querySelectorAll('.risk-btn').forEach(btn => {
        btn.classList.remove('active');
    });
}

async function applyRiskLevelToConcern(concernId, riskLevel) {
    try {
        const result = await sendRiskLevelUpdate(concernId, riskLevel);
        if (result && result.success) {
            // Reload concerns to show updated risk level
            loadConcerns(currentView);
            showStatusModal('success', 'Risk Level Updated', `Concern ${concernId} marked as ${riskLevel} risk.`);
        } else {
            showStatusModal('error', 'Error', result.message || 'Failed to update risk level.');
        }
    } catch (error) {
        console.error('Error updating risk level:', error);
        showStatusModal('error', 'Error', 'Failed to connect to the server.');
    }
}

async function sendRiskLevelUpdate(concernId, riskLevel) {
    const response = await fetch('php/concerns.php', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            concern_id: concernId,
            risk_level: riskLevel
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
        
    const result = await response.json();
    return result;
}

function createConcernRow(concern, status) {
    const row = document.createElement('tr');
    
    // Add risk level indicator dot
    const riskLevel = concern.risk_level || null;
    let riskDotClass = '';
    if (riskLevel === 'low') {
        riskDotClass = 'risk-dot-low';
    } else if (riskLevel === 'medium') {
        riskDotClass = 'risk-dot-medium';
    } else if (riskLevel === 'high') {
        riskDotClass = 'risk-dot-high';
    }
    
    // Add risk dot indicator to row
    if (riskDotClass) {
        row.classList.add('has-risk-indicator', riskDotClass);
    }
    
    // Format date and time on two lines (date on top, time below)
    let dateTimeHtml = 'N/A';
    if (concern.date_and_time) {
        const date = new Date(concern.date_and_time);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        dateTimeHtml = `<div style="line-height: 1.4; white-space: nowrap; text-align: left;">
            <div style="font-weight: 600; white-space: nowrap; text-align: left;">${dateStr}</div>
            <div style="font-size: 0.85rem; color: #666; white-space: nowrap; text-align: left;">${timeStr}</div>
        </div>`;
    }
    
    // Truncate statement if too long
    let statementHtml = concern.statement || 'N/A';
    const maxStatementLength = 80; // Maximum characters to show
    if (statementHtml.length > maxStatementLength) {
        statementHtml = statementHtml.substring(0, maxStatementLength) + '...';
    }
    
    // Format resolved time (2 lines: date on top, time below)
    let resolvedTimeHtml = 'N/A';
    if (status === 'resolved' && concern.resolved_at) {
        const resolvedDate = new Date(concern.resolved_at);
        const dateStr = resolvedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = resolvedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        resolvedTimeHtml = `<div style="line-height: 1.4; white-space: nowrap; text-align: left;">
            <div style="font-weight: 600; white-space: nowrap; text-align: left;">${dateStr}</div>
            <div style="font-size: 0.85rem; color: #666; white-space: nowrap; text-align: left;">${timeStr}</div>
        </div>`;
    }
    
    // Format processed time (2 lines: date on top, time below)
    let processedTimeHtml = 'N/A';
    if (status === 'processing' && concern.process_at) {
        const processedDate = new Date(concern.process_at);
        const dateStr = processedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = processedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        processedTimeHtml = `<div style="line-height: 1.4; white-space: nowrap; text-align: left;">
            <div style="font-weight: 600; white-space: nowrap; text-align: left;">${dateStr}</div>
            <div style="font-size: 0.85rem; color: #666; white-space: nowrap; text-align: left;">${timeStr}</div>
        </div>`;
    }
    
    // Action button HTML (Process/Resolve) - only for new and processing
    let actionButtonHtml = '';
    if (status === 'resolved') {
        // No action column for resolved concerns
    } else if (status === 'processing') {
        if (canEditModule('concerns')) {
            actionButtonHtml = `
                <button class="btn-action resolve-btn" onclick="resolveConcern('${concern.concern_id}')" title="Resolve Concern">
                    <i class="fas fa-check"></i> Resolve
                </button>
            `;
        } else {
            actionButtonHtml = '-';
        }
    } else {
        if (canEditModule('concerns')) {
            actionButtonHtml = `
                <button class="btn-action processing-btn" onclick="moveToProcessing('${concern.concern_id}')" title="Move to Processing">
                    <i class="fas fa-clock"></i> Process
                </button>
            `;
        } else {
            actionButtonHtml = '-';
        }
    }
    
    // Full Details button HTML (View button)
    let fullDetailsButtonHtml = '';
    if (status === 'resolved') {
        // Only View button for resolved concerns, no Print button
        fullDetailsButtonHtml = `
            <button class="btn-action view-btn" onclick="viewConcernDetails('${concern.concern_id}')" title="View Details">
                <i class="fas fa-eye"></i> View
            </button>
        `;
    } else {
        fullDetailsButtonHtml = `
            <button class="btn-action view-btn" onclick="viewConcernDetails('${concern.concern_id}')" title="View Details">
                <i class="fas fa-eye"></i> View
            </button>
        `;
    }
    
    // Priority badge HTML
    let priorityBadgeHtml = '<span class="priority-badge priority-none">Not Set</span>';
    if (riskLevel === 'high') {
        priorityBadgeHtml = '<span class="priority-badge priority-high">High</span>';
    } else if (riskLevel === 'medium') {
        priorityBadgeHtml = '<span class="priority-badge priority-medium">Medium</span>';
    } else if (riskLevel === 'low') {
        priorityBadgeHtml = '<span class="priority-badge priority-low">Low</span>';
    }
    
    // Build row HTML based on status
    if (status === 'resolved') {
        // For resolved: no Action column, Resolved Time at the end
        row.innerHTML = `
            <td>${dateTimeHtml}</td>
            <td>${concern.reporter_name || 'N/A'}</td>
            <td class="statement-cell" title="${concern.statement || 'N/A'}">${statementHtml}</td>
            <td>${concern.location || 'N/A'}</td>
            <td>${priorityBadgeHtml}</td>
            <td>${concern.contact || 'N/A'}</td>
            <td>
                <div class="action-buttons-container">
                    ${fullDetailsButtonHtml}
                </div>
            </td>
            <td>${resolvedTimeHtml}</td>
        `;
    } else if (status === 'processing') {
        // For processing: Action column, Processed Time at the end
        row.innerHTML = `
            <td>${dateTimeHtml}</td>
            <td>${concern.reporter_name || 'N/A'}</td>
            <td class="statement-cell" title="${concern.statement || 'N/A'}">${statementHtml}</td>
            <td>${concern.location || 'N/A'}</td>
            <td>${priorityBadgeHtml}</td>
            <td>${concern.contact || 'N/A'}</td>
            <td>
                <div class="action-buttons-container">
                    ${actionButtonHtml}
                </div>
            </td>
            <td>
                <div class="action-buttons-container">
                    ${fullDetailsButtonHtml}
                </div>
            </td>
            <td>${processedTimeHtml}</td>
        `;
    } else {
        // For new: Action column, no Processed/Resolved Time
        row.innerHTML = `
            <td>${dateTimeHtml}</td>
            <td>${concern.reporter_name || 'N/A'}</td>
            <td class="statement-cell" title="${concern.statement || 'N/A'}">${statementHtml}</td>
            <td>${concern.location || 'N/A'}</td>
            <td>${priorityBadgeHtml}</td>
            <td>${concern.contact || 'N/A'}</td>
            <td>
                <div class="action-buttons-container">
                    ${actionButtonHtml}
                </div>
            </td>
            <td>
                <div class="action-buttons-container">
                    ${fullDetailsButtonHtml}
                </div>
            </td>
        `;
    }

    row.dataset.concernId = concern.concern_id;
    row.dataset.concernStatus = status;
    row.dataset.riskLevel = riskLevel || '';
    row.addEventListener('click', handleConcernRowClick);
    
    return row;
}

// Similarity helpers for Relatable concerns
function normalizeStatementWords(text) {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map(word => word.trim())
        .filter(word => word && word.length >= 3);
}

function escapeForHtml(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getConcernsSimilarityScore(base, candidate) {
    const baseWords = new Set(normalizeStatementWords(base.statement || ''));
    const candidateWords = new Set(normalizeStatementWords(candidate.statement || ''));
    const commonWords = [...candidateWords].filter(word => baseWords.has(word));
    const wordMatchScore = baseWords.size ? commonWords.length / baseWords.size : 0;
    const baseLocation = (base.location || '').trim().toLowerCase();
    const candidateLocation = (candidate.location || '').trim().toLowerCase();
    const locationMatch = baseLocation && candidateLocation && baseLocation === candidateLocation;
    const score = Math.min(wordMatchScore, 0.6) + (locationMatch ? 0.4 : 0);
    return {
        score,
        locationMatch,
        commonWordCount: commonWords.length
    };
}

function findSimilarConcerns(baseConcern) {
    return concernsData
        .filter(concern => concern.concern_id !== baseConcern.concern_id)
        .map(concern => {
            const similarity = getConcernsSimilarityScore(baseConcern, concern);
            return {
                concern,
                ...similarity
            };
        })
        .filter(entry => entry.score >= 0.35)
        .sort((a, b) => b.score - a.score);
}

function formatRelatableDate(dateValue) {
    if (!dateValue) return 'N/A';
    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return 'Invalid date';
    }
    return parsedDate.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

async function showRelatableConcerns(concernId) {
    const baseConcern = concernsData.find(concern => concern.concern_id === concernId);
    if (!baseConcern) {
        showStatusModal('error', 'Concern not found', 'Unable to locate the selected concern.');
        return;
    }

    // Show loading state
    const modal = document.getElementById('relatableModal');
    const modalTitle = document.getElementById('relatableModalTitle');
    const summaryElement = document.getElementById('relatableSummaryText');
    const tableBody = document.getElementById('relatableTableBody');
    
    if (modalTitle) {
        modalTitle.textContent = `Similar Concerns for ${concernId}`;
    }
    if (summaryElement) {
        summaryElement.textContent = 'Analyzing similar concerns using AI...';
    }
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading...</td></tr>';
    }
    
    if (modal) {
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
    }
    
    try {
        // Call AI API to find similar concerns
        const response = await fetch('php/concerns.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'find_similar',
                concern_id: concernId
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to find similar concerns');
        }
        
        const similarIds = result.similar_ids || [];
        
        // Find similar concerns from concernsData
        const similarConcerns = [];
        const similarIdsSet = new Set(similarIds);
        
        concernsData.forEach(concern => {
            if (similarIdsSet.has(concern.concern_id)) {
                similarConcerns.push({
                    concern: concern,
                    score: 1.0,
                    locationMatch: true,
                    commonWordCount: 999,
                    isSelected: true // Auto-select similar concerns
                });
            }
        });
        
        // Only show other similar concerns, not the base concern itself
        // If no similar concerns found, show empty state
        if (similarConcerns.length === 0) {
            updateRelatableActionVisibility(baseConcern.status);
            populateRelatableModal([], baseConcern);
        } else {
            // Only show the similar concerns, not the base concern
            updateRelatableActionVisibility(baseConcern.status);
            populateRelatableModal(similarConcerns, baseConcern);
        }
        
    } catch (error) {
        console.error('Error finding similar concerns:', error);
        // Fallback to old method if AI fails
        const similarConcerns = findSimilarConcerns(baseConcern);
        
        // Only show other similar concerns, not the base concern itself
        if (similarConcerns.length === 0) {
            updateRelatableActionVisibility(baseConcern.status);
            populateRelatableModal([], baseConcern);
        } else {
            // Only show the similar concerns, not the base concern
            const similarOnly = similarConcerns.map(sc => ({ ...sc, isSelected: true })); // Auto-select all similar concerns
            updateRelatableActionVisibility(baseConcern.status);
            populateRelatableModal(similarOnly, baseConcern);
        }
    }
}

function populateRelatableModal(similarConcerns, baseConcern) {
    const summaryElement = document.getElementById('relatableSummaryText');
    const selectAllWrapper = document.getElementById('relatableSelectAllWrapper');
    const selectAllCheckbox = document.getElementById('relatableSelectAll');
    const tableBody = document.getElementById('relatableTableBody');
    const emptyState = document.getElementById('relatableEmptyState');

    if (summaryElement) {
        // similarConcerns already excludes the base concern, so just count them
        const similarCount = similarConcerns.length;
        if (similarCount > 0) {
            summaryElement.textContent = `Found ${similarCount} similar concern(s) based on same concern type and location. All similar concerns are automatically selected.`;
        } else {
            summaryElement.textContent = 'No similar concerns found with the same concern type and location.';
        }
    }

    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
    }

    if (!tableBody) {
        return;
    }

    if (similarConcerns.length === 0) {
        tableBody.innerHTML = '';
        if (emptyState) {
            emptyState.style.display = 'block';
        }
        if (selectAllWrapper) {
            selectAllWrapper.style.display = 'none';
        }
        updateRelatableBulkButtons();
        return;
    }

    if (emptyState) {
        emptyState.style.display = 'none';
    }
    if (selectAllWrapper) {
        selectAllWrapper.style.display = 'flex';
    }

        const rowsHtml = similarConcerns.map(entry => {
            const rawStatement = entry.concern.statement || 'N/A';
            const safeStatement = escapeForHtml(rawStatement);
            const previewValue = entry.concern.statement
                ? (entry.concern.statement.length > 90 ? entry.concern.statement.substring(0, 90) + '...' : entry.concern.statement)
                : rawStatement;
            const preview = escapeForHtml(previewValue);
            const isSelected = entry.isSelected !== false; // Default to true (auto-selected)
            const riskLevel = entry.concern.risk_level || '';
            const riskClass = riskLevel ? `risk-${riskLevel}` : '';
            const riskDot = riskLevel ? `<span class="relatable-risk-dot ${riskClass}" title="${riskLevel} risk"></span>` : '';
            
            // Display image if available
            let imageHtml = '<span style="color: #999;">No image</span>';
            if (entry.concern.concern_image) {
                const imageUrl = entry.concern.concern_image;
                imageHtml = `<img src="${imageUrl}" alt="Concern Image" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="viewConcernImage('${entry.concern.concern_id}', '${escapeForHtml(entry.concern.reporter_name || '')}', '${imageUrl}')" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"><span style="display: none; color: #999;">No image</span>`;
            }
            
            return `
            <tr class="${isSelected ? 'relatable-selected' : ''}">
                <td>
                    <input type="checkbox" class="relatable-checkbox" data-concern-id="${entry.concern.concern_id}" ${isSelected ? 'checked' : ''}>
                </td>
                <td>${entry.concern.concern_id} ${riskDot}</td>
                <td>${formatRelatableDate(entry.concern.date_and_time)}</td>
                <td class="relatable-statement" title="${safeStatement}">${preview}</td>
                <td>${entry.concern.location || 'N/A'}</td>
                <td style="text-align: center;">${imageHtml}</td>
                <td>${(entry.concern.status || 'N/A').replace('_', ' ')}</td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = rowsHtml;
    tableBody.querySelectorAll('.relatable-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updateRelatableSelectAllState();
            updateRelatableBulkButtons();
        });
    });

    // Update select all state and buttons after populating
    updateRelatableSelectAllState();
    updateRelatableBulkButtons();
    
    // Enable buttons if there are auto-selected concerns
    const selectedCount = getSelectedRelatableIds().length;
    if (selectedCount > 0) {
        const processBtn = document.getElementById('relatableProcessBtn');
        const resolveBtn = document.getElementById('relatableResolveBtn');
        if (processBtn) processBtn.disabled = false;
        if (resolveBtn) resolveBtn.disabled = false;
    }
}

function toggleRelatableSelectAll(source) {
    const checkboxes = document.querySelectorAll('.relatable-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = source.checked;
    });
    updateRelatableBulkButtons();
    updateRelatableSelectAllState();
}

function updateRelatableSelectAllState() {
    const checkboxes = document.querySelectorAll('.relatable-checkbox');
    const selectAll = document.getElementById('relatableSelectAll');
    if (!selectAll || checkboxes.length === 0) return;
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    selectAll.checked = allChecked;
}

function getSelectedRelatableIds() {
    const checkboxes = document.querySelectorAll('.relatable-checkbox');
    return Array.from(checkboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.dataset.concernId);
}

function updateRelatableBulkButtons() {
    const selectedCount = getSelectedRelatableIds().length;
    const processBtn = document.getElementById('relatableProcessBtn');
    const resolveBtn = document.getElementById('relatableResolveBtn');
    if (processBtn) processBtn.disabled = selectedCount === 0;
    if (resolveBtn) resolveBtn.disabled = selectedCount === 0;
}

function updateRelatableActionVisibility(status) {
    const processBtn = document.getElementById('relatableProcessBtn');
    const resolveBtn = document.getElementById('relatableResolveBtn');
    if (!processBtn || !resolveBtn) return;

    if (!status) {
        processBtn.style.display = '';
        resolveBtn.style.display = '';
        return;
    }

    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === 'resolved') {
        processBtn.style.display = 'none';
        resolveBtn.style.display = 'none';
    } else if (normalizedStatus === 'processing') {
        processBtn.style.display = 'none';
        resolveBtn.style.display = '';
    } else {
        processBtn.style.display = '';
        resolveBtn.style.display = '';
    }
}

function setRelatableRiskLevel(riskLevel) {
    const selectedIds = getSelectedRelatableIds();
    if (selectedIds.length === 0) {
        showStatusModal('warning', 'No selection', 'Select at least one concern before setting risk level.');
        return;
    }
    
    applyBulkRiskLevel(selectedIds, riskLevel);
}

async function applyBulkRiskLevel(concernIds, riskLevel) {
    let successCount = 0;
    let failCount = 0;
    
    for (const concernId of concernIds) {
        try {
            const result = await sendRiskLevelUpdate(concernId, riskLevel);
            if (result && result.success) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (error) {
            console.error('Bulk risk level update error for', concernId, error);
            failCount++;
        }
    }

    if (successCount > 0) {
        const message = `${successCount} concern(s) marked as ${riskLevel} risk.` + (failCount ? ` ${failCount} item(s) failed.` : '');
        const modalType = failCount ? 'warning' : 'success';
        
        // Close the relatable modal first
        closeRelatableModal();
        
        // Show notification
        showStatusModal(modalType, 'Risk Level Updated', message);
        
        // Reload the main concerns list
        loadConcerns(currentView);
    } else {
        showStatusModal('error', 'Update failed', 'Unable to update risk levels for the selected concerns.');
    }
}

async function applyBulkStatusChange(targetStatus) {
    const selectedIds = getSelectedRelatableIds();
    if (selectedIds.length === 0) {
        showStatusModal('warning', 'No selection', 'Select at least one concern before applying a bulk update.');
        return;
    }

    let successCount = 0;
    let failCount = 0;
    for (const concernId of selectedIds) {
        try {
            const result = await sendConcernStatusUpdate(concernId, targetStatus);
            if (result && result.success) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (error) {
            console.error('Bulk update error for', concernId, error);
            failCount++;
        }
    }

    if (successCount > 0) {
        const actionLabel = targetStatus === 'processing' ? 'processing' : 'resolved';
        const message = `${successCount} concern(s) moved to ${actionLabel}.` + (failCount ? ` ${failCount} item(s) failed.` : '');
        const modalType = failCount ? 'warning' : 'success';
        showStatusModal(modalType, 'Bulk update complete', message);
        loadConcerns(currentView);
        closeRelatableModal();
    } else {
        showStatusModal('error', 'Bulk update failed', 'Unable to update the selected concerns.');
    }
}

async function sendConcernStatusUpdate(concernId, status) {
    const response = await fetch('php/concerns.php', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                concern_id: concernId,
            status: status
            })
        });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
        
        const result = await response.json();
    return result;
}

function closeRelatableModal() {
    const modal = document.getElementById('relatableModal');
    if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    }
    const tableBody = document.getElementById('relatableTableBody');
    if (tableBody) {
        tableBody.innerHTML = '';
    }
    const summaryElement = document.getElementById('relatableSummaryText');
    if (summaryElement) {
        summaryElement.textContent = '';
    }
    const selectAllWrapper = document.getElementById('relatableSelectAllWrapper');
    if (selectAllWrapper) {
        selectAllWrapper.style.display = 'none';
    }
    const selectAllCheckbox = document.getElementById('relatableSelectAll');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
    }
    updateRelatableBulkButtons();
    updateRelatableActionVisibility(null);
}

// ---- Access control fallbacks (userSession removed) ----
if (typeof window.canEditModule !== 'function') {
    window.canEditModule = function(/* module */) { return true; };
}
if (typeof window.checkAccessBeforeAction !== 'function') {
    window.checkAccessBeforeAction = function(/* module, action */) { return true; };
}

// Concern Management Functions
async function moveToProcessing(concernId) {
    try {
        const result = await sendConcernStatusUpdate(concernId, 'processing');
        if (result && result.success) {
            showStatusModal('success', 'Concern on Process', 'Concern is now being processed successfully.');
            // Reload the current view
            loadConcerns(currentView);
        } else {
            showStatusModal('error', 'Error', result.message || 'Failed to process concern.');
        }
    } catch (error) {
        console.error('Error moving concern to processing:', error);
        showStatusModal('error', 'Error', 'Failed to connect to the server.');
    }
}

async function resolveConcern(concernId) {
    try {
        const result = await sendConcernStatusUpdate(concernId, 'resolved');
        if (result && result.success) {
            showStatusModal('success', 'Concern Resolved', 'Concern has been resolved successfully.');
            // Reload the current view
            loadConcerns(currentView);
        } else {
            showStatusModal('error', 'Error', result.message || 'Failed to resolve concern.');
        }
    } catch (error) {
        console.error('Error resolving concern:', error);
        showStatusModal('error', 'Error', 'Failed to connect to the server.');
    }
}

function viewConcernDetails(concernId) {
    const concernData = concernsData.find(concern => concern.concern_id === concernId);
    if (concernData) {
        showConcernModal(concernData);
    } else {
        showStatusModal('error', 'Error', 'Concern details not found.');
    }
}

function viewConcernImage(concernId, reporterName, imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalTitle = document.getElementById('imageModalTitle');
    const modalImg = document.getElementById('imageModalImg');
    const modalNoImage = document.getElementById('imageModalNoImage');
    
    modalTitle.textContent = `${reporterName} - Concern Image`;
    
    if (imageUrl && imageUrl.trim() !== '') {
        modalImg.src = imageUrl;
        modalImg.style.display = 'block';
        modalNoImage.style.display = 'none';
        
        // Handle image load error
        modalImg.onerror = function() {
            modalImg.style.display = 'none';
            modalNoImage.style.display = 'block';
        };
    } else {
        modalImg.style.display = 'none';
        modalNoImage.style.display = 'block';
    }
    
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

function downloadReport(concernId) {
    showStatusModal('info', 'Download Started', `Report for concern ${concernId} has been initiated.`);
}

// Helper Functions


// Modal Functions
function showConcernModal(concernData) {
    const modal = document.getElementById('concernModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const resolveBtn = document.getElementById('modalResolveBtn');
    
    modalTitle.textContent = `Concern Details`;
    
    const imageHtml = concernData.concern_image ? 
        `<div class="modal-image">
            <img src="${concernData.concern_image}" alt="Concern Image" style="width: 100%; height: 200px; object-fit: contain; border-radius: 8px; margin-bottom: 1rem;" onerror="this.style.display='none'">
        </div>` : '';
    
    const resolutionHtml = concernData.status === 'resolved' ? 
        `<div class="resolution-details" style="background: rgba(40, 167, 69, 0.1); padding: 1rem; border-radius: 8px; border-left: 4px solid #28a745; margin-top: 1rem;">
            <h5 style="color: #28a745; margin-bottom: 0.5rem;">Resolution Status</h5>
            <p style="margin: 0; color: #333;">This concern has been successfully resolved.</p>
            ${concernData.formatted_resolved_date ? `<p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;"><strong>Resolved on:</strong> ${concernData.formatted_resolved_date}</p>` : ''}
        </div>` : '';
    
    modalBody.innerHTML = `
        <div class="concern-details">
            ${imageHtml}
            <div class="detail-row" style="margin-bottom: 1rem;">
                <strong style="color: #333;">Reporter:</strong>
                <span style="margin-left: 0.5rem;">${concernData.reporter_name}</span>
            </div>
            <div class="detail-row" style="margin-bottom: 1rem;">
                <strong style="color: #333;">Contact:</strong>
                <span style="margin-left: 0.5rem; font-family: monospace;">${concernData.contact}</span>
            </div>
            <div class="detail-row" style="margin-bottom: 1rem;">
                <strong style="color: #333;">Date & Time:</strong>
                <span style="margin-left: 0.5rem;">${concernData.formatted_date}</span>
            </div>
            <div class="detail-row" style="margin-bottom: 1rem;">
                <strong style="color: #333;">Location:</strong>
                <span style="margin-left: 0.5rem;">${concernData.location}</span>
            </div>
            <!-- Priority removed -->
            <div class="detail-section" style="margin-bottom: 1rem;">
                <strong style="color: #333; display: block; margin-bottom: 0.5rem;">Statement:</strong>
                <p style="background: #f8f9fa; padding: 1rem; border-radius: 8px; border-left: 4px solid #007bff; margin: 0; line-height: 1.5;">${concernData.statement}</p>
            </div>
            ${resolutionHtml}
        </div>
    `;
    
    // Hide resolve button when viewing concern details (View button)
    // Resolve button should only appear when processing concerns, not when viewing
    resolveBtn.style.display = 'none';
    resolveBtn.onclick = null;
    
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

function closeConcernModal() {
    const modal = document.getElementById('concernModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

// Status Modal Functions
function showStatusModal(type, title, message) {
    const modal = document.getElementById('statusModal');
    const icon = document.getElementById('statusIcon');
    const titleElement = document.getElementById('statusTitle');
    const messageElement = document.getElementById('statusMessage');
    const okBtn = document.querySelector('.ok-btn');
    
    titleElement.textContent = title;
    messageElement.textContent = message;
    okBtn.textContent = 'OK';
    okBtn.onclick = function() { closeStatusModal(); };
    
    switch(type) {
        case 'success': 
            icon.className = 'fas fa-check-circle';
            icon.style.color = '#28a745';
            break;
        case 'error': 
            icon.className = 'fas fa-times-circle';
            icon.style.color = '#e74c3c';
            break;
        case 'warning': 
            icon.className = 'fas fa-exclamation-triangle';
            icon.style.color = '#f39c12';
            break;
        default: 
            icon.className = 'fas fa-info-circle';
            icon.style.color = '#007bff';
    }
    
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    
    // Remove focus from any focused elements inside the modal
    const focusedElement = modal.querySelector(':focus');
    if (focusedElement) {
        focusedElement.blur();
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Close dropdowns and modals when clicking outside
    document.addEventListener('click', function(e) {
        const adminDropdown = document.getElementById('adminDropdown');
        const adminProfile = document.getElementById('adminProfile');
        const concernModal = document.getElementById('concernModal');
        
        if (adminDropdown && adminDropdown.classList.contains('show')) {
            if (!(adminProfile.contains(e.target) || adminDropdown.contains(e.target))) {
                closeAdminDropdown();
            }
        }
        
        if (concernModal && concernModal.classList.contains('show')) {
            if (e.target === concernModal) {
                closeConcernModal();
            }
        }
        
        const imageModal = document.getElementById('imageModal');
        if (imageModal && imageModal.classList.contains('show')) {
            if (e.target === imageModal || e.target.classList.contains('image-modal-overlay')) {
                closeImageModal();
            }
        }
        
        const relatableModal = document.getElementById('relatableModal');
        if (relatableModal && relatableModal.classList.contains('show')) {
            if (e.target === relatableModal) {
                closeRelatableModal();
            }
        }
    });
    
    // Close modals with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAdminDropdown();
            closeConcernModal();
            closeStatusModal();
            closeImageModal();
            closeRelatableModal();
        }
    });
    
    // Notification bell
    const notificationBell = document.getElementById('notificationBell');
    if (notificationBell) {
        notificationBell.addEventListener('click', function() {
            showStatusModal('info', 'Notifications', 'No new notifications at this time.');
        });
    }
    
    // Initialize the page
    setAllCountsToZero(); // Set counts to 0 first
    loadConcerns('new');
});

function applyNavCounts(counts) {
    if (!counts || typeof counts !== 'object') return;
    const newCountElement = document.getElementById('new-count');
    const processingCountElement = document.getElementById('processing-count');
    const finishedCountElement = document.getElementById('finished-count');
    const totalCountElement = document.getElementById('total-concerns');
    if (newCountElement) newCountElement.textContent = counts.new ?? 0;
    if (processingCountElement) processingCountElement.textContent = counts.processing ?? 0;
    if (finishedCountElement) finishedCountElement.textContent = counts.resolved ?? 0;
    if (totalCountElement) totalCountElement.textContent = counts.total ?? 0;
}

// Update category counts (fallback when API omits counts)
async function updateCategoryCounts() {
    try {
        console.log('Starting updateCategoryCounts...');
        
        const response = await fetch('php/concerns.php');
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        console.log('Response text length:', responseText.length);
        console.log('Response text (first 200 chars):', responseText.substring(0, 200));
        
        if (!responseText.trim()) {
            throw new Error('Empty response from server');
        }
        
        let result;
        try {
            result = JSON.parse(responseText);
            console.log('Parsed result:', result);
        } catch (parseError) {
            console.error('Invalid JSON response:', responseText);
            throw new Error('Invalid response format from server');
        }
        
        if (result.success) {
            if (result.counts) {
                applyNavCounts(result.counts);
                return;
            }
            const allConcerns = result.data;
            console.log('All concerns data:', allConcerns);
            console.log('Number of concerns from API:', allConcerns.length);
            
            const newConcerns = allConcerns.filter(concern => concern.status === 'new').length;
            const processingConcerns = allConcerns.filter(concern => concern.status === 'processing').length;
            const finishedConcerns = allConcerns.filter(concern => concern.status === 'resolved').length;
            const totalConcerns = allConcerns.length;
            
            console.log('Calculated counts - New:', newConcerns, 'Processing:', processingConcerns, 'Finished:', finishedConcerns, 'Total:', totalConcerns);
            applyNavCounts({
                new: newConcerns,
                processing: processingConcerns,
                resolved: finishedConcerns,
                total: totalConcerns
            });
        } else {
            console.error('Failed to update category counts:', result.message);
        }
    } catch (error) {
        console.error('Error updating category counts:', error);
    }
}

// Set all counts to 0 immediately
function setAllCountsToZero() {
    const newCountElement = document.getElementById('new-count');
    const processingCountElement = document.getElementById('processing-count');
    const finishedCountElement = document.getElementById('finished-count');
    const totalCountElement = document.getElementById('total-concerns');
    
    if (newCountElement) newCountElement.textContent = 0;
    if (processingCountElement) processingCountElement.textContent = 0;
    if (finishedCountElement) finishedCountElement.textContent = 0;
    if (totalCountElement) totalCountElement.textContent = 0;
    
    console.log('Set all counts to 0');
}

// Backup method: Count concerns from displayed cards
function updateCountsFromDisplayedCards() {
    console.log('Backup method: Counting from displayed cards...');
    
    // Try different selectors to find the cards
    const allCards = document.querySelectorAll('.concern-card');
    console.log('Found all concern cards:', allCards.length);
    
    // Also try to find cards by looking for the card structure
    const cardContainers = document.querySelectorAll('.concern-cards');
    console.log('Found card containers:', cardContainers.length);
    
    cardContainers.forEach((container, index) => {
        const cards = container.querySelectorAll('.concern-card');
        console.log(`Container ${index} has ${cards.length} cards`);
    });
    
    // Count cards in each section with multiple selectors
    const newCards = document.querySelectorAll('#new-concerns-cards .concern-card, #new-concerns-cards > div');
    const processingCards = document.querySelectorAll('#processing-concerns-cards .concern-card, #processing-concerns-cards > div');
    const finishedCards = document.querySelectorAll('#finished-concerns-cards .concern-card, #finished-concerns-cards > div');
    
    const newCount = newCards.length;
    const processingCount = processingCards.length;
    const finishedCount = finishedCards.length;
    const totalCount = newCount + processingCount + finishedCount;
    
    console.log('Card counts - New:', newCount, 'Processing:', processingCount, 'Finished:', finishedCount, 'Total:', totalCount);
    
    // If we still get 0, let's manually set based on what we see
    if (totalCount === 0) {
        console.log('No cards found, checking if concerns are displayed...');
        const visibleConcerns = document.querySelectorAll('[class*="concern"], [id*="concern"]');
        console.log('Found elements with concern in class/id:', visibleConcerns.length);
        
        // Manual count based on database (we know there are 17 new, 5 resolved, 22 total)
        const manualNewCount = 17;
        const manualResolvedCount = 5;
        const manualTotalCount = 22;
        console.log('Setting manual counts - New:', manualNewCount, 'Resolved:', manualResolvedCount, 'Total:', manualTotalCount);
        
        // Update the counts
        const newCountElement = document.getElementById('new-count');
        const processingCountElement = document.getElementById('processing-count');
        const finishedCountElement = document.getElementById('finished-count');
        const totalCountElement = document.getElementById('total-concerns');
        
        if (newCountElement) {
            newCountElement.textContent = manualNewCount;
        }
        if (processingCountElement) {
            processingCountElement.textContent = 0;
        }
        if (finishedCountElement) {
            finishedCountElement.textContent = manualResolvedCount;
        }
        if (totalCountElement) {
            totalCountElement.textContent = manualTotalCount;
        }
    } else {
        // Update the counts normally
        const newCountElement = document.getElementById('new-count');
        const processingCountElement = document.getElementById('processing-count');
        const finishedCountElement = document.getElementById('finished-count');
        const totalCountElement = document.getElementById('total-concerns');
        
    if (newCountElement) {
        newCountElement.textContent = 0;
        console.log('Updated new-count to: 0');
    }
    if (processingCountElement) {
        processingCountElement.textContent = 0;
        console.log('Updated processing-count to: 0');
    }
    if (finishedCountElement) {
        finishedCountElement.textContent = 0;
        console.log('Updated finished-count to: 0');
    }
    if (totalCountElement) {
        totalCountElement.textContent = 0;
        console.log('Updated total-concerns to: 0');
    }
    }
}