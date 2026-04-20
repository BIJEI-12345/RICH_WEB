document.addEventListener('DOMContentLoaded', () => {
    setupSidebarButtons();
    setupAnalyticsForm();
    initializeRangeControls();
    setupScrollToTop();
    setupPrintButtons();
    setupChartViewControls();
    setupAnalyticsSectionTabs();
    setupAnalyticsSidebarCollapse();
});

/**
 * Left sidebar tabs: one analytics section visible at a time; all closed until a tab is chosen.
 */
function setupAnalyticsSectionTabs() {
    const placeholder = document.getElementById('analyticsTabPlaceholder');
    const buttons = document.querySelectorAll('.analytics-tab-btn[data-tab]');
    const panels = document.querySelectorAll('.analytics-tab-panel[data-tab-panel]');
    if (!placeholder || !buttons.length || !panels.length) return;

    function showTab(tabId) {
        placeholder.hidden = true;
        panels.forEach((panel) => {
            const match = panel.getAttribute('data-tab-panel') === tabId;
            panel.hidden = !match;
        });
        buttons.forEach((btn) => {
            const active = btn.getAttribute('data-tab') === tabId;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            if (!tabId) return;
            showTab(tabId);
        });
    });
}

const ANALYTICS_SIDEBAR_KEY = 'analyticsSidebarCollapsed';

function setupAnalyticsSidebarCollapse() {
    const layout = document.getElementById('analyticsPageLayout');
    const hideBtn = document.getElementById('analyticsSidebarHide');
    const showBtn = document.getElementById('analyticsSidebarShow');
    if (!layout || !hideBtn || !showBtn) return;

    function applyCollapsed(collapsed) {
        layout.classList.toggle('is-sidebar-collapsed', collapsed);
        hideBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        showBtn.hidden = !collapsed;
        showBtn.setAttribute('aria-expanded', collapsed ? 'true' : 'false');
        try {
            localStorage.setItem(ANALYTICS_SIDEBAR_KEY, collapsed ? '1' : '0');
        } catch (e) {
            /* ignore */
        }
    }

    let collapsed = false;
    try {
        collapsed = localStorage.getItem(ANALYTICS_SIDEBAR_KEY) === '1';
    } catch (e) {
        collapsed = false;
    }
    applyCollapsed(collapsed);

    hideBtn.addEventListener('click', () => applyCollapsed(true));
    showBtn.addEventListener('click', () => applyCollapsed(false));
}

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
    const printSection = (printBtnId, fallbackTitle) => {
        document.getElementById(printBtnId)?.addEventListener('click', () => {
            const container = document.getElementById(printBtnId)?.closest('.analytics-table-container');
            if (container) {
                const title = container.querySelector('.table-header h5')?.textContent || fallbackTitle;
                printTableWrapper(container, title);
            }
        });
    };

    printSection('printDocumentTable', 'Document Requests');
    printSection('printConcernsTable', 'Concerns');
    printSection('printEmergencyTable', 'Emergency Reports');
    printSection('printUsersTable', 'Active Users');
    printSection('printJobseekerTable', 'Jobseeker Report');
}

