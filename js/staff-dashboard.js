// Staff Dashboard JavaScript Functions

// View-only navigation functions
function viewDocuments() {
    // Navigate to document viewing page (read-only)
    showStatusModal('info', 'Document Requests', 'This will show document requests in read-only mode.');
}

function viewFeedback() {
    // Navigate to feedback viewing page (read-only)
    showStatusModal('info', 'Feedback & Concerns', 'This will show community feedback in read-only mode.');
}

function viewEmergency() {
    // Navigate to emergency reports viewing page (read-only)
    showStatusModal('info', 'Emergency Reports', 'This will show emergency reports in read-only mode.');
}

function viewUsers() {
    // Navigate to user information viewing page (read-only)
    showStatusModal('info', 'User Information', 'This will show user information in read-only mode.');
}

function viewResidentInfo() {
    // Navigate to resident information viewing page (read-only)
    showStatusModal('info', 'Resident Information', 'This will show resident information in read-only mode.');
}

// Staff Profile Dropdown Functions
function toggleStaffDropdown() {
    const dropdown = document.getElementById('staffDropdown');
    const profile = document.getElementById('staffProfile');
    
    if (dropdown.classList.contains('show')) {
        closeStaffDropdown();
    } else {
        openStaffDropdown();
    }
}

function openStaffDropdown() {
    const dropdown = document.getElementById('staffDropdown');
    const profile = document.getElementById('staffProfile');
    
    dropdown.classList.add('show');
    dropdown.setAttribute('aria-hidden', 'false');
    profile.setAttribute('aria-expanded', 'true');
}

function closeStaffDropdown() {
    const dropdown = document.getElementById('staffDropdown');
    const profile = document.getElementById('staffProfile');
    
    dropdown.classList.remove('show');
    dropdown.setAttribute('aria-hidden', 'true');
    profile.setAttribute('aria-expanded', 'false');
}

function editProfile() {
    // Function to handle profile editing
    openEditProfileModal();
    closeStaffDropdown();
}

function openEditProfileModal() {
    const modal = document.getElementById('editProfileModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

function closeEditProfileModal() {
    const modal = document.getElementById('editProfileModal');
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
        case 'info':
            icon.className = 'fas fa-info-circle';
            modal.classList.add('show');
            break;
        default:
            icon.className = 'fas fa-info-circle';
            modal.classList.add('show');
    }
    
    modal.setAttribute('aria-hidden', 'false');
}

function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

function logout() {
    // Function to handle logout
    showLogoutConfirmationModal();
    closeStaffDropdown();
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
            window.location.href = 'index.php';
        }
    };
    
    modal.setAttribute('aria-hidden', 'false');
}

// ---- Announcements & Events Slider ----
(function(){
    const slidesWrapper = document.getElementById('announceSlides');
    const prevBtn = document.getElementById('announcePrev');
    const nextBtn = document.getElementById('announceNext');
    const dotsContainer = document.getElementById('announceDots');

    if (!slidesWrapper) return; // run only on staff dashboard

    let current = 0;
    const autoplayMs = 3000;
    let timerId = null;

    function getSlides(){
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
        const targetLeft = target.offsetLeft - slidesWrapper.offsetLeft - 8;
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

    // Pause on hover
    const slider = document.getElementById('announceSlider');
    if (slider){
        slider.addEventListener('mouseenter', stopAutoplay);
        slider.addEventListener('mouseleave', startAutoplay);
    }

    // Initialize
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

    if (!bell || !dropdown) return;

    function updateEmptyState(){
        const items = list ? list.querySelectorAll('.notif-item') : [];
        const hasItems = items && items.length > 0;
        if (badge) badge.style.display = hasItems ? 'inline-block' : 'none';
        if (viewMoreBtn) viewMoreBtn.disabled = !hasItems;
        const footer = dropdown.querySelector('.notif-footer');
        if (footer) footer.style.display = hasItems ? 'flex' : 'none';
    }

    function open(){
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
        updateEmptyState();
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
            // Navigate to a full notifications page (placeholder)
            showStatusModal('info', 'Notifications', 'This will show all notifications in read-only mode.');
        });
    }

    updateEmptyState();
})();

// ---- Staff Profile Dropdown ----
(function(){
    const staffProfile = document.getElementById('staffProfile');
    const staffDropdown = document.getElementById('staffDropdown');

    if (!staffProfile || !staffDropdown) return;

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!staffDropdown.classList.contains('show')) return;
        const target = e.target;
        if (!(staffProfile.contains(target) || staffDropdown.contains(target))) {
            closeStaffDropdown();
        }
    });

    // Close dropdown when pressing Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeStaffDropdown();
    });
})();

// ---- Edit Profile Modal ----
(function(){
    const editProfileModal = document.getElementById('editProfileModal');
    const editProfileForm = document.getElementById('editProfileForm');
    const profileImageInput = document.getElementById('profileImageInput');
    const currentProfileImg = document.getElementById('currentProfileImg');
    const staffNameInput = document.getElementById('staffName');

    if (!editProfileModal || !editProfileForm) return;

    // Handle image upload preview
    if (profileImageInput) {
        profileImageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    currentProfileImg.src = e.target.result;
                    // Also update the profile images in the header and dropdown
                    updateProfileImages(e.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Handle form submission
    editProfileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(editProfileForm);
        const newName = formData.get('staffName');
        const newImage = formData.get('profileImage');
        
        // Update staff name in header and dropdown
        updateStaffName(newName);
        
        // If new image was uploaded, it's already updated via the change event
        if (newImage && newImage.size > 0) {
            console.log('Profile image updated');
        }
        
        // Show success message
        showStatusModal('success', 'Profile Updated Successfully!', 'Your profile has been updated successfully.');
        
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

    // Helper function to update profile images
    function updateProfileImages(imageSrc) {
        // Update header profile image
        const headerProfileImg = document.querySelector('.staff-profile .profile-img');
        if (headerProfileImg) {
            headerProfileImg.src = imageSrc;
        }
        
        // Update dropdown profile image
        const dropdownProfileImg = document.querySelector('.dropdown-profile-img');
        if (dropdownProfileImg) {
            dropdownProfileImg.src = imageSrc;
        }
    }

    // Helper function to update staff name
    function updateStaffName(newName) {
        // Update header staff name
        const headerStaffName = document.querySelector('.staff-name');
        if (headerStaffName) {
            headerStaffName.textContent = newName;
        }
    }
})();
