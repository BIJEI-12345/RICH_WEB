document.addEventListener('DOMContentLoaded', function() {
    const newPassword = document.getElementById('new_password');
    const confirmPassword = document.getElementById('confirm_password');
    const toggleNewPassword = document.getElementById('toggleNewPassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
    const eyeIconNew = document.getElementById('eyeIconNew');
    const eyeIconConfirm = document.getElementById('eyeIconConfirm');
    const passwordStrength = document.getElementById('passwordStrength');
    const passwordMatch = document.getElementById('passwordMatch');
    const resetForm = document.getElementById('resetForm');
    
    // Toggle password visibility for new password
    toggleNewPassword.addEventListener('click', function() {
        const type = newPassword.getAttribute('type') === 'password' ? 'text' : 'password';
        newPassword.setAttribute('type', type);
        
        if (type === 'password') {
            eyeIconNew.src = 'Images/eye-closed.svg';
        } else {
            eyeIconNew.src = 'Images/eye-open.svg';
        }
    });
    
    // Toggle password visibility for confirm password
    toggleConfirmPassword.addEventListener('click', function() {
        const type = confirmPassword.getAttribute('type') === 'password' ? 'text' : 'password';
        confirmPassword.setAttribute('type', type);
        
        if (type === 'password') {
            eyeIconConfirm.src = 'Images/eye-closed.svg';
        } else {
            eyeIconConfirm.src = 'Images/eye-open.svg';
        }
    });
    
    // Check password strength
    newPassword.addEventListener('input', function() {
        const password = this.value;
        let strength = 0;
        let message = '';
        
        if (password.length >= 8) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        
        if (strength < 2) {
            message = '<span class="strength-weak">Weak password</span>';
        } else if (strength < 4) {
            message = '<span class="strength-medium">Medium strength password</span>';
        } else {
            message = '<span class="strength-strong">Strong password</span>';
        }
        
        passwordStrength.innerHTML = message;
    });
    
    // Check password match
    confirmPassword.addEventListener('input', function() {
        if (this.value && newPassword.value) {
            if (this.value === newPassword.value) {
                passwordMatch.innerHTML = '<span class="strength-strong">Passwords match</span>';
            } else {
                passwordMatch.innerHTML = '<span class="strength-weak">Passwords do not match</span>';
            }
        } else {
            passwordMatch.innerHTML = '';
        }
    });
    
    // Form validation
    resetForm.addEventListener('submit', function(e) {
        if (newPassword.value !== confirmPassword.value) {
            e.preventDefault();
            alert('Passwords do not match. Please check and try again.');
            return false;
        }
        
        if (newPassword.value.length < 8) {
            e.preventDefault();
            alert('Password must be at least 8 characters long.');
            return false;
        }
    });
});
