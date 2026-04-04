const SLOT_STATUS_ENDPOINT = 'php/signup1.php?slot_status=1';

// Function to toggle password visibility (same as signup1)
function togglePasswordLogin() {
  const input = document.getElementById('password');
  const icon = document.querySelector('.password-icon');
  
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('show');
    icon.classList.add('hide');
  } else {
    input.type = 'password';
    icon.classList.remove('hide');
    icon.classList.add('show');
  }
}

// Function to show notification
function showNotification(message, type = 'success') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'success-notification';
  
  // Set icon based on type
  let iconClass = 'fas fa-check-circle';
  if (type === 'error') {
    iconClass = 'fas fa-times-circle';
    notification.classList.add('error');
  } else if (type === 'warning') {
    iconClass = 'fas fa-exclamation-triangle';
    notification.classList.add('warning');
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

// Function to show success notification (for backward compatibility)
function showSuccessNotification(message) {
  showNotification(message, 'success');
}

async function fetchSlotStatus() {
  const response = await fetch(SLOT_STATUS_ENDPOINT, {
    cache: 'no-cache'
  });

  if (!response.ok) {
    throw new Error('Slot status fetch failed');
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || 'Slot status unavailable');
  }

  return data.status ?? {};
}

async function handleSignupLink(event) {
  event.preventDefault();
  const targetUrl = event.currentTarget.href;

  try {
    const status = await fetchSlotStatus();
    if (status.totalFull) {
      const allPositionsHtml = (status.positions ?? [])
        .map(pos => `${pos.position} (${pos.active}/${pos.limit})`)
        .join('<br>');
      await Swal.fire({
        icon: 'warning',
        title: 'Account limit reached',
        html: `All ${status.totalLimit} user slots are occupied. Current slot usage:<br><strong>${allPositionsHtml}</strong>`,
        confirmButtonColor: '#1e40ff'
      });
      return;
    }

    // Don't show per-role warning here; allow signup because slots remain
    window.location.href = targetUrl;
  } catch (error) {
    console.error('Slot status check failed', error);
    showNotification('Unable to verify slot availability. Redirecting to sign up...', 'warning');
    window.location.href = targetUrl;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const signupLink = document.querySelector('.signup-text a');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  if (signupLink) {
    signupLink.addEventListener('click', handleSignupLink);
  }
  
  // Add Enter key support for email and password fields
  function handleEnterKey(e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      // Check if both fields have values
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      
      if (email && password) {
        // Trigger the form submit handler directly
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        loginForm.dispatchEvent(submitEvent);
      } else {
        // If fields are empty, show error
        showNotification('Please fill in all fields', 'error');
      }
    }
  }
  
  // Add Enter key listeners to both input fields
  if (emailInput) {
    emailInput.addEventListener('keydown', handleEnterKey);
  }
  
  if (passwordInput) {
    passwordInput.addEventListener('keydown', handleEnterKey);
  }
  
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    console.log('Login attempt:', { email, passwordLength: password.length });
    
    if (!email || !password) {
      showNotification('Please fill in all fields', 'error');
      return;
    }
    
    // Send login data to PHP
    fetch('/RICH/php/login.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({
        email: email,
        password: password
      })
    })
    .then(response => {
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      return response.json();
    })
    .then(data => {
      console.log('Response data:', data);
      if (data.ok) {
        showSuccessNotification('Login successful! Welcome ' + data.name);
        // Store email in localStorage for logout tracking when browser closes
        localStorage.setItem('user_email', email);
        console.log('Login successful for:', data.name, 'Position:', data.position);
        // Redirect to dashboard after showing notification
        setTimeout(() => {
          const redirectUrl = 'admin-dashboard.html';
          console.log('Redirecting to:', redirectUrl);
          window.location.href = redirectUrl;
        }, 2000);
      } else {
        showNotification(data.error || 'Login failed', 'error');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showNotification('Network error. Please try again.', 'error');
    });
  });
});
