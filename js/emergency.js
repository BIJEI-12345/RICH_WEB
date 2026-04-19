// Emergency Dashboard JavaScript Functions

let emergencyData = [];
let currentSection = 'all-emergencies';

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing dashboard...');
    console.log('Emergency page loaded successfully!');
    loadEmergencyData();
    loadEmergencyMonthlyInterpretation();
    setupEventListeners();
    
    // Test function to manually check if everything works
    window.testEmergencyData = function() {
        console.log('Testing emergency data...');
        const testData = [
            {
                id: 1,
                emergencyType: 'Fire',
                reporterName: 'Cruz, Adrian Albante',
                location: 'Block 5, Lot 23, Bria Homes, Barangay Bigte',
                dateTime: '2025-09-25 14:55:00',
                description: 'Small fire started in kitchen area, needs immediate response',
                status: 'new',
                priority: 'high'
            },
            {
                id: 2,
                emergencyType: 'Medical Emergency',
                reporterName: 'Ramos, Chris Legaspi',
                location: 'Purok 3, Barangay Bigte',
                dateTime: '2025-09-25 14:55:00',
                description: 'Elderly resident needs immediate medical attention',
                status: 'resolved',
                priority: 'high'
            }
        ];
        emergencyData = testData;
        updateDashboard();
    };
});

/** Buwanang bilang + Groq na interpretasyon (php/emergency_monthly_interpretation.php) */
async function loadEmergencyMonthlyInterpretation() {
    const panel = document.getElementById('emergencyMonthlyAiPanel');
    const statsEl = document.getElementById('emergencyMonthlyAiStats');
    const textEl = document.getElementById('emergencyMonthlyAiText');
    const hintEl = document.getElementById('emergencyMonthlyAiHint');
    if (!panel || !statsEl || !textEl || !hintEl) {
        return;
    }

    try {
        const response = await fetch('php/emergency_monthly_interpretation.php', { credentials: 'same-origin' });
        if (response.status === 403) {
            panel.hidden = true;
            return;
        }
        const data = await response.json();
        if (!data || data.success !== true) {
            panel.hidden = true;
            return;
        }

        const cur = data.currentMonth || {};
        const prev = data.previousMonth || {};
        const label = data.monthLabel || '';
        const reported = Number(cur.reported) || 0;
        const resolved = Number(cur.resolved) || 0;
        const prevRep = Number(prev.reported) || 0;
        const prevRes = Number(prev.resolved) || 0;

        statsEl.textContent =
            `${label}: ${reported} na ulat ang pumasok sa buwang ito (${resolved} resolved). ` +
            `Nakaraang buwan: ${prevRep} ulat (${prevRes} resolved).`;

        const ai = String(data.aiInterpretation || '').trim();
        const groqOk = data.groqConfigured === true;

        if (groqOk && ai) {
            textEl.textContent = ai;
            textEl.hidden = false;
        } else {
            textEl.textContent = '';
            textEl.hidden = true;
        }

        if (!groqOk) {
            hintEl.textContent =
                'Para sa AI na interpretasyon, maglagay ng GROQ_API_KEY o EMERGENCY_GRAPH_GROQ_API_KEY sa .env (Analytics → Emergency Reports).';
        } else if (reported > 0 && !ai) {
            hintEl.textContent = 'Hindi nakumpleto ang AI na buod. Subukan muli mamaya o tingnan ang server log.';
        } else {
            hintEl.textContent = '';
        }

        panel.hidden = false;
    } catch (e) {
        console.error('loadEmergencyMonthlyInterpretation', e);
        panel.hidden = true;
    }
}

// Load emergency data from PHP backend
async function loadEmergencyData() {
    try {
        const response = await fetch('php/emergency.php');
        const data = await response.json();
        emergencyData = data.reports || [];
        console.log('Loaded emergency data:', emergencyData);
        console.log('Status counts:', {
            new: emergencyData.filter(e => e.status === 'new').length,
            resolved: emergencyData.filter(e => e.status === 'resolved').length
        });
        updateDashboard();
    } catch (error) {
        console.error('Error loading emergency data:', error);
        // Fallback to sample data if PHP fails
        emergencyData = getSampleData();
        console.log('Using fallback data:', emergencyData);
        updateDashboard();
    }
}