function printTableWrapper(container, tableTitle) {
    const tableWrapper = container.querySelector('.table-wrapper');
    const chartsFallback =
        container.querySelector('.document-requests-charts-box') ||
        container.querySelector('.analytics-table-chart');
    const contentEl = tableWrapper || chartsFallback;

    if (!contentEl) {
        console.error('No printable content');
        return;
    }

    const wrapperClone = contentEl.cloneNode(true);
    
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
/** Huling analytics payload para sa Bar/Pie toggle */
let lastAnalyticsData = null;

/** Bar | Pie + pie filters (main analytics tables) */
const chartViewState = {
    concernsShowBar: true,
    concernsShowPie: true,
    concernsSitioFilter: '',
    /** Pie: `period` = 4 na kategorya (buwan/taon); `bySitio` = bawat slice ay sitio mula sa `bySitio` (default — walang UI toggle) */
    concernsPieLayout: 'bySitio',
    concernsPieSitioMetric: 'all',
    concernsPieSitioScope: 'month',
    concernsPieSitioTop: 'all',
    emergencyShowBar: true,
    emergencyShowHeatmap: true,
    emergencySitioFilter: '',
    /** Heat map: `YYYY-MM` (calendar year mula sa API); kung `''` → default current month */
    emergencyHeatmapMonthKey: '',
    /** Document requests: parehong maaaring ipakita; toggle lang ang visibility */
    documentsShowBar: true,
    documentsShowPie: true,
    /** '' = lahat (total / by type); kung may value = breakdown ayon sa sitio para sa type na iyon */
    documentsDocFilter: '',
    /** '' = lahat ng sitio; kung may value = isang sitio lang (mula sa `bySitio`) */
    documentsSitioFilter: '',
    documentsPieMetric: 'month',
    documentsPieHideZero: false,
    /** Year bar chart: `0`–`11` — kung aling buwan ang ipinapakita (default: kasalukuyang buwan) */
    documentsYearMonthTab: new Date().getMonth()
};

const DOCUMENT_PIE_COLORS = ['#0ea5e9', '#2563eb', '#6366f1', '#8b5cf6', '#a855f7', '#14b8a6', '#f97316', '#22c55e', '#ec4899'];

/** Fixed gradient + solid (pie) bawat uri ng dokumento — tumutugma sa analytics na hiniling. */
const DOCUMENT_TYPE_STYLES = {
    'Barangay ID': { gradient: 'linear-gradient(135deg, #3498db, #2980b9)', pie: '#3498db' },
    Clearance: { gradient: 'linear-gradient(135deg, #27ae60, #229954)', pie: '#27ae60' },
    Indigency: { gradient: 'linear-gradient(135deg, #9b59b6, #8e44ad)', pie: '#9b59b6' },
    COE: { gradient: 'linear-gradient(135deg, #f39c12, #d68910)', pie: '#f39c12' },
    Certification: { gradient: 'linear-gradient(135deg, #e74c3c, #c0392b)', pie: '#e74c3c' },
    Total: { gradient: 'linear-gradient(135deg, #64748b, #475569)', pie: '#64748b' }
};

function getDocumentTypeGradient(docLabel) {
    const key = docLabel == null || docLabel === '' ? 'Total' : String(docLabel);
    if (DOCUMENT_TYPE_STYLES[key]) {
        return DOCUMENT_TYPE_STYLES[key].gradient;
    }
    let h = 0;
    for (let i = 0; i < key.length; i++) {
        h = (h + key.charCodeAt(i) * (i + 1)) % 10000;
    }
    const a = DOCUMENT_PIE_COLORS[h % DOCUMENT_PIE_COLORS.length];
    const b = DOCUMENT_PIE_COLORS[(h + 3) % DOCUMENT_PIE_COLORS.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
}

function getDocumentTypePieColor(docLabel) {
    const key = docLabel == null || docLabel === '' ? 'Total' : String(docLabel);
    if (DOCUMENT_TYPE_STYLES[key]) {
        return DOCUMENT_TYPE_STYLES[key].pie;
    }
    let h = 0;
    for (let i = 0; i < key.length; i++) {
        h = (h + key.charCodeAt(i)) % 1000;
    }
    return DOCUMENT_PIE_COLORS[h % DOCUMENT_PIE_COLORS.length];
}

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
        title: 'Emergency Reports',
        description: 'Monitor emergencies and their resolution status.',
        actionLabel: 'Open emergency panel',
        secondaryLabel: 'Download log',
        color: 'linear-gradient(135deg, #ef4444, #dc2626)'
    },
    census: {
        title: 'Census Overview',
        description: 'Residents and households by sitio from active census records.',
        actionLabel: 'Open census',
        secondaryLabel: 'View records',
        color: 'linear-gradient(135deg, #0d9488, #155e75)'
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

/**
 * @param {object} [options]
 * @param {boolean} [options.includeAllSitios=true] — kung false, walang "All sitios"; unang sitio ang default.
 */
function populateSitioFilterDropdown(selectId, stateKey, data, options = {}) {
    const includeAllSitios = options.includeAllSitios !== false;
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const list = Array.isArray(data?.sitioList)
        ? data.sitioList
        : (data?.bySitio || []).map(b => b.sitio).filter(Boolean);
    const current = chartViewState[stateKey] || '';
    sel.innerHTML = '';
    if (includeAllSitios) {
        const opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = 'All sitios';
        sel.appendChild(opt0);
    }
    list.forEach(s => {
        const o = document.createElement('option');
        o.value = s;
        o.textContent = s;
        sel.appendChild(o);
    });
    if (includeAllSitios) {
        if (current && list.includes(current)) {
            sel.value = current;
        } else {
            sel.value = '';
            chartViewState[stateKey] = '';
        }
        return;
    }

    if (list.length === 0) {
        chartViewState[stateKey] = '';
        return;
    }
    if (current && list.includes(current)) {
        sel.value = current;
        chartViewState[stateKey] = current;
    } else {
        const first = list[0];
        sel.value = first;
        chartViewState[stateKey] = first;
    }
}

function populateAllSitioFilterDropdowns(data) {
    populateSitioFilterDropdown('documentRequestsSitioFilter', 'documentsSitioFilter', data, {
        includeAllSitios: false
    });
    populateSitioFilterDropdown('concernsSitioFilter', 'concernsSitioFilter', data);
    populateSitioFilterDropdown('emergencySitioFilter', 'emergencySitioFilter', data);
}

function populateAnalytics(data, period = 'month') {
    lastAnalyticsData = data;
    populateAllSitioFilterDropdowns(data);
    renderGraph(data);
    populateSectionPanel(currentSection);
    renderGraphPlaceholders(data);
    renderActivitySummaryTable(data, period);
    updateSentimentFeedbackTotal(data, period);
    updateSentimentRateCounts(data);
    updateSentimentInsightPanel(data, period);
    updateSentimentConcernStarsFromAverage(data);
    updateSentimentRatingLineChart(data);
    renderEmergencyAlertsTable(data, period);
    renderDocumentRequestsTable(data, period);
    renderConcernsTableChart(data);
    renderEmergencyTableChart(data);
    renderDocumentRequestsTableChart(data);
    renderActiveUsersTable(data);
    renderJobseekerReportTable(data);
    renderCensusAnalyticsPanel(data);
    
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

    updateMainChartToolbarUi();
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
        case 'census':
            titleEl.textContent = 'Census';
            subtitle = 'Active residents and households.';
            monthSummary = `${analyticsPayload.census?.totalResidents ?? '—'} residents`;
            yearSummary = `${analyticsPayload.census?.totalHouseholds ?? '—'} households`;
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
    const subtitleEl = document.getElementById('activitySummarySubtitle');
    if (!subtitleEl) {
        return;
    }

    const currentLabel = data.concerns?.monthLabel || (period === 'year' ? 'Current Year' : 'Current Month');
    const monthData = data.concerns?.month || { reported: 0, resolved: 0 };
    const monthReported = monthData.reported || 0;
    const monthResolved = monthData.resolved || 0;

    subtitleEl.textContent = `${currentLabel} · Reported ${monthReported} · Resolved ${monthResolved}`;
}

function updateSentimentFeedbackTotal(data, period = 'month') {
    const totalEl = document.getElementById('sentimentFeedbackTotal');
    if (!totalEl) {
        return;
    }

    const concernBlock = period === 'year' ? data?.concerns?.year : data?.concerns?.month;
    const reportedCount = Number(concernBlock?.reported);
    totalEl.textContent = Number.isFinite(reportedCount) ? reportedCount.toLocaleString() : '0';
}

function updateSentimentRateCounts(data) {
    const positiveCountEl = document.getElementById('sentimentPositiveRateCount');
    const negativeCountEl = document.getElementById('sentimentNegativeRateCount');
    if (!positiveCountEl && !negativeCountEl) {
        return;
    }

    const totals = data?.concerns?.ratingLineSeries?.totals || {};
    const low = Number(totals.low) || 0; // rating 1-2
    const mid = Number(totals.mid) || 0; // rating 3
    const high = Number(totals.high) || 0; // rating 4-5

    // Rule: Positive = 3 and above; Negative = 2 and below.
    const positiveCount = mid + high;
    const negativeCount = low;

    if (positiveCountEl) {
        positiveCountEl.textContent = `Rate count: ${positiveCount.toLocaleString()}`;
    }
    if (negativeCountEl) {
        negativeCountEl.textContent = `Rate count: ${negativeCount.toLocaleString()}`;
    }
}

function updateSentimentInsightPanel(data, period = 'month') {
    const block = period === 'year' ? data?.concerns?.sentimentInsights?.year : data?.concerns?.sentimentInsights?.month;
    const positiveInterpretation = document.getElementById('sentimentPositiveInterpretation');
    const negativeInterpretation = document.getElementById('sentimentNegativeInterpretation');
    const positiveWordsWrap = document.getElementById('sentimentPositiveWords');
    const negativeWordsWrap = document.getElementById('sentimentNegativeWords');

    if (positiveInterpretation && block?.positiveInterpretation) {
        positiveInterpretation.textContent = block.positiveInterpretation;
    }
    if (negativeInterpretation && block?.negativeInterpretation) {
        negativeInterpretation.textContent = block.negativeInterpretation;
    }

    const renderWordTags = (target, words, fallbackWords) => {
        if (!target) {
            return;
        }
        const useWords = Array.isArray(words) && words.length > 0 ? words : fallbackWords;
        target.innerHTML = useWords.map(word => `<span>${escapeChartText(word)}</span>`).join('');
    };

    renderWordTags(positiveWordsWrap, block?.positiveWords, ['MAINGAT', 'MAAYOS', 'MABILIS']);
    renderWordTags(negativeWordsWrap, block?.negativeWords, ['MAGULO', 'MATAGAL', 'MAHIRAP']);
}

function updateSentimentConcernStarsFromAverage(data) {
    const wrap = document.getElementById('sentimentConcernRatingStars');
    if (!wrap) {
        return;
    }
    const avg = data?.concerns?.ratingLineSeries?.average;
    const n = avg == null || Number.isNaN(Number(avg)) ? 0 : Math.min(5, Math.max(0, Math.round(Number(avg))));
    const parts = [];
    for (let i = 1; i <= 5; i += 1) {
        const emptyClass = i <= n ? '' : ' concern-rating-star--empty';
        parts.push(`<span${emptyClass ? ` class="${emptyClass.trim()}"` : ''} aria-hidden="true">★</span>`);
    }
    wrap.setAttribute('aria-label', n > 0 ? `${n} out of 5 stars average` : 'Walang average rating sa sakop na petsa');
    wrap.innerHTML = parts.join('');
}

function updateSentimentRatingLineChart(data) {
    const blockEl = document.getElementById('sentimentRatingLineBlock');
    const host = document.getElementById('sentimentRatingLineHost');
    const summaryEl = document.getElementById('sentimentRatingLineSummary');
    if (!host || !blockEl) {
        return;
    }

    const series = data?.concerns?.ratingLineSeries;
    if (!series?.hasRatingColumn) {
        blockEl.hidden = true;
        host.innerHTML = '';
        if (summaryEl) {
            summaryEl.textContent = '';
        }
        return;
    }

    blockEl.hidden = false;
    const labels = Array.isArray(series.labels) ? series.labels : [];
    const low = Array.isArray(series.low) ? series.low : [];
    const high = Array.isArray(series.high) ? series.high : [];
    const t = series.totals || {};

    if (summaryEl) {
        const avgPart = series.average != null ? ` · Average: ${series.average}` : '';
        summaryEl.textContent = `Negative (1–2): ${t.low ?? 0} · Positive (4–5): ${t.high ?? 0} · May rating: ${t.rated ?? 0}${avgPart}`;
    }

    if (labels.length === 0) {
        host.innerHTML = '<p class="sentiment-rating-line__empty">Walang nag-rate sa sakop na petsa.</p>';
        return;
    }

    const W = 420;
    const H = 200;
    const pl = 40;
    const pr = 12;
    const pt = 16;
    const pb = 36;
    const plotW = W - pl - pr;
    const plotH = H - pt - pb;
    const n = labels.length;
    const maxV = Math.max(1, ...low.map(Number), ...high.map(Number));

    const xAt = i => (n <= 1 ? pl + plotW / 2 : pl + (i / (n - 1)) * plotW);
    const yAt = v => pt + plotH - (Math.max(0, Number(v) || 0) / maxV) * plotH;

    const buildSmoothLinePath = points => {
        if (!Array.isArray(points) || points.length === 0) {
            return '';
        }
        if (points.length === 1) {
            return `M ${points[0].x} ${points[0].y}`;
        }

        const smoothing = 0.18;
        const segment = (a, b) => {
            const lengthX = b.x - a.x;
            const lengthY = b.y - a.y;
            return {
                length: Math.hypot(lengthX, lengthY),
                angle: Math.atan2(lengthY, lengthX)
            };
        };
        const controlPoint = (current, previous, next, reverse = false) => {
            const p = previous || current;
            const nPoint = next || current;
            const seg = segment(p, nPoint);
            const angle = seg.angle + (reverse ? Math.PI : 0);
            const length = seg.length * smoothing;
            return {
                x: current.x + Math.cos(angle) * length,
                y: current.y + Math.sin(angle) * length
            };
        };

        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i += 1) {
            const current = points[i];
            const prev = points[i - 1];
            const prevPrev = points[i - 2];
            const next = points[i + 1];
            const cps = controlPoint(prev, prevPrev, current);
            const cpe = controlPoint(current, prev, next, true);
            d += ` C ${cps.x} ${cps.y}, ${cpe.x} ${cpe.y}, ${current.x} ${current.y}`;
        }
        return d;
    };

    const lowPointPairs = low.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
    const highPointPairs = high.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
    const lowPath = buildSmoothLinePath(lowPointPairs);
    const highPath = buildSmoothLinePath(highPointPairs);

    const tickCount = 4;
    const yAxisParts = [];
    for (let g = 0; g <= tickCount; g += 1) {
        const y = pt + (plotH * g) / tickCount;
        const val = Math.round((maxV * (tickCount - g)) / tickCount);
        yAxisParts.push(
            `<line class="sentiment-rating-line__tick-y" x1="${pl - 4}" y1="${y}" x2="${pl}" y2="${y}" />` +
                `<text class="sentiment-rating-line__axis-label" x="${pl - 6}" y="${y + 4}" text-anchor="end">${escapeChartText(
                    String(val)
                )}</text>`
        );
    }

    const axisFrame =
        `<line class="sentiment-rating-line__axis" x1="${pl}" y1="${pt}" x2="${pl}" y2="${pt + plotH}" />` +
        `<line class="sentiment-rating-line__axis" x1="${pl}" y1="${pt + plotH}" x2="${pl + plotW}" y2="${pt + plotH}" />` +
        `<text class="sentiment-rating-line__axis-title" x="${pl - 2}" y="${pt - 4}" text-anchor="start">${escapeChartText('Bilang')}</text>`;

    const labelStep = n > 16 ? Math.ceil(n / 16) : 1;
    const xLabels = [];
    for (let i = 0; i < n; i += 1) {
        if (i % labelStep !== 0 && i !== n - 1) {
            continue;
        }
        const lab = String(labels[i] ?? '');
        const x = xAt(i);
        xLabels.push(
            `<text class="sentiment-rating-line__axis-label" x="${x}" y="${H - 10}" text-anchor="middle">${escapeChartText(lab)}</text>`
        );
    }

    const lowDots = low
        .map((v, i) => `<circle class="sentiment-rating-line__dot--negative" cx="${xAt(i)}" cy="${yAt(v)}" r="3.5" />`)
        .join('');
    const highDots = high
        .map((v, i) => `<circle class="sentiment-rating-line__dot--positive" cx="${xAt(i)}" cy="${yAt(v)}" r="3.5" />`)
        .join('');

    host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
        ${axisFrame}
        ${yAxisParts.join('')}
        <path class="sentiment-rating-line__line--negative" d="${lowPath}" />
        <path class="sentiment-rating-line__line--positive" d="${highPath}" />
        ${lowDots}${highDots}
        ${xLabels.join('')}
    </svg>`;
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

/** Count charts: kung mababa ang max (≤ floorTop), itaas ang axis top hanggang floorTop (hal. 25) para pantay ang grid at hindi mukhang puno ang maliit na bar. */
function countChartAxisMax(dataMax, floorTop = 25) {
    const dm = Number(dataMax) || 0;
    if (dm <= 0) return niceAxisMax(0);
    const nice = niceAxisMax(dm);
    if (dm <= floorTop) return Math.max(nice, floorTop);
    return nice;
}

function buildAxisTickLabels(axisMax, tickCount = 5) {
    const ticks = [];
    for (let i = tickCount; i >= 0; i--) {
        const raw = (axisMax * i) / tickCount;
        ticks.push(Number.isInteger(raw) ? raw : Math.round(raw * 100) / 100);
    }
    return ticks;
}

/** Bilang ng araw sa buwan ng analytics range (mula sa documents.monthLabel; fallback: local today). */
function getDaysInMonthFromAnalyticsData(data) {
    const label = (data?.documents?.monthLabel && String(data.documents.monthLabel).trim()) || '';
    if (label) {
        let d = new Date(Date.parse(label));
        if (Number.isNaN(d.getTime())) {
            d = new Date(Date.parse(`1 ${label}`));
        }
        if (!Number.isNaN(d.getTime())) {
            return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        }
    }
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
}

/** Bilang ng araw sa axis/grid (max 30). */
function getDocumentChartDayAxisTopDay(daysInMonth) {
    const raw = Math.max(1, Math.floor(Number(daysInMonth) || 30));
    return Math.min(30, raw);
}

/** Y-axis: 6 na tick (1 → topDay), pantay ang spacing — tumutugma sa --grid-lines:5. */
function buildDocumentYAxisDayTicksEvenly(topDay, tickCount = 5) {
    const d = Math.max(1, Math.floor(Number(topDay) || 1));
    const parts = [];
    for (let i = tickCount; i >= 0; i--) {
        const t = i / tickCount;
        const dayNum = Math.round(1 + (d - 1) * t);
        const label = Math.max(1, Math.min(d, dayNum));
        parts.push(`<span>${label}</span>`);
    }
    return parts.join('');
}

const DOCUMENT_Y_AXIS_MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
];

/** Y-axis (year metric): December (itaas) → January (ibaba); 12 row = 12 grid bands. */
function buildDocumentYAxisMonthTicksHtml() {
    const parts = [];
    for (let m = 11; m >= 0; m--) {
        parts.push(`<span>${DOCUMENT_Y_AXIS_MONTHS[m]}</span>`);
    }
    return parts.join('');
}

function buildDocumentYAxisTicksForMetric(topDay) {
    if (chartViewState.documentsPieMetric === 'year') {
        return buildDocumentYAxisMonthTicksHtml();
    }
    return buildDocumentYAxisDayTicksEvenly(topDay);
}

function getDocumentBarYAxisGridLines() {
    return chartViewState.documentsPieMetric === 'year' ? 12 : 5;
}

function getDocumentBarYAxisLabel() {
    return chartViewState.documentsPieMetric === 'year' ? 'Month' : 'Day of month';
}

function getDocumentBarYAxisClassName() {
    const base = 'table-chart-y-axis table-chart-y-axis--day-increment';
    return chartViewState.documentsPieMetric === 'year'
        ? `${base} table-chart-y-axis--year-months`
        : base;
}

/** Mas mataas na plot kapag 12 buwan sa Y-axis */
function getDocumentBarVizExtraClass() {
    return chartViewState.documentsPieMetric === 'year' ? ' table-chart-viz--documents-year-y' : '';
}

/** Bar layer: year = calendar months (Jan–Dec bands); month = current month day scale */
function getDocumentBarLayerDataAttrs() {
    const m = chartViewState.documentsPieMetric === 'year' ? 'year' : 'month';
    return `data-doc-metric="${m}"`;
}

/** Subtitle under Document Requests bar, pie, and year horizontal charts — ayon sa documentsPieMetric */
function getDocumentRequestsChartSubLabel() {
    return chartViewState.documentsPieMetric === 'year'
        ? 'Kabuuang bilang ng hiniling na dokumento sa Barangay Bigte ngayong taon'
        : 'Kabuuang bilang ng hiniling na dokumento sa Barangay Bigte ngayong buwan';
}

/** Pie graph lang — hindi nagbabago ayon sa month/year; bar graph ay dynamic */
const DOCUMENT_REQUESTS_PIE_CHART_SUB_LABEL = 'Kabuuang bilang ng hiniling na dokumento sa Barangay Bigte';

const DOCUMENT_MONTH_SHORT_LABELS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
];

/** Buong pangalan ng buwan — para sa year horizontal bar interpretation */
const DOCUMENT_MONTH_LABELS_EN = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
];

function hasValidYearByMonth(yearByMonth, docTypes) {
    if (!yearByMonth || typeof yearByMonth !== 'object') {
        return false;
    }
    return docTypes.some(t => {
        const arr = yearByMonth[t];
        return Array.isArray(arr) && arr.length >= 12;
    });
}

/** Kabuuan ng count bawat uri mula sa yearByMonth (tumutugma sa yearly grouped bar). */
function sumYearByMonthForDocumentType(yearByMonth, type) {
    const arr = yearByMonth?.[type];
    if (!Array.isArray(arr)) {
        return 0;
    }
    let s = 0;
    for (let i = 0; i < 12; i++) {
        s += Number(arr[i]) || 0;
    }
    return s;
}

/**
 * Pie slices mula sa isang documents payload block — hal. isang sitio mula sa bySitio.
 * Barangay-wide na pie: gumamit ng buildDocumentPieSegmentsAllTypesFromBySitio.
 * Year + yearByMonth: value = sum ng 12 buwan bawat uri.
 */
function buildDocumentPieSegmentsAllTypesSync(documentsPayload) {
    const monthData = documentsPayload?.month || {};
    const yearData = documentsPayload?.year || {};
    const yearByMonth = documentsPayload?.yearByMonth || null;
    const docTypes = Object.keys(monthData).filter(key => key.toLowerCase() !== 'total');
    if (docTypes.length === 0) {
        return null;
    }
    const showYear = chartViewState.documentsPieMetric === 'year';
    const useYearGrouped = showYear && hasValidYearByMonth(yearByMonth, docTypes);
    let segments = docTypes.map(type => {
        let value;
        if (useYearGrouped) {
            value = sumYearByMonthForDocumentType(yearByMonth, type);
        } else if (showYear) {
            value = Number(yearData[type]) || 0;
        } else {
            value = Number(monthData[type]) || 0;
        }
        return {
            label: type,
            value,
            color: getDocumentTypePieColor(type)
        };
    });
    if (chartViewState.documentsPieHideZero) {
        segments = segments.filter(s => s.value > 0);
    }
    return segments.map(seg => ({
        ...seg,
        color: getDocumentTypePieColor(seg.label)
    }));
}

/**
 * Opisyal na kabuuan mula sa documents payload — `month.total` / `year.total` (o katumbas kung kulang),
 * pareho ng saklaw ng bar graph. Ginagamit para ang pie disk + Total row = buong barangay o buong sitio block.
 */
function getDocumentPayloadGrandTotal(documentsPayload) {
    const monthData = documentsPayload?.month || {};
    const yearData = documentsPayload?.year || {};
    const yearByMonth = documentsPayload?.yearByMonth || null;
    const docTypes = Object.keys(monthData).filter(key => key.toLowerCase() !== 'total');
    if (docTypes.length === 0) {
        return 0;
    }
    const showYear = chartViewState.documentsPieMetric === 'year';
    const useYearGrouped = showYear && hasValidYearByMonth(yearByMonth, docTypes);

    if (!showYear) {
        const t = Number(monthData.total);
        if (Number.isFinite(t) && t >= 0) {
            return Math.round(t);
        }
        return Math.round(docTypes.reduce((a, k) => a + (Number(monthData[k]) || 0), 0));
    }

    if (useYearGrouped) {
        const t = Number(yearData.total);
        if (Number.isFinite(t) && t >= 0) {
            return Math.round(t);
        }
        return Math.round(docTypes.reduce((a, k) => a + sumYearByMonthForDocumentType(yearByMonth, k), 0));
    }

    const t = Number(yearData.total);
    if (Number.isFinite(t) && t >= 0) {
        return Math.round(t);
    }
    return Math.round(docTypes.reduce((a, k) => a + (Number(yearData[k]) || 0), 0));
}

/**
 * Inaayos ang mga slice na integer na ang kabuuan ay tumutugma sa grandTotal (disk + legend + %).
 */
function alignPieSegmentsToGrandTotal(segments, grandTotal) {
    const gt = Math.max(0, Math.round(Number(grandTotal) || 0));
    if (!segments?.length) {
        return segments;
    }
    const cleaned = segments.map(s => ({
        ...s,
        value: Math.max(0, Math.round(Number(s.value) || 0))
    }));
    const sum = cleaned.reduce((a, s) => a + s.value, 0);
    if (sum <= 0 || gt <= 0) {
        return cleaned;
    }
    if (sum === gt) {
        return cleaned;
    }
    const floors = cleaned.map(s => {
        const exact = (s.value / sum) * gt;
        const fl = Math.floor(exact);
        return { ...s, floor: fl, frac: exact - fl };
    });
    let allocated = floors.reduce((a, x) => a + x.floor, 0);
    let rem = gt - allocated;
    const idx = floors.map((_, i) => i).sort((i, j) => floors[j].frac - floors[i].frac);
    for (let k = 0; k < idx.length && rem > 0; k++) {
        floors[idx[k]].floor += 1;
        rem--;
    }
    return floors.map(x => ({
        label: x.label,
        value: x.floor,
        color: x.color
    }));
}

/** May 12 buwan na serye para sa uri na ito sa isang sitio block. */
function sitioYearByMonthHasTypeSeries(yearByMonth, type) {
    const arr = yearByMonth?.[type];
    return Array.isArray(arr) && arr.length >= 12;
}

/**
 * Isang sitio block: bilang ng isang uri ng dokumento — month/year/yearByMonth tulad ng pie metric.
 */
function sitioBlockDocTypeValue(block, type, showYear, useYearGrouped) {
    if (!showYear) {
        return Number(block.documents?.month?.[type]) || 0;
    }
    const ybm = block.documents?.yearByMonth;
    if (useYearGrouped && sitioYearByMonthHasTypeSeries(ybm, type)) {
        return sumYearByMonthForDocumentType(ybm, type);
    }
    return Number(block.documents?.year?.[type]) || 0;
}

/**
 * Isang sitio block: kabuuang dokumento sa aktibong metric (month.total o year / yearByMonth total).
 */
function sitioBlockDocMetricTotal(block, showYear, useYearGrouped) {
    if (!showYear) {
        return Number(block.documents?.month?.total) || 0;
    }
    const ybm = block.documents?.yearByMonth;
    if (useYearGrouped && sitioYearByMonthHasTypeSeries(ybm, 'total')) {
        return sumYearByMonthForDocumentType(ybm, 'total');
    }
    return Number(block.documents?.year?.total) || 0;
}

/**
 * Pie slices = pinagsama mula sa lahat ng row sa bySitio (hindi mula sa top-level documents na ginagamit ng bar graph).
 */
function buildDocumentPieSegmentsAllTypesFromBySitio(analyticsData) {
    const documentsPayload = analyticsData?.documents;
    const monthData = documentsPayload?.month || {};
    const yearByMonthTop = documentsPayload?.yearByMonth || null;
    const docTypes = Object.keys(monthData).filter(key => key.toLowerCase() !== 'total');
    if (docTypes.length === 0) {
        return null;
    }
    const list = analyticsData?.bySitio || [];
    const showYear = chartViewState.documentsPieMetric === 'year';
    const useYearGrouped = showYear && hasValidYearByMonth(yearByMonthTop, docTypes);

    let segments = docTypes.map(type => {
        let value = 0;
        for (const block of list) {
            value += sitioBlockDocTypeValue(block, type, showYear, useYearGrouped);
        }
        return {
            label: type,
            value,
            color: getDocumentTypePieColor(type)
        };
    });
    if (chartViewState.documentsPieHideZero) {
        segments = segments.filter(s => s.value > 0);
    }
    return segments.map(seg => ({
        ...seg,
        color: getDocumentTypePieColor(seg.label)
    }));
}

/** Kabuuan sa pie: sum ng bawat sitio’s total sa aktibong metric — tugma sa pinagsamang slices kung tugma ang datos. */
function getDocumentGrandTotalFromBySitio(analyticsData) {
    const documentsPayload = analyticsData?.documents;
    const monthData = documentsPayload?.month || {};
    const yearByMonthTop = documentsPayload?.yearByMonth || null;
    const docTypes = Object.keys(monthData).filter(key => key.toLowerCase() !== 'total');
    if (docTypes.length === 0) {
        return 0;
    }
    const list = analyticsData?.bySitio || [];
    const showYear = chartViewState.documentsPieMetric === 'year';
    const useYearGrouped = showYear && hasValidYearByMonth(yearByMonthTop, docTypes);

    let total = 0;
    for (const block of list) {
        total += sitioBlockDocMetricTotal(block, showYear, useYearGrouped);
    }
    return Math.round(total);
}

function maxDocumentYearByMonthValues(docTypes, yearByMonth) {
    let m = 0;
    docTypes.forEach(t => {
        const arr = yearByMonth[t];
        if (!Array.isArray(arr)) {
            return;
        }
        for (let i = 0; i < 12; i++) {
            m = Math.max(m, Number(arr[i]) || 0);
        }
    });
    return m;
}

/** Pinakamataas na count sa isang buwan (lahat ng uri) — axis ng year H-bar ayon sa piniling buwan. */
function maxDocumentYearValuesForMonth(docTypes, yearByMonth, monthIndex) {
    let m = 0;
    const mi = Math.min(11, Math.max(0, Number(monthIndex) || 0));
    docTypes.forEach(t => {
        const arr = yearByMonth[t];
        if (!Array.isArray(arr)) {
            return;
        }
        m = Math.max(m, Number(arr[mi]) || 0);
    });
    return m;
}

/**
 * Mas maraming interval sa X-axis kapag mas malaki ang axisMax (auto-adjust).
 * @returns {number} bilang ng segment (0→axisMax ay segments+1 ticks)
 */
function getYearHBarSegmentCount(axisMax) {
    if (axisMax <= 1) {
        return 1;
    }
    if (axisMax <= 12) {
        return Math.min(10, Math.max(5, Math.ceil(axisMax)));
    }
    const s = 4 + Math.log10(axisMax + 1) * 5;
    return Math.min(18, Math.max(8, Math.round(s)));
}

/** Ipakita ang tick na readable: integer kung malapit, compact (1.2k) kung napakalaki. */
function formatYearHBarTickLabel(value, axisMax) {
    const v = Number(value);
    if (!Number.isFinite(v)) {
        return '';
    }
    const top = Math.max(Number(axisMax) || 0, 1);
    if (top >= 5000 && v >= 1000) {
        const k = v / 1000;
        return (k >= 10 ? Math.round(k) : Math.round(k * 10) / 10) + 'k';
    }
    if (top >= 1000 && v >= 1000) {
        return v.toLocaleString();
    }
    if (Math.abs(v - Math.round(v)) < 1e-6) {
        return String(Math.round(v));
    }
    if (top <= 20) {
        return String(Math.round(v * 100) / 100);
    }
    return String(Math.round(v));
}

/**
 * @returns {number[]} halaga ng tick mula 0 hanggang axisMax (pantay ang agwat)
 */
function buildYearHBarXTicks(axisMax) {
    const top = Math.max(Number(axisMax) || 0, 1);
    const segments = getYearHBarSegmentCount(top);
    const ticks = [];
    for (let i = 0; i <= segments; i++) {
        ticks.push((top * i) / segments);
    }
    ticks[segments] = top;
    return ticks;
}

/**
 * Interpretation for doc-year-hbar-chart: bawat buwan — kabuuan at hatì ayon sa uri ng dokumento.
 * Tumutugma sa yearByMonth na ginagamit sa bar.
 */
function buildDocumentYearHBarInterpretationHtml(docTypes, yearByMonth, opts = {}) {
    const esc = escapeChartText;
    const types = docTypes || [];
    const ybm = yearByMonth || {};
    if (types.length === 0) {
        return '';
    }

    const yearLabel = opts.yearLabel ? esc(String(opts.yearLabel)) : '';
    const scopeNote = opts.headingSub ? esc(String(opts.headingSub)) : '';

    let intro = `Ipinapakita ng chart na ito ang mga request ng dokumento ayon sa <strong>buwan ng kalendaryo</strong> para sa taon`;
    intro += yearLabel ? ` na <strong>${yearLabel}</strong>` : '';
    intro += '. ';
    intro += scopeNote
        ? `Saklaw: <strong>${scopeNote}</strong>. `
        : '';
    intro +=
        'Tugma ang bawat linya sa isang buwan sa chart. Ang mga bilang sa ibaba ay pareho sa ginamit sa mga pahalang na bar.';

    const monthItems = [];
    for (let mi = 0; mi < 12; mi++) {
        const monthName = esc(DOCUMENT_MONTH_LABELS_EN[mi]);
        let total = 0;
        const typeParts = [];
        types.forEach(t => {
            const v = Math.max(0, Number(ybm[t]?.[mi]) || 0);
            total += v;
            typeParts.push({ label: documentTypeFilterDisplayName(t), v });
        });
        const breakdown = typeParts
            .filter(p => p.v > 0)
            .map(p => `<strong>${esc(p.label)}</strong> <strong>${p.v.toLocaleString()}</strong>`)
            .join(', ');
        const detail =
            total === 0
                ? ' Walang request ayon sa uri ng dokumento ngayong buwan.'
                : ` Hatian ayon sa uri: ${breakdown}.`;
        monthItems.push(
            `<li><strong>${monthName}</strong>: <strong>${total.toLocaleString()}</strong> kabuuang request ngayong buwan.${detail}</li>`
        );
    }

    const listHtml = `<ul class="doc-year-hbar-interpretation-months">${monthItems.join('')}</ul>`;
    return `<div class="doc-year-hbar-interpretation" role="note"><p>${intro}</p>${listHtml}</div>`;
}

/** Normalized month index (0–Jan … 11–Dec) para sa year doc bar; fallback: kasalukuyang buwan. */
function getDocumentsYearMonthTabIndex() {
    const t = chartViewState.documentsYearMonthTab;
    if (t === null || t === undefined || !Number.isFinite(Number(t))) {
        return new Date().getMonth();
    }
    return Math.min(11, Math.max(0, Math.floor(Number(t))));
}

/**
 * Yearly: grouped horizontal bars — buwan sa Y (Jan→Dec), count scale sa X.
 * Tanging all-types at all-types-by-sitio; iba pang filter ay lumang vertical bar.
 */
function renderDocumentYearGroupedBarChart(containerId, opts) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }
    const docTypes = opts.docTypes || [];
    const yearByMonth = opts.yearByMonth || {};
    const headingSub = opts.headingSub || '';
    const yearLabel = opts.yearLabel || '';

    const selectedMi = getDocumentsYearMonthTabIndex();
    const dataMax = maxDocumentYearValuesForMonth(docTypes, yearByMonth, selectedMi);
    /** Fixed 0–100 track: lapad ng bar = count% (hal. 7 → 7% ng track, hindi 7/axisMax). */
    const DOC_YEAR_HBAR_SCALE_MAX = 100;
    /** 10 column = bawat 10 puntos sa 0–100 */
    const xSeg = 10;
    const valueScaleTickParts = Array.from({ length: 11 }, (_, i) => {
        const pct = i * 10;
        return `<span>${escapeChartText(String(pct))}</span>`;
    }).join('');

    const legendHtml = docTypes
        .map(t => {
            const bg = getDocumentTypeGradient(t);
            return `<span class="doc-year-hbar-chart__legend-item"><i class="doc-year-hbar-chart__legend-swatch" style="background:${bg}"></i>${escapeChartText(t)}</span>`;
        })
        .join('');

    const docYearHBarAsOfDate = new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const strips = docTypes
        .map(t => {
            const v = Number(yearByMonth[t]?.[selectedMi]) || 0;
            const wPct = Math.min(DOC_YEAR_HBAR_SCALE_MAX, Math.max(0, v));
            const wCss = v > 0 ? `min(100%,${wPct}%)` : '0';
            const bg = getDocumentTypeGradient(t);
            const inner =
                v > 0
                    ? `<div class="doc-year-hbar-chart__bar" style="width:${wCss};background:${bg}" role="presentation"></div>`
                    : '';
            const trackTitle = `${t}: ${v} (${wPct}% of 0–100 track) · as of ${docYearHBarAsOfDate}`;
            const vLabel = Number.isInteger(v) ? v.toLocaleString() : String(v);
            return `<div class="doc-year-hbar-chart__cat-strip" role="group" aria-label="${escapeChartText(`${t}: ${v} requests`)}">
                    <div class="doc-year-hbar-chart__bar-track" title="${escapeChartText(trackTitle)}">${inner}</div>
                    <span class="doc-year-hbar-chart__strip-value">${escapeChartText(vLabel)}</span>
                </div>`;
        })
        .join('');
    const valueScaleRowHtml = `<div class="doc-year-hbar-chart__value-scale doc-year-hbar-chart__value-scale--percent" aria-hidden="true">${valueScaleTickParts}</div>`;
    const rowsHtml = [
        `<div class="doc-year-hbar-chart__month-block" data-month-index="${selectedMi}">
            <div class="doc-year-hbar-chart__month-label-col">
                <span class="doc-year-hbar-chart__month">${DOCUMENT_MONTH_SHORT_LABELS[selectedMi]}</span>
            </div>
            <div class="doc-year-hbar-chart__month-panel">
                <div class="doc-year-hbar-chart__month-stack" style="--x-segments:${xSeg};--doc-hbar-axis-max:${DOC_YEAR_HBAR_SCALE_MAX}">${strips}${valueScaleRowHtml}</div>
            </div>
        </div>`
    ];

    const monthTabsHtml = `<div class="doc-year-hbar-chart__month-tabs" role="tablist" aria-label="Select month">
            ${DOCUMENT_MONTH_LABELS_EN.map((fullName, mi) => {
                const active = mi === selectedMi;
                return `<button type="button" class="doc-year-hbar-chart__month-tab${
                    active ? ' doc-year-hbar-chart__month-tab--active' : ''
                }" role="tab" data-doc-month-filter="${mi}" aria-selected="${active ? 'true' : 'false'}">${escapeChartText(fullName)}</button>`;
            }).join('')}
        </div>`;

    const metaLine = [
        yearLabel ? `Year ${escapeChartText(String(yearLabel))}` : null,
        'monthly counts',
        `bar width = count% of 0–100 track${dataMax > 0 ? ` · peak ${dataMax} in month` : ''}`
    ]
        .filter(Boolean)
        .join(' · ');

    const yearHbarInterpretationHtml = buildDocumentYearHBarInterpretationHtml(docTypes, yearByMonth, {
        yearLabel,
        headingSub
    });

    container.innerHTML = `
        <p class="table-chart-heading">Bar graph</p>
        <p class="document-requests-chart-sub">${escapeChartText(getDocumentRequestsChartSubLabel())}</p>
        <p class="document-requests-chart-sub doc-year-hbar-chart__meta">${metaLine}</p>
        <div class="doc-year-hbar-chart" role="group" aria-label="Document requests by month and type, horizontal bars">
            <div class="doc-year-hbar-chart__legend">${legendHtml}</div>
            ${monthTabsHtml}
            <div class="doc-year-hbar-chart__rows">${rowsHtml.join('')}</div>
            <p class="doc-year-hbar-chart__x-title">Scale (0–100%) · exact counts beside each bar</p>
        </div>
        ${yearHbarInterpretationHtml}`;
}

/** Taas ng axis = pinakamataas sa (resolved+new+processing) o revoked bawat buwan. */
function maxConcernsYearByMonthValues(yearByMonth) {
    let m = 0;
    const ybm = yearByMonth || {};
    for (let i = 0; i < 12; i++) {
        const res = Math.max(0, Number(ybm.resolved?.[i]) || 0);
        const newC = Math.max(0, Number(ybm.new?.[i]) || 0);
        const proc = Math.max(0, Number(ybm.processing?.[i]) || 0);
        const rev = Math.max(0, Number(ybm.revoked?.[i]) || 0);
        const stackTotal = res + newC + proc;
        m = Math.max(m, stackTotal, rev);
    }
    return m;
}

function hasConcernsYearByMonthPayload(ym) {
    return (
        ym &&
        typeof ym === 'object' &&
        Array.isArray(ym.reported) &&
        ym.reported.length >= 12 &&
        Array.isArray(ym.resolved) &&
        ym.resolved.length >= 12
    );
}

function buildConcernsYearHBarInterpretationHtml(yearByMonth, opts = {}) {
    const esc = escapeChartText;
    const ybm = yearByMonth || {};
    const yearLabel = opts.yearLabel ? esc(String(opts.yearLabel)) : '';
    let intro =
        'Ipinapakita ng chart na ito ang <strong>bago</strong>, <strong>pinoproseso</strong>, at <strong>na-resolve</strong> bilang <strong>stacked column</strong>, kasama ang <strong>revoked</strong> sa tabi, ayon sa <strong>buwan ng kalendaryo</strong>';
    intro += yearLabel ? ` para sa <strong>${yearLabel}</strong>` : '';
    intro +=
        '. May dalawang bar kada buwan: stacked na status (i-hover para sa Resolved / New / Processing) at revoked. Tugma ang mga bilang sa ibaba sa chart.';
    const monthItems = [];
    for (let mi = 0; mi < 12; mi++) {
        const monthName = esc(DOCUMENT_MONTH_LABELS_EN[mi]);
        const res = Math.max(0, Number(ybm.resolved?.[mi]) || 0);
        const newC = Math.max(0, Number(ybm.new?.[mi]) || 0);
        const proc = Math.max(0, Number(ybm.processing?.[mi]) || 0);
        const rev = Math.max(0, Number(ybm.revoked?.[mi]) || 0);
        monthItems.push(
            `<li><strong>${monthName}</strong>: na-resolve <strong>${res.toLocaleString()}</strong>, bago <strong>${newC.toLocaleString()}</strong>, pinoproseso <strong>${proc.toLocaleString()}</strong>, revoked <strong>${rev.toLocaleString()}</strong>.</li>`
        );
    }
    return `<div class="doc-year-hbar-interpretation" role="note"><p>${intro}</p><ul class="doc-year-hbar-interpretation-months">${monthItems.join('')}</ul></div>`;
}

/**
 * Taon (scope year): Jan–Dec — stacked bar (new/processing + resolved) at revoked na magkatabi bawat buwan.
 */
function renderConcernsYearGroupedBarChart(containerId, opts) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }
    const yearByMonth = opts.yearByMonth || {};
    const yearLabel = opts.yearLabel || '';
    const metric = chartViewState.concernsPieSitioMetric;
    const metricMode =
        metric === 'all' || metric === 'unresolved' || metric === 'revoked' ? metric : 'resolved';
    const isAllMode = metricMode === 'all';
    const metricLabel =
        metricMode === 'all'
            ? 'All Concerns'
            : metricMode === 'revoked'
            ? 'Revoked'
            : metricMode === 'unresolved'
            ? 'Unresolved'
            : 'Resolved';
    const metricLabelTl =
        metricMode === 'all'
            ? 'Lahat ng concerns'
            : metricMode === 'revoked'
            ? 'Revoked'
            : metricMode === 'unresolved'
            ? 'Hindi pa tapos'
            : 'Na-resolve';
    const subheading =
        opts.subheading != null && opts.subheading !== ''
            ? opts.subheading
            : `${metricLabelTl} — concerns ayon sa buwan ng kalendaryo, buong barangay`;

    let dataMax = 0;
    if (isAllMode) {
        dataMax = maxConcernsYearByMonthValues(yearByMonth);
    } else {
        for (let i = 0; i < 12; i++) {
            const res = Math.max(0, Number(yearByMonth.resolved?.[i]) || 0);
            const unresolved =
                Math.max(0, Number(yearByMonth.new?.[i]) || 0) + Math.max(0, Number(yearByMonth.processing?.[i]) || 0);
            const rev = Math.max(0, Number(yearByMonth.revoked?.[i]) || 0);
            const v = metricMode === 'revoked' ? rev : metricMode === 'unresolved' ? unresolved : res;
            dataMax = Math.max(dataMax, v);
        }
    }
    const axisMax = niceAxisMax(Math.max(dataMax, 1));
    const ticks = buildAxisTickLabels(axisMax, 5);
    const tickHtml = ticks.map(t => `<span>${Number(t).toLocaleString()}</span>`).join('');

    const legendHtml = isAllMode
        ? `<div class="doc-year-hbar-chart__legend doc-year-hbar-chart__legend--concerns-year">
            <span class="doc-year-hbar-chart__legend-item"><i class="doc-year-hbar-chart__legend-swatch doc-year-hbar-chart__legend-swatch--stack-red" aria-hidden="true"></i>${escapeChartText('Unresolved')}</span>
            <span class="doc-year-hbar-chart__legend-item"><i class="doc-year-hbar-chart__legend-swatch doc-year-hbar-chart__legend-swatch--stack-green" aria-hidden="true"></i>${escapeChartText('Resolved')}</span>
            <span class="doc-year-hbar-chart__legend-item"><i class="doc-year-hbar-chart__legend-swatch doc-year-hbar-chart__legend-swatch--revoked" aria-hidden="true"></i>${escapeChartText('Revoked')}</span>
        </div>`
        : `<div class="doc-year-hbar-chart__legend doc-year-hbar-chart__legend--concerns-year">
            <span class="doc-year-hbar-chart__legend-item"><i class="doc-year-hbar-chart__legend-swatch ${
                metricMode === 'revoked'
                    ? 'doc-year-hbar-chart__legend-swatch--revoked'
                    : metricMode === 'unresolved'
                    ? 'doc-year-hbar-chart__legend-swatch--stack-red'
                    : 'doc-year-hbar-chart__legend-swatch--stack-green'
            }" aria-hidden="true"></i>${escapeChartText(metricLabel)}</span>
        </div>`;

    const monthGroups = [];
    for (let mi = 0; mi < 12; mi++) {
        const res = Math.max(0, Number(yearByMonth.resolved?.[mi]) || 0);
        const newC = Math.max(0, Number(yearByMonth.new?.[mi]) || 0);
        const proc = Math.max(0, Number(yearByMonth.processing?.[mi]) || 0);
        const rev = Math.max(0, Number(yearByMonth.revoked?.[mi]) || 0);
        const secondary = newC + proc;
        const value = metricMode === 'revoked' ? rev : metricMode === 'unresolved' ? secondary : res;
        const pct = axisMax > 0 ? Math.min(100, (value / axisMax) * 100) : 0;
        const stackTotal = res + secondary;
        const stackPct = axisMax > 0 ? Math.min(100, (stackTotal / axisMax) * 100) : 0;
        const revPct = axisMax > 0 ? Math.min(100, (rev / axisMax) * 100) : 0;
        const resFlex = stackTotal > 0 ? res : 0;
        const secondaryFlex = stackTotal > 0 ? secondary : 0;
        const tipBase = `data-resolved="${res}" data-new="${newC}" data-processing="${proc}" data-tooltip-heading="${escapeChartText(DOCUMENT_MONTH_LABELS_EN[mi])}"`;
        const tipAttrsUnresolved = `${tipBase} data-tooltip-segment="unresolved"`;
        const tipAttrsResolved = `${tipBase} data-tooltip-segment="resolved"`;
        const valueSpan = value > 0 ? `<span class="table-chart-bar-value table-chart-bar-value--doc-above">${value.toLocaleString()}</span>` : '';
        const stackValSpan = stackTotal > 0 ? `<span class="table-chart-bar-value table-chart-bar-value--doc-above">${stackTotal.toLocaleString()}</span>` : '';
        const revValSpan = rev > 0 ? `<span class="table-chart-bar-value table-chart-bar-value--doc-above">${rev.toLocaleString()}</span>` : '';
        const monthName = escapeChartText(DOCUMENT_MONTH_LABELS_EN[mi]);
        const barAria = `${monthName}: resolved ${res}; unresolved ${secondary}; revoked ${rev}`;
        const barInner = isAllMode
            ? `<div class="table-chart-bar-fill concerns-year-vbar-chart__bar-fill concerns-year-vbar-chart__bar-fill--stacked" style="--bar-pct:${stackPct}" role="img" aria-label="${escapeChartText(
                  barAria
              )}">
                    <div class="concerns-stacked-bar__segment concerns-stacked-bar__segment--unresolved" ${tipAttrsUnresolved} style="flex: ${secondaryFlex} 1 0"></div>
                    <div class="concerns-stacked-bar__segment concerns-stacked-bar__segment--resolved" ${tipAttrsResolved} style="flex: ${resFlex} 1 0"></div>
                </div>`
            : metricMode === 'revoked'
                ? `<div class="table-chart-bar-fill concerns-year-vbar-chart__bar-fill concerns-year-vbar-chart__bar-fill--revoked concerns-year-vbar-chart__bar-revoked-tooltip" style="--bar-pct:${pct}" data-revoked="${rev}" data-tooltip-heading="${escapeChartText(
                      DOCUMENT_MONTH_LABELS_EN[mi]
                  )}" aria-label="Revoked: ${rev}"></div>`
                : `<div class="table-chart-bar-fill concerns-year-vbar-chart__bar-fill concerns-year-vbar-chart__bar-fill--stacked" style="--bar-pct:${pct}" role="img" aria-label="${escapeChartText(
                      barAria
                  )}">
                        <div class="concerns-stacked-bar__segment ${
                            metricMode === 'unresolved'
                                ? 'concerns-stacked-bar__segment--unresolved'
                                : 'concerns-stacked-bar__segment--resolved'
                        }" ${metricMode === 'unresolved' ? tipAttrsUnresolved : tipAttrsResolved} style="flex: 1 1 0"></div>
                    </div>`;
        const singleBar = `<div class="table-chart-bar-slot concerns-year-vbar-chart__bar-slot">
                <div class="table-chart-bar-doc-stack">
                    ${valueSpan}
                    ${barInner}
                </div>
            </div>`;
        const pairBars = `<div class="table-chart-bar-slot concerns-year-vbar-chart__bar-slot">
                <div class="table-chart-bar-doc-stack">
                    ${stackValSpan}
                    <div class="table-chart-bar-fill concerns-year-vbar-chart__bar-fill concerns-year-vbar-chart__bar-fill--stacked" style="--bar-pct:${stackPct}" role="img" aria-label="${escapeChartText(
                        barAria
                    )}">
                        <div class="concerns-stacked-bar__segment concerns-stacked-bar__segment--unresolved" ${tipAttrsUnresolved} style="flex: ${secondaryFlex} 1 0"></div>
                        <div class="concerns-stacked-bar__segment concerns-stacked-bar__segment--resolved" ${tipAttrsResolved} style="flex: ${resFlex} 1 0"></div>
                    </div>
                </div>
            </div>
            <div class="table-chart-bar-slot concerns-year-vbar-chart__bar-slot">
                <div class="table-chart-bar-doc-stack">
                    ${revValSpan}
                    <div class="table-chart-bar-fill concerns-year-vbar-chart__bar-fill concerns-year-vbar-chart__bar-fill--revoked concerns-year-vbar-chart__bar-revoked-tooltip" style="--bar-pct:${revPct}" data-revoked="${rev}" data-tooltip-heading="${escapeChartText(
                        DOCUMENT_MONTH_LABELS_EN[mi]
                    )}" aria-label="Revoked: ${rev}"></div>
                </div>
            </div>`;
        monthGroups.push(
            `<div class="concerns-year-vbar-chart__month-group" aria-label="${monthName}">
                <div class="concerns-year-vbar-chart__pair">${isAllMode ? pairBars : singleBar}</div>
            </div>`
        );
    }

    const labelsRow = documentRequestsBarLabelsRowHtml(DOCUMENT_MONTH_SHORT_LABELS);

    const metaLine = [
        yearLabel ? `Year ${escapeChartText(String(yearLabel))}` : null,
        isAllMode ? 'stacked status + revoked by month' : `${metricLabel.toLowerCase()} by month`,
        `scale 0–${axisMax}`
    ]
        .filter(Boolean)
        .join(' · ');

    const metricTl =
        metricMode === 'revoked'
            ? 'revoked'
            : metricMode === 'unresolved'
            ? 'hindi pa tapos'
            : 'na-resolve';
    const interpretationHtml = isAllMode
        ? buildConcernsYearHBarInterpretationHtml(yearByMonth, { yearLabel })
        : `<div class="doc-year-hbar-interpretation" role="note"><p>Ipinapakita ng chart na ito ang mga concern na <strong>${escapeChartText(
              metricTl
          )}</strong> ayon sa <strong>buwan ng kalendaryo</strong>${
              yearLabel ? ` para sa <strong>${escapeChartText(String(yearLabel))}</strong>` : ''
          }. Ang nasa taas ng bawat bar ay ang bilang ng <strong>${escapeChartText(metricTl)}</strong> para sa buwan na iyon.</p></div>`;

    container.innerHTML = `
        <p class="table-chart-heading">Bar graph</p>
        <p class="document-requests-chart-sub">${escapeChartText(subheading)}</p>
        <p class="document-requests-chart-sub doc-year-hbar-chart__meta">${escapeChartText(metaLine)}</p>
        ${legendHtml}
        <div class="table-chart-viz table-chart-viz--concerns-year-vbar" role="img" aria-label="Concerns by month: ${escapeChartText(
            metricLabel.toLowerCase()
        )} values">
            <div class="table-chart-y-label">Count</div>
            <div class="table-chart-y-axis" aria-hidden="true">${tickHtml}</div>
            <div class="table-chart-plot-wrap">
                <div class="table-chart-doc-hscroll">
                    <div class="table-chart-doc-hscroll-inner">
                        <div class="table-chart-plot table-chart-plot--documents-bars concerns-year-vbar-chart__plot">
                            <div class="table-chart-grid-bg" style="--grid-lines:5"></div>
                            <div class="table-chart-bar-layer table-chart-bar-layer--documents concerns-year-vbar-chart__layer">${monthGroups.join(
                                ''
                            )}</div>
                        </div>
                        ${labelsRow}
                    </div>
                </div>
                <p class="table-chart-x-title">Month (Jan – Dec)</p>
            </div>
        </div>
        ${interpretationHtml}`;
    if (isAllMode) {
        bindConcernsStackedBarSegmentTooltips(container);
        bindConcernsYearRevokedColumnTooltips(container);
    } else if (metricMode === 'revoked') {
        bindConcernsYearRevokedColumnTooltips(container);
    } else {
        bindConcernsStackedBarSegmentTooltips(container);
    }
}

