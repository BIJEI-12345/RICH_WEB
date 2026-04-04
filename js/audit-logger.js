// Audit Logger - Track user actions and page views
(function() {
    'use strict';
    
    // Map page names to modules (Dashboard excluded from audit trail)
    const pageModuleMap = {
        'reqDocu.html': { module: 'Document Request', action: 'viewed', description: 'Document Request page accessed' },
        'concerns.html': { module: 'Concern', action: 'viewed', description: 'Concern page accessed' },
        'emergency.html': { module: 'Emergency', action: 'viewed', description: 'Emergency page accessed' },
        'userManagement.html': { module: 'User Management', action: 'viewed', description: 'User Management page accessed' },
        'resident-info.html': { module: 'Resident Information', action: 'viewed', description: 'Resident Information page accessed' },
        'archive.html': { module: 'Archive', action: 'viewed', description: 'Archive page accessed' },
        'analytics.html': { module: 'Analytics', action: 'viewed', description: 'Analytics page accessed' },
        'audit-trail.html': { module: 'Audit Trail', action: 'viewed', description: 'Audit Trail page accessed' }
    };
    
    // Log page view when page loads
    function logPageView() {
        const currentPage = window.location.pathname.split('/').pop();
        const pageInfo = pageModuleMap[currentPage];
        
        if (pageInfo) {
            logAction(pageInfo.module, pageInfo.action, pageInfo.description);
        }
    }
    
    // Log user action
    function logAction(module, action, description) {
        // Wait for Session to be available
        if (typeof Session === 'undefined') {
            // Wait a bit and try again
            setTimeout(() => logAction(module, action, description), 500);
            return;
        }
        
        // Check if user is logged in
        if (!Session.data || !Session.data.logged_in) {
            return;
        }
        
        // Send to PHP endpoint to log
        fetch('php/log_audit_action.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                module: module,
                action: action,
                description: description
            }),
            credentials: 'include'
        }).catch(error => {
            // Silently fail - don't spam console
        });
    }
    
    // Log button clicks
    function logButtonClick(buttonText, module, action) {
        const description = `${action} ${buttonText}`;
        logAction(module, action, description);
    }
    
    // Auto-log page view on load - wait for Session to be available
    function initPageViewLogging() {
        if (typeof Session !== 'undefined' && Session.data && Session.data.logged_in) {
            logPageView();
        } else {
            // Wait for Session to load (max 10 seconds)
            let attempts = 0;
            const checkSession = setInterval(() => {
                attempts++;
                if (typeof Session !== 'undefined' && Session.data && Session.data.logged_in) {
                    clearInterval(checkSession);
                    logPageView();
                } else if (attempts >= 20) {
                    clearInterval(checkSession);
                }
            }, 500);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(initPageViewLogging, 1000);
        });
    } else {
        setTimeout(initPageViewLogging, 1000);
    }
    
    // Export functions for use in other scripts
    window.AuditLogger = {
        logAction: logAction,
        logButtonClick: logButtonClick
    };
})();

