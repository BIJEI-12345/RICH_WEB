// Document Request Management JavaScript

// Print Multiple Selection State
let printMultipleMode = false;
let selectedCards = new Set();

// Ready Multiple Selection State
let readyMultipleMode = false;
let selectedReadyCards = new Set();

// Navigation Functions
function goBack() {
    window.location.href = 'admin-dashboard.html';
}

// Search Function - Filter documents by name or type
function filterDocumentRequests(searchTerm) {
    const searchValue = searchTerm.toLowerCase().trim();
    const allCards = document.querySelectorAll('.request-card');
    
    if (!searchValue) {
        // If search is empty, show all cards
        allCards.forEach(card => {
            card.style.display = '';
        });
        return;
    }
    
    // Filter cards based on name or document type
    allCards.forEach(card => {
        const cardBody = card.querySelector('.card-body');
        if (!cardBody) {
            card.style.display = 'none';
            return;
        }
        
        // Get name from card (h5 element)
        const nameElement = cardBody.querySelector('h5');
        const name = nameElement ? nameElement.textContent.toLowerCase() : '';
        
        // Get document type from card's data attribute or category
        const documentType = card.dataset.documentType || '';
        const category = card.closest('.document-category')?.dataset.category || '';
        
        // Map category to readable document type
        const documentTypeMap = {
            'barangay-id': 'barangay id',
            'certification': 'certification',
            'coe': 'certificate of employment',
            'clearance': 'clearance',
            'indigency': 'indigency'
        };
        
        const readableType = documentTypeMap[category] || documentType.toLowerCase();
        
        // Check if search term matches name or document type
        const matchesName = name.includes(searchValue);
        const matchesType = readableType.includes(searchValue);
        
        // Show card if it matches, hide otherwise
        if (matchesName || matchesType) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

// Toggle Print Multiple Mode
function togglePrintMultipleMode() {
    // If we're in mode and have selections, print them
    if (printMultipleMode && selectedCards.size > 0) {
        printSelectedCards();
        return;
    }
    
    printMultipleMode = !printMultipleMode;
    const btn = document.getElementById('printMultipleBtn');
    const btnText = document.getElementById('printMultipleBtnText');
    
    if (printMultipleMode) {
        btn.classList.add('active');
        btnText.textContent = 'Print Selected';
        // Add checkboxes to all cards
        enableCardSelection();
    } else {
        btn.classList.remove('active');
        btnText.textContent = 'Print Multiple';
        // Remove checkboxes and selection
        disableCardSelection();
        selectedCards.clear();
    }
}

// Enable card selection mode
function enableCardSelection() {
    const allCards = document.querySelectorAll('.request-card');
    allCards.forEach(card => {
        // Skip if checkbox already exists
        if (card.querySelector('.card-checkbox')) return;
        
        // Ensure card has position relative
        card.style.position = 'relative';
        card.classList.add('selectable-card');
        
        // Add checkbox at the top-left of card
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'card-checkbox';
        
        const cardId = card.dataset.requestId || card.dataset.cardId || `${Date.now()}-${Math.random()}`;
        if (!card.dataset.cardId) {
            card.dataset.cardId = cardId;
        }
        checkbox.dataset.cardId = card.dataset.cardId;
        
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedCards.add(card.dataset.cardId);
                card.classList.add('selected');
            } else {
                selectedCards.delete(card.dataset.cardId);
                card.classList.remove('selected');
            }
            updatePrintMultipleButton();
        });
        
        card.addEventListener('click', (e) => {
            // Don't toggle if clicking checkbox or buttons
            if (e.target.closest('.card-checkbox') || e.target.closest('.btn-action')) {
                return;
            }
            if (printMultipleMode) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        });
        
        card.appendChild(checkbox);
    });
}

// Disable card selection mode
function disableCardSelection() {
    const allCards = document.querySelectorAll('.request-card');
    allCards.forEach(card => {
        const checkbox = card.querySelector('.card-checkbox');
        if (checkbox) {
            checkbox.remove();
        }
        card.classList.remove('selected', 'selectable-card');
    });
}

// Update Print Multiple button text
function updatePrintMultipleButton() {
    const btnText = document.getElementById('printMultipleBtnText');
    const count = selectedCards.size;
    if (count > 0) {
        btnText.textContent = `Print Selected (${count})`;
    } else {
        btnText.textContent = 'Print Selected';
    }
}

// Print Selected Cards
async function printSelectedCards() {
    if (selectedCards.size === 0) {
        showStatusModal('error', 'No Selection', 'Please select at least one card to print.');
        return;
    }
    
    const cards = document.querySelectorAll('.request-card.selected');
    const requestsToPrint = [];
    
    cards.forEach(card => {
        const requestId = card.dataset.requestId || card.getAttribute('data-id') || card.dataset.cardId;
        const documentType = card.dataset.documentType || card.getAttribute('data-type') || 'barangay-id';
        if (requestId) {
            requestsToPrint.push({ id: requestId, type: documentType, card: card });
        }
    });
    
    if (requestsToPrint.length === 0) {
        showStatusModal('error', 'Error', 'No valid requests found to print.');
        return;
    }
    
    // Show confirmation dialog
    const confirmResult = await Swal.fire({
        icon: 'question',
        title: 'Confirm Print',
        html: `Are you sure you want to print <strong>${requestsToPrint.length}</strong> selected document(s)?`,
        showCancelButton: true,
        confirmButtonText: 'Confirm',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#87CEEB',
        cancelButtonColor: '#6c757d',
        width: '450px',
        padding: '1.5rem',
        allowOutsideClick: false,
        allowEscapeKey: true,
        customClass: {
            popup: 'swal2-small-popup swal2-confirm-dialog',
            title: 'swal2-small-title',
            content: 'swal2-small-content'
        }
    });
    
    // If user cancelled, don't proceed (selections remain)
    if (!confirmResult.isConfirmed) {
        return;
    }
    
    // Show loading
    showStatusModal('info', 'Printing', `Printing ${requestsToPrint.length} document(s)...`);
    
    // Print each document sequentially
    for (let i = 0; i < requestsToPrint.length; i++) {
        const request = requestsToPrint[i];
        try {
            await printRequestById(request.id, request.type);
            // Small delay between prints
            if (i < requestsToPrint.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            console.error(`Error printing request ${request.id}:`, error);
        }
    }
    
    // Clear selection and exit mode
    selectedCards.clear();
    togglePrintMultipleMode();
    showStatusModal('success', 'Print Complete', `Successfully printed ${requestsToPrint.length} document(s).`, null, true, 2000);
}

// Toggle Ready Multiple Mode
function toggleReadyMultipleMode() {
    // If we're in mode and have selections, mark them as ready
    if (readyMultipleMode && selectedReadyCards.size > 0) {
        markSelectedAsReady();
        return;
    }
    
    readyMultipleMode = !readyMultipleMode;
    const btn = document.getElementById('readyMultipleBtn');
    const btnText = document.getElementById('readyMultipleBtnText');
    
    if (readyMultipleMode) {
        btn.classList.add('active');
        btnText.textContent = 'Ready to Receive';
        // Add checkboxes to all cards in checked tab
        enableReadyCardSelection();
    } else {
        btn.classList.remove('active');
        btnText.textContent = 'Select Multiple';
        // Remove checkboxes and selection
        disableReadyCardSelection();
        selectedReadyCards.clear();
    }
}

// Select All Ready Cards
function selectAllReadyCards() {
    const allCards = document.querySelectorAll('#checked-tab .request-card');
    let selectedCount = 0;
    
    allCards.forEach(card => {
        // Skip hidden cards (from search filter)
        if (card.style.display === 'none') return;
        
        const checkbox = card.querySelector('.ready-card-checkbox');
        if (checkbox && !checkbox.checked) {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
            selectedCount++;
        }
    });
    
    if (selectedCount > 0) {
        showStatusModal('info', 'Selected', `Selected ${selectedCount} card(s).`, null, true, 1500);
    } else {
        showStatusModal('info', 'Already Selected', 'All visible cards are already selected.', null, true, 1500);
    }
}

// Enable ready card selection mode (only for checked tab cards)
function enableReadyCardSelection() {
    const allCards = document.querySelectorAll('#checked-tab .request-card');
    allCards.forEach(card => {
        // Skip if checkbox already exists
        if (card.querySelector('.ready-card-checkbox')) return;
        
        // Ensure card has position relative
        card.style.position = 'relative';
        card.classList.add('selectable-card');
        
        // Add checkbox at the top-left of card
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'ready-card-checkbox';
        
        const cardId = card.dataset.requestId || card.dataset.cardId || `${Date.now()}-${Math.random()}`;
        if (!card.dataset.cardId) {
            card.dataset.cardId = cardId;
        }
        checkbox.dataset.cardId = card.dataset.cardId;
        
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedReadyCards.add(card.dataset.cardId);
                card.classList.add('selected');
            } else {
                selectedReadyCards.delete(card.dataset.cardId);
                card.classList.remove('selected');
            }
            updateReadyMultipleButton();
        });
        
        card.addEventListener('click', (e) => {
            // Don't toggle if clicking checkbox or buttons
            if (e.target.closest('.ready-card-checkbox') || e.target.closest('.btn-action')) {
                return;
            }
            if (readyMultipleMode) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        });
        
        card.appendChild(checkbox);
    });
}

// Disable ready card selection mode
function disableReadyCardSelection() {
    const allCards = document.querySelectorAll('.request-card');
    allCards.forEach(card => {
        const checkbox = card.querySelector('.ready-card-checkbox');
        if (checkbox) {
            checkbox.remove();
        }
        card.classList.remove('selected', 'selectable-card');
    });
}

// Update Ready Multiple button text (like print multiple)
function updateReadyMultipleButton() {
    const btnText = document.getElementById('readyMultipleBtnText');
    const count = selectedReadyCards.size;
    
    if (readyMultipleMode) {
        if (count > 0) {
            btnText.textContent = `Ready to Receive (${count})`;
        } else {
            btnText.textContent = 'Ready to Receive';
        }
    } else {
        btnText.textContent = 'Select Multiple';
    }
}

// Mark Selected Cards as Ready to Receive
async function markSelectedAsReady() {
    if (selectedReadyCards.size === 0) {
        showStatusModal('error', 'No Selection', 'Please select at least one card to mark as ready.');
        return;
    }
    
    const cards = document.querySelectorAll('#checked-tab .request-card.selected');
    const requestsToMark = [];
    
    cards.forEach(card => {
        const requestId = card.dataset.requestId || card.getAttribute('data-id') || card.dataset.cardId;
        const documentType = card.dataset.documentType || card.getAttribute('data-type') || 'barangay-id';
        if (requestId) {
            requestsToMark.push({ id: requestId, type: documentType, card: card });
        }
    });
    
    if (requestsToMark.length === 0) {
        showStatusModal('error', 'Error', 'No valid requests found to mark as ready.');
        return;
    }
    
    // Show confirmation dialog
    const confirmResult = await Swal.fire({
        icon: 'question',
        title: 'Confirm Ready to Receive',
        html: `Are you sure you want to mark <strong>${requestsToMark.length}</strong> selected request(s) as Ready to Receive?<br><br>This action cannot be undone.`,
        showCancelButton: true,
        confirmButtonText: 'Confirm',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#87CEEB',
        cancelButtonColor: '#6c757d',
        width: '450px',
        padding: '1.5rem',
        allowOutsideClick: false,
        allowEscapeKey: true,
        customClass: {
            popup: 'swal2-small-popup swal2-confirm-dialog',
            title: 'swal2-small-title',
            content: 'swal2-small-content'
        }
    });
    
    // If user cancelled, don't proceed
    if (!confirmResult.isConfirmed) {
        return;
    }
    
    // Show loading
    showStatusModal('info', 'Marking as Ready', `Marking ${requestsToMark.length} request(s) as Ready to Receive...`);
    
    // Mark each request sequentially
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < requestsToMark.length; i++) {
        const request = requestsToMark[i];
        try {
            // Determine table name from request type
            const docType = request.type.toLowerCase().replace(/\s+/g, '-');
            const tableMap = {
                'barangay-id': 'barangay_id',
                'barangay_id': 'barangay_id',
                'certification': 'certification',
                'coe': 'coe',
                'certificate-of-employment': 'coe',
                'certificate_of_employment': 'coe',
                'clearance': 'clearance',
                'indigency': 'indigency'
            };
            const tableName = tableMap[docType] || 'barangay_id';
            
            await updateRequestStatus(request.id, 'Finished', tableName);
            successCount++;
            
            // Small delay between updates
            if (i < requestsToMark.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        } catch (error) {
            console.error(`Error marking request ${request.id} as ready:`, error);
            failCount++;
        }
    }
    
    // Clear selection and exit mode
    selectedReadyCards.clear();
    toggleReadyMultipleMode();
    
    // Reload processing requests
    loadProcessingRequests();
    
    // Show result
    if (failCount === 0) {
        showStatusModal('success', 'Ready to Receive', `Successfully marked ${successCount} request(s) as Ready to Receive.`, null, true, 2000);
    } else {
        showStatusModal('warning', 'Partial Success', `Marked ${successCount} request(s) as ready. ${failCount} request(s) failed.`, null, true, 3000);
    }
}

// Helper function to print request by ID (direct download without modal)
async function printRequestById(requestId, documentType) {
    const docType = (documentType || 'barangay-id').toLowerCase().replace(/\s+/g, '-');
    
    try {
        switch(docType) {
            case 'barangay-id':
            case 'barangay_id':
                await downloadBarangayIdDirectly(requestId);
                break;
            case 'certification':
                await downloadCertificationDirectly(requestId);
                break;
            case 'coe':
            case 'certificate-of-employment':
            case 'certificate_of_employment':
                await downloadCoeDirectly(requestId);
                break;
            case 'clearance':
                await downloadClearanceDirectly(requestId);
                break;
            case 'indigency':
                await downloadIndigencyDirectly(requestId);
                break;
            default:
                console.warn('Unknown document type:', docType, 'for request:', requestId);
                await downloadBarangayIdDirectly(requestId);
        }
    } catch (error) {
        console.error(`Error printing request ${requestId} (${docType}):`, error);
        throw error;
    }
}

// Direct download functions (no modals, for bulk printing)
async function downloadBarangayIdDirectly(requestId) {
    // Fetch saved BID first
    const requestData = await fetchBarangayIdRequestData(requestId);
    if (!requestData) {
        throw new Error('Request data not found');
    }
    
    if (!requestData.bid || !requestData.bid.match(/^\d{4}-\d+$/)) {
        throw new Error('BID not set for request ID ' + requestId + '. Please set BID first.');
    }
    
    // Generate and download directly
    const response = await fetch('php/generateBarangayIdDocument.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `requestId=${requestId}&bid=${encodeURIComponent(requestData.bid)}`
    });
    
    const responseText = await response.text();
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = JSON.parse(responseText);
    if (data.success && data.downloadUrl) {
        // Direct download without modal
        const downloadLink = document.createElement('a');
        downloadLink.href = data.downloadUrl;
        downloadLink.download = data.filename;
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        // Small delay to allow download to start
        await new Promise(resolve => setTimeout(resolve, 300));
    } else {
        throw new Error(data.message || data.error || 'Failed to generate document');
    }
}

async function downloadCertificationDirectly(requestId) {
    const response = await fetch('php/generateCertificationDocument.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certification_id: requestId, trial_court: '', update_status: false })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const primaryUrl = data.download_url || data.downloadUrl;
    const secondaryUrl = data.download_url_2 || data.downloadUrl2;

    if (data.success && primaryUrl) {
        // Download main certification document
        const primaryFilename = data.filename || (primaryUrl.split('/').pop() || 'certification.docx');
        triggerFileDownload(primaryUrl, primaryFilename);

        // If a second document (e.g., JOBSEEKER_OATH) is provided, download it next
        if (secondaryUrl) {
            const secondaryFilename = data.filename_2 || data.filename2 || (secondaryUrl.split('/').pop() || 'document.docx');
            await new Promise(resolve => setTimeout(resolve, 300));
            triggerFileDownload(secondaryUrl, secondaryFilename);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
    } else {
        throw new Error(data.message || 'Failed to generate certification');
    }
}

async function downloadCoeDirectly(requestId) {
    const formData = new FormData();
    formData.append('requestId', requestId);
    
    const response = await fetch('php/generateCoeDocument.php', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.success && data.downloadUrl) {
        const downloadLink = document.createElement('a');
        downloadLink.href = data.downloadUrl;
        downloadLink.download = data.filename || 'coe.docx';
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        await new Promise(resolve => setTimeout(resolve, 300));
    } else {
        throw new Error(data.message || 'Failed to generate COE');
    }
}

async function downloadClearanceDirectly(requestId) {
    const response = await fetch('php/generateClearanceDocument.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearance_id: requestId, update_status: false })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.success && data.download_url) {
        const downloadLink = document.createElement('a');
        downloadLink.href = data.download_url;
        downloadLink.download = data.filename || 'clearance.docx';
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        await new Promise(resolve => setTimeout(resolve, 300));
    } else {
        throw new Error(data.message || 'Failed to generate clearance');
    }
}

/** Para sa generate/download: `document_language` sa DB o fallback english. */
function normalizeIndigencyLanguage(raw) {
    const s = String(raw || '').toLowerCase().trim();
    return s === 'tagalog' ? 'tagalog' : 'english';
}

async function downloadIndigencyDirectly(requestId) {
    const row = await fetchIndigencyRequestData(requestId);
    const language = normalizeIndigencyLanguage(row && row.document_language);
    const formData = new FormData();
    formData.append('requestId', requestId);
    formData.append('language', language);

    const response = await fetch('php/generateIndigencyDocument.php', {
        method: 'POST',
        body: formData
    });
    
    const data = await parseJsonFromResponse(response);
    if (data.success && data.downloadUrl) {
        const downloadLink = document.createElement('a');
        downloadLink.href = resolveDownloadUrl(data.downloadUrl);
        downloadLink.download = data.filename || 'indigency.docx';
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        await new Promise(resolve => setTimeout(resolve, 300));
    } else {
        throw new Error(data.message || 'Failed to generate indigency');
    }
}

// Tab Navigation Function
function switchRequestTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    // Remove active class from all tabs and panels
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
    
    // Add active class to selected tab and panel
    const selectedTab = document.querySelector(`[data-tab="${tabName}"]`);
    const selectedPanel = document.getElementById(`${tabName}-tab`);
    
    if (selectedTab) selectedTab.classList.add('active');
    if (selectedPanel) selectedPanel.classList.add('active');
    
    // Sync global sort dropdown with current sort order
    const globalSortDropdown = document.getElementById('globalSortDropdown');
    if (globalSortDropdown) {
        globalSortDropdown.value = globalSortOrder;
    }
    
    // Hide/show processing stats based on active tab
    document.querySelectorAll('.processing-stat').forEach(stat => {
        if (tabName === 'new') {
            stat.style.display = 'none'; // Hide processing count in NEW tab
        } else if (tabName === 'checked') {
            stat.style.display = 'inline-block'; // Show processing count in CHECKED tab
        }
    });
    
    // Show/hide Print Multiple button based on active tab
    const printMultipleBtn = document.getElementById('printMultipleBtn');
    if (printMultipleBtn) {
        if (tabName === 'released') {
            printMultipleBtn.style.display = 'inline-block';
        } else {
            printMultipleBtn.style.display = 'none';
            // Exit print multiple mode if switching to a tab that doesn't support it
            if (printMultipleMode) {
                togglePrintMultipleMode();
            }
        }
    }
    
    // Show/hide Ready Multiple button based on active tab
    const readyMultipleBtn = document.getElementById('readyMultipleBtn');
    if (readyMultipleBtn) {
        if (tabName === 'checked') {
            readyMultipleBtn.style.display = 'inline-block';
        } else {
            readyMultipleBtn.style.display = 'none';
            // Exit ready multiple mode if switching to a tab that doesn't support it
            if (readyMultipleMode) {
                toggleReadyMultipleMode();
            }
        }
    }
    
    // If switching to checked tab, load processing requests
    if (tabName === 'checked') {
        loadProcessingRequests();
        updateSidebarCountsForChecked();
    } else if (tabName === 'new') {
        // Reload new requests if needed
        loadAllRequests();
        updateSidebarCountsForNew();
    } else if (tabName === 'released') {
        // Load finished requests
        loadReleasedRequests();
        updateSidebarCountsForReleased();
    }
}

// Update sidebar counts to show only NEW requests
function updateSidebarCountsForNew() {
    // Get counts from NEW stats
    const barangayIdNew = parseInt(document.getElementById('barangayId-new')?.textContent || '0');
    const certificationNew = parseInt(document.getElementById('certification-new')?.textContent || '0');
    const coeNew = parseInt(document.getElementById('coe-new')?.textContent || '0');
    const clearanceNew = parseInt(document.getElementById('clearance-new')?.textContent || '0');
    const indigencyNew = parseInt(document.getElementById('indigency-new')?.textContent || '0');
    
    // Update sidebar nav counts
    document.getElementById('barangay-id-count').textContent = barangayIdNew;
    document.getElementById('certification-count').textContent = certificationNew;
    document.getElementById('coe-count').textContent = coeNew;
    document.getElementById('clearance-count').textContent = clearanceNew;
    document.getElementById('indigency-count').textContent = indigencyNew;
    
    // Update total
    const total = barangayIdNew + certificationNew + coeNew + clearanceNew + indigencyNew;
    document.getElementById('total-requests').textContent = total;
}

// Update sidebar counts to show only PROCESSING requests
function updateSidebarCountsForChecked() {
    // Get counts from processing stats
    const barangayIdProcessing = parseInt(document.getElementById('checked-barangayId-processing')?.textContent || '0');
    const certificationProcessing = parseInt(document.getElementById('checked-certification-processing')?.textContent || '0');
    const coeProcessing = parseInt(document.getElementById('checked-coe-processing')?.textContent || '0');
    const clearanceProcessing = parseInt(document.getElementById('checked-clearance-processing')?.textContent || '0');
    const indigencyProcessing = parseInt(document.getElementById('checked-indigency-processing')?.textContent || '0');
    
    // Update sidebar nav counts
    document.getElementById('barangay-id-count').textContent = barangayIdProcessing;
    document.getElementById('certification-count').textContent = certificationProcessing;
    document.getElementById('coe-count').textContent = coeProcessing;
    document.getElementById('clearance-count').textContent = clearanceProcessing;
    document.getElementById('indigency-count').textContent = indigencyProcessing;
    
    // Update total
    const total = barangayIdProcessing + certificationProcessing + coeProcessing + clearanceProcessing + indigencyProcessing;
    document.getElementById('total-requests').textContent = total;
}

// Update sidebar counts to show only FINISHED requests
function updateSidebarCountsForReleased() {
    // Get counts from finished stats
    const barangayIdFinished = parseInt(document.getElementById('released-barangayId-finished')?.textContent || '0');
    const certificationFinished = parseInt(document.getElementById('released-certification-finished')?.textContent || '0');
    const coeFinished = parseInt(document.getElementById('released-coe-finished')?.textContent || '0');
    const clearanceFinished = parseInt(document.getElementById('released-clearance-finished')?.textContent || '0');
    const indigencyFinished = parseInt(document.getElementById('released-indigency-finished')?.textContent || '0');
    
    // Update sidebar nav counts
    document.getElementById('barangay-id-count').textContent = barangayIdFinished;
    document.getElementById('certification-count').textContent = certificationFinished;
    document.getElementById('coe-count').textContent = coeFinished;
    document.getElementById('clearance-count').textContent = clearanceFinished;
    document.getElementById('indigency-count').textContent = indigencyFinished;
    
    // Update total
    const total = barangayIdFinished + certificationFinished + coeFinished + clearanceFinished + indigencyFinished;
    document.getElementById('total-requests').textContent = total;
}

// New/Finish View Functions (keeping for compatibility)
function showNewRequests() {
    switchRequestTab('new');
}

function showFinishedRequests() {
    switchRequestTab('checked');
}

function showReleasedRequests() {
    switchRequestTab('released');
}

// Function to load all requests - will be called when switching to 'new' tab
function loadAllRequests() {
    // Reload all document requests which will use the current global sort order
    loadAllDocumentRequests();
}

function showFinishedRequests() {
    switchRequestTab('checked');
}

// Function to load and display Finished requests
async function loadReleasedRequests() {
    try {
        console.log('Loading finished requests...');
        
        // Fetch all document types and filter for Finished status
        const allRequests = await Promise.all([
            fetchDocumentRequests('barangay_id'),
            fetchDocumentRequests('certification'),
            fetchDocumentRequests('coe'),
            fetchDocumentRequests('clearance'),
            fetchDocumentRequests('indigency')
        ]);
        
        const [barangayIdData, certificationData, coeData, clearanceData, indigencyData] = allRequests;
        
        // Filter for Finished status for each type
        const barangayIdFinished = barangayIdData.filter(r => r.status === 'Finished');
        const certificationFinished = certificationData.filter(r => r.status === 'Finished');
        const coeFinished = coeData.filter(r => r.status === 'Finished');
        const clearanceFinished = clearanceData.filter(r => r.status === 'Finished');
        const indigencyFinished = indigencyData.filter(r => r.status === 'Finished');
        
        console.log('Finished counts:', {
            barangayId: barangayIdFinished.length,
            certification: certificationFinished.length,
            coe: coeFinished.length,
            clearance: clearanceFinished.length,
            indigency: indigencyFinished.length
        });
        
        // Add document type to each request for proper modal handling
        barangayIdFinished.forEach(r => { r.type = 'barangay_id'; });
        certificationFinished.forEach(r => { r.type = 'certification'; });
        coeFinished.forEach(r => { r.type = 'coe'; });
        clearanceFinished.forEach(r => { r.type = 'clearance'; });
        indigencyFinished.forEach(r => { r.type = 'indigency'; });
        
        // Store in cache for sorting
        releasedRequestsCache.barangay_id = barangayIdFinished;
        releasedRequestsCache.certification = certificationFinished;
        releasedRequestsCache.coe = coeFinished;
        releasedRequestsCache.clearance = clearanceFinished;
        releasedRequestsCache.indigency = indigencyFinished;
        
        // Render finished requests in their respective category containers using global sort order
        renderReleasedCards(barangayIdFinished, 'released-barangayId-finished-cards', 'released-barangayId-finished');
        renderReleasedCards(certificationFinished, 'released-certification-finished-cards', 'released-certification-finished');
        renderReleasedCards(coeFinished, 'released-coe-finished-cards', 'released-coe-finished');
        renderReleasedCards(clearanceFinished, 'released-clearance-finished-cards', 'released-clearance-finished');
        renderReleasedCards(indigencyFinished, 'released-indigency-finished-cards', 'released-indigency-finished');
        
        console.log('All finished request cards rendered');
        
        // Update sidebar counts to show Finished counts
        updateSidebarCountsForReleased();
        
    } catch (error) {
        console.error('Error loading finished requests:', error);
    }
}

// Global sort order - applies to all tabs
let globalSortOrder = 'latest';

// Store finished requests for sorting
let releasedRequestsCache = {
    barangay_id: [],
    certification: [],
    coe: [],
    clearance: [],
    indigency: []
};

// Store new and checked requests for sorting
let newRequestsCache = {
    barangay_id: [],
    certification: [],
    coe: [],
    clearance: [],
    indigency: []
};

let checkedRequestsCache = {
    barangay_id: [],
    certification: [],
    coe: [],
    clearance: [],
    indigency: []
};

// Helper function to render finished cards
function renderReleasedCards(requests, containerId, countId, sortOrder = null) {
    // Use global sort order if not specified
    if (sortOrder === null) {
        sortOrder = globalSortOrder;
    }
    const container = document.getElementById(containerId);
    const countElement = document.getElementById(countId);
    
    if (!container) {
        console.error(`Container not found: ${containerId}`);
        return;
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Update count
    if (countElement) {
        countElement.textContent = requests.length;
    }
    
    // Show message if no requests
    if (requests.length === 0) {
        container.innerHTML = '<div class="no-data-message">No finished requests</div>';
        return;
    }
    
    // Sort based on sortOrder
    const sorted = [...requests].sort((a, b) => {
        const timeA = getSortTimestamp(a);
        const timeB = getSortTimestamp(b);
        // Sort descending (latest first) or ascending (oldest first)
        return sortOrder === 'latest' ? timeB - timeA : timeA - timeB;
    });

    // Render each request
    sorted.forEach(request => {
        const card = createReleasedCard(request);
        container.appendChild(card);
    });
}

// Helper function to create a card for finished requests
function createReleasedCard(request) {
    const card = document.createElement('div');
    card.className = 'request-card';
    
    // Add data attributes for print multiple
    card.dataset.requestId = request.id || request.requestId || request.request_id;
    card.dataset.documentType = request.type || request.documentType || 'barangay-id';
    
    const fullName = [request.givenname || request.given_name || request.firstname || request.first_name, 
                      request.middlename || request.middle_name, 
                      request.surname || request.lastname || request.last_name].filter(Boolean).join(' ') || 'Unknown';
    const submitted = formatDisplayDate(request.submittedAt || request.submitted_at);
    const finishedAt = request.finishAt || request.finish_at || request.processedAt || request.processed_at || request.finishedAt || request.finished_at;
    const releasedDisplay = finishedAt ? formatDisplayDate(finishedAt) + ' at ' + formatTime(finishedAt) : '';
    const purpose = request.purpose || '';
    const submittedTime = formatTime(request.submittedAt || request.submitted_at);
    
    card.innerHTML = `
        <div class="card-header">
            <span class="request-date">${submitted} • ${submittedTime}</span>
        </div>
        <div class="card-body">
            <h5>${escapeHtml(fullName || 'No Name')}</h5>
            <p>${escapeHtml(request.address || 'No Address')}</p>
            ${purpose ? `<div class="card-purpose">${escapeHtml(purpose)}</div>` : ''}
            <div class="card-meta">
                <span class="done-time">Finished at: ${releasedDisplay || 'Completed'}</span>
            </div>
        </div>
        <div class="card-actions">
            <button class="btn-action view-btn"><i class="fas fa-eye"></i> View</button>
            <button class="btn-action print-btn"><i class="fas fa-print"></i> Print</button>
        </div>
    `;
    
    // Attach view handler - Show process form preview (like Process button) in view-only mode
    const viewBtn = card.querySelector('.view-btn');
    if (viewBtn) {
        viewBtn.addEventListener('click', () => {
            // Determine the handler based on document type - use process form preview (view-only for finished)
            if (request.documentType === 'BARANGAY_ID' || request.type === 'barangay_id' || request.type === 'barangay-id') {
                // Use view-only version for finished requests
                populateAndShowBarangayIdProcessFormViewOnly(request);
            } else if (request.documentType === 'CERTIFICATION' || request.type === 'certification') {
                populateAndShowCertificationProcessForm(request, true); // view-only
            } else if (request.documentType === 'COE' || request.type === 'coe') {
                populateAndShowCoeProcessForm(request, true); // view-only
            } else if (request.documentType === 'CLEARANCE' || request.type === 'clearance') {
                populateAndShowClearanceProcessForm(request, true); // view-only
            } else if (request.documentType === 'INDIGENCY' || request.type === 'indigency') {
                populateAndShowIndigencyProcessForm(request, true); // view-only
            }
        });
    }
    
    // Attach print handler
    const printBtn = card.querySelector('.print-btn');
    if (printBtn) {
        // Enable the button
        printBtn.disabled = false;
        
        // Always make print button visible for all users in Finished tab
        printBtn.classList.add('admin-visible');
        // Remove any inline styles that might hide the button
        printBtn.style.removeProperty('visibility');
        printBtn.style.removeProperty('pointer-events');
        // Explicitly set visible styles with !important
        printBtn.style.setProperty('visibility', 'visible', 'important');
        printBtn.style.setProperty('display', 'inline-flex', 'important');
        printBtn.style.setProperty('pointer-events', 'auto', 'important');
        
        printBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent card click event
            
            const requestId = request.id || request.requestId || request.request_id;
            const documentType = request.type || request.documentType || 'barangay-id';
            
            if (!requestId) {
                console.error('No ID found for request:', request);
                showStatusModal('error', 'Print Failed', 'No valid request ID found. Please refresh the page and try again.');
                return;
            }
            
            // Disable button during print
            printBtn.disabled = true;
            const originalText = printBtn.innerHTML;
            printBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Printing...';
            
            try {
                // Use the printRequestById function to handle printing
                await printRequestById(requestId, documentType);
                // Show success message with auto-close (no OK button)
                showStatusModal('success', 'Ready to Print', 'Document is being downloaded for printing.', null, true, 2000);
            } catch (error) {
                console.error('Error printing request:', error);
                showStatusModal('error', 'Print Failed', 'Failed to print document: ' + error.message);
            } finally {
                // Re-enable button
                printBtn.disabled = false;
                printBtn.innerHTML = originalText;
            }
        });
    }
    
    return card;
}

