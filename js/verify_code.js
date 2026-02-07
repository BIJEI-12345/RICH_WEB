// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const email = urlParams.get('email');
const error = urlParams.get('error');
const success = urlParams.get('success');
const verified = urlParams.get('verified');
const code = urlParams.get('code');

// Debug: Log URL parameters
console.log('URL Parameters:', {
    email: email,
    error: error,
    success: success,
    verified: verified,
    code: code
});

// Set email in hidden inputs
if (email) {
    document.getElementById('email-input').value = email;
    document.getElementById('reset-email-input').value = email;
}

// Set verification code in hidden input if available
if (code) {
    document.getElementById('reset-code-input').value = code;
}

// Display messages
const messageContainer = document.getElementById('message-container');
if (error) {
    messageContainer.innerHTML = '<div class="error-message">' + decodeURIComponent(error) + '</div>';
}
if (success) {
    messageContainer.innerHTML = '<div class="success-message">' + decodeURIComponent(success) + '</div>';
}

// Show password reset form if verification is successful
if (verified === '1' && code) {
    console.log('Showing password reset form...');
    document.getElementById('verify-form').style.display = 'none';
    document.getElementById('password-reset-form').style.display = 'block';
    document.querySelector('.resend-link').style.display = 'none';
    
    // Update heading and description
    document.querySelector('h2').textContent = 'Reset Your Password';
    document.querySelector('p').textContent = 'Please enter your new password below.';
    
    // Focus on first password field
    document.getElementById('new_password').focus();
    console.log('Password reset form should now be visible');
} else {
    console.log('Not showing password reset form. Verified:', verified, 'Code:', code);
}

// Set resend link
if (email) {
    document.getElementById('resend-link').href = 'php/send_code.php?resend=1&email=' + encodeURIComponent(email);
}

// Auto-focus on code input if verification form is visible
if (document.getElementById('verify-form').style.display !== 'none') {
    document.getElementById('verification_code').focus();
}

// Format input to only accept numbers and auto-submit when complete
document.getElementById('verification_code').addEventListener('input', function(e) {
    this.value = this.value.replace(/[^0-9]/g, '');
    
    // Auto-submit when 6 digits are entered
    if (this.value.length === 6) {
        // Show loading state
        const submitBtn = document.querySelector('#verify-form button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Verifying...';
        submitBtn.disabled = true;
        
        // Add visual feedback to input
        this.style.backgroundColor = '#f0f9ff';
        this.style.borderColor = '#3b82f6';
        
        // Add a small delay to show the complete code briefly
        setTimeout(() => {
            console.log('Auto-submitting verification code:', this.value);
            document.getElementById('verify-form').submit();
        }, 500);
    } else {
        // Reset visual state if not complete
        this.style.backgroundColor = '';
        this.style.borderColor = '';
    }
});

// Password confirmation validation
document.getElementById('confirm_password').addEventListener('input', function(e) {
    const newPassword = document.getElementById('new_password').value;
    const confirmPassword = this.value;
    
    if (confirmPassword && newPassword !== confirmPassword) {
        this.setCustomValidity('Passwords do not match');
    } else {
        this.setCustomValidity('');
    }
});

document.getElementById('new_password').addEventListener('input', function(e) {
    const confirmPassword = document.getElementById('confirm_password').value;
    
    if (confirmPassword && this.value !== confirmPassword) {
        document.getElementById('confirm_password').setCustomValidity('Passwords do not match');
    } else {
        document.getElementById('confirm_password').setCustomValidity('');
    }
    
    // Update password strength
    updatePasswordStrength(this.value);
    updatePasswordRequirements(this.value);
});

// Password toggle function
function togglePassword(fieldId) {
    const input = document.getElementById(fieldId);
    const icon = input.parentElement.querySelector('.password-icon');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'Hide';
    } else {
        input.type = 'password';
        icon.textContent = 'Show';
    }
}

// Password strength checker
function updatePasswordStrength(password) {
    const passStrength = document.getElementById('newPasswordStrength');
    if (!passStrength) return;
    
    const requirements = checkPasswordRequirements(password);
    const satisfiedCount = Object.values(requirements).filter(req => req).length;
    
    passStrength.className = 'password-strength';
    
    if (password.length === 0) {
        passStrength.className = 'password-strength';
    } else if (satisfiedCount <= 2) {
        passStrength.className = 'password-strength weak';
    } else if (satisfiedCount <= 4) {
        passStrength.className = 'password-strength medium';
    } else {
        passStrength.className = 'password-strength strong';
    }
}

// Password requirements checker
function updatePasswordRequirements(password) {
    const requirements = checkPasswordRequirements(password);
    const reqContainer = document.getElementById('newPasswordRequirements');
    if (!reqContainer) return;
    
    Object.keys(requirements).forEach(requirement => {
        const reqItem = reqContainer.querySelector(`[data-requirement="${requirement}"]`);
        if (reqItem) {
            if (requirements[requirement]) {
                reqItem.classList.add('satisfied');
            } else {
                reqItem.classList.remove('satisfied');
            }
        }
    });
}

// Password requirements checker function
function checkPasswordRequirements(password) {
    return {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
}