// Sample data fallback
function getSampleData() {
    return [
        {
            id: 1,
            emergencyType: 'Fire',
            reporterName: 'Cris Dela Cruz',
            location: 'Block 5, Lot 23, Bria Homes, Barangay Bigte',
            dateTime: '2023-06-15 14:30:00',
            description: 'Small fire started in kitchen area, needs immediate response',
            status: 'new',
            priority: 'high'
        },
        {
            id: 2,
            emergencyType: 'Collapse Bridge',
            reporterName: 'Maria Santos',
            location: 'Assunsion St., Looban Bigte',
            dateTime: '2023-06-14 09:15:00',
            description: 'Gumuhong tulay sa sapa at may naipit na bata',
            status: 'new',
            priority: 'high'
        },
        {
            id: 3,
            emergencyType: 'Flood',
            reporterName: 'Pedro Reyes',
            location: 'Near Creek Area of Crusher, Bigte',
            dateTime: '2023-06-13 18:45:00',
            description: 'Rising water levels, due to heavy rains of typhoon',
            status: 'in-progress',
            priority: 'medium'
        },
        {
            id: 4,
            emergencyType: 'Medical Emergency',
            reporterName: 'Ana Garcia',
            location: 'Purok 3, Barangay Bigte',
            dateTime: '2023-06-12 10:20:00',
            description: 'Elderly resident needs immediate medical attention',
            status: 'resolved',
            priority: 'high'
        },
        {
            id: 5,
            emergencyType: 'Power Outage',
            reporterName: 'Juan Dela Cruz',
            location: 'Main Street, Barangay Bigte',
            dateTime: '2023-06-11 16:30:00',
            description: 'Power lines down due to strong winds',
            status: 'resolved',
            priority: 'medium'
        }
    ];
}

// Update the entire dashboard
function updateDashboard() {
    console.log('Updating dashboard with data:', emergencyData);
    updateNavigationCounts();
    updateEmergencyCards();
}

// Update navigation counts
function updateNavigationCounts() {
    const allCount = emergencyData.filter(emergency => emergency.status !== 'resolved').length;
    const resolvedCount = emergencyData.filter(emergency => emergency.status === 'resolved').length;
    const totalCount = emergencyData.length;

    document.getElementById('allCount').textContent = allCount;
    document.getElementById('resolvedCount').textContent = resolvedCount;
    document.getElementById('totalEmergencies').textContent = totalCount;
}

// Update emergency cards for all sections
function updateEmergencyCards() {
    // Show only non-resolved emergencies in "All Emergency reports"
    const nonResolvedEmergencies = emergencyData.filter(emergency => emergency.status !== 'resolved');
    console.log('Non-resolved emergencies:', nonResolvedEmergencies.length, nonResolvedEmergencies);
    updateSectionCards('all-emergencies', nonResolvedEmergencies);
    
    // Show only resolved emergencies in "Resolved" section, sorted by resolved date/time (latest first)
    const resolvedEmergencies = emergencyData
        .filter(emergency => emergency.status === 'resolved')
        .sort((a, b) => {
            // Sort by resolvedDateTime in descending order (latest resolved first)
            const dateA = new Date(a.resolvedDateTime || a.dateTime);
            const dateB = new Date(b.resolvedDateTime || b.dateTime);
            return dateB - dateA;
        });
    console.log('Resolved emergencies:', resolvedEmergencies.length, resolvedEmergencies);
    updateSectionCards('resolved', resolvedEmergencies);
}

