(function(){
  try{
    var hasFlag = /(?:^|[&?])_prg=1(?:&|$)/.test(location.search);
    if(!hasFlag && window.history && typeof window.history.replaceState === 'function'){
      var sep = location.search && location.search.length > 0 ? '&' : '?';

      var next = location.pathname + location.search + sep + '_prg=1' + location.hash;
      history.replaceState(null, '', next);
    }
  }catch(e){
    // para sa pag refresh ng web 
  }
})();

// OTP Verification functionality
document.addEventListener('DOMContentLoaded', function() {
    // Auto-focus on OTP input and load user data
    document.getElementById('otpCode').focus();
    
    // Load user data from session
    loadUserData();
    
    // Auto-submit when 6 digits are entered
    document.getElementById('otpCode').addEventListener('input', function(e) {
        // Remove non-numeric characters
        this.value = this.value.replace(/[^0-9]/g, '');
        
        if (this.value.length === 6) {
            // Small delay before submission
            setTimeout(() => {
                document.getElementById('otpForm').dispatchEvent(new Event('submit'));
            }, 100);
        }
    });
    
    // Handle form submission
    document.getElementById('otpForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const otpCode = document.getElementById('otpCode').value;
        const errorDiv = document.getElementById('errorMessage');
        const successDiv = document.getElementById('successMessage');
        
        // Hide previous messages
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';
        
        // Validate OTP
        if (!otpCode) {
            showError('Please enter the verification code');
            return;
        }
        
        if (!/^\d{6}$/.test(otpCode)) {
            showError('Please enter a valid 6-digit code');
            return;
        }
        
        // Submit OTP for verification
        verifyOTP(otpCode);
    });
});

function loadUserData() {
    fetch('php/get_signup_info.php')
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('userEmail').textContent = data.email;
            document.getElementById('userName').textContent = data.name;
        } else {
            document.getElementById('userEmail').textContent = 'Session expired';
            document.getElementById('userName').textContent = 'Please register again';
        }
    })
    .catch(error => {
        console.error('Error loading user data:', error);
        document.getElementById('userEmail').textContent = 'Error loading data';
        document.getElementById('userName').textContent = 'Error loading data';
    });
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    document.getElementById('otpCode').focus();
}

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
}

function verifyOTP(otpCode) {
    // Send OTP to server for verification
    fetch('php/verify_signup_otp.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            otp: otpCode
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showSuccess(data.message);
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } else {
            showError(data.message || 'Invalid verification code');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showError('Network error. Please try again.');
    });
}

function resendOTP() {
    // Send request to resend OTP
    fetch('php/resend_signup_otp.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showSuccess('New verification code sent to your email!');
            document.getElementById('otpCode').value = '';
            document.getElementById('otpCode').focus();
        } else {
            showError(data.message || 'Failed to resend code');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showError('Network error. Please try again.');
    });
}