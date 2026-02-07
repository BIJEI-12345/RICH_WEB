function goBack() {
    window.location.href = 'admin-dashboard.html';
}

// Management Functions
function showAddResidentModal() {
    const modal = document.getElementById('addResidentModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    
    // Focus on first input
    document.getElementById('firstName').focus();
}

function closeAddResidentModal() {
    const modal = document.getElementById('addResidentModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    
    // Reset form
    document.getElementById('addResidentForm').reset();
    
    // Reset image upload
    resetImageUpload();
    
    // Reset modal to add mode
    resetModalToAddMode();
}

// Image upload functions
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size should be less than 5MB.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            showImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

function showImagePreview(imageSrc) {
    const uploadContainer = document.getElementById('uploadContainer');
    const uploadIcon = document.getElementById('uploadIcon');
    const uploadText = document.getElementById('uploadText');
    const uploadedImage = document.getElementById('uploadedImage');
    
    // Hide upload icon and text
    uploadIcon.style.display = 'none';
    uploadText.style.display = 'none';
    
    // Show uploaded image
    uploadedImage.src = imageSrc;
    uploadedImage.style.display = 'block';
    
    // Add has-image class for styling
    uploadContainer.classList.add('has-image');
}

function removeImage(event) {
    event.stopPropagation(); // Prevent triggering file input
    
    const uploadContainer = document.getElementById('uploadContainer');
    const uploadIcon = document.getElementById('uploadIcon');
    const uploadText = document.getElementById('uploadText');
    const uploadedImage = document.getElementById('uploadedImage');
    const fileInput = document.getElementById('idImageUpload');
    
    // Reset upload container
    uploadIcon.style.display = 'block';
    uploadText.style.display = 'block';
    uploadedImage.style.display = 'none';
    uploadContainer.classList.remove('has-image');
    
    // Clear file input
    fileInput.value = '';
}

function resetImageUpload() {
    const uploadContainer = document.getElementById('uploadContainer');
    const uploadIcon = document.getElementById('uploadIcon');
    const uploadText = document.getElementById('uploadText');
    const uploadedImage = document.getElementById('uploadedImage');
    const fileInput = document.getElementById('idImageUpload');
    
    // Reset to initial state
    uploadIcon.style.display = 'block';
    uploadText.style.display = 'block';
    uploadedImage.style.display = 'none';
    uploadContainer.classList.remove('has-image');
    fileInput.value = '';
}

function toggleSearchBar() {
    const searchContainer = document.getElementById('searchContainer');
    if (searchContainer.style.display === 'none') {
        searchContainer.style.display = 'flex';
    } else {
        searchContainer.style.display = 'none';
    }
}

function searchResidents() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.toLowerCase();
    const clearBtn = document.getElementById('clearSearchBtn');
    
    if (searchTerm === '') {
        displayResidents(residentsData);
        } else {
        const filteredResidents = residentsData.filter(resident => {
            const fullName = `${resident.first_name || ''} ${resident.middle_name || ''} ${resident.last_name || ''} ${resident.suffix || ''}`.toLowerCase();
            const email = (resident.email || '').toLowerCase();
            const address = (resident.address || '').toLowerCase();
            
            return fullName.includes(searchTerm) || 
                   email.includes(searchTerm) || 
                   address.includes(searchTerm);
        });
        
        displayResidents(filteredResidents);
    }
    
    // Show/hide clear button based on search input
    if (searchTerm.length > 0) {
        clearBtn.classList.add('show');
    } else {
        clearBtn.classList.remove('show');
    }
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    
    // Clear the search input
    searchInput.value = '';
    
    // Show all residents
    displayResidents(residentsData);
    
    // Hide the clear button
    clearBtn.classList.remove('show');
    
    // Focus back to search input
    searchInput.focus();
}

function printData() {
    console.log('Print button clicked'); // Debug log
    
    // Check if there are residents to print
    console.log('Found residents:', residentsData.length); // Debug log
    
    if (residentsData.length === 0) {
        showStatusModal('warning', 'No Data to Print', 'Please add some residents first before printing.');
        return;
    }
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
        showStatusModal('error', 'Print Blocked', 'Please allow popups for this site to enable printing functionality.');
        return;
    }
    
    console.log('Print window opened successfully'); // Debug log
    
    // Get current date and time
    const now = new Date();
    
    // Get table data
    const tableData = getResidentsTableData();
    console.log('Table data:', tableData); // Debug log
    
    // Create the complete HTML document
    const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Resident Information - Barangay Bigte</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: white;
                    color: black;
                    line-height: 1.4;
                    padding: 20px;
                }
                
                .print-header {
                    text-align: center;
                    margin-bottom: 2rem;
                    border-bottom: 2px solid #333;
                    padding-bottom: 1rem;
                }
                
                .print-header h1 {
                    font-size: 2rem;
                    color: #2c5aa0;
                    margin-bottom: 0.5rem;
                }
                
                .print-header p {
                    color: #666;
                    font-size: 1.1rem;
                }
                
                .print-date {
                    text-align: right;
                    margin-bottom: 1rem;
                    font-size: 0.9rem;
                    color: #666;
                }
                
                .residents-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 1rem;
                }
                
                .residents-table th {
                    background: #2c5aa0;
                    color: white;
                    padding: 0.75rem 0.5rem;
                    text-align: left;
                    font-weight: 600;
                    font-size: 0.85rem;
                    border: 1px solid #333;
                }
                
                .residents-table td {
                    padding: 0.5rem;
                    border: 1px solid #333;
                    font-size: 0.8rem;
                }
                
                .residents-table tbody tr:nth-child(even) {
                    background: #f5f5f5;
                }
                
                .print-footer {
                    margin-top: 2rem;
                    text-align: center;
                    font-size: 0.8rem;
                    color: #666;
                    border-top: 1px solid #333;
                    padding-top: 1rem;
                }
                
                @media print {
                    body { margin: 0; padding: 0; }
                    .print-header { page-break-after: avoid; }
                    .residents-table { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>Barangay Bigte</h1>
                <p>Resident Information Report</p>
            </div>
            
            <div class="print-date">
                Printed on: ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}
            </div>
            
            <table class="residents-table">
                <thead>
                    <tr>
                        <th>First Name</th>
                        <th>Middle Name</th>
                        <th>Last Name</th>
                        <th>Suffix</th>
                        <th>Email</th>
                        <th>Age</th>
                        <th>Sex</th>
                        <th>Birthday</th>
                        <th>Civil Status</th>
                        <th>Address</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableData}
                </tbody>
            </table>
            
            <div class="print-footer">
                <p>This report was generated from the Barangay Bigte Resident Information System</p>
            </div>
        </body>
        </html>
    `;
    
    // Write content to print window
    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    console.log('Content written to print window'); // Debug log
    
    // Wait for content to load, then print
    printWindow.onload = function() {
        console.log('Print window loaded, attempting to print'); // Debug log
        printWindow.focus();
        printWindow.print();
        // Don't close immediately, let user see the print preview
        setTimeout(() => {
            printWindow.close();
        }, 1000);
    };
}

function getResidentsTableData() {
    let tableData = '';
    
    residentsData.forEach(resident => {
            tableData += '<tr>';
        tableData += `<td>${resident.first_name || ''}</td>`;
        tableData += `<td>${resident.middle_name || ''}</td>`;
        tableData += `<td>${resident.last_name || ''}</td>`;
        tableData += `<td>${resident.suffix || ''}</td>`;
        tableData += `<td>${resident.email || ''}</td>`;
        tableData += `<td>${resident.age || ''}</td>`;
        tableData += `<td>${resident.sex || ''}</td>`;
        tableData += `<td>${formatDate(resident.birthday) || ''}</td>`;
        tableData += `<td>${resident.civil_status || ''}</td>`;
        tableData += `<td>${resident.address || ''}</td>`;
            tableData += '</tr>';
    });
    
    return tableData;
}

function viewResident(index) {
    if (index < 0 || index >= residentsData.length) {
        showStatusModal('error', 'Error', 'Resident not found.');
        return;
    }
    
    const resident = residentsData[index];
    
    // Create ID image popup
    showIdImagePopup(resident);
}

function showIdImagePopup(resident) {
    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.className = 'id-image-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
    `;
    
    // Create popup container
    const popup = document.createElement('div');
    popup.style.cssText = `
        background: white;
        border-radius: 10px;
        padding: 20px;
        max-width: 90%;
        max-height: 90%;
        position: relative;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    `;
    
    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 15px;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        z-index: 10001;
    `;
    
    // Create title
    const title = document.createElement('h3');
    title.textContent = `${resident.first_name} ${resident.last_name} - ID Image`;
    title.style.cssText = `
        margin: 0 0 15px 0;
        color: #2c5aa0;
        font-size: 18px;
        text-align: center;
    `;
    
    // Create image container
    const imageContainer = document.createElement('div');
    imageContainer.style.cssText = `
        text-align: center;
        max-width: 100%;
        max-height: 70vh;
        overflow: auto;
    `;
    
    if (resident.id_image && resident.id_image.trim() !== '') {
        // Show the ID image
        const img = document.createElement('img');
        img.src = resident.id_image;
        img.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            border-radius: 5px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        `;
        img.alt = 'ID Image';
        imageContainer.appendChild(img);
    } else {
        // Show no image message
        const noImageDiv = document.createElement('div');
        noImageDiv.style.cssText = `
            padding: 40px;
            color: #666;
            font-size: 16px;
            text-align: center;
            border: 2px dashed #ccc;
            border-radius: 5px;
        `;
        noImageDiv.innerHTML = `
            <i class="fas fa-image" style="font-size: 48px; color: #ccc; margin-bottom: 10px; display: block;"></i>
            No ID Image Available
        `;
        imageContainer.appendChild(noImageDiv);
    }
    
    // Assemble popup
    popup.appendChild(closeBtn);
    popup.appendChild(title);
    popup.appendChild(imageContainer);
    overlay.appendChild(popup);
    
    // Add to page
    document.body.appendChild(overlay);
    
    // Close functions
    function closePopup() {
        document.body.removeChild(overlay);
    }
    
    closeBtn.onclick = closePopup;
    overlay.onclick = function(e) {
        if (e.target === overlay) {
            closePopup();
        }
    };
    
    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closePopup();
        }
    });
}