// Update cards for a specific section
function updateSectionCards(sectionId, emergencies) {
    let containerId;
    if (sectionId === 'all-emergencies') {
        containerId = 'allEmergencyCards';
    } else if (sectionId === 'resolved') {
        containerId = 'resolvedEmergencyCards';
    } else {
        containerId = sectionId.replace('-', '') + 'Cards';
    }
    
    const cardsContainer = document.getElementById(containerId);
    if (!cardsContainer) {
        console.error('Container not found:', containerId);
        return;
    }

    if (emergencies.length === 0) {
        cardsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>No emergency reports found</p>
            </div>
        `;
        return;
    }

    console.log('Updating container:', containerId, 'with', emergencies.length, 'emergencies');
    cardsContainer.innerHTML = emergencies.map(emergency => {
        // Find the original index in the main emergencyData array
        const originalIndex = emergencyData.findIndex(e => 
            e.emergencyType === emergency.emergencyType &&
            e.reporterName === emergency.reporterName &&
            e.location === emergency.location &&
            e.dateTime === emergency.dateTime
        );
        return createEmergencyCard(emergency, originalIndex);
    }).join('');
}

// Create emergency card HTML
function createEmergencyCard(emergency, index) {
    const statusClass = emergency.status === 'resolved' ? 'resolved' : '';
    
    // For resolved emergencies, show resolved date/time, otherwise show original date/time
    const dateTimeToShow = emergency.status === 'resolved' && emergency.resolvedDateTime 
        ? emergency.resolvedDateTime 
        : emergency.dateTime;
    const formattedDate = formatDateTime(dateTimeToShow);
    
    // Add label for resolved emergencies
    const dateLabel = emergency.status === 'resolved' ? 'Resolved Date & Time: ' : '';
    
    return `
        <div class="emergency-card ${statusClass}" data-index="${index}">
            <div class="emergency-info">
                <div class="emergency-number">${emergency.reporterName}</div>
                <div class="emergency-date">${dateLabel}${formattedDate}</div>
            </div>
            <div class="card-actions">
                <button class="btn-action view-btn" onclick="viewEmergency(${index})">
                    View
                </button>
            </div>
        </div>
    `;
}

// Format date and time to Philippine time with AM/PM format
function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    hours = hours.toString().padStart(2, '0');
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    return `${monthNames[month - 1]} ${day}, ${year} - ${hours}:${minutes}:${seconds} ${ampm}`;
}

// Show specific section
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.emergency-section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Show selected section
    document.getElementById(sectionId).classList.remove('hidden');
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Find and activate the corresponding nav item
    const navItem = document.querySelector(`[data-section="${sectionId}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
    
    currentSection = sectionId;
}

// View emergency details
function viewEmergency(emergencyIndex) {
    const emergency = emergencyData[emergencyIndex];
    if (!emergency) return;

    const modal = document.getElementById('emergencyModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const resolveBtn = document.getElementById('resolveBtn');

    modalTitle.textContent = 'Emergency Report';
    
    // Populate modal content using existing HTML elements
    document.getElementById('modalEmergencyType').textContent = emergency.emergencyType;
    document.getElementById('modalLocation').textContent = emergency.location;
    document.getElementById('modalReporter').textContent = emergency.reporterName;
    document.getElementById('modalDateTime').textContent = formatDateTime(emergency.dateTime);
    document.getElementById('modalDescription').textContent = emergency.description;
    
    // Handle landmark
    const landmarkSection = document.getElementById('modalLandmarkSection');
    const landmarkElement = document.getElementById('modalLandmark');
    if (emergency.landmark) {
        landmarkElement.textContent = emergency.landmark;
        landmarkSection.style.display = 'block';
    } else {
        landmarkSection.style.display = 'none';
    }
    
    // Handle emergency image
    const imageSection = document.getElementById('modalImageSection');
    const imageElement = document.getElementById('modalEmergencyImage');
    if (emergency.emergencyImage) {
        imageElement.src = emergency.emergencyImage;
        imageElement.onerror = function() {
            imageSection.style.display = 'none';
        };
        imageSection.style.display = 'block';
    } else {
        imageSection.style.display = 'none';
    }
    
    // Update status badge
    const statusBadge = document.getElementById('modalStatus');
    statusBadge.textContent = emergency.status.replace('-', ' ');
    
    // Remove any existing inline styles that might interfere
    statusBadge.style.backgroundColor = '';
    statusBadge.style.color = '';
    
    // Apply the appropriate class for styling
    statusBadge.className = `status-badge status-${emergency.status}`;

    // Show/hide resolved datetime section and resolve button based on status
    const resolvedDateTimeSection = document.getElementById('resolvedDateTimeSection');
    if (emergency.status === 'resolved') {
        resolveBtn.style.display = 'none';
        if (emergency.resolvedDateTime) {
            resolvedDateTimeSection.style.display = 'block';
            document.getElementById('modalResolvedDateTime').textContent = formatDateTime(emergency.resolvedDateTime);
        }
    } else {
        // Check if user can edit emergency before showing resolve button
        if (canEditModule('emergency')) {
            resolveBtn.style.display = 'flex';
            resolveBtn.onclick = () => resolveEmergency(emergencyIndex);
        } else {
            // Hide resolve button for view-only users
            resolveBtn.style.display = 'none';
        }
        resolvedDateTimeSection.style.display = 'none';
    }

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    
    // Focus the first focusable element in the modal
    const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
        firstFocusable.focus();
    }
}

// Resolve emergency
async function resolveEmergency(emergencyIndex) {
    const emergency = emergencyData[emergencyIndex];
    if (!emergency) return;

    try {
        const url = `php/emergency.php`;
        
        // Call PHP endpoint to update database
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'resolve',
                emergencyType: emergency.emergencyType,
                reporterName: emergency.reporterName,
                location: emergency.location,
                dateTime: emergency.dateTime
            })
        });

        const result = await response.json();
        
        if (result.success) {
            // Reload data from database to get updated information
            await loadEmergencyData();
            
            // Wait a bit to ensure data is fully loaded
            setTimeout(() => {
                // Close modal
                closeEmergencyModal();
                
                // Automatically switch to resolved section to show the resolved emergency
                showSection('resolved');
                
                // Show success message
                showStatusModal('success', 'Emergency Resolved!', 'The emergency report has been successfully resolved');
            }, 100);
        } else {
            showStatusModal('error', 'Error', result.message || 'Failed to resolve emergency');
        }
    } catch (error) {
        console.error('Error resolving emergency:', error);
        showStatusModal('error', 'Error', 'Failed to resolve emergency. Please try again.');
    }
}