function sortPieSegments(segments, sortKey) {
    const copy = [...segments];
    if (sortKey === 'value-desc') {
        copy.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    } else if (sortKey === 'value-asc') {
        copy.sort((a, b) => (Number(a.value) || 0) - (Number(b.value) || 0));
    } else if (sortKey === 'label-asc') {
        copy.sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' }));
    } else if (sortKey === 'label-desc') {
        copy.sort((a, b) => String(b.label).localeCompare(String(a.label), undefined, { sensitivity: 'base' }));
    }
    return copy;
}

/**
 * Per document category, which sitio reported the highest count for the active month/year metric.
 * @returns {{ max: number, names: string[] }}
 */
function getTopSitiosForDocumentCategory(analyticsData, categoryLabel) {
    const list = analyticsData?.bySitio || [];
    const metric = chartViewState.documentsPieMetric === 'year' ? 'year' : 'month';
    let max = -1;
    const rows = [];
    for (const block of list) {
        const v = Math.max(0, Number(block.documents?.[metric]?.[categoryLabel]) || 0);
        const name = (block.sitio || '').trim() || 'Unknown sitio';
        rows.push({ name, v });
        if (v > max) {
            max = v;
        }
    }
    if (max < 0) {
        max = 0;
    }
    if (max <= 0) {
        return { max: 0, names: [] };
    }
    const names = rows.filter(r => r.v === max).map(r => r.name);
    const unique = [...new Set(names)];
    return { max, names: unique };
}

/**
 * Kabuuang bilang ng requests lahat ng uri ng dokumento bawat sitio — parehong month/year metric ng pie.
 * Ginagamit sa interpretation: lahat ng sitio na may activity.
 */
function computeSitioDocumentTotalsAllTypes(analyticsData) {
    const metric = chartViewState.documentsPieMetric === 'year' ? 'year' : 'month';
    const list = analyticsData?.bySitio || [];
    const rows = list.map(block => {
        const name = (block.sitio || '').trim() || 'Unknown sitio';
        const o = block.documents?.[metric];
        let total = 0;
        if (o && typeof o === 'object') {
            const t = o.total;
            if (t != null && t !== '' && Number.isFinite(Number(t))) {
                total = Number(t) || 0;
            } else {
                for (const k of Object.keys(o)) {
                    if (String(k).toLowerCase() === 'total') {
                        continue;
                    }
                    total += Number(o[k]) || 0;
                }
            }
        }
        return { name, total };
    });
    rows.sort((a, b) => b.total - a.total);
    return { rows };
}

function formatEnglishScopePhrase() {
    return chartViewState.documentsPieMetric === 'year'
        ? 'sa buong taon (kasalukuyang taon)'
        : 'sa napiling buwan';
}

/** Concerns bar/pie — tumutugma sa Scope control (This month / This year). */
function formatConcernsScopePhrase() {
    return chartViewState.concernsPieSitioScope === 'year' ? 'ngayong taon' : 'ngayong buwan';
}

/**
 * Concerns pie interpretation — parehong wrapper at estilo tulad ng Document Requests pie.
 * @param {'bySitio'|'period'} mode
 */
function buildConcernsPieInterpretationHtml(segments, total, mode, extra = {}) {
    if (!segments || segments.length === 0 || total <= 0) {
        return '';
    }
    const esc = escapeChartText;
    const scopePhrase = formatConcernsScopePhrase();
    /** Sa interpretation text lang: iisa ang framing — reported concerns, hindi resolved/unresolved. */
    const reportedConcernsPhrase = 'na-ulat na concerns';
    const aiIntroRaw = String(lastAnalyticsData?.concerns?.aiInterpretation?.[mode] || '').trim();
    const aiIntro = aiIntroRaw ? esc(aiIntroRaw) : '';

    if (mode === 'bySitio') {
        const sorted = segments
            .map(s => ({
                label: String(s.label),
                value: Math.max(0, Number(s.value) || 0)
            }))
            .sort((a, b) => b.value - a.value);
        const intro =
            aiIntro ||
            `Ipinapakita ng pie ang isang slice bawat sitio. Ang bawat halaga ay tumutugma sa bilang ng <strong>${esc(
                reportedConcernsPhrase
            )}</strong> kada sitio sa ilalim ng <strong>${esc(
                scopePhrase
            )}</strong>. Ang kabuuan ng lahat ng slice ay <strong>${total.toLocaleString()}</strong>.`;
        const sliceItems = sorted.map(s => {
            const v = s.value;
            const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';
            return `<li><strong>${esc(s.label)}</strong>: <strong>${v.toLocaleString()}</strong> ${esc(
                reportedConcernsPhrase
            )}, <strong>${pct}%</strong> ng kabuuan ng pie sa view na ito.</li>`;
        });
        const listHtml = `<ul class="table-chart-pie-interpretation-categories">${sliceItems.join('')}</ul>`;
        return `<div class="table-chart-pie-interpretation" role="note"><p>${intro}</p>${listHtml}</div>`;
    }

    if (mode === 'period') {
        const sorted = segments
            .map(s => ({
                label: String(s.label),
                value: Math.max(0, Number(s.value) || 0)
            }))
            .sort((a, b) => b.value - a.value);
        const sitioF = (extra.sitioFilter || '').trim();
        const areaLead = sitioF
            ? `Mga bilang para lamang sa sitio na <strong>${esc(sitioF)}</strong> (Concerns sitio filter).`
            : 'Mga bilang ay <strong>buong barangay</strong> (walang sitio filter).';
        const intro =
            (aiIntro ? `${aiIntro} ${areaLead}` : '') ||
            `May apat na slice ang pie para sa mga <strong>na-ulat na concerns</strong> sa iba't ibang panahon (ngayong buwan at ngayong taon). ${areaLead} Ang kontrol na <strong>Scope</strong> (${esc(
                scopePhrase
            )}) ay nakakaapekto sa bar chart at pie by sitio, hindi sa apat na grupo dito. Ang kabuuan ng mga slice ay <strong>${total.toLocaleString()}</strong>.`;
        const sliceItems = sorted.map(s => {
            const v = s.value;
            const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';
            return `<li><strong>${esc(s.label)}</strong>: <strong>${v.toLocaleString()}</strong>, <strong>${pct}%</strong> ng pinagsamang kabuuan sa view na ito.</li>`;
        });
        const listHtml = `<ul class="table-chart-pie-interpretation-categories">${sliceItems.join('')}</ul>`;
        return `<div class="table-chart-pie-interpretation" role="note"><p>${intro}</p>${listHtml}</div>`;
    }

    return '';
}

function wrapDocumentBarInterpretationHtml(innerHtml) {
    return `<div class="table-chart-bar-interpretation" role="note">${innerHtml}</div>`;
}

/**
 * Interpretation block below document bar charts using table-chart-plot-wrap--documents.
 * Tagalog; walang parentheses sa user-facing copy kung maaari.
 * @param {'allTypesBarangay'|'allTypesOneSitio'|'oneTypeBySitio'} mode
 */
function buildDocumentBarInterpretationHtml(mode, extra = {}) {
    const esc = escapeChartText;
    const scopePhrase = formatEnglishScopePhrase();

    if (mode === 'oneTypeBySitio') {
        const { list, docLabel } = extra;
        const showYear = chartViewState.documentsPieMetric === 'year';
        const docName = esc(documentTypeFilterDisplayName(docLabel));
        const rows = (list || []).map(block => {
            const v = showYear
                ? Number(block.documents?.year?.[docLabel]) || 0
                : Number(block.documents?.month?.[docLabel]) || 0;
            return { name: (block.sitio || '').trim() || 'Hindi kilalang sitio', v };
        });
        const total = rows.reduce((s, r) => s + r.v, 0);
        const sorted = [...rows].sort((a, b) => b.v - a.v);
        const top = sorted[0];
        const filteredToSingleSitio = extra.filteredToSingleSitio === true;
        const scopeNote = filteredToSingleSitio
            ? ' Tanging ang napiling sitio sa filter ang ipinapakita. '
            : ' ';
        let p1 = `Ipinapakita ng bar graph na ito ang mga request na <strong>${docName}</strong> bawat sitio para sa <strong>${scopePhrase}</strong>, tugma sa napiling uri ng dokumento.${scopeNote}Kabuuan ng mga bar sa view: <strong>${total.toLocaleString()}</strong> na request. `;
        if (top && top.v > 0) {
            p1 += `Ang pinakamataas na bar ay <strong>${esc(top.name)}</strong> na may <strong>${top.v.toLocaleString()}</strong> na request.`;
            if (sorted.length > 1 && sorted[1].v > 0) {
                p1 += ` Susunod na pinakamataas ay <strong>${esc(sorted[1].name)}</strong> na may <strong>${sorted[1].v.toLocaleString()}</strong> na request.`;
            }
        } else {
            p1 += 'Lahat ng bilang ay zero sa view na ito.';
        }
        return wrapDocumentBarInterpretationHtml(`<p>${p1}</p>`);
    }

    if (mode === 'allTypesBarangay') {
        const { docTypes, monthData, yearData, analyticsData } = extra;
        const showYear = chartViewState.documentsPieMetric === 'year';
        const rows = (docTypes || []).map(type => ({
            label: type,
            value: showYear ? Number(yearData[type]) || 0 : Number(monthData[type]) || 0
        }));
        const totalAll = showYear ? Number(yearData.total) || 0 : Number(monthData.total) || 0;
        const sorted = [...rows].sort((a, b) => b.value - a.value);
        const top = sorted[0];
        let intro = `Inihambing ng bar graph na ito ang bilang ng mga request ayon sa uri ng dokumento para sa <strong>${scopePhrase}</strong>, pinagsama sa lahat ng sitio. Iisang vertical scale ang ginagamit kaya mas mataas na bar = mas maraming request. `;
        if (top && top.value > 0) {
            intro += `Ang pinakamataas na uri ng dokumento ay <strong>${esc(documentTypeFilterDisplayName(top.label))}</strong> na may <strong>${top.value.toLocaleString()}</strong> na request. `;
        }
        intro += `Ang kolumn na <strong>Total</strong> ay pinagsama ang lahat ng kategorya: <strong>${totalAll.toLocaleString()}</strong> na request.`;

        const sitioList = analyticsData?.bySitio || [];
        const listItems = (docTypes || []).map(cat => {
            const catDisplay = esc(documentTypeFilterDisplayName(cat));
            const v = showYear ? Number(yearData[cat]) || 0 : Number(monthData[cat]) || 0;
            let line = `<li><strong>${catDisplay}</strong>: <strong>${v.toLocaleString()}</strong> na request sa mga bar sa itaas, kabuuan sa buong barangay para sa saklaw na ito.`;
            if (sitioList.length > 0) {
                const { max, names } = getTopSitiosForDocumentCategory(analyticsData, cat);
                if (max > 0 && names.length === 1) {
                    line += ` Pinakamataas sa antas ng sitio ang <strong>${esc(names[0])}</strong> na may <strong>${max.toLocaleString()}</strong> na request.`;
                } else if (max > 0 && names.length > 1) {
                    line += ` Maraming sitio ang magkapantay sa pinakamataas na <strong>${max.toLocaleString()}</strong> na request.`;
                }
            }
            line += '</li>';
            return line;
        });
        const bridge =
            'Tugma ang bawat linya sa taas ng bar. Ang mga tala tungkol sa sitio ay opsyonal at available lang kapag may breakdown data.';
        return wrapDocumentBarInterpretationHtml(
            `<p>${intro}</p><p>${bridge}</p><ul class="table-chart-bar-interpretation-categories">${listItems.join('')}</ul>`
        );
    }

    if (mode === 'allTypesOneSitio') {
        const { docTypes, monthData, yearData, sitioName } = extra;
        const showYear = chartViewState.documentsPieMetric === 'year';
        const rows = (docTypes || []).map(type => ({
            label: type,
            value: showYear ? Number(yearData[type]) || 0 : Number(monthData[type]) || 0
        }));
        const totalAll = showYear ? Number(yearData.total) || 0 : Number(monthData.total) || 0;
        const sorted = [...rows].sort((a, b) => b.value - a.value);
        const top = sorted[0];
        const sitioEsc = esc(sitioName);
        let intro = `Ipinapakita ng bar graph na ito ang mga request ng dokumento para sa sitio na <strong>${sitioEsc}</strong> sa ilalim ng <strong>${scopePhrase}</strong>, tugma sa sitio filter. Bawat kolumna ay isang uri ng dokumento kasama ang <strong>Total</strong>. `;
        if (top && top.value > 0) {
            intro += `Pinakamataas sa view na ito ang <strong>${esc(documentTypeFilterDisplayName(top.label))}</strong> na may <strong>${top.value.toLocaleString()}</strong> na request. `;
        }
        intro += `Ang <strong>Total</strong> para sa sitio na ito ay <strong>${totalAll.toLocaleString()}</strong> na request.`;

        const listItems = (docTypes || []).map(cat => {
            const v = showYear ? Number(yearData[cat]) || 0 : Number(monthData[cat]) || 0;
            const catDisplay = esc(documentTypeFilterDisplayName(cat));
            return `<li><strong>${catDisplay}</strong>: <strong>${v.toLocaleString()}</strong> na request sa bar sa itaas para lamang sa sitio na <strong>${sitioEsc}</strong>.</li>`;
        });
        const bridge = `Tugma ang bawat halaga sa taas ng bar para sa kategoryang iyon habang naka-apply ang sitio filter.`;
        return wrapDocumentBarInterpretationHtml(
            `<p>${intro}</p><p>${bridge}</p><ul class="table-chart-bar-interpretation-categories">${listItems.join('')}</ul>`
        );
    }

    return '';
}

/**
 * Document Request pie interpretation: Tagalog; disk = slices; sum = scope total; lists all sitios where applicable.
 * @param {'allTypesBarangay'|'allTypesSitio'|'bySitioForDoc'} mode
 */
function buildDocumentPieInterpretationHtml(segments, total, mode, extra = {}) {
    if (!segments || segments.length === 0 || total <= 0) {
        return '';
    }
    const sorted = segments
        .map(s => ({
            label: String(s.label),
            value: Math.max(0, Number(s.value) || 0)
        }))
        .sort((a, b) => b.value - a.value);
    const esc = escapeChartText;
    const scopePhrase = formatEnglishScopePhrase();
    const analyticsData = extra.analyticsData || null;

    const { rows: sitioRowsAllTypes } = computeSitioDocumentTotalsAllTypes(analyticsData || {});
    const sitioListAllTypesHtml = (() => {
        const withReq = sitioRowsAllTypes.filter(r => r.total > 0);
        if (withReq.length === 0) {
            return '<p class="table-chart-pie-interpretation-sitio-note">Walang available na kabuuan kada sitio para sa panahong ito.</p>';
        }
        const items = withReq.map(
            r =>
                `<li><strong>${esc(r.name)}</strong>: <strong>${r.total.toLocaleString()}</strong> kabuuang request sa lahat ng uri ng dokumento sa saklaw na ito.</li>`
        );
        return `<p class="table-chart-pie-interpretation-sitio-head">Lahat ng sitio na may request ng dokumento sa panahong ito (buong barangay kada sitio, pinagsamang lahat ng uri):</p><ul class="table-chart-pie-interpretation-sitios">${items.join('')}</ul>`;
    })();

    if (mode === 'bySitioForDoc') {
        const docName = esc(documentTypeFilterDisplayName(extra.docLabel || ''));
        const sitioFilterNote =
            extra.filteredToSingleSitio === true
                ? 'Tanging ang napiling sitio sa filter ang makikita sa chart na ito. '
                : '';
        const lead = `${sitioFilterNote}May isang slice bawat sitio ang pie. Ang kabuuan ng lahat ng slice ay ang <strong>kabuuang request na ${docName} sa buong barangay</strong> sa ilalim ng <strong>${scopePhrase}</strong>: <strong>${total.toLocaleString()}</strong>. Tugma ang bawat slice sa legend.`;
        const sliceItems = sorted.map(s => {
            const v = s.value;
            const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';
            return `<li><strong>${esc(s.label)}</strong>: <strong>${v.toLocaleString()}</strong> na request, <strong>${pct}%</strong> ng lahat ng request na ${docName} sa buong barangay sa view na ito.</li>`;
        });
        const sitioUl = `<p class="table-chart-pie-interpretation-sitio-head">Lahat ng sitio sa disk:</p><ul class="table-chart-pie-interpretation-sitios">${sliceItems.join('')}</ul>`;
        return `<div class="table-chart-pie-interpretation" role="note"><p>${lead}</p>${sitioUl}</div>`;
    }

    if (mode === 'allTypesSitio') {
        const sitioLabel = esc(extra.sitioName || '—');
        const introPie = `May isang slice bawat kategorya ng dokumento ang pie para sa sitio na <strong>${sitioLabel}</strong> sa ilalim ng <strong>${scopePhrase}</strong>, tugma sa sitio filter. Ang kabuuan ng mga slice ay ang kabuuang request mula sa sitio na ito: <strong>${total.toLocaleString()}</strong>.`;

        const listItems = segments.map(seg => {
            const v = Math.max(0, Number(seg.value) || 0);
            const catDisplay = esc(documentTypeFilterDisplayName(String(seg.label)));
            const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';
            return `<li><strong>${catDisplay}</strong>: <strong>${v.toLocaleString()}</strong> na request, <strong>${pct}%</strong> ng kabuuan ng sitio na ito sa view na ito.</li>`;
        });
        const bridge = `Itinuturo ng listahan sa itaas ang bawat sitio na may kahit isang request sa saklaw na ito. Ang listahan sa ibaba ay bawat uri ng dokumento para lamang sa sitio na <strong>${sitioLabel}</strong>.`;
        const listHtml = `<ul class="table-chart-pie-interpretation-categories">${listItems.join('')}</ul>`;
        return `<div class="table-chart-pie-interpretation" role="note"><p>${introPie}</p>${sitioListAllTypesHtml}<p>${bridge}</p>${listHtml}</div>`;
    }

    const introPie = `May isang slice bawat kategorya ng dokumento ang pie. Kinakalkula ang mga halaga sa pamamagitan ng <strong>pagdaragdag ng bilang sa lahat ng sitio</strong> sa breakdown, hiwalay sa kabuuan ng bar graph. Ang kabuuan ng lahat ng slice ay <strong>${total.toLocaleString()}</strong> sa ilalim ng <strong>${scopePhrase}</strong> nang walang sitio filter.`;

    const listItems = segments.map(seg => {
        const cat = String(seg.label);
        const catDisplay = esc(documentTypeFilterDisplayName(cat));
        const v = Math.max(0, Number(seg.value) || 0);
        const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';
        return `<li><strong>${catDisplay}</strong>: <strong>${v.toLocaleString()}</strong> na request, <strong>${pct}%</strong> ng kabuuang pinagsama mula sa mga sitio sa view na ito.</li>`;
    });

    const listHtml = `<ul class="table-chart-pie-interpretation-categories">${listItems.join('')}</ul>`;
    const bridge = 'Tugma ang listahan ng kategorya sa laki ng slice at sa legend. Ang listahan ng sitio sa itaas ay pinagsamang kabuuan kada sitio sa lahat ng uri ng dokumento mula sa parehong breakdown.';

    return `<div class="table-chart-pie-interpretation" role="note"><p>${introPie}</p>${sitioListAllTypesHtml}<p>${bridge}</p>${listHtml}</div>`;
}

function buildPieConicGradient(segments) {
    const total = segments.reduce((s, x) => s + Math.max(0, Number(x.value) || 0), 0);
    if (total <= 0) {
        return '#e2e8f0';
    }
    let acc = 0;
    const parts = [];
    segments.forEach(seg => {
        const v = Math.max(0, Number(seg.value) || 0);
        if (v <= 0) {
            return;
        }
        const pct = (v / total) * 100;
        const start = acc;
        acc += pct;
        parts.push(`${seg.color} ${start}% ${acc}%`);
    });
    if (parts.length === 0) {
        return '#e2e8f0';
    }
    return `conic-gradient(from 0.25turn, ${parts.join(', ')})`;
}

/** Porsiyento sa slice label — compact gaya ng reference. */
function formatDonutSlicePercent(value, total) {
    if (total <= 0) {
        return '0%';
    }
    const p = (value / total) * 100;
    if (p < 10 && p > 0) {
        return `${p.toFixed(2)}%`;
    }
    if (p < 100) {
        return `${p.toFixed(1)}%`;
    }
    return `${Math.round(p)}%`;
}

function donutArcPath(cx, cy, r0, r1, a0, a1) {
    let d = a1 - a0;
    while (d < 0) {
        d += 2 * Math.PI;
    }
    while (d > 2 * Math.PI) {
        d -= 2 * Math.PI;
    }
    if (d < 1e-9) {
        return '';
    }
    if (d >= 2 * Math.PI - 1e-7) {
        const p1 = donutArcPath(cx, cy, r0, r1, a0, a0 + Math.PI);
        const p2 = donutArcPath(cx, cy, r0, r1, a0 + Math.PI, a0 + 2 * Math.PI);
        return `${p1} ${p2}`.trim();
    }
    const largeArc = d > Math.PI ? 1 : 0;
    const x0 = cx + r0 * Math.cos(a0);
    const y0 = cy + r0 * Math.sin(a0);
    const x1 = cx + r0 * Math.cos(a1);
    const y1 = cy + r0 * Math.sin(a1);
    const x2 = cx + r1 * Math.cos(a1);
    const y2 = cy + r1 * Math.sin(a1);
    const x3 = cx + r1 * Math.cos(a0);
    const y3 = cy + r1 * Math.sin(a0);
    return `M ${x0} ${y0} A ${r0} ${r0} 0 ${largeArc} 1 ${x1} ${y1} L ${x2} ${y2} A ${r1} ${r1} 0 ${largeArc} 0 ${x3} ${y3} Z`;
}

/** Maikling label sa hover kung mahaba ang pangalan ng sitio / uri ng dokumento. */
function truncateDonutLabel(s, maxLen) {
    const t = String(s || '').trim();
    if (!t) {
        return '—';
    }
    if (t.length <= maxLen) {
        return t;
    }
    return `${t.slice(0, Math.max(1, maxLen - 1))}…`;
}

/**
 * Document Requests: donut SVG — solid colors (bar graph palette), gitnang kabuuan, % sa slice;
 * hover: scale mula sa gitna + shadow (hindi static explode).
 */