function closeViewResidentModal() {
    const modal = document.getElementById('viewResidentModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

function editResidentFromView() {
    // Close the view modal
    closeViewResidentModal();
    
    // Get the current resident data from view modal
    const residentData = {
        firstName: document.getElementById('viewFirstName').textContent,
        middleName: document.getElementById('viewMiddleName').textContent,
        lastName: document.getElementById('viewLastName').textContent,
        age: document.getElementById('viewAge').textContent,
        sex: document.getElementById('viewSex').textContent,
        birthday: document.getElementById('viewBirthday').textContent,
        civilStatus: document.getElementById('viewCivilStatus').textContent,
        address: document.getElementById('viewAddress').textContent,
        contactNumber: document.getElementById('viewContactNumber').textContent,
        validId: document.getElementById('viewValidId').textContent
    };
    
    // Open edit modal with pre-populated data
    openEditResidentModal(residentData);
}

function editResident(id) {
    // Get the row data
    const row = document.querySelector(`button[onclick="editResident(${id})"]`).closest('tr');
    const cells = row.querySelectorAll('td');
    
    // Extract data from table row
    const residentData = {
        firstName: cells[0].textContent,
        middleName: cells[1].textContent,
        lastName: cells[2].textContent,
        age: cells[3].textContent,
        sex: cells[4].textContent,
        birthday: cells[5].textContent,
        civilStatus: cells[6].textContent,
        address: cells[7].textContent,
        contactNumber: cells[8].textContent,
        validId: cells[9].textContent
    };
    
    // Open edit modal with pre-populated data
    openEditResidentModal(residentData);
}

function openEditResidentModal(residentData) {
    // Convert MM/DD/YYYY to YYYY-MM-DD for date input
    const birthdayParts = residentData.birthday.split('/');
    const formattedBirthday = `${birthdayParts[2]}-${birthdayParts[0].padStart(2, '0')}-${birthdayParts[1].padStart(2, '0')}`;
    
    // Populate form fields
    document.getElementById('firstName').value = residentData.firstName;
    document.getElementById('middleName').value = residentData.middleName === 'N/A' ? '' : residentData.middleName;
    document.getElementById('lastName').value = residentData.lastName;
    document.getElementById('age').value = residentData.age;
    document.getElementById('sex').value = residentData.sex;
    document.getElementById('birthday').value = formattedBirthday;
    document.getElementById('civilStatus').value = residentData.civilStatus;
    document.getElementById('address').value = residentData.address;
    document.getElementById('contactNumber').value = residentData.contactNumber;
    document.getElementById('validId').value = residentData.validId;
    
    // Reset image upload (since we don't have image data in table)
    resetImageUpload();
    
    // Change modal title and button text for edit mode
    document.querySelector('.modal-title').textContent = 'Edit Resident Information';
    document.querySelector('.save-btn').innerHTML = '<i class="fas fa-save"></i> Update Resident';
    
    // Store current resident ID for update (you can add this as a data attribute)
    const modal = document.getElementById('addResidentModal');
    modal.setAttribute('data-edit-mode', 'true');
    modal.setAttribute('data-resident-id', residentData.firstName + '_' + residentData.lastName);
    
    // Show modal
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    
    // Focus on first input
    document.getElementById('firstName').focus();
}

function previousPage() {
    if (window.Swal) {
        Swal.fire({
            title: 'Pagination',
            text: 'Previous page - coming soon!',
            icon: 'info',
            confirmButtonText: 'OK',
            confirmButtonColor: '#2c5aa0'
        });
    } else {
        alert('Previous page - Coming soon!');
    }
}

function nextPage() {
    if (window.Swal) {
        Swal.fire({
            title: 'Pagination',
            text: 'Next page - coming soon!',
            icon: 'info',
            confirmButtonText: 'OK',
            confirmButtonColor: '#2c5aa0'
        });
    } else {
        alert('Next page - Coming soon!');
    }
}

// Global variable to store residents data
let residentsData = [];

// Initialize functionality
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    const addResidentForm = document.getElementById('addResidentForm');
    const addResidentModal = document.getElementById('addResidentModal');
    const viewResidentModal = document.getElementById('viewResidentModal');
    const statusModal = document.getElementById('statusModal');
    
    // Load residents data from database
    loadResidents();
    
    // Search functionality
    if (searchInput) {
        // Handle Enter key press
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchResidents();
            }
        });
        
        // Handle input changes to show/hide clear button and search in real-time
        searchInput.addEventListener('input', function() {
            if (searchInput.value.length > 0) {
                clearBtn.classList.add('show');
                // Search in real-time as user types
                searchResidents();
            } else {
                clearBtn.classList.remove('show');
                // If input is empty, show all residents
                displayResidents(residentsData);
            }
        });
    }
    
    // Add Resident Form submission
    if (addResidentForm) {
        addResidentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleAddResident();
        });
    }
    
    // Modal event listeners
    if (addResidentModal) {
        // Close modal when clicking outside
        addResidentModal.addEventListener('click', function(e) {
            if (e.target === addResidentModal) {
                closeAddResidentModal();
            }
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && addResidentModal.classList.contains('show')) {
                closeAddResidentModal();
            }
        });
    }
    
    // View modal event listeners
    if (viewResidentModal) {
        // Close modal when clicking outside
        viewResidentModal.addEventListener('click', function(e) {
            if (e.target === viewResidentModal) {
                closeViewResidentModal();
            }
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && viewResidentModal.classList.contains('show')) {
                closeViewResidentModal();
            }
        });
    }
    
    // Status modal event listeners
    if (statusModal) {
        // Close modal when clicking outside
        statusModal.addEventListener('click', function(e) {
            if (e.target === statusModal) {
                closeStatusModal();
            }
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && statusModal.classList.contains('show')) {
                closeStatusModal();
            }
        });
    }
});

