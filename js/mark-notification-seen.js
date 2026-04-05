/**
 * Marks an admin notification category as seen (clears unread count for that category).
 * Include with: <script src="js/mark-notification-seen.js" defer></script>
 * and add data-notif-category="docu|concerns|emergency|user_mgmt" on the same script tag.
 */
(function () {
    function getCategory() {
        var scripts = document.getElementsByTagName('script');
        for (var i = scripts.length - 1; i >= 0; i--) {
            var s = scripts[i];
            if (!s.src || s.src.indexOf('mark-notification-seen.js') === -1) {
                continue;
            }
            var c = s.getAttribute('data-notif-category');
            return c ? String(c).trim() : '';
        }
        return '';
    }

    document.addEventListener('DOMContentLoaded', function () {
        var category = getCategory();
        if (!category) {
            return;
        }
        fetch('php/mark_notification_seen.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: category })
        }).catch(function () {});
    });
})();
