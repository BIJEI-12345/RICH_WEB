// Simple user session + access control helper
;(function(){
    const Session = {
        data: { logged_in: false, name: null, position: null },
        async load() {
            try {
                const res = await fetch('php/userSession.php', { cache: 'no-store' });
                const json = await res.json();
                this.data = json || { logged_in: false };
                window.CurrentUser = this.data;
                this.applyVisibilityByPage();
                
                // No automatic logout - session stays alive
            } catch (e) {
                console.error('Failed to load session', e);
                // On error, don't redirect immediately - might be network issue
            }
        },
        canEditModule(moduleName) {
            const pos = (this.data.position || '').toLowerCase();
            if (!pos) return false;
            // Admin: full access everywhere
            if (pos === 'admin') return true;
            // Rules:
            // - "document request category": full buttons in reqDocu, view-only in concerns/emergency
            // - "concerns & reporting" or "emergency": full buttons in concerns/emergency, view-only in reqDocu
            if (moduleName === 'reqDocu') {
                if (pos === 'document request category') return true;
                if (pos === 'concerns & reporting' || pos === 'emergency' || pos === 'emergency category') return false;
            }
            if (moduleName === 'concerns' || moduleName === 'emergency') {
                if (pos === 'document request category') return false;
                if (pos === 'concerns & reporting' || pos === 'emergency' || pos === 'emergency category') return true;
            }
            return false;
        },
        canSeeUserManagement() {
            const pos = (this.data.position || '').toLowerCase();
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
            // Only Admin sees Analytics
            return pos === 'admin';
        },
        applyVisibilityByPage() {
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
                        const actionButtons = document.querySelectorAll('.request-card .process-btn, .request-card .finish-btn, .request-card .print-btn');
                        actionButtons.forEach(btn => {
                            if (!btn) return;
                            // Skip admin buttons - don't hide them
                            if (btn.classList.contains('admin-visible')) return;
                            // Keep layout square by hiding visually but preserving space
                            btn.style.visibility = 'hidden';
                            btn.style.pointerEvents = 'none';
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
        }
    };

    // Logout function that tracks logout in database
    async function performLogout() {
        
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
        window.location.href = 'index.html';
    }

    // Automatic logout tracking removed - no automatic logout

    // Expose logout function globally
    window.performLogout = performLogout;

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', () => {
        Session.load();
        
        // Periodic session refresh to keep session alive while user is active
        // Refresh every 2 minutes (120000 ms) to prevent timeout
        setInterval(async () => {
            if (Session.data.logged_in && document.visibilityState === 'visible') {
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
        if (Session.data.logged_in && document.visibilityState === 'visible') {
            // Clear previous timeout
            if (activityTimeout) {
                clearTimeout(activityTimeout);
            }
            
            // Refresh session after 1 minute of activity (debounce)
            // This prevents too many requests but keeps session alive during active use
            activityTimeout = setTimeout(() => {
                if (Session.data.logged_in && document.visibilityState === 'visible') {
                    Session.load();
                }
            }, 60000); // 1 minute = 60000 milliseconds
        }
    };
    
    // Listen for user activity
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
        document.addEventListener(event, refreshSessionOnActivity, { passive: true });
    });
})();