// Handle Add Resident form submission
async function handleAddResident() {
    const form = document.getElementById('addResidentForm');
    const formData = new FormData(form);
    const modal = document.getElementById('addResidentModal');
    
    // Get form values
    const residentData = {
        first_name: formData.get('firstName'),
        middle_name: formData.get('middleName'),
        last_name: formData.get('lastName'),
        suffix: formData.get('suffix'),
        email: formData.get('email'),
        age: parseInt(formData.get('age')),
        sex: formData.get('sex'),
        birthday: formData.get('birthday'),
        civil_status: formData.get('civilStatus'),
        address: formData.get('address'),
        valid_id: formData.get('validId')
    };
    
    try {
        const response = await fetch('php/resident-info.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(residentData)
        });
        
        const data = await response.json();
        
        if (data.success) {
        // Close modal and show success message
        closeAddResidentModal();
            showStatusModal('success', 'Resident Added!', `Resident ${residentData.first_name} ${residentData.last_name} has been added successfully.`);
            
            // Reload residents data
            loadResidents();
    } else {
            showStatusModal('error', 'Error', data.error || 'Failed to add resident.');
        }
    } catch (error) {
        console.error('Error adding resident:', error);
        showStatusModal('error', 'Error', 'Failed to connect to server.');
    }
}