function buildPieDonutSvgHtml(segments, total) {
    const cx = 50;
    const cy = 50;
    const rOuter = 38;
    const rInner = 25.2;
    const ringW = rOuter - rInner;
    const labelR = rInner + ringW * 0.52;
    const sliceStroke = 'rgba(255,255,255,0.92)';
    const sliceStrokeW = 1.05;

    let acc = 0;
    const metaByIndex = [];
    segments.forEach(seg => {
        const v = Math.max(0, Number(seg.value) || 0);
        if (v <= 0 || total <= 0) {
            metaByIndex.push(null);
            return;
        }
        const a0 = -Math.PI / 2 + (2 * Math.PI * acc) / total;
        acc += v;
        const a1 = -Math.PI / 2 + (2 * Math.PI * acc) / total;
        metaByIndex.push({ a0, a1, v, seg });
    });

    const drawOrder = segments.map((_, i) => i).sort((a, b) => a - b);

    const pieces = [];
    let orderNum = 0;
    drawOrder.forEach(idx => {
        const meta = metaByIndex[idx];
        if (!meta) {
            return;
        }
        const { a0, a1, v, seg } = meta;
        const mid = (a0 + a1) / 2;
        const d = donutArcPath(cx, cy, rOuter, rInner, a0, a1);
        if (!d) {
            return;
        }
        const fill = String(seg.color || getDocumentTypePieColor(seg.label) || '#64748b').replace(/[<>"']/g, '');
        const delay = orderNum * 0.042;
        orderNum += 1;
        const pctStr = formatDonutSlicePercent(v, total);
        const arcSpan = a1 - a0;
        const showPct = arcSpan > 0.12 && v / total >= 0.028;
        const lx = cx + labelR * Math.cos(mid);
        const ly = cy + labelR * Math.sin(mid);
        const pctEl = showPct
            ? `<text class="table-chart-pie-donut-slice-pct" x="${lx.toFixed(3)}" y="${ly.toFixed(3)}" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="4.6" font-weight="700" font-family="system-ui, Segoe UI, sans-serif" pointer-events="none">${pctStr}</text>`
            : '';
        const labelRaw = String(seg.label || '—');
        const tipLine = `${labelRaw}: ${v.toLocaleString()} (${pctStr})`;
        const titleEl = `<title>${escapeChartText(tipLine)}</title>`;
        const hoverR = 44.8;
        const hx = cx + hoverR * Math.cos(mid);
        const hy = cy + hoverR * Math.sin(mid);
        const showHoverName = arcSpan > 0.09;
        const nameShort = truncateDonutLabel(labelRaw, 18);
        const nameEl = showHoverName
            ? `<text class="table-chart-pie-donut-slice-hover-label" x="${hx.toFixed(3)}" y="${hy.toFixed(3)}" text-anchor="middle" dominant-baseline="central" fill="#1e293b" font-size="3.15" font-weight="700" font-family="system-ui, Segoe UI, sans-serif" pointer-events="none">${escapeChartText(
                  nameShort
              )}</text>`
            : '';
        pieces.push(`<g class="table-chart-pie-donut-slice" style="animation-delay:${delay}s">
            ${titleEl}
            <path class="table-chart-pie-donut-slice-path" paint-order="stroke fill" d="${d}" fill="${fill}" stroke="${sliceStroke}" stroke-width="${sliceStrokeW}" stroke-linejoin="round"/>
            ${pctEl}
            ${nameEl}
        </g>`);
    });

    const centerLine1 = total.toLocaleString();
    const centerLine2 = 'TOTAL';
    const centerGroup = `<g class="table-chart-pie-donut-center" pointer-events="none">
        <text class="table-chart-pie-donut-center-num" x="${cx}" y="${cy - 2.2}" text-anchor="middle" dominant-baseline="central" fill="#0f172a" font-size="7.2" font-weight="800" font-family="system-ui, Segoe UI, sans-serif">${centerLine1}</text>
        <text class="table-chart-pie-donut-center-sub" x="${cx}" y="${cy + 5.2}" text-anchor="middle" dominant-baseline="central" fill="#64748b" font-size="3.6" font-weight="600" font-family="system-ui, Segoe UI, sans-serif" letter-spacing="0.06em">${centerLine2}</text>
    </g>`;

    const holeR = Math.max(0, rInner - 0.35);
    const hole = `<circle class="table-chart-pie-donut-hole" cx="${cx}" cy="${cy}" r="${holeR}" fill="#ffffff"/>`;

    return `<svg class="table-chart-pie-donut-svg" viewBox="0 0 100 100" width="100%" height="100%" focusable="false">${hole}${pieces.join('')}${centerGroup}</svg>`;
}

/**
 * Pie chart — parehong visual language (heading, legend list) tulad ng bar graph.
 * @param {object} options skipSort, sort, subheading, emptyMessage;
 *   legendCountFirst: true = bilang muna bago ang % (Document Requests);
 *   pieLayoutExtraClass: dagdag na class sa pie layout wrapper;
 *   pieInterpretationBuilder(segs, total): HTML na idaragdag sa ilalim ng plot row (Document Requests).
 */
function renderTablePieChart(containerId, heading, segments, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }
    const subHtml = options.subheading
        ? `<p class="document-requests-chart-sub">${escapeChartText(options.subheading)}</p>`
        : '';
    let segs = (segments || []).map(s => ({
        label: s.label,
        value: Math.max(0, Number(s.value) || 0),
        color: s.color || '#64748b'
    }));
    if (!options.skipSort) {
        segs = sortPieSegments(segs, options.sort || 'value-desc');
    }
    const total = segs.reduce((a, s) => a + s.value, 0);
    if (total <= 0 || segs.length === 0) {
        const msg = options.emptyMessage || 'Walang datos para sa pie chart.';
        container.innerHTML = `
            <p class="table-chart-heading">${escapeChartText(heading)}</p>
            ${subHtml}
            <p class="sitio-chart-empty">${escapeChartText(msg)}</p>`;
        return;
    }
    const gradient = buildPieConicGradient(segs);
    const isDocumentDonutPie = String(options.pieLayoutExtraClass || '').includes('table-chart-pie-layout--documents');
    const legendSwatchColor = c => c;
    const pieDiskBlock = isDocumentDonutPie
        ? `<div class="table-chart-pie-disk table-chart-pie-disk--donut-svg" aria-hidden="true">${buildPieDonutSvgHtml(segs, total)}</div>`
        : `<div class="table-chart-pie-disk" style="background:${gradient}"></div>`;
    const countFirst = options.legendCountFirst === true;
    let ariaSummary = segs.map(s => `${s.label} ${s.value}`).join(', ');
    ariaSummary += `, total ${total.toLocaleString()}`;
    const legendItems = segs
        .map(s => {
            const pct = total > 0 ? Math.round((s.value / total) * 1000) / 10 : 0;
            const sw = legendSwatchColor(s.color || '#64748b');
            if (countFirst) {
                return `
            <li class="table-chart-pie-legend-item">
                <span class="table-chart-pie-swatch" style="background:${sw}"></span>
                <span class="table-chart-pie-legend-label">${escapeChartText(s.label)}</span>
                <span class="table-chart-pie-legend-meta table-chart-pie-legend-meta--count-first">
                    <span class="table-chart-pie-legend-val">${s.value.toLocaleString()}</span>
                    <span class="table-chart-pie-legend-pct">${pct}%</span>
                </span>
            </li>`;
            }
            return `
            <li class="table-chart-pie-legend-item">
                <span class="table-chart-pie-swatch" style="background:${sw}"></span>
                <span class="table-chart-pie-legend-label">${escapeChartText(s.label)}</span>
                <span class="table-chart-pie-legend-meta">${pct}% <span class="table-chart-pie-legend-val">(${s.value.toLocaleString()})</span></span>
            </li>`;
        })
        .join('');

    const layoutClass = ['table-chart-pie-layout', options.pieLayoutExtraClass].filter(Boolean).join(' ');
    const useLegendColumnLayout = countFirst || isDocumentDonutPie;
    const pieInner = useLegendColumnLayout
        ? `<div class="table-chart-pie-plot-row">
            ${pieDiskBlock}
            <div class="table-chart-pie-legend-col">
                <ul class="table-chart-pie-legend-list">${legendItems}</ul>
            </div>
        </div>` 
        : `${pieDiskBlock}
            <ul class="table-chart-pie-legend-list">${legendItems}</ul>`;

    let interpretationHtml = '';
    if (typeof options.pieInterpretationBuilder === 'function') {
        interpretationHtml = options.pieInterpretationBuilder(segs, total) || '';
    }
    const layoutRole = interpretationHtml ? 'group' : 'img';

    container.innerHTML = `
        <p class="table-chart-heading">${escapeChartText(heading)}</p>
        ${subHtml}
        <div class="${layoutClass}" role="${layoutRole}" aria-label="${escapeChartText(heading)}: ${escapeChartText(ariaSummary)}">
            ${pieInner}
            ${interpretationHtml}
        </div>`;
}

function refreshMainChartsFromState() {
    if (!lastAnalyticsData) {
        return;
    }
    renderConcernsTableChart(lastAnalyticsData);
    renderEmergencyTableChart(lastAnalyticsData);
    renderDocumentRequestsTableChart(lastAnalyticsData);
}

function updateMainChartToolbarUi() {
    document.querySelectorAll('[data-concerns-chart-visibility]').forEach(btn => {
        const key = btn.dataset.concernsChartVisibility;
        const visible = key === 'bar' ? chartViewState.concernsShowBar : chartViewState.concernsShowPie;
        btn.classList.toggle('is-active', visible);
        btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
    });
    document.querySelectorAll('[data-emergency-chart-visibility]').forEach(btn => {
        const key = btn.dataset.emergencyChartVisibility;
        const visible = key === 'bar' ? chartViewState.emergencyShowBar : chartViewState.emergencyShowHeatmap;
        btn.classList.toggle('is-active', visible);
        btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
    });
    document.querySelectorAll('.chart-visibility-btn[data-doc-chart-visibility]').forEach(btn => {
        const key = btn.dataset.docChartVisibility;
        const visible = key === 'bar' ? chartViewState.documentsShowBar : chartViewState.documentsShowPie;
        btn.classList.toggle('is-active', visible);
        btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
    });
    const docFilterEl = document.getElementById('documentRequestsDocFilter');
    if (docFilterEl && chartViewState.documentsDocFilter !== undefined) {
        docFilterEl.value = chartViewState.documentsDocFilter;
    }
    const sitioFilterEl = document.getElementById('documentRequestsSitioFilter');
    if (sitioFilterEl && chartViewState.documentsSitioFilter !== undefined) {
        sitioFilterEl.value = chartViewState.documentsSitioFilter;
    }
    const concernsSitioEl = document.getElementById('concernsSitioFilter');
    if (concernsSitioEl && chartViewState.concernsSitioFilter !== undefined) {
        concernsSitioEl.value = chartViewState.concernsSitioFilter;
    }
    const emergencySitioEl = document.getElementById('emergencySitioFilter');
    if (emergencySitioEl && chartViewState.emergencySitioFilter !== undefined) {
        emergencySitioEl.value = chartViewState.emergencySitioFilter;
    }
    document.getElementById('concernsPieExtra')?.toggleAttribute('hidden', !chartViewState.concernsShowPie);
    document.getElementById('documentsPieExtra')?.toggleAttribute('hidden', !chartViewState.documentsShowPie);

    const hasConcernsSitio = !!(chartViewState.concernsSitioFilter || '').trim();

    const showConcernsScopeToolbar =
        chartViewState.concernsShowBar ||
        (chartViewState.concernsShowPie &&
            chartViewState.concernsPieLayout === 'bySitio' &&
            !hasConcernsSitio);
    document.getElementById('concernsBarScopeWrap')?.toggleAttribute('hidden', !showConcernsScopeToolbar);

    const concernsBySitioPieUi =
        chartViewState.concernsShowPie &&
        chartViewState.concernsPieLayout === 'bySitio' &&
        !hasConcernsSitio;

    /* Scope = month: itago Show / Metric; year: Metric laging lumalabas; Show = by-sitio pie lang */
    const concernsScopeMonth = chartViewState.concernsPieSitioScope === 'month';
    document.querySelectorAll('.concerns-sitio-toolbar-field').forEach(el => {
        el.toggleAttribute('hidden', !concernsScopeMonth);
    });
    document.getElementById('concernsPieSitioTopWrap')?.toggleAttribute(
        'hidden',
        !concernsBySitioPieUi || concernsScopeMonth
    );
    document.getElementById('concernsPieSitioMetricWrap')?.toggleAttribute('hidden', concernsScopeMonth);

    const dpm = document.getElementById('documentsPieMetric');
    if (dpm) {
        dpm.value = chartViewState.documentsPieMetric;
    }
    const csm = document.getElementById('concernsPieSitioMetric');
    if (csm) {
        csm.value = chartViewState.concernsPieSitioMetric;
    }
    const cbs = document.getElementById('concernsBarScope');
    if (cbs) {
        cbs.value = chartViewState.concernsPieSitioScope;
    }
    const cst = document.getElementById('concernsPieSitioTop');
    if (cst) {
        cst.value = chartViewState.concernsPieSitioTop;
    }
}

function setupChartViewControls() {
    const bindSort = (id, stateKey) => {
        document.getElementById(id)?.addEventListener('change', e => {
            chartViewState[stateKey] = e.target.value;
            refreshMainChartsFromState();
        });
    };

    document.getElementById('documentsPieMetric')?.addEventListener('change', e => {
        chartViewState.documentsPieMetric = e.target.value;
        if (e.target.value === 'year') {
            chartViewState.documentsYearMonthTab = new Date().getMonth();
        }
        refreshMainChartsFromState();
    });

    bindSort('concernsPieSitioMetric', 'concernsPieSitioMetric');
    const syncConcernsScopeFromUi = val => {
        chartViewState.concernsPieSitioScope = val;
        updateMainChartToolbarUi();
        refreshMainChartsFromState();
    };
    document.getElementById('concernsBarScope')?.addEventListener('change', e => {
        syncConcernsScopeFromUi(e.target.value);
    });
    bindSort('concernsPieSitioTop', 'concernsPieSitioTop');

    document.body.addEventListener('click', e => {
        const monthTabBtn = e.target.closest('.doc-year-hbar-chart__month-tab');
        if (monthTabBtn) {
            const raw = monthTabBtn.getAttribute('data-doc-month-filter');
            if (raw !== null && raw !== '') {
                chartViewState.documentsYearMonthTab = Number(raw);
                refreshMainChartsFromState();
            }
            return;
        }
        const visBtn = e.target.closest('.chart-visibility-btn[data-doc-chart-visibility]');
        if (visBtn) {
            const key = visBtn.dataset.docChartVisibility;
            if (key === 'bar') {
                chartViewState.documentsShowBar = !chartViewState.documentsShowBar;
            } else if (key === 'pie') {
                chartViewState.documentsShowPie = !chartViewState.documentsShowPie;
            } else {
                return;
            }
            updateMainChartToolbarUi();
            refreshMainChartsFromState();
            return;
        }
        const cVis = e.target.closest('[data-concerns-chart-visibility]');
        if (cVis) {
            const key = cVis.dataset.concernsChartVisibility;
            if (key === 'bar') {
                chartViewState.concernsShowBar = !chartViewState.concernsShowBar;
            } else if (key === 'pie') {
                chartViewState.concernsShowPie = !chartViewState.concernsShowPie;
            } else {
                return;
            }
            updateMainChartToolbarUi();
            refreshMainChartsFromState();
            return;
        }
        const eVis = e.target.closest('[data-emergency-chart-visibility]');
        if (eVis) {
            const key = eVis.dataset.emergencyChartVisibility;
            if (key === 'bar') {
                chartViewState.emergencyShowBar = !chartViewState.emergencyShowBar;
            } else if (key === 'heatmap') {
                chartViewState.emergencyShowHeatmap = !chartViewState.emergencyShowHeatmap;
            } else {
                return;
            }
            updateMainChartToolbarUi();
            refreshMainChartsFromState();
        }
    });

    document.getElementById('documentRequestsDocFilter')?.addEventListener('change', e => {
        chartViewState.documentsDocFilter = e.target.value || '';
        refreshMainChartsFromState();
    });

    document.getElementById('documentRequestsSitioFilter')?.addEventListener('change', e => {
        chartViewState.documentsSitioFilter = e.target.value || '';
        refreshMainChartsFromState();
    });

    document.getElementById('concernsSitioFilter')?.addEventListener('change', e => {
        chartViewState.concernsSitioFilter = e.target.value || '';
        updateMainChartToolbarUi();
        refreshMainChartsFromState();
    });

    document.getElementById('emergencySitioFilter')?.addEventListener('change', e => {
        chartViewState.emergencySitioFilter = e.target.value || '';
        refreshMainChartsFromState();
    });

    document.getElementById('emergencyChartsBox')?.addEventListener('change', e => {
        if (e.target?.id !== 'emergencyHeatmapMonthSelect') {
            return;
        }
        chartViewState.emergencyHeatmapMonthKey = e.target.value || '';
        refreshMainChartsFromState();
    });
}

/**
 * Proper bar chart: fixed plot height, Y-axis scale, grid; bar height = value / axisMax (not relative only to max bar).
 */
function renderTableBarChartRows(
    containerId,
    heading,
    bars,
    yAxisLabel = 'Count',
    subheading = null,
    xTitle = 'Categories',
    vizExtraClass = '',
    plotFooterHtml = ''
) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!bars || bars.length === 0) {
        container.innerHTML = '';
        return;
    }
    const subHtml = subheading
        ? `<p class="document-requests-chart-sub">${escapeChartText(subheading)}</p>`
        : '';
    const numericValues = bars.map(b => Number(b.value) || 0);
    const dataMax = Math.max(...numericValues, 0);
    const axisMax = countChartAxisMax(dataMax);
    const ticks = buildAxisTickLabels(axisMax, 5);
    const tickHtml = ticks.map(t => `<span>${t.toLocaleString()}</span>`).join('');

    const barHtml = bars.map((b, i) => {
        const v = numericValues[i];
        const pct = axisMax > 0 ? Math.min(100, (v / axisMax) * 100) : 0;
        const bg = b.color || '#64748b';
        const label = escapeChartText(b.label || '');
        return `
            <div class="table-chart-bar-slot table-chart-bar-slot--emergency-metric">
                <div class="table-chart-bar-doc-stack">
                    <span class="table-chart-bar-value table-chart-bar-value--doc-above">${v.toLocaleString()}</span>
                    <div class="table-chart-bar-fill table-chart-bar-fill--emergency-metric concerns-year-vbar-chart__bar-fill" style="--bar-pct:${pct};background:${bg}" aria-label="${label}: ${v}"></div>
                </div>
            </div>`;
    }).join('');

    const labelsRow = documentRequestsBarLabelsRowHtml(bars.map(b => b.label || ''));
    const ariaSummary = bars.map((b, i) => `${b.label} ${numericValues[i]}`).join(', ');

    container.innerHTML = `
        <p class="table-chart-heading">${escapeChartText(heading)}</p>
        ${subHtml}
        <div class="table-chart-viz table-chart-viz--documents table-chart-viz--emergency-bar ${vizExtraClass ? String(vizExtraClass).trim() : ''}" role="img" aria-label="${escapeChartText(heading)}: ${escapeChartText(ariaSummary)}">
            <div class="table-chart-y-label">${escapeChartText(yAxisLabel)}</div>
            <div class="table-chart-y-axis" aria-hidden="true">${tickHtml}</div>
            <div class="table-chart-doc-plot-stack">
                <div class="table-chart-plot-wrap table-chart-plot-wrap--documents">
                    <div class="table-chart-doc-hscroll">
                        <div class="table-chart-doc-hscroll-inner">
                            <div class="table-chart-plot table-chart-plot--documents-bars">
                                <div class="table-chart-grid-bg" style="--grid-lines:5"></div>
                                <div class="table-chart-bar-layer table-chart-bar-layer--documents">${barHtml}</div>
                            </div>
                            ${labelsRow}
                        </div>
                    </div>
                    <p class="table-chart-x-title">${escapeChartText(xTitle)}</p>
                </div>
                ${plotFooterHtml || ''}
            </div>
        </div>`;
}

/** AI buod (Groq) sa ilalim ng bar plot — pareho ng lapad sa document bar interpretation */
function buildEmergencyBarAiInterpretationHtml(rawText) {
    const t = String(rawText || '').trim();
    if (!t) {
        return '';
    }
    const esc = escapeChartText;
    return `<div class="table-chart-bar-interpretation table-chart-bar-interpretation--emergency-ai" role="note">
        <p class="table-chart-bar-interpretation__emergency-label">Buod (Emergency reports)</p>
        <p class="table-chart-bar-interpretation__lead">${esc(t)}</p>
    </div>`;
}

/** Groq lamang — php/emergency_heatmap_interpretation.php */
let emergencyHeatmapAiAbort = null;
/** Census seniors by sitio — php/census_senior_sitio_interpretation.php */
let censusSeniorAiAbort = null;
/** Census widowed by sitio — php/census_widowed_sitio_interpretation.php */
let censusWidowedAiAbort = null;
/** Census employed by sitio — php/census_employed_sitio_interpretation.php */
let censusEmployedAiAbort = null;
/** Census unemployed by sitio — php/census_unemployed_sitio_interpretation.php */
let censusUnemployedAiAbort = null;
/** Census students by sitio — php/census_students_sitio_interpretation.php */
let censusStudentsAiAbort = null;
/** Census PWD by sitio — php/census_pwd_sitio_interpretation.php */
let censusPwdAiAbort = null;
/** Census Indigenous (IP) by sitio — php/census_indigenous_sitio_interpretation.php */
let censusIndigenousAiAbort = null;

function buildEmergencyHeatmapGroqInterpretationBlock(text, groqConfigured) {
    const t = String(text || '').trim();
    const esc = escapeChartText;
    if (!t) {
        if (!groqConfigured) {
            return `<div class="table-chart-bar-interpretation table-chart-bar-interpretation--emergency-heatmap" role="note">
                <p class="table-chart-bar-interpretation__emergency-label">Buod (Heat map — araw-araw)</p>
                <p class="table-chart-bar-interpretation__lead">Maglagay ng <strong>GROQ_API_KEY</strong> o <strong>EMERGENCY_GRAPH_GROQ_API_KEY</strong> sa .env para sa buod na ito (Groq).</p>
            </div>`;
        }
        return `<div class="table-chart-bar-interpretation table-chart-bar-interpretation--emergency-heatmap" role="note">
            <p class="table-chart-bar-interpretation__emergency-label">Buod (Heat map — araw-araw)</p>
            <p class="table-chart-bar-interpretation__lead">Hindi nakumpleto ang buod mula sa Groq. Subukan muli mamaya.</p>
        </div>`;
    }
    return `<div class="table-chart-bar-interpretation table-chart-bar-interpretation--emergency-heatmap" role="note">
        <p class="table-chart-bar-interpretation__emergency-label">Buod (Heat map — araw-araw)</p>
        <p class="table-chart-bar-interpretation__lead">${esc(t)}</p>
    </div>`;
}

async function loadEmergencyHeatmapGroqInterpretation(year, month, sitio) {
    const slot = document.getElementById('emergencyHeatmapAiSlot');
    if (!slot) {
        return;
    }
    if (emergencyHeatmapAiAbort) {
        emergencyHeatmapAiAbort.abort();
    }
    emergencyHeatmapAiAbort = new AbortController();
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (sitio && String(sitio).trim()) {
        params.set('sitio', String(sitio).trim());
    }
    slot.innerHTML = '<p class="emergency-heatmap-ai-slot__loading">Kumukuha ng buod…</p>';
    try {
        const res = await fetch(`php/emergency_heatmap_interpretation.php?${params}`, {
            credentials: 'same-origin',
            signal: emergencyHeatmapAiAbort.signal
        });
        if (res.status === 403) {
            slot.innerHTML =
                '<p class="emergency-heatmap-ai-slot__err">Walang access sa buod (Admin lamang).</p>';
            return;
        }
        if (!res.ok) {
            slot.innerHTML = '<p class="emergency-heatmap-ai-slot__err">Hindi ma-load ang buod.</p>';
            return;
        }
        const data = await res.json();
        if (!data || data.success !== true) {
            slot.innerHTML = '<p class="emergency-heatmap-ai-slot__err">Walang tugon mula sa server.</p>';
            return;
        }
        slot.innerHTML = buildEmergencyHeatmapGroqInterpretationBlock(
            data.interpretation,
            data.groqConfigured === true
        );
    } catch (e) {
        if (e && e.name === 'AbortError') {
            return;
        }
        slot.innerHTML = '<p class="emergency-heatmap-ai-slot__err">Error sa pagkuha ng buod.</p>';
    }
}

/**
 * Bar graph: kabuuang emergency reported bawat buwan (Enero–Disyembre) — barangay o isang sitio.
 * @param {object} yearByMonth `{ reported: number[] }` (12 indices)
 */
function renderEmergencyMonthlyReportedBarChart(containerId, yearByMonth, subheading, plotFooterHtml = '') {
    const rep = yearByMonth?.reported || [];
    const bars = DOCUMENT_MONTH_SHORT_LABELS.map((lab, i) => ({
        label: lab,
        value: Math.max(0, Number(rep[i]) || 0),
        color: '#2563eb'
    }));
    renderTableBarChartRows(
        containerId,
        'Bar graph',
        bars,
        'Count',
        subheading,
        'Month (Jan – Dec)',
        'table-chart-viz--emergency-monthly',
        plotFooterHtml
    );
}

/** Legend — stacked status + revoked column (grey), tulad ng year Jan–Dec chart. */
function concernsBarLegendStackedStatusHtml() {
    return `<div class="table-chart-legend">
            <span><i class="table-chart-legend-swatch unresolved" aria-hidden="true"></i> New &amp; processing</span>
            <span><i class="table-chart-legend-swatch resolved" aria-hidden="true"></i> Resolved</span>
            <span><i class="table-chart-legend-swatch revoked" aria-hidden="true"></i> Revoked</span>
        </div>`;
}

function concernsBarLegendResolvedOnlyHtml() {
    return `<div class="table-chart-legend">
            <span><i class="table-chart-legend-swatch resolved" aria-hidden="true"></i> Resolved</span>
        </div>`;
}

function getConcernsBarChartSubLabel(barSub, scopeLabel) {
    if (barSub && String(barSub).trim()) {
        return `${String(barSub).trim()} — ${scopeLabel}`;
    }
    return `Concerns bawat sitio — na-resolve at bago/pinoproseso (${scopeLabel}, buong barangay)`;
}

const CONCERNS_STACKED_BAR_TOOLTIP_ID = 'concernsStackedBarSegmentTooltip';

function getConcernsStackedBarTooltipEl() {
    let el = document.getElementById(CONCERNS_STACKED_BAR_TOOLTIP_ID);
    if (!el) {
        el = document.createElement('div');
        el.id = CONCERNS_STACKED_BAR_TOOLTIP_ID;
        el.className = 'concerns-stacked-bar-tooltip';
        el.setAttribute('role', 'tooltip');
        el.hidden = true;
        document.body.appendChild(el);
        document.addEventListener('scroll', hideConcernsStackedBarTooltip, true);
    }
    return el;
}

function hideConcernsStackedBarTooltip() {
    const el = document.getElementById(CONCERNS_STACKED_BAR_TOOLTIP_ID);
    if (el) {
        el.hidden = true;
        el.style.visibility = 'hidden';
    }
}

function positionConcernsStackedBarTooltip(tip, target) {
    const rect = target.getBoundingClientRect();
    const margin = 6;
    tip.style.left = `${rect.left + rect.width / 2}px`;
    tip.style.top = `${rect.top - margin}px`;
    requestAnimationFrame(() => {
        const tr = tip.getBoundingClientRect();
        if (tr.top < 6) {
            tip.style.top = `${rect.bottom + margin}px`;
            tip.classList.add('concerns-stacked-bar-tooltip--below');
        } else {
            tip.classList.remove('concerns-stacked-bar-tooltip--below');
        }
    });
}

function showConcernsStackedBarTooltip(target) {
    const r = Number(target.getAttribute('data-resolved')) || 0;
    const n = Number(target.getAttribute('data-new')) || 0;
    const p = Number(target.getAttribute('data-processing')) || 0;
    const unresolved = n + p;
    const headingRaw = (target.getAttribute('data-tooltip-heading') || '').trim();
    const headingBlock = headingRaw
        ? `<div class="concerns-stacked-bar-tooltip__heading">${escapeChartText(headingRaw)}</div>`
        : '';
    const segment = (target.getAttribute('data-tooltip-segment') || '').trim().toLowerCase();
    let rowsHtml;
    if (segment === 'unresolved') {
        rowsHtml = `<div class="concerns-stacked-bar-tooltip__row"><span>Unresolved</span><strong>${unresolved.toLocaleString()}</strong></div>`;
    } else if (segment === 'resolved') {
        rowsHtml = `<div class="concerns-stacked-bar-tooltip__row"><span>Resolved</span><strong>${r.toLocaleString()}</strong></div>`;
    } else {
        rowsHtml = `<div class="concerns-stacked-bar-tooltip__row"><span>Resolved</span><strong>${r.toLocaleString()}</strong></div><div class="concerns-stacked-bar-tooltip__row"><span>Unresolved</span><strong>${unresolved.toLocaleString()}</strong></div>`;
    }
    const tip = getConcernsStackedBarTooltipEl();
    tip.innerHTML = `${headingBlock}${rowsHtml}`;
    tip.hidden = false;
    tip.style.visibility = 'visible';
    positionConcernsStackedBarTooltip(tip, target);
}

function showConcernsRevokedColumnTooltip(target) {
    const rev = Number(target.getAttribute('data-revoked')) || 0;
    const headingRaw = (target.getAttribute('data-tooltip-heading') || '').trim();
    const headingBlock = headingRaw
        ? `<div class="concerns-stacked-bar-tooltip__heading">${escapeChartText(headingRaw)}</div>`
        : '';
    const tip = getConcernsStackedBarTooltipEl();
    tip.innerHTML = `${headingBlock}<div class="concerns-stacked-bar-tooltip__row"><span>Revoked</span><strong>${rev.toLocaleString()}</strong></div>`;
    tip.hidden = false;
    tip.style.visibility = 'visible';
    positionConcernsStackedBarTooltip(tip, target);
}