// Function to load and display Processing requests in category-based containers
async function loadProcessingRequests() {
    try {
        console.log('Loading processing requests...');
        
        // Fetch all document types and filter for Processing status
        const allRequests = await Promise.all([
            fetchDocumentRequests('barangay_id'),
            fetchDocumentRequests('certification'),
            fetchDocumentRequests('coe'),
            fetchDocumentRequests('clearance'),
            fetchDocumentRequests('indigency')
        ]);
        
        const [barangayIdData, certificationData, coeData, clearanceData, indigencyData] = allRequests;
        
        // Filter for Processing status for each type
        const barangayIdProcessing = barangayIdData.filter(r => r.status === 'Processing');
        const certificationProcessing = certificationData.filter(r => r.status === 'Processing');
        const coeProcessing = coeData.filter(r => r.status === 'Processing');
        const clearanceProcessing = clearanceData.filter(r => r.status === 'Processing');
        const indigencyProcessing = indigencyData.filter(r => r.status === 'Processing');
        
        console.log('Processing counts:', {
            barangayId: barangayIdProcessing.length,
            certification: certificationProcessing.length,
            coe: coeProcessing.length,
            clearance: clearanceProcessing.length,
            indigency: indigencyProcessing.length
        });
        
        // Render processing requests in their respective category containers
        // Add document type to each request for proper modal handling
        barangayIdProcessing.forEach(r => { r.type = 'barangay_id'; });
        certificationProcessing.forEach(r => { r.type = 'certification'; });
        coeProcessing.forEach(r => { r.type = 'coe'; });
        clearanceProcessing.forEach(r => { r.type = 'clearance'; });
        indigencyProcessing.forEach(r => { r.type = 'indigency'; });
        
        if (barangayIdProcessing.length > 0) {
            renderProcessingCards(barangayIdProcessing, 'checked-barangayId-processing-cards', 'checked-barangayId-processing');
        } else {
            document.getElementById('checked-barangayId-processing-cards').innerHTML = '<div class="no-data-message">No processing requests</div>';
        }
        
        if (certificationProcessing.length > 0) {
            renderProcessingCards(certificationProcessing, 'checked-certification-processing-cards', 'checked-certification-processing');
        } else {
            document.getElementById('checked-certification-processing-cards').innerHTML = '<div class="no-data-message">No processing requests</div>';
        }
        
        if (coeProcessing.length > 0) {
            renderProcessingCards(coeProcessing, 'checked-coe-processing-cards', 'checked-coe-processing');
            } else {
            document.getElementById('checked-coe-processing-cards').innerHTML = '<div class="no-data-message">No processing requests</div>';
        }
        
        if (clearanceProcessing.length > 0) {
            renderProcessingCards(clearanceProcessing, 'checked-clearance-processing-cards', 'checked-clearance-processing');
        } else {
            document.getElementById('checked-clearance-processing-cards').innerHTML = '<div class="no-data-message">No processing requests</div>';
        }
        
        if (indigencyProcessing.length > 0) {
            renderProcessingCards(indigencyProcessing, 'checked-indigency-processing-cards', 'checked-indigency-processing');
        } else {
            document.getElementById('checked-indigency-processing-cards').innerHTML = '<div class="no-data-message">No processing requests</div>';
        }
        
        console.log('All processing request cards rendered');
        
        // Update sidebar counts to show Processing counts
        updateSidebarCountsForChecked();
        
    } catch (error) {
        console.error('Error loading processing requests:', error);
    }
}

// Helper function to render processing cards
function renderProcessingCards(requests, containerId, countId) {
    const container = document.getElementById(containerId);
    const countElement = document.getElementById(countId);
    
    if (!container) {
        console.error(`Container not found: ${containerId}`);
        return;
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Update count
    if (countElement) {
        countElement.textContent = requests.length;
    }
    
    // Sort latest to oldest (process_at then submitted_at)
    const sorted = [...requests].sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));

    // Render each request
    sorted.forEach(request => {
        const card = createProcessingCard(request);
        container.appendChild(card);
    });
}

// Helper function to create a card for processing requests (matching existing card style)
function createProcessingCard(request) {
    const card = document.createElement('div');
    card.className = 'request-card';
    card.classList.add('processing-card');
    
    // Add data attributes for print multiple
    card.dataset.requestId = request.id || request.requestId || request.request_id;
    card.dataset.documentType = request.type || request.documentType || 'barangay-id';
    
    const fullName = [request.givenname || request.given_name || request.firstname || request.first_name, 
                      request.middlename || request.middle_name, 
                      request.surname || request.lastname || request.last_name].filter(Boolean).join(' ') || 'Unknown';
    const submitted = formatDisplayDate(request.submittedAt || request.submitted_at);
    const processedAt = request.processAt || request.process_at;
    const processedDisplay = processedAt ? formatDisplayDate(processedAt) + ' at ' + formatTime(processedAt) : '';
    const purpose = request.purpose || '';
    
    const submittedTime = formatTime(request.submittedAt || request.submitted_at);
    
    card.innerHTML = `
        <div class="card-header">
            <span class="request-date">${submitted} • ${submittedTime}</span>
            </div>
        <div class="card-body">
            <h5>${escapeHtml(fullName || 'No Name')}</h5>
            <p>${escapeHtml(request.address || 'No Address')}</p>
            ${purpose ? `<div class="card-purpose">${escapeHtml(purpose)}</div>` : ''}
            <div class="card-meta">
                ${processedDisplay ? `<span class="processed-time">Checked at: ${processedDisplay}</span>` : ''}
            </div>
        </div>
        <div class="card-actions">
            <button class="btn-action ready-btn"><i class="fas fa-hand-holding"></i> Ready to Receive</button>
        </div>
    `;
    
    // Attach ready to receive handler (changes status to Finished and updates finish_at)
    const readyBtn = card.querySelector('.ready-btn');
    if (readyBtn) {
        readyBtn.addEventListener('click', () => {
            if (!request.id) {
                console.error('No ID found for request:', request);
                showStatusModal('error', 'Error', 'No valid request ID found.');
                return;
            }
            
            // Determine table name from request type
            const docType = request.type || (request.documentType && request.documentType.toLowerCase().replace('_', '-'));
            const tableMap = {
                'barangay_id': 'barangay_id',
                'certification': 'certification',
                'coe': 'coe',
                'clearance': 'clearance',
                'indigency': 'indigency'
            };
            const tableName = tableMap[docType] || 'barangay_id';
            
            // Disable button and show processing state
            readyBtn.disabled = true;
            readyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Marking...';
            
            // Update status to Finished (this will update finish_at timestamp)
            updateRequestStatus(request.id, 'Finished', tableName).then(() => {
                showStatusModal('success', 'Ready to Receive', 'Request has been marked as Ready to Receive.', null, true, 2000);
                // Reload processing requests
                loadProcessingRequests();
            }).catch(error => {
                console.error('Error marking as ready:', error);
                showStatusModal('error', 'Failed', 'Failed to update request status.');
                readyBtn.disabled = false;
                readyBtn.innerHTML = '<i class="fas fa-hand-holding"></i> Ready to Receive';
            });
        });
    }
    
    return card;
}

// Helper function to handle print request (generates document)
async function handlePrintRequest(request) {
    showStatusModal('info', 'Generating Document', `Generating ${request.type} document...`);
    
    try {
        if (request.type === 'barangay_id') {
            // Generate Barangay ID directly
            await processBarangayIdRequest(request.id);
        } else if (request.type === 'certification') {
            // Generate certification document
            await generateCertificationDocumentDirectly(request.id);
        } else if (request.type === 'coe') {
            // Generate COE document
            await generateCoeDocumentDirectly(request.id);
        } else if (request.type === 'clearance') {
            // Generate clearance document
            await generateClearanceDocumentDirectly(request.id);
        } else if (request.type === 'indigency') {
            // Generate indigency document
            await generateIndigencyDocumentDirectly(request.id);
        }
    } catch (error) {
        console.error('Error generating document:', error);
        showStatusModal('error', 'Generation Failed', 'Failed to generate document: ' + error.message);
    }
}

// Direct generation functions for each document type
async function generateCertificationDocumentDirectly(requestId) {
    const trialCourt = ''; // Not needed for direct generation
    
    const response = await fetch('php/generateCertificationDocument.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certification_id: requestId, trial_court: trialCourt, update_status: false })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    if (result.success) {
        // Just download, don't update status - status will be updated when Ready to Receive is clicked
        const primaryUrl = result.download_url || result.downloadUrl;
        const secondaryUrl = result.download_url_2 || result.downloadUrl2;

        if (primaryUrl) {
            const primaryFilename = result.filename || (primaryUrl.split('/').pop() || 'certification.docx');
            triggerFileDownload(primaryUrl, primaryFilename);
        }

        if (secondaryUrl) {
            const secondaryFilename = result.filename_2 || result.filename2 || (secondaryUrl.split('/').pop() || 'document.docx');
            await new Promise(resolve => setTimeout(resolve, 300));
            triggerFileDownload(secondaryUrl, secondaryFilename);
        }

        showStatusModal('success', 'Document Generated', 'Certification document has been generated successfully!');
    } else {
        throw new Error(result.message || 'Failed to generate certification');
    }
}

async function generateCoeDocumentDirectly(requestId) {
    const formData = new FormData();
    formData.append('requestId', requestId);
    
    const response = await fetch('php/generateCoeDocument.php', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    if (result.success) {
        // Just download, don't update status - status will be updated when Ready to Receive is clicked
        showStatusModal('success', 'Document Generated', 'COE document has been generated successfully!', result.downloadUrl);
    } else {
        throw new Error(result.message || 'Failed to generate COE');
    }
}

async function generateClearanceDocumentDirectly(requestId) {
    const response = await fetch('php/generateClearanceDocument.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearance_id: requestId, update_status: false })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    if (result.success) {
        // Just download, don't update status - status will be updated when Ready to Receive is clicked
        showStatusModal('success', 'Document Generated', 'Clearance document has been generated successfully!', result.download_url);
    } else {
        throw new Error(result.message || 'Failed to generate clearance');
    }
}

async function generateIndigencyDocumentDirectly(requestId) {
    const row = await fetchIndigencyRequestData(requestId);
    const language = normalizeIndigencyLanguage(row && row.document_language);
    const formData = new FormData();
    formData.append('requestId', requestId);
    formData.append('language', language);

    const response = await fetch('php/generateIndigencyDocument.php', {
        method: 'POST',
        body: formData
    });
    
    const result = await parseJsonFromResponse(response);
    if (result.success) {
        // Just download, don't update status - status will be updated when Ready to Receive is clicked
        showStatusModal('success', 'Document Generated', 'Indigency document has been generated successfully!', result.downloadUrl);
    } else {
        throw new Error(result.message || 'Failed to generate indigency');
    }
}

// Category Navigation Functions
function showAllCategories() {
    const categories = document.querySelectorAll('.document-category');
    categories.forEach(category => {
        category.classList.remove('hidden');
    });
    
    // Update active nav item
    updateActiveNavItem('all');
}

function showCategory(categoryType) {
    const categories = document.querySelectorAll('.document-category');
    categories.forEach(category => {
        if (category.dataset.category === categoryType) {
            category.classList.remove('hidden');
        } else {
            category.classList.add('hidden');
        }
    });
    
    // Update active nav item
    updateActiveNavItem(categoryType);
    
    // Scroll to top of content
    document.querySelector('.main-content-container').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

function updateActiveNavItem(categoryType) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.category === categoryType) {
            item.classList.add('active');
        }
    });
}

// Mobile Navigation Functions
function toggleMobileNav() {
    const navbar = document.querySelector('.left-navbar');
    navbar.classList.toggle('show');
}

// Admin Profile Dropdown Functions
function toggleAdminDropdown() {
    const dropdown = document.getElementById('adminDropdown');
    if (dropdown.classList.contains('show')) {
        closeAdminDropdown();
    } else {
        openAdminDropdown();
    }
}

function openAdminDropdown() {
    const dropdown = document.getElementById('adminDropdown');
    dropdown.classList.add('show');
    dropdown.setAttribute('aria-hidden', 'false');
}

function closeAdminDropdown() {
    const dropdown = document.getElementById('adminDropdown');
    dropdown.classList.remove('show');
    dropdown.setAttribute('aria-hidden', 'true');
}

function editProfile() {
    showStatusModal('info', 'Edit Profile', 'Profile editing functionality will be implemented here.');
    closeAdminDropdown();
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
    
    titleElement.textContent = 'Confirm Logout';
    messageElement.textContent = 'Are you sure you want to logout?';
    icon.className = 'fas fa-sign-out-alt';
    okBtn.textContent = 'Yes, Logout';
    okBtn.onclick = function() {
        closeStatusModal();
        // Use centralized logout function that tracks logout
        if (window.performLogout) {
            window.performLogout();
        } else {
            window.location.href = 'index.php';
        }
    };
    
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}



function processRequest(requestId) {
    showStatusModal('success', 'Request Processed', 'Request has been processed.', null, true, 2000);
    updateRequestStatus(requestId, 'Processing');
}

// New function to handle Barangay ID processing with form preview
async function processBarangayIdRequest(requestId) {
    try {
        console.log('Processing Barangay ID request with ID:', requestId);
        
        // First, fetch the request data to get the saved BID value
        const requestData = await fetchBarangayIdRequestData(requestId);
        if (!requestData) {
            throw new Error('Request data not found');
        }
        
        // Use the saved BID value if it exists, otherwise show error
        let bidValue = null;
        
        // Debug: Log what we got from database
        console.log('=== PRINT BUTTON CLICKED - Checking BID ===');
        console.log('Request data from database:', requestData);
        console.log('BID value from database:', requestData.bid);
        console.log('BID type:', typeof requestData.bid);
        console.log('BID is null?:', requestData.bid === null);
        console.log('BID is undefined?:', requestData.bid === undefined);
        console.log('BID is empty string?:', requestData.bid === '');
        
        // Check if BID exists and is valid
        if (requestData.bid && requestData.bid !== null && requestData.bid !== '' && requestData.bid !== undefined) {
            // Check if it matches the format
            const bidStr = requestData.bid.toString().trim();
            if (bidStr.match(/^\d{4}-\d+$/)) {
                bidValue = bidStr;
                console.log('✓ Using saved BID value from database:', bidValue);
            } else {
                console.warn('⚠ BID exists but format is invalid:', bidStr);
                // Even if format is slightly off, use it if it matches YYYY-XXXX pattern
                if (bidStr.match(/^\d{4}-/)) {
                    bidValue = bidStr;
                    console.log('⚠ Using BID with relaxed format check:', bidValue);
                } else {
                    console.error('❌ BID format is completely invalid');
                    showStatusModal('error', 'BID Not Set', 'Please set the BID number first. Click "Process" button to set the BID number before generating the document.');
                    return;
                }
            }
        } else {
            // No BID saved yet - show error asking to set BID first
            console.error('❌ BID not found in database for request ID:', requestId);
            showStatusModal('error', 'BID Not Set', 'Please set the BID number first. Click "Process" button to set the BID number before generating the document.');
            return;
        }
        
        if (!bidValue || !bidValue.match(/^\d{4}-\d+$/)) {
            console.error('❌ Invalid BID number format after processing:', bidValue);
            throw new Error('Invalid BID number format: ' + bidValue);
        }
        
        console.log('✅ BID validated successfully:', bidValue);
        
        // Make request to generate document directly with the saved BID value
        const response = await fetch('php/generateBarangayIdDocument.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `requestId=${requestId}&bid=${encodeURIComponent(bidValue)}`
        });
        
        const responseText = await response.text();
        console.log('Raw response:', responseText);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Try to parse as JSON
        const data = JSON.parse(responseText);
        
        if (data.success) {
            // Show success modal with download option
            showBarangayIdGeneratedModal(data);
            
            // Refresh the requests to update status
            loadAllDocumentRequests();
        } else {
            throw new Error(data.message || data.error || 'Failed to generate Barangay ID');
        }
    } catch (error) {
        console.error('Error processing Barangay ID request:', error);
        showStatusModal('error', 'Generation Failed', 'Failed to generate document: ' + error.message);
    }
}

// Function to fetch Barangay ID request data
async function fetchBarangayIdRequestData(requestId) {
    try {
        const response = await fetch(`php/reqDocu.php?table=barangay_id`);
        const data = await response.json();
        
        if (data.requests) {
            return data.requests.find(request => request.id == requestId);
        }
        return null;
    } catch (error) {
        console.error('Error fetching request data:', error);
        return null;
    }
}

// Function to fetch the next available BID number
async function fetchNextBidNumber(bidInput) {
    try {
        const response = await fetch('php/getNextBidNumber.php', { cache: 'no-store' });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.nextBid) {
            bidInput.value = data.nextBid;
            console.log('Auto-generated next BID number:', data.nextBid);
        } else {
            // Fallback: use current year with 0001
            const currentYear = new Date().getFullYear();
            bidInput.value = currentYear + '-0001';
            console.warn('Failed to fetch next BID, using fallback:', bidInput.value);
            if (data.error) {
                console.error('Server error:', data.error);
            }
        }
    } catch (error) {
        console.error('Error fetching next BID number:', error);
        // Fallback: use current year with 0001
        const currentYear = new Date().getFullYear();
        bidInput.value = currentYear + '-0001';
    }
}

// Function to populate and show the process form modal
function populateAndShowBarangayIdProcessForm(requestData) {
    console.log('Populating Barangay ID Process Form with data:', requestData);
    
    // Set the request ID in the modal dataset
    const modal = document.getElementById('barangayIdProcessModal');
    modal.dataset.requestId = requestData.id;
    
    // Show and enable the Generate ID button for process mode
    const generateBtn = document.querySelector('#barangayIdProcessModal .btn-primary');
    if (generateBtn) {
        generateBtn.innerHTML = '<i class="fas fa-check-circle"></i> Generate ID';
        generateBtn.disabled = false;
        generateBtn.style.display = 'inline-flex'; // Make sure it's visible
    }
    
    // Make BID input editable for process mode
    const bidInput = document.getElementById('processBidNumber');
    if (bidInput) {
        bidInput.readOnly = false;
        bidInput.style.backgroundColor = '';
        bidInput.style.cursor = '';
    }
    
    // Update modal title for process mode
    const modalTitle = modal.querySelector('.header-left h3');
    if (modalTitle) {
        modalTitle.textContent = 'BARANGAY ID PROCESS FORM';
    }
    const dateLabel = modal.querySelector('.date-label');
    if (dateLabel) {
        dateLabel.textContent = 'Review and Generate ID';
    }
    
    // Populate the form with the request data
    populateBarangayIdProcessForm(requestData);
    
    // Show the process form modal
    showBarangayIdProcessModal();
}

// Function to populate the Barangay ID process form
function populateBarangayIdProcessForm(requestData) {
    console.log('Populating process form fields with:', {
        givenname: requestData.givenname,
        middlename: requestData.middlename,
        surname: requestData.surname,
        birthday: requestData.birthday,
        address: requestData.address,
        gender: requestData.gender,
        civilStatus: requestData.civilStatus,
        validId: requestData.validId
    });
    
    // BID number will be auto-generated or manually entered by user
    
    // Personal Information - Front Side
    const fullName = [requestData.givenname, requestData.middlename, requestData.surname].filter(Boolean).join(' ').toUpperCase();
    document.getElementById('processFullName').value = fullName || 'NO NAME PROVIDED';
    
    // Format birthday to match PowerPoint format (MMM DD, YYYY)
    let birthday = 'NOT PROVIDED';
    if (requestData.birthday) {
        try {
            const date = new Date(requestData.birthday);
            birthday = date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            }).toUpperCase();
        } catch (e) {
            birthday = requestData.birthday.toUpperCase();
        }
    }
    document.getElementById('processBirthday').value = birthday;
    
    document.getElementById('processAddress').value = (requestData.address || 'NO ADDRESS PROVIDED').toUpperCase();
    // Set BID field - use existing BID value if available, otherwise auto-generate next BID
    const bidInput = document.getElementById('processBidNumber');
    if (requestData.bid && requestData.bid.match(/^\d{4}-\d+$/)) {
        // If there's already a BID saved, use it
        bidInput.value = requestData.bid;
    } else {
        // Auto-generate next BID number for current year
        fetchNextBidNumber(bidInput);
    }
    
    // Ensure year prefix cannot be deleted (dynamically get current year)
    const currentYear = new Date().getFullYear();
    const yearPrefix = currentYear + '-';
    bidInput.addEventListener('input', function(e) {
        // Extract year from current value or use current year
        const currentValue = this.value;
        let year = currentYear;
        if (currentValue.match(/^(\d{4})-/)) {
            year = currentValue.match(/^(\d{4})-/)[1];
        }
        const prefix = year + '-';
        
        if (!this.value.startsWith(prefix)) {
            this.value = prefix;
        }
        // Only allow digits after year prefix (no limit on digits)
        const suffix = this.value.substring(prefix.length).replace(/[^0-9]/g, '');
        this.value = prefix + suffix;
        
        // Check for duplicate BID when user enters at least 1 digit
        if (suffix.length > 0) {
            checkBidDuplicate(this.value, requestData.id);
        } else {
            // Clear any duplicate warning message
            clearBidDuplicateWarning();
        }
    });
    
    // Also check on blur (when user leaves the field)
    bidInput.addEventListener('blur', function(e) {
        if (this.value.match(/^\d{4}-\d+$/)) {
            checkBidDuplicate(this.value, requestData.id);
        }
    });
    
    // Prevent deletion of year prefix on keydown (dynamically calculate prefix length)
    bidInput.addEventListener('keydown', function(e) {
        const currentValue = this.value;
        const currentYear = new Date().getFullYear();
        let year = currentYear;
        if (currentValue.match(/^(\d{4})-/)) {
            year = currentValue.match(/^(\d{4})-/)[1];
        }
        const prefixLength = (year + '-').length; // e.g., "2025-" = 5, "2026-" = 5
        const cursorPos = this.selectionStart;
        if (cursorPos < prefixLength && (e.key === 'Backspace' || e.key === 'Delete')) {
            e.preventDefault();
        }
    });
    
    // Back Side Information
    // Fetch gender from database
    const gender = requestData.gender || 'NOT SPECIFIED';
    document.getElementById('processGender').value = gender.toUpperCase();
    console.log('Gender set to:', gender);
    
    // Height: ft/in (e.g. 5'8) as stored in DB — no "cm" or "foot" suffix
    const rawHeight = requestData.height;
    let heightDisplay = 'NOT SPECIFIED';
    if (rawHeight != null && String(rawHeight).trim() !== '') {
        const h = String(rawHeight).trim().replace(/\s*(cm|CM|foot|feet|ft\.?)\s*$/i, '').trim();
        if (h !== '' && h.toUpperCase() !== 'NOT SPECIFIED') {
            heightDisplay = h;
        }
    }
    document.getElementById('processHeight').value = heightDisplay;
    
    document.getElementById('processNationality').value = (requestData.nationality || 'FILIPINO').toUpperCase();
    
    // Date issued (current date) - matches PowerPoint format
    const currentDate = new Date();
    const dateIssued = currentDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    }).toUpperCase();
    document.getElementById('processDateIssued').value = dateIssued;
    
    // Fetch civil_status from database
    const civilStatus = requestData.civilStatus || requestData.civil_status || 'NOT SPECIFIED';
    document.getElementById('processCivilStatus').value = civilStatus.toUpperCase();
    console.log('Civil Status set to:', civilStatus);
    
    // Store valid_id for reference (if needed)
    const validId = requestData.validId || requestData.valid_id || '';
    console.log('Valid ID type:', validId);
    document.getElementById('processContactNumber').value = (requestData.emergencyContactNumber || 'NOT PROVIDED').toUpperCase();
    
    // Format weight: remove decimals and add "kg"
    const weightValue = requestData.weight;
    if (weightValue && weightValue !== 'NOT SPECIFIED' && !isNaN(parseFloat(weightValue))) {
        const weightInt = Math.round(parseFloat(weightValue));
        document.getElementById('processWeight').value = weightInt + ' KG';
    } else {
        document.getElementById('processWeight').value = 'NOT SPECIFIED';
    }
    
    // Emergency contact - matches PowerPoint format
    const emergencyContact = requestData.emergencyContactName ? 
        `${requestData.emergencyContactName} - ${requestData.emergencyContactNumber || 'NO NUMBER'}` : 
        'NOT PROVIDED';
    document.getElementById('processEmergencyContact').value = emergencyContact.toUpperCase();
    
    // Expiration date (1 year from now) - matches PowerPoint format
    const expDate = new Date();
    expDate.setFullYear(expDate.getFullYear() + 1);
    const expDateFormatted = expDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    }).toUpperCase();
    document.getElementById('processExpDate').value = expDateFormatted;
    
    // Store the request ID for later use
    document.getElementById('barangayIdProcessForm').setAttribute('data-request-id', requestData.id);
    
    // Handle Photo - fetch image data separately
    fetchResidentPhoto(requestData.id, 'processPhotoPlaceholder');
}