function resetModalToAddMode() {
    const modal = document.getElementById('addResidentModal');
    modal.removeAttribute('data-edit-mode');
    modal.removeAttribute('data-resident-id');
    
    // Reset modal title and button text
    document.querySelector('.modal-title').textContent = 'Add New Resident';
    document.querySelector('.save-btn').innerHTML = '<i class="fas fa-save"></i> Save Resident';
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

    // Set icon and styling based on type
    switch(type) {
        case 'success':
            icon.className = 'fas fa-check-circle status-icon';
            modal.classList.add('show', 'success');
            break;
        case 'error':
            icon.className = 'fas fa-exclamation-circle status-icon';
            modal.classList.add('show', 'error');
            break;
        case 'warning':
            icon.className = 'fas fa-exclamation-triangle status-icon';
            modal.classList.add('show', 'warning');
            break;
        default:
            icon.className = 'fas fa-info-circle status-icon';
            modal.classList.add('show');
    }

    // Hide cancel button for regular status messages
    cancelBtn.style.display = 'none';

    modal.setAttribute('aria-hidden', 'false');
}

function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

// Load residents from database
async function loadResidents() {
    try {
        const response = await fetch('php/resident-info.php', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            residentsData = data.residents;
            displayResidents(residentsData);
        } else {
            console.error('Error loading residents:', data.error);
            showStatusModal('error', 'Error', 'Failed to load residents data.');
        }
    } catch (error) {
        console.error('Error fetching residents:', error);
        showStatusModal('error', 'Error', 'Failed to connect to server.');
    }
}

// Display residents in the table
function displayResidents(residents) {
    const tbody = document.getElementById('residents-body');
    tbody.innerHTML = '';
    
    if (residents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 2rem;">No residents found</td></tr>';
        return;
    }
    
    residents.forEach((resident, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${resident.first_name || ''}</td>
            <td>${resident.middle_name || ''}</td>
            <td>${resident.last_name || ''}</td>
            <td>${resident.suffix || ''}</td>
            <td>${resident.email || ''}</td>
            <td>${resident.age || ''}</td>
            <td>${resident.sex || ''}</td>
            <td>${formatDate(resident.birthday) || ''}</td>
            <td>${resident.civil_status || ''}</td>
            <td>${resident.address || ''}</td>
            <td>
                <button class="action-icon-btn view-btn" onclick="viewResident(${index})" title="View ID Image">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Format date from YYYY-MM-DD to MM/DD/YYYY
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${month}/${day}/${year}`;
}

// Format date from MM/DD/YYYY to YYYY-MM-DD
function formatDateForInput(dateString) {
    if (!dateString) return '';
    const parts = dateString.split('/');
    if (parts.length !== 3) return dateString;
    
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    const year = parts[2];
    
    return `${year}-${month}-${day}`;
}
