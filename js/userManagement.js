document.addEventListener('DOMContentLoaded', () => {
	fetchUsers('pending'); // Start with pending users tab
	initializeEventListeners();
});

// Tab switching functionality
function switchTab(tabName) {
	// Remove active class from all tabs and panels
	document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
	document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
	
	// Add active class to selected tab and panel
	document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
	document.getElementById(`${tabName}-tab`).classList.add('active');
	
	// Fetch users for the selected tab
	fetchUsers(tabName);
}

// Initialize event listeners for modals and dropdowns
function initializeEventListeners() {
	// Admin Profile Dropdown - only initialize if elements exist
	const adminProfile = document.getElementById('adminProfile');
	const adminDropdown = document.getElementById('adminDropdown');
	
	if (adminProfile && adminDropdown) {
		adminProfile.addEventListener('click', (e) => {
			e.stopPropagation();
			toggleAdminDropdown();
		});
		
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
	}
	
	// Notification Dropdown - only initialize if elements exist
	const notificationBell = document.getElementById('notificationBell');
	const notificationDropdown = document.getElementById('notificationDropdown');
	
	if (notificationBell && notificationDropdown) {
		notificationBell.addEventListener('click', (e) => {
			e.stopPropagation();
			toggleNotificationDropdown();
		});
		
		// Close dropdown when clicking outside
		document.addEventListener('click', (e) => {
			if (!notificationDropdown.classList.contains('show')) return;
			const target = e.target;
			if (!(notificationBell.contains(target) || notificationDropdown.contains(target))) {
				closeNotificationDropdown();
			}
		});
		
		// Close dropdown when pressing Escape key
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') closeNotificationDropdown();
		});
	}
	
	// Edit Profile Modal
	const editProfileModal = document.getElementById('editProfileModal');
	const editProfileForm = document.getElementById('editProfileForm');
	const profileImageInput = document.getElementById('profileImageInput');
	const currentProfileImg = document.getElementById('currentProfileImg');
	
	if (editProfileModal && editProfileForm) {
		// Handle image upload preview
		if (profileImageInput && currentProfileImg) {
			profileImageInput.addEventListener('change', function(e) {
				const file = e.target.files[0];
				if (file) {
					const reader = new FileReader();
					reader.onload = function(e) {
						currentProfileImg.src = e.target.result;
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
			const newName = formData.get('adminName');
			
			// Update admin name in header and dropdown
			updateAdminName(newName);
			
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
	}
	
	// Status Modal
	const statusModal = document.getElementById('statusModal');
	if (statusModal) {
		// Close status modal when clicking outside
		statusModal.addEventListener('click', function(e) {
			if (e.target === statusModal) {
				closeStatusModal();
			}
		});
		
		// Close status modal with Escape key
		document.addEventListener('keydown', function(e) {
			if (e.key === 'Escape' && statusModal.classList.contains('show')) {
				closeStatusModal();
			}
		});
	}
}

async function fetchUsers(userType = 'pending') {
	const loadingState = document.getElementById(`${userType}-loadingState`);
	const usersList = document.getElementById(`${userType}-users-list`);
	const emptyState = document.getElementById(`${userType}-emptyState`);
	
	// Show loading state
	if (loadingState) loadingState.style.display = 'flex';
	if (usersList) usersList.style.display = 'none';
	if (emptyState) emptyState.style.display = 'none';
	
	try {
		const response = await fetch(`php/userManagement.php?type=${userType}&${Date.now()}`, { 
			headers: { 'Accept': 'application/json' },
			cache: 'no-cache'
		});
		if (!response.ok) throw new Error('Network response was not ok');
		const data = await response.json();
		
		// Hide loading state
		if (loadingState) loadingState.style.display = 'none';
		
		const users = data.users || [];
		if (users.length === 0) {
			// Show empty state
			if (emptyState) emptyState.style.display = 'block';
		} else {
			// Show users list
			if (usersList) {
				usersList.style.display = 'block';
				renderUsers(users, userType);
			}
		}
	} catch (error) {
		// Hide loading state
		if (loadingState) loadingState.style.display = 'none';
		
		// Show error in users list
		if (usersList) {
			usersList.style.display = 'block';
			renderUsersError(error.message || 'Failed to load users', userType);
		}
	}
}

function renderUsers(users, userType = 'pending') {
	const container = document.getElementById(`${userType}-users-list`);
	if (!container) return;
	container.innerHTML = '';

	if (!Array.isArray(users) || users.length === 0) {
		container.innerHTML = '<p>No users found</p>';
		return;
	}

	const fragment = document.createDocumentFragment();

	users.forEach((u) => {
		const row = document.createElement('div');
		row.className = 'user-row';
		row.setAttribute('data-user-id', u.id);

		// Create expanded user card layout
		const userCard = document.createElement('div');
		userCard.className = 'user-card';

		// User info section
		const userInfo = document.createElement('div');
		userInfo.className = 'user-info';

		const name = document.createElement('div');
		name.className = 'user-name';
		name.textContent = `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown User';

		const email = document.createElement('div');
		email.className = 'user-email';
		email.textContent = u.email ? maskEmail(u.email) : 'No email';

		const details = document.createElement('div');
		details.className = 'user-details';
		
		// Create individual detail elements in a row
		const detailArray = [];
		if (u.position) detailArray.push(`Position: ${u.position}`);
		if (u.gender) detailArray.push(`Gender: ${u.gender}`);
		if (u.age) detailArray.push(`Age: ${u.age}`);
		if (u.address) detailArray.push(`Address: ${u.address}`);
		
		// Join with bullet separator
		details.textContent = detailArray.join(' • ');

		// Add verification status label
		const verificationStatus = document.createElement('div');
		verificationStatus.className = 'verification-status';
		
		if (u.verified_email == 1) {
			verificationStatus.innerHTML = '<i class="fas fa-check-circle"></i> Email Verified';
			verificationStatus.classList.add('verified');
		} else {
			verificationStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> Email Not Verified';
			verificationStatus.classList.add('not-verified');
		}

		userInfo.appendChild(name);
		userInfo.appendChild(email);
		userInfo.appendChild(details);
		userInfo.appendChild(verificationStatus);

		// Actions section
		const actions = document.createElement('div');
		actions.className = 'user-actions';

		// Create buttons based on user status
		if (u.action && u.action.toLowerCase() === 'accepted') {
			// User is accepted - show "Accepted" (disabled) and "Deactivate" buttons
			const acceptedBtn = document.createElement('button');
			acceptedBtn.className = 'btn accepted-btn';
			acceptedBtn.innerHTML = '<i class="fas fa-check"></i> Accepted';
			acceptedBtn.disabled = true;
			acceptedBtn.title = 'User is accepted';

			const deactivateBtn = document.createElement('button');
			deactivateBtn.className = 'btn deactivate-btn';
			deactivateBtn.innerHTML = '<i class="fas fa-ban"></i> Deactivate';
			deactivateBtn.title = 'Deactivate this user';
			deactivateBtn.addEventListener('click', () => submitDecision(u.id, 'deactivate'));

			actions.appendChild(acceptedBtn);
			actions.appendChild(deactivateBtn);
		} else if (u.action && u.action.toLowerCase() === 'deactivated') {
			// User is deactivated - show "Activate" button only
			const activateBtn = document.createElement('button');
			activateBtn.className = 'btn activate-btn';
			activateBtn.innerHTML = '<i class="fas fa-play"></i> Activate';
			activateBtn.title = 'Activate this user';
			activateBtn.addEventListener('click', () => submitDecision(u.id, 'activate'));

			actions.appendChild(activateBtn);
		} else {
			// User is pending - show "Accept" and "Deny" buttons
			const acceptBtn = document.createElement('button');
			acceptBtn.className = 'btn accept-btn';
			acceptBtn.innerHTML = '<i class="fas fa-check"></i> Accept';
			acceptBtn.title = 'Accept this user';
			acceptBtn.addEventListener('click', () => submitDecision(u.id, 'approve'));

			const denyBtn = document.createElement('button');
			denyBtn.className = 'btn deny-btn';
			denyBtn.innerHTML = '<i class="fas fa-times"></i> Deny';
			denyBtn.title = 'Deny this user';
			denyBtn.addEventListener('click', () => submitDecision(u.id, 'reject'));

			actions.appendChild(acceptBtn);
			actions.appendChild(denyBtn);
		}

		userCard.appendChild(userInfo);
		userCard.appendChild(actions);
		row.appendChild(userCard);

		fragment.appendChild(row);
	});

	container.appendChild(fragment);
}

function pLine(label, value, isHtml = false) {
	const p = document.createElement('p');
	p.innerHTML = `<strong>${escapeHtml(label)}:</strong> ${isHtml ? value : escapeHtml(value ?? '')}`;
	return p;
}

function renderUsersError(message, userType = 'pending') {
	const container = document.getElementById(`${userType}-users-list`);
	if (container) container.innerHTML = `<p>${escapeHtml(message)}</p>`;
}

function escapeHtml(unsafe) {
	const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
	return String(unsafe).replace(/[&<>"']/g, (m) => map[m]);
}

function maskEmail(email) {
	if (!email || !email.includes('@')) return email;
	
	const parts = email.split('@');
	const username = parts[0];
	const domain = parts[1];
	
	if (username.length <= 4) {
		// For short usernames, just show first char + asterisks
		return username.charAt(0) + '*'.repeat(username.length - 1) + '@' + domain;
	} else {
		// For longer usernames, show first 2 chars + asterisks + last 2 chars
		const firstTwo = username.substring(0, 2);
		const lastTwo = username.substring(username.length - 2);
		const asterisks = '*'.repeat(username.length - 4);
		return firstTwo + asterisks + lastTwo + '@' + domain;
	}
}

async function submitDecision(id, action) {
	try {
		const response = await fetch('php/userManagement.php', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
			body: JSON.stringify({ id, action })
		});
		const res = await response.json();
		if (!response.ok || res.success === false) throw new Error(res.message || 'Update failed');
		
		// Show success message using the status modal
		let title = '';
		let message = '';
		
		switch(action) {
			case 'approve':
				title = 'User Approved';
				message = 'User has been successfully approved.';
				break;
			case 'deactivate':
				title = 'User Deactivated';
				message = 'User has been deactivated and no longer has access to the system.';
				break;
			case 'activate':
				title = 'User Activated';
				message = 'User has been activated and now has access to the system.';
				break;
			case 'reject':
				title = 'User Denied';
				message = 'User account has been deleted.';
				break;
		}
		
		showStatusModal('success', title, message);
		
		await fetchUsers();
	} catch (e) {
		// Show error message using the status modal
		showStatusModal('error', 'Error', e.message || 'Failed to update user');
	}
}

// Navigation Functions
function navigateToDashboard() {
	window.location.href = 'admin-dashboard.html';
}

// Admin Profile Dropdown Functions
function toggleAdminDropdown() {
	const dropdown = document.getElementById('adminDropdown');
	const profile = document.getElementById('adminProfile');
	
	if (!dropdown || !profile) return; // Exit if elements don't exist
	
	if (dropdown.classList.contains('show')) {
		closeAdminDropdown();
	} else {
		openAdminDropdown();
	}
}

function openAdminDropdown() {
	const dropdown = document.getElementById('adminDropdown');
	const profile = document.getElementById('adminProfile');
	
	if (!dropdown || !profile) return; // Exit if elements don't exist
	
	dropdown.classList.add('show');
	dropdown.setAttribute('aria-hidden', 'false');
	profile.setAttribute('aria-expanded', 'true');
}

function closeAdminDropdown() {
	const dropdown = document.getElementById('adminDropdown');
	const profile = document.getElementById('adminProfile');
	
	if (!dropdown || !profile) return; // Exit if elements don't exist
	
	dropdown.classList.remove('show');
	dropdown.setAttribute('aria-hidden', 'true');
	profile.setAttribute('aria-expanded', 'false');
}

function editProfile() {
	openEditProfileModal();
	closeAdminDropdown();
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

// Notification Dropdown Functions
function toggleNotificationDropdown() {
	const dropdown = document.getElementById('notificationDropdown');
	const bell = document.getElementById('notificationBell');
	
	if (!dropdown || !bell) return; // Exit if elements don't exist
	
	if (dropdown.classList.contains('show')) {
		closeNotificationDropdown();
	} else {
		openNotificationDropdown();
	}
}

function openNotificationDropdown() {
	const dropdown = document.getElementById('notificationDropdown');
	const bell = document.getElementById('notificationBell');
	
	if (!dropdown || !bell) return; // Exit if elements don't exist
	
	dropdown.classList.add('show');
	dropdown.setAttribute('aria-hidden', 'false');
	bell.setAttribute('aria-expanded', 'true');
}

function closeNotificationDropdown() {
	const dropdown = document.getElementById('notificationDropdown');
	const bell = document.getElementById('notificationBell');
	
	if (!dropdown || !bell) return; // Exit if elements don't exist
	
	dropdown.classList.remove('show');
	dropdown.setAttribute('aria-hidden', 'true');
	bell.setAttribute('aria-expanded', 'false');
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
	
	// Remove aria-hidden instead of setting it to false for better accessibility
	modal.removeAttribute('aria-hidden');
}

function closeStatusModal() {
	const modal = document.getElementById('statusModal');
	modal.classList.remove('show');
	modal.setAttribute('aria-hidden', 'true');
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
}

// Helper function to update profile images
function updateProfileImages(imageSrc) {
	// Update header profile image
	const headerProfileImg = document.querySelector('.admin-profile .profile-img');
	if (headerProfileImg) {
		headerProfileImg.src = imageSrc;
	}
	
	// Update dropdown profile image
	const dropdownProfileImg = document.querySelector('.dropdown-profile-img');
	if (dropdownProfileImg) {
		dropdownProfileImg.src = imageSrc;
	}
}

// Helper function to update admin name
function updateAdminName(newName) {
	// Update header admin name
	const headerAdminName = document.querySelector('.admin-name');
	if (headerAdminName) {
		headerAdminName.textContent = newName;
	}
}