// Function to fetch resident photo data
async function fetchResidentPhoto(requestId, containerId) {
    try {
        const response = await fetch(`php/getResidentPhoto.php?requestId=${requestId}`);
        const result = await response.json();
        
        if (result.success && result.imageData) {
            handleProcessPhoto(result.imageData, containerId);
        } else {
            handleProcessPhoto(null, containerId);
        }
    } catch (error) {
        console.error('Error fetching resident photo:', error);
        handleProcessPhoto(null, containerId);
    }
}

// Function to handle photo in process form
function handleProcessPhoto(imageData, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.log('Process Photo container not found:', containerId);
        return;
    }

    if (imageData && imageData !== '' && imageData !== 'image_too_large') {
        const img = document.createElement('img');
        img.src = imageData;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '2px';
        
        img.onerror = function() {
            container.innerHTML = '<div class="photo-text">PHOTO</div>';
        };
        
        container.innerHTML = '';
        container.appendChild(img);
    } else if (imageData === 'image_too_large') {
        container.innerHTML = '<div class="photo-text">PHOTO TOO LARGE</div>';
    } else {
        container.innerHTML = '<div class="photo-text">PHOTO</div>';
    }
}

// Function to show the Barangay ID process modal
function showBarangayIdProcessModal() {
    const modal = document.getElementById('barangayIdProcessModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    // Scroll to top of modal body - use setTimeout to ensure modal is fully rendered
    setTimeout(() => {
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.scrollTop = 0;
        }
        // Also scroll the modal dialog container if it has scroll
        const modalDialog = modal.querySelector('.request-details-dialog');
        if (modalDialog) {
            modalDialog.scrollTop = 0;
        }
    }, 10);
}

// Function to close the Barangay ID process modal
function closeBarangayIdProcessModal() {
    const modal = document.getElementById('barangayIdProcessModal');
    const form = document.getElementById('barangayIdProcessForm');
    
    // Close the modal
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    
    // Reset the form to its initial state
    if (form) {
        form.reset();
    }
    
    // Reset button visibility and state
    const generateBtn = document.querySelector('#barangayIdProcessModal .btn-primary');
    if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-check-circle"></i> Generate ID';
        generateBtn.style.display = 'inline-flex'; // Reset visibility
    }
    
    // Reset BID input to editable
    const bidInput = document.getElementById('processBidNumber');
    if (bidInput) {
        bidInput.readOnly = false;
        bidInput.style.backgroundColor = '';
        bidInput.style.cursor = '';
    }
    
    // Reset modal title
    const modalTitle = modal.querySelector('.header-left h3');
    if (modalTitle) {
        modalTitle.textContent = 'BARANGAY ID PROCESS FORM';
    }
    const dateLabel = modal.querySelector('.date-label');
    if (dateLabel) {
        dateLabel.textContent = 'Review and Generate ID';
    }
    
    // Just reset the button and clear the stored request ID
    if (currentProcessingButton) {
        resetCurrentProcessingButton();
    }
    currentBarangayIdRequestId = null;
    
    console.log('Barangay ID process modal cancelled and reset');
    // Clear duplicate warning when modal is closed
    clearBidDuplicateWarning();
}

// Function to check if BID number already exists in database
async function checkBidDuplicate(bidValue, currentRequestId) {
    try {
        const response = await fetch('php/checkBidDuplicate.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `bid=${encodeURIComponent(bidValue)}&requestId=${currentRequestId || ''}`
        });
        
        const result = await response.json();
        
        if (result.exists) {
            // Show duplicate warning
            showBidDuplicateWarning(bidValue, result.existingRequestId);
            return true;
        } else {
            // Clear warning if BID is unique
            clearBidDuplicateWarning();
            return false;
        }
    } catch (error) {
        console.error('Error checking BID duplicate:', error);
        return false;
    }
}

