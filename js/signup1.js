// Simple client-side validation for signup step 1
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form.form');
  const btn = document.getElementById('createAccountBtn');
  const noMiddleCheckbox = document.getElementById('noMiddle');
  const SLOT_STATUS_ENDPOINT = 'php/signup1.php?slot_status=1';

  const requiredFieldSelectors = [
    'input[name="email"]',
    'input[name="name"]',
    'input[name="age"]',
    'select[name="position"]',
    'select[name="gender"]',
    'textarea[name="address"]',
    'input[name="pass"]',
    'input[name="confirm"]'
  ];


  // responsive: pag nag input mawawala ang required indicator
  const requiredNames = new Set([
    'email',
    'name',
    'age',
    'position',
    'gender',
    'address',
    'pass',
    'confirm'
  ]);

  const allControls = document.querySelectorAll('input, select, textarea');
  allControls.forEach((el) => {
    const handler = () => onValueChange(el);
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });

  // Live clear of invalid indicator when user starts typing/selecting
  const onValueChange = (el) => {
    const value = (el.value || '').trim();
    if (value !== '') {
      clearInvalid(el);
    }

    // If editing passwords, clear mismatch once they match
    if (el.name === 'pass' || el.name === 'confirm') {
      const passInput = document.querySelector('input[name="pass"]');
      const confirmInput = document.querySelector('input[name="confirm"]');
      if (passInput && confirmInput) {
        const passVal = passInput.value.trim();
        const confirmVal = confirmInput.value.trim();
        if (passVal !== '' && confirmVal !== '' && passVal === confirmVal) {
          clearInvalid(passInput);
          clearInvalid(confirmInput);
        }
      }
    }
  };

  const markInvalid = (el) => {
    el.classList.add('is-invalid');
    el.setAttribute('aria-invalid', 'true');
    const group = el.closest('.input_group') || el.parentElement;
    if (group) {
      let msg = group.querySelector('.field-error');
      if (!msg) {
        msg = document.createElement('div');
        msg.className = 'field-error';
        group.appendChild(msg);
      }
      msg.textContent = 'Please fill out this field.';
    }
  };

  const clearInvalid = (el) => {
    el.classList.remove('is-invalid');
    el.removeAttribute('aria-invalid');
    const group = el.closest('.input_group') || el.parentElement;
    if (group) {
      const msg = group.querySelector('.field-error');
      if (msg) msg.remove();
    }
  };

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

  async function handlePositionChange(event) {
    const select = event.currentTarget;
    const value = select.value;
    if (!value) return;

    try {
      const status = await fetchSlotStatus();
      const positionStatus = (status.positions ?? []).find(pos => pos.position === value);
      if (positionStatus?.full) {
        await Swal.fire({
          icon: 'warning',
          title: `${positionStatus.position} is full`,
          html: `This role already has ${positionStatus.limit} active users. Please choose another role.`,
          confirmButtonColor: '#1e40ff'
        });
        select.value = '';
      }
    } catch (error) {
      console.error('Slot status check failed', error);
    }
  }

  // Handle form submission
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous errors
    document.querySelectorAll('.field-error').forEach(msg => msg.remove());
    document.querySelectorAll('.is-invalid').forEach(el => {
      el.classList.remove('is-invalid');
      el.removeAttribute('aria-invalid');
    });

    let isValid = true;

    // Validate required fields
    for (const selector of requiredFieldSelectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      // For select, treat empty value as invalid
      const value = (el.value || '').trim();
      const invalid = value === '';
      if (invalid) {
        isValid = false;
        markInvalid(el);
      } else {
        clearInvalid(el);
      }
    }

    // Extra validation: password strength and match
    const passInput = document.querySelector('input[name="pass"]');
    const confirmInput = document.querySelector('input[name="confirm"]');
    
    if (passInput && passInput.value.trim() !== '') {
      const requirements = checkPasswordRequirements(passInput.value);
      const satisfiedCount = Object.values(requirements).filter(req => req).length;
      
      // Require at least 4 out of 5 requirements to be satisfied
      if (satisfiedCount < 4) {
        isValid = false;
        markInvalid(passInput);
        const group = passInput.closest('.input_group') || passInput.parentElement;
        if (group) {
          let msg = group.querySelector('.field-error');
          if (!msg) {
            msg = document.createElement('div');
            msg.className = 'field-error';
            group.appendChild(msg);
          }
          msg.textContent = 'Please meet at least 4 password requirements.';
        }
      }
    }
    
    if (passInput && confirmInput && passInput.value.trim() !== '' && confirmInput.value.trim() !== '') {
      if (passInput.value !== confirmInput.value) {
        isValid = false;
        markInvalid(passInput);
        markInvalid(confirmInput);
        const group = confirmInput.closest('.input_group') || confirmInput.parentElement;
        if (group) {
          let msg = group.querySelector('.field-error');
          if (!msg) {
            msg = document.createElement('div');
            msg.className = 'field-error';
            group.appendChild(msg);
          }
          msg.textContent = 'Passwords do not match.';
        }
      }
    }

    if (!isValid) {
      // Focus first invalid element
      const firstInvalid = form.querySelector('.is-invalid') || form.querySelector(':invalid');
      firstInvalid?.focus();
      return;
    }

    // Show loading state
    const submitBtn = document.getElementById('createAccountBtn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating Account...';
    submitBtn.disabled = true;

    try {
      // Get form data
      const formData = new FormData(form);
      
      // Debug: Log form data being sent
      console.log('Form data being sent:');
      for (let [key, value] of formData.entries()) {
        console.log(key + ': ' + value);
      }
      
      // Send data to PHP file
      const response = await fetch('php/signup1.php', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        // Success - show success message and redirect
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: result.message,
          confirmButtonText: 'Continue',
          confirmButtonColor: '#1e40ff'
        }).then(() => {
          window.location.href = result.redirect;
        });
      } else {
        // Handle validation errors
        if (result.errors) {
          Object.keys(result.errors).forEach(field => {
            const el = document.querySelector(`[name="${field}"]`);
            if (el) {
              markInvalid(el);
              const group = el.closest('.input_group') || el.parentElement;
              if (group) {
                let msg = group.querySelector('.field-error');
                if (!msg) {
                  msg = document.createElement('div');
                  msg.className = 'field-error';
                  group.appendChild(msg);
                }
                msg.textContent = result.errors[field];
              }
            }
          });
          
          // Focus first error field
          const firstError = document.querySelector('.is-invalid');
          firstError?.focus();
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Something went wrong. Please try again.',
            confirmButtonColor: '#dc2626'
          });
        }
      }

    } catch (error) {
      console.error('Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Network error. Please check your connection and try again.',
        confirmButtonColor: '#dc2626'
      });
    } finally {
      // Restore button state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });

  const positionSelect = document.querySelector('select[name="position"]');
  if (positionSelect) {
    positionSelect.addEventListener('change', handlePositionChange);
  }

  // Auto-append "Norzagaray, Bulacan" to address field
  const addressTextarea = document.querySelector('textarea[name="address"]');
  if (addressTextarea) {
    const norzagaray = 'Norzagaray';
    const bulacan = 'Bulacan';
    const fullLocation = 'Norzagaray, Bulacan';
    
    // Function to capitalize first letter of each word
    const capitalizeWords = (text) => {
      return text.replace(/\b\w/g, (char) => char.toUpperCase());
    };
    
    // Function to apply capitalization
    const applyCapitalization = () => {
      const currentValue = addressTextarea.value;
      if (currentValue.trim() === '') return;
      
      // Get cursor position before capitalization
      const cursorPosition = addressTextarea.selectionStart;
      
      // Capitalize the text
      const capitalized = capitalizeWords(currentValue);
      
      // Only update if it changed (to avoid cursor jumping)
      if (capitalized !== currentValue) {
        addressTextarea.value = capitalized;
        // Restore cursor position
        addressTextarea.setSelectionRange(cursorPosition, cursorPosition);
      }
    };
    
    // Function to check what location parts are already at the end
    const checkLocationAtEnd = (value) => {
      const trimmed = value.trim();
      if (!trimmed) return { hasNorzagaray: false, hasBulacan: false, hasFull: false };
      
      const lowerValue = trimmed.toLowerCase();
      // Remove trailing commas and spaces for checking
      const cleanedEnd = lowerValue.replace(/[,\s]+$/, '').trim();
      
      // Check if full "Norzagaray, Bulacan" is at the end (with variations)
      const hasFull = lowerValue.endsWith('norzagaray, bulacan') || 
                      lowerValue.endsWith('norzagaray,bulacan') ||
                      cleanedEnd.endsWith('norzagaray, bulacan') ||
                      cleanedEnd.endsWith('norzagaray,bulacan');
      
      // Check if "Norzagaray" is at the end (case-insensitive)
      const hasNorzagaray = cleanedEnd.endsWith('norzagaray');
      
      // Check if "Bulacan" is at the end (case-insensitive)
      const hasBulacan = cleanedEnd.endsWith('bulacan');
      
      return { hasNorzagaray, hasBulacan, hasFull };
    };
    
    // Function to append location suffix if not present
    const appendLocationSuffix = () => {
      const currentValue = addressTextarea.value.trim();
      
      // If empty, don't add anything
      if (currentValue === '') {
        return;
      }
      
      const locationCheck = checkLocationAtEnd(currentValue);
      
      // If full location is already there, don't add anything
      if (locationCheck.hasFull) {
        return;
      }
      
      // If only "Norzagaray" is at the end, add ", Bulacan"
      if (locationCheck.hasNorzagaray && !locationCheck.hasBulacan) {
        const separator = currentValue.endsWith(',') ? ' ' : ', ';
        addressTextarea.value = currentValue + separator + bulacan;
        return;
      }
      
      // If only "Bulacan" is at the end, add "Norzagaray, " before it
      if (locationCheck.hasBulacan && !locationCheck.hasNorzagaray) {
        // Find where "Bulacan" starts in the value
        const lowerValue = currentValue.toLowerCase();
        const bulacanIndex = lowerValue.lastIndexOf('bulacan');
        if (bulacanIndex > 0) {
          const beforeBulacan = currentValue.substring(0, bulacanIndex).trim();
          const separator = beforeBulacan.endsWith(',') ? ' ' : ', ';
          addressTextarea.value = beforeBulacan + separator + norzagaray + ', ' + currentValue.substring(bulacanIndex);
        } else {
          // Fallback: just prepend
          const separator = currentValue.endsWith(',') ? ' ' : ', ';
          addressTextarea.value = currentValue + separator + fullLocation;
        }
        return;
      }
      
      // If neither is at the end, add full "Norzagaray, Bulacan"
      if (!locationCheck.hasNorzagaray && !locationCheck.hasBulacan) {
        const separator = currentValue.endsWith(',') ? ' ' : ', ';
        addressTextarea.value = currentValue + separator + fullLocation;
      }
    };
    
    // Apply capitalization on blur (when user finishes typing and leaves the field)
    addressTextarea.addEventListener('blur', () => {
      applyCapitalization();
      appendLocationSuffix();
    });
    
    // Also apply capitalization and append on form submit
    form?.addEventListener('submit', (e) => {
      // Only process if field has value
      if (addressTextarea.value.trim() !== '') {
        applyCapitalization();
        appendLocationSuffix();
      }
    }, { capture: true }); // Use capture phase to run before form validation
  }

  // Password strength indicator
  const passInput = document.querySelector('input[name="pass"]');
  const passStrengthFill = document.getElementById('passStrengthFill');
  const passStrengthLabel = document.getElementById('passStrengthLabel');
  const passMissingRequirements = document.getElementById('passMissingRequirements');

  if (passInput && passStrengthFill && passStrengthLabel && passMissingRequirements) {
    passInput.addEventListener('input', function() {
      const password = this.value;
      updatePasswordStrength(password);
      updatePasswordRequirements(password);
    });
  }
});

