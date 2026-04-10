document.addEventListener('DOMContentLoaded', () => {
    setupSidebarButtons();
    setupAnalyticsForm();
    initializeRangeControls();
    setupScrollToTop();
    setupPrintButtons();
    setupSitioAnalyticsControls();
});

function setupScrollToTop() {
    const scrollToTopBtn = document.getElementById('scrollToTop');
    
    if (!scrollToTopBtn) return;
    
    // Show/hide button based on scroll position
    window.addEventListener('scroll', () => {
        const scrollY = window.pageYOffset;
        
        // Show/hide scroll to top button
        if (scrollY > 300) {
            scrollToTopBtn.classList.add('show');
        } else {
            scrollToTopBtn.classList.remove('show');
        }
    });
    
    // Scroll to top when clicked
    scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

function setupPrintButtons() {
    // Setup print button for Concerns table
    document.getElementById('printConcernsTable')?.addEventListener('click', () => {
        const container = document.querySelector('.analytics-table-container');
        if (container) {
            const title = container.querySelector('.table-header h5')?.textContent || 'Concerns';
            printTableWrapper(container, title);
        }
    });

    // Setup print button for Emergency Alerts table
    document.getElementById('printEmergencyTable')?.addEventListener('click', () => {
        const containers = document.querySelectorAll('.analytics-table-container');
        if (containers.length > 1) {
            const title = containers[1].querySelector('.table-header h5')?.textContent || 'Emergency Alerts';
            printTableWrapper(containers[1], title);
        }
    });

    // Setup print button for Document Requests table
    document.getElementById('printDocumentTable')?.addEventListener('click', () => {
        const containers = document.querySelectorAll('.analytics-table-container');
        if (containers.length > 2) {
            const title = containers[2].querySelector('.table-header h5')?.textContent || 'Document Requests';
            printTableWrapper(containers[2], title);
        }
    });

    // Setup print button for Active Users table
    document.getElementById('printUsersTable')?.addEventListener('click', () => {
        const containers = document.querySelectorAll('.analytics-table-container');
        if (containers.length > 3) {
            const title = containers[3].querySelector('.table-header h5')?.textContent || 'Active Users';
            printTableWrapper(containers[3], title);
        }
    });

    // Setup print button for Jobseeker Report table
    document.getElementById('printJobseekerTable')?.addEventListener('click', () => {
        const containers = document.querySelectorAll('.analytics-table-container');
        if (containers.length > 4) {
            const title = containers[4].querySelector('.table-header h5')?.textContent || 'Jobseeker Report';
            printTableWrapper(containers[4], title);
        }
    });
}

function printTableWrapper(container, tableTitle) {
    // Get the table-wrapper from the container
    const tableWrapper = container.querySelector('.table-wrapper');
    
    if (!tableWrapper) {
        console.error('Table wrapper not found');
        return;
    }
    
    // Clone the table-wrapper to avoid modifying the original
    const wrapperClone = tableWrapper.cloneNode(true);
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
        alert('Please allow popups to print the table');
        return;
    }
    
    // Create print HTML with only the table-wrapper content
    const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${tableTitle} - Print</title>
            <style>
                @media print {
                    @page {
                        margin: 1cm;
                    }
                }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: #333;
                }
                .table-wrapper {
                    overflow: visible;
                    width: 100%;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.9rem;
                }
                thead {
                    background: #f1f5f9;
                    border-bottom: 2px solid #cbd5e1;
                }
                th {
                    padding: 0.75rem 1rem;
                    text-align: left;
                    font-weight: 600;
                    color: #0f172a;
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border-bottom: 2px solid #cbd5e1;
                }
                td {
                    padding: 0.875rem 1rem;
                    border-bottom: 1px solid #e2e8f0;
                    color: #1e293b;
                }
                tbody tr:hover {
                    background: #f8fafc;
                }
                tbody tr:last-child td {
                    border-bottom: none;
                }
                .table-loading {
                    text-align: center;
                    color: #64748b;
                    font-style: italic;
                    padding: 2rem !important;
                }
                @media print {
                    body {
                        padding: 0;
                    }
                    table {
                        page-break-inside: auto;
                    }
                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                    thead {
                        display: table-header-group;
                    }
                    tfoot {
                        display: table-footer-group;
                    }
                }
            </style>
        </head>
        <body>
            ${wrapperClone.outerHTML}
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() {
                        window.close();
                    };
                };
            </script>
        </body>
        </html>
    `;
    
    printWindow.document.write(printHTML);
    printWindow.document.close();
}

let analyticsPayload = null;
/** Index sa `bySitio` array (0…23) */
let sitioAnalyticsIndex = 0;
/** 0 = Concerns, 1 = Emergency, 2 = Documents — arrow lang sa tatlong ito */
let sitioGraphKind = 0;
const SITIO_GRAPH_LABELS = ['Concerns', 'Emergency alerts', 'Document requests'];

let currentSection = 'concerns';
let currentRangeLabel = 'This month';
let previousRangeLabel = '';
let isYearView = false;

const graphEntries = [
    {
        key: 'concerns',
        label: 'Concerns',
        color: 'linear-gradient(135deg, #fb923c, #dc2626)',
        monthKey: 'month.reported',
        yearKey: 'year.reported'
    },
    {
        key: 'emergencies',
        label: 'Emergencies',
        color: 'linear-gradient(135deg, #ef4444, #b91c1c)',
        monthKey: 'month.reported',
        yearKey: 'year.reported'
    },
    {
        key: 'documents',
        label: 'Document Requests',
        color: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
        monthKey: 'month.total',
        yearKey: 'year.total'
    }
];

const sectionTemplates = {
    documents: {
        title: 'Document Request Details',
        description: 'Track barangay ID, COE, clearance, indigency, and certification requests.',
        actionLabel: 'View document table',
        secondaryLabel: 'Export summary',
        color: 'linear-gradient(135deg, #38bdf8, #0ea5e9)'
    },
    concerns: {
        title: 'Concern Handling',
        description: 'View new vs resolved reports per month.',
        actionLabel: 'Open concerns',
        secondaryLabel: 'Download reports',
        color: 'linear-gradient(135deg, #f97316, #dc2626)'
    },
    emergencies: {
        title: 'Emergency Alerts',
        description: 'Monitor emergencies and their resolution status.',
        actionLabel: 'Open emergency panel',
        secondaryLabel: 'Download log',
        color: 'linear-gradient(135deg, #ef4444, #dc2626)'
    },
    users: {
        title: 'User Activity',
        description: 'Check active accounts, hours, and last logins.',
        actionLabel: 'Manage users',
        secondaryLabel: 'View sessions',
        color: 'linear-gradient(135deg, #0f172a, #1e3a8a)'
    }
};

async function loadAnalyticsData(params = null) {
    setLoadingState(true);
    try {
        let url = 'php/analytics.php';
        if (params) {
            const query = params.toString();
            if (query) {
                url += `?${query}`;
            }
        }
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (payload.success && payload.data) {
            analyticsPayload = payload.data;
            previousRangeLabel = payload.data.previousRangeLabel || '';
            const currentPeriod = payload.data.period || 'month';
            populateAnalytics(payload.data, currentPeriod);
            setAnalyticsScopeLabel(currentRangeLabel);
            updateDetailPanel(currentSection);
        } else {
            console.error('Analytics payload missing data or marked failed', payload);
        }
    } catch (error) {
        console.error('Failed to load analytics data:', error);
    } finally {
        setLoadingState(false);
    }
}

function setupAnalyticsForm() {
    const form = document.getElementById('analyticsRangeForm');
    if (!form) return;
    form.addEventListener('submit', event => {
        event.preventDefault();
        const formData = new FormData(form);
        const params = new URLSearchParams();
        const start = formData.get('start');
        const end = formData.get('end');
        if (start) params.set('start', `${start} 00:00:00`);
        if (end) params.set('end', `${end} 23:59:59`);
        params.set('period', 'custom');
        currentRangeLabel = 'Custom range';
        loadAnalyticsData(params);
    });
}

function initializeRangeControls() {
    const monthSelect = document.getElementById('analyticsMonthSelect');
    const yearSelect = document.getElementById('analyticsYearSelect');
    const yearButton = document.getElementById('showYearView');

    if (!monthSelect || !yearSelect) {
        console.error('Analytics select elements not found');
        return;
    }

    // Populate year selector with available years
    populateYearSelector();
    
    // Populate month selector with all 12 months
    populateMonthSelector();

    const applyRangeSelection = (rangeData, label) => {
        currentRangeLabel = label;
        const params = rangeData instanceof URLSearchParams ? rangeData : new URLSearchParams(rangeData);
        loadAnalyticsData(params);
    };

    const toggleYearView = () => {
        isYearView = !isYearView;
        if (isYearView) {
            // Year view: hide month selector, show year selector
            monthSelect.style.display = 'none';
            yearSelect.style.display = 'block';
            yearButton.textContent = 'Month view';
            yearButton.innerHTML = '<i class="fas fa-calendar"></i> Month view';
            // Select current year by default
            const currentYear = new Date().getFullYear();
            yearSelect.value = currentYear;
            applyRangeSelection(getYearRange(currentYear), `${currentYear}`);
        } else {
            // Month view: show month selector, hide year selector
            monthSelect.style.display = 'block';
            yearSelect.style.display = 'none';
            yearButton.textContent = 'Year view';
            yearButton.innerHTML = '<i class="fas fa-calendar-alt"></i> Year view';
            // Get selected month, use current year automatically
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            if (monthSelect.value === '' || !monthSelect.value) {
                monthSelect.value = currentMonth;
            }
            const selectedMonth = parseInt(monthSelect.value);
            const monthRange = getMonthRange(selectedMonth, currentYear);
            applyRangeSelection(monthRange, monthRange.monthLabel);
        }
    };

    monthSelect?.addEventListener('change', () => {
        if (!isYearView && monthSelect.value !== '') {
            const selectedMonth = parseInt(monthSelect.value);
            const currentYear = new Date().getFullYear();
            const monthRange = getMonthRange(selectedMonth, currentYear);
            applyRangeSelection(monthRange, monthRange.monthLabel);
        }
    });

    yearSelect?.addEventListener('change', () => {
        if (isYearView && yearSelect.value) {
            const selectedYear = parseInt(yearSelect.value);
            applyRangeSelection(getYearRange(selectedYear), `${selectedYear}`);
        }
    });

    yearButton?.addEventListener('click', toggleYearView);

    // Set default to current month (month view is default)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    if (monthSelect.value === '' || !monthSelect.value) {
        monthSelect.value = currentMonth;
    }
    const defaultMonthRange = getMonthRange(currentMonth, currentYear);
    applyRangeSelection(defaultMonthRange, defaultMonthRange.monthLabel);
}

function populateMonthSelector() {
    const monthSelect = document.getElementById('analyticsMonthSelect');
    if (!monthSelect) {
        console.error('analyticsMonthSelect element not found');
        return;
    }

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Clear existing options
    monthSelect.innerHTML = '';

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select month';
    monthSelect.appendChild(defaultOption);

    // Populate with all 12 months (no year needed, uses current year automatically)
    months.forEach((monthName, index) => {
        const option = document.createElement('option');
        option.value = index; // 0-11 for months
        option.textContent = monthName;
        // Select current month by default
        if (index === new Date().getMonth()) {
            option.selected = true;
        }
        monthSelect.appendChild(option);
    });
}

function populateYearSelector() {
    const yearSelect = document.getElementById('analyticsYearSelect');
    if (!yearSelect) return;

    const currentYear = new Date().getFullYear();
    const startYear = 2025; // Starting from 2025, will automatically include future years
    yearSelect.innerHTML = '<option value="">Select year</option>';

    // Populate years from currentYear down to startYear (descending order)
    // This ensures that when it becomes 2026, 2026 will be included automatically
    for (let year = currentYear; year >= startYear; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) {
            option.selected = true;
        }
        yearSelect.appendChild(option);
    }
}

function getMonthRange(monthIndex = null, year = null) {
    const now = new Date();
    const targetMonth = monthIndex !== null ? parseInt(monthIndex) : now.getMonth();
    const targetYear = year !== null ? parseInt(year) : now.getFullYear();
    
    const start = new Date(targetYear, targetMonth, 1);
    const end = new Date(targetYear, targetMonth + 1, 0);
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    
    return {
        start: formatQueryDate(start),
        end: formatQueryDate(end),
        period: 'month',
        monthLabel: `${monthNames[targetMonth]} ${targetYear}`
    };
}

function getYearRange(year = null) {
    const targetYear = year !== null ? year : new Date().getFullYear();
    const start = new Date(targetYear, 0, 1, 0, 0, 0);
    const end = new Date(targetYear, 11, 31, 23, 59, 59);
    return {
        start: formatQueryDate(start),
        end: formatQueryDate(end),
        period: 'year'
    };
}

function formatQueryDate(date) {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function populateAnalytics(data, period = 'month') {
    renderGraph(data);
    populateSectionPanel(currentSection);
    renderGraphPlaceholders(data);
    renderActivitySummaryTable(data, period);
    renderEmergencyAlertsTable(data, period);
    renderDocumentRequestsTable(data, period);
    renderConcernsTableChart(data);
    renderEmergencyTableChart(data);
    renderDocumentRequestsTableChart(data);
    renderActiveUsersTable(data);
    renderJobseekerReportTable(data);
    
    // Populate Document Requests Breakdown
    const docMonthList = document.getElementById('analyticsDocMonth');
    const docYearList = document.getElementById('analyticsDocYear');
    const docMonthLabel = document.getElementById('docBreakdownMonthLabel');
    const docYearLabel = document.getElementById('docBreakdownYearLabel');
    
    // Update month label based on current period
    if (docMonthLabel && data.documents?.monthLabel) {
        const monthLabel = data.documents.monthLabel;
        docMonthLabel.textContent = monthLabel;
    }
    
    // Update year label
    if (docYearLabel && data.documents?.yearLabel) {
        docYearLabel.textContent = `This year (${data.documents.yearLabel})`;
    }
    
    if (docMonthList && data.documents?.month) {
        docMonthList.innerHTML = renderDocumentBreakdown(data.documents.month);
    }
    if (docYearList && data.documents?.year) {
        docYearList.innerHTML = renderDocumentBreakdown(data.documents.year);
    }

    renderSitioAnalyticsPanel(data);
}

function renderGraph(data) {
    renderGraphGroup('analyticsGraphMonth', 'month', data);
    renderGraphGroup('analyticsGraphYear', 'year', data);
    updateGraphLabels(data);
}

function renderGraphGroup(containerId, period, data) {
    const container = document.getElementById(containerId);
    if (!container || !data) {
        return;
    }
    const values = graphEntries.map(entry => getGraphValue(entry, data, period));
    const maxValue = Math.max(...values, 1);
    container.innerHTML = graphEntries.map((entry, index) => {
        const value = values[index] ?? 0;
        const height = maxValue > 0 ? Math.max(5, Math.round((value / maxValue) * 100)) : 5;
        return `
            <div class="graph-bar-wrapper">
                <div class="graph-bar" style="--bar-height:${height}%;background:${entry.color};" aria-label="${entry.label} ${period} ${value}">
                    <span class="graph-bar-value">${value.toLocaleString()}</span>
                </div>
                <span class="graph-label">${entry.label}</span>
            </div>
        `;
    }).join('');
}

function getGraphValue(entry, data, period) {
    const keyPath = entry[`${period}Key`]?.split('.') || [];
    let value = data?.[entry.key];
    for (const part of keyPath) {
        value = value?.[part];
    }
    return typeof value === 'number' ? value : 0;
}

function renderGraphPlaceholders(data) {
    const configs = [
        {
            summaryId: 'graphSummaryConcerns',
            comparisonId: 'graphComparisonConcerns',
            plotId: 'graphPlotConcerns',
            summaryText: () => {
                const reported = data.concerns?.month?.reported ?? 0;
                const resolved = data.concerns?.month?.resolved ?? 0;
                return `Submitted ${reported} · Resolved ${resolved}`;
            },
            comparisonText: () => {
                const prevReported = data.concerns?.previous?.reported;
                const prevResolved = data.concerns?.previous?.resolved;
                if (prevReported == null && prevResolved == null) {
                    return 'Previous data unavailable';
                }
                return `Prev: ${prevReported ?? '—'} submitted · ${prevResolved ?? '—'} resolved`;
            },
            currentValue: () => data.concerns?.month?.reported ?? 0,
            previousValue: () => data.concerns?.previous?.reported ?? 0
        },
        {
            summaryId: 'graphSummaryEmergencies',
            comparisonId: 'graphComparisonEmergencies',
            plotId: 'graphPlotEmergencies',
            summaryText: () => {
                const reported = data.emergencies?.month?.reported ?? 0;
                const resolved = data.emergencies?.month?.resolved ?? 0;
                return `Submitted ${reported} · Resolved ${resolved}`;
            },
            comparisonText: () => {
                const prevReported = data.emergencies?.previous?.reported;
                const prevResolved = data.emergencies?.previous?.resolved;
                if (prevReported == null && prevResolved == null) {
                    return 'Previous data unavailable';
                }
                return `Prev: ${prevReported ?? '—'} submitted · ${prevResolved ?? '—'} resolved`;
            },
            currentValue: () => data.emergencies?.month?.reported ?? 0,
            previousValue: () => data.emergencies?.previous?.reported ?? 0
        },
        {
            summaryId: 'graphSummaryDocuments',
            comparisonId: 'graphComparisonDocuments',
            plotId: 'graphPlotDocuments',
            summaryText: () => `Requests ${data.documents?.month?.total ?? '—'}`,
            comparisonText: () => {
                const prevTotal = data.documents?.previous?.total;
                if (prevTotal == null) {
                    return 'Previous data unavailable';
                }
                return `Prev: ${prevTotal} requests`;
            },
            currentValue: () => data.documents?.month?.total ?? 0,
            previousValue: () => data.documents?.previous?.total ?? 0
        },
        {
            summaryId: 'graphSummaryUsers',
            comparisonId: 'graphComparisonUsers',
            plotId: 'graphPlotUsers',
            summaryText: () => `Active ${data.users?.activeUsers ?? '—'}`,
            comparisonText: () => 'Previous data unavailable',
            currentValue: () => data.users?.activeUsers ?? 0,
            previousValue: () => 0
        }
    ];

    configs.forEach(config => {
        const summaryEl = document.getElementById(config.summaryId);
        if (summaryEl) {
            summaryEl.textContent = config.summaryText();
        }
        const comparisonEl = document.getElementById(config.comparisonId);
        if (comparisonEl) {
            comparisonEl.textContent = config.comparisonText();
        }
        const plotEl = document.getElementById(config.plotId);
        if (!plotEl) {
            return;
        }
        const bars = plotEl.querySelectorAll('.graph-bar');
        if (bars.length < 2) {
            return;
        }
        const currentValue = config.currentValue();
        const previousValue = config.previousValue();
        const maxValue = Math.max(currentValue, previousValue, 1);
        const currentHeight = Math.max(10, Math.round((currentValue / maxValue) * 100));
        const previousHeight = Math.max(8, Math.round((previousValue / maxValue) * 100));
        bars[0].style.height = `${currentHeight}%`;
        bars[1].style.height = `${previousHeight}%`;
    });
}

function updateGraphLabels(data) {
    const monthLabel = document.getElementById('graphMonthLabel');
    const yearLabel = document.getElementById('graphYearLabel');
    if (monthLabel) {
        monthLabel.textContent = data.documents?.monthLabel ? `Month ${data.documents.monthLabel}` : 'Month —';
    }
    if (yearLabel) {
        yearLabel.textContent = data.documents?.yearLabel ? `Year ${data.documents.yearLabel}` : 'Year —';
    }
}

function populateSectionPanel(section) {
    const panel = document.getElementById('analyticsSectionPanel');
    if (!panel) return;
    const entry = sectionTemplates[section] || sectionTemplates.concerns;
    panel.innerHTML = `
        <div class="section-form-card">
            <div class="section-graphic" style="background:${entry.color}"></div>
            <div class="section-form-card-content">
                <h5>${entry.title}</h5>
                <p>${entry.description}</p>
                <div class="section-form-actions">
                    <button type="button" class="btn secondary">${entry.actionLabel}</button>
                    <button type="button" class="btn outline">${entry.secondaryLabel}</button>
                </div>
            </div>
        </div>
    `;
}

function setAnalyticsScopeLabel(rangeLabel) {
    const label = document.getElementById('analyticsScopeLabel');
    if (!label) return;
    const baseText = `Updated ${new Date().toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}`;
    label.textContent = rangeLabel ? `${baseText} (${rangeLabel})` : baseText;
}

function setLoadingState(isLoading) {
    const select = document.getElementById('analyticsMonthSelect');
    const yearSelect = document.getElementById('analyticsYearSelect');
    const yearButton = document.getElementById('showYearView');

    [select, yearSelect, yearButton].forEach(elem => {
        if (elem) {
            elem.disabled = !!isLoading;
        }
    });
}

function formatAnalyticsDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    // Format in Philippine time (Asia/Manila)
    return date.toLocaleString('en-US', {
        timeZone: 'Asia/Manila',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function renderDocumentBreakdown(data) {
    const entries = Object.entries(data || {});
    if (entries.length === 0) {
        return '<li>Not available</li>';
    }
    const normalized = entries.filter(([key]) => key.toLowerCase() !== 'total');
    const pieces = normalized.map(([label, value]) => {
        return `<li><span>${label}</span><span>${value}</span></li>`;
    });
    const totalEntry = entries.find(([key]) => key.toLowerCase() === 'total');
    if (totalEntry) {
        pieces.push(`<li><span>Total</span><span>${totalEntry[1]}</span></li>`);
    }
    return pieces.join('');
}

function setupSidebarButtons() {
    const buttons = document.querySelectorAll('.sidebar-btn');
    buttons.forEach(btn => {
        const section = btn.dataset.section;
        btn.addEventListener('click', () => {
            activateSidebarSection(section);
        });
    });
    activateSidebarSection(currentSection, false);
}

function activateSidebarSection(section, shouldScroll = true) {
    if (!section) return;
    currentSection = section;
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });
    updateDetailPanel(section);
    if (shouldScroll) {
        const panel = document.getElementById('analyticsDetailPanel');
        if (panel) {
            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

function updateDetailPanel(section) {
    if (!analyticsPayload) return;
    const titleEl = document.getElementById('detailTitle');
    const subtitleEl = document.getElementById('detailSubtitle');
    const monthValueEl = document.getElementById('detailMonthValue');
    const yearValueEl = document.getElementById('detailYearValue');
    const monthLabelEl = document.getElementById('detailMonthLabel');
    const yearLabelEl = document.getElementById('detailYearLabel');

    if (!titleEl || !subtitleEl || !monthValueEl || !yearValueEl) return;

    let monthSummary = '—';
    let yearSummary = '—';
    let subtitle = '';

    switch (section) {
        case 'concerns':
            titleEl.textContent = 'Concerns Performance';
            subtitle = 'Reported vs resolved counts.';
            monthSummary = formatReportedResolved(analyticsPayload.concerns?.month);
            yearSummary = formatReportedResolved(analyticsPayload.concerns?.year);
            break;
        case 'emergencies':
            titleEl.textContent = 'Emergencies Overview';
            subtitle = 'Reported vs resolved emergencies.';
            monthSummary = formatReportedResolved(analyticsPayload.emergencies?.month);
            yearSummary = formatReportedResolved(analyticsPayload.emergencies?.year);
            break;
        case 'documents':
            titleEl.textContent = 'Document Requests';
            subtitle = 'Monthly and yearly totals.';
            monthSummary = `${analyticsPayload.documents?.month?.total ?? '—'} requests`;
            yearSummary = `${analyticsPayload.documents?.year?.total ?? '—'} requests`;
            break;
        case 'users':
            titleEl.textContent = 'User Activity';
            subtitle = 'Active accounts and hours tracked.';
            monthSummary = `Active ${analyticsPayload.users?.activeUsers ?? '—'}`;
            yearSummary = analyticsPayload.users?.hoursActive != null
                ? `Hours tracked ${analyticsPayload.users.hoursActive}`
                : 'Hours tracked: —';
            break;
        default:
            titleEl.textContent = 'Concerns Performance';
            subtitle = 'Reported vs resolved counts.';
            monthSummary = formatReportedResolved(analyticsPayload.concerns?.month);
            yearSummary = formatReportedResolved(analyticsPayload.concerns?.year);
            break;
    }

    subtitleEl.textContent = subtitle;
    monthValueEl.textContent = monthSummary;
    yearValueEl.textContent = yearSummary;
    populateSectionPanel(section);
    const sectionMonthLabel = (analyticsPayload[section]?.monthLabel) ?? analyticsPayload.documents?.monthLabel ?? '';
    const sectionYearLabel = (analyticsPayload[section]?.yearLabel) ?? analyticsPayload.documents?.yearLabel ?? '';
    if (monthLabelEl) {
        monthLabelEl.textContent = sectionMonthLabel ? `Month: ${sectionMonthLabel}` : 'Month: Current month';
    }
    if (yearLabelEl) {
        yearLabelEl.textContent = sectionYearLabel ? `Year: ${sectionYearLabel}` : `Year: ${new Date().getFullYear()}`;
    }
}

function formatReportedResolved(metric = {}) {
    const reported = metric?.reported ?? '—';
    const resolved = metric?.resolved ?? '—';
    return `Reported ${reported} · Resolved ${resolved}`;
}

function buildDualDeltaText(delta = {}, firstLabel, secondLabel, previousLabel, period = 'month') {
    // For concerns and emergencies, delta now contains the difference between reported and resolved
    if (delta.value != null) {
        const diff = Math.abs(delta.value);
        const direction = delta.value > 0 ? 'high' : delta.value < 0 ? 'low' : null;
        if (direction && diff > 0) {
            const base = `${direction} of ${diff}`;
            const compareText = period === 'year' ? 'compare last year' : 'compare last month';
            return previousLabel ? `${base} ${compareText} (${previousLabel})` : base;
        }
    }
    return 'No change';
}

function buildSingleDeltaText(delta = {}, label, previousLabel, period = 'month') {
    if (!delta || delta.value == null) {
        return 'No change';
    }
    const diff = Math.abs(delta.value);
    const direction = delta.value > 0 ? 'high' : delta.value < 0 ? 'low' : null;
    if (!direction) {
        return 'No change';
    }
    const base = `${label} ${direction} of ${diff}`;
    const compareText = period === 'year' ? 'compare last year' : 'compare last month';
    return previousLabel ? `${base} ${compareText} (${previousLabel})` : base;
}

function formatDeltaValue(value, percent) {
    if (value == null) {
        return '—';
    }
    const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→';
    const formattedValue = value > 0 ? `+${value}` : value.toString();
    const percentText = percent != null ? ` (${percent > 0 ? '+' : ''}${percent.toFixed(1)}%)` : '';
    return `${arrow} ${formattedValue}${percentText}`;
}

function renderActivitySummaryTable(data, period = 'month') {
    const tableBody = document.getElementById('activitySummaryTableBody');
    const subtitleEl = document.getElementById('activitySummarySubtitle');
    
    if (!tableBody) return;

    const currentLabel = data.concerns?.monthLabel || (period === 'year' ? 'Current Year' : 'Current Month');
    
    const monthData = data.concerns?.month || { reported: 0, resolved: 0 };
    const yearData = data.concerns?.year || { reported: 0, resolved: 0 };
    const previousData = data.concerns?.previous || { reported: 0, resolved: 0 };

    const monthReported = monthData.reported || 0;
    const monthResolved = monthData.resolved || 0;
    const yearReported = yearData.reported || 0;
    const yearResolved = yearData.resolved || 0;
    const prevReported = previousData.reported || 0;
    const prevResolved = previousData.resolved || 0;

    const monthReportedChange = formatTableChangeWithComparison(monthReported, prevReported);
    const monthResolvedChange = formatTableChangeWithComparison(monthResolved, prevResolved);
    const monthResolvedPercent = monthReported > 0 ? Math.round((monthResolved / monthReported) * 100) : 0;

    if (subtitleEl) {
        subtitleEl.textContent = `${currentLabel} · Reported ${monthReported} · Resolved ${monthResolved}`;
    }

    const rows = `
        <tr>
            <td><strong>This Month</strong></td>
            <td><strong>${monthReported}</strong></td>
            <td>${monthReportedChange}</td>
            <td><strong>${monthResolved}</strong></td>
            <td>${monthResolvedChange}</td>
            <td>${monthResolvedPercent}%</td>
        </tr>
        <tr>
            <td><strong>This Year</strong></td>
            <td><strong>${yearReported}</strong></td>
            <td>—</td>
            <td><strong>${yearResolved}</strong></td>
            <td>—</td>
            <td>${yearReported > 0 ? Math.round((yearResolved / yearReported) * 100) : 0}%</td>
        </tr>
    `;

    tableBody.innerHTML = rows;
}

function formatTableChange(diff) {
    if (diff === 0) return '—';
    if (diff > 0) return `🔺${diff}`;
    return `🔻${Math.abs(diff)}`;
}

function escapeChartText(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Round data max up to a readable axis top (e.g. 7→10, 23→25) so bars use real scale, not always 100%. */
function niceAxisMax(dataMax) {
    if (dataMax <= 0) return 1;
    const exp = Math.floor(Math.log10(dataMax));
    const pow10 = 10 ** exp;
    const n = dataMax / pow10;
    let nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    let top = nice * pow10;
    if (top < dataMax) {
        const step = top;
        top = Math.ceil(dataMax / step) * step;
    }
    return Math.max(top, 1);
}

function buildAxisTickLabels(axisMax, tickCount = 5) {
    const ticks = [];
    for (let i = tickCount; i >= 0; i--) {
        const raw = (axisMax * i) / tickCount;
        ticks.push(Number.isInteger(raw) ? raw : Math.round(raw * 100) / 100);
    }
    return ticks;
}

/**
 * Proper bar chart: fixed plot height, Y-axis scale, grid; bar height = value / axisMax (not relative only to max bar).
 */
function renderTableBarChartRows(containerId, heading, bars, yAxisLabel = 'Count') {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!bars || bars.length === 0) {
        container.innerHTML = '';
        return;
    }
    const numericValues = bars.map(b => Number(b.value) || 0);
    const dataMax = Math.max(...numericValues, 0);
    const axisMax = niceAxisMax(dataMax);
    const ticks = buildAxisTickLabels(axisMax, 5);
    const tickHtml = ticks.map(t => `<span>${t.toLocaleString()}</span>`).join('');

    const barHtml = bars.map((b, i) => {
        const v = numericValues[i];
        const pct = axisMax > 0 ? Math.min(100, (v / axisMax) * 100) : 0;
        const bg = b.color || '#64748b';
        const label = escapeChartText(b.label || '');
        return `
            <div class="table-chart-bar-slot">
                <div class="table-chart-bar-fill" style="--bar-pct:${pct};background:${bg}" aria-label="${label}: ${v}">
                    <span class="table-chart-bar-value">${v.toLocaleString()}</span>
                </div>
                <span class="table-chart-label">${label}</span>
            </div>`;
    }).join('');

    container.innerHTML = `
        <p class="table-chart-heading">${escapeChartText(heading)}</p>
        <div class="table-chart-viz" role="img" aria-label="${escapeChartText(heading)}: ${bars.map((b, i) => `${b.label} ${numericValues[i]}`).join(', ')}">
            <div class="table-chart-y-label">${escapeChartText(yAxisLabel)}</div>
            <div class="table-chart-y-axis" aria-hidden="true">${tickHtml}</div>
            <div class="table-chart-plot-wrap">
                <div class="table-chart-plot">
                    <div class="table-chart-grid-bg" style="--grid-lines:5"></div>
                    <div class="table-chart-bar-layer">${barHtml}</div>
                </div>
                <p class="table-chart-x-title">Categories</p>
            </div>
        </div>`;
}

function renderConcernsTableChart(data) {
    const monthData = data.concerns?.month || { reported: 0, resolved: 0 };
    const yearData = data.concerns?.year || { reported: 0, resolved: 0 };
    renderTableBarChartRows('concernsTableChart', 'Bar graph', [
        { label: 'This month · Reported', value: monthData.reported || 0, color: '#3b82f6' },
        { label: 'This month · Resolved', value: monthData.resolved || 0, color: '#22c55e' },
        { label: 'This year · Reported', value: yearData.reported || 0, color: '#6366f1' },
        { label: 'This year · Resolved', value: yearData.resolved || 0, color: '#14b8a6' }
    ], 'Bilang');
}

function renderEmergencyTableChart(data) {
    const monthData = data.emergencies?.month || { reported: 0, resolved: 0 };
    const yearData = data.emergencies?.year || { reported: 0, resolved: 0 };
    renderTableBarChartRows('emergencyTableChart', 'Bar graph', [
        { label: 'This month · Reported', value: monthData.reported || 0, color: '#ec4899' },
        { label: 'This month · Resolved', value: monthData.resolved || 0, color: '#a855f7' },
        { label: 'This year · Reported', value: yearData.reported || 0, color: '#f97316' },
        { label: 'This year · Resolved', value: yearData.resolved || 0, color: '#eab308' }
    ], 'Bilang');
}

function renderDocumentRequestsTableChart(data) {
    const container = document.getElementById('documentRequestsTableChart');
    if (!container) return;

    const monthData = data.documents?.month || {};
    const yearData = data.documents?.year || {};
    const docTypes = Object.keys(monthData).filter(key => key.toLowerCase() !== 'total');

    if (docTypes.length === 0) {
        container.innerHTML = '';
        return;
    }

    const allValues = [];
    docTypes.forEach(t => {
        allValues.push(Number(monthData[t]) || 0, Number(yearData[t]) || 0);
    });
    allValues.push(Number(monthData.total) || 0, Number(yearData.total) || 0);
    const dataMax = Math.max(...allValues, 0);
    const axisMax = niceAxisMax(dataMax);
    const ticks = buildAxisTickLabels(axisMax, 5);
    const tickHtml = ticks.map(t => `<span>${t.toLocaleString()}</span>`).join('');

    const barPct = v => (axisMax > 0 ? Math.min(100, ((Number(v) || 0) / axisMax) * 100) : 0);

    const barPair = (monthCount, yearCount) => {
        const mv = Number(monthCount) || 0;
        const yv = Number(yearCount) || 0;
        return `
            <div class="table-chart-doc-pair-inner">
                <div class="table-chart-bar-slot table-chart-bar-slot--pair">
                    <div class="table-chart-bar-fill table-chart-bar-fill--doc-month" style="--bar-pct:${barPct(mv)}" aria-label="This month: ${mv}">
                        <span class="table-chart-bar-value">${mv.toLocaleString()}</span>
                    </div>
                    <span class="table-chart-label">Month</span>
                </div>
                <div class="table-chart-bar-slot table-chart-bar-slot--pair">
                    <div class="table-chart-bar-fill table-chart-bar-fill--doc-year" style="--bar-pct:${barPct(yv)}" aria-label="This year: ${yv}">
                        <span class="table-chart-bar-value">${yv.toLocaleString()}</span>
                    </div>
                    <span class="table-chart-label">Year</span>
                </div>
            </div>`;
    };

    const typeBlocks = docTypes.map(type => `
        <div class="table-chart-doc-group table-chart-doc-group--viz">
            ${barPair(monthData[type], yearData[type])}
            <span class="table-chart-doc-name">${escapeChartText(type)}</span>
        </div>`).join('');

    const totalBlock = `
        <div class="table-chart-doc-group table-chart-doc-group--viz">
            ${barPair(monthData.total, yearData.total)}
            <span class="table-chart-doc-name">Total</span>
        </div>`;

    container.innerHTML = `
        <p class="table-chart-heading">Bar graph</p>
        <div class="table-chart-legend">
            <span><i class="table-chart-legend-swatch month" aria-hidden="true"></i> This month</span>
            <span><i class="table-chart-legend-swatch year" aria-hidden="true"></i> This year</span>
        </div>
        <div class="table-chart-viz table-chart-viz--documents" role="img" aria-label="Document requests by type">
            <div class="table-chart-y-label">Bilang</div>
            <div class="table-chart-y-axis" aria-hidden="true">${tickHtml}</div>
            <div class="table-chart-plot-wrap table-chart-plot-wrap--documents">
                <div class="table-chart-plot">
                    <div class="table-chart-grid-bg" style="--grid-lines:5"></div>
                    <div class="table-chart-bar-layer table-chart-bar-layer--documents">${typeBlocks}${totalBlock}</div>
                </div>
                <p class="table-chart-x-title">Document type</p>
            </div>
        </div>`;
}

function sitioListLength() {
    return analyticsPayload?.bySitio?.length ?? 0;
}

function syncSitioSelectFromIndex() {
    const sel = document.getElementById('analyticsSitioSelect');
    const list = analyticsPayload?.bySitio;
    if (!sel || !list?.length || !list[sitioAnalyticsIndex]) return;
    sel.value = list[sitioAnalyticsIndex].sitio;
}

function setSitioAnalyticsSubtitle() {
    const sub = document.getElementById('sitioAnalyticsSubtitle');
    if (!sub || !analyticsPayload?.bySitio?.length) return;
    const s = analyticsPayload.bySitio[sitioAnalyticsIndex]?.sitio || '';
    const ml = analyticsPayload.documents?.monthLabel || '';
    sub.textContent = ml
        ? `Sitio: ${s} · Saklaw: ${ml} · Hinahanap ang sitio sa location (concerns/emergency) o address (documents).`
        : `Sitio: ${s} · Hinahanap ang sitio sa location o address.`;
}

function updateSitioGraphTypeLabel() {
    const el = document.getElementById('sitioGraphTypeLabel');
    if (el) {
        el.textContent = SITIO_GRAPH_LABELS[sitioGraphKind] ?? SITIO_GRAPH_LABELS[0];
    }
}

function renderSitioDocumentChart(containerId, sitioName, monthData, yearData) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const month = monthData || {};
    const year = yearData || {};
    const docTypes = Object.keys(month).filter(key => key.toLowerCase() !== 'total');

    if (docTypes.length === 0) {
        container.innerHTML = `<p class="table-chart-heading">${escapeChartText(sitioName)} · Document requests</p><p class="sitio-chart-empty">Walang uri ng dokumento sa datos.</p>`;
        return;
    }

    const allValues = [];
    docTypes.forEach(t => {
        allValues.push(Number(month[t]) || 0, Number(year[t]) || 0);
    });
    allValues.push(Number(month.total) || 0, Number(year.total) || 0);
    const dataMax = Math.max(...allValues, 0);
    const axisMax = niceAxisMax(dataMax);
    const ticks = buildAxisTickLabels(axisMax, 5);
    const tickHtml = ticks.map(t => `<span>${t.toLocaleString()}</span>`).join('');
    const barPct = v => (axisMax > 0 ? Math.min(100, ((Number(v) || 0) / axisMax) * 100) : 0);

    const barPair = (monthCount, yearCount) => {
        const mv = Number(monthCount) || 0;
        const yv = Number(yearCount) || 0;
        return `
            <div class="table-chart-doc-pair-inner">
                <div class="table-chart-bar-slot table-chart-bar-slot--pair">
                    <div class="table-chart-bar-fill table-chart-bar-fill--doc-month" style="--bar-pct:${barPct(mv)}" aria-label="This month: ${mv}">
                        <span class="table-chart-bar-value">${mv.toLocaleString()}</span>
                    </div>
                    <span class="table-chart-label">Month</span>
                </div>
                <div class="table-chart-bar-slot table-chart-bar-slot--pair">
                    <div class="table-chart-bar-fill table-chart-bar-fill--doc-year" style="--bar-pct:${barPct(yv)}" aria-label="This year: ${yv}">
                        <span class="table-chart-bar-value">${yv.toLocaleString()}</span>
                    </div>
                    <span class="table-chart-label">Year</span>
                </div>
            </div>`;
    };

    const typeBlocks = docTypes.map(type => `
        <div class="table-chart-doc-group table-chart-doc-group--viz">
            ${barPair(month[type], year[type])}
            <span class="table-chart-doc-name">${escapeChartText(type)}</span>
        </div>`).join('');

    const totalBlock = `
        <div class="table-chart-doc-group table-chart-doc-group--viz">
            ${barPair(month.total, year.total)}
            <span class="table-chart-doc-name">Total</span>
        </div>`;

    container.innerHTML = `
        <p class="table-chart-heading">${escapeChartText(sitioName)} · Document requests</p>
        <div class="table-chart-legend">
            <span><i class="table-chart-legend-swatch month" aria-hidden="true"></i> This month</span>
            <span><i class="table-chart-legend-swatch year" aria-hidden="true"></i> This year</span>
        </div>
        <div class="table-chart-viz table-chart-viz--documents" role="img" aria-label="Document requests by sitio">
            <div class="table-chart-y-label">Bilang</div>
            <div class="table-chart-y-axis" aria-hidden="true">${tickHtml}</div>
            <div class="table-chart-plot-wrap table-chart-plot-wrap--documents">
                <div class="table-chart-plot">
                    <div class="table-chart-grid-bg" style="--grid-lines:5"></div>
                    <div class="table-chart-bar-layer table-chart-bar-layer--documents">${typeBlocks}${totalBlock}</div>
                </div>
                <p class="table-chart-x-title">Document type</p>
            </div>
        </div>`;
}

function renderSitioChartView() {
    const list = analyticsPayload?.bySitio;
    if (!list?.length) return;
    const block = list[sitioAnalyticsIndex];
    if (!block) return;
    const sitio = block.sitio || '';

    if (sitioGraphKind === 0) {
        const monthData = block.concerns?.month || { reported: 0, resolved: 0 };
        const yearData = block.concerns?.year || { reported: 0, resolved: 0 };
        renderTableBarChartRows('sitioPerSitioChart', `${sitio} · Concerns`, [
            { label: 'This month · Reported', value: monthData.reported || 0, color: '#3b82f6' },
            { label: 'This month · Resolved', value: monthData.resolved || 0, color: '#22c55e' },
            { label: 'This year · Reported', value: yearData.reported || 0, color: '#6366f1' },
            { label: 'This year · Resolved', value: yearData.resolved || 0, color: '#14b8a6' }
        ], 'Bilang');
    } else if (sitioGraphKind === 1) {
        const monthData = block.emergencies?.month || { reported: 0, resolved: 0 };
        const yearData = block.emergencies?.year || { reported: 0, resolved: 0 };
        renderTableBarChartRows('sitioPerSitioChart', `${sitio} · Emergency alerts`, [
            { label: 'This month · Reported', value: monthData.reported || 0, color: '#ec4899' },
            { label: 'This month · Resolved', value: monthData.resolved || 0, color: '#a855f7' },
            { label: 'This year · Reported', value: yearData.reported || 0, color: '#f97316' },
            { label: 'This year · Resolved', value: yearData.resolved || 0, color: '#eab308' }
        ], 'Bilang');
    } else {
        renderSitioDocumentChart('sitioPerSitioChart', sitio, block.documents?.month, block.documents?.year);
    }
}

function renderSitioAnalyticsPanel(data) {
    const sub = document.getElementById('sitioAnalyticsSubtitle');
    const chartEl = document.getElementById('sitioPerSitioChart');
    const list = data?.bySitio;

    if (!list || list.length === 0) {
        if (sub) {
            sub.textContent = 'Walang naka-load na datos ayon sa sitio (i-check ang analytics API).';
        }
        if (chartEl) chartEl.innerHTML = '';
        return;
    }

    sitioAnalyticsIndex = Math.max(0, Math.min(sitioAnalyticsIndex, list.length - 1));
    syncSitioSelectFromIndex();

    setSitioAnalyticsSubtitle();

    updateSitioGraphTypeLabel();
    renderSitioChartView();
}

function setupSitioAnalyticsControls() {
    const n = () => sitioListLength();

    document.getElementById('sitioPrevBtn')?.addEventListener('click', () => {
        const len = n();
        if (len < 1) return;
        sitioAnalyticsIndex = (sitioAnalyticsIndex - 1 + len) % len;
        syncSitioSelectFromIndex();
        renderSitioChartView();
        setSitioAnalyticsSubtitle();
    });

    document.getElementById('sitioNextBtn')?.addEventListener('click', () => {
        const len = n();
        if (len < 1) return;
        sitioAnalyticsIndex = (sitioAnalyticsIndex + 1) % len;
        syncSitioSelectFromIndex();
        renderSitioChartView();
        setSitioAnalyticsSubtitle();
    });

    document.getElementById('analyticsSitioSelect')?.addEventListener('change', e => {
        const v = e.target.value;
        const list = analyticsPayload?.bySitio || [];
        if (!v) return;
        const idx = list.findIndex(x => x.sitio === v);
        if (idx >= 0) {
            sitioAnalyticsIndex = idx;
            renderSitioChartView();
            setSitioAnalyticsSubtitle();
        }
    });

    document.getElementById('sitioGraphPrevBtn')?.addEventListener('click', () => {
        sitioGraphKind = (sitioGraphKind + 2) % 3;
        updateSitioGraphTypeLabel();
        renderSitioChartView();
    });

    document.getElementById('sitioGraphNextBtn')?.addEventListener('click', () => {
        sitioGraphKind = (sitioGraphKind + 1) % 3;
        updateSitioGraphTypeLabel();
        renderSitioChartView();
    });
}

function formatTableChangeWithComparison(current, previous) {
    // If previous is null/undefined or 0 and current is 0, show no change
    if ((previous == null || previous === 0) && current === 0) {
        return '—';
    }
    
    // If previous is null/undefined or 0, show current vs 0 with increase
    if (previous == null || previous === 0) {
        if (current === 0) {
            return '—';
        }
        return `${current} vs 0 (↑ ${current})`;
    }
    
    // If current is 0 and previous exists, show decrease
    if (current === 0) {
        const diff = 0 - previous;
        return `${current} vs ${previous} (↓ ${Math.abs(diff)})`;
    }
    
    // Both have values, calculate difference
    const diff = current - previous;
    
    if (diff === 0) {
        return `${current} vs ${previous} (—)`;
    }
    
    const arrow = diff > 0 ? '↑' : '↓';
    const diffAbs = Math.abs(diff);
    
    return `${current} vs ${previous} (${arrow} ${diffAbs})`;
}

function renderEmergencyAlertsTable(data, period = 'month') {
    const tableBody = document.getElementById('emergencyAlertsTableBody');
    const subtitleEl = document.getElementById('emergencyAlertsSubtitle');
    
    if (!tableBody) return;

    const currentLabel = data.emergencies?.monthLabel || (period === 'year' ? 'Current Year' : 'Current Month');

    const monthData = data.emergencies?.month || { reported: 0, resolved: 0 };
    const yearData = data.emergencies?.year || { reported: 0, resolved: 0 };
    const previousData = data.emergencies?.previous || { reported: 0, resolved: 0 };

    const monthReported = monthData.reported || 0;
    const monthResolved = monthData.resolved || 0;
    const yearReported = yearData.reported || 0;
    const yearResolved = yearData.resolved || 0;
    const prevReported = previousData.reported || 0;
    const prevResolved = previousData.resolved || 0;

    const monthReportedChange = formatTableChangeWithComparison(monthReported, prevReported);
    const monthResolvedChange = formatTableChangeWithComparison(monthResolved, prevResolved);
    const monthResolvedPercent = monthReported > 0 ? Math.round((monthResolved / monthReported) * 100) : 0;

    if (subtitleEl) {
        subtitleEl.textContent = `${currentLabel} · Reported ${monthReported} · Resolved ${monthResolved}`;
    }

    const rows = `
        <tr>
            <td><strong>This Month</strong></td>
            <td><strong>${monthReported}</strong></td>
            <td>${monthReportedChange}</td>
            <td><strong>${monthResolved}</strong></td>
            <td>${monthResolvedChange}</td>
            <td>${monthResolvedPercent}%</td>
        </tr>
        <tr>
            <td><strong>This Year</strong></td>
            <td><strong>${yearReported}</strong></td>
            <td>—</td>
            <td><strong>${yearResolved}</strong></td>
            <td>—</td>
            <td>${yearReported > 0 ? Math.round((yearResolved / yearReported) * 100) : 0}%</td>
        </tr>
    `;

    tableBody.innerHTML = rows;
}

function renderDocumentRequestsTable(data, period = 'month') {
    const tableBody = document.getElementById('documentRequestsTableBody');
    const subtitleEl = document.getElementById('documentRequestsSubtitle');
    
    if (!tableBody) return;

    const currentLabel = data.documents?.monthLabel || (period === 'year' ? 'Current Year' : 'Current Month');

    const monthData = data.documents?.month || {};
    const yearData = data.documents?.year || {};
    const previousData = data.documents?.previous || {};

    // Get document types (exclude 'total')
    const docTypes = Object.keys(monthData).filter(key => key.toLowerCase() !== 'total');
    
    if (docTypes.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="table-loading">No data available</td></tr>';
        return;
    }

    const rows = docTypes.map(docType => {
        const monthCount = monthData[docType] || 0;
        const yearCount = yearData[docType] || 0;
        const prevCount = previousData[docType] || 0;
        const monthChange = formatTableChangeWithComparison(monthCount, prevCount);

        return `
            <tr>
                <td><strong>${docType}</strong></td>
                <td><strong>${monthCount}</strong></td>
                <td>${monthChange}</td>
                <td><strong>${yearCount}</strong></td>
                <td><strong>${yearCount}</strong></td>
            </tr>
        `;
    }).join('');

    // Add total row
    const monthTotal = monthData.total || 0;
    const yearTotal = yearData.total || 0;
    const prevTotal = previousData.total || 0;
    const totalChange = formatTableChangeWithComparison(monthTotal, prevTotal);

    if (subtitleEl) {
        subtitleEl.textContent = `${currentLabel} · This month ${monthTotal} · This year ${yearTotal}`;
    }

    const totalRow = `
        <tr style="background: #f1f5f9; font-weight: 700;">
            <td><strong>Total</strong></td>
            <td><strong>${monthTotal}</strong></td>
            <td>${totalChange}</td>
            <td><strong>${yearTotal}</strong></td>
            <td><strong>${yearTotal}</strong></td>
        </tr>
    `;

    tableBody.innerHTML = rows + totalRow;
}

function renderActiveUsersTable(data) {
    const tableBody = document.getElementById('activeUsersTableBody');
    const subtitleEl = document.getElementById('activeUsersSubtitle');
    
    if (!tableBody) return;

    const users = data.users?.activeUsersList || [];
    const currentLabel = data.documents?.monthLabel || 'Current Month';
    
    if (subtitleEl) {
        subtitleEl.textContent = currentLabel;
    }

    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="table-loading">No active users</td></tr>';
        return;
    }

    // Function to format hours as "1h 30mins" or "0h 27mins"
    // Database stores hours as decimal (0.45 = 27 minutes, 0.20 = 12 minutes)
    function formatActiveHours(hours) {
        if (hours == null || hours === 0) return '0h';
        
        // Convert hours to total minutes (0.45 hours = 27 minutes, 0.20 hours = 12 minutes)
        const totalMinutes = Math.floor(hours * 60);
        const h = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        
        // Format: Show hours and minutes separately
        // Examples: 0.45h = 27mins, 0.20h = 12mins, 1.5h = 1h 30mins, 2h = 2h
        if (h === 0 && mins === 0) {
            return '0h';
        } else if (h === 0) {
            return `${mins}mins`;
        } else if (mins === 0) {
            return `${h}h`;
        } else {
            return `${h}h ${mins}mins`;
        }
    }

    const rows = users.map(user => {
        const hours = user.hours != null ? formatActiveHours(user.hours) : '—';
        const lastLogin = user.lastLogin 
            ? formatAnalyticsDate(user.lastLogin)
            : 'Never';
        const status = user.status || 'Active';
        // Get session status from database online_offline column
        const sessionStatus = (user.online_offline || 'offline').toLowerCase();

        return `
            <tr>
                <td>${user.name || 'Unknown'}</td>
                <td>${user.position || 'N/A'}</td>
                <td>${hours}</td>
                <td>${lastLogin}</td>
                <td><span class="status-badge status-${sessionStatus}">${sessionStatus === 'online' ? 'Online' : 'Offline'}</span></td>
                <td><span class="status-badge status-${status.toLowerCase()}">${status}</span></td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = rows;
}