// Function to show duplicate BID warning notification
function showBidDuplicateWarning(bidValue, existingRequestId) {
    const bidInput = document.getElementById('processBidNumber');
    if (!bidInput) return;
    
    // Remove existing warning if any
    clearBidDuplicateWarning();
    
    // Add warning class to input
    bidInput.style.borderColor = '#dc3545';
    bidInput.style.backgroundColor = '#fff5f5';
    
    // Create warning message element
    const warningDiv = document.createElement('div');
    warningDiv.id = 'bidDuplicateWarning';
    warningDiv.className = 'bid-duplicate-warning';
    warningDiv.style.cssText = 'color: #dc3545; font-size: 12px; margin-top: 5px; padding: 8px; background-color: #fff5f5; border: 1px solid #dc3545; border-radius: 4px; display: flex; align-items: center; gap: 8px;';
    warningDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>The BID number <strong>${bidValue}</strong> has already been used. Please choose a different BID number.</span>
    `;
    
    // Insert warning after input field
    bidInput.parentNode.insertBefore(warningDiv, bidInput.nextSibling);
    
    console.warn(`⚠ BID duplicate detected: ${bidValue} is already used (Request ID: ${existingRequestId})`);
}

// Function to clear duplicate BID warning
function clearBidDuplicateWarning() {
    const bidInput = document.getElementById('processBidNumber');
    if (bidInput) {
        bidInput.style.borderColor = '';
        bidInput.style.backgroundColor = '';
    }
    
    const warningDiv = document.getElementById('bidDuplicateWarning');
    if (warningDiv) {
        warningDiv.remove();
    }
}

// Function to generate Barangay ID document
// NEW FUNCTION: Mark request as DONE (status to Processing, update process_at)
async function markAsDone() {
    const requestId = document.getElementById('barangayIdProcessModal').dataset.requestId;
    
    if (!requestId) {
        showStatusModal('error', 'Error', 'No request ID found');
        return;
    }
    
    // Get BID value from input field - THIS IS THE MANUAL INPUT VALUE
    const bidInput = document.getElementById('processBidNumber');
    const bidValue = bidInput.value.trim();
    
    // Debug logging
    console.log('DONE button clicked - BID input value:', bidValue);
    console.log('DONE button clicked - Request ID:', requestId);
    
    // Validate BID format: must be YYYY-XXXX format (any number of digits after dash)
    if (!bidValue || !bidValue.match(/^\d{4}-\d+$/)) {
        const currentYear = new Date().getFullYear();
        showStatusModal('error', 'Invalid BID', `Please enter a valid BID number (format: ${currentYear}-XXXX)`);
        return;
    }
    
    // Show loading state
    const doneBtn = event.target;
    const originalText = doneBtn.textContent;
    doneBtn.textContent = 'Checking...';
    doneBtn.disabled = true;
    
    // Check for duplicate BID before proceeding
    const isDuplicate = await checkBidDuplicate(bidValue, requestId);
    if (isDuplicate) {
        doneBtn.textContent = originalText;
        doneBtn.disabled = false;
        showStatusModal('error', 'BID Already Exists', `The BID number ${bidValue} has already been used. Please choose a different BID number.`);
        return;
    }
    
    // Continue with processing if BID is unique
    doneBtn.textContent = 'Processing...';
    
    // Debug: Log what we're about to send
    console.log('Sending to PHP - Request ID:', requestId, 'BID:', bidValue);
    const requestBody = `requestId=${requestId}&bid=${encodeURIComponent(bidValue)}`;
    console.log('Request body:', requestBody);
    
    // Save BID and generate document with the MANUAL INPUT VALUE
    fetch('php/generateBarangayIdDocument.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody
    })
    .then(async response => {
        // Check if response is ok
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Get response text first to debug
        const responseText = await response.text();
        console.log('Raw response:', responseText);
        
        // Try to parse as JSON
        try {
            return JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Response text:', responseText);
            throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
        }
    })
    .then(data => {
        if (data.success) {
            // Close modal and show success
        closeBarangayIdProcessModal();
            
            // Get download URL from response
            const downloadUrl = data.downloadUrl || (data.filename ? 'uploads/generated_documents/barangay_id/' + data.filename : null);
            
            console.log('Download URL:', downloadUrl);
            console.log('Response data:', data);
            
            // Show success modal with auto-close and auto-download
            showStatusModal('success', 'Request Processed', 'The request has been processed.', downloadUrl, true, 2000);
            
            // Refresh the requests to update status
            loadAllDocumentRequests();
        
        // Switch to Checked tab and reload processing requests
        setTimeout(() => {
            switchRequestTab('checked');
            }, 2500); // Wait a bit longer for auto-close to complete
        } else {
            throw new Error(data.message || data.error || 'Failed to generate Barangay ID');
        }
    })
    .catch(error => {
        console.error('Error marking as done:', error);
        showStatusModal('error', 'Failed', 'Failed to process request: ' + error.message);
    })
    .finally(() => {
        // Restore button state
        doneBtn.textContent = originalText;
        doneBtn.disabled = false;
    });
}

function generateBarangayIdDocument() {
    // Get the current request data from the modal
    const requestId = document.getElementById('barangayIdProcessModal').dataset.requestId;
    
    if (!requestId) {
        showStatusModal('error', 'Error', 'No request ID found');
        return;
    }
    
    // Get BID value from input field
    const bidValue = document.getElementById('processBidNumber').value.trim();
    
    // Validate BID format: must be YYYY-XXXX format (any number of digits after dash)
    if (!bidValue || !bidValue.match(/^\d{4}-\d+$/)) {
        const currentYear = new Date().getFullYear();
        showStatusModal('error', 'Invalid BID', `Please enter a valid BID number (format: ${currentYear}-XXXX)`);
        return;
    }
    
    // Show loading state
    const generateBtn = event.target;
    const originalText = generateBtn.textContent;
    generateBtn.textContent = 'Generating...';
    generateBtn.disabled = true;
    
    // Make request to generate document
    fetch('php/generateBarangayIdDocument.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `requestId=${requestId}&bid=${encodeURIComponent(bidValue)}`
    })
    .then(async response => {
        // Check if response is ok
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Get response text first to debug
        const responseText = await response.text();
        console.log('Raw response:', responseText);
        
        // Try to parse as JSON
        try {
            return JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Response text:', responseText);
            throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
        }
    })
    .then(data => {
        if (data.success) {
            // Show success modal with download option
            showBarangayIdGeneratedModal(data);
            closeBarangayIdProcessModal();
            // Refresh the requests to update status
            loadAllDocumentRequests();
        } else {
            showStatusModal('error', 'Error', data.message || data.error || 'Failed to generate Barangay ID');
        }
    })
    .catch(error => {
        console.error('Error generating Barangay ID:', error);
        showStatusModal('error', 'Error', 'Failed to generate Barangay ID: ' + error.message);
    })
    .finally(() => {
        // Restore button state
        generateBtn.textContent = originalText;
        generateBtn.disabled = false;
    });
}

// Function to detect cursive text areas using Google Vision API
async function detectSignatureArea(imageData) {
    try {
        const response = await fetch('php/detectSignature.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ imageData: imageData })
        });
        
        if (!response.ok) {
            console.warn('Signature detection API failed, using fallback');
            throw new Error('Failed to detect signature area');
        }
        
        const data = await response.json();
        
        if (data.success && data.signatures && Array.isArray(data.signatures)) {
            console.log('Cursive text areas detected:', data.signatures);
            return {
                signatures: data.signatures,
                fallback: data.fallback || false
            };
        }
        
        throw new Error('Signature detection failed');
    } catch (error) {
        console.warn('Error detecting signature, using fallback:', error);
        // Use fallback coordinates when detection fails to ensure signatures are blurred
        return {
            signatures: [
                {x: 3, y: 78, width: 40, height: 12},
                {x: 55, y: 78, width: 40, height: 12}
            ],
            fallback: true
        };
    }
}

// Function to blur ONLY detected cursive text areas using Google Vision API
async function blurSensitiveIdInfo(imageData) {
    return new Promise(async (resolve, reject) => {
        if (!imageData || imageData === '' || imageData === 'image_too_large') {
            resolve(imageData);
            return;
        }

        const img = new Image();
        if (!imageData.startsWith('data:')) {
            img.crossOrigin = 'anonymous';
        }
        
        img.onload = async function() {
            try {
                if (img.width === 0 || img.height === 0) {
                    console.warn('Image has zero dimensions');
                    resolve(imageData);
                    return;
                }
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                if (!ctx) {
                    console.error('Could not get canvas context');
                    resolve(imageData);
                    return;
                }
                
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw the original image
                ctx.drawImage(img, 0, 0);
                
                // Detect cursive text areas using Google Vision API
                const signatureData = await detectSignatureArea(imageData);
                
                // Apply blur to ALL detected cursive text areas - EXACT coordinates only
                if (signatureData.signatures && Array.isArray(signatureData.signatures) && signatureData.signatures.length > 0) {
                    signatureData.signatures.forEach((sig, index) => {
                        // Convert percentage coordinates to pixel coordinates
                        // NO PADDING - Use exact coordinates to blur only the cursive text
                        let signatureBlurX = Math.floor((sig.x / 100) * canvas.width);
                        let signatureBlurY = Math.floor((sig.y / 100) * canvas.height);
                        let signatureBlurWidth = Math.floor((sig.width / 100) * canvas.width);
                        let signatureBlurHeight = Math.floor((sig.height / 100) * canvas.height);
                        
                        // Ensure coordinates stay within canvas bounds
                        if (signatureBlurX < 0) {
                            signatureBlurWidth += signatureBlurX;
                            signatureBlurX = 0;
                        }
                        if (signatureBlurY < 0) {
                            signatureBlurHeight += signatureBlurY;
                            signatureBlurY = 0;
                        }
                        if (signatureBlurX + signatureBlurWidth > canvas.width) {
                            signatureBlurWidth = canvas.width - signatureBlurX;
                        }
                        if (signatureBlurY + signatureBlurHeight > canvas.height) {
                            signatureBlurHeight = canvas.height - signatureBlurY;
                        }
                        
                        console.log(`Applying blur to cursive text ${index + 1}:`, {
                            x: signatureBlurX,
                            y: signatureBlurY,
                            width: signatureBlurWidth,
                            height: signatureBlurHeight,
                            canvasWidth: canvas.width,
                            canvasHeight: canvas.height
                        });
                        
                        // Apply blur to this EXACT cursive text area only
                        if (signatureBlurHeight > 0 && signatureBlurY >= 0 && signatureBlurWidth > 0 && 
                            signatureBlurX >= 0 && signatureBlurX + signatureBlurWidth <= canvas.width &&
                            signatureBlurY + signatureBlurHeight <= canvas.height) {
                            // Use strong blur radius but only on exact area
                            blurRegion(ctx, signatureBlurX, signatureBlurY, signatureBlurWidth, signatureBlurHeight, 25);
                            console.log(`Blur applied successfully to cursive text ${index + 1}`);
                        } else {
                            console.warn(`Invalid blur coordinates for cursive text ${index + 1}, skipping`);
                        }
                    });
                }
                
                // Convert canvas to data URL
                const blurredDataUrl = canvas.toDataURL('image/jpeg', 0.9);
                resolve(blurredDataUrl);
            } catch (error) {
                console.error('Error blurring image:', error);
                resolve(imageData);
            }
        };
        
        img.onerror = function() {
            console.error('Error loading image for blurring');
            resolve(imageData);
        };
        
        img.src = imageData;
    });
}

// Helper function to apply mosaic/pixelated blur effect
function blurRegion(ctx, x, y, width, height, blurRadius) {
    // Safety checks
    if (!ctx || width <= 0 || height <= 0 || blurRadius <= 0) {
        return;
    }
    
    // Ensure coordinates are within canvas bounds
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + width > canvasWidth) width = canvasWidth - x;
    if (y + height > canvasHeight) height = canvasHeight - y;
    
    if (width <= 0 || height <= 0) {
        return;
    }
    
    try {
        // Get image data for the region
        const imageData = ctx.getImageData(x, y, width, height);
        const data = imageData.data;
        
        // Mosaic/pixelation size - larger value = more pixelated (stronger blur)
        const pixelSize = Math.max(15, Math.min(30, Math.floor(blurRadius / 1.2)));
        
        // Apply mosaic/pixelation effect with multiple passes for stronger blur
        const passes = 3; // Apply 3 times for very strong effect
        
        for (let pass = 0; pass < passes; pass++) {
            // Apply mosaic/pixelation effect
            for (let py = 0; py < height; py += pixelSize) {
                for (let px = 0; px < width; px += pixelSize) {
                    // Calculate average color for this pixel block
                    let r = 0, g = 0, b = 0, a = 0;
                    let count = 0;
                    
                    const blockHeight = Math.min(pixelSize, height - py);
                    const blockWidth = Math.min(pixelSize, width - px);
                    
                    // Sample pixels in this block
                    for (let by = 0; by < blockHeight; by++) {
                        for (let bx = 0; bx < blockWidth; bx++) {
                            const idx = ((py + by) * width + (px + bx)) * 4;
                            r += data[idx];
                            g += data[idx + 1];
                            b += data[idx + 2];
                            a += data[idx + 3];
                            count++;
                        }
                    }
                    
                    // Calculate average
                    const avgR = Math.round(r / count);
                    const avgG = Math.round(g / count);
                    const avgB = Math.round(b / count);
                    const avgA = Math.round(a / count);
                    
                    // Fill the entire block with the average color (creates mosaic effect)
                    for (let by = 0; by < blockHeight; by++) {
                        for (let bx = 0; bx < blockWidth; bx++) {
                            const idx = ((py + by) * width + (px + bx)) * 4;
                            data[idx] = avgR;
                            data[idx + 1] = avgG;
                            data[idx + 2] = avgB;
                            data[idx + 3] = avgA;
                        }
                    }
                }
            }
            
            // Put pixelated data back to canvas after each pass
            ctx.putImageData(imageData, x, y);
            
            // Get updated image data for next pass
            if (pass < passes - 1) {
                const updatedImageData = ctx.getImageData(x, y, width, height);
                for (let i = 0; i < data.length; i++) {
                    data[i] = updatedImageData.data[i];
                }
            }
        }
    } catch (error) {
        console.error('Error in blurRegion:', error);
    }
}

// Function to handle ID image in process form
async function handleProcessIdImage(imageData, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.log('Process ID Image container not found:', containerId);
        return;
    }

    if (imageData && imageData !== '' && imageData !== 'image_too_large') {
        // Apply blur to detected cursive text
        const blurredImageData = await blurSensitiveIdInfo(imageData);
        
        const img = document.createElement('img');
        img.src = blurredImageData;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '200px';
        img.style.border = '1px solid #333';
        img.style.borderRadius = '4px';
        
        img.onerror = function() {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #333; border: 2px dashed #333; border-radius: 4px;">Image failed to load</div>';
        };
        
        container.innerHTML = '';
        container.appendChild(img);
    } else if (imageData === 'image_too_large') {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #333; border: 2px dashed #333; border-radius: 4px;">Image too large to display</div>';
    } else {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #333; border: 2px dashed #333; border-radius: 4px;">No ID Image Available</div>';
    }
}

// Function to generate document from process form
async function generateBarangayIdFromForm() {
    try {
        const form = document.getElementById('barangayIdProcessForm');
        const requestId = form.getAttribute('data-request-id');
        
        if (!requestId) {
            throw new Error('No request ID found');
        }

        // Show loading modal
        showStatusModal('info', 'Generating Document', 'Creating Barangay ID document from template...');
        
        // Close the process form modal
        closeBarangayIdProcessModal();
        
        // Send request to generate PowerPoint document
        const formData = new FormData();
        formData.append('requestId', requestId);
        
        const response = await fetch('php/generateBarangayIdAdvanced.php', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Close the loading modal
            closeStatusModal();
            
            // Ensure any existing SweetAlert modals are closed
            if (Swal.isVisible()) {
                Swal.close();
            }
            
            // Clear stored request ID
            currentBarangayIdRequestId = null;
            
            // Reload the requests immediately to update the status
            loadAllDocumentRequests();
            
            // Small delay to ensure previous modals are fully closed
            setTimeout(() => {
                // Show success modal with download option
                showBarangayIdGeneratedModal(result);
            }, 100);
            
            // Auto-scroll to Processing section after a short delay
            setTimeout(() => {
                const processingSection = document.querySelector('#barangayId-processing-cards').closest('.status-section');
                if (processingSection) {
                    processingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 2000);
        } else {
            throw new Error(result.error || 'Failed to generate document');
        }
    } catch (error) {
        console.error('Error generating Barangay ID document:', error);
        showStatusModal('error', 'Generation Failed', 'Failed to generate Barangay ID document: ' + error.message);
    }
}

// Process functions for other document types
async function processCertificationRequest(requestId, rowData = null) {
    try {
        console.log('Processing Certification request with ID:', requestId);
        
        let requestData = rowData;
        
        // If no row data provided, fetch it
        if (!requestData) {
            requestData = await fetchCertificationRequestData(requestId);
        }
        
        if (requestData) {
            // Populate and show the form modal with the data
            populateAndShowCertificationProcessForm(requestData);
        } else {
            throw new Error('Failed to fetch request data');
        }
        
    } catch (error) {
        console.error('Error processing Certification request:', error);
        showStatusModal('error', 'Processing Failed', 'Failed to load request data: ' + error.message);
    }
}

async function processCoeRequest(requestId) {
    try {
        console.log('Processing COE request with ID:', requestId);
        
        // First, fetch the request data to populate the form
        const requestData = await fetchCoeRequestData(requestId);
        
        if (requestData) {
            // Populate and show the form modal with the data
            populateAndShowCoeProcessForm(requestData);
        } else {
            throw new Error('Failed to fetch request data');
        }
    } catch (error) {
        console.error('Error processing COE request:', error);
        showStatusModal('error', 'Processing Failed', 'Failed to load request data: ' + error.message);
    }
}

async function processClearanceRequest(requestId, rowData = null) {
    try {
        console.log('Processing Clearance request with ID:', requestId);
        
        // Always fetch fresh data from backend to ensure we have all fields
        let requestData = await fetchClearanceRequestData(requestId);
        
        // If fetch failed, try using rowData as fallback
        if (!requestData && rowData) {
            requestData = rowData;
        }
        
        if (requestData) {
            console.log('Request data for clearance:', requestData);
            // Populate and show the form modal with the data
            populateAndShowClearanceProcessForm(requestData);
        } else {
            throw new Error('Failed to fetch request data');
        }
    } catch (error) {
        console.error('Error processing Clearance request:', error);
        showStatusModal('error', 'Processing Failed', 'Failed to load request data: ' + error.message);
    }
}

async function processIndigencyRequest(requestId, rowData = null) {
    try {
        console.log('Processing Indigency request with ID:', requestId);
        
        let requestData = rowData;
        
        // If no row data provided, fetch it
        if (!requestData) {
            requestData = await fetchIndigencyRequestData(requestId);
        }
        
        if (requestData) {
            // Populate and show the form modal with the data
            populateAndShowIndigencyProcessForm(requestData);
        } else {
            throw new Error('Failed to fetch request data');
        }
    } catch (error) {
        console.error('Error processing Indigency request:', error);
        showStatusModal('error', 'Processing Failed', 'Failed to load request data: ' + error.message);
    }
}

// Function to fetch Indigency request data
async function fetchIndigencyRequestData(requestId) {
    try {
        const response = await fetch(`php/reqDocu.php?table=indigency`);
        const data = await response.json();
        
        if (data.requests) {
            return data.requests.find(request => request.id == requestId);
        }
        return null;
    } catch (error) {
        console.error('Error fetching Indigency request data:', error);
        return null;
    }
}

// Function to fetch COE request data
async function fetchCoeRequestData(requestId) {
    try {
        const response = await fetch(`php/reqDocu.php?table=coe`);
        const data = await response.json();
        
        if (data.requests) {
            return data.requests.find(request => request.id == requestId);
        }
        return null;
    } catch (error) {
        console.error('Error fetching COE request data:', error);
        return null;
    }
}

// Function to fetch Clearance request data
async function fetchClearanceRequestData(requestId) {
    try {
        const response = await fetch(`php/reqDocu.php?table=clearance`);
        const data = await response.json();
        
        if (data.requests) {
            return data.requests.find(request => request.id == requestId);
        }
        return null;
    } catch (error) {
        console.error('Error fetching Clearance request data:', error);
        return null;
    }
}

// Function to populate and show clearance process form
function populateAndShowClearanceProcessForm(requestData, viewOnly = false) {
    // Set the request ID in the modal dataset
    const modal = document.getElementById('clearanceProcessModal');
    modal.dataset.requestId = requestData.id;
    
    // Hide generate button if view-only
    const generateBtn = modal.querySelector('.btn-primary, .primary-btn');
    if (generateBtn) {
        generateBtn.style.display = viewOnly ? 'none' : 'inline-flex';
    }
    
    // Populate the form with the request data
    populateClearanceProcessForm(requestData);
    
    // Show the modal
    showClearanceProcessModal();
}

// Function to populate clearance process form
function populateClearanceProcessForm(requestData) {
    console.log('Populating clearance form with data:', requestData);
    
    // Personal Information
    const firstName = (requestData.first_name || 'NO FIRST NAME').toUpperCase();
    const middleName = (requestData.middle_name || '').toUpperCase();
    const lastName = (requestData.last_name || 'NO LAST NAME').toUpperCase();
    const address = (requestData.address || 'NO ADDRESS PROVIDED').toUpperCase();
    const birthDate = formatDateToCaps(requestData.birth_date || '');
    // Fetch birth_place from database
    const birthPlace = (requestData.birth_place || requestData.birthPlace || 'NOT SPECIFIED').toUpperCase();
    // Fetch gender from database
    const gender = (requestData.gender || 'NOT SPECIFIED').toUpperCase();
    const citizenship = (requestData.citizenship || 'NOT SPECIFIED').toUpperCase();
    // Fetch civil_status from database
    const civilStatus = (requestData.civil_status || requestData.civilStatus || 'NOT SPECIFIED').toUpperCase();
    
    // Current date for certificate
    const currentDate = new Date();
    const dateIssued = formatDateToCaps(currentDate.toISOString().split('T')[0]);
    const expirationDate = new Date(currentDate);
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    const expiration = formatDateToCaps(expirationDate.toISOString().split('T')[0]);
    
    // Get purpose from request data
    const purpose = (requestData.purpose || '').toUpperCase();
    
    // Store valid_id for future use (if needed)
    const validId = (requestData.valid_id || requestData.validId || '').toUpperCase();
    console.log('Valid ID type:', validId);
    
    // Populate form fields
    document.getElementById('clearProcessFirstName').value = firstName;
    document.getElementById('clearProcessMiddleName').value = middleName;
    document.getElementById('clearProcessLastName').value = lastName;
    document.getElementById('clearProcessAddress').value = address;
    document.getElementById('clearProcessBirthDate').value = birthDate;
    // Ensure birth_place is populated from database
    const birthPlaceField = document.getElementById('clearProcessBirthPlace');
    if (birthPlaceField) {
        birthPlaceField.value = birthPlace;
        console.log('Birth Place set to:', birthPlace);
    }
    // Ensure gender is populated from database
    const genderField = document.getElementById('clearProcessGender');
    if (genderField) {
        genderField.value = gender;
        console.log('Gender set to:', gender);
    }
    document.getElementById('clearProcessCitizenship').value = citizenship;
    // Ensure civil_status is populated from database
    const civilStatusField = document.getElementById('clearProcessCivilStatus');
    if (civilStatusField) {
        civilStatusField.value = civilStatus;
        console.log('Civil Status set to:', civilStatus);
    }
    document.getElementById('clearProcessDateIssued').value = dateIssued;
    
    // Show or hide expiration field based on purpose
    const expirationInput = document.getElementById('clearanceExpirationInput');
    const expirationSpan = document.getElementById('clearProcessExpiration');
    
    if (purpose === 'BUSINESS-CLEARANCE' || purpose === 'PROOF-OF-RESIDENCY') {
        // Show input for business clearance and proof of residency
        if (expirationInput && expirationSpan) {
            expirationInput.style.display = 'inline-block';
            expirationSpan.style.display = 'none';
            expirationInput.value = ''; // Clear the input
            
            // Set default to 1 year from now
            const defaultExpiration = new Date();
            defaultExpiration.setFullYear(defaultExpiration.getFullYear() + 1);
            expirationInput.value = defaultExpiration.toISOString().split('T')[0];
        }
    } else {
        // Show static expiration for barangay clearance
        if (expirationInput && expirationSpan) {
            expirationInput.style.display = 'none';
            expirationSpan.style.display = 'inline';
            expirationSpan.textContent = expiration;
        }
    }
    
    // Set purpose
    const purposeElement = document.getElementById('clearProcessPurpose');
    if (purposeElement) {
        purposeElement.value = purpose || 'LOCAL EMPLOYMENT';
    }
}

// Function to show the Clearance process modal
function showClearanceProcessModal() {
    const modal = document.getElementById('clearanceProcessModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    
    console.log('Clearance process modal shown');
    // Scroll to top of modal body - use setTimeout to ensure modal is fully rendered
    setTimeout(() => {
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.scrollTop = 0;
        }
        // Also scroll the modal dialog container if it has scroll
        const modalDialog = modal.querySelector('.request-details-dialog');
        if (modalDialog) {
            modalDialog.scrollTop = 0;
        }
    }, 10);
}

// Function to cancel clearance process
function cancelClearanceProcess() {
    const modal = document.getElementById('clearanceProcessModal');
    
    // Close the modal
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    
    // Clear any processing state or loading indicators
    const generateBtn = document.querySelector('#clearanceProcessModal .primary-btn');
    if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-print"></i> GENERATE CLEARANCE';
    }
    
    // Since status no longer changes when Process is clicked,
    // there's no need to revert status
    // Just reset the button and clear stored data
    if (currentProcessingButton) {
        resetCurrentProcessingButton();
    }
    
    // Reload requests to update UI
    loadAllDocumentRequests();
    
    // Clear the stored request ID
    currentClearanceRequestId = null;
    
    console.log('Clearance process modal cancelled');
}

// Function to handle done action for clearance
async function doneClearanceProcess() {
    const modal = document.getElementById('clearanceProcessModal');
    const requestId = modal.dataset.requestId;
    
    if (!requestId) {
        showStatusModal('error', 'Error', 'No request ID found');
        return;
    }
    
    // Get expiration date input
    const expirationInput = document.getElementById('clearanceExpirationInput');
    let expirationDate = '';
    
    if (expirationInput && expirationInput.value) {
        // Format the date to YYYY-MM-DD for backend processing
        expirationDate = expirationInput.value;
    }
    
    try {
        // Show loading modal
        showStatusModal('info', 'Processing Request', 'Generating clearance document...');
        
        // Generate clearance document first
        const response = await fetch('php/generateClearanceDocument.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                clearance_id: requestId,
                expiration_date: expirationDate,
                update_status: false
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to generate clearance document');
        }
        
        // Get download URL from response
        const downloadUrl = result.download_url || result.downloadUrl;
    
    // Update status to Processing with process_at timestamp
        await updateRequestStatus(requestId, 'Processing', 'clearance');
        
        // Close the process form modal
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        
        // Show success modal with auto-close and auto-download
        showStatusModal('success', 'Request Processed', 'Request has been processed.', downloadUrl, true, 2000);
        
        // Refresh the requests to update status
        loadAllDocumentRequests();
        
        // Switch to Checked tab and reload processing requests
        setTimeout(() => {
            switchRequestTab('checked');
        }, 2500); // Wait a bit longer for auto-close to complete
        
    } catch (error) {
        console.error('Error processing clearance:', error);
        showStatusModal('error', 'Failed', 'Failed to process request: ' + error.message);
    }
}

// Fetch certification request data
async function fetchCertificationRequestData(requestId) {
    try {
        const response = await fetch(`php/reqDocu.php?table=certification`);
        const data = await response.json();
        
        if (data.requests) {
            return data.requests.find(request => request.id == requestId);
        }
        return null;
    } catch (error) {
        console.error('Error fetching Certification request data:', error);
        return null;
    }
}

// Function to populate and show certification process form
function populateAndShowCertificationProcessForm(requestData, viewOnly = false) {
    // Set the request ID in the modal dataset
    const modal = document.getElementById('certificationProcessModal');
    modal.dataset.requestId = requestData.id;
    // Store raw purpose so we can customize labels/messages later (e.g., jobseeker = 2 forms)
    if (requestData.purpose) {
        modal.dataset.purposeRaw = requestData.purpose;
    } else {
        delete modal.dataset.purposeRaw;
    }
    
    // Hide generate button if view-only
    const generateBtn = modal.querySelector('.primary-btn, .btn-primary');
    if (generateBtn) {
        generateBtn.style.display = viewOnly ? 'none' : 'inline-flex';
    }
    
    // Populate the form with the request data
    populateCertificationProcessForm(requestData);
    
    // Show the modal
    showCertificationProcessModal();
}

// Function to populate certification process form
function populateCertificationProcessForm(requestData) {
    const firstName = (requestData.givenname || requestData.firstname || 'NO FIRST NAME').toUpperCase();
    const middleName = (requestData.middlename || requestData.middlename || '').toUpperCase();
    const lastName = (requestData.surname || requestData.lastname || 'NO LAST NAME').toUpperCase();
    const fullName = `${firstName} ${middleName} ${lastName}`.trim();
    const address = (requestData.address || 'NO ADDRESS PROVIDED').toUpperCase();
    const gender = (requestData.gender || 'NOT SPECIFIED').toUpperCase();
    const citizenship = (requestData.citizenship || 'FILIPINO').toUpperCase();
    const civilStatus = (requestData.civilStatus || requestData.civil_status || 'NOT SPECIFIED').toUpperCase();
    const purpose = (requestData.purpose || '').toLowerCase();
    
    // Current date
    const currentDate = new Date();
    const dateIssued = formatDateToCaps(currentDate.toISOString().split('T')[0]);
    
    // Populate form fields
    document.getElementById('certProcessPurpose').value = purpose.toUpperCase().replace(/-/g, ' ');
    document.getElementById('certProcessName').value = fullName;
    document.getElementById('certProcessGender').value = gender;
    document.getElementById('certProcessCitizenship').value = citizenship;
    document.getElementById('certProcessCivilStatus').value = civilStatus;
    document.getElementById('certProcessAddress').value = address;
    document.getElementById('certProcessDateIssued').value = dateIssued;
    
    // Show/hide purpose-specific fields
    document.getElementById('certProcessProofFields').style.display = 'none';
    document.getElementById('certProcessPagIbigFields').style.display = 'none';
    document.getElementById('certProcessDeadFields').style.display = 'none';
    document.getElementById('certProcessBailFields').style.display = 'none';
    
    if (purpose === 'proof-of-residency') {
        document.getElementById('certProcessProofFields').style.display = 'block';
        const startYear = requestData.start_year || requestData.startYear || requestData.startyear || '';
        console.log('Proof of Residency - start_year value:', startYear);
        document.getElementById('certProcessStartYear').value = startYear || 'NOT PROVIDED';
    } else if (purpose === 'pag-ibig loan' || purpose === 'pag-ibig-loan') {
        document.getElementById('certProcessPagIbigFields').style.display = 'block';
        const jobPosition = requestData.job_position || requestData.jobPosition || requestData.jobposition || requestData.Job_Position || '';
        const startOfWork = requestData.start_of_work || requestData.startOfWork || requestData.startofwork || '';
        const monthlyIncome = requestData.monthly_income || requestData.monthlyIncome || requestData.monthlyincome || '0';
        
        console.log('Pag-IBIG Loan data:', { jobPosition, startOfWork, monthlyIncome });
        
        document.getElementById('certProcessJobPosition').value = jobPosition.toUpperCase() || 'NOT PROVIDED';
        document.getElementById('certProcessStartOfWork').value = startOfWork.toUpperCase() || 'NOT PROVIDED';
        document.getElementById('certProcessMonthlyIncome').value = monthlyIncome !== '0' ? 'PHP ' + monthlyIncome : 'NOT PROVIDED';
    } else if (purpose === 'certification-for-dead' || purpose === 'certification_for_dead') {
        document.getElementById('certProcessDeadFields').style.display = 'block';
        const monthYear = requestData.month_year || requestData.monthYear || requestData.monthyear || '';
        console.log('Certification for Dead - month_year value:', monthYear);
        document.getElementById('certProcessMonthYear').value = monthYear || 'NOT PROVIDED';
    } else if (purpose === 'certification-for-bail') {
        document.getElementById('certProcessBailFields').style.display = 'block';
        // Trial court will be entered by user
    }
}

// Function to show the Certification process modal
function showCertificationProcessModal() {
    const modal = document.getElementById('certificationProcessModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    
    console.log('Certification process modal shown');
    // Scroll to top of modal body - use setTimeout to ensure modal is fully rendered
    setTimeout(() => {
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.scrollTop = 0;
        }
        // Also scroll the modal dialog container if it has scroll
        const modalDialog = modal.querySelector('.request-details-dialog');
        if (modalDialog) {
            modalDialog.scrollTop = 0;
        }
    }, 10);
}

// Function to cancel certification process
function cancelCertificationProcess() {
    const modal = document.getElementById('certificationProcessModal');
    
    // Close the modal
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    
    // Clear any processing state or loading indicators
    const generateBtn = document.querySelector('#certificationProcessModal .primary-btn');
    if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-print"></i> GENERATE CERTIFICATION';
    }
    
    // Since status no longer changes when Process is clicked,
    // there's no need to revert status
    // Just reset the button and clear stored data
    if (currentCertificationRequestId) {
        if (currentProcessingButton) {
            resetCurrentProcessingButton();
        }
    }
    
    // Reload requests to update UI
    loadAllDocumentRequests();
    
    // Clear the stored request ID
    currentCertificationRequestId = null;
    
    console.log('Certification process modal cancelled');
}

// Function to handle done action for certification
async function doneCertificationProcess() {
    const modal = document.getElementById('certificationProcessModal');
    const requestId = modal.dataset.requestId;
    
    if (!requestId) {
        showStatusModal('error', 'Error', 'No request ID found');
        return;
    }
    
    // Get trial court input if applicable
    const trialCourtInput = document.getElementById('certProcessTrialCourt');
    const trialCourt = trialCourtInput ? trialCourtInput.value : '';
    
    // Determine if this is a jobseeker certification (2 forms)
    const rawPurpose = modal.dataset.purposeRaw || '';
    const normalizedPurpose = rawPurpose.toLowerCase();
    const generatingMessage = normalizedPurpose === 'jobseeker'
        ? '2 forms generating please wait...'
        : 'Generating certification document...';

    try {
        // Show loading modal
        showStatusModal('info', 'Processing Request', generatingMessage);
        
        // Generate certification document first
        const response = await fetch('php/generateCertificationDocument.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                certification_id: requestId,
                trial_court: trialCourt,
                update_status: false
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to generate certification document');
        }
        
        // Get primary and secondary download URLs from response (for jobseeker: CERT + OATH)
        const primaryUrl = result.download_url || result.downloadUrl;
        const secondaryUrl = result.download_url_2 || result.downloadUrl2;
        const primaryFilename = result.filename || (primaryUrl ? (primaryUrl.split('/').pop() || 'certification.docx') : null);
        const secondaryFilename = result.filename_2 || result.filename2 || (secondaryUrl ? (secondaryUrl.split('/').pop() || 'document.docx') : null);
    
        // Update status to Processing with process_at timestamp
        await updateRequestStatus(requestId, 'Processing', 'certification');
        
        // Close the process form modal
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        
        // Show success modal with auto-close
        // Downloads (including second JOBSEEKER document) are handled separately below
        showStatusModal('success', 'Request Processed', 'Request has been processed.', null, true, 2000);
        
        // After a short delay (to let the modal appear), trigger downloads
        if (primaryUrl) {
            setTimeout(() => {
                triggerFileDownload(primaryUrl, primaryFilename || undefined);
                
                // If a second document is provided (e.g., JOBSEEKER_OATH), download it right after the first
                if (secondaryUrl) {
                    setTimeout(() => {
                        triggerFileDownload(secondaryUrl, secondaryFilename || undefined);
                    }, 500);
                }
            }, 500);
        }
        
        // Refresh the requests to update status
        loadAllDocumentRequests();
        
        // Switch to Checked tab and reload processing requests
        setTimeout(() => {
            switchRequestTab('checked');
        }, 2500); // Wait a bit longer for auto-close to complete
        
    } catch (error) {
        console.error('Error processing certification:', error);
        showStatusModal('error', 'Failed', 'Failed to process request: ' + error.message);
    }
}

// Function to generate certification from form
async function generateCertificationFromForm() {
    const modal = document.getElementById('certificationProcessModal');
    const requestId = modal.dataset.requestId;
    
    if (!requestId) {
        showStatusModal('error', 'Error', 'No request ID found');
        return;
    }
    
    // Get trial court input if applicable
    const trialCourtInput = document.getElementById('certProcessTrialCourt');
    const trialCourt = trialCourtInput ? trialCourtInput.value : '';
    
    // Determine if this is a jobseeker certification (2 forms)
    const rawPurpose = modal.dataset.purposeRaw || '';
    const normalizedPurpose = rawPurpose.toLowerCase();
    const generatingMessage = normalizedPurpose === 'jobseeker'
        ? '2 forms generating please wait...'
        : 'Generating certification document...';

    try {
        // Show loading modal
        showStatusModal('info', 'Processing Request', 'Updating status to Processing...');
        
        // First, update status to Processing
        await updateRequestStatus(requestId, 'Processing', 'certification');
        
        // Show loading modal for generation
        showStatusModal('info', 'Processing Request', generatingMessage);
        
        // Generate certification document
        const response = await fetch('php/generateCertificationDocument.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                certification_id: requestId,
                trial_court: trialCourt,
                update_status: false
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Close the loading modal
            closeStatusModal();
            
            // Close the process form modal
            const certificationModal = document.getElementById('certificationProcessModal');
            if (certificationModal) {
                certificationModal.classList.remove('show');
                certificationModal.setAttribute('aria-hidden', 'true');
            }
            
            // Clear stored request ID and reset button
            currentCertificationRequestId = null;
            if (currentProcessingButton) {
                currentProcessingButton = null;
            }
            
            // Reload requests to show updated status
            loadAllDocumentRequests();
            
            // Show success modal with download option
            showCertificationGeneratedModal(result);
        } else {
            showStatusModal('error', 'Generation Failed', result.message || 'Failed to generate certification document.');
        }
        
    } catch (error) {
        console.error('Error generating certification document:', error);
        showStatusModal('error', 'Generation Failed', 'Failed to generate certification document: ' + error.message);
    }
}

// Function to update certification request status
async function updateCertificationRequestStatus(requestId, status) {
    try {
        const response = await fetch('php/reqDocu.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update_status',
                table: 'certification',
                id: requestId,
                status: status
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log(`Certification request ${requestId} status updated to ${status}`);
        } else {
            console.error('Failed to update certification request status:', result.message);
        }
    } catch (error) {
        console.error('Error updating certification request status:', error);
    }
}

// Add global variable for current certification request
let currentCertificationRequestId = null;

// Function to generate clearance from form
async function generateClearanceFromForm() {
    const modal = document.getElementById('clearanceProcessModal');
    const requestId = modal.dataset.requestId;
    
    if (!requestId) {
        showStatusModal('error', 'Error', 'No request ID found');
        return;
    }
    
    // Get expiration date input
    const expirationInput = document.getElementById('clearanceExpirationInput');
    let expirationDate = '';
    
    if (expirationInput && expirationInput.value) {
        // Format the date to YYYY-MM-DD for backend processing
        expirationDate = expirationInput.value;
    }
    
    try {
        // Show loading modal
        showStatusModal('info', 'Processing Request', 'Generating clearance document...');
        
        // First, update status to Processing
        await updateClearanceRequestStatus(requestId, 'Processing');
        
        // Generate clearance document with status update
        const response = await fetch('php/generateClearanceDocument.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                clearance_id: requestId,
                expiration_date: expirationDate,
                update_status: true
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Close the loading modal
            closeStatusModal();
            
            // Close the process form modal
            const clearanceModal = document.getElementById('clearanceProcessModal');
            if (clearanceModal) {
                clearanceModal.classList.remove('show');
                clearanceModal.setAttribute('aria-hidden', 'true');
            }
            
            // Clear stored request ID and reset button
            currentClearanceRequestId = null;
            if (currentProcessingButton) {
                currentProcessingButton = null;
            }
            
            // Reload requests to show updated status
            loadAllDocumentRequests();
            
            // Show success modal with download option
            showClearanceGeneratedModal(result);
        } else {
            showStatusModal('error', 'Generation Failed', result.message || 'Failed to generate clearance document.');
        }
        
    } catch (error) {
        console.error('Error generating clearance document:', error);
        showStatusModal('error', 'Generation Failed', 'Failed to generate clearance document: ' + error.message);
    }
}

// Helper function to format date to caps format (JANUARY 29, 2025)
function formatDateToCaps(dateString) {
    if (!dateString) return 'NOT SPECIFIED';
    
    try {
        const date = new Date(dateString);
        const monthNames = [
            'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
            'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
        ];
        
        const month = monthNames[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        
        return `${month} ${day}, ${year}`;
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'INVALID DATE';
    }
}

// Function to update clearance request status
async function updateClearanceRequestStatus(requestId, status) {
    try {
        const response = await fetch('php/reqDocu.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update_status',
                table: 'clearance',
                id: requestId,
                status: status
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log(`Clearance request ${requestId} status updated to ${status}`);
            // Reload requests to show updated status
            loadAllDocumentRequests();
        } else {
            console.error('Failed to update clearance request status:', result.message);
        }
    } catch (error) {
        console.error('Error updating clearance request status:', error);
    }
}

// Function to update indigency request status
async function updateIndigencyRequestStatus(requestId, status) {
    try {
        const response = await fetch('php/reqDocu.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update_status',
                table: 'indigency',
                id: requestId,
                status: status
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log(`Indigency request ${requestId} status updated to ${status}`);
            // Reload requests to show updated status
            loadAllDocumentRequests();
        } else {
            console.error('Failed to update indigency request status:', result.message);
        }
    } catch (error) {
        console.error('Error updating indigency request status:', error);
    }
}

// Function to update COE request status
async function updateCoeRequestStatus(requestId, status) {
    try {
        const response = await fetch('php/reqDocu.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update_status',
                table: 'coe',
                id: requestId,
                status: status
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log(`COE request ${requestId} status updated to ${status}`);
            // Reload requests to show updated status
            loadAllDocumentRequests();
        } else {
            console.error('Failed to update COE request status:', result.message);
        }
    } catch (error) {
        console.error('Error updating COE request status:', error);
    }
}

// Function to update barangay ID request status
async function updateBarangayIdRequestStatus(requestId, status) {
    try {
        const response = await fetch('php/reqDocu.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update_status',
                table: 'barangay_id',
                id: requestId,
                status: status
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log(`Barangay ID request ${requestId} status updated to ${status}`);
            // Reload requests to show updated status
            loadAllDocumentRequests();
        } else {
            console.error('Failed to update barangay ID request status:', result.message);
        }
    } catch (error) {
        console.error('Error updating barangay ID request status:', error);
    }
}

// Function to populate and show the COE process form modal
function populateAndShowCoeProcessForm(requestData, viewOnly = false) {
    // Set the request ID in the modal dataset
    const modal = document.getElementById('coeProcessModal');
    modal.dataset.requestId = requestData.id;
    
    // Hide generate button if view-only
    const generateBtn = modal.querySelector('.btn-primary, .primary-btn');
    if (generateBtn) {
        generateBtn.style.display = viewOnly ? 'none' : 'inline-flex';
    }
    
    // Populate the form with the request data
    populateCoeProcessForm(requestData);
    
    // Show the process form modal
    showCoeProcessModal();
}

// Function to populate the COE process form
function populateCoeProcessForm(requestData) {
    // Store the request data globally for later use
    currentCoeRequestData = requestData;
    
    // Personal Information - individual name fields (CAPS LOCK)
    const firstName = (requestData.givenname || 'NO FIRST NAME').toUpperCase();
    const middleName = (requestData.middlename || '').toUpperCase();
    const lastName = (requestData.surname || 'NO LAST NAME').toUpperCase();
    
    // Populate individual name fields
    const firstNameElement = document.getElementById('coeProcessFirstName');
    const middleNameElement = document.getElementById('coeProcessMiddleName');
    const lastNameElement = document.getElementById('coeProcessLastName');
    
    if (firstNameElement) firstNameElement.value = firstName;
    if (middleNameElement) middleNameElement.value = middleName;
    if (lastNameElement) lastNameElement.value = lastName;
    
    // Address (proper case)
    const addressElement = document.getElementById('coeProcessAddress');
    if (addressElement) {
        const address = requestData.address ? requestData.address.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) : 'No Address Provided';
        addressElement.value = address;
    }
    
    // Employment Type (proper case with dash instead of underscore)
    const employmentTypeElement = document.getElementById('coeProcessEmploymentType');
    if (employmentTypeElement) {
        const employmentType = requestData.employmentType ? 
            requestData.employmentType.toLowerCase().replace(/_/g, '-').replace(/\b\w/g, l => l.toUpperCase()) : 
            'Not Specified';
        employmentTypeElement.value = employmentType;
    }
    
    // Position (proper case)
    const positionElement = document.getElementById('coeProcessPosition');
    if (positionElement) {
        const position = requestData.position ? 
            requestData.position.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) : 
            'Not Specified';
        positionElement.value = position;
    }
    
    // Date Started (proper case)
    const dateStartedElement = document.getElementById('coeProcessDateStarted');
    if (dateStartedElement) {
        const dateStarted = requestData.dateStarted ? formatDisplayDate(requestData.dateStarted) : 'Not Specified';
        dateStartedElement.value = dateStarted;
    }
    
    // Monthly Salary (formatted with peso sign and amount in words in parentheses)
    const monthlySalaryElement = document.getElementById('coeProcessMonthlySalary');
    if (monthlySalaryElement && requestData.monthlySalary) {
        const salary = parseFloat(requestData.monthlySalary) || 0;
        const amountInWords = convertNumberToWords(salary);
        const formattedSalary = `₱ ${salary.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${amountInWords} Pesos)`;
        monthlySalaryElement.value = formattedSalary.toUpperCase();
    }
    
    // Amount in Words - removed duplicate, already included in monthly salary field
    
    // Current date for certificate with ordinal suffix (simplified for input field)
    const currentDate = new Date();
    const day = currentDate.getDate();
    const month = currentDate.toLocaleDateString('en-US', { month: 'long' });
    const year = currentDate.getFullYear();
    
    // Add ordinal suffix
    let suffix = 'th';
    if (![11, 12, 13].includes(day % 100)) {
        switch (day % 10) {
            case 1: suffix = 'st'; break;
            case 2: suffix = 'nd'; break;
            case 3: suffix = 'rd'; break;
        }
    }
    
    const certificateDate = `${day}${suffix} day of ${month} ${year}`;
    
    const dateIssuedElement = document.getElementById('coeProcessDateIssued');
    if (dateIssuedElement) {
        dateIssuedElement.value = certificateDate;
    }
    
    // Store the request ID for later use
    document.getElementById('coeProcessForm').setAttribute('data-request-id', requestData.id);
}

// Function to convert number to words
function convertNumberToWords(num) {
    if (!num || isNaN(num)) return 'NOT SPECIFIED';
    
    const number = parseInt(num);
    if (number === 0) return 'ZERO';
    
    const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    const teens = ['TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    
    if (number < 10) return ones[number];
    if (number < 20) return teens[number - 10];
    if (number < 100) {
        const ten = Math.floor(number / 10);
        const one = number % 10;
        return tens[ten] + (one ? ' ' + ones[one] : '');
    }
    if (number < 1000) {
        const hundred = Math.floor(number / 100);
        const remainder = number % 100;
        return ones[hundred] + ' HUNDRED' + (remainder ? ' ' + convertNumberToWords(remainder) : '');
    }
    if (number < 1000000) {
        const thousand = Math.floor(number / 1000);
        const remainder = number % 1000;
        return convertNumberToWords(thousand) + ' THOUSAND' + (remainder ? ' ' + convertNumberToWords(remainder) : '');
    }
    
    return 'AMOUNT TOO LARGE';
}

function unlockIndigencyAddresseeFields() {
    const pk = document.getElementById('indigencyParaKay');
    const hall = document.getElementById('indigencyHallAddress');
    const posDisp = document.getElementById('indigencyPositionDisplay');
    if (pk) pk.readOnly = false;
    if (hall) hall.readOnly = false;
    if (posDisp) posDisp.readOnly = false;
}

/** Kapag may para_kay na sa DB, hindi na mababago ang addressee dito (galing database). */
function applyIndigencyAddresseeLockState(requestData) {
    const hasPk = (requestData.para_kay || '').trim() !== '';
    const pk = document.getElementById('indigencyParaKay');
    const hall = document.getElementById('indigencyHallAddress');
    const posDisp = document.getElementById('indigencyPositionDisplay');
    if (pk) pk.readOnly = hasPk;
    if (hall) hall.readOnly = hasPk;
    if (posDisp) posDisp.readOnly = hasPk;
}

/** Hinati ang position — tugma sa PHP indigencySplitPositionEnTl (unang segment = EN, huli = TL kung may |). */
function splitPositionEnTl(raw) {
    const s = (raw || '').trim().replace(/\s+/g, ' ');
    if (!s) return { en: '', tl: '' };
    if (s.includes('|')) {
        const segments = s.split(/\s*\|\s*/).map((x) => x.trim()).filter(Boolean);
        if (segments.length >= 2) {
            const tl = segments[segments.length - 1];
            const first = segments[0];
            let en = first;
            if (first.includes('/') && !first.includes('://')) {
                en = first.split(/\s*\/\s*/)[0].trim();
            }
            return { en, tl };
        }
    }
    const i = s.indexOf(' / ');
    if (i > 0) {
        return { en: s.slice(0, i).trim(), tl: s.slice(i + 3).trim() };
    }
    return { en: s, tl: '' };
}

/** Isang halaga lang para sa preview / padala — tugma sa resolve sa PHP. */
function resolvePositionForLanguage(raw, lang) {
    const sp = splitPositionEnTl(raw);
    const L = normalizeIndigencyLanguage(lang);
    if (L === 'tagalog') {
        return (sp.tl || sp.en || '').trim();
    }
    return (sp.en || sp.tl || '').trim();
}

/** Ilipat ang nakikitang posisyon sa tamang hidden field batay sa wika. */
function commitIndigencyPositionDisplayToHidden(lang) {
    const L = normalizeIndigencyLanguage(lang);
    const display = document.getElementById('indigencyPositionDisplay');
    const enH = document.getElementById('indigencyPositionEn');
    const tlH = document.getElementById('indigencyPositionTl');
    if (!display || !enH || !tlH) return;
    const v = (display.value || '').trim();
    if (L === 'tagalog') {
        tlH.value = v;
    } else {
        enH.value = v;
    }
}

/** Ipakita ang EN o TL sa isang textbox depende sa Document Language. */
function syncIndigencyPositionDisplayFromHidden() {
    const lang = normalizeIndigencyLanguage(
        document.getElementById('indigencyLanguage')?.value || selectedIndigencyLanguage || 'english'
    );
    const enH = document.getElementById('indigencyPositionEn');
    const tlH = document.getElementById('indigencyPositionTl');
    const disp = document.getElementById('indigencyPositionDisplay');
    if (!disp || !enH || !tlH) return;
    const en = (enH.value || '').trim();
    const tl = (tlH.value || '').trim();
    disp.value = lang === 'tagalog' ? (tl || en) : (en || tl);
}

/** Itakda ang para_kay / position inputs mula sa request (DB). */
function applyIndigencyOfficialFieldsFromRequest(requestData) {
    const pk = (requestData.para_kay || '').trim();
    const pos = (requestData.position || '').trim();
    const pkEl = document.getElementById('indigencyParaKay');
    const enH = document.getElementById('indigencyPositionEn');
    const tlH = document.getElementById('indigencyPositionTl');
    if (pkEl) pkEl.value = pk;
    const split = splitPositionEnTl(pos);
    if (enH) enH.value = split.en || pos;
    if (tlH) tlH.value = split.tl;
}

/** Label Position/Posisyon — isang field lang ang nakikita. */
function updateIndigencyPositionBilingualDisplay() {
    const lang = (document.getElementById('indigencyLanguage')?.value || selectedIndigencyLanguage || 'english');
    const customMain = document.getElementById('indigencyPositionCustomMainLabel');
    const hallLbl = document.getElementById('indigencyHallAddressLabel');

    const posLabelText = lang === 'tagalog' ? 'Posisyon:' : 'Position:';

    if (hallLbl) {
        hallLbl.textContent = 'Hall Address:';
    }
    if (customMain) {
        customMain.textContent = posLabelText;
    }

    syncIndigencyPositionDisplayFromHidden();
    refreshIndigencyPreviewAddressee();
}

function refreshIndigencyPreviewAddressee() {
    const block = document.getElementById('indigencyPreviewAddresseeBlock');
    const linePk = document.getElementById('indigencyPreviewParaKayLine');
    const linePos = document.getElementById('indigencyPreviewPositionLine');
    const lineHall = document.getElementById('indigencyPreviewHallLine');
    const lblPos = document.getElementById('indigencyPreviewPositionLabel');
    if (!block || !linePk || !linePos || !lineHall) return;

    const lang = normalizeIndigencyLanguage(
        document.getElementById('indigencyLanguage')?.value || selectedIndigencyLanguage || 'english'
    );
    const p = collectIndigencyOfficialPayload();
    const posDisplay = resolvePositionForLanguage(p.position, lang);

    linePk.textContent = (p.para_kay || '').trim() || '—';
    linePos.textContent = (posDisplay || '').trim() || '—';
    lineHall.textContent = (p.hall_address || '').trim() || '—';
    if (lblPos) {
        lblPos.textContent = lang === 'tagalog' ? 'Posisyon:' : 'Position:';
    }
}

// Function to populate the Indigency process form
function populateIndigencyProcessForm(requestData, opts = {}) {
    // Store the request data globally for language switching
    currentIndigencyRequestData = requestData;

    unlockIndigencyAddresseeFields();

    if (opts.preserveUiLanguage) {
        const langSel = document.getElementById('indigencyLanguage');
        if (langSel) {
            selectedIndigencyLanguage = langSel.value;
        }
    } else {
        const langRaw = String(requestData.document_language || '').toLowerCase();
        if (langRaw === 'tagalog' || langRaw === 'english') {
            selectedIndigencyLanguage = langRaw;
            const langSel = document.getElementById('indigencyLanguage');
            if (langSel) langSel.value = langRaw;
        } else {
            selectedIndigencyLanguage = 'english';
            const langSel = document.getElementById('indigencyLanguage');
            if (langSel) langSel.value = 'english';
        }
    }
    
    // Personal Information - individual name fields
    const firstName = (requestData.givenname || 'NO FIRST NAME').toUpperCase();
    const middleName = (requestData.middlename || '').toUpperCase();
    const lastName = (requestData.surname || 'NO LAST NAME').toUpperCase();
    
    // Populate individual name fields
    const firstNameElement = document.getElementById('indigProcessFirstName');
    const middleNameElement = document.getElementById('indigProcessMiddleName');
    const lastNameElement = document.getElementById('indigProcessLastName');
    const firstNameElement2 = document.getElementById('indigProcessFirstName2');
    const middleNameElement2 = document.getElementById('indigProcessMiddleName2');
    const lastNameElement2 = document.getElementById('indigProcessLastName2');
    
    if (firstNameElement) firstNameElement.value = firstName;
    if (middleNameElement) middleNameElement.value = middleName;
    if (lastNameElement) lastNameElement.value = lastName;
    if (firstNameElement2) firstNameElement2.value = firstName;
    if (middleNameElement2) middleNameElement2.value = middleName;
    if (lastNameElement2) lastNameElement2.value = lastName;
    
    // Address
    const addressElement = document.getElementById('indigProcessAddress');
    if (addressElement) {
        addressElement.value = (requestData.address || 'NO ADDRESS PROVIDED').toUpperCase();
    }
    
    // Purpose
    const purposeElement = document.getElementById('indigProcessPurpose');
    const purposeElement2 = document.getElementById('indigProcessPurpose2');
    const purposeValue = (requestData.purpose || 'NOT SPECIFIED').toUpperCase();
    
    if (purposeElement) {
        purposeElement.value = purposeValue;
    }
    if (purposeElement2) {
        purposeElement2.value = purposeValue;
    }
    
    // Current date for certificate - format based on selected language
    const currentDate = new Date();
    let certificateDate;
    
    if (selectedIndigencyLanguage === 'tagalog') {
        // Tagalog format: "ika-22 ng Oktubre taong 2025"
        const day = currentDate.getDate();
        const year = currentDate.getFullYear();
        const monthNamesTagalog = [
            'Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo',
            'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'
        ];
        const month = monthNamesTagalog[currentDate.getMonth()];
        certificateDate = `ika-${day} ng ${month} taong ${year}`;
    } else {
        // English format: "OCTOBER 22, 2025"
        certificateDate = currentDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }).toUpperCase();
    }
    
    const dateElement = document.getElementById('indigProcessCertificateDate');
    if (dateElement) {
        dateElement.value = certificateDate;
    }
    
    // Also update fullName fields if they exist (for English version)
    const fullNameElement = document.getElementById('indigProcessFullName');
    const fullNameElement2 = document.getElementById('indigProcessFullName2');
    const fullName = `${firstName} ${middleName} ${lastName}`.trim();
    if (fullNameElement) fullNameElement.value = fullName;
    if (fullNameElement2) fullNameElement2.value = fullName;

    const hall = (requestData.hall_address || '').trim();
    if (!opts.preserveOfficialFields) {
        applyIndigencyOfficialFieldsFromRequest(requestData);
        const hallEl = document.getElementById('indigencyHallAddress');
        if (hallEl) hallEl.value = hall;
    }
    syncIndigencyOfficialFieldsUI();
    applyIndigencyAddresseeLockState(requestData);
    
    // Store the request ID for later use
    document.getElementById('indigencyProcessForm').setAttribute('data-request-id', requestData.id);
}

// Function to show the COE process modal
function showCoeProcessModal() {
    const modal = document.getElementById('coeProcessModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    // Scroll to top of modal body - use setTimeout to ensure modal is fully rendered
    setTimeout(() => {
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.scrollTop = 0;
        }
        // Also scroll the modal dialog container if it has scroll
        const modalDialog = modal.querySelector('.request-details-dialog');
        if (modalDialog) {
            modalDialog.scrollTop = 0;
        }
    }, 10);
}

// Function to populate and show the Indigency process form modal
function populateAndShowIndigencyProcessForm(requestData, viewOnly = false) {
    // Set the request ID in the modal dataset
    const modal = document.getElementById('indigencyProcessModal');
    modal.dataset.requestId = requestData.id;
    
    // Hide generate button if view-only
    const generateBtn = modal.querySelector('.btn-primary, .primary-btn');
    if (generateBtn) {
        generateBtn.style.display = viewOnly ? 'none' : 'inline-flex';
    }
    
    // Populate the form with the request data
    populateIndigencyProcessForm(requestData);
    
    // Show the modal
    showIndigencyProcessModal();
}

// Function to close the COE process modal
function closeCoeProcessModal() {
    const modal = document.getElementById('coeProcessModal');
    const form = document.getElementById('coeProcessForm');
    
    // Close the modal
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    
    // Reset the form to its initial state
    if (form) {
        form.reset();
    }
    
    // Clear any processing state or loading indicators
    const generateBtn = document.querySelector('#coeProcessModal .btn-primary');
    if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate COE';
    }
    
    // Just reset the button and clear the stored request ID
    if (currentProcessingButton) {
        resetCurrentProcessingButton();
    }
    currentCoeRequestId = null;
    
    console.log('COE process modal cancelled and reset');
}

// Function to handle done action for COE
async function doneCoeProcess() {
    const modal = document.getElementById('coeProcessModal');
    const requestId = modal.dataset.requestId;
    
    if (!requestId) {
        showStatusModal('error', 'Error', 'No request ID found');
        return;
    }
    
    try {
        // Show loading modal
        showStatusModal('info', 'Processing Request', 'Generating COE document...');
        
        // Generate COE document first
        const formData = new FormData();
        formData.append('requestId', requestId);
        
        const response = await fetch('php/generateCoeDocument.php', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to generate COE document');
        }
        
        // Get download URL from response
        const downloadUrl = result.downloadUrl;
    
    // Update status to Processing with process_at timestamp
        await updateRequestStatus(requestId, 'Processing', 'coe');
        
        // Close the process form modal
        closeCoeProcessModal();
        
        // Show success modal with auto-close and auto-download
        showStatusModal('success', 'Request Processed', 'Request has been processed.', downloadUrl, true, 2000);
        
        // Refresh the requests to update status
        loadAllDocumentRequests();
        
        // Switch to Checked tab and reload processing requests
        setTimeout(() => {
            switchRequestTab('checked');
        }, 2500); // Wait a bit longer for auto-close to complete
        
    } catch (error) {
        console.error('Error processing COE:', error);
        showStatusModal('error', 'Failed', 'Failed to process request: ' + error.message);
    }
}

// Function to show the Indigency process modal
function showIndigencyProcessModal() {
    const modal = document.getElementById('indigencyProcessModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    
    // Add event listener for language selection when modal is shown
    const languageSelect = document.getElementById('indigencyLanguage');
    if (languageSelect && !languageSelect.hasAttribute('data-listener-added')) {
        const onIndigencyLanguagePick = function () {
            commitIndigencyPositionDisplayToHidden(selectedIndigencyLanguage);
            const v = normalizeIndigencyLanguage(this.value);
            selectedIndigencyLanguage = v;
            if (this.value !== v) {
                this.value = v;
            }
            console.log('Language changed to:', v);
            updateIndigencyDocumentPreview(v);
        };
        languageSelect.addEventListener('change', onIndigencyLanguagePick);
        languageSelect.addEventListener('input', onIndigencyLanguagePick);
        languageSelect.setAttribute('data-listener-added', 'true');
    }

    // Add listener for para_kay auto-fill
    const pkInput = document.getElementById('indigencyParaKay');
    if (pkInput && !pkInput.hasAttribute('data-autofill-listener')) {
        pkInput.addEventListener('input', function() {
            const val = this.value.trim();
            const posEn = document.getElementById('indigencyPositionEn');
            const posTl = document.getElementById('indigencyPositionTl');
            const hall = document.getElementById('indigencyHallAddress');
            const lang = document.getElementById('indigencyLanguage')?.value || 'english';

            const officials = {
                'Igg. DANIEL FERNANDO': {
                    en: 'GOVERNOR',
                    tl: 'GOBERNADOR',
                    hall: 'PROVINCIAL CAPITOL, MALOLOS CITY, BULACAN'
                },
                'Igg. ADOR PLEYTO': {
                    en: 'CONGRESSMAN',
                    tl: 'KONGRESISTA',
                    hall: 'HOUSE OF REPRESENTATIVES, QUEZON CITY'
                },
                'Igg. MARIA ELENA GERMAR': {
                    en: 'MAYOR',
                    tl: 'MAYORA',
                    hall: 'MUNICIPAL HALL, NORZAGARAY, BULACAN'
                }
            };

            if (officials[val]) {
                if (posEn) posEn.value = officials[val].en;
                if (posTl) posTl.value = officials[val].tl;
                if (hall) hall.value = officials[val].hall;
                syncIndigencyPositionDisplayFromHidden();
                refreshIndigencyPreviewAddressee();
            }
        });
        pkInput.setAttribute('data-autofill-listener', 'true');
    }

    const indigencyProcForm = document.getElementById('indigencyProcessForm');
    if (indigencyProcForm && !indigencyProcForm.hasAttribute('data-preview-refresh-listener')) {
        const bumpIndigencyPreview = () => {
            refreshIndigencyPreviewAddressee();
        };
        indigencyProcForm.addEventListener('input', bumpIndigencyPreview);
        indigencyProcForm.addEventListener('change', bumpIndigencyPreview);
        indigencyProcForm.setAttribute('data-preview-refresh-listener', 'true');
    }
    
    // Update document preview to match current language selection
    updateIndigencyDocumentPreview(selectedIndigencyLanguage);
    
    // Scroll to top of modal body - use setTimeout to ensure modal is fully rendered
    setTimeout(() => {
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.scrollTop = 0;
        }
        // Also scroll the modal dialog container if it has scroll
        const modalDialog = modal.querySelector('.request-details-dialog');
        if (modalDialog) {
            modalDialog.scrollTop = 0;
        }
    }, 10);
}

// Function to update document preview based on selected language
function updateIndigencyDocumentPreview(language) {
    const lang = language === 'tagalog' ? 'tagalog' : 'english';
    selectedIndigencyLanguage = lang;
    const langSel = document.getElementById('indigencyLanguage');
    if (langSel) {
        langSel.value = lang;
    }

    const titleEl = document.getElementById('indigencyCertificatePreviewTitle');
    if (titleEl) {
        titleEl.textContent = lang === 'tagalog' ? 'SERTIPIKO NG KAWALANG-KALAKHAN' : 'CERTIFICATE OF INDIGENCY';
    }

    const certificateText = document.querySelector('#indigencyProcessModal .certificate-text');
    if (!certificateText) return;

    if (lang === 'tagalog') {
        // Tagalog template — dapat tumugma sa indigency_tagalog.docx
        certificateText.innerHTML = `
            <p>PARA SA KINAUUKULAN:</p>
            
            <p>Ito ay pagpapatunay na si <strong><input type="text" id="indigProcessFirstName" class="form-input inline-input" value="{{first_name}}"> <input type="text" id="indigProcessMiddleName" class="form-input inline-input" value="{{middle_name}}"> <input type="text" id="indigProcessLastName" class="form-input inline-input" value="{{last_name}}"></strong>, 
            lehitimong naninirahan sa Sityo <input type="text" id="indigProcessAddress" class="form-input inline-input" value="{{address}}"> ay nabibilang sa isang mahirap na pamilya at walang sapat na kakayahan upang suportahan ang kanilang pangangailangan para sa <input type="text" id="indigProcessPurpose" class="form-input inline-input" value="{{purpose}}">.</p>
            
            <p>Dahil dito sa kahilingan ni <strong><input type="text" id="indigProcessFirstName2" class="form-input inline-input" value="{{first_name}}"> <input type="text" id="indigProcessMiddleName2" class="form-input inline-input" value="{{middle_name}}"> <input type="text" id="indigProcessLastName2" class="form-input inline-input" value="{{last_name}}"></strong> 
            ay ipinagkakaloob ko ang <strong>PAGPAPATUNAY</strong> na ito upang magamit sa <input type="text" id="indigProcessPurpose2" class="form-input inline-input" value="{{purpose}}">.</p>
            
            <p>Inisyu ito noong <input type="text" id="indigProcessCertificateDate" class="form-input inline-input" value="{{date_issued}}"> 
            sa Bigte, Norzagaray, Bulacan.</p>
        `;
    } else {
        certificateText.innerHTML = `
            <p>TO WHOM IT MAY CONCERN:</p>
            
            <p>THIS IS TO CERTIFY that <strong><input type="text" id="indigProcessFirstName" class="form-input inline-input" value="{{first_name}}"> <input type="text" id="indigProcessMiddleName" class="form-input inline-input" value="{{middle_name}}"> <input type="text" id="indigProcessLastName" class="form-input inline-input" value="{{last_name}}"></strong>, 
            of legal age, residents of Sitio <input type="text" id="indigProcessAddress" class="form-input inline-input" value="{{address}}"> 
            belongs to one of many indigent families of this barangay. The income of this family is barely enough to meet day to day needs.</p>
            
            <p>This certification is being issued upon the request of <strong><input type="text" id="indigProcessFirstName2" class="form-input inline-input" value="{{first_name}}"> <input type="text" id="indigProcessMiddleName2" class="form-input inline-input" value="{{middle_name}}"> <input type="text" id="indigProcessLastName2" class="form-input inline-input" value="{{last_name}}"></strong> 
            to apply for <input type="text" id="indigProcessPurpose2" class="form-input inline-input" value="{{purpose}}">.</p>
            
            <p>Issued this <input type="text" id="indigProcessCertificateDate" class="form-input inline-input" value="{{date_issued}}"> 
            at Bigte, Norzagaray, Bulacan.</p>
        `;
    }

    if (currentIndigencyRequestData) {
        populateIndigencyProcessForm(currentIndigencyRequestData, {
            preserveUiLanguage: true,
            preserveOfficialFields: true
        });
    } else {
        refreshIndigencyPreviewAddressee();
        updateIndigencyPositionBilingualDisplay();
    }

    console.log('Document preview updated to:', lang);
}

// Function to close the Indigency process modal without resetting language
function closeIndigencyProcessModalWithoutReset() {
    const modal = document.getElementById('indigencyProcessModal');
    
    // Close the modal
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    
    // Clear any processing state or loading indicators
    const generateBtn = document.querySelector('#indigencyProcessModal .primary-btn');
    if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-print"></i> PRINT';
    }

    console.log('Indigency process modal closed without reset');
}

// Global function to reset the current processing button
function resetCurrentProcessingButton() {
    if (currentProcessingButton) {
        currentProcessingButton.disabled = false;
        currentProcessingButton.innerHTML = '<i class="fas fa-cog"></i> Process';
        currentProcessingButton.style.opacity = '1';
        console.log('Reset specific button:', currentProcessingButton);
        
        // Clear the reference
        currentProcessingButton = null;
    } else {
        console.warn('No specific button found to reset');
    }
}

// Function to handle done action - updates status to Processing with process_at
async function doneIndigencyProcess() {
    const modal = document.getElementById('indigencyProcessModal');
    const requestId = modal.dataset.requestId;
    
    if (!requestId) {
        showStatusModal('error', 'Error', 'No request ID found');
        return;
    }
    
    const langSelDone = document.getElementById('indigencyLanguage');
    const selectedLanguage = normalizeIndigencyLanguage(langSelDone ? langSelDone.value : selectedIndigencyLanguage);
    selectedIndigencyLanguage = selectedLanguage;
    
    try {
        // Show loading modal
        showStatusModal('info', 'Processing Request', 'Generating indigency document...');
        
        // Generate indigency document first
        const formData = new FormData();
        formData.append('requestId', requestId);
        formData.append('language', selectedLanguage);
        appendIndigencyOfficialFieldsToFormData(formData);
        
        const response = await fetch('php/generateIndigencyDocument.php', {
            method: 'POST',
            body: formData
        });
        
        const result = await parseJsonFromResponse(response);
        
        // Get download URL from response
        const downloadUrl = result.downloadUrl;
    
    // Update status to Processing with process_at timestamp
        await updateRequestStatus(requestId, 'Processing', 'indigency');
        
        // Close the process form modal
        closeIndigencyProcessModalWithoutReset();
        
        // Show success modal with auto-close and auto-download
        showStatusModal('success', 'Request Processed', 'Request has been processed.', downloadUrl, true, 2000);
        
        // Refresh the requests to update status
        loadAllDocumentRequests();
        
        // Switch to Checked tab and reload processing requests
        setTimeout(() => {
            switchRequestTab('checked');
        }, 2500); // Wait a bit longer for auto-close to complete
        
    } catch (error) {
        console.error('Error processing indigency:', error);
        showStatusModal('error', 'Failed', 'Failed to process request: ' + error.message);
    }
}

// Function to handle cancel action - closes both process modal and loading modal
function cancelIndigencyProcess() {
    // Close any loading modal first
    closeStatusModal();
    
    // Close the process modal without resetting language
    closeIndigencyProcessModalWithoutReset();
    
    // Add a small delay to ensure modals are closed before resetting button
    setTimeout(() => {
        // Reset only the specific button that was clicked
        resetCurrentProcessingButton();
        // Clear the stored request ID
        currentIndigencyRequestId = null;
    }, 100);
    
    console.log('Indigency process cancelled');
}

// Function to close the Indigency process modal
function closeIndigencyProcessModal() {
    const modal = document.getElementById('indigencyProcessModal');
    const form = document.getElementById('indigencyProcessForm');
    
    // Close the modal
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    
    // Reset the form to its initial state
    if (form) {
        // Reset language selection to default
        const languageSelect = document.getElementById('indigencyLanguage');
        if (languageSelect) {
            languageSelect.value = 'english';
        }
        
        // Reset global language variable
        selectedIndigencyLanguage = 'english';
        
        // Clear any form data that might have been modified
        form.reset();
        syncIndigencyOfficialFieldsUI();
        unlockIndigencyAddresseeFields();
    }
    
    // Clear any processing state or loading indicators
    const generateBtn = document.querySelector('#indigencyProcessModal .primary-btn');
    if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-print"></i> PRINT';
    }

    console.log('Indigency process modal cancelled and reset');
}

// Global variable to store selected language
let selectedIndigencyLanguage = 'english';

function collectIndigencyOfficialPayload() {
    commitIndigencyPositionDisplayToHidden(
        document.getElementById('indigencyLanguage')?.value || selectedIndigencyLanguage || 'english'
    );
    const hallEl = document.getElementById('indigencyHallAddress');
    const hall = (hallEl && hallEl.value ? hallEl.value : '').trim();
    const pk = (document.getElementById('indigencyParaKay')?.value || '').trim();
    const posEn = (document.getElementById('indigencyPositionEn')?.value || '').trim();
    const posTl = (document.getElementById('indigencyPositionTl')?.value || '').trim();
    const positionStorage = (posEn && posTl) ? `${posEn} / ${posTl}` : (posEn || posTl);
    return { para_kay: pk, position: positionStorage, hall_address: hall };
}

function syncIndigencyOfficialFieldsUI() {
    updateIndigencyPositionBilingualDisplay();
}

function appendIndigencyOfficialFieldsToFormData(formData) {
    const p = collectIndigencyOfficialPayload();
    formData.append('para_kay', p.para_kay);
    formData.append('position', p.position);
    formData.append('hall_address', p.hall_address);
}

// Global variable to store the current processing button
let currentProcessingButton = null;

// Global variable to store current request data
let currentIndigencyRequestData = null;

// Global variable to store current COE request data
let currentCoeRequestData = null;

// Global variable to store current Clearance request ID for cancel handling
let currentClearanceRequestId = null;

// Global variable to store current Indigency request ID for cancel handling
let currentIndigencyRequestId = null;

// Global variable to store current COE request ID for cancel handling
let currentCoeRequestId = null;

// Global variable to store current Barangay ID request ID for cancel handling
let currentBarangayIdRequestId = null;

// Function to generate COE document from process form
async function generateCoeFromForm() {
    try {
        const form = document.getElementById('coeProcessForm');
        const requestId = form.getAttribute('data-request-id');
        
        if (!requestId) {
            throw new Error('No request ID found');
        }

        // Show loading modal
        showStatusModal('info', 'Generating Document', 'Creating Certificate of Employment from template...');
        
        // Close the process form modal
        closeCoeProcessModal();
        
        // Send request to generate document
        const formData = new FormData();
        formData.append('requestId', requestId);
        formData.append('documentType', 'coe');
        
        const response = await fetch('php/generateCoeDocument.php', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Close the loading modal
            closeStatusModal();
            
            // Clear stored request ID
            currentCoeRequestId = null;
            
            // Reload the requests immediately to update the status
            loadAllDocumentRequests();
            
            // Show success modal with download option
            showCoeGeneratedModal(result);
            
            // Reset the PRINT button immediately to allow multiple prints
            resetCurrentProcessingButton();
            
            // Auto-scroll to Processing section after a short delay
            setTimeout(() => {
                const processingSection = document.querySelector('#coe-processing-cards').closest('.status-section');
                if (processingSection) {
                    processingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 2000);
        } else {
            throw new Error(result.error || 'Failed to generate document');
        }
    } catch (error) {
        console.error('Error generating COE document:', error);
        showStatusModal('error', 'Generation Failed', 'Failed to generate COE document: ' + error.message);
    }
}

// Function to generate Indigency document from process form
async function generateIndigencyFromForm() {
    try {
        const form = document.getElementById('indigencyProcessForm');
        const requestId = form.getAttribute('data-request-id');
        
        if (!requestId) {
            throw new Error('No request ID found');
        }

        const langSelGen = document.getElementById('indigencyLanguage');
        const selectedLanguage = normalizeIndigencyLanguage(langSelGen ? langSelGen.value : selectedIndigencyLanguage);
        selectedIndigencyLanguage = selectedLanguage;
        console.log('Using stored language:', selectedLanguage);

        // Show loading modal
        showStatusModal('info', 'Generating Document', 'Creating Indigency certificate from template...');
        
        // Close the process form modal without resetting language
        closeIndigencyProcessModalWithoutReset();
        
        // Send request to generate document
        const formData = new FormData();
        formData.append('requestId', requestId);
        formData.append('documentType', 'indigency');
        formData.append('language', selectedLanguage);
        appendIndigencyOfficialFieldsToFormData(formData);
        
        const response = await fetch('php/generateIndigencyDocument.php', {
            method: 'POST',
            body: formData
        });
        
        const result = await parseJsonFromResponse(response);
        
        if (result.success) {
            // Close the loading modal
            closeStatusModal();
            
            // Clear stored request ID
            currentIndigencyRequestId = null;
            
            // Reload the requests immediately to update the status
            loadAllDocumentRequests();
            
            // Show success modal with download option
            showIndigencyGeneratedModal(result);
            
            // Reset the PRINT button immediately to allow multiple prints
            resetCurrentProcessingButton();
            
            // Auto-scroll to Processing section after a short delay
            setTimeout(() => {
                const processingSection = document.querySelector('#indigency-processing-cards').closest('.status-section');
                if (processingSection) {
                    processingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 2000);
        } else {
            console.error('Indigency generation failed:', result);
            throw new Error(result.error || 'Failed to generate document');
        }
    } catch (error) {
        console.error('Error generating Indigency document:', error);
        
        // Show detailed error information
        let errorMessage = 'Failed to generate Indigency document: ' + error.message;
        if (error.response) {
            errorMessage += '\nResponse status: ' + error.response.status;
        }
        
        showStatusModal('error', 'Generation Failed', errorMessage);
    }
}

// Function to show COE generated modal with download option
function showCoeGeneratedModal(result) {
    // Show modal that auto-closes
    Swal.fire({
        icon: 'success',
        title: 'Request Processed',
        html: `<p>The request has been processed.</p>`,
        width: '400px',
        padding: '1.5rem',
        showCloseButton: false,
        showConfirmButton: false,
        buttonsStyling: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        allowEnterKey: false,
        timer: 2000,
        timerProgressBar: false,
        customClass: {
            popup: 'swal2-small-popup',
            title: 'swal2-small-title',
            content: 'swal2-small-content'
        },
        didOpen: () => {
            // Hide the actions container completely
            const actionsContainer = document.querySelector('.swal2-actions');
            if (actionsContainer) {
                actionsContainer.style.display = 'none';
            }
        },
        didClose: () => {
            // Auto-download when modal closes
            if (result.downloadUrl) {
                const downloadLink = document.createElement('a');
                downloadLink.href = result.downloadUrl;
                downloadLink.download = result.filename;
                downloadLink.style.display = 'none';
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            }
        }
    });
}

// Function to show Indigency generated modal with download option
function showIndigencyGeneratedModal(result) {
    // Show modal that auto-closes
    Swal.fire({
        icon: 'success',
        title: 'Request Processed',
        html: `<p>The request has been processed.</p>`,
        width: '400px',
        padding: '1.5rem',
        showCloseButton: false,
        showConfirmButton: false,
        buttonsStyling: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        allowEnterKey: false,
        timer: 2000,
        timerProgressBar: false,
        customClass: {
            popup: 'swal2-small-popup',
            title: 'swal2-small-title',
            content: 'swal2-small-content'
        },
        didOpen: () => {
            // Hide the actions container completely
            const actionsContainer = document.querySelector('.swal2-actions');
            if (actionsContainer) {
                actionsContainer.style.display = 'none';
            }
        },
        didClose: () => {
            // Auto-download when modal closes
            if (result.downloadUrl) {
                const downloadLink = document.createElement('a');
                downloadLink.href = result.downloadUrl;
                downloadLink.download = result.filename;
                downloadLink.style.display = 'none';
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            }
        }
    });
}


function finishRequest(requestId) {
    showStatusModal('success', 'Request Completed', `Request ${requestId} has been completed.`);
    updateRequestStatus(requestId, 'Finished');
}

function downloadDocument(requestId) {
    showStatusModal('info', 'Download Started', `Download for request ${requestId} has been initiated.`);
}

function viewRequest(requestId) {
    const requestData = getRequestData(requestId);
    if (requestData) {
        // Show appropriate modal based on document type
        if (requestData.type === 'Certification') {
            // Set certification modal data
            // Date label removed
            showCertificationDetailsModal();
        } else if (requestData.type === 'Certificate of Employment') {
            // Set COE modal data
            // Date label removed
            showCoeDetailsModal();
        } else if (requestData.type === 'Clearance') {
            // Set clearance modal data
            // Date label removed
            showClearanceDetailsModal();
        } else if (requestData.type === 'Indigency') {
            // Set indigency modal data
            // Date label removed
            showIndigencyDetailsModal();
        } else {
            // Clear all form inputs first for other document types
            clearAllFormInputs();
            // Set title only, no form population
            document.getElementById('requestDetailsTitle').textContent = `${requestData.type.toUpperCase()} FORM`;
            // Date label removed
            // Show the regular modal
            showRequestDetailsModal();
        }
    } else {
        showStatusModal('error', 'Error', 'Request details not found.');
    }
}

function clearAllFormInputs() {
    // Clear all text inputs
    const textInputs = [
        'detailFirstName', 'detailMiddleName', 'detailLastName', 
        'detailAddress', 'detailBirthDate', 'detailBirthPlace', 
        'detailGuardianName', 'detailEmergencyContact', 'detailResidency'
    ];
    
    textInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = '';
            element.placeholder = '';
        }
    });
    
    // Clear radio buttons
    const radioButtons = [
        'civilSingle', 'civilMarried', 'civilWidow',
        'genderMale', 'genderFemale',
        'censusedYes', 'censusedNo'
    ];
    
    radioButtons.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.checked = false;
    });
    
    // Reset select dropdowns to empty state
    const selectElements = [
        'detailNationality', 'detailPurpose'
    ];
    
    selectElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.selectedIndex = -1;
            element.value = '';
        }
    });
    
    // Clear header request date
    // Date label removed
    
    // Clear title
    const title = document.getElementById('requestDetailsTitle');
    if (title) title.textContent = '';
}

function populateCertificationForm(requestData) {
    // Set title
    document.getElementById('requestDetailsTitle').textContent = 'CERTIFICATION FORM';
    
    // Show/hide sections for certification form
    document.getElementById('nationalitySection').style.display = 'none';
    document.getElementById('purposeSection').style.display = 'block';
    document.getElementById('emergencySection').style.display = 'none';
    document.getElementById('residencySection').style.display = 'none';
    
    // Personal Information
    const nameParts = requestData.name.split(' ');
    document.getElementById('detailFirstName').value = nameParts[0] || '';
    document.getElementById('detailMiddleName').value = nameParts[1] || '';
    document.getElementById('detailLastName').value = nameParts[2] || nameParts[1] || '';
    document.getElementById('detailAddress').value = requestData.address || 'Not specified';
    document.getElementById('detailBirthDate').value = requestData.birthDate || 'Not specified';
    document.getElementById('detailBirthPlace').value = requestData.birthPlace || 'Not specified';
    
    // Gender
    const gender = requestData.gender || 'Male';
    document.getElementById(`gender${gender}`).checked = true;
    
    // Civil Status
    const civilStatus = requestData.civilStatus || 'Single';
    document.getElementById(`civil${civilStatus}`).checked = true;
    
    // Purpose dropdown
    document.getElementById('detailPurpose').value = requestData.purpose || 'Fencing Permit';
    
    // Header request date
    // Date label removed
}

function populateBarangayIdForm(requestData) {
    // Set title
    document.getElementById('requestDetailsTitle').textContent = `${requestData.type.toUpperCase()} FORM`;
    
    // Show/hide sections for barangay ID form
    document.getElementById('nationalitySection').style.display = 'block';
    document.getElementById('purposeSection').style.display = 'none';
    document.getElementById('emergencySection').style.display = 'block';
    document.getElementById('residencySection').style.display = 'block';
    if (document.getElementById('censusSection')) {
        document.getElementById('censusSection').style.display = 'block';
    }
    
    // Personal Information
    const nameParts = requestData.name ? requestData.name.split(' ') : [];
    document.getElementById('detailFirstName').value = nameParts[0] || requestData.firstName || '';
    document.getElementById('detailMiddleName').value = nameParts[1] || requestData.middleName || '';
    document.getElementById('detailLastName').value = nameParts[2] || nameParts[1] || requestData.lastName || '';
    document.getElementById('detailBirthDate').value = requestData.birthDate || 'Not specified';
    document.getElementById('detailBirthPlace').value = requestData.birthPlace || 'Not specified';
    document.getElementById('detailAddress').value = requestData.address || 'Not specified';
    
    
    // Civil Status - handle case-insensitive matching
    const civilStatus = (requestData.civilStatus || requestData.civil_status || 'Single').toString();
    // Capitalize first letter for matching
    const civilStatusFormatted = civilStatus.charAt(0).toUpperCase() + civilStatus.slice(1).toLowerCase();
    console.log('Setting Civil Status:', civilStatusFormatted);
    
    // Uncheck all civil status radio buttons first
    ['Single', 'Married', 'Widow'].forEach(status => {
        const el = document.getElementById(`civil${status}`);
        if (el) el.checked = false;
    });
    
    // Check the matching one
    const civilElement = document.getElementById(`civil${civilStatusFormatted}`);
    if (civilElement) {
        civilElement.checked = true;
        console.log('Civil Status radio button checked:', civilStatusFormatted);
    } else {
        console.warn('Civil Status radio button not found for:', civilStatusFormatted);
    }
    
    // Gender - handle case-insensitive matching
    const gender = (requestData.gender || 'Male').toString();
    // Capitalize first letter for matching
    const genderFormatted = gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
    console.log('Setting Gender:', genderFormatted);
    
    // Uncheck all gender radio buttons first
    ['Male', 'Female'].forEach(g => {
        const el = document.getElementById(`gender${g}`);
        if (el) el.checked = false;
    });
    
    // Check the matching one
    const genderElement = document.getElementById(`gender${genderFormatted}`);
    if (genderElement) {
        genderElement.checked = true;
        console.log('Gender radio button checked:', genderFormatted);
    } else {
        console.warn('Gender radio button not found for:', genderFormatted);
    }
    
    // Nationality
    const nationalityElement = document.getElementById('detailNationality');
    if (nationalityElement) {
        nationalityElement.value = requestData.nationality || 'Filipino';
    }
    
    // Emergency Contact
    const emergencyParts = (requestData.emergencyContact || '').split(' - ');
    document.getElementById('detailGuardianName').value = emergencyParts[0] || requestData.emergencyContactName || 'Not specified';
    document.getElementById('detailEmergencyContact').value = emergencyParts[1] || requestData.contact || requestData.emergencyContactNumber || 'Not specified';
    
    // Residency
    document.getElementById('detailResidency').value = requestData.residency || 'Not specified';
    
    // Header request date
    // Date label removed
}


//Partially disabled for print functionality//


/*function printDocument(requestId) {
    const requestData = getRequestData(requestId);
    if (requestData) {
        showStatusModal('info', 'Print Started', `Printing document for request ${requestId}...`);
        // In a real application, this would trigger the actual print functionality
        setTimeout(() => {
            showStatusModal('success', 'Print Complete', `Document for request ${requestId} has been sent to printer.`, null, true, 2000);
        }, 2000);
    } else {
        showStatusModal('error', 'Error', 'Request details not found.');
    }
}*/

// Helper Functions
function getRequestData(requestId) {
    const sampleData = {
        'BRG-001': { id: 'BRG-001', type: 'Barangay ID', name: 'Beejay DA Castillo', contact: '09123456789', purpose: 'Employment purposes', status: 'New', date: 'Dec 15, 2024', address: ' Upper, Barangay Bigte', emergencyContact: 'Sharie C. Castillo - 09123456788', birthDate: 'February 29, 1990', civilStatus: 'Single', gender: 'Male', nationality: 'Filipino', residency: '20 years' },
        'BRG-002': { id: 'BRG-002', type: 'Barangay ID', name: 'Maria Santos', contact: '09876543210', purpose: 'Government transaction', status: 'Processing', date: 'Dec 14, 2024', priority: 'Medium', address: '456 Oak Avenue, Barangay Bigte', emergencyContact: 'Jose Santos - 09876543211', birthDate: 'March 22, 1985', civilStatus: 'Married', gender: 'Female', nationality: 'Filipino', residency: '3 years' },
        'BRG-003': { id: 'BRG-003', type: 'Barangay ID', name: 'Pedro Reyes', contact: '09111222333', purpose: 'Personal identification', status: 'Finished', date: 'Dec 13, 2024', priority: 'Low', address: '789 Pine Street, Barangay Bigte', emergencyContact: 'Ana Reyes - 09111222334', birthDate: 'July 8, 1975', civilStatus: 'Widow', gender: 'Male', nationality: 'Filipino', residency: '10 years' },
        
        'CERT-001': { id: 'CERT-001', type: 'Certification', name: 'Ana Garcia', contact: '09444555666', purpose: 'Scholarship Application', status: 'New', date: 'Dec 15, 2024', priority: 'High', address: '321 Elm Street, Barangay Bigte', emergencyContact: 'Carlos Garcia - 09444555667', birthDate: 'February 10, 1995', birthPlace: 'Manila, Philippines', civilStatus: 'Single', gender: 'Female' },
        'CERT-002': { id: 'CERT-002', type: 'Certification', name: 'Luis Mendoza', contact: '09777888999', purpose: 'Fencing Permit', status: 'Processing', date: 'Dec 14, 2024', priority: 'Medium', address: '654 Maple Drive, Barangay Bigte', emergencyContact: 'Sofia Mendoza - 09777889000', birthDate: 'June 5, 1988', birthPlace: 'Quezon City, Philippines', civilStatus: 'Married', gender: 'Male' },
        'CERT-003': { id: 'CERT-003', type: 'Certification', name: 'Carmen Lopez', contact: '09000111222', purpose: 'Business Permit', status: 'Finished', date: 'Dec 13, 2024', priority: 'Low', address: '987 Cedar Lane, Barangay Bigte', emergencyContact: 'Miguel Lopez - 09000111223', birthDate: 'September 12, 1980', birthPlace: 'Cebu City, Philippines', civilStatus: 'Married', gender: 'Female' },
       
        'COE-001': { id: 'COE-001', type: 'Certificate of Employment', name: 'Roberto Silva', contact: '09333444555', purpose: 'New job application', status: 'New', date: 'Dec 15, 2024', priority: 'High', address: '147 Birch Road, Barangay Bigte', emergencyContact: 'Elena Silva - 09333444556' },
        'COE-002': { id: 'COE-002', type: 'Certificate of Employment', name: 'Elena Torres', contact: '09666777888', purpose: 'Employment verification', status: 'Processing', date: 'Dec 14, 2024', priority: 'Medium', address: '258 Willow Way, Barangay Bigte', emergencyContact: 'Antonio Torres - 09666777889' },
        'COE-003': { id: 'COE-003', type: 'Certificate of Employment', name: 'Miguel Cruz', contact: '09999888777', purpose: 'Documentation', status: 'Finished', date: 'Dec 13, 2024', priority: 'Low', address: '369 Spruce Street, Barangay Bigte', emergencyContact: 'Isabella Cruz - 09999888778' },
       
        'CLR-001': { id: 'CLR-001', type: 'Clearance', name: 'Isabella Ramos', contact: '09222333444', purpose: 'Business permit', status: 'New', date: 'Dec 15, 2024', priority: 'High', address: '741 Poplar Avenue, Barangay Bigte', emergencyContact: 'Fernando Ramos - 09222333445' },
        'CLR-002': { id: 'CLR-002', type: 'Clearance', name: 'Fernando Morales', contact: '09555666777', purpose: 'Background check', status: 'Processing', date: 'Dec 14, 2024', priority: 'Medium', address: '852 Ash Boulevard, Barangay Bigte', emergencyContact: 'Patricia Morales - 09555666778' },
        'CLR-003': { id: 'CLR-003', type: 'Clearance', name: 'Patricia Herrera', contact: '09888999000', purpose: 'Legal clearance', status: 'Finished', date: 'Dec 13, 2024', priority: 'Low', address: '963 Hickory Court, Barangay Bigte', emergencyContact: 'Roberto Herrera - 09888999001' },
        
        'IND-001': { id: 'IND-001', type: 'Indigency', name: 'Rosa Martinez', contact: '09111222333', purpose: 'Medical assistance', status: 'New', date: 'Dec 15, 2024', priority: 'High', address: '159 Walnut Street, Barangay Bigte', emergencyContact: 'Carlos Martinez - 09111222334' },
        'IND-002': { id: 'IND-002', type: 'Indigency', name: 'Carlos Vega', contact: '09444555666', purpose: 'Financial aid', status: 'Processing', date: 'Dec 14, 2024', priority: 'Medium', address: '357 Chestnut Lane, Barangay Bigte', emergencyContact: 'Lucia Vega - 09444555667' },
        'IND-003': { id: 'IND-003', type: 'Indigency', name: 'Lucia Fernandez', contact: '09777888999', purpose: 'Social services', status: 'Finished', date: 'Dec 13, 2024', priority: 'Low', address: '468 Sycamore Drive, Barangay Bigte', emergencyContact: 'Rosa Fernandez - 09777889000' }
    };
    
    return sampleData[requestId] || null;
}

// Function to update request status in database
async function updateRequestStatus(requestId, newStatus, tableName = 'barangay_id') {
    console.log(`Updating request ${requestId} status to: ${newStatus} in table: ${tableName}`);
    
    try {
        const response = await fetch('php/reqDocu.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update_status',
                table: tableName,
                id: requestId,
                status: newStatus
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log(`Successfully updated request ${requestId} to ${newStatus}`);
            return result;
        } else {
            throw new Error(result.message || 'Failed to update status');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        throw error;
    }
}

/** Turn relative upload paths into absolute URLs so downloads work from any entry page. */
function resolveDownloadUrl(url) {
    if (!url) return url;
    const s = String(url).trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('/')) return window.location.origin + s;
    try {
        return new URL(s, window.location.href).href;
    } catch (e) {
        return s;
    }
}

// Utility function to trigger a file download
function triggerFileDownload(url, filename = null) {
    if (!url) return;
    
    const downloadLink = document.createElement('a');
    downloadLink.href = resolveDownloadUrl(url);
    if (filename) {
        downloadLink.download = filename;
    } else {
        downloadLink.download = url.split('/').pop() || 'document.docx';
    }
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// Status Modal Functions
/** Parse JSON from fetch; avoids opaque "Unexpected token '<'" when PHP outputs HTML warnings. */
async function parseJsonFromResponse(response) {
    const text = await response.text();
    const trimmed = text.trim();
    if (!trimmed) {
        throw new Error('Empty response (HTTP ' + response.status + ')');
    }
    let data;
    try {
        data = JSON.parse(trimmed);
    } catch (e) {
        const plain = trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200);
        throw new Error(plain || 'Server returned invalid JSON (check PHP error log)');
    }
    if (data && data.success === false) {
        throw new Error(data.error || data.message || 'Request failed');
    }
    if (!response.ok) {
        throw new Error((data && (data.error || data.message)) || ('HTTP ' + response.status));
    }
    return data;
}

function showStatusModal(type, title, message, downloadUrl = null, autoClose = false, autoCloseDelay = 2000) {
    // Use SweetAlert2 instead of custom modal
    let iconType = 'success';
    let iconColor = '#87CEEB';
    
    switch(type) {
        case 'success': 
            iconType = 'success';
            iconColor = '#87CEEB';
            break;
        case 'error': 
            iconType = 'error';
            iconColor = '#dc3545';
            break;
        case 'warning': 
            iconType = 'warning';
            iconColor = '#ffc107';
            break;
        default: 
            iconType = 'info';
            iconColor = '#17a2b8';
    }
    
    const swalConfig = {
        icon: iconType,
        title: title,
        text: message,
        width: '400px',
        padding: '1.5rem',
        showCloseButton: false,
        showConfirmButton: !autoClose, // Hide button if auto-close
        confirmButtonText: downloadUrl ? 'Download' : 'OK',
        confirmButtonColor: iconColor,
        allowOutsideClick: false,
        allowEscapeKey: false,
        timer: autoClose ? autoCloseDelay : undefined,
        timerProgressBar: autoClose,
        customClass: {
            popup: 'swal2-small-popup' + (autoClose ? '' : ' swal2-confirm-dialog'),
            title: 'swal2-small-title',
            content: 'swal2-small-content'
        }
    };
    
    if (downloadUrl && type === 'success') {
        const absoluteUrl = resolveDownloadUrl(downloadUrl);
        if (autoClose) {
            // Auto-download after closing
            swalConfig.didClose = () => {
                // Auto-download the document
                triggerFileDownload(absoluteUrl);
            };
        } else {
            swalConfig.preConfirm = () => {
                window.open(absoluteUrl, '_blank');
            };
        }
    }
    
    Swal.fire(swalConfig);
}

function closeStatusModal() {
    // Close SweetAlert2 if open
    if (Swal.isVisible()) {
        Swal.close();
    }
}

// Function to show Barangay ID generated modal with download option
function showBarangayIdGeneratedModal(result) {
    // Show modal that auto-closes
    Swal.fire({
        icon: 'success',
        title: 'Request Processed',
        html: `<p>The request has been processed.</p>`,
        width: '400px',
        padding: '1.5rem',
        showCloseButton: false,
        showConfirmButton: false,
        buttonsStyling: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        allowEnterKey: false,
        timer: 2000,
        timerProgressBar: false,
        customClass: {
            popup: 'swal2-small-popup',
            title: 'swal2-small-title',
            content: 'swal2-small-content'
        },
        didOpen: () => {
            // Hide the actions container completely
            const actionsContainer = document.querySelector('.swal2-actions');
            if (actionsContainer) {
                actionsContainer.style.display = 'none';
            }
        },
        didClose: () => {
            // Auto-download when modal closes
            if (result.downloadUrl) {
                const downloadLink = document.createElement('a');
                downloadLink.href = result.downloadUrl;
                downloadLink.download = result.filename;
                downloadLink.style.display = 'none';
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            }
        }
    });
}

// Function to show Certification generated modal with download option
function showCertificationGeneratedModal(result) {
    // Show modal that auto-closes
    Swal.fire({
        icon: 'success',
        title: 'Request Processed',
        html: `<p>The request has been processed.</p>`,
        width: '400px',
        padding: '1.5rem',
        showCloseButton: false,
        showConfirmButton: false,
        buttonsStyling: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        allowEnterKey: false,
        timer: 2000,
        timerProgressBar: false,
        customClass: {
            popup: 'swal2-small-popup',
            title: 'swal2-small-title',
            content: 'swal2-small-content'
        },
        didOpen: () => {
            // Hide the actions container completely
            const actionsContainer = document.querySelector('.swal2-actions');
            if (actionsContainer) {
                actionsContainer.style.display = 'none';
            }
        },
        didClose: () => {
            // Auto-download when modal closes
            const primaryUrl = result.download_url || result.downloadUrl;
            const secondaryUrl = result.download_url_2 || result.downloadUrl2;

            if (primaryUrl) {
                const primaryFilename = result.filename || (primaryUrl.split('/').pop() || 'certification.docx');
                triggerFileDownload(primaryUrl, primaryFilename);
            }

            // For jobseeker, backend returns a second URL (OATH); download it right after the first
            if (secondaryUrl) {
                const secondaryFilename = result.filename_2 || result.filename2 || (secondaryUrl.split('/').pop() || 'document.docx');
                setTimeout(() => {
                    triggerFileDownload(secondaryUrl, secondaryFilename);
                }, 500);
            }
        }
    });
}

// Function to show Clearance generated modal with download option
function showClearanceGeneratedModal(result) {
    // Show modal that auto-closes
    Swal.fire({
        icon: 'success',
        title: 'Request Processed',
        html: `<p>The request has been processed.</p>`,
        width: '400px',
        padding: '1.5rem',
        showCloseButton: false,
        showConfirmButton: false,
        buttonsStyling: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        allowEnterKey: false,
        timer: 2000,
        timerProgressBar: false,
        customClass: {
            popup: 'swal2-small-popup',
            title: 'swal2-small-title',
            content: 'swal2-small-content'
        },
        didOpen: () => {
            // Hide the actions container completely
            const actionsContainer = document.querySelector('.swal2-actions');
            if (actionsContainer) {
                actionsContainer.style.display = 'none';
            }
        },
        didClose: () => {
            // Auto-download when modal closes
            const downloadUrl = result.download_url || result.downloadUrl;
            if (downloadUrl) {
                const downloadLink = document.createElement('a');
                downloadLink.href = downloadUrl;
                downloadLink.download = result.filename || 'clearance.pdf';
                downloadLink.style.display = 'none';
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            }
        }
    });
}

// Request Details Modal Functions
function showRequestDetailsModal() {
    const modal = document.getElementById('requestDetailsModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    // Scroll to top of modal body - use setTimeout to ensure modal is fully rendered
    setTimeout(() => {
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.scrollTop = 0;
        }
        // Also scroll the modal dialog container if it has scroll
        const modalDialog = modal.querySelector('.request-details-dialog');
        if (modalDialog) {
            modalDialog.scrollTop = 0;
        }
    }, 10);
}

function closeRequestDetailsModal() {
    const modal = document.getElementById('requestDetailsModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    
    // Clear all form inputs when closing modal
    clearAllFormInputs();
}

// Certification Modal Functions
function showCertificationDetailsModal() {
    const modal = document.getElementById('certificationDetailsModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    // Scroll to top of modal body - use setTimeout to ensure modal is fully rendered
    setTimeout(() => {
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.scrollTop = 0;
        }
        // Also scroll the modal dialog container if it has scroll
        const modalDialog = modal.querySelector('.request-details-dialog');
        if (modalDialog) {
            modalDialog.scrollTop = 0;
        }
    }, 10);
}

function closeCertificationDetailsModal() {
    const modal = document.getElementById('certificationDetailsModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

// Certificate of Employment Modal Functions
function showCoeDetailsModal() {
    const modal = document.getElementById('coeDetailsModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    // Scroll to top of modal body - use setTimeout to ensure modal is fully rendered
    setTimeout(() => {
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.scrollTop = 0;
        }
        // Also scroll the modal dialog container if it has scroll
        const modalDialog = modal.querySelector('.request-details-dialog');
        if (modalDialog) {
            modalDialog.scrollTop = 0;
        }
    }, 10);
}

function closeCoeDetailsModal() {
    const modal = document.getElementById('coeDetailsModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

function printCoeDocument() {
    showStatusModal('info', 'Print Started', 'Printing Certificate of Employment for Hon. Rosemarie M. Capal...');
    // In a real application, this would trigger the actual print functionality
    setTimeout(() => {
        showStatusModal('success', 'Print Complete', 'Certificate of Employment has been sent to printer.', null, true, 2000);
    }, 2000);
    closeCoeDetailsModal();
}

// Clearance Modal Functions
function showClearanceDetailsModal() {
    const modal = document.getElementById('clearanceDetailsModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    // Scroll to top of modal body - use setTimeout to ensure modal is fully rendered
    setTimeout(() => {
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.scrollTop = 0;
        }
        // Also scroll the modal dialog container if it has scroll
        const modalDialog = modal.querySelector('.request-details-dialog');
        if (modalDialog) {
            modalDialog.scrollTop = 0;
        }
    }, 10);
}

function closeClearanceDetailsModal() {
    const modal = document.getElementById('clearanceDetailsModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

function printClearanceDocument() {
    showStatusModal('info', 'Print Started', 'Printing Clearance document for Juan Santos Dela Cruz...');
    // In a real application, this would trigger the actual print functionality
    setTimeout(() => {
        showStatusModal('success', 'Print Complete', 'Clearance document has been sent to printer.', null, true, 2000);
    }, 2000);
    closeClearanceDetailsModal();
}

// Indigency Modal Functions
function showIndigencyDetailsModal() {
    const modal = document.getElementById('indigencyDetailsModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    // Scroll to top of modal body - use setTimeout to ensure modal is fully rendered
    setTimeout(() => {
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.scrollTop = 0;
        }
        // Also scroll the modal dialog container if it has scroll
        const modalDialog = modal.querySelector('.request-details-dialog');
        if (modalDialog) {
            modalDialog.scrollTop = 0;
        }
    }, 10);
}

function closeIndigencyDetailsModal() {
    const modal = document.getElementById('indigencyDetailsModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

function printIndigencyDocument() {
    showStatusModal('info', 'Print Started', 'Printing Indigency document for Maria Santos Garcia...');
    // In a real application, this would trigger the actual print functionality
    setTimeout(() => {
        showStatusModal('success', 'Print Complete', 'Indigency document has been sent to printer.', null, true, 2000);
    }, 2000);
    closeIndigencyDetailsModal();
}


// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize nav counts to 0 while loading
    document.getElementById('barangay-id-count').textContent = '0';
    document.getElementById('certification-count').textContent = '0';
    document.getElementById('coe-count').textContent = '0';
    document.getElementById('clearance-count').textContent = '0';
    document.getElementById('indigency-count').textContent = '0';
    document.getElementById('total-requests').textContent = '0';
    
    // Hide Print Multiple button initially (New tab is active by default)
    const printMultipleBtn = document.getElementById('printMultipleBtn');
    if (printMultipleBtn) {
        printMultipleBtn.style.display = 'none';
    }
    
    // Close dropdowns and modals when clicking outside
    document.addEventListener('click', function(e) {
        const adminDropdown = document.getElementById('adminDropdown');
        const adminProfile = document.getElementById('adminProfile');
        
        if (adminDropdown && adminDropdown.classList.contains('show')) {
            if (!(adminProfile.contains(e.target) || adminDropdown.contains(e.target))) {
                closeAdminDropdown();
            }
        }
    });
    
    // Close modals with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAdminDropdown();
            closeStatusModal();
            closeRequestDetailsModal();
            closeCertificationDetailsModal();
            closeCoeDetailsModal();
            closeClearanceDetailsModal();
            closeIndigencyDetailsModal();
            closeBarangayIdProcessModal();
            closeIndigencyProcessModal();
            closeCoeProcessModal();
        }
    });
    
    
    // Notification bell
    const notificationBell = document.getElementById('notificationBell');
    if (notificationBell) {
        notificationBell.addEventListener('click', function() {
            showStatusModal('info', 'Notifications', 'Notification system will be implemented here.');
        });
    }

		// Load all document requests from backend API
		loadAllDocumentRequests();
});


// Fetch and render all document forms from backend
async function loadAllDocumentRequests() {
	try {
		console.log('Fetching all document requests...');
		
		// Fetch all document types in parallel
		const [barangayIdData, certificationData, coeData, clearanceData, indigencyData] = await Promise.all([
			fetchDocumentRequests('barangay_id'),
			fetchDocumentRequests('certification'),
			fetchDocumentRequests('coe'),
			fetchDocumentRequests('clearance'),
			fetchDocumentRequests('indigency')
		]);
		
		console.log('Barangay ID forms:', barangayIdData.length);
		console.log('Certification forms:', certificationData.length);
		console.log('COE forms:', coeData.length);
		console.log('Clearance forms:', clearanceData.length);
		console.log('Indigency forms:', indigencyData.length);
		
		// Render all document types
		renderBarangayIdCards(barangayIdData);
		renderCertificationCards(certificationData);
		renderCoeCards(coeData);
		renderClearanceCards(clearanceData);
		renderIndigencyCards(indigencyData);
		
		// Update all counts
		updateAllCounts(barangayIdData, certificationData, coeData, clearanceData, indigencyData);
		
		// Re-enable selection mode if it was active
		setTimeout(() => {
			if (printMultipleMode) {
				enableCardSelection();
			}
		}, 100);
	} catch (err) {
		console.error('Failed to load document forms:', err);
		showStatusModal('error', 'Database Error', 'Failed to load document requests: ' + err.message);
	}
}

// Generic function to fetch document requests by table type
async function fetchDocumentRequests(tableType) {
	try {
		console.log(`Fetching ${tableType} requests...`);
		const response = await fetch(`php/reqDocu.php?table=${tableType}`, { cache: 'no-store' });
		
		const text = await response.text();
		console.log(`Raw response length for ${tableType}:`, text.length);
		
		// Handle empty responses
		if (text.length === 0) {
			console.log(`Empty response for ${tableType}, returning empty array`);
			return [];
		}
		
		let data;
		try { 
			data = JSON.parse(text); 
		} catch (e) { 
			console.error(`JSON Parse Error for ${tableType}:`, e);
			console.error('Full response:', text);
			console.log(`Returning empty array for ${tableType} due to parse error`);
			return []; // Return empty array instead of throwing error
		}
		
		if (!response.ok) {
			if (data.error) {
				throw new Error(`Server Error for ${tableType}: ${data.error}`);
			} else {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
		}
		
		if (data.error) {
			throw new Error(`Server error for ${tableType}: ${data.error}`);
		}
		
		if (!data || !Array.isArray(data.requests)) {
			console.log(`No requests array found for ${tableType}, data:`, data);
			return [];
		}

		console.log(`Loaded ${tableType} requests:`, data.requests.length);
		return data.requests;
	} catch (err) {
		console.error(`Failed to fetch ${tableType} requests:`, err);
		return []; // Return empty array on error
	}
}

// Fetch and render Barangay ID forms from backend (kept for backward compatibility)
async function loadBarangayIdRequests() {
	try {
		console.log('Fetching Barangay ID requests...');
		const response = await fetch('php/reqDocu.php?table=barangay_id', { cache: 'no-store' });
		
		const text = await response.text();
		console.log('Raw response length:', text.length);
		console.log('Raw response (first 500 chars):', text.substring(0, 500));
		
		let data;
		try { 
			data = JSON.parse(text); 
		} catch (e) { 
			console.error('JSON Parse Error:', e);
			console.error('Full response:', text);
			throw new Error('Invalid JSON from server: ' + text.substring(0, 200)); 
		}
		
		if (!response.ok) {
			if (data.error) {
				throw new Error(`Server Error: ${data.error}`);
			} else {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
		}
		
		if (data.error) {
			throw new Error('Server error: ' + data.error);
		}
		
		if (!data || !Array.isArray(data.requests)) {
			console.log('No requests array found, data:', data);
			return;
		}

		console.log('Loaded requests:', data.requests.length);
		const barangayIdForms = data.requests.filter(r => r.documentType === 'BARANGAY_ID');
		const certificationForms = data.requests.filter(r => r.documentType === 'CERTIFICATION');
		const coeForms = data.requests.filter(r => r.documentType === 'COE');
		const clearanceForms = data.requests.filter(r => r.documentType === 'CLEARANCE');
		const indigencyForms = data.requests.filter(r => r.documentType === 'INDIGENCY');
		console.log('Barangay ID forms:', barangayIdForms.length);
		console.log('Certification forms:', certificationForms.length);
		console.log('COE forms:', coeForms.length);
		console.log('Clearance forms:', clearanceForms.length);
		console.log('Indigency forms:', indigencyForms.length);
		
		renderBarangayIdCards(barangayIdForms);
		renderCertificationCards(certificationForms);
		renderCoeCards(coeForms);
		renderClearanceCards(clearanceForms);
		renderIndigencyCards(indigencyForms);
		
		// Apply access control after rendering
		setTimeout(() => {
			if (typeof window.AccessControl !== 'undefined') {
				applyAccessControlToCards();
			}
		}, 100);
		
		// Update all counts
		updateAllCounts(barangayIdForms, certificationForms, coeForms, clearanceForms, indigencyForms);
	} catch (err) {
		console.error('Failed to load Barangay ID forms:', err);
		// Show error in UI
		showStatusModal('error', 'Database Error', 'Failed to load Barangay ID requests: ' + err.message);
	}
}

function renderBarangayIdCards(forms) {
	const newContainer = document.getElementById('barangayId-new-cards');
	const processingContainer = document.getElementById('barangayId-processing-cards');

	// Clear existing static examples
	if (newContainer) newContainer.innerHTML = '';
	if (processingContainer) processingContainer.innerHTML = '';

	let counts = { New: 0, Processing: 0 };

	// If no forms from database, show message
	if (!forms || forms.length === 0) {
		console.log('No Barangay ID forms found in database');
		if (newContainer) {
			newContainer.innerHTML = '<div class="no-data-message">No Barangay ID requests found</div>';
		}
		// Update counts to 0
		const newCount = document.getElementById('barangayId-new');
		const processingCount = document.getElementById('barangayId-processing');
		if (newCount) newCount.textContent = '0';
		if (processingCount) processingCount.textContent = '0';
		return;
	}

	// Debug: Log all forms and their statuses
	console.log('=== BARANGAY ID REQUESTS DEBUG ===');
	console.log('Total forms loaded:', forms.length);
	forms.forEach((row, index) => {
		console.log(`Request ${index + 1}: ${row.givenname} ${row.surname} - Status: ${row.status || 'New'}`);
	});
	console.log('=== END DEBUG ===');

	// Cache the data
	newRequestsCache.barangay_id = forms.filter(r => (r.status || 'New') === 'New');
	checkedRequestsCache.barangay_id = forms.filter(r => (r.status || 'New') === 'Processing');
	
	// Get sort order (use global sort order by default)
	const sortOrder = globalSortOrder;
	
	// Split and sort based on sort order
	const newForms = newRequestsCache.barangay_id.slice().sort((a,b)=>{
		const timeA = getSortTimestamp(a);
		const timeB = getSortTimestamp(b);
		return sortOrder === 'latest' ? timeB - timeA : timeA - timeB;
	});
	const processingForms = checkedRequestsCache.barangay_id.slice().sort((a,b)=>{
		const timeA = getSortTimestamp(a);
		const timeB = getSortTimestamp(b);
		return sortOrder === 'latest' ? timeB - timeA : timeA - timeB;
	});

	[newForms, processingForms].forEach(group => group.forEach((row, index) => {
		const status = (row.status || 'New');
		counts[status] = (counts[status] || 0) + 1;

		const fullName = [row.givenname, row.middlename, row.surname].filter(Boolean).join(' ');
		const submitted = formatDisplayDate(row.submittedAt || row.submitted_at);

		const card = document.createElement('div');
		card.className = 'request-card';
		
		// Add data attributes for print multiple
		card.dataset.requestId = row.id || row.requestId || row.request_id;
		card.dataset.documentType = 'barangay-id';
		
		// Add status-specific styling
		if (status === 'Processing') {
			card.classList.add('processing-card');
		}
		
		// Format process_at datetime if available
		const processedAt = row.processAt ? formatDisplayDate(row.processAt) + ' at ' + formatTime(row.processAt) : '';
		const purpose = row.purpose || '';
		const requestTime = formatTime(row.submittedAt || row.submitted_at);
		
		card.innerHTML = `
			<div class=\"card-header\">
				<span class=\"request-date\">${submitted} • ${requestTime}</span>
			</div>
			<div class=\"card-body\">
				<h5>${escapeHtml(fullName || 'No Name')}</h5>
				<p>${escapeHtml(row.address || 'No Address')}</p>
				${purpose ? `<div class=\"card-purpose\">${escapeHtml(purpose)}</div>` : ''}
				<div class=\"card-meta\">
                    ${processedAt ? `<span class=\"processed-time\">Checked at: ${processedAt}</span>` : ''}
				</div>
			</div>
			<div class=\"card-actions\">
				<button class=\"btn-action view-btn\"><i class=\"fas fa-eye\"></i> View</button>
				${status === 'New' ? '<button class=\"btn-action process-btn\" disabled><i class=\"fas fa-cog\"></i> Process</button>' : ''}
				${status === 'Processing' ? '<button class=\"btn-action finish-btn\" disabled><i class=\"fas fa-check\"></i> Finish</button>' : ''}
			</div>
		`;

		// Attach view handler to open details modal filled with this row
		const viewBtn = card.querySelector('.view-btn');
		if (viewBtn) {
			viewBtn.addEventListener('click', () => populateAndShowBarangayIdModal(row));
		}

		// Mark buttons as admin-visible if user is admin
		const isAdmin = window.AccessControl && window.AccessControl.data && window.AccessControl.data.position && window.AccessControl.data.position.toLowerCase() === 'admin';
		
		// Attach process handler for Barangay ID requests
		const processBtn = card.querySelector('.process-btn');
		if (processBtn) {
			processBtn.disabled = false; // Enable the button
			// Always make process-btn visible
			processBtn.classList.add('admin-visible');
			// Remove any inline styles that might hide the button
			processBtn.style.removeProperty('visibility');
			processBtn.style.removeProperty('pointer-events');
			// Explicitly set visible styles with !important
			processBtn.style.setProperty('visibility', 'visible', 'important');
			processBtn.style.setProperty('display', 'inline-flex', 'important');
			processBtn.style.setProperty('pointer-events', 'auto', 'important');
			if (isAdmin) {
				// Additional admin styling if needed
			}
			processBtn.addEventListener('click', () => {
				if (!row.id) {
					console.error('No ID found for row:', row);
					showStatusModal('error', 'Processing Failed', 'No valid request ID found. Please refresh the page and try again.');
					return;
				}
				
				// Store reference to the clicked button and request ID
				currentProcessingButton = processBtn;
				currentBarangayIdRequestId = row.id;
				
				// Show the process form modal with the request data
				populateAndShowBarangayIdProcessForm(row);
			});
		}
		
		// Mark finish-btn as admin-visible if user is admin
		const finishBtn = card.querySelector('.finish-btn');
		if (finishBtn && isAdmin) {
			finishBtn.classList.add('admin-visible');
			// Remove any inline styles that might hide the button
			finishBtn.style.removeProperty('visibility');
			finishBtn.style.removeProperty('pointer-events');
			// Explicitly set visible styles with !important
			finishBtn.style.setProperty('visibility', 'visible', 'important');
			finishBtn.style.setProperty('display', 'inline-flex', 'important');
			finishBtn.style.setProperty('pointer-events', 'auto', 'important');
		}

		if (status === 'New' && newContainer) newContainer.appendChild(card);
		else if (status === 'Processing' && processingContainer) processingContainer.appendChild(card);
	}));

	// Update counts
	const newCount = document.getElementById('barangayId-new');
	const processingCount = document.getElementById('barangayId-processing');
	if (newCount) newCount.textContent = counts.New || 0;
	if (processingCount) processingCount.textContent = counts.Processing || 0;
	
	// Update sidebar count
	if (document.getElementById('new-tab')?.classList.contains('active')) {
		updateSidebarCountsForNew();
	}
	
	// Debug: Log the status breakdown
	console.log('Barangay ID Status Breakdown:', {
		New: counts.New || 0,
		Processing: counts.Processing || 0,
		Total: (counts.New || 0) + (counts.Processing || 0)
	});
}

function populateAndShowBarangayIdModal(row) {
	// Use the details modal format for viewing (same as other document types)
	// Map row data to format expected by populateBarangayIdForm
	const mappedData = {
		type: 'BARANGAY ID',
		firstName: row.givenname || '',
		middleName: row.middlename || '',
		lastName: row.surname || '',
		name: `${row.givenname || ''} ${row.middlename || ''} ${row.surname || ''}`.trim(),
		birthDate: formatDisplayDate(row.birthday),
		birthPlace: row.birthplace || row.birthPlace || row.birth_place || 'Not specified',
		address: row.address || '',
		civilStatus: row.civilStatus || row.civil_status || 'Single',
		gender: row.gender || 'Male',
		nationality: row.citizenship || row.nationality || 'Filipino',
		validId: row.validId || row.valid_id || '',
		emergencyContact: row.emergency_contact || row.emergencyContact || '',
		emergencyContactName: row.emergency_contact_name || row.emergencyContactName || '',
		contact: row.contact || row.phone || row.emergencyContactNumber || '',
		emergencyContactNumber: row.emergency_contact_number || row.emergencyContactNumber || '',
		residency: row.residency || row.residency_years || row.residencyDuration || ''
	};
	
	console.log('Barangay ID Modal Data:', mappedData);
	
	populateBarangayIdForm(mappedData);
	
	// Fetch and display ID image
	fetchAndDisplayIdImage('barangay_id', row.id, 'idImagePlaceholder');
	
	showRequestDetailsModal();
}

// Function to show Barangay ID process form in view-only mode (for view button)
function populateAndShowBarangayIdProcessFormViewOnly(requestData) {
    // Set the request ID in the modal dataset
    const modal = document.getElementById('barangayIdProcessModal');
    modal.dataset.requestId = requestData.id;
    
    // Hide the Generate ID button for view-only mode
    const generateBtn = document.querySelector('#barangayIdProcessModal .btn-primary');
    if (generateBtn) {
        generateBtn.style.display = 'none';
    }
    
    // Make BID input read-only for view mode
    const bidInput = document.getElementById('processBidNumber');
    if (bidInput) {
        bidInput.readOnly = true;
        bidInput.style.backgroundColor = '#f8f9fa';
        bidInput.style.cursor = 'not-allowed';
    }
    
    // Update modal title to indicate view mode
    const modalTitle = modal.querySelector('.header-left h3');
    if (modalTitle) {
        modalTitle.textContent = 'BARANGAY ID FORM';
    }
    const dateLabel = modal.querySelector('.date-label');
    if (dateLabel) {
        dateLabel.textContent = 'View Details';
    }
    
    // Populate the form with the request data
    populateBarangayIdProcessForm(requestData);
    
    // Show the process form modal
    showBarangayIdProcessModal();
}

function renderCertificationCards(forms) {
	const newContainer = document.getElementById('certification-new-cards');
	const processingContainer = document.getElementById('certification-processing-cards');

	// Clear existing static examples
	if (newContainer) newContainer.innerHTML = '';
	if (processingContainer) processingContainer.innerHTML = '';

	let counts = { New: 0, Processing: 0 };

	// If no forms from database, show message
	if (!forms || forms.length === 0) {
		console.log('No Certification forms found in database');
		if (newContainer) {
			newContainer.innerHTML = '<div class="no-data-message">No Certification requests found</div>';
		}
		// Update counts to 0
		const newCount = document.getElementById('certification-new');
		const processingCount = document.getElementById('certification-processing');
		if (newCount) newCount.textContent = '0';
		if (processingCount) processingCount.textContent = '0';
		return;
	}

	const newForms = forms.filter(r => (r.status || 'New') === 'New').sort((a,b)=>{
		const timeA = getSortTimestamp(a);
		const timeB = getSortTimestamp(b);
		return timeB - timeA; // Latest first
	});
	const processingForms = forms.filter(r => (r.status || 'New') === 'Processing').sort((a,b)=>{
		const timeA = getSortTimestamp(a);
		const timeB = getSortTimestamp(b);
		return timeB - timeA; // Latest first
	});

	[newForms, processingForms].forEach(group => group.forEach((row, index) => {
		const status = (row.status || 'New');
		counts[status] = (counts[status] || 0) + 1;

		const fullName = [row.givenname, row.middlename, row.surname].filter(Boolean).join(' ');
		const submitted = formatDisplayDate(row.submittedAt);
		const purpose = row.purpose || '';
		const requestTime = formatTime(row.submittedAt || row.submitted_at);
		
		// Format process_at datetime if available
		const processedAt = row.processAt ? formatDisplayDate(row.processAt) + ' at ' + formatTime(row.processAt) : '';
		// Format finish_at datetime if available
		const finishedAt = row.finishAt ? formatDisplayDate(row.finishAt) + ' at ' + formatTime(row.finishAt) : '';

		const card = document.createElement('div');
		card.className = 'request-card';
		
		// Add data attributes for print multiple
		card.dataset.requestId = row.id || row.certification_id || row.certificationId;
		card.dataset.documentType = 'certification';
		
		card.innerHTML = `
			<div class=\"card-header\">
				<span class=\"request-date\">${submitted} • ${requestTime}</span>
			</div>
			<div class=\"card-body\">
				<h5>${escapeHtml(fullName || 'No Name')}</h5>
				<p>${escapeHtml(row.address || 'No Address')}</p>
				${purpose ? `<div class=\"card-purpose\">${escapeHtml(purpose)}</div>` : ''}
				<div class=\"card-meta\">
                    ${processedAt && status === 'Processing' ? `<span class=\"processed-time\">Checked at: ${processedAt}</span>` : ''}
                    ${finishedAt && status === 'Finished' ? `<span class=\"done-time\">Finished at: ${finishedAt}</span>` : ''}
				</div>
			</div>
			<div class=\"card-actions\">
				<button class=\"btn-action view-btn\"><i class=\"fas fa-eye\"></i> View</button>
				${status === 'New' ? '<button class=\"btn-action process-btn\" disabled><i class=\"fas fa-cog\"></i> Process</button>' : ''}
				${status === 'Processing' ? '<button class=\"btn-action finish-btn\" disabled><i class=\"fas fa-check\"></i> Finish</button>' : ''}
				${status === 'Finished' ? '<button class=\"btn-action print-btn\" disabled><i class=\"fas fa-print\"></i> Print</button>' : ''}
			</div>
		`;

		// Attach view handler to open details modal filled with this row
		const viewBtn = card.querySelector('.view-btn');
		if (viewBtn) {
			viewBtn.addEventListener('click', () => populateAndShowCertificationModal(row));
		}

		// Attach process handler for Certification requests
		const processBtn = card.querySelector('.process-btn');
		if (processBtn) {
			processBtn.disabled = false; // Enable the button
			// Always make process-btn visible
			processBtn.classList.add('admin-visible');
			processBtn.style.removeProperty('visibility');
			processBtn.style.removeProperty('pointer-events');
			processBtn.style.setProperty('visibility', 'visible', 'important');
			processBtn.style.setProperty('display', 'inline-flex', 'important');
			processBtn.style.setProperty('pointer-events', 'auto', 'important');
			// Mark as admin-visible if user is admin
			const isAdmin = window.AccessControl && window.AccessControl.data && window.AccessControl.data.position && window.AccessControl.data.position.toLowerCase() === 'admin';
			if (isAdmin) {
				// Additional admin styling if needed
			}
			processBtn.addEventListener('click', () => {
				if (!row.id) {
					console.error('No ID found for row:', row);
					showStatusModal('error', 'Processing Failed', 'No valid request ID found. Please refresh the page and try again.');
					return;
				}
				
				// Store reference to the clicked button and request ID
				currentProcessingButton = processBtn;
				currentCertificationRequestId = row.id;
				
				// Disable button and show processing state
				processBtn.disabled = true;
				processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
				processBtn.style.opacity = '0.6';
				
				// DO NOT update status here - it should stay as "New" or current status
				// Status will only update to "Processing" when GENERATE CERTIFICATION is clicked
				
				processCertificationRequest(row.id, row);
			});
		}

		if (status === 'New' && newContainer) newContainer.appendChild(card);
		else if (status === 'Processing' && processingContainer) processingContainer.appendChild(card);
	}));

	// Update counts
	const newCount = document.getElementById('certification-new');
	const processingCount = document.getElementById('certification-processing');
	if (newCount) newCount.textContent = counts.New || 0;
	if (processingCount) processingCount.textContent = counts.Processing || 0;
}

function populateAndShowCertificationModal(row) {
	// Personal info
	document.getElementById('certFirstName').value = row.givenname || '';
	document.getElementById('certMiddleName').value = row.middlename || '';
	document.getElementById('certLastName').value = row.surname || '';
	document.getElementById('certAddress').value = row.address || '';
	document.getElementById('certBirthDate').value = formatDisplayDate(row.birthday);
	document.getElementById('certBirthPlace').value = row.birthplace || '';

	// Civil Status
	['Single','Married'].forEach(s => {
		const el = document.getElementById('certCivil'+s);
		if (el) el.checked = (row.civilStatus || '').toUpperCase() === s.toUpperCase();
	});

	// Gender
	['Male','Female'].forEach(g => {
		const el = document.getElementById('certGender'+g);
		if (el) el.checked = (row.gender || '').toUpperCase() === g.toUpperCase();
	});

	// Purpose
	const purpose = document.getElementById('certPurpose');
	if (purpose) {
		if (row.purpose) {
			// Debug: Log the purpose value
			console.log('Setting purpose:', row.purpose);
			// Set the selected option based on the purpose value from database
			purpose.value = row.purpose;
			// Debug: Check if it was set
			console.log('Purpose after setting:', purpose.value);
			
			// If the value wasn't set (doesn't match any option), add it as a new option
			if (purpose.value !== row.purpose) {
				console.log('Purpose value not found in options, adding new option');
				const newOption = document.createElement('option');
				newOption.value = row.purpose;
				newOption.textContent = row.purpose;
				purpose.appendChild(newOption);
				purpose.value = row.purpose;
			}
		} else {
			console.log('No purpose data in row:', row);
			purpose.value = ''; // Clear the selection
		}
	} else {
		console.log('Purpose field not found');
	}

	// Header date/title
	document.getElementById('certificationDetailsTitle').textContent = 'CERTIFICATION FORM';
	// Date label removed

    // Handle ID Image (Certification)
    fetchAndDisplayIdImage('certification', row.id, 'certImagePlaceholder');

	showCertificationDetailsModal();
}

function renderCoeCards(forms) {
	const newContainer = document.getElementById('coe-new-cards');
	const processingContainer = document.getElementById('coe-processing-cards');

	// Clear existing static examples
	if (newContainer) newContainer.innerHTML = '';
	if (processingContainer) processingContainer.innerHTML = '';

	let counts = { New: 0, Processing: 0 };

	// If no forms from database, show message
	if (!forms || forms.length === 0) {
		console.log('No COE forms found in database');
		if (newContainer) {
			newContainer.innerHTML = '<div class="no-data-message">No COE requests found</div>';
		}
		// Update counts to 0
		const newCount = document.getElementById('coe-new');
		const processingCount = document.getElementById('coe-processing');
		if (newCount) newCount.textContent = '0';
		if (processingCount) processingCount.textContent = '0';
		return;
	}

	const newForms = forms.filter(r => (r.status || 'New') === 'New').sort((a,b)=>{
		const timeA = getSortTimestamp(a);
		const timeB = getSortTimestamp(b);
		return timeB - timeA; // Latest first
	});
	const processingForms = forms.filter(r => (r.status || 'New') === 'Processing').sort((a,b)=>{
		const timeA = getSortTimestamp(a);
		const timeB = getSortTimestamp(b);
		return timeB - timeA; // Latest first
	});

	[newForms, processingForms].forEach(group => group.forEach((row, index) => {
		const status = (row.status || 'New');
		counts[status] = (counts[status] || 0) + 1;

		const fullName = [row.givenname, row.middlename, row.surname].filter(Boolean).join(' ');
		const submitted = formatDisplayDate(row.submittedAt);
		const purpose = row.purpose || '';
		const requestTime = formatTime(row.submittedAt || row.submitted_at);
		
		// Format process_at datetime if available
		const processedAt = row.processAt ? formatDisplayDate(row.processAt) + ' at ' + formatTime(row.processAt) : '';
		// Format finish_at datetime if available
		const finishedAt = row.finishAt ? formatDisplayDate(row.finishAt) + ' at ' + formatTime(row.finishAt) : '';

		const card = document.createElement('div');
		card.className = 'request-card';
		
		// Add data attributes for print multiple
		card.dataset.requestId = row.id || row.coe_id || row.coeId;
		card.dataset.documentType = 'coe';
		
		card.innerHTML = `
			<div class=\"card-header\">
				<span class=\"request-date\">${submitted} • ${requestTime}</span>
			</div>
			<div class=\"card-body\">
				<h5>${escapeHtml(fullName || 'No Name')}</h5>
				<p>${escapeHtml(row.address || 'No Address')}</p>
				${purpose ? `<div class=\"card-purpose\">${escapeHtml(purpose)}</div>` : ''}
				<div class=\"card-meta\">
                    ${processedAt && status === 'Processing' ? `<span class=\"processed-time\">Checked at: ${processedAt}</span>` : ''}
                    ${finishedAt && status === 'Finished' ? `<span class=\"done-time\">Finished at: ${finishedAt}</span>` : ''}
				</div>
			</div>
			<div class=\"card-actions\">
				<button class=\"btn-action view-btn\"><i class=\"fas fa-eye\"></i> View</button>
				${status === 'New' ? '<button class=\"btn-action process-btn\" disabled><i class=\"fas fa-cog\"></i> Process</button>' : ''}
				${status === 'Processing' ? '<button class=\"btn-action finish-btn\" disabled><i class=\"fas fa-check\"></i> Finish</button>' : ''}
				${status === 'Finished' ? '<button class=\"btn-action print-btn\" disabled><i class=\"fas fa-print\"></i> Print</button>' : ''}
			</div>
		`;

		// Attach view handler to open details modal filled with this row
		const viewBtn = card.querySelector('.view-btn');
		if (viewBtn) {
			viewBtn.addEventListener('click', () => populateAndShowCoeModal(row));
		}

		// Attach process handler for COE requests
		const processBtn = card.querySelector('.process-btn');
		if (processBtn) {
			processBtn.disabled = false; // Enable the button
			// Always make process-btn visible
			processBtn.classList.add('admin-visible');
			processBtn.style.removeProperty('visibility');
			processBtn.style.removeProperty('pointer-events');
			processBtn.style.setProperty('visibility', 'visible', 'important');
			processBtn.style.setProperty('display', 'inline-flex', 'important');
			processBtn.style.setProperty('pointer-events', 'auto', 'important');
			// Mark as admin-visible if user is admin
			const isAdmin = window.AccessControl && window.AccessControl.data && window.AccessControl.data.position && window.AccessControl.data.position.toLowerCase() === 'admin';
			if (isAdmin) {
				// Additional admin styling if needed
			}
			processBtn.addEventListener('click', () => {
				if (!row.id) {
					console.error('No ID found for row:', row);
					showStatusModal('error', 'Processing Failed', 'No valid request ID found. Please refresh the page and try again.');
					return;
				}
				
				// Store reference to the clicked button and request ID
				currentProcessingButton = processBtn;
				currentCoeRequestId = row.id;
				
				// Disable button and show processing state
				processBtn.disabled = true;
				processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
				processBtn.style.opacity = '0.6';
				
				processCoeRequest(row.id);
			});
		}

		if (status === 'New' && newContainer) newContainer.appendChild(card);
		else if (status === 'Processing' && processingContainer) processingContainer.appendChild(card);
	}));

	// Update counts
	const newCount = document.getElementById('coe-new');
	const processingCount = document.getElementById('coe-processing');
	if (newCount) newCount.textContent = counts.New || 0;
	if (processingCount) processingCount.textContent = counts.Processing || 0;
}

function populateAndShowCoeModal(row) {
	// Personal info
	document.getElementById('coeFirstName').value = row.givenname || '';
	document.getElementById('coeMiddleName').value = row.middlename || '';
	document.getElementById('coeLastName').value = row.surname || '';
	document.getElementById('coeAddress').value = row.address || '';
	document.getElementById('age').value = row.age || '';

	// Civil Status
	['Single','Married','Widow','Divorced'].forEach(s => {
		const el = document.getElementById('coeCivil'+s);
		if (el) el.checked = (row.civilStatus || '').toUpperCase() === s.toUpperCase();
	});

	// Gender
	['Male','Female'].forEach(g => {
		const el = document.getElementById('coeGender'+g);
		if (el) el.checked = (row.gender || '').toUpperCase() === g.toUpperCase();
	});

	// Employment info
	console.log('Setting employment type:', row.employmentType);
	document.getElementById('coeEmploymentType').value = row.employmentType || '';
	document.getElementById('coePosition').value = row.position || '';
	document.getElementById('coeDateHired').value = formatDisplayDate(row.dateStarted);
	document.getElementById('coeMonthlySalary').value = row.monthlySalary || '';

	// Header date/title
	document.getElementById('coeDetailsTitle').textContent = 'CERTIFICATE OF EMPLOYMENT FORM';
	// Date label removed

    // Handle ID Image (COE)
    fetchAndDisplayIdImage('coe', row.id, 'coeImagePlaceholder');

	showCoeDetailsModal();
}

function renderClearanceCards(forms) {
	const newContainer = document.getElementById('clearance-new-cards');
	const processingContainer = document.getElementById('clearance-processing-cards');

	// Clear existing static examples
	if (newContainer) newContainer.innerHTML = '';
	if (processingContainer) processingContainer.innerHTML = '';

	let counts = { New: 0, Processing: 0 };

	// If no forms from database, show message
	if (!forms || forms.length === 0) {
		console.log('No Clearance forms found in database');
		if (newContainer) {
			newContainer.innerHTML = '<div class="no-data-message">No Clearance requests found</div>';
		}
		// Update counts to 0
		const newCount = document.getElementById('clearance-new');
		const processingCount = document.getElementById('clearance-processing');
		if (newCount) newCount.textContent = '0';
		if (processingCount) processingCount.textContent = '0';
		return;
	}

	const newForms = forms.filter(r => (r.status || 'New') === 'New').sort((a,b)=>{
		const timeA = getSortTimestamp(a);
		const timeB = getSortTimestamp(b);
		return timeB - timeA; // Latest first
	});
	const processingForms = forms.filter(r => (r.status || 'New') === 'Processing').sort((a,b)=>{
		const timeA = getSortTimestamp(a);
		const timeB = getSortTimestamp(b);
		return timeB - timeA; // Latest first
	});

	[newForms, processingForms].forEach(group => group.forEach((row, index) => {
		const status = (row.status || 'New');
		counts[status] = (counts[status] || 0) + 1;

		const fullName = [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ');
		const submitted = formatDisplayDate(row.submitted_at);
		const purpose = row.purpose || '';
		const requestTime = formatTime(row.submitted_at);
		
		// Format process_at datetime if available
		const processedAt = row.process_at ? formatDisplayDate(row.process_at) + ' at ' + formatTime(row.process_at) : '';
		// Format finish_at datetime if available
		const finishedAt = row.finish_at ? formatDisplayDate(row.finish_at) + ' at ' + formatTime(row.finish_at) : '';

		const card = document.createElement('div');
		card.className = 'request-card';
		
		// Add data attributes for print multiple
		card.dataset.requestId = row.id || row.clearance_id || row.clearanceId;
		card.dataset.documentType = 'clearance';
		
		card.innerHTML = `
			<div class=\"card-header\">
				<span class=\"request-date\">${submitted} • ${requestTime}</span>
			</div>
			<div class=\"card-body\">
				<h5>${escapeHtml(fullName || 'No Name')}</h5>
				<p>${escapeHtml(row.address || 'No Address')}</p>
				${purpose ? `<div class=\"card-purpose\">${escapeHtml(purpose)}</div>` : ''}
				<div class=\"card-meta\">
                    ${processedAt && status === 'Processing' ? `<span class=\"processed-time\">Checked at: ${processedAt}</span>` : ''}
                    ${finishedAt && status === 'Finished' ? `<span class=\"done-time\">Finished at: ${finishedAt}</span>` : ''}
				</div>
			</div>
			<div class=\"card-actions\">
				<button class=\"btn-action view-btn\"><i class=\"fas fa-eye\"></i> View</button>
				${status === 'New' ? '<button class=\"btn-action process-btn\" disabled><i class=\"fas fa-cog\"></i> Process</button>' : ''}
				${status === 'Processing' ? '<button class=\"btn-action finish-btn\" disabled><i class=\"fas fa-check\"></i> Finish</button>' : ''}
				${status === 'Finished' ? '<button class=\"btn-action print-btn\" disabled><i class=\"fas fa-print\"></i> Print</button>' : ''}
			</div>
		`;

		// Attach view handler to open details modal filled with this row
		const viewBtn = card.querySelector('.view-btn');
		if (viewBtn) {
			viewBtn.addEventListener('click', () => populateAndShowClearanceModal(row));
		}

		// Attach process handler for Clearance requests
		const processBtn = card.querySelector('.process-btn');
		if (processBtn) {
			processBtn.disabled = false; // Enable the button
			// Always make process-btn visible
			processBtn.classList.add('admin-visible');
			processBtn.style.removeProperty('visibility');
			processBtn.style.removeProperty('pointer-events');
			processBtn.style.setProperty('visibility', 'visible', 'important');
			processBtn.style.setProperty('display', 'inline-flex', 'important');
			processBtn.style.setProperty('pointer-events', 'auto', 'important');
			// Mark as admin-visible if user is admin
			const isAdmin = window.AccessControl && window.AccessControl.data && window.AccessControl.data.position && window.AccessControl.data.position.toLowerCase() === 'admin';
			if (isAdmin) {
				// Additional admin styling if needed
			}
			processBtn.addEventListener('click', () => {
				if (!row.id) {
					console.error('No ID found for row:', row);
					showStatusModal('error', 'Processing Failed', 'No valid request ID found. Please refresh the page and try again.');
					return;
				}
				
				// Store reference to the clicked button and request ID
				currentProcessingButton = processBtn;
				currentClearanceRequestId = row.id;
				
				// Disable button and show processing state
				processBtn.disabled = true;
				processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
				processBtn.style.opacity = '0.6';
				
				// DO NOT update status here - it should stay as "New" or current status
				// Status will only update to "Processing" when GENERATE CLEARANCE is clicked
				
				processClearanceRequest(row.id, row);
			});
		}

		if (status === 'New' && newContainer) newContainer.appendChild(card);
		else if (status === 'Processing' && processingContainer) processingContainer.appendChild(card);
	}));

	// Update counts
	const newCount = document.getElementById('clearance-new');
	const processingCount = document.getElementById('clearance-processing');
	if (newCount) newCount.textContent = counts.New || 0;
	if (processingCount) processingCount.textContent = counts.Processing || 0;
}

function populateAndShowClearanceModal(row) {
	// Personal info
	document.getElementById('clearFirstName').value = row.first_name || '';
	document.getElementById('clearMiddleName').value = row.middle_name || '';
	document.getElementById('clearLastName').value = row.last_name || '';
	document.getElementById('clearAge').value = row.age || '';
	document.getElementById('clearAddress').value = row.address || '';
	document.getElementById('clearBirthDate').value = formatDisplayDate(row.birth_date);
	document.getElementById('clearBirthPlace').value = row.birth_place || '';

	// Civil Status
	['Single','Married'].forEach(s => {
		const el = document.getElementById('clearCivil'+s);
		if (el) el.checked = (row.civil_status || '').toUpperCase() === s.toUpperCase();
	});

	// Gender
	['Male','Female'].forEach(g => {
		const el = document.getElementById('clearGender'+g);
		if (el) el.checked = (row.gender || '').toUpperCase() === g.toUpperCase();
	});

	// Purpose
	const purpose = document.getElementById('clearPurpose');
	if (purpose) {
		if (row.purpose) {
			purpose.value = row.purpose;
			// If the value wasn't set (doesn't match any option), add it as a new option
			if (purpose.value !== row.purpose) {
				const newOption = document.createElement('option');
				newOption.value = row.purpose;
				newOption.textContent = row.purpose;
				purpose.appendChild(newOption);
				purpose.value = row.purpose;
			}
		} else {
			purpose.value = ''; // Clear the selection
		}
	}

	// Header date/title
	document.getElementById('clearanceDetailsTitle').textContent = 'CLEARANCE FORM';
	// Date label removed

    // Handle ID Image (Clearance)
    fetchAndDisplayIdImage('clearance', row.id, 'clearImagePlaceholder');

	showClearanceDetailsModal();
}

function renderIndigencyCards(forms) {
	const newContainer = document.getElementById('indigency-new-cards');
	const processingContainer = document.getElementById('indigency-processing-cards');

	// Clear existing static examples
	if (newContainer) newContainer.innerHTML = '';
	if (processingContainer) processingContainer.innerHTML = '';

	let counts = { New: 0, Processing: 0 };

	// If no forms from database, show message
	if (!forms || forms.length === 0) {
		console.log('No Indigency forms found in database');
		if (newContainer) {
			newContainer.innerHTML = '<div class="no-data-message">No Indigency requests found</div>';
		}
		// Update counts to 0
		const newCount = document.getElementById('indigency-new');
		const processingCount = document.getElementById('indigency-processing');
		if (newCount) newCount.textContent = '0';
		if (processingCount) processingCount.textContent = '0';
		return;
	}

	const newForms = forms.filter(r => (r.status || 'New') === 'New').sort((a,b)=>{
		const timeA = getSortTimestamp(a);
		const timeB = getSortTimestamp(b);
		return timeB - timeA; // Latest first
	});
	const processingForms = forms.filter(r => (r.status || 'New') === 'Processing').sort((a,b)=>{
		const timeA = getSortTimestamp(a);
		const timeB = getSortTimestamp(b);
		return timeB - timeA; // Latest first
	});

	[newForms, processingForms].forEach(group => group.forEach((row, index) => {
		const status = (row.status || 'New');
		counts[status] = (counts[status] || 0) + 1;

		const fullName = [row.givenname, row.middlename, row.surname].filter(Boolean).join(' ');
		const submitted = formatDisplayDate(row.submittedAt);
		const purpose = row.purpose || '';
		const requestTime = formatTime(row.submittedAt || row.submitted_at);
		
		// Format process_at datetime if available
		const processedAt = row.processAt ? formatDisplayDate(row.processAt) + ' at ' + formatTime(row.processAt) : '';
		// Format finish_at datetime if available
		const finishedAt = row.finishAt ? formatDisplayDate(row.finishAt) + ' at ' + formatTime(row.finishAt) : '';

		const card = document.createElement('div');
		card.className = 'request-card';
		
		// Add data attributes for print multiple
		card.dataset.requestId = row.id || row.indigency_id || row.indigencyId;
		card.dataset.documentType = 'indigency';
		
		card.innerHTML = `
			<div class=\"card-header\">
				<span class=\"request-date\">${submitted} • ${requestTime}</span>
			</div>
			<div class=\"card-body\">
				<h5>${escapeHtml(fullName || 'No Name')}</h5>
				<p>${escapeHtml(row.address || 'No Address')}</p>
				${purpose ? `<div class=\"card-purpose\">${escapeHtml(purpose)}</div>` : ''}
				<div class=\"card-meta\">
                    ${processedAt && status === 'Processing' ? `<span class=\"processed-time\">Checked at: ${processedAt}</span>` : ''}
                    ${finishedAt && status === 'Finished' ? `<span class=\"done-time\">Finished at: ${finishedAt}</span>` : ''}
				</div>
			</div>
			<div class=\"card-actions\">
				<button class=\"btn-action view-btn\"><i class=\"fas fa-eye\"></i> View</button>
				${status === 'New' ? '<button class=\"btn-action process-btn\" disabled><i class=\"fas fa-cog\"></i> Process</button>' : ''}
				${status === 'Processing' ? '<button class=\"btn-action finish-btn\" disabled><i class=\"fas fa-check\"></i> Finish</button>' : ''}
				${status === 'Finished' ? '<button class=\"btn-action print-btn\" disabled><i class=\"fas fa-print\"></i> Print</button>' : ''}
			</div>
		`;

		// Attach view handler to open details modal filled with this row
		const viewBtn = card.querySelector('.view-btn');
		if (viewBtn) {
			viewBtn.addEventListener('click', () => populateAndShowIndigencyModal(row));
		}

		// Attach process handler for Indigency requests
		const processBtn = card.querySelector('.process-btn');
		if (processBtn) {
			processBtn.disabled = false; // Enable the button
			// Always make process-btn visible
			processBtn.classList.add('admin-visible');
			processBtn.style.removeProperty('visibility');
			processBtn.style.removeProperty('pointer-events');
			processBtn.style.setProperty('visibility', 'visible', 'important');
			processBtn.style.setProperty('display', 'inline-flex', 'important');
			processBtn.style.setProperty('pointer-events', 'auto', 'important');
			// Mark as admin-visible if user is admin
			const isAdmin = window.AccessControl && window.AccessControl.data && window.AccessControl.data.position && window.AccessControl.data.position.toLowerCase() === 'admin';
			if (isAdmin) {
				// Additional admin styling if needed
			}
			processBtn.addEventListener('click', () => {
				if (!row.id) {
					console.error('No ID found for row:', row);
					showStatusModal('error', 'Processing Failed', 'No valid request ID found. Please refresh the page and try again.');
					return;
				}
				
				// Store reference to the clicked button and request ID
				currentProcessingButton = processBtn;
				currentIndigencyRequestId = row.id;
				
				// Disable button and show processing state
				processBtn.disabled = true;
				processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
				processBtn.style.opacity = '0.6';
				
				processIndigencyRequest(row.id, row);
			});
		}

		if (status === 'New' && newContainer) newContainer.appendChild(card);
		else if (status === 'Processing' && processingContainer) processingContainer.appendChild(card);
	}));

	// Update counts
	const newCount = document.getElementById('indigency-new');
	const processingCount = document.getElementById('indigency-processing');
	if (newCount) newCount.textContent = counts.New || 0;
	if (processingCount) processingCount.textContent = counts.Processing || 0;
}

function populateAndShowIndigencyModal(row) {
	const langRaw = String(row.document_language || '').toLowerCase();
	let langLabel = '—';
	if (langRaw === 'english') langLabel = 'English';
	else if (langRaw === 'tagalog') langLabel = 'Tagalog';
	const langEl = document.getElementById('indigDocLanguagePreview');
	if (langEl) langEl.value = langLabel;
	const pkEl = document.getElementById('indigParaKayPreview');
	if (pkEl) pkEl.value = (row.para_kay || '').trim() || '—';

	// Personal info
	document.getElementById('indigFirstName').value = row.givenname || '';
	document.getElementById('indigMiddleName').value = row.middlename || '';
	document.getElementById('indigLastName').value = row.surname || '';
	document.getElementById('indigAge').value = row.age || '';
	document.getElementById('indigAddress').value = row.address || '';
	document.getElementById('indigBirthDate').value = formatDisplayDate(row.birthday);
	document.getElementById('indigBirthPlace').value = row.birthplace || '';

	// Civil Status
	['Single','Married'].forEach(s => {
		const el = document.getElementById('indigCivil'+s);
		if (el) el.checked = (row.civilStatus || '').toUpperCase() === s.toUpperCase();
	});

	// Gender
	['Male','Female'].forEach(g => {
		const el = document.getElementById('indigGender'+g);
		if (el) el.checked = (row.gender || '').toUpperCase() === g.toUpperCase();
	});

	// Purpose
	const purpose = document.getElementById('indigPurpose');
	if (purpose) {
		if (row.purpose) {
			purpose.value = row.purpose;
			// If the value wasn't set (doesn't match any option), add it as a new option
			if (purpose.value !== row.purpose) {
				const newOption = document.createElement('option');
				newOption.value = row.purpose;
				newOption.textContent = row.purpose;
				purpose.appendChild(newOption);
				purpose.value = row.purpose;
			}
		} else {
			purpose.value = ''; // Clear the selection
		}
	}

	// Header date/title
	document.getElementById('indigencyDetailsTitle').textContent = 'INDIGENCY FORM';
	// Date label removed

    // Handle ID Image (Indigency)
    fetchAndDisplayIdImage('indigency', row.id, 'indigImagePlaceholder');

    showIndigencyDetailsModal();
}

async function handleIdImage(imageData, containerId) {
	const container = document.getElementById(containerId);
	if (!container) {
		console.log('ID Image container not found:', containerId);
		return;
	}

	console.log('Handling image for container:', containerId, 'Data length:', imageData ? imageData.length : 0);
	console.log('Image data preview:', imageData ? imageData.substring(0, 100) + '...' : 'null');

	if (imageData && imageData !== '' && imageData !== 'image_too_large') {
		// Apply blur to detected cursive text before displaying
		const blurredImageData = await blurSensitiveIdInfo(imageData);
		
		// If image data exists, create and display the image
		const img = document.createElement('img');
		img.src = blurredImageData;
		img.style.maxWidth = '100%';
		img.style.maxHeight = '200px';
		img.style.width = 'auto';
		img.style.height = 'auto';
		img.style.objectFit = 'contain';
		img.style.border = '1px solid #333';
		img.style.borderRadius = '4px';
		img.style.display = 'block';
		img.style.margin = '0 auto';
		img.style.cursor = 'pointer';
		img.title = 'Click to view full size';
		
		// Add click handler to show image in modal (also blurred)
		img.onclick = function() {
			viewIdImage(blurredImageData, 'ID Image');
		};
		
		// Add error handling for image load
		img.onload = function() {
			console.log('Image loaded successfully for:', containerId);
		};
		img.onerror = function() {
			console.log('Image failed to load for:', containerId);
			container.innerHTML = '<div style="padding: 20px; text-align: center; color: #333; border: 2px dashed #333; border-radius: 4px;">Image failed to load</div>';
		};
		
		// Clear container and add image
		container.innerHTML = '';
		container.appendChild(img);
	} else if (imageData === 'image_too_large') {
		// If image is too large, show message
		console.log('Image too large for:', containerId);
		container.innerHTML = '<div style="padding: 20px; text-align: center; color: #333; border: 2px dashed #333; border-radius: 4px;">Image too large to display</div>';
	} else {
		// If no image data, show placeholder
		console.log('No image data for:', containerId);
		container.innerHTML = '<div style="padding: 20px; text-align: center; color: #333; border: 2px dashed #333; border-radius: 4px;">No ID Image Available</div>';
	}
}

// Lightweight fetcher for valid_id image per table (top-level)
async function fetchAndDisplayIdImage(table, id, containerId) {
    try {
        if (!id) {
            console.warn('fetchAndDisplayIdImage: No ID provided for table:', table);
            handleIdImage(null, containerId);
            return;
        }
        const url = `php/getIdImage.php?table=${encodeURIComponent(table)}&id=${encodeURIComponent(id)}`;
        console.log('Fetching ID image from:', url);
        const res = await fetch(url, { cache: 'no-store' });
        
        // Check if response is OK
        if (!res.ok) {
            const errorText = await res.text();
            console.error('Failed to fetch ID image - HTTP error:', res.status, res.statusText);
            console.error('Error response:', errorText);
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = `<div style="padding: 20px; text-align: center; color: #dc3545; border: 2px dashed #dc3545; border-radius: 4px;">
                    <strong>Error loading image</strong><br>
                    <small>Status: ${res.status} ${res.statusText}</small>
                </div>`;
            }
            return;
        }
        
        const data = await res.json();
        console.log('ID image response:', data);
        
        if (data && data.success) {
            handleIdImage(data.imageData, containerId);
        } else {
            console.warn('ID image fetch returned unsuccessful:', data);
            const errorMsg = data.error || 'Unknown error';
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = `<div style="padding: 20px; text-align: center; color: #dc3545; border: 2px dashed #dc3545; border-radius: 4px;">
                    <strong>Error loading image</strong><br>
                    <small>${errorMsg}</small>
                </div>`;
            }
        }
    } catch (e) {
        console.error('Failed to fetch ID image - Exception:', e);
        console.error('Error details:', {
            message: e.message,
            stack: e.stack,
            table: table,
            id: id,
            containerId: containerId
        });
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<div style="padding: 20px; text-align: center; color: #dc3545; border: 2px dashed #dc3545; border-radius: 4px;">
                <strong>Error loading image</strong><br>
                <small>${e.message || 'Network or server error'}</small>
            </div>`;
        }
    }
}