function bindConcernsYearRevokedColumnTooltips(container) {
    if (!container) {
        return;
    }
    container.querySelectorAll('.concerns-year-vbar-chart__bar-revoked-tooltip').forEach(el => {
        el.addEventListener('pointerenter', () => showConcernsRevokedColumnTooltip(el));
        el.addEventListener('pointerleave', hideConcernsStackedBarTooltip);
    });
}

function bindConcernsStackedBarSegmentTooltips(container) {
    if (!container) {
        return;
    }
    container.querySelectorAll('.concerns-stacked-bar__segment').forEach(seg => {
        seg.addEventListener('pointerenter', () => showConcernsStackedBarTooltip(seg));
        seg.addEventListener('pointerleave', hideConcernsStackedBarTooltip);
    });
}

/**
 * Isang stacked bar bawat sitio: pula (taas) = new + processing; berde (ibaba) = resolved (mula sa DB).
 * Taas ng bar = resolved + (new & processing). Scope: `chartViewState.concernsPieSitioScope`.
 */
function renderConcernsSitioStackedBarLayout(containerId, data, barSub, sitioFilter) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    const scope = chartViewState.concernsPieSitioScope === 'year' ? 'year' : 'month';
    const scopeLabel = scope === 'year' ? 'taong ito' : 'buwan na ito';
    const resolvedOnlyYear = scope === 'year' && chartViewState.concernsPieSitioMetric === 'resolved';
    let list = Array.isArray(data.bySitio) ? data.bySitio : [];
    if (sitioFilter) {
        list = list.filter(b => (b.sitio || '') === sitioFilter);
    }
    if (list.length === 0) {
        container.innerHTML =
            '<p class="table-chart-heading">Bar graph</p><p class="sitio-chart-empty">No data by sitio.</p>';
        return;
    }

    /* Mga bilang ay mula lang sa MySQL `concerns.status` (aggregated sa php/analytics.php) — walang kinakalkula dito gaya ng reported−resolved. */
    let rows = list.map(block => {
        const c = block.concerns?.[scope] || {};
        const res = Math.max(0, Number(c.resolved) || 0);
        const newC = Math.max(0, Number(c.new) || 0);
        const proc = Math.max(0, Number(c.processing) || 0);
        const rev = Math.max(0, Number(c.revoked) || 0);
        const secondary = newC + proc;
        const total = Math.max(0, res + secondary);
        return { sitio: block.sitio || '—', total, resolved: res, new: newC, processing: proc, secondary, revoked: rev };
    });
    // Concerns sitio bar graph: always hide sitios with zero counts.
    rows = resolvedOnlyYear
        ? rows.filter(r => Number(r.resolved) > 0)
        : rows.filter(r => Number(r.total) > 0 || Number(r.revoked) > 0);
    if (rows.length === 0) {
        container.innerHTML =
            '<p class="table-chart-heading">Bar graph</p><p class="sitio-chart-empty">No concerns data by sitio (or all are zero).</p>';
        return;
    }
    const dataMax = resolvedOnlyYear
        ? Math.max(...rows.map(r => Number(r.resolved) || 0), 0)
        : Math.max(...rows.map(r => Math.max(r.total, r.revoked || 0)), 0);
    const axisMax = countChartAxisMax(Math.max(dataMax, 1));
    const ticks = buildAxisTickLabels(axisMax, 5);
    const tickHtml = ticks.map(t => `<span>${t.toLocaleString()}</span>`).join('');
    const barPct = v => (axisMax > 0 ? Math.min(100, ((Number(v) || 0) / axisMax) * 100) : 0);
    const tooltipPeriodLabel = scope === 'month' ? String(data.concerns?.monthLabel || '').trim() : '';

    const typeBlocks = rows
        .map(r => {
            const total = r.total;
            const res = r.resolved;
            const newC = r.new;
            const proc = r.processing;
            const secondary = r.secondary;
            const rev = r.revoked || 0;
            const stackPct = barPct(total);
            const revPct = barPct(rev);
            const resFlex = total > 0 ? res : 0;
            const secondaryFlex = total > 0 ? secondary : 0;
            const sitioEsc = escapeChartText(r.sitio);
            const aria = `${r.sitio}: stack total ${total}; unresolved ${secondary}; resolved ${res}; revoked ${rev} (${scopeLabel})`;
            const tipBase = `data-resolved="${res}" data-new="${newC}" data-processing="${proc}"`;
            const tipHeading =
                tooltipPeriodLabel.length > 0 ? ` data-tooltip-heading="${escapeChartText(tooltipPeriodLabel)}"` : '';
            const tipAttrsUnresolved = `${tipBase}${tipHeading} data-tooltip-segment="unresolved"`;
            const tipAttrsResolved = `${tipBase}${tipHeading} data-tooltip-segment="resolved"`;
            if (resolvedOnlyYear) {
                const resPct = barPct(res);
                const resolvedOnlyAria = `${r.sitio}: resolved ${res} (${scopeLabel})`;
                const resolvedBlock =
                    res > 0
                        ? `<div class="concerns-stacked-bar" style="--bar-pct:${resPct}" role="img" aria-label="${escapeChartText(
                              resolvedOnlyAria
                          )}">
                            <div class="concerns-stacked-bar__segment concerns-stacked-bar__segment--resolved" ${tipAttrsResolved} style="flex: 1 1 0"></div>
                        </div>`
                        : `<div class="concerns-stacked-bar concerns-stacked-bar--empty" style="--bar-pct:0" role="img" aria-label="${sitioEsc}: no resolved"></div>`;
                return `
        <div class="table-chart-doc-group table-chart-doc-group--bars table-chart-doc-group--concerns-stacked">
            <div class="table-chart-bar-slot table-chart-bar-slot--concerns-stack">
                <div class="table-chart-bar-doc-stack">
                    <span class="table-chart-bar-value table-chart-bar-value--doc-above">${res.toLocaleString()}</span>
                    ${resolvedBlock}
                </div>
            </div>
        </div>`;
            }
            const revValSpan =
                rev > 0 ? `<span class="table-chart-bar-value table-chart-bar-value--doc-above">${rev.toLocaleString()}</span>` : '';
            const stackInner =
                total > 0
                    ? `<div class="concerns-stacked-bar__segment concerns-stacked-bar__segment--unresolved" ${tipAttrsUnresolved} style="flex: ${secondaryFlex} 1 0"></div>
                        <div class="concerns-stacked-bar__segment concerns-stacked-bar__segment--resolved" ${tipAttrsResolved} style="flex: ${resFlex} 1 0"></div>`
                    : '';
            const stackBlock =
                total > 0
                    ? `<div class="concerns-stacked-bar" style="--bar-pct:${stackPct}" role="img" aria-label="${escapeChartText(aria)}">${stackInner}</div>`
                    : `<div class="concerns-stacked-bar concerns-stacked-bar--empty" style="--bar-pct:0" role="img" aria-label="${sitioEsc}: no stack"></div>`;
            const revokedBlock = `<div class="table-chart-bar-fill concerns-year-vbar-chart__bar-fill concerns-year-vbar-chart__bar-fill--revoked concerns-year-vbar-chart__bar-revoked-tooltip concerns-sitio-revoked-bar" style="--bar-pct:${revPct}" data-revoked="${rev}" data-tooltip-heading="${sitioEsc}" aria-label="Revoked: ${rev}"></div>`;
            return `
        <div class="table-chart-doc-group table-chart-doc-group--bars table-chart-doc-group--concerns-stacked table-chart-doc-group--concerns-sitio-pair">
            <div class="concerns-year-vbar-chart__pair concerns-sitio-stack-revoke-pair">
            <div class="table-chart-bar-slot concerns-year-vbar-chart__bar-slot table-chart-bar-slot--concerns-stack">
                <div class="table-chart-bar-doc-stack">
                    <span class="table-chart-bar-value table-chart-bar-value--doc-above">${total.toLocaleString()}</span>
                    ${stackBlock}
                </div>
            </div>
            <div class="table-chart-bar-slot concerns-year-vbar-chart__bar-slot table-chart-bar-slot--concerns-stack">
                <div class="table-chart-bar-doc-stack">
                    ${revValSpan}
                    ${revokedBlock}
                </div>
            </div>
            </div>
        </div>`;
        })
        .join('');

    const labelsRow = documentRequestsBarLabelsRowHtml(rows.map(r => r.sitio));
    const subLabel = getConcernsBarChartSubLabel(barSub, scopeLabel);
    const sitioTotals = rows.map(r => ({
        sitio: String(r.sitio || '—'),
        total: resolvedOnlyYear ? Math.max(0, Number(r.resolved) || 0) : Math.max(0, Number(r.total) || 0)
    }));
    const grandTotal = sitioTotals.reduce((sum, row) => sum + row.total, 0);
    const rankedSitios = [...sitioTotals].sort((a, b) => b.total - a.total);
    const topSitio = rankedSitios[0] || null;
    const secondSitio = rankedSitios.length > 1 ? rankedSitios[1] : null;
    const topSitioName = topSitio ? escapeChartText(topSitio.sitio) : '—';
    const topSitioCount = topSitio ? topSitio.total : 0;
    const secondSitioName = secondSitio ? escapeChartText(secondSitio.sitio) : '';
    const secondSitioCount = secondSitio ? secondSitio.total : 0;
    const topSitioRaw = topSitio ? String(topSitio.sitio || '').trim() : '';
    const topSitioBlock = (data.bySitio || []).find(b => String(b.sitio || '').trim() === topSitioRaw) || null;
    const topSitioInsight = topSitioBlock?.concerns?.statementInsights?.[scope] || null;
    const dominantTopicKey = topSitioInsight?.topicKey ? String(topSitioInsight.topicKey).trim() : 'other';
    const dominantTopicLabel = topSitioInsight?.topicLabel ? String(topSitioInsight.topicLabel).trim() : '';
    const dominantTopicCount = Math.max(0, Number(topSitioInsight?.topicCount) || 0);
    const dominantTotalStatements = Math.max(0, Number(topSitioInsight?.totalStatements) || 0);
    const actionMap = {
        crime_safety: [
            'Mas madalas na pag-ikot ng tanod sa gabi',
            'Paglalagay ng CCTV at karagdagang ilaw sa mga daanan',
            'Mas mahigpit na pagpapatupad ng curfew'
        ],
        environment: [
            'Regular na cleanup drive sa mga lugar na madalas ireklamo',
            'Mas mahigpit na paalala at pagpapatupad laban sa maling pagtatapon ng basura',
            'Lingguhang inspeksyon sa mga hotspot para hindi na lumala ang dumi at polusyon'
        ],
        drainage_flood: [
            'Regular na paglilinis at declogging ng kanal',
            'Mabilis na clearing team kapag may ulat ng baradong drainage',
            'Mas maagang paghahanda bago ang malakas na ulan'
        ],
        road_infra: [
            'Unahin ang pag-ayos ng pinaka-delikadong sira sa kalsada o daanan',
            'Lagyan ng warning signs o harang ang sirang bahagi habang hindi pa naaayos',
            'Mag-set ng regular na follow-up para sa paulit-ulit na road issues'
        ],
        utilities: [
            'Mas mabilis na coordination sa utility provider kapag may outage',
            'Malinaw na updates sa residents habang ongoing ang repair',
            'Mas maayos na pag-track ng unresolved reports hanggang sa tuluyang maayos'
        ],
        other: [
            'Suriin ang paulit-ulit na ulat para makita ang root cause',
            'Mag-assign ng malinaw na follow-up owner kada concern cluster',
            'Magbigay ng regular na update sa residents tungkol sa status ng aksyon'
        ]
    };
    const pctOfGrand = (n, total) =>
        total > 0 ? Math.round((n / total) * 1000) / 10 : 0;
    const topPctStr =
        grandTotal > 0 ? pctOfGrand(topSitioCount, grandTotal).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) : '0';
    const secondPctStr =
        grandTotal > 0 && secondSitio
            ? pctOfGrand(secondSitioCount, grandTotal).toLocaleString('en-PH', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 1
              })
            : '';
    const secondRankClause =
        secondSitio && secondSitioCount > 0
            ? resolvedOnlyYear
                ? ` Sumunod na may pinakamaraming na-resolve ang <strong>${secondSitioName}</strong> na may <strong>${secondSitioCount.toLocaleString()}</strong> (humigit-kumulang <strong>${secondPctStr}%</strong> ng kabuuan).`
                : ` Sumunod na may pinakamalaking volume ang <strong>${secondSitioName}</strong> na may <strong>${secondSitioCount.toLocaleString()}</strong> na concern (humigit-kumulang <strong>${secondPctStr}%</strong> ng kabuuan).`
            : '';
    const interpretationLead = resolvedOnlyYear
        ? `Ang kabuuang <strong>na-resolve</strong> na concerns sa mga nakikitang sitio para sa <em>${escapeChartText(
              scopeLabel
          )}</em> ay <strong>${grandTotal.toLocaleString()}</strong>. Sa pagtukoy sa sitio, ang may pinakamataas na bilang ng na-resolve ay ang <strong>${topSitioName}</strong> na may <strong>${topSitioCount.toLocaleString()}</strong>; humigit-kumulang <strong>${topPctStr}%</strong> ito ng kabuuang na-resolve sa lahat ng nakikitang sitio.${secondRankClause}`
        : `Ang kabuuang volume ng concerns sa mga nakikitang sitio para sa <em>${escapeChartText(
              scopeLabel
          )}</em> ay <strong>${grandTotal.toLocaleString()}</strong>. Sa pagtukoy sa sitio, ang may pinakamataas na volume ay ang <strong>${topSitioName}</strong> na may <strong>${topSitioCount.toLocaleString()}</strong> na concern; humigit-kumulang <strong>${topPctStr}%</strong> ito ng kabuuang volume sa lahat ng nakikitang sitio.${secondRankClause}`;
    let recommendationIntro =
        'Ipagpatuloy lang ang regular na monitoring at ayusin pa ang pagtanggap ng reports para mas mabilis makita kung saang lugar dumarami ang concern.';
    let recommendationBullets = actionMap.other;
    if (topSitioCount > 0 && dominantTopicLabel && dominantTotalStatements > 0) {
        recommendationIntro = `Base sa tala ng reports na mas madami ang concern sa <strong>${topSitioName}</strong>, lalo na sa tema ng <strong>${escapeChartText(
            dominantTopicLabel
        )}</strong> (<strong>${dominantTopicCount.toLocaleString()}</strong> sa <strong>${dominantTotalStatements.toLocaleString()}</strong> statements sa scope na ito), kailangan ng mas maagap na aksyon sa lugar para maiwasan ang paglala ng sitwasyon.`;
        recommendationBullets = actionMap[dominantTopicKey] || actionMap.other;
    } else if (topSitioCount > 0) {
        recommendationIntro = `Base sa tala ng reports, mas madami ang concerns sa <strong>${topSitioName}</strong> kaya kailangan ng mas maagap na pagbabantay at mabilis na tugon sa lugar.`;
        recommendationBullets = actionMap.other;
    }
    const recommendationListHtml = (recommendationBullets || [])
        .map(item => `<li>${escapeChartText(item)}</li>`)
        .join('');
    const interpretationHtml = `<div class="table-chart-bar-interpretation">
        <p class="table-chart-bar-interpretation__lead">${interpretationLead}</p>
        <p><strong>Rekomendasyon:</strong> ${recommendationIntro}</p>
        <ul class="table-chart-bar-interpretation-categories">${recommendationListHtml}</ul>
    </div>`;
    const legendHtml = resolvedOnlyYear ? concernsBarLegendResolvedOnlyHtml() : concernsBarLegendStackedStatusHtml();
    const vizAria = resolvedOnlyYear
        ? 'Concerns by sitio: resolved only'
        : 'Concerns by sitio: stacked status and revoked column';

    container.innerHTML = `
        <p class="table-chart-heading">Bar graph</p>
        <p class="document-requests-chart-sub">${escapeChartText(subLabel)}</p>
        ${legendHtml}
        <div class="table-chart-viz table-chart-viz--documents table-chart-viz--concerns-sitio-stack" role="group" aria-label="${vizAria}">
            <div class="table-chart-y-label">Count</div>
            <div class="table-chart-y-axis" aria-hidden="true">${tickHtml}</div>
            <div class="table-chart-doc-plot-stack">
                <div class="table-chart-plot-wrap table-chart-plot-wrap--documents">
                    <div class="table-chart-doc-hscroll">
                        <div class="table-chart-doc-hscroll-inner">
                            <div class="table-chart-plot table-chart-plot--documents-bars">
                                <div class="table-chart-grid-bg" style="--grid-lines:5"></div>
                                <div class="table-chart-bar-layer table-chart-bar-layer--documents">${typeBlocks}</div>
                            </div>
                            ${labelsRow}
                        </div>
                    </div>
                    <p class="table-chart-x-title">Sitio</p>
                </div>
                ${interpretationHtml}
            </div>
        </div>`;
    bindConcernsStackedBarSegmentTooltips(container);
    if (!resolvedOnlyYear) {
        bindConcernsYearRevokedColumnTooltips(container);
    }
}

/**
 * Pie — Concerns: ayon sa lahat ng sitio (mula sa API na `bySitio`).
 */
function buildConcernsSitioPieSegments(data) {
    const list = data.bySitio || [];
    const scope = chartViewState.concernsPieSitioScope === 'year' ? 'year' : 'month';
    const metric = scope === 'year' ? chartViewState.concernsPieSitioMetric : 'resolved';
    let segments = list.map((row, i) => ({
        ...(() => {
            const c = row.concerns?.[scope] || {};
            const resolved = Number(c.resolved) || 0;
            const revoked = Number(c.revoked) || 0;
            const unresolved = Math.max(0, (Number(c.new) || 0) + (Number(c.processing) || 0));
            const allConcerns = Math.max(0, Number(c.reported) || resolved + unresolved + revoked);
            const rankValue = scope === 'year' ? resolved + unresolved : allConcerns;
            const value =
                metric === 'all'
                    ? allConcerns
                    : metric === 'revoked'
                    ? revoked
                    : metric === 'unresolved'
                    ? unresolved
                    : resolved;
            return { value, rankValue };
        })(),
        label: row.sitio || `Sitio ${i + 1}`,
        color: DOCUMENT_PIE_COLORS[i % DOCUMENT_PIE_COLORS.length]
    }));
    // Concerns pie (by sitio): always hide zero-value slices.
    segments = segments.filter(s => Number(s.value) > 0);
    const top = chartViewState.concernsPieSitioTop;
    const topN = Number(top);
    if (Number.isInteger(topN) && topN >= 1 && topN <= 5) {
        const ranked = [...segments].sort((a, b) => (Number(b.rankValue) || 0) - (Number(a.rankValue) || 0));
        segments = ranked.slice(0, topN);
    }
    segments = sortPieSegments(segments, 'value-desc');
    segments = segments.map((seg, idx) => ({
        ...seg,
        rankValue: undefined,
        color: seg.label === 'Others' ? '#64748b' : DOCUMENT_PIE_COLORS[idx % DOCUMENT_PIE_COLORS.length]
    }));
    return segments;
}

function hasEmergencyYearByMonthPayload(ym) {
    return (
        ym &&
        typeof ym === 'object' &&
        Array.isArray(ym.reported) &&
        ym.reported.length >= 12 &&
        Array.isArray(ym.resolved) &&
        ym.resolved.length >= 12
    );
}

/** Warm sequential scale (pale yellow -> deep red); text light on dark cells. */
function emergencyReportedYellowRedHeatStyle(value, max) {
    const maxN = Math.max(1, Number(max) || 0);
    const t = value <= 0 ? 0 : Math.min(1, Number(value) / maxN);
    const h = Math.round(52 - t * 52);
    const s = Math.round(92 - t * 8);
    const l = Math.round(96 - t * 52);
    const fg = l < 56 ? '#fff7ed' : '#7c2d12';
    return { background: `hsl(${h} ${s}% ${l}%)`, color: fg };
}