function renderJobseekerReportTable(data) {
    const tableBody = document.getElementById('jobseekerReportTableBody');
    const tableHead = document.getElementById('jobseekerReportTableHead');
    
    if (!tableBody || !tableHead) return;

    const reports = data.jobseekerReports || [];

    if (reports.length === 0) {
        tableHead.innerHTML = '<tr><th class="table-loading">No data available</th></tr>';
        tableBody.innerHTML = '<tr><td colspan="100" class="table-loading">No jobseeker reports found</td></tr>';
        return;
    }

    // Define column order: No., Last Name, First Name, Middle Name, Age, Month, Day, Year, Sex, Elementary, High School, College, Course, Out of School
    const columnOrder = [
        { key: 'no', label: 'NO.' },
        { key: 'last_name', label: 'LAST NAME' },
        { key: 'first_name', label: 'FIRST NAME' },
        { key: 'middle_name', label: 'MIDDLE NAME' },
        { key: 'age', label: 'AGE' },
        { key: 'birth_month', label: 'MONTH' },
        { key: 'birth_day', label: 'DAY' },
        { key: 'birth_year', label: 'YEAR' },
        { key: 'sex', label: 'SEX' },
        { key: 'elementary_check', label: 'ELEMENTARY', isCheckmark: true },
        { key: 'high_school_check', label: 'HIGH SCHOOL', isCheckmark: true },
        { key: 'college_check', label: 'COLLEGE', isCheckmark: true },
        { key: 'course', label: 'COURSE' },
        { key: 'out_of_school_youth', label: 'OUT OF SCHOOL YOUTH', isCheckmark: true }
    ];

    // Create table header
    const headerRow = columnOrder.map(col => {
        const singleLineHeader = col.label.replace(/ /g, '&nbsp;');
        return `<th>${singleLineHeader}</th>`;
    }).join('');

    tableHead.innerHTML = `<tr>${headerRow}</tr>`;

    // Create table rows
    const rows = reports.map(report => {
        const cells = columnOrder.map(col => {
            let value = report[col.key] ?? '';
            
            // Handle checkmark columns
            if (col.isCheckmark) {
                const checkValue = parseInt(value) || 0;
                // Show checkmark (✓) if value is 1, otherwise blank
                return `<td style="text-align: center;">${checkValue === 1 ? '✓' : ''}</td>`;
            }
            
            // Format birthdate components
            if (col.key === 'birth_month' && value) {
                const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const monthNum = parseInt(value);
                value = monthNum >= 1 && monthNum <= 12 ? monthNames[monthNum] : value;
            }
            
            return `<td>${value || '—'}</td>`;
        }).join('');
        
        return `<tr>${cells}</tr>`;
    }).join('');

    tableBody.innerHTML = rows;
}

