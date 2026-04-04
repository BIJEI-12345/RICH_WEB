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

var resendCooldownSeconds = 0;
var resendCooldownTimer = null;

function formatResendTime(totalSeconds) {
    var sec = Math.max(0, parseInt(totalSeconds, 10) || 0);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
}

function setResendButtonLabel(text) {
    var label = document.getElementById('resendOtpBtnLabel');
    if (label) label.textContent = text;
}

// OTP Verification functionality
document.addEventListener('DOMContentLoaded', function() {
    // Auto-focus on OTP input and load user data
    document.getElementById('otpCode').focus();
    
    // Load user data from session
    loadUserData();

    var resendBtn = document.getElementById('resendOtpBtn');
    if (resendBtn) {
        resendBtn.addEventListener('click', function () {
            if (resendCooldownSeconds > 0) return;
            resendOTP();
        });
    }
    
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
            var wait = parseInt(data.resend_available_in_seconds, 10);
            if (!isNaN(wait) && wait > 0) {
                startResendCooldown(wait);
            }
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
                window.location.href = 'index.php';
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

function startResendCooldown(seconds) {
    var n = parseInt(seconds, 10);
    if (!n || n <= 0) {
        return;
    }
    resendCooldownSeconds = n;
    var btn = document.getElementById('resendOtpBtn');
    var hint = document.getElementById('resendCooldown');
    if (resendCooldownTimer) clearInterval(resendCooldownTimer);

    function setCooldownUi(sec) {
        var line = 'Resend in ' + formatResendTime(sec);
        if (btn) {
            btn.disabled = true;
            btn.hidden = true;
            setResendButtonLabel('Resend OTP');
            btn.setAttribute('aria-label', 'Resend verification code to your email');
        }
        if (hint) {
            hint.removeAttribute('hidden');
            hint.textContent = line;
        }
    }

    function clearCooldownUi() {
        if (btn) {
            btn.disabled = false;
            btn.hidden = false;
            setResendButtonLabel('Resend OTP');
            btn.setAttribute('aria-label', 'Resend verification code to your email');
        }
        if (hint) {
            hint.setAttribute('hidden', '');
            hint.textContent = '';
        }
    }

    function tick() {
        if (resendCooldownSeconds <= 0) {
            clearCooldownUi();
            clearInterval(resendCooldownTimer);
            resendCooldownTimer = null;
            return;
        }
        setCooldownUi(resendCooldownSeconds);
        resendCooldownSeconds--;
    }
    tick();
    resendCooldownTimer = setInterval(tick, 1000);
}

function resendOTP() {
    var btn = document.getElementById('resendOtpBtn');
    if (btn) btn.disabled = true;

    fetch('php/resend_signup_otp.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({})
    })
    .then(function (response) {
        return response.text().then(function (raw) {
            try {
                return JSON.parse(raw);
            } catch (e) {
                console.error('Resend response was not JSON:', raw.slice(0, 400));
                throw new Error('Invalid server response');
            }
        });
    })
    .then(function (data) {
        if (data.success) {
            var successMsg = data.message || 'New OTP code has been sent to your email.';
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'Code sent',
                    text: 'New OTP code has been sent to your email.',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#2563eb',
                    customClass: {
                        popup: 'signup2-swal-popup',
                        confirmButton: 'signup2-swal-confirm'
                    }
                });
            } else {
                showSuccess(successMsg);
            }
            document.getElementById('otpCode').value = '';
            document.getElementById('otpCode').focus();
            startResendCooldown(60);
        } else {
            var retry = parseInt(data.retry_after_seconds, 10);
            showError(data.message || 'Failed to resend code');
            if (retry > 0) {
                startResendCooldown(retry);
            } else if (btn) {
                btn.disabled = false;
            }
        }
    })
    .catch(function (error) {
        console.error('Error:', error);
        showError('Network error. Please try again.');
        if (btn) btn.disabled = false;
    });
}