function formatDisplayDate(iso) {
	if (!iso) return '';
	try {
		const d = new Date(iso);
		const options = { month: 'short', day: '2-digit', year: 'numeric' };
		return d.toLocaleDateString(undefined, options);
	} catch {
		return '';
	}
}

function formatTime(iso) {
	if (!iso) return '';
	try {
		const d = new Date(iso);
		return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
	} catch {
		return '';
	}
}

// Function to view ID image in modal
async function viewIdImage(imageUrl, title) {
	const modal = document.getElementById('imageModal');
	const modalTitle = document.getElementById('imageModalTitle');
	const modalImg = document.getElementById('imageModalImg');
	const modalNoImage = document.getElementById('imageModalNoImage');
	
	if (!modal || !modalTitle || !modalImg || !modalNoImage) {
		console.error('Image modal elements not found');
		return;
	}
	
	modalTitle.textContent = title || 'ID Image';
	
	if (imageUrl && imageUrl.trim() !== '' && imageUrl !== 'image_too_large') {
		// Apply blur to detected cursive text
		const blurredImageUrl = await blurSensitiveIdInfo(imageUrl);
		
		modalImg.src = blurredImageUrl;
		modalImg.style.display = 'block';
		modalNoImage.style.display = 'none';
		
		// Handle image load error
		modalImg.onerror = function() {
			modalImg.style.display = 'none';
			modalNoImage.style.display = 'block';
		};
	} else {
		modalImg.style.display = 'none';
		modalNoImage.style.display = 'block';
	}
	
	modal.classList.add('show');
	modal.setAttribute('aria-hidden', 'false');
	
	// Close on Escape key
	document.addEventListener('keydown', function escapeHandler(e) {
		if (e.key === 'Escape' && modal.classList.contains('show')) {
			closeImageModal();
			document.removeEventListener('keydown', escapeHandler);
		}
	});
}

