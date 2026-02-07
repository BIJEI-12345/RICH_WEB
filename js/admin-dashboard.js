// Admin Dashboard JavaScript Functions

// Function to format datetime from ISO to mm/dd/yyyy hh:mm AM/PM
function formatDateTime(isoDateTime) {
    if (!isoDateTime) return '';
    
    const date = new Date(isoDateTime);
    if (isNaN(date.getTime())) return isoDateTime; // Return original if invalid
    
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    hours = String(hours).padStart(2, '0');
    
    return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
}

// Function to convert formatted date back to ISO format
function convertFormattedDateToISO(formattedDate) {
    if (!formattedDate) return '';
    
    // Parse format: mm/dd/yyyy hh:mm AM/PM
    const match = formattedDate.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}) (AM|PM)/);
    if (!match) return '';
    
    const [, month, day, year, hours, minutes, ampm] = match;
    
    let hour24 = parseInt(hours);
    if (ampm === 'PM' && hour24 !== 12) {
        hour24 += 12;
    } else if (ampm === 'AM' && hour24 === 12) {
        hour24 = 0;
    }
    
    // Create ISO datetime string
    return `${year}-${month}-${day}T${String(hour24).padStart(2, '0')}:${minutes}`;
}

// Function to show success notification
function showSuccessNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    
    // Set icon based on type
    let iconClass = 'fas fa-check-circle';
    if (type === 'error') {
        iconClass = 'fas fa-times-circle';
    } else if (type === 'warning') {
        iconClass = 'fas fa-exclamation-triangle';
    }
    
    notification.innerHTML = `
        <div class="notification-content">
            <i class="${iconClass}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function navigateToDocuments() {
    // Mark as navigating away to prevent logout tracking
    if (window.isNavigatingAway !== undefined) {
        window.isNavigatingAway = true;
    }
    // Navigate to document management page
    window.location.href = 'reqDocu.html';
}

function navigateToFeedback() {
    // Mark as navigating away to prevent logout tracking
    if (window.isNavigatingAway !== undefined) {
        window.isNavigatingAway = true;
    }
    // Navigate to complaints management page
    window.location.href = 'concerns.html';
}

function navigateToEmergency() {
    // Mark as navigating away to prevent logout tracking
    if (window.isNavigatingAway !== undefined) {
        window.isNavigatingAway = true;
    }
    // Navigate to emergency management page
    window.location.href = 'emergency.html';
}

function navigateToUserManagement() {
    // Mark as navigating away to prevent logout tracking
    if (window.isNavigatingAway !== undefined) {
        window.isNavigatingAway = true;
    }
    // Navigate to user management page
    window.location.href = 'userManagement.html';
}

function navigateToResidentInfo() {
    // Mark as navigating away to prevent logout tracking
    if (window.isNavigatingAway !== undefined) {
        window.isNavigatingAway = true;
    }
    // Navigate to resident information page
    window.location.href = 'resident-info.html';
}

function navigateToAnalytics() {
    // Mark as navigating away to prevent logout tracking
    if (window.isNavigatingAway !== undefined) {
        window.isNavigatingAway = true;
    }
    window.location.href = 'analytics.html';
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
    
    // Close notification dropdown if it's open
    const notificationDropdown = document.getElementById('notificationDropdown');
    if (notificationDropdown && notificationDropdown.classList.contains('show')) {
        notificationDropdown.classList.remove('show');
        notificationDropdown.setAttribute('aria-hidden', 'true');
        const notificationBell = document.getElementById('notificationBell');
        if (notificationBell) {
            notificationBell.setAttribute('aria-expanded', 'false');
        }
    }
    
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
    
    // Remove focus from any focused element inside the dropdown
    const focusedElement = document.activeElement;
    if (dropdown.contains(focusedElement)) {
        focusedElement.blur();
    }
}

function editProfile() {
    // Function to handle profile editing
    openEditProfileModal();
    closeAdminDropdown();
}

function openEditProfileModal() {
    const modal = document.getElementById('editProfileModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    
    // Reset image preview to show current profile
    resetImagePreview();
    
    // Focus the confirmation button
    const confirmBtn = modal.querySelector('.ok-btn');
    if (confirmBtn) {
        setTimeout(() => confirmBtn.focus(), 10);
    }
}

function closeEditProfileModal() {
    const modal = document.getElementById('editProfileModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    
    // Reset file input and preview
    const profileImageInput = document.getElementById('profileImageInput');
    if (profileImageInput) {
        profileImageInput.value = '';
    }
    resetImagePreview();
}

// Status Modal Functions
function showStatusModal(type, title, message) {
    const modal = document.getElementById('statusModal');
    const icon = document.getElementById('statusIcon');
    const titleElement = document.getElementById('statusTitle');
    const messageElement = document.getElementById('statusMessage');
    const okBtn = document.querySelector('.ok-btn');
    const cancelBtn = document.querySelector('.cancel-status-btn');
    
    // Reset modal classes
    modal.className = 'status-modal';
    
    // Set content
    titleElement.textContent = title;
    messageElement.textContent = message;
    
    // Hide cancel button for regular status messages
    cancelBtn.style.display = 'none';
    
    // Reset OK button
    okBtn.textContent = 'OK';
    okBtn.onclick = function() {
        closeStatusModal();
    };
    
    // Set icon and styling based on type
    switch(type) {
        case 'success':
            icon.className = 'fas fa-check-circle';
            modal.classList.add('show');
            break;
        case 'error':
            icon.className = 'fas fa-times-circle';
            modal.classList.add('show', 'error');
            break;
        case 'warning':
            icon.className = 'fas fa-exclamation-triangle';
            modal.classList.add('show', 'warning');
            break;
        default:
            icon.className = 'fas fa-info-circle';
            modal.classList.add('show');
    }
    
    // Set aria-hidden to false when modal is shown
    modal.setAttribute('aria-hidden', 'false');
    
    // Focus the confirmation button after modal is fully shown
    const confirmBtn = modal.querySelector('.ok-btn');
    if (confirmBtn) {
        setTimeout(() => {
            confirmBtn.focus();
        }, 200);
    }
}

function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

function logout() {
    // Function to handle logout
    closeAdminDropdown();
    // Use setTimeout to ensure dropdown is closed before showing modal
    setTimeout(() => {
        showLogoutConfirmationModal();
    }, 10);
}

function showLogoutConfirmationModal() {
    const modal = document.getElementById('statusModal');
    const icon = document.getElementById('statusIcon');
    const titleElement = document.getElementById('statusTitle');
    const messageElement = document.getElementById('statusMessage');
    const okBtn = document.querySelector('.ok-btn');
    const cancelBtn = document.querySelector('.cancel-status-btn');
    
    // Reset modal classes
    modal.className = 'status-modal';
    
    // Set content for logout confirmation
    titleElement.textContent = 'Confirm Logout';
    messageElement.textContent = 'Are you sure you want to logout? You will be redirected to the login page.';
    
    // Set warning icon and styling
    icon.className = 'fas fa-sign-out-alt';
    modal.classList.add('show', 'warning');
    
    // Show cancel button and update button texts
    cancelBtn.style.display = 'inline-block';
    cancelBtn.textContent = 'Cancel';
    okBtn.textContent = 'Yes, Logout';
    
    // Reset button actions
    cancelBtn.onclick = function() {
        closeStatusModal();
    };
    
    okBtn.onclick = function() {
        closeStatusModal();
        // Use centralized logout function that tracks logout
        if (window.performLogout) {
            window.performLogout();
        } else {
            window.location.href = 'index.html';
        }
    };
    
    modal.setAttribute('aria-hidden', 'false');
    
    // Focus the confirmation button
    const confirmBtn = modal.querySelector('.ok-btn');
    if (confirmBtn) {
        setTimeout(() => confirmBtn.focus(), 10);
    }
}

// Function to establish PHP session for admin user
async function establishAdminSession(email) {
    try {
        console.log('Establishing admin session for:', email);
        
        // Call a PHP endpoint to establish session for admin user
        const response = await fetch('php/admin-dashboard.php', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'establish_session',
                email: email
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('Admin session established successfully');
            return true;
        } else {
            console.error('Failed to establish admin session:', result.message);
            return false;
        }
    } catch (error) {
        console.error('Error establishing admin session:', error);
        return false;
    }
}

// Load admin data on page load
document.addEventListener('DOMContentLoaded', function() {
    loadAdminData();
});

// Function to load admin data
function loadAdminData() {
    console.log('Loading admin data using PHP session...');
    
    // Load admin data using PHP session (no URL parameters needed)
    // Include credentials to maintain session
    fetch('php/admin-dashboard.php?action=get_admin_data', {
        method: 'GET',
        credentials: 'include', // Important: include cookies/session
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => {
            if (!response.ok) {
                // If 401, try to get error message, but don't throw
                if (response.status === 401) {
                    return response.json().then(err => {
                        // Return error object instead of throwing
                        return { ok: false, error: err.error || 'Unauthorized' };
                    }).catch(() => {
                        return { ok: false, error: 'Unauthorized' };
                    });
                }
                // For other errors, return error object
                return response.json().then(err => {
                    return { ok: false, error: err.error || 'Failed to load admin data' };
                }).catch(() => {
                    return { ok: false, error: 'Failed to load admin data' };
                });
            }
            return response.json();
        })
        .then(data => {
            if (data && data.ok) {
                console.log('Admin data received:', data);
                updateAdminProfile(data);
            } else {
                // Silently handle errors - don't log to console to avoid spam
                // Only redirect if it's a clear session expiration
                if (data && data.error && data.error.includes('session expired')) {
                    // Only redirect if we're sure the session is expired
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1000);
                }
            }
        })
        .catch(error => {
            // Silently handle network errors - don't spam console
            // Only log if it's not a network/abort error
            if (error.name !== 'AbortError' && error.name !== 'TypeError') {
                console.error('Error loading admin data:', error);
            }
        });
}

// Function to update admin profile display
function updateAdminProfile(data) {
    // Update admin name
    const adminNameElement = document.getElementById('adminName');
    if (adminNameElement) {
        adminNameElement.textContent = `${data.firstname} ${data.lastname}`;
    }
    
    // Update admin position
    const adminPositionElement = document.getElementById('adminPosition');
    if (adminPositionElement) {
        adminPositionElement.textContent = data.position;
    }
    
    // Hide notification icon if user is not admin
    const notificationBell = document.getElementById('notificationBell');
    const notificationDropdown = document.getElementById('notificationDropdown');
    if (notificationBell && notificationDropdown) {
        if (data.position !== 'Admin') {
            notificationBell.style.display = 'none';
            notificationDropdown.style.display = 'none';
        } else {
            notificationBell.style.display = 'flex';
            notificationDropdown.style.display = 'block';
        }
    }
    
    // Hide/Show User Management and Analytics based on position (Admin only)
    const userManagementBtn = document.querySelector('.user-management-access');
    const analyticsBtn = document.querySelector('.analytics-access');
    
    if (userManagementBtn) {
        userManagementBtn.style.display = (data.position === 'Admin') ? '' : 'none';
    }
    
    if (analyticsBtn) {
        analyticsBtn.style.display = (data.position === 'Admin') ? '' : 'none';
    }
    
    // Admin session is now established, userSession.js will handle permissions
    
    // Update profile images or initials
    console.log('hasProfileImage:', data.hasProfileImage);
    console.log('profileImage length:', data.profileImage ? data.profileImage.length : 'null');
    
    if (data.hasProfileImage && data.profileImage) {
        console.log('Showing uploaded image');
        // Show uploaded image
        updateProfileImages(data.profileImage);
        // Also update the edit modal preview
        showImagePreview(data.profileImage);
    } else {
        console.log('Showing initials:', data.initials);
        // Show initials
        updateProfileInitials(data.initials);
        // Reset edit modal to show initials
        resetImagePreview();
    }
    
    // Update admin name input in edit modal
    const adminNameInput = document.getElementById('adminNameInput');
    if (adminNameInput) {
        adminNameInput.value = `${data.firstname} ${data.lastname}`;
    }
}


// Function to update profile images
function updateProfileImages(imageSrc) {
    // Update header profile image
    const profileInitialsElement = document.getElementById('profileInitials');
    if (profileInitialsElement) {
        profileInitialsElement.style.display = 'none';
        let profileImg = document.getElementById('profileImg');
        if (!profileImg) {
            profileImg = document.createElement('img');
            profileImg.id = 'profileImg';
            profileImg.className = 'profile-img';
            profileImg.alt = 'Admin Profile';
            profileInitialsElement.parentNode.insertBefore(profileImg, profileInitialsElement);
        }
        profileImg.src = imageSrc;
        profileImg.style.display = 'block';
    }
    
    // Update dropdown profile image
    const dropdownProfileInitialsElement = document.getElementById('dropdownProfileInitials');
    if (dropdownProfileInitialsElement) {
        dropdownProfileInitialsElement.style.display = 'none';
        let dropdownImg = document.getElementById('dropdownImg');
        if (!dropdownImg) {
            dropdownImg = document.createElement('img');
            dropdownImg.id = 'dropdownImg';
            dropdownImg.className = 'dropdown-profile-img';
            dropdownImg.alt = 'Admin Profile';
            dropdownProfileInitialsElement.parentNode.insertBefore(dropdownImg, dropdownProfileInitialsElement);
        }
        dropdownImg.src = imageSrc;
        dropdownImg.style.display = 'block';
    }
    
    // Update edit modal profile image
    const currentProfileInitialsElement = document.getElementById('currentProfileInitials');
    if (currentProfileInitialsElement) {
        currentProfileInitialsElement.style.display = 'none';
        let currentImg = document.getElementById('currentProfileImg');
        if (!currentImg) {
            currentImg = document.createElement('img');
            currentImg.id = 'currentProfileImg';
            currentImg.className = 'current-profile-img';
            currentImg.alt = 'Current Profile';
            currentProfileInitialsElement.parentNode.insertBefore(currentImg, currentProfileInitialsElement);
        }
        currentImg.src = imageSrc;
        currentImg.style.display = 'block';
    }
    
    // Update brgyAdmin card profile image
    const brgyAdminInitialsElement = document.getElementById('brgyAdminInitials');
    if (brgyAdminInitialsElement) {
        brgyAdminInitialsElement.style.display = 'none';
        let brgyAdminImg = document.getElementById('brgyAdminImg');
        if (!brgyAdminImg) {
            brgyAdminImg = document.createElement('img');
            brgyAdminImg.id = 'brgyAdminImg';
            brgyAdminImg.className = 'brgyAdmin-img';
            brgyAdminImg.alt = 'Admin Profile';
            brgyAdminInitialsElement.parentNode.insertBefore(brgyAdminImg, brgyAdminInitialsElement);
        }
        brgyAdminImg.src = imageSrc;
        brgyAdminImg.style.display = 'block';
    }
}

// Function to update profile initials
function updateProfileInitials(initials) {
    // Update header profile initials
    const profileInitialsElement = document.getElementById('profileInitials');
    if (profileInitialsElement) {
        profileInitialsElement.textContent = initials;
        profileInitialsElement.style.display = 'flex';
        const profileImg = document.getElementById('profileImg');
        if (profileImg) profileImg.style.display = 'none';
    }
    
    // Update dropdown profile initials
    const dropdownProfileInitialsElement = document.getElementById('dropdownProfileInitials');
    if (dropdownProfileInitialsElement) {
        dropdownProfileInitialsElement.textContent = initials;
        dropdownProfileInitialsElement.style.display = 'flex';
        const dropdownImg = document.getElementById('dropdownImg');
        if (dropdownImg) dropdownImg.style.display = 'none';
    }
    
    // Update edit modal profile initials
    const currentProfileInitialsElement = document.getElementById('currentProfileInitials');
    if (currentProfileInitialsElement) {
        currentProfileInitialsElement.textContent = initials;
        currentProfileInitialsElement.style.display = 'flex';
        const currentImg = document.getElementById('currentProfileImg');
        if (currentImg) currentImg.style.display = 'none';
    }
    
    // Update brgyAdmin card profile initials
    const brgyAdminInitialsElement = document.getElementById('brgyAdminInitials');
    if (brgyAdminInitialsElement) {
        brgyAdminInitialsElement.textContent = initials;
        brgyAdminInitialsElement.style.display = 'flex';
        const brgyAdminImg = document.getElementById('brgyAdminImg');
        if (brgyAdminImg) brgyAdminImg.style.display = 'none';
    }
}

// Global functions for image preview
function showImagePreview(imageSrc) {
    const currentProfileInitialsElement = document.getElementById('currentProfileInitials');
    if (currentProfileInitialsElement) {
        // Hide initials
        currentProfileInitialsElement.style.display = 'none';
        
        // Show or create image element
        let currentImg = document.getElementById('currentProfileImg');
        if (!currentImg) {
            currentImg = document.createElement('img');
            currentImg.id = 'currentProfileImg';
            currentImg.className = 'current-profile-img';
            currentImg.alt = 'Current Profile';
            currentProfileInitialsElement.parentNode.insertBefore(currentImg, currentProfileInitialsElement);
        }
        currentImg.src = imageSrc;
        currentImg.style.display = 'block';
    }
}

function resetImagePreview() {
    const currentProfileInitialsElement = document.getElementById('currentProfileInitials');
    const currentImg = document.getElementById('currentProfileImg');
    
    // Only proceed if the edit profile modal is actually open/visible
    const editModal = document.getElementById('editProfileModal');
    if (!editModal || !editModal.classList.contains('show')) {
        // Modal is not open, just show initials without fetching
        if (currentProfileInitialsElement) {
            currentProfileInitialsElement.style.display = 'flex';
            if (currentImg) {
                currentImg.style.display = 'none';
            }
        }
        return;
    }
    
    if (currentProfileInitialsElement) {
        // Fetch current admin data using session (no localStorage)
        fetch(`php/admin-dashboard.php?action=get_admin_data`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => {
                if (!response.ok) {
                    // If unauthorized or error, just show initials - don't throw
                    return null;
                }
                return response.json();
            })
            .then(data => {
                if (data && data.ok) {
                    if (data.hasProfileImage && data.profileImage) {
                        // Show current profile image
                        showImagePreview(data.profileImage);
                    } else {
                        // Show initials
                        currentProfileInitialsElement.style.display = 'flex';
                        if (currentImg) {
                            currentImg.style.display = 'none';
                        }
                    }
                } else {
                    // Fallback to initials
                    currentProfileInitialsElement.style.display = 'flex';
                    if (currentImg) {
                        currentImg.style.display = 'none';
                    }
                }
            })
            .catch(error => {
                // Silently fail and show initials - don't log error to avoid console spam
                if (currentProfileInitialsElement) {
                    currentProfileInitialsElement.style.display = 'flex';
                    if (currentImg) {
                        currentImg.style.display = 'none';
                    }
                }
            });
    }
}

// Additional admin dashboard functions can be added here
// Example: Load dashboard data, handle notifications, etc.

// ---- Announcements & Events Slider ----
(function(){
    const slidesWrapper = document.getElementById('announceSlides');
    const prevBtn = document.getElementById('announcePrev');
    const nextBtn = document.getElementById('announceNext');
    const dotsContainer = document.getElementById('announceDots');
    const openCompose = document.getElementById('openCompose');
    const composeModal = document.getElementById('composeModal');
    const cancelCompose = document.getElementById('cancelCompose');
    const composeForm = document.getElementById('composeForm');

    if (!slidesWrapper) return; // run only on admin dashboard

    let current = 0;
    const autoplayMs = 2000;
    let timerId = null;
    let editingSlide = null; // Track which slide is being edited

    function getSlides(){
        // Only count article.slide (exclude the compose button)
        return Array.from(slidesWrapper.querySelectorAll('article.slide'));
    }

    function updateDots(){
        const slides = getSlides();
        dotsContainer.innerHTML = '';
        slides.forEach((_, idx) => {
            const b = document.createElement('button');
            if (idx === current) b.classList.add('active');
            b.addEventListener('click', () => { goTo(idx); restartAutoplay(); });
            dotsContainer.appendChild(b);
        });
    }

    function goTo(index){
        const slides = getSlides();
        if (slides.length === 0) return;
        current = (index + slides.length) % slides.length;
        const target = slides[current];
        const targetLeft = target.offsetLeft - slidesWrapper.offsetLeft - 8; // include gap
        slidesWrapper.scrollTo({ left: targetLeft, behavior: 'smooth' });
        updateDots();
    }

    function next(){ goTo(current + 1); }
    function prev(){ goTo(current - 1); }

    function startAutoplay(){
        stopAutoplay();
        timerId = setInterval(next, autoplayMs);
    }
    function stopAutoplay(){ if (timerId) { clearInterval(timerId); timerId = null; } }
    function restartAutoplay(){ stopAutoplay(); startAutoplay(); }

    // Navigation
    if (prevBtn) prevBtn.addEventListener('click', () => { prev(); restartAutoplay(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { next(); restartAutoplay(); });

    // Pause on hover
    const slider = document.getElementById('announceSlider');
    if (slider){
        slider.addEventListener('mouseenter', stopAutoplay);
        slider.addEventListener('mouseleave', startAutoplay);
    }

    // Compose Modal
    function openModal(){ 
        composeModal.classList.add('show'); 
        composeModal.setAttribute('aria-hidden','false'); 
    }
    
    function closeModal(){ 
        composeModal.classList.remove('show'); 
        composeModal.setAttribute('aria-hidden','true'); 
        editingSlide = null; // Reset editing state
    }

    if (openCompose) openCompose.addEventListener('click', openModal);
    if (cancelCompose) cancelCompose.addEventListener('click', () => { 
        composeForm.reset(); 
        closeModal(); 
    });
    if (composeModal) composeModal.addEventListener('click', (e) => { if (e.target === composeModal) closeModal(); });
    
    // Add direct click listener to submit button as backup
    const submitBtn = document.querySelector('#composeForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Submit button clicked!'); // Debug log
            if (composeForm) {
                composeForm.dispatchEvent(new Event('submit'));
            }
        });
    }

    // Setup action buttons for each slide
    function setupSlideActions() {
        const slides = getSlides();
        slides.forEach(slide => {
            const actionBtn = slide.querySelector('.action-btn');
            const dropdown = slide.querySelector('.action-dropdown');
            const editBtn = slide.querySelector('.edit-slide');
            const removeBtn = slide.querySelector('.remove-slide');
            
            // Toggle dropdown
            if (actionBtn) {
                actionBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Close all other dropdowns first
                    document.querySelectorAll('.action-dropdown.show').forEach(d => {
                        if (d !== dropdown) d.classList.remove('show');
                    });
                    dropdown.classList.toggle('show');
                });
            }
            
            // Edit slide
            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    editingSlide = slide;
                    
                    // Fill form with current slide data
                    const title = slide.querySelector('h4').textContent;
                    const desc = slide.querySelector('p').textContent;
                    const dateElement = slide.querySelector('.slide-date');
                    
                    // Parse datetime from date element
                    let datetime = '';
                    if (dateElement) {
                        const formattedDate = dateElement.textContent;
                        // Convert formatted date back to ISO format for the input
                        datetime = convertFormattedDateToISO(formattedDate);
                    }
                    
                    document.getElementById('cTitle').value = title;
                    document.getElementById('cDesc').value = desc;
                    document.getElementById('cDateTime').value = datetime;
                    
                    // Change button text to indicate editing
                    const submitButton = document.querySelector('#composeForm button[type="submit"]');
                    submitButton.textContent = 'Update Slide';
                    
                    openModal();
                    dropdown.classList.remove('show');
                });
            }
            
            // Remove slide
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    const slideId = slide.getAttribute('data-id');
                    
                    if (slideId) {
                        // Delete from database
                        fetch('php/admin-dashboard.php', {
                            method: 'DELETE',
                            credentials: 'include',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ id: slideId })
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.ok) {
                                slide.remove();
                                updateDots();
                                if (current >= getSlides().length) {
                                    current = Math.max(0, getSlides().length - 1);
                                }
                                goTo(current);
                                showSuccessNotification('Announcement deleted successfully!');
                            } else {
                                showSuccessNotification(data.error || 'Failed to delete announcement', 'error');
                            }
                        })
                        .catch(error => {
                            console.error('Error:', error);
                            showSuccessNotification('Network error. Please try again.', 'error');
                        });
                    } else {
                        // Remove from UI only (for slides without database ID)
                        slide.remove();
                        updateDots();
                        if (current >= getSlides().length) {
                            current = Math.max(0, getSlides().length - 1);
                        }
                        goTo(current);
                    }
                    
                    dropdown.classList.remove('show');
                });
            }
        });
    }
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.action-dropdown.show').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    });

    // Handle form to create or update a slide
    if (composeForm){
        composeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('Form submitted!'); // Debug log
            
            const formData = new FormData(composeForm);
            const title = (formData.get('title') || '').toString().trim();
            const datetime = (formData.get('datetime') || '').toString().trim();
            const desc = (formData.get('desc') || '').toString().trim();
            const file = formData.get('image');
            
            console.log('Form data:', { title, datetime, desc, file }); // Debug log

            // Validate required fields
            if (!title) {
                showSuccessNotification('Please enter a title for the announcement', 'error');
                return;
            }

            // Prepare data for API
            const announcementData = {
                title: title,
                description: desc,
                datetime: datetime
            };

            // Determine if this is an update or create operation
            const isUpdate = editingSlide !== null;
            const slideId = editingSlide ? editingSlide.getAttribute('data-id') : null;

            // Show loading state
            const submitButton = document.querySelector('#composeForm button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = isUpdate ? 'Updating...' : 'Creating...';
            submitButton.disabled = true;

            // Create FormData for file upload
            const apiFormData = new FormData();
            apiFormData.append('title', title);
            apiFormData.append('description', desc);
            apiFormData.append('datetime', datetime);
            
            if (file && file instanceof File && file.size > 0) {
                apiFormData.append('image', file);
            }

            // Send to PHP endpoint
            const url = isUpdate ? `php/admin-dashboard.php?id=${slideId}` : 'php/admin-dashboard.php';
            const method = isUpdate ? 'POST' : 'POST'; // Use POST for both create and update to handle FormData properly

            fetch(url, {
                method: method,
                body: apiFormData
            })
            .then(response => response.json())
            .then(data => {
                if (data.ok) {
                    if (isUpdate) {
                        // Update existing slide in UI
                        const slideMedia = editingSlide.querySelector('.slide-media');
                        const slideTitle = editingSlide.querySelector('h4');
                        const slideDesc = editingSlide.querySelector('p');
                        
                        slideTitle.textContent = title || 'Untitled';
                        slideDesc.textContent = desc || 'No description provided.';
                        slideDesc.style.whiteSpace = 'pre-wrap'; // Preserve line breaks
                        
                        // Update the date element (now using .slide-date instead of .slide-meta)
                        const slideDate = editingSlide.querySelector('.slide-date');
                        if (slideDate) {
                            slideDate.textContent = datetime ? formatDateTime(datetime) : '';
                        }
                        
                        if (file && file instanceof File && file.size > 0) {
                            const reader = new FileReader();
                            reader.onload = () => {
                                slideMedia.style.backgroundImage = `url('${reader.result}')`;
                            };
                            reader.readAsDataURL(file);
                        }
                        
                        showSuccessNotification('Announcement updated successfully!');
                        editingSlide = null;
                    } else {
                        // Create new slide in UI
                        const article = document.createElement('article');
                        article.className = 'slide';
                        article.setAttribute('aria-label', 'Announcement slide');
                        article.setAttribute('data-id', data.id);

                        // Add action buttons
                        const actions = document.createElement('div');
                        actions.className = 'slide-actions';
                        actions.innerHTML = `
                            <button type="button" class="action-btn" aria-label="Slide actions">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="action-dropdown">
                                <button type="button" class="edit-slide">Edit</button>
                                <button type="button" class="remove-slide">Remove</button>
                            </div>
                        `;
                        
                        const media = document.createElement('div');
                        media.className = 'slide-media';

                        if (file && file instanceof File && file.size > 0){
                            const reader = new FileReader();
                            reader.onload = () => {
                                media.style.backgroundImage = `url('${reader.result}')`;
                            };
                            reader.readAsDataURL(file);
                        } else {
                            media.style.background = '#eef2f7';
                        }

                        // Create date element to go above image
                        const dateElement = document.createElement('div');
                        dateElement.className = 'slide-date';
                        dateElement.textContent = datetime ? formatDateTime(datetime) : '';

                        const body = document.createElement('div');
                        body.className = 'slide-body';
                        const h4 = document.createElement('h4'); h4.textContent = title || 'Untitled';
                        const p = document.createElement('p'); 
                        p.textContent = desc || 'No description provided.';
                        p.style.whiteSpace = 'pre-wrap'; // Preserve line breaks

                        body.appendChild(h4); body.appendChild(p);
                        article.appendChild(actions); article.appendChild(media); article.appendChild(body); article.appendChild(dateElement);

                        // Add the new slide to the slides wrapper
                        slidesWrapper.appendChild(article);
                        
                        // Setup actions for the new slide
                        setupSlideActions();
                        
                        showSuccessNotification('Announcement created successfully!');
                        
                        // Go to the new slide
                        goTo(getSlides().length - 1);
                    }
                } else {
                    showSuccessNotification(data.error || 'Failed to save announcement', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showSuccessNotification('Network error. Please try again.', 'error');
            })
            .finally(() => {
                // Reset form and close modal
                submitButton.textContent = 'Add Slide';
                submitButton.disabled = false;
                composeForm.reset();
                closeModal();
                updateDots();
            });
        });
    }

    // Load existing announcements from database
    function loadAnnouncements() {
        fetch('php/admin-dashboard.php', {
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            if (data.ok && data.announcements) {
                // Clear existing slides (except the compose button)
                const existingSlides = getSlides();
                existingSlides.forEach(slide => slide.remove());
                
                // Add announcements from database
                data.announcements.forEach(announcement => {
                    const article = document.createElement('article');
                    article.className = 'slide';
                    article.setAttribute('aria-label', 'Announcement slide');
                    article.setAttribute('data-id', announcement.id);

                    // Add action buttons
                    const actions = document.createElement('div');
                    actions.className = 'slide-actions';
                    actions.innerHTML = `
                        <button type="button" class="action-btn" aria-label="Slide actions">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div class="action-dropdown">
                            <button type="button" class="edit-slide">Edit</button>
                            <button type="button" class="remove-slide">Remove</button>
                        </div>
                    `;
                    
                    const media = document.createElement('div');
                    media.className = 'slide-media';
                    
                    if (announcement.image && announcement.image.trim() !== '') {
                        // Image path is valid, set it directly (PHP already validated it exists)
                        media.style.backgroundImage = `url('${announcement.image}')`;
                        media.style.backgroundSize = 'cover';
                        media.style.backgroundPosition = 'center';
                    } else {
                        // No image or empty path, use default background
                        media.style.background = '#eef2f7';
                    }

                    // Create date element to go above image
                    const dateElement = document.createElement('div');
                    dateElement.className = 'slide-date';
                    dateElement.textContent = announcement.date_and_time ? formatDateTime(announcement.date_and_time) : '';

                    const body = document.createElement('div');
                    body.className = 'slide-body';
                    const h4 = document.createElement('h4'); 
                    h4.textContent = announcement.title || 'Untitled';
                    const p = document.createElement('p'); 
                    p.textContent = announcement.description || 'No description provided.';
                    p.style.whiteSpace = 'pre-wrap'; // Preserve line breaks

                    body.appendChild(h4); 
                    body.appendChild(p);
                    article.appendChild(actions); 
                    article.appendChild(media); 
                    article.appendChild(body);
                    article.appendChild(dateElement);

                    // Add the slide to the slides wrapper
                    slidesWrapper.appendChild(article);
                });
                
                // Setup actions for all slides
                setupSlideActions();
                updateDots();
            }
        })
        .catch(error => {
            console.error('Error loading announcements:', error);
        });
    }

    // Initialize
    loadAnnouncements();
    setupSlideActions();
    updateDots();
    startAutoplay();
})();

// ---- Notifications dropdown ----
(function(){
    const bell = document.getElementById('notificationBell');
    const dropdown = document.getElementById('notificationDropdown');
    const list = document.getElementById('notifList');
    const badge = document.querySelector('.notification-badge');
    const viewMoreBtn = document.getElementById('viewMoreBtn');
    const notifCount = document.getElementById('notifCount');

    if (!bell || !dropdown) return;

    // Load notifications from server
    async function loadNotifications() {
        try {
            const response = await fetch('php/get_notifications.php', {
                method: 'GET',
                credentials: 'include', // Include session cookies
                cache: 'no-store'
            });
            
            if (!response.ok) {
                throw new Error('Failed to load notifications');
            }
            
            const data = await response.json();
            
            if (data.success) {
                renderNotifications(data.notifications);
                updateNotificationCount(data.count);
            } else {
                console.error('Failed to load notifications:', data.error);
                renderNotifications([]);
                updateNotificationCount(0);
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
            renderNotifications([]);
            updateNotificationCount(0);
        }
    }

    // Render notifications in the dropdown
    function renderNotifications(notifications) {
        if (!list) return;
        
        if (notifications.length === 0) {
            list.innerHTML = '<li class="notif-item"><div class="notif-body"><p class="notif-title">No pending user requests</p></div></li>';
        } else {
            list.innerHTML = notifications.map(notification => {
                const verificationStatus = notification.verified_email == 1 
                    ? '<span class="notif-verification verified"><i class="fas fa-check-circle"></i> Verified</span>'
                    : '<span class="notif-verification not-verified"><i class="fas fa-exclamation-circle"></i> Not Verified</span>';
                
                return `
                    <li class="notif-item">
                        <div class="notif-icon"><i class="fas fa-user-plus"></i></div>
                        <div class="notif-body">
                            <p class="notif-title">${notification.title}</p>
                            <div class="notif-meta">
                                <span class="notif-time">${notification.time}</span>
                                ${verificationStatus}
                            </div>
                        </div>
                    </li>
                `;
            }).join('');
        }
        
        updateEmptyState();
    }

    // Update notification count
    function updateNotificationCount(count) {
        if (notifCount) {
            notifCount.textContent = count;
        }
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
    }

    function updateEmptyState(){
        const items = list ? list.querySelectorAll('.notif-item') : [];
        const hasItems = items && items.length > 0;
        if (viewMoreBtn) viewMoreBtn.disabled = !hasItems;
        const footer = dropdown.querySelector('.notif-footer');
        if (footer) footer.style.display = hasItems ? 'flex' : 'none';
    }

    function open(){
        // Close admin dropdown if it's open
        const adminDropdown = document.getElementById('adminDropdown');
        if (adminDropdown && adminDropdown.classList.contains('show')) {
            adminDropdown.classList.remove('show');
            adminDropdown.setAttribute('aria-hidden', 'true');
            const adminProfile = document.getElementById('adminProfile');
            if (adminProfile) {
                adminProfile.setAttribute('aria-expanded', 'false');
            }
        }
        
        // Load fresh notifications when opening
        loadNotifications();
        
        dropdown.classList.add('show');
        dropdown.setAttribute('aria-hidden','false');
        bell.setAttribute('aria-expanded','true');
    }
    function close(){
        dropdown.classList.remove('show');
        dropdown.setAttribute('aria-hidden','true');
        bell.setAttribute('aria-expanded','false');
    }
    function toggle(){
        if (dropdown.classList.contains('show')) close(); else open();
    }

    bell.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle();
    });

    document.addEventListener('click', (e) => {
        if (!dropdown.classList.contains('show')) return;
        const target = e.target;
        if (!(bell.contains(target) || dropdown.contains(target))) {
            close();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
    });

    if (viewMoreBtn){
        viewMoreBtn.addEventListener('click', () => {
            // Navigate to user management page
            window.location.href = 'userManagement.html';
        });
    }

    // Load notifications on page load
    loadNotifications();
    
    // Refresh notifications every 30 seconds
    setInterval(loadNotifications, 30000);
})();

// ---- Admin Profile Dropdown ----
(function(){
    const adminProfile = document.getElementById('adminProfile');
    const adminDropdown = document.getElementById('adminDropdown');

    if (!adminProfile || !adminDropdown) return;

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!adminDropdown.classList.contains('show')) return;
        const target = e.target;
        if (!(adminProfile.contains(target) || adminDropdown.contains(target))) {
            closeAdminDropdown();
        }
    });

    // Close dropdown when pressing Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAdminDropdown();
    });
})();

// ---- Edit Profile Modal ----
(function(){
    const editProfileModal = document.getElementById('editProfileModal');
    const editProfileForm = document.getElementById('editProfileForm');
    const profileImageInput = document.getElementById('profileImageInput');
    const currentProfileImg = document.getElementById('currentProfileImg');
    const adminNameInput = document.getElementById('adminNameInput');

    if (!editProfileModal || !editProfileForm) return;

    // Handle image upload preview
    if (profileImageInput) {
        profileImageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    // Show preview of uploaded image
                    showImagePreview(e.target.result);
                    console.log('Image uploaded:', file.name);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Handle form submission
    editProfileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(editProfileForm);
        const newName = formData.get('adminName');
        const newImage = formData.get('profileImage');
        
        // Update admin name in header and dropdown
        updateAdminName(newName);
        
        // Handle image upload if provided
        if (newImage && newImage.size > 0) {
            const uploadFormData = new FormData();
            uploadFormData.append('profileImage', newImage);
            
            fetch(`php/admin-dashboard.php?action=update_admin_profile`, {
                method: 'POST',
                credentials: 'include',
                body: uploadFormData
            })
                .then(response => response.json())
                .then(data => {
                    console.log('Upload response:', data);
                    if (data.ok) {
                        // Reload admin data to get updated profile image with a small delay
                        setTimeout(() => {
                            loadAdminData();
                        }, 500);
                        showStatusModal('success', 'Profile Updated Successfully!', 'Your profile has been updated successfully.');
                    } else {
                        showStatusModal('error', 'Upload Failed', data.error || 'Failed to upload profile image');
                    }
                })
                .catch(error => {
                    console.error('Error uploading image:', error);
                    showStatusModal('error', 'Upload Failed', 'Network error. Please try again.');
                });
        } else {
            // No image upload, just show success message
            showStatusModal('success', 'Profile Updated Successfully!', 'Your profile has been updated successfully.');
        }
        
        // Close modal
        closeEditProfileModal();
    });

    // Close modal when clicking outside
    editProfileModal.addEventListener('click', function(e) {
        if (e.target === editProfileModal) {
            closeEditProfileModal();
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && editProfileModal.classList.contains('show')) {
            closeEditProfileModal();
        }
    });

    // Close status modal when clicking outside
    const statusModal = document.getElementById('statusModal');
    if (statusModal) {
        statusModal.addEventListener('click', function(e) {
            if (e.target === statusModal) {
                closeStatusModal();
            }
        });
    }

    // Close status modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && statusModal && statusModal.classList.contains('show')) {
            closeStatusModal();
        }
    });


    // Helper function to update admin name
    function updateAdminName(newName) {
        // Update header admin name
        const headerAdminName = document.getElementById('adminName');
        if (headerAdminName) {
            headerAdminName.textContent = newName;
        }
        
        // Update initials based on new name
        const nameParts = newName.trim().split(' ');
        const firstname = nameParts[0] || '';
        const lastname = nameParts[1] || '';
        let initials = '';
        if (firstname) initials += firstname.charAt(0).toUpperCase();
        if (lastname) initials += lastname.charAt(0).toUpperCase();
        
        // Update all initials elements
        const profileInitialsElement = document.getElementById('profileInitials');
        if (profileInitialsElement) {
            profileInitialsElement.textContent = initials;
        }
        
        const dropdownProfileInitialsElement = document.getElementById('dropdownProfileInitials');
        if (dropdownProfileInitialsElement) {
            dropdownProfileInitialsElement.textContent = initials;
        }
        
        const currentProfileInitialsElement = document.getElementById('currentProfileInitials');
        if (currentProfileInitialsElement) {
            currentProfileInitialsElement.textContent = initials;
        }
        
        const brgyAdminInitialsElement = document.getElementById('brgyAdminInitials');
        if (brgyAdminInitialsElement) {
            brgyAdminInitialsElement.textContent = initials;
        }
    }
})();