const EMERGENCY_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function defaultEmergencyHeatmapMonthKey(calendarYear) {
    const y = Number(calendarYear) || new Date().getFullYear();
    return `${y}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Heat map: calendar grid (Sun–Sat), reported lang. API: `emergencies.heatmapByMonth` / `currentMonthDaily`.
 * @param {{ selectedMonthKey: string, calendarYear: number } | null} toolbarOpts
 */
function renderEmergencyCurrentMonthDailyHeatmap(containerId, daily, subheading, toolbarOpts) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }
    const counts = daily?.counts || [];
    const y = Math.max(2000, Math.min(2100, Number(daily?.year) || new Date().getFullYear()));
    const mo = Math.max(1, Math.min(12, Number(daily?.month) || new Date().getMonth() + 1));
    const dim = Math.min(31, Math.max(1, Number(daily?.daysInMonth) || counts.length || 28));
    let max = 1;
    for (let i = 0; i < dim; i++) {
        max = Math.max(max, Number(counts[i]) || 0);
    }
    if (max < 1) {
        max = 1;
    }
    const peakDay = daily?.peakDay != null ? Number(daily.peakDay) : null;
    const peakCount = Math.max(0, Number(daily?.peakCount) || 0);
    const peakDateLabel = daily?.peakDateLabel ? String(daily.peakDateLabel).trim() : '';
    const monthLabel = daily?.monthLabel ? String(daily.monthLabel).trim() : '';
    const subHtml = subheading
        ? `<p class="document-requests-chart-sub">${escapeChartText(subheading)}</p>`
        : '';

    const monthTitle =
        new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'long' }) || escapeChartText(monthLabel || '');

    const firstDow = new Date(y, mo - 1, 1).getDay();
    const totalSlots = firstDow + dim;
    const rowCount = Math.ceil(totalSlots / 7);
    const padCells = rowCount * 7 - totalSlots;

    const weekdayRow = EMERGENCY_WEEKDAY_LABELS.map(
        w => `<div class="emergency-heatmap__weekday-head" role="columnheader">${escapeChartText(w)}</div>`
    ).join('');

    const mosaicCells = [];
    for (let i = 0; i < firstDow; i++) {
        mosaicCells.push('<div class="emergency-heatmap__mosaic-cell emergency-heatmap__mosaic-cell--empty" aria-hidden="true"></div>');
    }
    for (let day = 1; day <= dim; day++) {
        const v = Math.max(0, Number(counts[day - 1]) || 0);
        const st = emergencyReportedYellowRedHeatStyle(v, max);
        const isPeak = peakDay != null && peakDay === day && v > 0;
        const peakClass = isPeak ? ' emergency-heatmap__mosaic-cell--peak' : '';
        const aria = `${monthTitle}, araw ${day}: ${v.toLocaleString()} na ulat`;
        const countStr = v.toLocaleString();
        mosaicCells.push(
            `<div class="emergency-heatmap__mosaic-cell emergency-heatmap__mosaic-cell--data${peakClass}" role="gridcell" tabindex="0" style="background:${st.background};color:${st.color}" aria-label="${escapeChartText(aria)}"><span class="emergency-heatmap__mosaic-day-num" aria-hidden="true">${day}</span><div class="emergency-heatmap__mosaic-hover-panel" aria-hidden="true"><span class="emergency-heatmap__mosaic-hover-panel__title">Kabuuang ulat</span><span class="emergency-heatmap__mosaic-hover-panel__count">${countStr}</span></div></div>`
        );
    }
    for (let i = 0; i < padCells; i++) {
        mosaicCells.push('<div class="emergency-heatmap__mosaic-cell emergency-heatmap__mosaic-cell--empty" aria-hidden="true"></div>');
    }

    let peakNote = '';
    if (peakCount > 0 && peakDateLabel) {
        peakNote = `Most <strong>reported</strong> in one day: <strong>${escapeChartText(peakDateLabel)}</strong> (${peakCount.toLocaleString()}). `;
    } else {
        peakNote = 'No reported cases yet this month. ';
    }
    const monthNote = monthLabel ? `Range: <strong>${escapeChartText(monthLabel)}</strong>. ` : '';
    const scaleNote = `Ang numero sa loob ng cell ay ang petsa (araw) ng buwan; ilipad ang cursor sa cell para sa kabuuang bilang ng ulat. Mas matingkad na pula = mas maraming ulat (pinakamataas sa buwang ito: ${max.toLocaleString()}).`;

    const calYear = Number(toolbarOpts?.calendarYear) || y;
    const selKey = toolbarOpts?.selectedMonthKey ? String(toolbarOpts.selectedMonthKey).trim() : '';
    let toolbarHtml = '';
    if (toolbarOpts && DOCUMENT_MONTH_LABELS_EN && DOCUMENT_MONTH_LABELS_EN.length >= 12) {
        const monthOptions = [];
        for (let m = 1; m <= 12; m++) {
            const v = `${calYear}-${String(m).padStart(2, '0')}`;
            const lab = DOCUMENT_MONTH_LABELS_EN[m - 1];
            const sel = v === selKey ? ' selected' : '';
            monthOptions.push(`<option value="${escapeChartText(v)}"${sel}>${escapeChartText(lab)}</option>`);
        }
        toolbarHtml = `<div class="emergency-heatmap__toolbar no-print">
            <label class="emergency-heatmap__toolbar-label">
                <span>Month</span>
                <select id="emergencyHeatmapMonthSelect" class="emergency-heatmap__toolbar-select" aria-label="Heat map — select month">${monthOptions.join(
                    ''
                )}</select>
            </label>
            <span class="emergency-heatmap__toolbar-year" aria-hidden="true">${calYear}</span>
        </div>`;
    }

    container.innerHTML = `
        <p class="table-chart-heading">Heat map</p>
        ${subHtml}
        <div class="emergency-heatmap emergency-heatmap--calendar-mosaic" role="grid" aria-label="${escapeChartText(
            `Reported cases by day${monthLabel ? `, ${monthLabel}` : ''}`
        )}">
            ${toolbarHtml}
            <p class="emergency-heatmap__mosaic-month-title">${escapeChartText(monthTitle)}</p>
            <div class="emergency-heatmap__mosaic-wrap">
                <div class="emergency-heatmap__mosaic-weekdays">${weekdayRow}</div>
                <div class="emergency-heatmap__mosaic-grid">${mosaicCells.join('')}</div>
            </div>
            <div class="emergency-heatmap__intensity-legend" role="img" aria-label="Color intensity from low to high report count">
                <span class="emergency-heatmap__intensity-label">Low</span>
                <span class="emergency-heatmap__intensity-bar" aria-hidden="true"></span>
                <span class="emergency-heatmap__intensity-label">High</span>
            </div>
            <p class="emergency-heatmap__scale-note emergency-heatmap__scale-note--mosaic">${peakNote}${monthNote}${scaleNote}</p>
            <div id="emergencyHeatmapAiSlot" class="emergency-heatmap-ai-slot" aria-live="polite">
                <p class="emergency-heatmap-ai-slot__loading">Kumukuha ng buod…</p>
            </div>
        </div>`;

    const sitioForAi = (chartViewState.emergencySitioFilter || '').trim();
    void loadEmergencyHeatmapGroqInterpretation(y, mo, sitioForAi);
}

function updateEmergencyFilterHint() {
    const el = document.getElementById('emergencyFilterHint');
    if (!el) return;
    const s = (chartViewState.emergencySitioFilter || '').trim();
    if (s) {
        el.innerHTML = `Filtered <strong>sitio</strong>: <strong>${escapeChartText(s)}</strong>. Bar chart and heat map use this sitio only (monthly bar = year totals; heat map = reported per day in the current month).`;
    } else {
        el.innerHTML =
            '<strong>Sitio</strong>: choose one sitio for a breakdown for that area only; leave <em>All sitios</em> for the whole barangay. Bar and heat map can both be on (toggle Bar / Heat map).';
    }
}

function renderConcernsTableChart(data) {
    const barHost = document.getElementById('concernsBarHost');
    const pieHost = document.getElementById('concernsPieHost');
    if (!barHost || !pieHost) return;

    barHost.classList.toggle('doc-chart-host--hidden', !chartViewState.concernsShowBar);
    pieHost.classList.toggle('doc-chart-host--hidden', !chartViewState.concernsShowPie);

    if (!chartViewState.concernsShowBar) {
        barHost.innerHTML = '';
    }
    if (!chartViewState.concernsShowPie) {
        pieHost.innerHTML = '';
    }

    if (!chartViewState.concernsShowBar && !chartViewState.concernsShowPie) {
        return;
    }

    const sitioF = (chartViewState.concernsSitioFilter || '').trim();
    let monthData;
    let yearData;
    let barSub = null;

    if (sitioF) {
        const block = findBySitioBlock(data, sitioF);
        if (!block) {
            const emptyBar =
                '<p class="table-chart-heading">Bar graph</p><p class="sitio-chart-empty">No data for this sitio.</p>';
            const emptyPie =
                '<p class="table-chart-heading">Pie graph</p><p class="sitio-chart-empty">No data for this sitio.</p>';
            if (chartViewState.concernsShowBar) {
                barHost.innerHTML = emptyBar;
            }
            if (chartViewState.concernsShowPie) {
                pieHost.innerHTML = emptyPie;
            }
            return;
        }
        monthData = block.concerns?.month || { reported: 0, resolved: 0 };
        yearData = block.concerns?.year || { reported: 0, resolved: 0 };
        barSub = `${sitioF} — na-ulat / na-resolve`;
    } else {
        monthData = data.concerns?.month || { reported: 0, resolved: 0 };
        yearData = data.concerns?.year || { reported: 0, resolved: 0 };
    }

    const bars = [
        { label: 'Ngayong buwan · Na-ulat', value: monthData.reported || 0, color: '#3b82f6' },
        { label: 'Ngayong buwan · Na-resolve', value: monthData.resolved || 0, color: '#22c55e' },
        { label: 'Ngayong taon · Na-ulat', value: yearData.reported || 0, color: '#6366f1' },
        { label: 'Ngayong taon · Na-resolve', value: yearData.resolved || 0, color: '#14b8a6' }
    ];

    if (chartViewState.concernsShowBar) {
        const barScopeYear = chartViewState.concernsPieSitioScope === 'year';
        if (barScopeYear && hasConcernsYearByMonthPayload(data.concerns?.yearByMonth)) {
            renderConcernsYearGroupedBarChart('concernsBarHost', {
                yearByMonth: data.concerns.yearByMonth,
                yearLabel: data.concerns?.yearLabel || '',
                subheading:
                    'Enero–Disyembre — stacked na bago/pinoproseso/na-resolve at revoked kada buwan ng kalendaryo (ngayong taon, buong barangay)'
            });
        } else {
            renderConcernsSitioStackedBarLayout('concernsBarHost', data, barSub, sitioF || null);
        }
    }

    if (chartViewState.concernsShowPie) {
        const useBySitio = chartViewState.concernsPieLayout === 'bySitio' && !sitioF;
        if (useBySitio) {
            const segments = buildConcernsSitioPieSegments(data);
            renderTablePieChart('concernsPieHost', 'Pie graph', segments, {
                skipSort: true,
                emptyMessage: 'Walang datos ng concerns ayon sa sitio (o lahat ay zero).',
                subheading: 'Ayon sa sitio — pinakamalaking slice = pinakamaraming na-ulat na concerns',
                legendCountFirst: true,
                pieLayoutExtraClass: 'table-chart-pie-layout--documents',
                pieInterpretationBuilder: (segs, tot) =>
                    buildConcernsPieInterpretationHtml(segs, tot, 'bySitio', {})
            });
        } else {
            const segments = bars
                .map(b => ({ label: b.label, value: b.value, color: b.color }))
                .filter(s => Number(s.value) > 0);
            const pieSub = sitioF
                ? `${sitioF} — panahon (buwan / taon)`
                : 'Buong barangay — panahon (buwan / taon)';
            renderTablePieChart('concernsPieHost', 'Pie graph', segments, {
                subheading: pieSub,
                legendCountFirst: true,
                pieLayoutExtraClass: 'table-chart-pie-layout--documents',
                pieInterpretationBuilder: (segs, tot) =>
                    buildConcernsPieInterpretationHtml(segs, tot, 'period', { sitioFilter: sitioF || '' })
            });
        }
    }
}

function renderEmergencyTableChart(data) {
    const barHost = document.getElementById('emergencyBarHost');
    const heatmapHost = document.getElementById('emergencyHeatmapHost');
    if (!barHost || !heatmapHost) return;

    barHost.classList.toggle('doc-chart-host--hidden', !chartViewState.emergencyShowBar);
    heatmapHost.classList.toggle('doc-chart-host--hidden', !chartViewState.emergencyShowHeatmap);

    if (!chartViewState.emergencyShowBar) {
        barHost.innerHTML = '';
    }
    if (!chartViewState.emergencyShowHeatmap) {
        heatmapHost.innerHTML = '';
    }

    if (!chartViewState.emergencyShowBar && !chartViewState.emergencyShowHeatmap) {
        updateEmergencyFilterHint();
        return;
    }

    const sitioF = (chartViewState.emergencySitioFilter || '').trim();
    let monthData;
    let yearData;
    let barSub = null;
    let yearByMonthPayload = null;
    let currentMonthDailyPayload = null;
    let sitioBlock = null;

    if (sitioF) {
        sitioBlock = findBySitioBlock(data, sitioF);
        if (!sitioBlock) {
            const emptyBar =
                '<p class="table-chart-heading">Bar graph</p><p class="sitio-chart-empty">No data for this sitio.</p>';
            const emptyHeat =
                '<p class="table-chart-heading">Heat map</p><p class="sitio-chart-empty">No data for this sitio.</p>';
            if (chartViewState.emergencyShowBar) {
                barHost.innerHTML = emptyBar;
            }
            if (chartViewState.emergencyShowHeatmap) {
                heatmapHost.innerHTML = emptyHeat;
            }
            updateEmergencyFilterHint();
            return;
        }
        monthData = sitioBlock.emergencies?.month || { reported: 0, resolved: 0 };
        yearData = sitioBlock.emergencies?.year || { reported: 0, resolved: 0 };
        barSub = `${sitioF} — reported / resolved`;
        yearByMonthPayload = sitioBlock.emergencies?.yearByMonth || null;
        currentMonthDailyPayload = sitioBlock.emergencies?.currentMonthDaily || null;
    } else {
        monthData = data.emergencies?.month || { reported: 0, resolved: 0 };
        yearData = data.emergencies?.year || { reported: 0, resolved: 0 };
        yearByMonthPayload = data.emergencies?.yearByMonth || null;
        currentMonthDailyPayload = data.emergencies?.currentMonthDaily || null;
    }

    const heatmapCalendarYear = Number(data.emergencies?.heatmapCalendarYear) || new Date().getFullYear();
    const heatmapByMonth = sitioF ? sitioBlock?.emergencies?.heatmapByMonth : data.emergencies?.heatmapByMonth;

    const bars = [
        { label: 'This month · Reported', value: monthData.reported || 0, color: '#3b82f6' },
        { label: 'This month · Resolved', value: monthData.resolved || 0, color: '#22c55e' },
        { label: 'This year · Reported', value: yearData.reported || 0, color: '#6366f1' },
        { label: 'This year · Resolved', value: yearData.resolved || 0, color: '#14b8a6' }
    ];

    const yLabel = data.emergencies?.yearLabel || '';
    const emergencyBarFooterHtml = buildEmergencyBarAiInterpretationHtml(
        String(data?.emergencies?.aiInterpretation ?? '').trim()
    );
    if (chartViewState.emergencyShowBar) {
        if (hasEmergencyYearByMonthPayload(yearByMonthPayload)) {
            const monthlySub = sitioF
                ? `${sitioF} — total reported per calendar month (${yLabel})`
                : `All sitios combined — total reported per calendar month (${yLabel})`;
            renderEmergencyMonthlyReportedBarChart(
                'emergencyBarHost',
                yearByMonthPayload,
                monthlySub,
                emergencyBarFooterHtml
            );
        } else {
            renderTableBarChartRows(
                'emergencyBarHost',
                'Bar graph',
                bars,
                'Count',
                barSub,
                'This month & this year (reported / resolved)',
                '',
                emergencyBarFooterHtml
            );
        }
    }

    if (chartViewState.emergencyShowHeatmap) {
        let sel = (chartViewState.emergencyHeatmapMonthKey || '').trim();
        if (!sel || (heatmapByMonth && typeof heatmapByMonth === 'object' && !heatmapByMonth[sel])) {
            sel = defaultEmergencyHeatmapMonthKey(heatmapCalendarYear);
            if (heatmapByMonth && typeof heatmapByMonth === 'object' && !heatmapByMonth[sel]) {
                const keys = Object.keys(heatmapByMonth).sort();
                if (keys.length) {
                    [sel] = keys;
                }
            }
        }
        chartViewState.emergencyHeatmapMonthKey = sel;

        const dailyPayload =
            heatmapByMonth && typeof heatmapByMonth === 'object' && heatmapByMonth[sel]
                ? heatmapByMonth[sel]
                : currentMonthDailyPayload;

        const hmSub = sitioF
            ? `${sitioF} — reported by calendar day`
            : `All sitios — reported by calendar day`;
        if (dailyPayload && Array.isArray(dailyPayload.counts) && dailyPayload.counts.length > 0) {
            const hasHeatmapByMonth = heatmapByMonth && typeof heatmapByMonth === 'object';
            renderEmergencyCurrentMonthDailyHeatmap(
                'emergencyHeatmapHost',
                dailyPayload,
                hmSub,
                hasHeatmapByMonth ? { selectedMonthKey: sel, calendarYear: heatmapCalendarYear } : null
            );
        } else {
            heatmapHost.innerHTML =
                '<p class="table-chart-heading">Heat map</p><p class="sitio-chart-empty">No daily data for this month.</p>';
        }
    }
    updateEmergencyFilterHint();
}

function renderDocumentRequestsPieChartAllTypes(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }
    const segmentsRaw = buildDocumentPieSegmentsAllTypesFromBySitio(data);
    if (segmentsRaw == null) {
        container.innerHTML = '';
        return;
    }
    const grandTotal = getDocumentGrandTotalFromBySitio(data);
    const segments = alignPieSegmentsToGrandTotal(segmentsRaw, grandTotal);
    renderTablePieChart(containerId, 'Pie graph', segments, {
        skipSort: true,
        emptyMessage: 'Walang slice pagkatapos mag-filter.',
        subheading: DOCUMENT_REQUESTS_PIE_CHART_SUB_LABEL,
        legendCountFirst: true,
        pieLayoutExtraClass: 'table-chart-pie-layout--documents',
        pieInterpretationBuilder: (segs, tot) =>
            buildDocumentPieInterpretationHtml(segs, tot, 'allTypesBarangay', { analyticsData: data })
    });
}

/**
 * Document bar group: month bar lang kung monthly ang documentsPieMetric; year bar lang kung yearly.
 * @param {string} docTypeLabel Uri ng dokumento o 'Total' — para sa fixed gradient bawat uri.
 */
function documentRequestsBarPairHtml(monthCount, yearCount, barPct, docTypeLabel = 'Total') {
    const mv = Number(monthCount) || 0;
    const yv = Number(yearCount) || 0;
    const showYear = chartViewState.documentsPieMetric === 'year';
    const bg = getDocumentTypeGradient(docTypeLabel);
    const barStyle = `--bar-pct:${showYear ? barPct(yv) : barPct(mv)};background:${bg}`;
    if (showYear) {
        return `
            <div class="table-chart-doc-pair-inner">
                <div class="table-chart-bar-slot table-chart-bar-slot--pair">
                    <div class="table-chart-bar-doc-stack">
                        <span class="table-chart-bar-value table-chart-bar-value--doc-above">${yv.toLocaleString()}</span>
                        <div class="table-chart-bar-fill table-chart-bar-fill--doc-type" style="${barStyle}" aria-label="This year: ${yv}"></div>
                    </div>
                </div>
            </div>`;
    }
    return `
            <div class="table-chart-doc-pair-inner">
                <div class="table-chart-bar-slot table-chart-bar-slot--pair">
                    <div class="table-chart-bar-doc-stack">
                        <span class="table-chart-bar-value table-chart-bar-value--doc-above">${mv.toLocaleString()}</span>
                        <div class="table-chart-bar-fill table-chart-bar-fill--doc-type" style="${barStyle}" aria-label="This month: ${mv}"></div>
                    </div>
                </div>
            </div>`;
}

function documentRequestsBarLegendHtml() {
    const showYear = chartViewState.documentsPieMetric === 'year';
    if (showYear) {
        return `<div class="table-chart-legend">
            <span><i class="table-chart-legend-swatch year" aria-hidden="true"></i> This year</span>
        </div>`;
    }
    return `<div class="table-chart-legend">
            <span><i class="table-chart-legend-swatch month" aria-hidden="true"></i> This month</span>
        </div>`;
}

/** Category labels sa ilalim ng X-axis (labas ng plot), pantay sa bawat column. */
function documentRequestsBarLabelsRowHtml(labels) {
    const cells = labels
        .map(l => `<span class="table-chart-doc-name">${escapeChartText(l)}</span>`)
        .join('');
    return `<div class="table-chart-doc-x-labels" aria-hidden="true">${cells}</div>`;
}

function findBySitioBlock(data, sitioName) {
    return (data.bySitio || []).find(b => (b.sitio || '') === sitioName) || null;
}

/** Lahat ng uri ng dokumento para sa isang sitio (mula sa `bySitio`). */
function renderDocumentRequestsBarAllTypesForSitio(data, sitioName, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const block = findBySitioBlock(data, sitioName);
    if (!block) {
        container.innerHTML =
            '<p class="table-chart-heading">Bar graph</p><p class="sitio-chart-empty">No data for this sitio.</p>';
        return;
    }
    const monthData = block.documents?.month || {};
    const yearData = block.documents?.year || {};
    const docTypes = Object.keys(monthData).filter(key => key.toLowerCase() !== 'total');
    if (docTypes.length === 0) {
        container.innerHTML =
            '<p class="table-chart-heading">Bar graph</p><p class="sitio-chart-empty">No document types for this sitio.</p>';
        return;
    }

    const showYear = chartViewState.documentsPieMetric === 'year';
    if (showYear && hasValidYearByMonth(block.documents?.yearByMonth, docTypes)) {
        renderDocumentYearGroupedBarChart(containerId, {
            docTypes,
            yearByMonth: block.documents.yearByMonth,
            headingSub: `${sitioName} — all types`,
            yearLabel: data.documents?.yearLabel || ''
        });
        return;
    }

    const allValues = [];
    docTypes.forEach(t => {
        allValues.push(showYear ? Number(yearData[t]) || 0 : Number(monthData[t]) || 0);
    });
    allValues.push(showYear ? Number(yearData.total) || 0 : Number(monthData.total) || 0);
    const dataMax = Math.max(...allValues, 0);
    const daysInMonth = getDaysInMonthFromAnalyticsData(data);
    const topDay = getDocumentChartDayAxisTopDay(daysInMonth);
    const axisMax = niceAxisMax(Math.max(dataMax, daysInMonth));
    const tickHtml = buildDocumentYAxisTicksForMetric(topDay);
    const barPct = v => (axisMax > 0 ? Math.min(100, ((Number(v) || 0) / axisMax) * 100) : 0);
    const yAxisLabel = getDocumentBarYAxisLabel();
    const yAxisClass = getDocumentBarYAxisClassName();
    const gridLines = getDocumentBarYAxisGridLines();

    const typeBlocks = docTypes.map(type => `
        <div class="table-chart-doc-group table-chart-doc-group--bars">
            ${documentRequestsBarPairHtml(monthData[type], yearData[type], barPct, type)}
        </div>`).join('');

    const totalBlock = `
        <div class="table-chart-doc-group table-chart-doc-group--bars">
            ${documentRequestsBarPairHtml(monthData.total, yearData.total, barPct, 'Total')}
        </div>`;

    const labelsRow = documentRequestsBarLabelsRowHtml([...docTypes, 'Total']);

    const barInterpretationHtml = buildDocumentBarInterpretationHtml('allTypesOneSitio', {
        docTypes,
        monthData,
        yearData,
        sitioName,
        analyticsData: data
    });

    container.innerHTML = `
        <p class="table-chart-heading">Bar graph</p>
        <p class="document-requests-chart-sub">${escapeChartText(getDocumentRequestsChartSubLabel())}</p>
        ${documentRequestsBarLegendHtml()}
        <div class="table-chart-viz table-chart-viz--documents${getDocumentBarVizExtraClass()}" role="group" aria-label="Document requests by type for sitio">
            <div class="table-chart-y-label">${escapeChartText(yAxisLabel)}</div>
            <div class="${yAxisClass}" aria-hidden="true">${tickHtml}</div>
            <div class="table-chart-doc-plot-stack">
                <div class="table-chart-plot-wrap table-chart-plot-wrap--documents">
                    <div class="table-chart-doc-hscroll">
                        <div class="table-chart-doc-hscroll-inner">
                            <div class="table-chart-plot table-chart-plot--documents-bars">
                                <div class="table-chart-grid-bg" style="--grid-lines:${gridLines}"></div>
                                <div class="table-chart-bar-layer table-chart-bar-layer--documents" ${getDocumentBarLayerDataAttrs()}>${typeBlocks}${totalBlock}</div>
                            </div>
                            ${labelsRow}
                        </div>
                    </div>
                    <p class="table-chart-x-title">Document type</p>
                </div>
                ${barInterpretationHtml}
            </div>
        </div>`;
}

function renderDocumentRequestsPieAllTypesForSitio(data, sitioName, containerId) {
    const block = findBySitioBlock(data, sitioName);
    if (!block) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML =
                '<p class="table-chart-heading">Pie graph</p><p class="sitio-chart-empty">No data for this sitio.</p>';
        }
        return;
    }
    const segmentsRaw = buildDocumentPieSegmentsAllTypesSync(block.documents);
    if (segmentsRaw == null) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '';
        }
        return;
    }
    const grandTotal = getDocumentPayloadGrandTotal(block.documents);
    const segments = alignPieSegmentsToGrandTotal(segmentsRaw, grandTotal);
    renderTablePieChart(containerId, 'Pie graph', segments, {
        skipSort: true,
        emptyMessage: 'Walang slice pagkatapos mag-filter.',
        subheading: DOCUMENT_REQUESTS_PIE_CHART_SUB_LABEL,
        legendCountFirst: true,
        pieLayoutExtraClass: 'table-chart-pie-layout--documents',
        pieInterpretationBuilder: (segs, tot) =>
            buildDocumentPieInterpretationHtml(segs, tot, 'allTypesSitio', { analyticsData: data, sitioName })
    });
}

/**
 * Bar: bawat sitio — month/year para sa napiling uri ng dokumento.
 * @param {string|null} singleSitioFilter Kung non-null, isang sitio lang.
 */
function renderDocumentRequestsSitioBarForType(data, docLabel, containerId, singleSitioFilter = null) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let list = data.bySitio || [];
    if (singleSitioFilter) {
        list = list.filter(b => (b.sitio || '') === singleSitioFilter);
    }
    if (list.length === 0) {
        container.innerHTML =
            '<p class="table-chart-heading">Bar graph</p><p class="sitio-chart-empty">No data by sitio.</p>';
        return;
    }

    const showYear = chartViewState.documentsPieMetric === 'year';
    const allValues = [];
    list.forEach(block => {
        const m = Number(block.documents?.month?.[docLabel]) || 0;
        const y = Number(block.documents?.year?.[docLabel]) || 0;
        allValues.push(showYear ? y : m);
    });
    const dataMax = Math.max(...allValues, 0);
    const daysInMonth = getDaysInMonthFromAnalyticsData(data);
    const topDay = getDocumentChartDayAxisTopDay(daysInMonth);
    const axisMax = niceAxisMax(Math.max(dataMax, daysInMonth));
    const tickHtml = buildDocumentYAxisTicksForMetric(topDay);
    const barPct = v => (axisMax > 0 ? Math.min(100, ((Number(v) || 0) / axisMax) * 100) : 0);
    const yAxisLabel = getDocumentBarYAxisLabel();
    const yAxisClass = getDocumentBarYAxisClassName();
    const gridLines = getDocumentBarYAxisGridLines();

    const typeBlocks = list.map(block => {
        const mv = Number(block.documents?.month?.[docLabel]) || 0;
        const yv = Number(block.documents?.year?.[docLabel]) || 0;
        return `
        <div class="table-chart-doc-group table-chart-doc-group--bars">
            ${documentRequestsBarPairHtml(mv, yv, barPct, docLabel)}
        </div>`;
    }).join('');

    const labelsRow = documentRequestsBarLabelsRowHtml(list.map(block => block.sitio || '—'));

    const barInterpretationHtml = buildDocumentBarInterpretationHtml('oneTypeBySitio', {
        list,
        docLabel,
        filteredToSingleSitio: !!(singleSitioFilter && String(singleSitioFilter).trim())
    });

    container.innerHTML = `
        <p class="table-chart-heading">Bar graph</p>
        <p class="document-requests-chart-sub">${escapeChartText(getDocumentRequestsChartSubLabel())}</p>
        ${documentRequestsBarLegendHtml()}
        <div class="table-chart-viz table-chart-viz--documents table-chart-viz--documents-sitio${getDocumentBarVizExtraClass()}" role="group" aria-label="Document requests by sitio">
            <div class="table-chart-y-label">${escapeChartText(yAxisLabel)}</div>
            <div class="${yAxisClass}" aria-hidden="true">${tickHtml}</div>
            <div class="table-chart-doc-plot-stack">
                <div class="table-chart-plot-wrap table-chart-plot-wrap--documents">
                    <div class="table-chart-doc-hscroll">
                        <div class="table-chart-doc-hscroll-inner">
                            <div class="table-chart-plot table-chart-plot--documents-bars">
                                <div class="table-chart-grid-bg" style="--grid-lines:${gridLines}"></div>
                                <div class="table-chart-bar-layer table-chart-bar-layer--documents" ${getDocumentBarLayerDataAttrs()}>${typeBlocks}</div>
                            </div>
                            ${labelsRow}
                        </div>
                    </div>
                    <p class="table-chart-x-title">Sitio</p>
                </div>
                ${barInterpretationHtml}
            </div>
        </div>`;
}

function documentTypeFilterDisplayName(docLabel) {
    if (!docLabel) return '';
    if (docLabel === 'Barangay ID') return 'Barangay ID';
    if (docLabel === 'Certification') return 'Certification';
    return docLabel;
}

/**
 * Pie ay sitio: pagkatapos ayusin, i-reassign ang kulay para ang #1 (kadalasang pinakamarami) ay naka-una sa palette.
 * @param {string|null} singleSitioFilter Kung non-null, isang sitio lang.
 */
function renderDocumentRequestsSitioPieForType(data, docLabel, containerId, singleSitioFilter = null) {
    let list = data.bySitio || [];
    if (singleSitioFilter) {
        list = list.filter(b => (b.sitio || '') === singleSitioFilter);
    }
    if (list.length === 0) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML =
                '<p class="table-chart-heading">Pie graph</p><p class="sitio-chart-empty">No data by sitio.</p>';
        }
        return;
    }
    const metric = chartViewState.documentsPieMetric === 'year' ? 'year' : 'month';
    const palette = DOCUMENT_PIE_COLORS;
    let segments = list.map((row, i) => ({
        label: row.sitio || `Sitio ${i + 1}`,
        value: Number(row.documents?.[metric]?.[docLabel]) || 0,
        color: palette[i % palette.length]
    }));
    if (chartViewState.documentsPieHideZero) {
        segments = segments.filter(s => s.value > 0);
    }
    segments = segments.map((seg, idx) => ({
        ...seg,
        color: palette[idx % palette.length]
    }));
    renderTablePieChart(containerId, 'Pie graph', segments, {
        skipSort: true,
        emptyMessage: 'Walang slice pagkatapos mag-filter.',
        subheading: DOCUMENT_REQUESTS_PIE_CHART_SUB_LABEL,
        legendCountFirst: true,
        pieLayoutExtraClass: 'table-chart-pie-layout--documents',
        pieInterpretationBuilder: (segs, tot) =>
            buildDocumentPieInterpretationHtml(segs, tot, 'bySitioForDoc', {
                analyticsData: data,
                docLabel,
                filteredToSingleSitio: !!(singleSitioFilter && String(singleSitioFilter).trim())
            })
    });
}

function renderDocumentRequestsBarAllTypes(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const monthData = data.documents?.month || {};
    const yearData = data.documents?.year || {};
    const docTypes = Object.keys(monthData).filter(key => key.toLowerCase() !== 'total');

    if (docTypes.length === 0) {
        container.innerHTML = '';
        return;
    }

    const showYear = chartViewState.documentsPieMetric === 'year';
    if (showYear && hasValidYearByMonth(data.documents?.yearByMonth, docTypes)) {
        renderDocumentYearGroupedBarChart(containerId, {
            docTypes,
            yearByMonth: data.documents.yearByMonth,
            headingSub: 'All types — total',
            yearLabel: data.documents?.yearLabel || ''
        });
        return;
    }

    const allValues = [];
    docTypes.forEach(t => {
        allValues.push(showYear ? Number(yearData[t]) || 0 : Number(monthData[t]) || 0);
    });
    allValues.push(showYear ? Number(yearData.total) || 0 : Number(monthData.total) || 0);
    const dataMax = Math.max(...allValues, 0);
    const daysInMonth = getDaysInMonthFromAnalyticsData(data);
    const topDay = getDocumentChartDayAxisTopDay(daysInMonth);
    const axisMax = niceAxisMax(Math.max(dataMax, daysInMonth));
    const tickHtml = buildDocumentYAxisTicksForMetric(topDay);

    const barPct = v => (axisMax > 0 ? Math.min(100, ((Number(v) || 0) / axisMax) * 100) : 0);
    const yAxisLabel = getDocumentBarYAxisLabel();
    const yAxisClass = getDocumentBarYAxisClassName();
    const gridLines = getDocumentBarYAxisGridLines();

    const typeBlocks = docTypes.map(type => `
        <div class="table-chart-doc-group table-chart-doc-group--bars">
            ${documentRequestsBarPairHtml(monthData[type], yearData[type], barPct, type)}
        </div>`).join('');

    const totalBlock = `
        <div class="table-chart-doc-group table-chart-doc-group--bars">
            ${documentRequestsBarPairHtml(monthData.total, yearData.total, barPct, 'Total')}
        </div>`;

    const labelsRow = documentRequestsBarLabelsRowHtml([...docTypes, 'Total']);

    const barInterpretationHtml = buildDocumentBarInterpretationHtml('allTypesBarangay', {
        docTypes,
        monthData,
        yearData,
        analyticsData: data
    });

    container.innerHTML = `
        <p class="table-chart-heading">Bar graph</p>
        <p class="document-requests-chart-sub">${escapeChartText(getDocumentRequestsChartSubLabel())}</p>
        ${documentRequestsBarLegendHtml()}
        <div class="table-chart-viz table-chart-viz--documents${getDocumentBarVizExtraClass()}" role="group" aria-label="Document requests by type">
            <div class="table-chart-y-label">${escapeChartText(yAxisLabel)}</div>
            <div class="${yAxisClass}" aria-hidden="true">${tickHtml}</div>
            <div class="table-chart-doc-plot-stack">
                <div class="table-chart-plot-wrap table-chart-plot-wrap--documents">
                    <div class="table-chart-doc-hscroll">
                        <div class="table-chart-doc-hscroll-inner">
                            <div class="table-chart-plot table-chart-plot--documents-bars">
                                <div class="table-chart-grid-bg" style="--grid-lines:${gridLines}"></div>
                                <div class="table-chart-bar-layer table-chart-bar-layer--documents" ${getDocumentBarLayerDataAttrs()}>${typeBlocks}${totalBlock}</div>
                            </div>
                            ${labelsRow}
                        </div>
                    </div>
                    <p class="table-chart-x-title">Document type</p>
                </div>
                ${barInterpretationHtml}
            </div>
        </div>`;
}

function renderDocumentRequestsTableChart(data) {
    const barHost = document.getElementById('documentRequestsBarHost');
    const pieHost = document.getElementById('documentRequestsPieHost');
    if (!barHost || !pieHost) return;

    barHost.classList.toggle('doc-chart-host--hidden', !chartViewState.documentsShowBar);
    pieHost.classList.toggle('doc-chart-host--hidden', !chartViewState.documentsShowPie);

    if (!chartViewState.documentsShowBar) {
        barHost.innerHTML = '';
    }
    if (!chartViewState.documentsShowPie) {
        pieHost.innerHTML = '';
    }

    if (!chartViewState.documentsShowBar && !chartViewState.documentsShowPie) {
        return;
    }

    const docFilter = (chartViewState.documentsDocFilter || '').trim();
    const sitioFilter = (chartViewState.documentsSitioFilter || '').trim();

    if (!docFilter && !sitioFilter) {
        if (chartViewState.documentsShowBar) {
            renderDocumentRequestsBarAllTypes(data, 'documentRequestsBarHost');
        }
        if (chartViewState.documentsShowPie) {
            renderDocumentRequestsPieChartAllTypes(data, 'documentRequestsPieHost');
        }
        return;
    }

    if (!docFilter && sitioFilter) {
        if (chartViewState.documentsShowBar) {
            renderDocumentRequestsBarAllTypesForSitio(data, sitioFilter, 'documentRequestsBarHost');
        }
        // Pie: laging buong barangay (pinagsama ang lahat ng sitio) — hindi sumusunod sa sitio filter ng bar
        if (chartViewState.documentsShowPie) {
            renderDocumentRequestsPieChartAllTypes(data, 'documentRequestsPieHost');
        }
        return;
    }

    if (docFilter && !sitioFilter) {
        if (chartViewState.documentsShowBar) {
            renderDocumentRequestsSitioBarForType(data, docFilter, 'documentRequestsBarHost');
        }
        if (chartViewState.documentsShowPie) {
            renderDocumentRequestsSitioPieForType(data, docFilter, 'documentRequestsPieHost');
        }
        return;
    }

    if (chartViewState.documentsShowBar) {
        renderDocumentRequestsSitioBarForType(data, docFilter, 'documentRequestsBarHost', sitioFilter);
    }
    // Pie: hatian ayon sa sitio sa buong barangay para sa uri na ito — hindi tinatali sa napiling sitio ng bar
    if (chartViewState.documentsShowPie) {
        renderDocumentRequestsSitioPieForType(data, docFilter, 'documentRequestsPieHost', null);
    }
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
    const subtitleEl = document.getElementById('documentRequestsSubtitle');
    const currentLabel = data.documents?.monthLabel || (period === 'year' ? 'Current Year' : 'Current Month');
    const monthData = data.documents?.month || {};
    const yearData = data.documents?.year || {};
    const monthTotal = monthData.total || 0;
    const yearTotal = yearData.total || 0;

    if (subtitleEl) {
        subtitleEl.textContent = `${currentLabel} · This month ${monthTotal} · This year ${yearTotal}`;
    }
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

/** Isang beses: click / Enter sa demographic tiles → ipakita ang katumbas na by-sitio section. */
const CENSUS_DEMO_TILE_REVEAL_PAIRS = [
    { selector: '.analytics-census-demo-tile--senior', sectionId: 'censusAnalyticsSeniorSection' },
    { selector: '.analytics-census-demo-tile--widowed', sectionId: 'censusAnalyticsWidowedSection' },
    { selector: '.analytics-census-demo-tile--employed', sectionId: 'censusAnalyticsEmployedSection' },
    { selector: '.analytics-census-demo-tile--unemployed', sectionId: 'censusAnalyticsUnemployedSection' },
    { selector: '.analytics-census-demo-tile--students', sectionId: 'censusAnalyticsStudentsSection' },
    { selector: '.analytics-census-demo-tile--pwd', sectionId: 'censusAnalyticsPwdSection' },
    { selector: '.analytics-census-demo-tile--ip', sectionId: 'censusAnalyticsIndigenousSection' },
];

function ensureCensusDemographicTileReveals() {
    const demo = document.getElementById('censusAnalyticsDemographics');
    if (!demo || demo.dataset.demoRevealBound === '1') {
        return;
    }
    demo.dataset.demoRevealBound = '1';
    const activate = (tile, sectionId) => {
        const sec = document.getElementById(sectionId);
        if (!sec) {
            return;
        }
        for (const { sectionId: sid, selector } of CENSUS_DEMO_TILE_REVEAL_PAIRS) {
            const el = document.getElementById(sid);
            if (el) {
                el.hidden = sid !== sectionId;
            }
            const t = demo.querySelector(selector);
            if (t) {
                t.setAttribute('aria-expanded', sid === sectionId ? 'true' : 'false');
            }
        }
        requestAnimationFrame(() => {
            sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    };
    demo.addEventListener('click', (e) => {
        for (const { selector, sectionId } of CENSUS_DEMO_TILE_REVEAL_PAIRS) {
            const tile = e.target.closest(selector);
            if (tile) {
                activate(tile, sectionId);
                return;
            }
        }
    });
    demo.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') {
            return;
        }
        for (const { selector, sectionId } of CENSUS_DEMO_TILE_REVEAL_PAIRS) {
            const tile = e.target.closest(selector);
            if (tile) {
                e.preventDefault();
                activate(tile, sectionId);
                return;
            }
        }
    });
}

/** By-sitio demographic breakdown: ipakita lamang ang mga sitio na may count na mas mataas sa zero. */
function filterCensusDemographicBySitioNonZero(rows) {
    return (rows || []).filter((r) => Number(r.residents ?? r.count ?? 0) > 0);
}

/**
 * Ilabas ang tamang teksto kung ang API o modelo ay nagbalik ng JSON string sa loob ng interpretation.
 * @param {{ interpretation?: unknown, recommendations?: unknown }} out
 * @returns {{ interpretation: string, recommendations: string }}
 */
function normalizeCensusAiInterpretationOut(out) {
    let interp = String(out?.interpretation ?? '').trim();
    let rec = String(out?.recommendations ?? '').trim();
    if (interp.startsWith('{') && /"interpretation"\s*:/.test(interp)) {
        try {
            const parsed = JSON.parse(interp);
            if (parsed && typeof parsed === 'object' && typeof parsed.interpretation === 'string') {
                interp = parsed.interpretation.trim();
                if ((!rec || rec === '') && typeof parsed.recommendations === 'string') {
                    rec = parsed.recommendations.trim();
                }
            }
        } catch (e) {
            /* hindi JSON — gamitin ang orihinal */
        }
    }
    if (interp.includes('\\n') && !/\n/.test(interp)) {
        interp = interp.replace(/\\n/g, '\n');
    }
    if (rec.includes('\\n') && !/\n/.test(rec)) {
        rec = rec.replace(/\\n/g, '\n');
    }
    rec = rec.replace(/\s+/g, ' ').trim();
    return { interpretation: interp, recommendations: rec };
}

/**
 * Ipakita ang rekomendasyon sa ilalim ng interpretation; itago kung walang laman.
 * @param {HTMLElement | null} recWrap
 * @param {HTMLElement | null} recSlot
 * @param {unknown} rawText
 * @param {string} textClassName
 */
function applyCensusInterpretationRecommendations(recWrap, recSlot, rawText, textClassName) {
    if (!recWrap || !recSlot) {
        return;
    }
    let t = String(rawText ?? '').trim();
    if (t.includes('\\n') && !/\n/.test(t)) {
        t = t.replace(/\\n/g, '\n');
    }
    t = t.replace(/\s+/g, ' ').trim();
    if (!t) {
        recSlot.innerHTML = '';
        recWrap.hidden = true;
        return;
    }
    const parts = t.split(/(?<=[.!?])\s+/).filter((p) => p.length > 0);
    if (parts.length <= 1) {
        recSlot.innerHTML = `<p class="${textClassName}">${escapeChartText(t)}</p>`;
    } else {
        recSlot.innerHTML = parts
            .map((p) => `<p class="${textClassName}">${escapeChartText(p.trim())}</p>`)
            .join('');
    }
    recWrap.hidden = false;
}

/**
 * Groq: paliwanag ng bilang ng seniors bawat sitio + kabuuan (GROQ_API_KEY_CENSUS_SENIOR_CITIZENS).
 * @param {Array<{sitio?: string, residents?: number, count?: number}>} seniorRows
 */
async function loadCensusSeniorSitioInterpretation(seniorRows, totalSeniors, censusEmpty) {
    const wrap = document.getElementById('censusAnalyticsSeniorInterpretationWrap');
    const slot = document.getElementById('censusAnalyticsSeniorInterpretationSlot');
    const recWrap = document.getElementById('censusAnalyticsSeniorRecommendationsWrap');
    const recSlot = document.getElementById('censusAnalyticsSeniorRecommendationsSlot');
    if (!wrap || !slot) {
        return;
    }
    if (censusSeniorAiAbort) {
        censusSeniorAiAbort.abort();
    }
    if (censusEmpty || !seniorRows || seniorRows.length === 0 || !(Number(totalSeniors) > 0)) {
        wrap.hidden = true;
        slot.innerHTML = '';
        applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
        return;
    }
    wrap.hidden = false;
    applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
    slot.innerHTML =
        '<p class="analytics-census-senior-interpretation__loading">Kumukuha ng paliwanag…</p>';
    censusSeniorAiAbort = new AbortController();
    const payload = {
        seniorBySitio: seniorRows.map((r) => ({
            sitio: r.sitio ?? '',
            count: Number(r.residents ?? r.count ?? 0)
        })),
        totalSeniors: Number(totalSeniors) || 0
    };
    try {
        const res = await fetch('php/census_senior_sitio_interpretation.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: censusSeniorAiAbort.signal
        });
        if (res.status === 403) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-senior-interpretation__err">Walang access sa paliwanag na ito.</p>';
            return;
        }
        if (!res.ok) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-senior-interpretation__err">Hindi ma-load ang paliwanag.</p>';
            return;
        }
        const out = await res.json();
        if (!out || out.success !== true) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-senior-interpretation__err">Walang tugon mula sa server.</p>';
            return;
        }
        if (out.groqConfigured !== true) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML = `<p class="analytics-census-senior-interpretation__hint">Maglagay ng <strong>GROQ_API_KEY_CENSUS_SENIOR_CITIZENS</strong> sa .env para sa paliwanag na ito (Groq).</p>`;
            return;
        }
        const norm = normalizeCensusAiInterpretationOut(out);
        const text = norm.interpretation;
        if (!text) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-senior-interpretation__hint">Walang lumabas na paliwanag. Subukan muli mamaya.</p>';
            return;
        }
        slot.innerHTML = `<p class="analytics-census-senior-interpretation__text">${escapeChartText(text)}</p>`;
        applyCensusInterpretationRecommendations(
            recWrap,
            recSlot,
            norm.recommendations,
            'analytics-census-senior-recommendations__text'
        );
    } catch (e) {
        if (e && e.name === 'AbortError') {
            return;
        }
        applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
        slot.innerHTML =
            '<p class="analytics-census-senior-interpretation__err">Error sa pagkuha ng paliwanag.</p>';
    }
}

/**
 * Groq: paliwanag ng bilang ng widowed bawat sitio + kabuuan (GROQ_API_KEY_CENSUS_WIDOWED).
 * @param {Array<{sitio?: string, residents?: number, count?: number}>} widowedRows
 */
async function loadCensusWidowedSitioInterpretation(widowedRows, totalWidowed, censusEmpty) {
    const wrap = document.getElementById('censusAnalyticsWidowedInterpretationWrap');
    const slot = document.getElementById('censusAnalyticsWidowedInterpretationSlot');
    const recWrap = document.getElementById('censusAnalyticsWidowedRecommendationsWrap');
    const recSlot = document.getElementById('censusAnalyticsWidowedRecommendationsSlot');
    if (!wrap || !slot) {
        return;
    }
    if (censusWidowedAiAbort) {
        censusWidowedAiAbort.abort();
    }
    if (censusEmpty || !widowedRows || widowedRows.length === 0 || !(Number(totalWidowed) > 0)) {
        wrap.hidden = true;
        slot.innerHTML = '';
        applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
        return;
    }
    wrap.hidden = false;
    applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
    slot.innerHTML =
        '<p class="analytics-census-widowed-interpretation__loading">Kumukuha ng paliwanag…</p>';
    censusWidowedAiAbort = new AbortController();
    const payload = {
        widowedBySitio: widowedRows.map((r) => ({
            sitio: r.sitio ?? '',
            count: Number(r.residents ?? r.count ?? 0)
        })),
        totalWidowed: Number(totalWidowed) || 0
    };
    try {
        const res = await fetch('php/census_widowed_sitio_interpretation.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: censusWidowedAiAbort.signal
        });
        if (res.status === 403) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-widowed-interpretation__err">Walang access sa paliwanag na ito.</p>';
            return;
        }
        if (!res.ok) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-widowed-interpretation__err">Hindi ma-load ang paliwanag.</p>';
            return;
        }
        const out = await res.json();
        if (!out || out.success !== true) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-widowed-interpretation__err">Walang tugon mula sa server.</p>';
            return;
        }
        if (out.groqConfigured !== true) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML = `<p class="analytics-census-widowed-interpretation__hint">Maglagay ng <strong>GROQ_API_KEY_CENSUS_WIDOWED</strong> sa .env para sa paliwanag na ito (Groq).</p>`;
            return;
        }
        const norm = normalizeCensusAiInterpretationOut(out);
        const text = norm.interpretation;
        if (!text) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-widowed-interpretation__hint">Walang lumabas na paliwanag. Subukan muli mamaya.</p>';
            return;
        }
        slot.innerHTML = `<p class="analytics-census-widowed-interpretation__text">${escapeChartText(text)}</p>`;
        applyCensusInterpretationRecommendations(
            recWrap,
            recSlot,
            norm.recommendations,
            'analytics-census-widowed-recommendations__text'
        );
    } catch (e) {
        if (e && e.name === 'AbortError') {
            return;
        }
        applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
        slot.innerHTML =
            '<p class="analytics-census-widowed-interpretation__err">Error sa pagkuha ng paliwanag.</p>';
    }
}

/**
 * I-render ang paliwanag ng Employed: buod na talata + mga bullet bawat sitio bilang &lt;ul&gt;.
 * @param {string} raw
 * @returns {string}
 */
function formatEmployedInterpretationHtml(raw) {
    const esc = escapeChartText;
    let normalized = String(raw ?? '')
        .replace(/\r\n/g, '\n')
        .trim();
    if (!normalized) {
        return '';
    }
    if (normalized.includes('\\n') && !/\n/.test(normalized)) {
        normalized = normalized.replace(/\\n/g, '\n');
    }
    const lines = normalized
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    const intro = [];
    const bullets = [];
    let seenBullet = false;
    for (const line of lines) {
        const m = line.match(/^([•\u2022*\-])\s*(.+)$/);
        if (m) {
            seenBullet = true;
            bullets.push(m[2]);
        } else if (seenBullet && bullets.length > 0) {
            bullets[bullets.length - 1] += ` ${line}`;
        } else {
            intro.push(line);
        }
    }
    let html = '';
    if (intro.length > 0) {
        html += `<p class="analytics-census-employed-interpretation__intro">${esc(intro.join(' '))}</p>`;
    }
    if (bullets.length > 0) {
        html += '<ul class="analytics-census-employed-interpretation__list">';
        for (const b of bullets) {
            html += `<li>${esc(b)}</li>`;
        }
        html += '</ul>';
    }
    if (!html) {
        return `<p class="analytics-census-employed-interpretation__text">${esc(normalized)}</p>`;
    }
    return html;
}

/**
 * Pareho sa Employed: buod + &lt;ul&gt; bullets bawat sitio.
 * @param {string} raw
 * @returns {string}
 */
function formatUnemployedInterpretationHtml(raw) {
    const esc = escapeChartText;
    let normalized = String(raw ?? '')
        .replace(/\r\n/g, '\n')
        .trim();
    if (!normalized) {
        return '';
    }
    if (normalized.includes('\\n') && !/\n/.test(normalized)) {
        normalized = normalized.replace(/\\n/g, '\n');
    }
    const lines = normalized
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    const intro = [];
    const bullets = [];
    let seenBullet = false;
    for (const line of lines) {
        const m = line.match(/^([•\u2022*\-])\s*(.+)$/);
        if (m) {
            seenBullet = true;
            bullets.push(m[2]);
        } else if (seenBullet && bullets.length > 0) {
            bullets[bullets.length - 1] += ` ${line}`;
        } else {
            intro.push(line);
        }
    }
    let html = '';
    if (intro.length > 0) {
        html += `<p class="analytics-census-unemployed-interpretation__intro">${esc(intro.join(' '))}</p>`;
    }
    if (bullets.length > 0) {
        html += '<ul class="analytics-census-unemployed-interpretation__list">';
        for (const b of bullets) {
            html += `<li>${esc(b)}</li>`;
        }
        html += '</ul>';
    }
    if (!html) {
        return `<p class="analytics-census-unemployed-interpretation__text">${esc(normalized)}</p>`;
    }
    return html;
}

/**
 * Buod + &lt;ul&gt; bullets bawat sitio — pareho sa Employed/Unemployed.
 * @param {string} raw
 * @returns {string}
 */
function formatStudentsInterpretationHtml(raw) {
    const esc = escapeChartText;
    let normalized = String(raw ?? '')
        .replace(/\r\n/g, '\n')
        .trim();
    if (!normalized) {
        return '';
    }
    if (normalized.includes('\\n') && !/\n/.test(normalized)) {
        normalized = normalized.replace(/\\n/g, '\n');
    }
    const lines = normalized
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    const intro = [];
    const bullets = [];
    let seenBullet = false;
    for (const line of lines) {
        const m = line.match(/^([•\u2022*\-])\s*(.+)$/);
        if (m) {
            seenBullet = true;
            bullets.push(m[2]);
        } else if (seenBullet && bullets.length > 0) {
            bullets[bullets.length - 1] += ` ${line}`;
        } else {
            intro.push(line);
        }
    }
    let html = '';
    if (intro.length > 0) {
        html += `<p class="analytics-census-students-interpretation__intro">${esc(intro.join(' '))}</p>`;
    }
    if (bullets.length > 0) {
        html +=
            '<p class="analytics-census-students-interpretation__list-heading">Tala ayon sa sitio</p>';
        html += '<ul class="analytics-census-students-interpretation__list">';
        for (const b of bullets) {
            html += `<li>${esc(b)}</li>`;
        }
        html += '</ul>';
    }
    if (!html) {
        return `<p class="analytics-census-students-interpretation__text">${esc(normalized)}</p>`;
    }
    return html;
}

/**
 * Buod + listahan bawat sitio — PWD (pareho sa Students).
 * @param {string} raw
 * @returns {string}
 */
function formatPwdInterpretationHtml(raw) {
    const esc = escapeChartText;
    let normalized = String(raw ?? '')
        .replace(/\r\n/g, '\n')
        .trim();
    if (!normalized) {
        return '';
    }
    if (normalized.includes('\\n') && !/\n/.test(normalized)) {
        normalized = normalized.replace(/\\n/g, '\n');
    }
    const lines = normalized
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    const intro = [];
    const bullets = [];
    let seenBullet = false;
    for (const line of lines) {
        const m = line.match(/^([•\u2022*\-])\s*(.+)$/);
        if (m) {
            seenBullet = true;
            bullets.push(m[2]);
        } else if (seenBullet && bullets.length > 0) {
            bullets[bullets.length - 1] += ` ${line}`;
        } else {
            intro.push(line);
        }
    }
    let html = '';
    if (intro.length > 0) {
        html += `<p class="analytics-census-pwd-interpretation__intro">${esc(intro.join(' '))}</p>`;
    }
    if (bullets.length > 0) {
        html += '<p class="analytics-census-pwd-interpretation__list-heading">Tala ayon sa sitio</p>';
        html += '<ul class="analytics-census-pwd-interpretation__list">';
        for (const b of bullets) {
            html += `<li>${esc(b)}</li>`;
        }
        html += '</ul>';
    }
    if (!html) {
        return `<p class="analytics-census-pwd-interpretation__text">${esc(normalized)}</p>`;
    }
    return html;
}

/**
 * Buod + listahan bawat sitio — Indigenous / IP.
 * @param {string} raw
 * @returns {string}
 */
function formatIndigenousInterpretationHtml(raw) {
    const esc = escapeChartText;
    let normalized = String(raw ?? '')
        .replace(/\r\n/g, '\n')
        .trim();
    if (!normalized) {
        return '';
    }
    if (normalized.includes('\\n') && !/\n/.test(normalized)) {
        normalized = normalized.replace(/\\n/g, '\n');
    }
    const lines = normalized
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    const intro = [];
    const bullets = [];
    let seenBullet = false;
    for (const line of lines) {
        const m = line.match(/^([•\u2022*\-])\s*(.+)$/);
        if (m) {
            seenBullet = true;
            bullets.push(m[2]);
        } else if (seenBullet && bullets.length > 0) {
            bullets[bullets.length - 1] += ` ${line}`;
        } else {
            intro.push(line);
        }
    }
    let html = '';
    if (intro.length > 0) {
        html += `<p class="analytics-census-indigenous-interpretation__intro">${esc(intro.join(' '))}</p>`;
    }
    if (bullets.length > 0) {
        html += '<p class="analytics-census-indigenous-interpretation__list-heading">Tala ayon sa sitio</p>';
        html += '<ul class="analytics-census-indigenous-interpretation__list">';
        for (const b of bullets) {
            html += `<li>${esc(b)}</li>`;
        }
        html += '</ul>';
    }
    if (!html) {
        return `<p class="analytics-census-indigenous-interpretation__text">${esc(normalized)}</p>`;
    }
    return html;
}

/**
 * Groq: paliwanag ng bilang ng employed bawat sitio + kabuuan (GROQ_API_KEY_CENSUS_EMPLOYED).
 * @param {Array<{sitio?: string, residents?: number, count?: number}>} employedRows
 */
async function loadCensusEmployedSitioInterpretation(employedRows, totalEmployed, censusEmpty) {
    const wrap = document.getElementById('censusAnalyticsEmployedInterpretationWrap');
    const slot = document.getElementById('censusAnalyticsEmployedInterpretationSlot');
    const recWrap = document.getElementById('censusAnalyticsEmployedRecommendationsWrap');
    const recSlot = document.getElementById('censusAnalyticsEmployedRecommendationsSlot');
    if (!wrap || !slot) {
        return;
    }
    if (censusEmployedAiAbort) {
        censusEmployedAiAbort.abort();
    }
    if (censusEmpty || !employedRows || employedRows.length === 0 || !(Number(totalEmployed) > 0)) {
        wrap.hidden = true;
        slot.innerHTML = '';
        applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
        return;
    }
    wrap.hidden = false;
    applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
    slot.innerHTML =
        '<p class="analytics-census-employed-interpretation__loading">Kumukuha ng paliwanag…</p>';
    censusEmployedAiAbort = new AbortController();
    const payload = {
        employedBySitio: employedRows.map((r) => ({
            sitio: r.sitio ?? '',
            count: Number(r.residents ?? r.count ?? 0)
        })),
        totalEmployed: Number(totalEmployed) || 0
    };
    try {
        const res = await fetch('php/census_employed_sitio_interpretation.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: censusEmployedAiAbort.signal
        });
        if (res.status === 403) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-employed-interpretation__err">Walang access sa paliwanag na ito.</p>';
            return;
        }
        if (!res.ok) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-employed-interpretation__err">Hindi ma-load ang paliwanag.</p>';
            return;
        }
        const out = await res.json();
        if (!out || out.success !== true) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-employed-interpretation__err">Walang tugon mula sa server.</p>';
            return;
        }
        if (out.groqConfigured !== true) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML = `<p class="analytics-census-employed-interpretation__hint">Maglagay ng <strong>GROQ_API_KEY_CENSUS_EMPLOYED</strong> sa .env para sa paliwanag na ito (Groq).</p>`;
            return;
        }
        const norm = normalizeCensusAiInterpretationOut(out);
        const text = norm.interpretation;
        if (!text) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-employed-interpretation__hint">Walang lumabas na paliwanag. Subukan muli mamaya.</p>';
            return;
        }
        slot.innerHTML = formatEmployedInterpretationHtml(text);
        applyCensusInterpretationRecommendations(
            recWrap,
            recSlot,
            norm.recommendations,
            'analytics-census-employed-recommendations__text'
        );
    } catch (e) {
        if (e && e.name === 'AbortError') {
            return;
        }
        applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
        slot.innerHTML =
            '<p class="analytics-census-employed-interpretation__err">Error sa pagkuha ng paliwanag.</p>';
    }
}

/**
 * Groq: unemployed bawat sitio + kabuuan (GROQ_API_KEY_CENSUS_UNEMPLOYED).
 * @param {Array<{sitio?: string, residents?: number, count?: number}>} unemployedRows
 */
async function loadCensusUnemployedSitioInterpretation(unemployedRows, totalUnemployed, censusEmpty) {
    const wrap = document.getElementById('censusAnalyticsUnemployedInterpretationWrap');
    const slot = document.getElementById('censusAnalyticsUnemployedInterpretationSlot');
    const recWrap = document.getElementById('censusAnalyticsUnemployedRecommendationsWrap');
    const recSlot = document.getElementById('censusAnalyticsUnemployedRecommendationsSlot');
    if (!wrap || !slot) {
        return;
    }
    if (censusUnemployedAiAbort) {
        censusUnemployedAiAbort.abort();
    }
    if (censusEmpty || !unemployedRows || unemployedRows.length === 0 || !(Number(totalUnemployed) > 0)) {
        wrap.hidden = true;
        slot.innerHTML = '';
        applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
        return;
    }
    wrap.hidden = false;
    applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
    slot.innerHTML =
        '<p class="analytics-census-unemployed-interpretation__loading">Kumukuha ng paliwanag…</p>';
    censusUnemployedAiAbort = new AbortController();
    const payload = {
        unemployedBySitio: unemployedRows.map((r) => ({
            sitio: r.sitio ?? '',
            count: Number(r.residents ?? r.count ?? 0)
        })),
        totalUnemployed: Number(totalUnemployed) || 0
    };
    try {
        const res = await fetch('php/census_unemployed_sitio_interpretation.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: censusUnemployedAiAbort.signal
        });
        if (res.status === 403) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-unemployed-interpretation__err">Walang access sa paliwanag na ito.</p>';
            return;
        }
        if (!res.ok) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-unemployed-interpretation__err">Hindi ma-load ang paliwanag.</p>';
            return;
        }
        const out = await res.json();
        if (!out || out.success !== true) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-unemployed-interpretation__err">Walang tugon mula sa server.</p>';
            return;
        }
        if (out.groqConfigured !== true) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML = `<p class="analytics-census-unemployed-interpretation__hint">Maglagay ng <strong>GROQ_API_KEY_CENSUS_UNEMPLOYED</strong> sa .env para sa paliwanag na ito (Groq).</p>`;
            return;
        }
        const norm = normalizeCensusAiInterpretationOut(out);
        const text = norm.interpretation;
        if (!text) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-unemployed-interpretation__hint">Walang lumabas na paliwanag. Subukan muli mamaya.</p>';
            return;
        }
        slot.innerHTML = formatUnemployedInterpretationHtml(text);
        applyCensusInterpretationRecommendations(
            recWrap,
            recSlot,
            norm.recommendations,
            'analytics-census-unemployed-recommendations__text'
        );
    } catch (e) {
        if (e && e.name === 'AbortError') {
            return;
        }
        applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
        slot.innerHTML =
            '<p class="analytics-census-unemployed-interpretation__err">Error sa pagkuha ng paliwanag.</p>';
    }
}

/**
 * Groq: students bawat sitio + kabuuan (GROQ_API_KEY_CENSUS_STUDENTS).
 * @param {Array<{sitio?: string, residents?: number, count?: number}>} studentsRows
 */
async function loadCensusStudentsSitioInterpretation(studentsRows, totalStudents, censusEmpty) {
    const wrap = document.getElementById('censusAnalyticsStudentsInterpretationWrap');
    const slot = document.getElementById('censusAnalyticsStudentsInterpretationSlot');
    const recWrap = document.getElementById('censusAnalyticsStudentsRecommendationsWrap');
    const recSlot = document.getElementById('censusAnalyticsStudentsRecommendationsSlot');
    if (!wrap || !slot) {
        return;
    }
    if (censusStudentsAiAbort) {
        censusStudentsAiAbort.abort();
    }
    if (censusEmpty || !studentsRows || studentsRows.length === 0 || !(Number(totalStudents) > 0)) {
        wrap.hidden = true;
        slot.innerHTML = '';
        applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
        return;
    }
    wrap.hidden = false;
    applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
    slot.innerHTML =
        '<p class="analytics-census-students-interpretation__loading">Kumukuha ng paliwanag…</p>';
    censusStudentsAiAbort = new AbortController();
    const payload = {
        studentsBySitio: studentsRows.map((r) => ({
            sitio: r.sitio ?? '',
            count: Number(r.residents ?? r.count ?? 0)
        })),
        totalStudents: Number(totalStudents) || 0
    };
    try {
        const res = await fetch('php/census_students_sitio_interpretation.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: censusStudentsAiAbort.signal
        });
        if (res.status === 403) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-students-interpretation__err">Walang access sa paliwanag na ito.</p>';
            return;
        }
        if (!res.ok) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-students-interpretation__err">Hindi ma-load ang paliwanag.</p>';
            return;
        }
        const out = await res.json();
        if (!out || out.success !== true) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-students-interpretation__err">Walang tugon mula sa server.</p>';
            return;
        }
        if (out.groqConfigured !== true) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML = `<p class="analytics-census-students-interpretation__hint">Maglagay ng <strong>GROQ_API_KEY_CENSUS_STUDENTS</strong> sa .env para sa paliwanag na ito (Groq).</p>`;
            return;
        }
        const norm = normalizeCensusAiInterpretationOut(out);
        const text = norm.interpretation;
        if (!text) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-students-interpretation__hint">Walang lumabas na paliwanag. Subukan muli mamaya.</p>';
            return;
        }
        slot.innerHTML = formatStudentsInterpretationHtml(text);
        applyCensusInterpretationRecommendations(
            recWrap,
            recSlot,
            norm.recommendations,
            'analytics-census-students-recommendations__text'
        );
    } catch (e) {
        if (e && e.name === 'AbortError') {
            return;
        }
        applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
        slot.innerHTML =
            '<p class="analytics-census-students-interpretation__err">Error sa pagkuha ng paliwanag.</p>';
    }
}

/**
 * Groq: PWD bawat sitio + kabuuan (GROQ_API_KEY_CENSUS_PWD).
 * @param {Array<{sitio?: string, residents?: number, count?: number}>} pwdRows
 */
async function loadCensusPwdSitioInterpretation(pwdRows, totalPwd, censusEmpty) {
    const wrap = document.getElementById('censusAnalyticsPwdInterpretationWrap');
    const slot = document.getElementById('censusAnalyticsPwdInterpretationSlot');
    const recWrap = document.getElementById('censusAnalyticsPwdRecommendationsWrap');
    const recSlot = document.getElementById('censusAnalyticsPwdRecommendationsSlot');
    if (!wrap || !slot) {
        return;
    }
    if (censusPwdAiAbort) {
        censusPwdAiAbort.abort();
    }
    if (censusEmpty || !pwdRows || pwdRows.length === 0 || !(Number(totalPwd) > 0)) {
        wrap.hidden = true;
        slot.innerHTML = '';
        applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
        return;
    }
    wrap.hidden = false;
    applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
    slot.innerHTML =
        '<p class="analytics-census-pwd-interpretation__loading">Kumukuha ng paliwanag…</p>';
    censusPwdAiAbort = new AbortController();
    const payload = {
        pwdBySitio: pwdRows.map((r) => ({
            sitio: r.sitio ?? '',
            count: Number(r.residents ?? r.count ?? 0)
        })),
        totalPwd: Number(totalPwd) || 0
    };
    try {
        const res = await fetch('php/census_pwd_sitio_interpretation.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: censusPwdAiAbort.signal
        });
        if (res.status === 403) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-pwd-interpretation__err">Walang access sa paliwanag na ito.</p>';
            return;
        }
        if (!res.ok) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-pwd-interpretation__err">Hindi ma-load ang paliwanag.</p>';
            return;
        }
        const out = await res.json();
        if (!out || out.success !== true) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-pwd-interpretation__err">Walang tugon mula sa server.</p>';
            return;
        }
        if (out.groqConfigured !== true) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML = `<p class="analytics-census-pwd-interpretation__hint">Maglagay ng <strong>GROQ_API_KEY_CENSUS_PWD</strong> sa .env para sa paliwanag na ito (Groq).</p>`;
            return;
        }
        const norm = normalizeCensusAiInterpretationOut(out);
        const text = norm.interpretation;
        if (!text) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-pwd-interpretation__hint">Walang lumabas na paliwanag. Subukan muli mamaya.</p>';
            return;
        }
        slot.innerHTML = formatPwdInterpretationHtml(text);
        applyCensusInterpretationRecommendations(
            recWrap,
            recSlot,
            norm.recommendations,
            'analytics-census-pwd-recommendations__text'
        );
    } catch (e) {
        if (e && e.name === 'AbortError') {
            return;
        }
        applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
        slot.innerHTML =
            '<p class="analytics-census-pwd-interpretation__err">Error sa pagkuha ng paliwanag.</p>';
    }
}

/**
 * Groq: Indigenous (IP) bawat sitio + kabuuan (GROQ_API_KEY_CENSUS_INDIGENOUS).
 * @param {Array<{sitio?: string, residents?: number, count?: number}>} indigenousRows
 */
async function loadCensusIndigenousSitioInterpretation(indigenousRows, totalIndigenous, censusEmpty) {
    const wrap = document.getElementById('censusAnalyticsIndigenousInterpretationWrap');
    const slot = document.getElementById('censusAnalyticsIndigenousInterpretationSlot');
    const recWrap = document.getElementById('censusAnalyticsIndigenousRecommendationsWrap');
    const recSlot = document.getElementById('censusAnalyticsIndigenousRecommendationsSlot');
    if (!wrap || !slot) {
        return;
    }
    if (censusIndigenousAiAbort) {
        censusIndigenousAiAbort.abort();
    }
    if (
        censusEmpty ||
        !indigenousRows ||
        indigenousRows.length === 0 ||
        !(Number(totalIndigenous) > 0)
    ) {
        wrap.hidden = true;
        slot.innerHTML = '';
        applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
        return;
    }
    wrap.hidden = false;
    applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
    slot.innerHTML =
        '<p class="analytics-census-indigenous-interpretation__loading">Kumukuha ng paliwanag…</p>';
    censusIndigenousAiAbort = new AbortController();
    const payload = {
        indigenousBySitio: indigenousRows.map((r) => ({
            sitio: r.sitio ?? '',
            count: Number(r.residents ?? r.count ?? 0)
        })),
        totalIndigenous: Number(totalIndigenous) || 0
    };
    try {
        const res = await fetch('php/census_indigenous_sitio_interpretation.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: censusIndigenousAiAbort.signal
        });
        if (res.status === 403) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-indigenous-interpretation__err">Walang access sa paliwanag na ito.</p>';
            return;
        }
        if (!res.ok) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-indigenous-interpretation__err">Hindi ma-load ang paliwanag.</p>';
            return;
        }
        const out = await res.json();
        if (!out || out.success !== true) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-indigenous-interpretation__err">Walang tugon mula sa server.</p>';
            return;
        }
        if (out.groqConfigured !== true) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML = `<p class="analytics-census-indigenous-interpretation__hint">Maglagay ng <strong>GROQ_API_KEY_CENSUS_INDIGENOUS</strong> sa .env para sa paliwanag na ito (Groq).</p>`;
            return;
        }
        const norm = normalizeCensusAiInterpretationOut(out);
        const text = norm.interpretation;
        if (!text) {
            applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
            slot.innerHTML =
                '<p class="analytics-census-indigenous-interpretation__hint">Walang lumabas na paliwanag. Subukan muli mamaya.</p>';
            return;
        }
        slot.innerHTML = formatIndigenousInterpretationHtml(text);
        applyCensusInterpretationRecommendations(
            recWrap,
            recSlot,
            norm.recommendations,
            'analytics-census-indigenous-recommendations__text'
        );
    } catch (e) {
        if (e && e.name === 'AbortError') {
            return;
        }
        applyCensusInterpretationRecommendations(recWrap, recSlot, '', '');
        slot.innerHTML =
            '<p class="analytics-census-indigenous-interpretation__err">Error sa pagkuha ng paliwanag.</p>';
    }
}

function renderCensusAnalyticsPanel(data) {
    if (censusSeniorAiAbort) {
        censusSeniorAiAbort.abort();
    }
    if (censusWidowedAiAbort) {
        censusWidowedAiAbort.abort();
    }
    if (censusEmployedAiAbort) {
        censusEmployedAiAbort.abort();
    }
    if (censusUnemployedAiAbort) {
        censusUnemployedAiAbort.abort();
    }
    if (censusStudentsAiAbort) {
        censusStudentsAiAbort.abort();
    }
    if (censusPwdAiAbort) {
        censusPwdAiAbort.abort();
    }
    if (censusIndigenousAiAbort) {
        censusIndigenousAiAbort.abort();
    }
    const sub = document.getElementById('censusAnalyticsSubtitle');
    const sum = document.getElementById('censusAnalyticsSummary');
    const tbody = document.getElementById('censusAnalyticsBySitioBody');
    const seniorTbody = document.getElementById('censusAnalyticsSeniorBySitioBody');
    const widowedTbody = document.getElementById('censusAnalyticsWidowedBySitioBody');
    const employedTbody = document.getElementById('censusAnalyticsEmployedBySitioBody');
    const unemployedTbody = document.getElementById('censusAnalyticsUnemployedBySitioBody');
    const studentsTbody = document.getElementById('censusAnalyticsStudentsBySitioBody');
    const pwdTbody = document.getElementById('censusAnalyticsPwdBySitioBody');
    const indigenousTbody = document.getElementById('censusAnalyticsIndigenousBySitioBody');
    const table = tbody?.closest('table');
    const seniorTable = seniorTbody?.closest('table');
    const widowedTable = widowedTbody?.closest('table');
    const employedTable = employedTbody?.closest('table');
    const unemployedTable = unemployedTbody?.closest('table');
    const studentsTable = studentsTbody?.closest('table');
    const pwdTable = pwdTbody?.closest('table');
    const indigenousTable = indigenousTbody?.closest('table');
    if (!tbody) return;

    const c = data.census || {};
    const residents = c.totalResidents ?? 0;
    const households = c.totalHouseholds ?? 0;
    const totalSeniors = c.totalSeniorResidents ?? 0;
    const totalWidowed = Number((c.censusDemographics || {}).widowed ?? 0);
    const totalEmployed = Number((c.censusDemographics || {}).employed ?? 0);
    const totalUnemployed = Number((c.censusDemographics || {}).unemployed ?? 0);
    const totalStudents = Number((c.censusDemographics || {}).students ?? 0);
    const totalPwd = Number((c.censusDemographics || {}).pwd ?? 0);
    const totalIndigenous = Number((c.censusDemographics || {}).indigenous ?? 0);

    if (sub) {
        sub.textContent = `${residents.toLocaleString()} residents · ${households.toLocaleString()} households · ${totalSeniors.toLocaleString()} seniors 60+ (active records)`;
    }

    if (sum) {
        sum.innerHTML = `
            <div class="analytics-card-grid analytics-census-cards">
                <div class="analytics-card analytics-card--census-residents">
                    <span class="card-label">Residents</span>
                    <span class="card-value">${residents.toLocaleString()}</span>
                </div>
                <div class="analytics-card analytics-card--census-households">
                    <span class="card-label">Households</span>
                    <span class="card-value">${households.toLocaleString()}</span>
                </div>
            </div>`;
    }

    const demoEl = document.getElementById('censusAnalyticsDemographics');
    const demo = c.censusDemographics || {};
    const n = (k) => Number(demo[k] ?? 0).toLocaleString();
    if (demoEl) {
        demoEl.innerHTML = `
            <h6 class="analytics-census-demographics-title">Demographic totals (Censused residents)</h6>
            <div class="analytics-census-demographics-grid">
                <div class="analytics-census-demo-tile analytics-census-demo-tile--senior" role="button" tabindex="0" aria-controls="censusAnalyticsSeniorSection" aria-expanded="false" aria-label="Show seniors aged 60 and above by sitio">
                    <span class="analytics-census-demo-label">Senior citizens (60+)</span>
                    <span class="analytics-census-demo-value">${n('seniorCitizens')}</span>
                </div>
                <div class="analytics-census-demo-tile analytics-census-demo-tile--widowed" role="button" tabindex="0" aria-controls="censusAnalyticsWidowedSection" aria-expanded="false" aria-label="Show widowed residents by sitio">
                    <span class="analytics-census-demo-label">Widowed</span>
                    <span class="analytics-census-demo-value">${n('widowed')}</span>
                </div>
                <div class="analytics-census-demo-tile analytics-census-demo-tile--employed" role="button" tabindex="0" aria-controls="censusAnalyticsEmployedSection" aria-expanded="false" aria-label="Show employed residents by sitio">
                    <span class="analytics-census-demo-label">Employed</span>
                    <span class="analytics-census-demo-value">${n('employed')}</span>
                </div>
                <div class="analytics-census-demo-tile analytics-census-demo-tile--unemployed" role="button" tabindex="0" aria-controls="censusAnalyticsUnemployedSection" aria-expanded="false" aria-label="Show unemployed residents by sitio">
                    <span class="analytics-census-demo-label">Unemployed</span>
                    <span class="analytics-census-demo-value">${n('unemployed')}</span>
                </div>
                <div class="analytics-census-demo-tile analytics-census-demo-tile--students" role="button" tabindex="0" aria-controls="censusAnalyticsStudentsSection" aria-expanded="false" aria-label="Show students by sitio">
                    <span class="analytics-census-demo-label">Students</span>
                    <span class="analytics-census-demo-value">${n('students')}</span>
                </div>
                <div class="analytics-census-demo-tile analytics-census-demo-tile--pwd" role="button" tabindex="0" aria-controls="censusAnalyticsPwdSection" aria-expanded="false" aria-label="Show PWD residents by sitio">
                    <span class="analytics-census-demo-label">PWD</span>
                    <span class="analytics-census-demo-value">${n('pwd')}</span>
                </div>
                <div class="analytics-census-demo-tile analytics-census-demo-tile--ip" role="button" tabindex="0" aria-controls="censusAnalyticsIndigenousSection" aria-expanded="false" aria-label="Show indigenous residents by sitio">
                    <span class="analytics-census-demo-label">Indigenous (IP)</span>
                    <span class="analytics-census-demo-value">${n('indigenous')}</span>
                </div>
            </div>`;
        ensureCensusDemographicTileReveals();
    }

    const rows = c.bySitio || [];
    if (table) {
        const oldFoot = table.querySelector('tfoot');
        if (oldFoot) {
            oldFoot.remove();
        }
    }

    if (rows.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="2" class="table-loading">No census data yet or census table is empty.</td></tr>';
    } else {
        tbody.innerHTML = rows
            .map(r => {
                const n = r.residents ?? r.count ?? 0;
                return `<tr><td>${escapeChartText(r.sitio)}</td><td>${Number(n).toLocaleString()}</td></tr>`;
            })
            .join('');

        if (table) {
            const foot = document.createElement('tfoot');
            foot.className = 'analytics-census-by-sitio-foot';
            foot.innerHTML = `<tr>
                <th scope="row">Total</th>
                <td>${residents.toLocaleString()}</td>
            </tr>`;
            table.appendChild(foot);
        }
    }

    const seniorRows = filterCensusDemographicBySitioNonZero(c.seniorCitizensBySitio || []);
    if (seniorTbody) {
        if (seniorTable) {
            const oldSeniorFoot = seniorTable.querySelector('tfoot');
            if (oldSeniorFoot) {
                oldSeniorFoot.remove();
            }
        }
        if (rows.length === 0) {
            seniorTbody.innerHTML =
                '<tr><td colspan="2" class="table-loading">No census data yet or census table is empty.</td></tr>';
        } else if (seniorRows.length === 0) {
            seniorTbody.innerHTML =
                '<tr><td colspan="2" class="table-loading">No sitios with a non-zero count for this category.</td></tr>';
        } else {
            seniorTbody.innerHTML = seniorRows
                .map(r => {
                    const n = r.residents ?? r.count ?? 0;
                    return `<tr><td>${escapeChartText(r.sitio)}</td><td>${Number(n).toLocaleString()}</td></tr>`;
                })
                .join('');

            if (seniorTable) {
                const seniorFoot = document.createElement('tfoot');
                seniorFoot.className = 'analytics-census-by-sitio-foot';
                seniorFoot.innerHTML = `<tr>
                <th scope="row">Total</th>
                <td>${totalSeniors.toLocaleString()}</td>
            </tr>`;
                seniorTable.appendChild(seniorFoot);
            }
        }
    }
    void loadCensusSeniorSitioInterpretation(
        filterCensusDemographicBySitioNonZero(c.seniorCitizensBySitio || []),
        totalSeniors,
        rows.length === 0
    );

    const widowedRows = filterCensusDemographicBySitioNonZero(c.widowedBySitio || []);
    if (widowedTbody) {
        if (widowedTable) {
            const oldWidowedFoot = widowedTable.querySelector('tfoot');
            if (oldWidowedFoot) {
                oldWidowedFoot.remove();
            }
        }
        if (rows.length === 0) {
            widowedTbody.innerHTML =
                '<tr><td colspan="2" class="table-loading">No census data yet or census table is empty.</td></tr>';
        } else if (widowedRows.length === 0) {
            widowedTbody.innerHTML =
                '<tr><td colspan="2" class="table-loading">No sitios with a non-zero count for this category.</td></tr>';
        } else {
            widowedTbody.innerHTML = widowedRows
                .map(r => {
                    const n = r.residents ?? r.count ?? 0;
                    return `<tr><td>${escapeChartText(r.sitio)}</td><td>${Number(n).toLocaleString()}</td></tr>`;
                })
                .join('');

            if (widowedTable) {
                const widowedFoot = document.createElement('tfoot');
                widowedFoot.className = 'analytics-census-by-sitio-foot';
                widowedFoot.innerHTML = `<tr>
                <th scope="row">Total</th>
                <td>${totalWidowed.toLocaleString()}</td>
            </tr>`;
                widowedTable.appendChild(widowedFoot);
            }
        }
    }
    void loadCensusWidowedSitioInterpretation(
        filterCensusDemographicBySitioNonZero(c.widowedBySitio || []),
        totalWidowed,
        rows.length === 0
    );

    const employedRows = filterCensusDemographicBySitioNonZero(c.employedBySitio || []);
    if (employedTbody) {
        if (employedTable) {
            const oldEmployedFoot = employedTable.querySelector('tfoot');
            if (oldEmployedFoot) {
                oldEmployedFoot.remove();
            }
        }
        if (rows.length === 0) {
            employedTbody.innerHTML =
                '<tr><td colspan="2" class="table-loading">No census data yet or census table is empty.</td></tr>';
        } else if (employedRows.length === 0) {
            employedTbody.innerHTML =
                '<tr><td colspan="2" class="table-loading">No sitios with a non-zero count for this category.</td></tr>';
        } else {
            employedTbody.innerHTML = employedRows
                .map(r => {
                    const n = r.residents ?? r.count ?? 0;
                    return `<tr><td>${escapeChartText(r.sitio)}</td><td>${Number(n).toLocaleString()}</td></tr>`;
                })
                .join('');

            if (employedTable) {
                const employedFoot = document.createElement('tfoot');
                employedFoot.className = 'analytics-census-by-sitio-foot';
                employedFoot.innerHTML = `<tr>
                <th scope="row">Total</th>
                <td>${totalEmployed.toLocaleString()}</td>
            </tr>`;
                employedTable.appendChild(employedFoot);
            }
        }
    }
    void loadCensusEmployedSitioInterpretation(
        filterCensusDemographicBySitioNonZero(c.employedBySitio || []),
        totalEmployed,
        rows.length === 0
    );

    const unemployedRows = filterCensusDemographicBySitioNonZero(c.unemployedBySitio || []);
    if (unemployedTbody) {
        if (unemployedTable) {
            const oldUnemployedFoot = unemployedTable.querySelector('tfoot');
            if (oldUnemployedFoot) {
                oldUnemployedFoot.remove();
            }
        }
        if (rows.length === 0) {
            unemployedTbody.innerHTML =
                '<tr><td colspan="2" class="table-loading">No census data yet or census table is empty.</td></tr>';
        } else if (unemployedRows.length === 0) {
            unemployedTbody.innerHTML =
                '<tr><td colspan="2" class="table-loading">No sitios with a non-zero count for this category.</td></tr>';
        } else {
            unemployedTbody.innerHTML = unemployedRows
                .map(r => {
                    const n = r.residents ?? r.count ?? 0;
                    return `<tr><td>${escapeChartText(r.sitio)}</td><td>${Number(n).toLocaleString()}</td></tr>`;
                })
                .join('');

            if (unemployedTable) {
                const unemployedFoot = document.createElement('tfoot');
                unemployedFoot.className = 'analytics-census-by-sitio-foot';
                unemployedFoot.innerHTML = `<tr>
                <th scope="row">Total</th>
                <td>${totalUnemployed.toLocaleString()}</td>
            </tr>`;
                unemployedTable.appendChild(unemployedFoot);
            }
        }
    }
    void loadCensusUnemployedSitioInterpretation(
        filterCensusDemographicBySitioNonZero(c.unemployedBySitio || []),
        totalUnemployed,
        rows.length === 0
    );

    const studentsRows = filterCensusDemographicBySitioNonZero(c.studentsBySitio || []);
    if (studentsTbody) {
        if (studentsTable) {
            const oldStudentsFoot = studentsTable.querySelector('tfoot');
            if (oldStudentsFoot) {
                oldStudentsFoot.remove();
            }
        }
        if (rows.length === 0) {
            studentsTbody.innerHTML =
                '<tr><td colspan="2" class="table-loading">No census data yet or census table is empty.</td></tr>';
        } else if (studentsRows.length === 0) {
            studentsTbody.innerHTML =
                '<tr><td colspan="2" class="table-loading">No sitios with a non-zero count for this category.</td></tr>';
        } else {
            studentsTbody.innerHTML = studentsRows
                .map(r => {
                    const n = r.residents ?? r.count ?? 0;
                    return `<tr><td>${escapeChartText(r.sitio)}</td><td>${Number(n).toLocaleString()}</td></tr>`;
                })
                .join('');

            if (studentsTable) {
                const studentsFoot = document.createElement('tfoot');
                studentsFoot.className = 'analytics-census-by-sitio-foot';
                studentsFoot.innerHTML = `<tr>
                <th scope="row">Total</th>
                <td>${totalStudents.toLocaleString()}</td>
            </tr>`;
                studentsTable.appendChild(studentsFoot);
            }
        }
    }
    void loadCensusStudentsSitioInterpretation(
        filterCensusDemographicBySitioNonZero(c.studentsBySitio || []),
        totalStudents,
        rows.length === 0
    );

    const pwdRows = filterCensusDemographicBySitioNonZero(c.pwdBySitio || []);
    if (pwdTbody) {
        if (pwdTable) {
            const oldPwdFoot = pwdTable.querySelector('tfoot');
            if (oldPwdFoot) {
                oldPwdFoot.remove();
            }
        }
        if (rows.length === 0) {
            pwdTbody.innerHTML =
                '<tr><td colspan="2" class="table-loading">No census data yet or census table is empty.</td></tr>';
        } else if (pwdRows.length === 0) {
            pwdTbody.innerHTML =
                '<tr><td colspan="2" class="table-loading">No sitios with a non-zero count for this category.</td></tr>';
        } else {
            pwdTbody.innerHTML = pwdRows
                .map(r => {
                    const n = r.residents ?? r.count ?? 0;
                    return `<tr><td>${escapeChartText(r.sitio)}</td><td>${Number(n).toLocaleString()}</td></tr>`;
                })
                .join('');

            if (pwdTable) {
                const pwdFoot = document.createElement('tfoot');
                pwdFoot.className = 'analytics-census-by-sitio-foot';
                pwdFoot.innerHTML = `<tr>
                <th scope="row">Total</th>
                <td>${totalPwd.toLocaleString()}</td>
            </tr>`;
                pwdTable.appendChild(pwdFoot);
            }
        }
    }
    void loadCensusPwdSitioInterpretation(
        filterCensusDemographicBySitioNonZero(c.pwdBySitio || []),
        totalPwd,
        rows.length === 0
    );

    const indigenousRows = filterCensusDemographicBySitioNonZero(c.indigenousBySitio || []);
    if (indigenousTbody) {
        if (indigenousTable) {
            const oldIndigenousFoot = indigenousTable.querySelector('tfoot');
            if (oldIndigenousFoot) {
                oldIndigenousFoot.remove();
            }
        }
        if (rows.length === 0) {
            indigenousTbody.innerHTML =
                '<tr><td colspan="2" class="table-loading">No census data yet or census table is empty.</td></tr>';
        } else if (indigenousRows.length === 0) {
            indigenousTbody.innerHTML =
                '<tr><td colspan="2" class="table-loading">No sitios with a non-zero count for this category.</td></tr>';
        } else {
            indigenousTbody.innerHTML = indigenousRows
                .map(r => {
                    const n = r.residents ?? r.count ?? 0;
                    return `<tr><td>${escapeChartText(r.sitio)}</td><td>${Number(n).toLocaleString()}</td></tr>`;
                })
                .join('');

            if (indigenousTable) {
                const indigenousFoot = document.createElement('tfoot');
                indigenousFoot.className = 'analytics-census-by-sitio-foot';
                indigenousFoot.innerHTML = `<tr>
                <th scope="row">Total</th>
                <td>${totalIndigenous.toLocaleString()}</td>
            </tr>`;
                indigenousTable.appendChild(indigenousFoot);
            }
        }
    }
    void loadCensusIndigenousSitioInterpretation(
        filterCensusDemographicBySitioNonZero(c.indigenousBySitio || []),
        totalIndigenous,
        rows.length === 0
    );
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

    const dash = '—';
    const isEmptyJobseekerCell = (col, raw) => {
        if (raw === null || raw === undefined) return true;
        if (typeof raw === 'string' && raw.trim() === '') return true;
        if (col.key === 'age' && (Number(raw) === 0 || raw === '0')) return true;
        return false;
    };

    // Create table rows
    const rows = reports.map(report => {
        const cells = columnOrder.map(col => {
            let value = report[col.key];

            // Handle checkmark columns — walang tick = dash (hindi blank)
            if (col.isCheckmark) {
                const checkValue = parseInt(value, 10) || 0;
                const inner = checkValue === 1 ? '✓' : dash;
                return `<td style="text-align: center;">${inner}</td>`;
            }

            if (isEmptyJobseekerCell(col, value)) {
                return `<td>${dash}</td>`;
            }

            let display = value;
            // Format birthdate components
            if (col.key === 'birth_month') {
                const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const monthNum = parseInt(String(value), 10);
                display = monthNum >= 1 && monthNum <= 12 ? monthNames[monthNum] : '';
                if (!display) {
                    return `<td>${dash}</td>`;
                }
            }

            const out = display === null || display === undefined ? '' : String(display).trim();
            return `<td>${out === '' ? dash : out}</td>`;
        }).join('');

        return `<tr>${cells}</tr>`;
    }).join('');

    tableBody.innerHTML = rows;
}

