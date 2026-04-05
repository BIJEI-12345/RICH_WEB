// Audit Trail — unified auth events (login, logout, failed login, password change)

let currentPage = 0;
let pageSize = 20;
let totalRecords = 0;

document.addEventListener('DOMContentLoaded', async function() {
    await initializeAuditTrailPage();
});

function navigateToDashboard() {
    window.location.href = 'admin-dashboard.html';
}

async function initializeAuditTrailPage() {
    if (typeof window.Session !== 'undefined' && typeof window.Session.load === 'function') {
        try {
            await window.Session.load();
        } catch (error) {
            // Continue; backend enforces access.
        }
    }

    const currentUser = window.CurrentUser || (window.Session ? window.Session.data : null);
    const isLoggedIn = !!(currentUser && currentUser.logged_in);

    if (!isLoggedIn) {
        showStatusModal('error', 'Session Required', 'Please log in again to access audit trail.');
        return;
    }

    loadAuditTrail();
}

async function loadAuditTrail() {
    const tableContainer = document.getElementById('tableContainer');
    const emptyState = document.getElementById('emptyState');

    tableContainer.style.display = 'none';
    emptyState.style.display = 'none';

    try {
        const url = `php/audit_trail.php?scope=all&limit=${pageSize}&offset=${currentPage * pageSize}`;
        const response = await fetch(url, {
            credentials: 'same-origin',
            cache: 'no-store'
        });

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('Access denied. Please log in with an admin account.');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            totalRecords = result.total;
            displayAuditTrail(result.data);
            updatePagination();

            if (result.data.length === 0) {
                emptyState.style.display = 'block';
                tableContainer.style.display = 'none';
            } else {
                emptyState.style.display = 'none';
                tableContainer.style.display = 'block';
            }
        } else {
            throw new Error(result.error || 'Failed to load audit trail');
        }
    } catch (error) {
        console.error('Error loading audit trail:', error);
        showStatusModal('error', 'Error', error.message || 'Failed to load audit trail. Please try again.');
        emptyState.style.display = 'block';
        tableContainer.style.display = 'none';
    }
}

function displayAuditTrail(data) {
    const auditTrailBody = document.getElementById('auditTrailBody');
    auditTrailBody.innerHTML = '';

    if (data.length === 0) {
        return;
    }

    data.forEach(record => {
        const row = document.createElement('tr');
        const userName = escapeHtml(record.full_name || '-');
        const position = escapeHtml(record.position || '-');
        const action = getActionLabel(record.action_type);
        const details = escapeHtml(record.description || '-');
        const dateTime = formatDateTime(record.created_at);

        row.innerHTML = `
            <td><strong>${userName}</strong></td>
            <td>${position}</td>
            <td>${action}</td>
            <td>${details}</td>
            <td>${dateTime}</td>
        `;
        auditTrailBody.appendChild(row);
    });
}

function getActionLabel(actionType) {
    const actionMap = {
        'login': 'Logged In',
        'logout': 'Logged Out',
        'login_failed': 'Failed Login',
        'password_changed': 'Password Changed',
        'status_updated': 'Updated',
        'viewed': 'Viewed',
        'created': 'Created',
        'user_created': 'Created',
        'user_updated': 'Updated',
        'user_approved': 'Approved',
        'user_deactivated': 'Deactivated',
        'user_activated': 'Activated',
        'user_rejected': 'Rejected'
    };
    return actionMap[actionType] || 'Action';
}

function formatDateTime(dateString) {
    if (!dateString) return '-';

    try {
        const date = new Date(dateString);
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        };
        return date.toLocaleString('en-US', options);
    } catch (error) {
        return dateString;
    }
}

function changePage(direction) {
    const newPage = currentPage + direction;
    const totalPages = Math.ceil(totalRecords / pageSize);

    if (newPage >= 0 && newPage < totalPages) {
        currentPage = newPage;
        loadAuditTrail();
    }
}

function updatePagination() {
    const pagination = document.getElementById('pagination');
    const paginationInfo = document.getElementById('paginationInfo');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    const totalPages = Math.ceil(totalRecords / pageSize);

    if (totalRecords === 0) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';

    const startRecord = currentPage * pageSize + 1;
    const endRecord = Math.min((currentPage + 1) * pageSize, totalRecords);

    paginationInfo.textContent = `Showing ${startRecord}-${endRecord} of ${totalRecords} records`;

    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = currentPage >= totalPages - 1;
}

function printAuditTrail() {
    const tbody = document.getElementById('auditTrailBody');
    const table = document.getElementById('auditTrailTable');
    if (!tbody || !table) return;

    if (tbody.querySelectorAll('tr').length === 0) {
        showStatusModal('error', 'No Data to Print', 'There are no audit trail records to print.');
        return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showStatusModal('error', 'Print Blocked', 'Please allow popups for this site to enable printing.');
        return;
    }

    try {
        const w = Math.min(window.screen.availWidth - 80, 1280);
        const h = Math.min(window.screen.availHeight - 80, 900);
        printWindow.resizeTo(w, h);
        printWindow.moveTo(40, 40);
    } catch (e) { /* ignore */ }

    const tableHtml = table.outerHTML;
    const sectionTitle = 'Authentication activity';

    const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=1200">
            <title>Audit Trail</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                @page { size: 210mm 297mm; margin: 5mm; }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: white;
                    color: black;
                    padding: 12px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .print-section-header { text-align: center; margin-bottom: 12pt; }
                .print-section-header h2 {
                    font-size: 14pt;
                    font-weight: 600;
                    color: #1e3a5f;
                }
                .audit-trail-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }
                .audit-trail-table thead { background: #2c5aa0; color: white; }
                .audit-trail-table th, .audit-trail-table td {
                    border: 1px solid #222;
                    padding: 4pt 6pt;
                    font-size: 10.5pt;
                    vertical-align: top;
                }
                .audit-trail-table th { text-transform: uppercase; font-size: 10pt; }
                .audit-trail-table td:nth-child(4) { overflow-wrap: break-word; word-wrap: break-word; }
                .audit-trail-table tbody tr:nth-child(even) { background: #f5f5f5; }
                @media print {
                    .audit-trail-table thead { display: table-header-group; }
                    .audit-trail-table tr { page-break-inside: auto; }
                }
            </style>
        </head>
        <body>
            <div class="print-section-header">
                <h2>${escapeHtml(sectionTitle)}</h2>
            </div>
            ${tableHtml}
        </body>
        </html>
    `;

    printWindow.document.write(printHTML);
    printWindow.document.close();

    printWindow.onload = function () {
        printWindow.focus();
        printWindow.print();
        setTimeout(() => printWindow.close(), 1000);
    };
}

function showStatusModal(type, title, message) {
    const modal = document.getElementById('statusModal');
    const icon = document.getElementById('statusIcon');
    const titleEl = document.getElementById('statusTitle');
    const messageEl = document.getElementById('statusMessage');

    icon.className = `status-icon ${type}`;
    icon.innerHTML = type === 'success' ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-circle"></i>';
    titleEl.textContent = title;
    messageEl.textContent = message;

    modal.classList.add('show');
}

function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    modal.classList.remove('show');
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
