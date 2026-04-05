<?php
/**
 * Which notification categories a user may see (matches dashboard / route access).
 * User Management alerts: Admin only.
 *
 * @param string|null $position Session position (e.g. Admin, Document Request Category)
 * @return string[] Category ids: docu, concerns, emergency, user_mgmt
 */
function rich_notification_categories_for_position($position) {
    $p = strtolower(trim((string) $position));
    if ($p === '' || $p === 'mother leader') {
        return [];
    }
    if ($p === 'admin') {
        return ['docu', 'concerns', 'emergency', 'user_mgmt'];
    }
    // One notification category per department role (matches signup / userSession positions)
    if ($p === 'document request category') {
        return ['docu'];
    }
    if ($p === 'concerns & reporting') {
        return ['concerns'];
    }
    if ($p === 'emergency category' || $p === 'emergency') {
        return ['emergency'];
    }
    return [];
}

/**
 * @param string|null $position
 * @param string $category One of docu, concerns, emergency, user_mgmt
 */
function rich_notification_category_allowed_for_position($position, $category) {
    $allowed = rich_notification_categories_for_position($position);
    return in_array($category, $allowed, true);
}