// Function to close image modal
function closeImageModal() {
	const modal = document.getElementById('imageModal');
	if (modal) {
		modal.classList.remove('show');
		modal.setAttribute('aria-hidden', 'true');
	}
}

// Function to sort finished requests (legacy - kept for backward compatibility)
function sortReleasedRequests(tableType, sortOrder) {
    const requests = releasedRequestsCache[tableType] || [];
    const containerMap = {
        'barangay_id': 'released-barangayId-finished-cards',
        'certification': 'released-certification-finished-cards',
        'coe': 'released-coe-finished-cards',
        'clearance': 'released-clearance-finished-cards',
        'indigency': 'released-indigency-finished-cards'
    };
    const countMap = {
        'barangay_id': 'released-barangayId-finished',
        'certification': 'released-certification-finished',
        'coe': 'released-coe-finished',
        'clearance': 'released-clearance-finished',
        'indigency': 'released-indigency-finished'
    };
    
    renderReleasedCards(requests, containerMap[tableType], countMap[tableType], sortOrder || globalSortOrder);
}

// Global sort function - applies to all tabs
function applyGlobalSort(sortOrder) {
    globalSortOrder = sortOrder;
    
    // Get the currently active tab
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
    
    if (!activeTab) return;
    
    if (activeTab === 'released') {
        // Re-render all finished cards with new sort order
        const containerMap = {
            'barangay_id': 'released-barangayId-finished-cards',
            'certification': 'released-certification-finished-cards',
            'coe': 'released-coe-finished-cards',
            'clearance': 'released-clearance-finished-cards',
            'indigency': 'released-indigency-finished-cards'
        };
        const countMap = {
            'barangay_id': 'released-barangayId-finished',
            'certification': 'released-certification-finished',
            'coe': 'released-coe-finished',
            'clearance': 'released-clearance-finished',
            'indigency': 'released-indigency-finished'
        };
        
        Object.keys(releasedRequestsCache).forEach(type => {
            const requests = releasedRequestsCache[type] || [];
            renderReleasedCards(requests, containerMap[type], countMap[type]);
        });
    } else if (activeTab === 'new') {
        // Reload new requests which will use the new sort order
        loadAllRequests();
    } else if (activeTab === 'checked') {
        // Reload checked requests which will use the new sort order
        // For checked tab, we need to reload processing requests
        loadAllRequests();
    }
}