// Password toggle function
function togglePassword(fieldName) {
  const input = document.querySelector(`input[name="${fieldName}"]`);
  const icon = input.closest('.password-wrapper').querySelector('.password-icon');
  
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
  const passStrengthFill = document.getElementById('passStrengthFill');
  const passStrengthLabel = document.getElementById('passStrengthLabel');
  const requirements = checkPasswordRequirements(password);
  const satisfiedCount = Object.values(requirements).filter(req => req).length;
  
  // Reset classes
  passStrengthFill.className = 'password-strength-fill';
  passStrengthLabel.className = 'password-strength-label';
  
  if (password.length === 0) {
    passStrengthFill.className = 'password-strength-fill too-short';
    passStrengthLabel.className = 'password-strength-label too-short';
    passStrengthLabel.textContent = 'Password strength:';
  } else if (password.length < 8) {
    passStrengthFill.className = 'password-strength-fill weak';
    passStrengthLabel.className = 'password-strength-label weak';
    passStrengthLabel.textContent = 'Password strength: Too short';
  } else if (satisfiedCount <= 2) {
    passStrengthFill.className = 'password-strength-fill weak';
    passStrengthLabel.className = 'password-strength-label weak';
    passStrengthLabel.textContent = 'Password strength: Weak';
  } else if (satisfiedCount <= 4) {
    passStrengthFill.className = 'password-strength-fill fair';
    passStrengthLabel.className = 'password-strength-label fair';
    passStrengthLabel.textContent = 'Password strength: Fair';
  } else if (satisfiedCount === 4) {
    passStrengthFill.className = 'password-strength-fill good';
    passStrengthLabel.className = 'password-strength-label good';
    passStrengthLabel.textContent = 'Password strength: Good';
  } else {
    passStrengthFill.className = 'password-strength-fill strong';
    passStrengthLabel.className = 'password-strength-label strong';
    passStrengthLabel.textContent = 'Password strength: Strong';
  }
}

// Password requirements checker - show only missing requirements
function updatePasswordRequirements(password) {
  const requirements = checkPasswordRequirements(password);
  const passMissingRequirements = document.getElementById('passMissingRequirements');
  
  // Define requirement labels
  const requirementLabels = {
    length: 'At least 8 characters',
    uppercase: 'One uppercase letter',
    lowercase: 'One lowercase letter',
    number: 'One number',
    special: 'One special character'
  };
  
  // Get missing requirements
  const missingRequirements = [];
  for (const [key, satisfied] of Object.entries(requirements)) {
    if (!satisfied) {
      missingRequirements.push({
        key: key,
        label: requirementLabels[key]
      });
    }
  }
  
  // Update the UI
  if (missingRequirements.length === 0) {
    passMissingRequirements.classList.add('empty');
    passMissingRequirements.innerHTML = '';
  } else {
    passMissingRequirements.classList.remove('empty');
    const missingText = missingRequirements.map(r => r.label.toLowerCase()).join(', ');
    passMissingRequirements.innerHTML = `<div class="missing-req-item">${missingText}</div>`;
  }
}

// Check individual password requirements
function checkPasswordRequirements(password) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };
}