// Close emergency modal
function closeEmergencyModal() {
    const modal = document.getElementById('emergencyModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    
    // Remove focus from any focused elements inside the modal
    const focusedElement = modal.querySelector(':focus');
    if (focusedElement) {
        focusedElement.blur();
    }
}

// Show status modal
function showStatusModal(type, title, message) {
    const modal = document.getElementById('statusModal');
    const icon = document.getElementById('statusIcon');
    const titleElement = document.getElementById('statusTitle');
    const messageElement = document.getElementById('statusMessage');
    
    // Set content
    titleElement.textContent = title;
    messageElement.textContent = message;
    
    // Set icon and styling based on type
    switch(type) {
        case 'success':
            icon.className = 'fas fa-check-circle';
            break;
        case 'error':
            icon.className = 'fas fa-times-circle';
            break;
        case 'warning':
            icon.className = 'fas fa-exclamation-triangle';
            break;
        default:
            icon.className = 'fas fa-info-circle';
    }
    
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    
    // Focus the first focusable element in the modal
    const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
        firstFocusable.focus();
    }
}

// Close status modal
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

// Go back to admin dashboard
function goBack() {
    window.location.href = 'admin-dashboard.html';
}

// Admin Profile Dropdown Functions
function toggleAdminDropdown() {
    const dropdown = document.getElementById('adminDropdown');
    const profile = document.getElementById('adminProfile');
    
    if (dropdown.classList.contains('show')) {
        closeAdminDropdown();
    } else {
        openAdminDropdown();
    }
}

function openAdminDropdown() {
    const dropdown = document.getElementById('adminDropdown');
    const profile = document.getElementById('adminProfile');
    
    dropdown.classList.add('show');
    dropdown.setAttribute('aria-hidden', 'false');
    profile.setAttribute('aria-expanded', 'true');
}

function closeAdminDropdown() {
    const dropdown = document.getElementById('adminDropdown');
    const profile = document.getElementById('adminProfile');
    
    dropdown.classList.remove('show');
    dropdown.setAttribute('aria-hidden', 'true');
    profile.setAttribute('aria-expanded', 'false');
}

function editProfile() {
    // Function to handle profile editing
    alert('Edit Profile functionality will be implemented here');
    closeAdminDropdown();
}

function logout() {
    // Function to handle logout
    if (confirm('Are you sure you want to logout?')) {
        // Use centralized logout function that tracks logout
        if (window.performLogout) {
            window.performLogout();
        } else {
            window.location.href = 'index.php';
        }
    }
    closeAdminDropdown();
}

// Setup event listeners
function setupEventListeners() {
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        const adminDropdown = document.getElementById('adminDropdown');
        const adminProfile = document.getElementById('adminProfile');
        
        if (adminDropdown && adminProfile && !adminProfile.contains(e.target) && !adminDropdown.contains(e.target)) {
            closeAdminDropdown();
        }
    });

    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        const emergencyModal = document.getElementById('emergencyModal');
        const statusModal = document.getElementById('statusModal');
        
        if (emergencyModal && e.target === emergencyModal) {
            closeEmergencyModal();
        }
        
        if (statusModal && e.target === statusModal) {
            closeStatusModal();
        }
    });

    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEmergencyModal();
            closeStatusModal();
            closeAdminDropdown();
        }
    });
}

