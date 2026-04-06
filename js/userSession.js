// Simple user session + access control helper
;(function(){
    const Session = {
        data: { logged_in: false, name: null, position: null },
        sessionStartTime: null,
        sessionExpired: false,
        warningShown: false,
        
        async load() {
            try {
                const res = await fetch('php/userSession.php', { cache: 'no-store' });
                const json = await res.json();
                this.data = json || { logged_in: false };
                window.CurrentUser = this.data;
                
                // Set session start time on first successful login
                if (this.data.logged_in && !this.sessionStartTime) {
                    this.sessionStartTime = Date.now();
                    this.sessionExpired = false;
                    this.warningShown = false;
                }
                
                // Check if session expired
                if (!this.data.logged_in && this.sessionStartTime) {
                    this.sessionExpired = true;
                }
                
                this.applyVisibilityByPage();
                this.enforceMotherLeaderRoute();
                this.enforceAdminOnlyRoutes();
                
                // No automatic logout - session stays alive
            } catch (e) {
                console.error('Failed to load session', e);
                // On error, don't redirect immediately - might be network issue
            }
        },
        isMotherLeader() {
            return (this.data.position || '').trim().toLowerCase() === 'mother leader';
        },
        /** Mother Leader: dashboard + Resident Information + Census only; block other `.html` app pages. */
        enforceMotherLeaderRoute() {
            if (!this.data.logged_in || !this.isMotherLeader()) return;
            const path = (location.pathname || '').replace(/\\/g, '/').toLowerCase();
            const file = path.split('/').pop() || '';
            if (!file.endsWith('.html')) return;
            const allowedHtml = ['admin-dashboard.html', 'resident-info.html', 'census.html'];
            if (allowedHtml.indexOf(file) !== -1) return;
            window.location.replace('resident-info.html');
        },
        /** Audit Trail, Archive, User Management, Analytics: admin only. */
        enforceAdminOnlyRoutes() {
            const path = (location.pathname || '').replace(/\\/g, '/').toLowerCase();
            const file = (path.split('/').pop() || '').toLowerCase();
            const adminOnly = ['analytics.html', 'audit-trail.html', 'archive.html', 'usermanagement.html'];
            if (adminOnly.indexOf(file) === -1) return;
            if (!this.data.logged_in) {
                window.location.replace('index.php');
                return;
            }
            if ((this.data.position || '').trim().toLowerCase() !== 'admin') {
                window.location.replace('admin-dashboard.html');
            }
        },
        canEditModule(moduleName) {
            const pos = (this.data.position || '').toLowerCase().trim().replace(/\s+/g, ' ');
            if (!pos) return false;
            if (pos === 'mother leader') return false;
            // Admin: full access everywhere
            if (pos === 'admin') return true;
            // Rules:
            // - "document request category": full buttons in reqDocu, view-only in concerns/emergency
            // - "concerns & reporting" or "emergency": full buttons in concerns/emergency, view-only in reqDocu
            if (moduleName === 'reqDocu') {
                return pos === 'document request category';
            }
            if (moduleName === 'concerns') {
                return pos === 'concerns & reporting' || pos === 'concern & reporting';
            }
            if (moduleName === 'emergency') {
                return pos === 'emergency' || pos === 'emergency category';
            }
            return false;
        },
        canSeeUserManagement() {
            const pos = (this.data.position || '').toLowerCase();
            if (pos === 'mother leader') return false;
            // Admin sees User Management
            if (pos === 'admin') return true;
            // Others: hidden per requirement
            if (pos === 'document request category' || pos === 'concerns & reporting' || pos === 'emergency' || pos === 'emergency category') {
                return false;
            }
            return false;
        },
        canSeeAnalytics() {
            const pos = (this.data.position || '').toLowerCase();
            return pos === 'admin';
        },
        applyVisibilityByPage() {
            const pos = (this.data.position || '').toLowerCase();
            const isAdmin = pos === 'admin';

            // Hide/Show User Management button on admin dashboard
            const umBtn = document.querySelector('.user-management-access');
            if (umBtn) {
                umBtn.style.display = this.canSeeUserManagement() ? '' : 'none';
            }

            // Hide/Show Analytics button on admin dashboard (Admin only)
            const analyticsBtn = document.querySelector('.analytics-access');
            if (analyticsBtn) {
                analyticsBtn.style.display = this.canSeeAnalytics() ? '' : 'none';
            }

            const archiveBtn = document.querySelector('.archive-access');
            if (archiveBtn) {
                archiveBtn.style.display = isAdmin ? '' : 'none';
            }

            const auditTrailBtn = document.querySelector('.audit-trail-access');
            if (auditTrailBtn) {
                auditTrailBtn.style.display = isAdmin ? '' : 'none';
            }

            // Expose AccessControl globally for page scripts to use
            window.AccessControl = {
                canEditModule: (name) => this.canEditModule(name)
            };

            // Also provide legacy global for pages calling canEditModule(name)
            window.canEditModule = (name) => this.canEditModule(name);

            // Page-specific control for existing pages that render cards after load
            const path = (location.pathname || '').toLowerCase();
            if (path.endsWith('/reqdocu.html')) {
                // After cards render, hide action buttons if view-only
                // But don't hide for admins - admins should always have full access
                const isAdmin = (this.data.position || '').toLowerCase() === 'admin';
                
                // For admins, explicitly show all buttons and ensure they stay visible
                // This must run FIRST to prevent other code from hiding them
                if (isAdmin) {
                    const showAdminButtons = () => {
                        const actionButtons = document.querySelectorAll('.request-card .process-btn, .request-card .finish-btn, .request-card .print-btn, .request-card .ready-btn');
                        actionButtons.forEach(btn => {
                            if (!btn) return;
                            // Remove any inline styles that hide the button
                            btn.style.removeProperty('visibility');
                            btn.style.removeProperty('pointer-events');
                            // Explicitly set visible styles
                            btn.style.setProperty('visibility', 'visible', 'important');
                            btn.style.setProperty('display', 'inline-flex', 'important');
                            btn.style.setProperty('pointer-events', 'auto', 'important');
                            btn.classList.add('admin-visible');
                        });
                    };
                    // Run immediately and also after a delay to catch dynamically added buttons
                    showAdminButtons();
                    setTimeout(showAdminButtons, 100);
                    setTimeout(showAdminButtons, 300);
                    setTimeout(showAdminButtons, 500);
                    // observe dynamic inserts to ensure admin buttons stay visible
                    const container = document.querySelector('.main-content-container') || document.body;
                    if (container && 'MutationObserver' in window) {
                        const mo = new MutationObserver(() => {
                            // Use requestAnimationFrame to ensure this runs after any hiding code
                            requestAnimationFrame(() => {
                                showAdminButtons();
                            });
                        });
                        mo.observe(container, { childList: true, subtree: true });
                    }
                }
                
                // Only hide buttons for non-admin, view-only users
                if (!this.canEditModule('reqDocu') && !isAdmin) {
                    const hideCardActions = () => {
                        const actionButtons = document.querySelectorAll('.request-card .process-btn, .request-card .finish-btn, .request-card .print-btn, .request-card .ready-btn, .request-card .admin-visible');
                        actionButtons.forEach(btn => {
                            if (!btn) return;
                            // Keep layout visible but disable all actions for view-only roles
                            btn.disabled = true;
                            btn.style.visibility = 'visible';
                            btn.style.pointerEvents = 'none';
                            btn.style.opacity = '0.5';
                            btn.setAttribute('aria-disabled', 'true');
                        });
                    };
                    // initial
                    setTimeout(hideCardActions, 200);
                    // observe dynamic inserts
                    const container = document.querySelector('.main-content-container') || document.body;
                    if (container && 'MutationObserver' in window) {
                        const mo = new MutationObserver(() => hideCardActions());
                        mo.observe(container, { childList: true, subtree: true });
                    }
                }
            }
            if (path.endsWith('/concerns.html')) {
                // Buttons are built per canEditModule() in concerns.js; nothing extra needed
            }
            if (path.endsWith('/emergency.html')) {
                // Hide resolve button for view-only users at modal open time handled in emergency.js via canEditModule()
            }
            if (path.endsWith('/census.html')) {
                const pos = (this.data.position || '').toLowerCase();
                const isViewOnlyCensusRole = (
                    pos === 'emergency' ||
                    pos === 'emergency category' ||
                    pos === 'concerns & reporting'
                );
                if (isViewOnlyCensusRole) {
                    const disableCensusActions = () => {
                        const actionButtons = document.querySelectorAll('.add-resident-btn, .member-remove-btn');
                        actionButtons.forEach(btn => {
                            if (!btn) return;
                            btn.disabled = true;
                            btn.style.pointerEvents = 'none';
                            btn.style.opacity = '0.5';
                            btn.setAttribute('aria-disabled', 'true');
                        });
                    };
                    disableCensusActions();
                    const container = document.querySelector('.main-content-container') || document.body;
                    if (container && 'MutationObserver' in window) {
                        const mo = new MutationObserver(() => disableCensusActions());
                        mo.observe(container, { childList: true, subtree: true });
                    }
                }
            }
        },
        
        // Check if session is expired (for disabling transactions)
        isSessionExpired() {
            return this.sessionExpired;
        },
        
        // Disable all transaction buttons and forms
        disableTransactions() {
            // Disable all buttons except logout and close buttons
            const allButtons = document.querySelectorAll('button:not(.logout-btn):not(.close-modal-btn)');
            allButtons.forEach(btn => {
                if (!btn.classList.contains('session-allowed')) {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'not-allowed';
                    btn.setAttribute('data-session-disabled', 'true');
                }
            });
            
            // Disable all form inputs
            const allInputs = document.querySelectorAll('input, textarea, select');
            allInputs.forEach(input => {
                if (!input.classList.contains('session-allowed')) {
                    input.disabled = true;
                    input.setAttribute('data-session-disabled', 'true');
                }
            });
            
            // Disable all links except logout
            const allLinks = document.querySelectorAll('a:not([href*="logout"]):not([href*="index.php"])');
            allLinks.forEach(link => {
                if (!link.classList.contains('session-allowed')) {
                    link.style.pointerEvents = 'none';
                    link.style.opacity = '0.5';
                    link.setAttribute('data-session-disabled', 'true');
                }
            });
        },
        
        // Re-enable transactions (if needed)
        enableTransactions() {
            const disabledElements = document.querySelectorAll('[data-session-disabled="true"]');
            disabledElements.forEach(el => {
                el.disabled = false;
                el.style.opacity = '';
                el.style.cursor = '';
                el.style.pointerEvents = '';
                el.removeAttribute('data-session-disabled');
            });
        },
        
        // Show session timeout warning
        async showSessionTimeoutWarning() {
            // Load SweetAlert2 if not already loaded
            if (typeof Swal === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
                document.head.appendChild(script);
                await new Promise((resolve) => {
                    script.onload = resolve;
                });
            }
            
            const result = await Swal.fire({
                icon: 'warning',
                title: 'Session Timeout',
                html: '<p>Your session has expired. Please login again.</p>',
                showCloseButton: true,
                showConfirmButton: true,
                confirmButtonText: 'OK',
                confirmButtonColor: '#1e40ff',
                allowOutsideClick: false,
                allowEscapeKey: true,
                customClass: {
                    popup: 'swal2-small-popup',
                    title: 'swal2-small-title',
                    content: 'swal2-small-content'
                }
            });
            
            if (result.isConfirmed) {
                // User clicked OK - logout and redirect
                await performLogout();
            } else if (result.dismiss === Swal.DismissReason.close) {
                // User clicked X button - disable transactions but don't logout
                this.sessionExpired = true;
                this.disableTransactions();
                this.warningShown = true;
            }
        },
        
        // Check session timeout and show warning
        async checkSessionTimeout() {
            if (!this.data.logged_in || !this.sessionStartTime) {
                return;
            }
            
            const SESSION_TIMEOUT = 3600000; // 1 hour in milliseconds
            const elapsed = Date.now() - this.sessionStartTime;
            
            // If session expired based on client-side time
            if (elapsed >= SESSION_TIMEOUT) {
                // Also verify with server
                try {
                    const res = await fetch('php/userSession.php', { cache: 'no-store' });
                    const json = await res.json();
                    if (!json.logged_in) {
                        // Session expired on server side
                        if (!this.warningShown) {
                            this.showSessionTimeoutWarning();
                        }
                    } else {
                        // Server says still logged in, reset timer (might be server-side refresh)
                        this.sessionStartTime = Date.now();
                        this.sessionExpired = false;
                        this.warningShown = false;
                        this.enableTransactions();
                    }
                } catch (e) {
                    // On error, assume expired if client-side time exceeded
                    if (!this.warningShown) {
                        this.showSessionTimeoutWarning();
                    }
                }
            }
        }
    };

    function ensureLoggingOutOverlayStyles() {
        if (document.getElementById('logging-out-fallback-css')) return;
        const st = document.createElement('style');
        st.id = 'logging-out-fallback-css';
        st.textContent =
            '#loggingOutOverlay.loading-overlay{position:fixed;inset:0;z-index:99999;display:flex;justify-content:center;align-items:center;background:rgba(255,255,255,0.95);backdrop-filter:blur(5px)}' +
            '#loggingOutOverlay .loading-content{text-align:center}' +
            '#loggingOutOverlay .loading-spinner-img{display:block;margin:0 auto 1.5rem;animation:richLogoutSpin 2s linear infinite}' +
            '#loggingOutOverlay.admin-dashboard-loading .loading-spinner-img{width:120px;max-width:min(120px,45vw);height:auto}' +
            '#loggingOutOverlay .loading-text{font-size:1.1rem;color:#000;font-weight:500;margin:0}' +
            '@keyframes richLogoutSpin{to{transform:rotate(360deg)}}';
        document.head.appendChild(st);
    }

    function showLoggingOutOverlay() {
        ensureLoggingOutOverlayStyles();
        let el = document.getElementById('loggingOutOverlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'loggingOutOverlay';
            el.className = 'loading-overlay admin-dashboard-loading';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            el.setAttribute('aria-busy', 'true');
            el.innerHTML =
                '<div class="loading-content">' +
                '<img src="Images/loading_circle.png" alt="" class="loading-spinner-img" width="120" height="120"/>' +
                '<p class="loading-text">Logging Out..</p>' +
                '</div>';
            document.body.appendChild(el);
        } else {
            const t = el.querySelector('.loading-text');
            if (t) t.textContent = 'Logging Out..';
        }
        el.classList.remove('hidden');
        el.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // Logout function that tracks logout in database
    async function performLogout() {
        showLoggingOutOverlay();

        // Get user email from localStorage (stored during login)
        let userEmail = localStorage.getItem('user_email') || '';
        
        // If not in localStorage, try to get from current session data
        if (!userEmail && Session.data && Session.data.logged_in && Session.data.email) {
            userEmail = Session.data.email;
            console.log('Logout - Using email from session data:', userEmail);
        }
        
        // If still not found, try to fetch from server
        if (!userEmail && Session.data && Session.data.logged_in) {
            try {
                const sessionRes = await fetch('php/userSession.php', { cache: 'no-store' });
                const sessionData = await sessionRes.json();
                if (sessionData.email) {
                    userEmail = sessionData.email;
                    console.log('Logout - Fetched email from server:', userEmail);
                }
            } catch (e) {
                console.error('Failed to get session data:', e);
            }
        }
        
        // Log for debugging
        console.log('Logout - User email from localStorage:', userEmail);
        console.log('Logout - Current session logged_in:', Session.data?.logged_in);
        
        if (!userEmail) {
            console.warn('Warning: No user email found in localStorage for logout. Session will be used as fallback.');
        }
        
        try {
            // Send logout request to server with email (even if empty, server will use session)
            const response = await fetch('php/logout.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: userEmail })
            });
            
            // Log response for debugging
            if (response.ok) {
                const result = await response.json();
                console.log('Logout successful for:', userEmail || 'session user', result);
            } else {
                const errorText = await response.text();
                console.error('Logout failed:', response.status, errorText);
            }
        } catch (e) {
            console.error('Logout tracking failed:', e);
        }
        
        // Clear stored email
        localStorage.removeItem('user_email');
        
        // Redirect to login page
        window.location.href = 'index.php';
    }

    // Automatic logout tracking removed - no automatic logout

    // Expose logout function globally
    window.performLogout = performLogout;
    
    // Expose Session object globally for checking session status
    window.Session = Session;

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', () => {
        Session.load();
        
        // Check session timeout every minute
        setInterval(async () => {
            if (Session.data.logged_in) {
                await Session.checkSessionTimeout();
            }
        }, 60000); // Check every minute
        
        // Periodic session refresh to keep session alive while user is active
        // Refresh every 2 minutes (120000 ms) to prevent timeout
        setInterval(async () => {
            if (Session.data.logged_in && document.visibilityState === 'visible' && !Session.sessionExpired) {
                try {
                    await Session.load(); // Refresh session to update last_activity
                } catch (e) {
                    console.error('Session refresh failed:', e);
                    // If session refresh fails, don't redirect immediately
                    // It might be a temporary network issue
                }
            }
        }, 120000); // 2 minutes = 120000 milliseconds
    });
    
    // Refresh session on page show (when user navigates back or after refresh)
    window.addEventListener('pageshow', (e) => {
        // Refresh the session to keep user logged in
        Session.load();
    });
    
    // Refresh session on user activity (mouse movement, clicks, keyboard)
    // This ensures session stays alive while user is actively working
    let activityTimeout = null;
    const refreshSessionOnActivity = () => {
        if (Session.data.logged_in && document.visibilityState === 'visible' && !Session.sessionExpired) {
            // Clear previous timeout
            if (activityTimeout) {
                clearTimeout(activityTimeout);
            }
            
            // Refresh session after 1 minute of activity (debounce)
            // This prevents too many requests but keeps session alive during active use
            activityTimeout = setTimeout(() => {
                if (Session.data.logged_in && document.visibilityState === 'visible' && !Session.sessionExpired) {
                    Session.load();
                }
            }, 60000); // 1 minute = 60000 milliseconds
        }
    };
    
    // Listen for user activity
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
        document.addEventListener(event, (e) => {
            // If session expired, show warning again when clicking functions
            if (Session.sessionExpired && Session.warningShown) {
                // Check if clicked element is a function button/link
                const target = e.target.closest('button, a, [onclick]');
                if (target && !target.classList.contains('logout-btn') && 
                    !target.classList.contains('session-allowed') &&
                    !target.closest('.swal2-container')) {
                    Session.showSessionTimeoutWarning();
                }
            } else {
                refreshSessionOnActivity();
            }
        }, { passive: true });
    });
})();