// Returns a numeric timestamp used for sorting (latest to oldest)
function getSortTimestamp(request) {
    // Try multiple possible field name variations
    const candidates = [
        request.finishAt || request.finish_at || request.finishedAt || request.finished_at,
        request.processAt || request.process_at || request.processedAt || request.processed_at,
        request.submittedAt || request.submitted_at || request.date || request.createdAt || request.created_at
    ];
    for (const value of candidates) {
        if (value) {
            const t = new Date(value).getTime();
            if (!Number.isNaN(t) && t > 0) return t;
        }
    }
    return 0;
}

// Scroll to top button functionality
function scrollToTop() {
	window.scrollTo({
		top: 0,
		behavior: 'smooth'
	});
}

// Show/hide scroll to top button based on scroll position
window.addEventListener('scroll', function() {
	const scrollBtn = document.getElementById('scrollToTopBtn');
	if (scrollBtn && window.scrollY > 300) {
		scrollBtn.classList.add('show');
	} else if (scrollBtn) {
		scrollBtn.classList.remove('show');
	}
});

function escapeHtml(str) {
	return String(str)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function updateAllCounts(barangayIdForms, certificationForms, coeForms, clearanceForms, indigencyForms) {
	// Update category header stats for each document type
	updateCategoryCounts('barangayId', barangayIdForms);
	updateCategoryCounts('certification', certificationForms);
	updateCategoryCounts('coe', coeForms);
	updateCategoryCounts('clearance', clearanceForms);
	updateCategoryCounts('indigency', indigencyForms);
	
	// Update sidebar nav counts based on active tab
	if (document.getElementById('new-tab')?.classList.contains('active')) {
		updateSidebarCountsForNew();
	} else if (document.getElementById('checked-tab')?.classList.contains('active')) {
		updateSidebarCountsForChecked();
	}
}

function updateCategoryCounts(categoryPrefix, forms) {
	// Count by status
	const newCount = forms.filter(form => form.status === 'New').length;
	const processingCount = forms.filter(form => form.status === 'Processing').length;
	
	// Update the counts in the category header
	document.getElementById(`${categoryPrefix}-new`).textContent = newCount;
	document.getElementById(`${categoryPrefix}-processing`).textContent = processingCount;
}

// Apply access control to rendered cards - OPTIMIZED
let accessControlApplied = false;

function applyAccessControlToCards() {
	// Only run once and cache the result
	if (accessControlApplied) return;
	
	// Check if user can edit reqDocu module
	const canEdit = window.AccessControl && window.AccessControl.canEditModule('reqDocu');
	
	// Also check if user is admin - admins should always have full access
	const isAdmin = window.AccessControl && window.AccessControl.data && window.AccessControl.data.position && window.AccessControl.data.position.toLowerCase() === 'admin';
	
	if (!canEdit && !isAdmin) {
		// Use CSS classes instead of inline styles for better performance
		document.body.classList.add('view-only-mode');
		
		// Add CSS for view-only styling if not already added
		if (!document.getElementById('reqdocu-view-only-styles')) {
			const style = document.createElement('style');
			style.id = 'reqdocu-view-only-styles';
			style.textContent = `
				body.view-only-mode .request-card {
					position: relative;
					opacity: 0.8;
					border: 2px dashed #000 !important;
				}
				
				body.view-only-mode .request-card::after {
					content: 'VIEW ONLY';
					position: absolute;
					top: 10px;
					right: 10px;
					background: rgba(255, 152, 0, 0.9);
					color: white;
					padding: 4px 8px;
					border-radius: 4px;
					font-size: 10px;
					font-weight: bold;
					z-index: 10;
					pointer-events: none;
				}
				
				body.view-only-mode .process-btn,
				body.view-only-mode .finish-btn,
				body.view-only-mode .ready-btn {
					display: none !important;
				}
				
				/* Ensure print button is always visible in Finished tab */
				body.view-only-mode .print-btn,
				body.view-only-mode .print-btn.admin-visible {
					display: inline-flex !important;
					visibility: visible !important;
					opacity: 1 !important;
				}
				
				/* Ensure admin buttons are always visible */
				body.view-only-mode .process-btn.admin-visible,
				body.view-only-mode .finish-btn.admin-visible,
				body.view-only-mode .ready-btn.admin-visible {
					display: inline-flex !important;
					visibility: visible !important;
					opacity: 1 !important;
				}
				
				body.view-only-mode .card-actions {
					opacity: 0.5;
					pointer-events: none;
				}
				
				/* Admin buttons and print buttons should be fully interactive */
				body.view-only-mode .card-actions .admin-visible,
				body.view-only-mode .card-actions .print-btn {
					opacity: 1 !important;
					pointer-events: auto !important;
				}
			`;
			document.head.appendChild(style);
		}
	}
	
	accessControlApplied = true;
}