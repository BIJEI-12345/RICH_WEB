/**
 * Barangay Ordinance — dedicated page (php/ordinance_policy.php)
 * Upload/delete: Admin only (matches dashboard). Others: view.
 */
(function () {
    const galleryRoot = document.getElementById('boGalleryRoot');
    const uploadSection = document.getElementById('boUploadSection');
    const uploadForm = document.getElementById('boUploadForm');
    const imageInput = document.getElementById('boImageInput');
    const previewWrap = document.getElementById('boFilePreview');
    const previewImg = document.getElementById('boPreviewImg');
    const pickImageBtn = document.getElementById('boPickImageBtn');
    const confirmActions = document.getElementById('boConfirmActions');
    const confirmUploadBtn = document.getElementById('boConfirmUploadBtn');
    const pickAnotherBtn = document.getElementById('boPickAnotherBtn');
    const clearPreviewBtn = document.getElementById('boClearPreviewBtn');

    let previewObjectUrl = null;
    let canManage = false;

    function notify(msg, isError) {
        if (typeof Swal !== 'undefined' && Swal.fire) {
            if (isError) {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'error',
                    title: msg,
                    showConfirmButton: false,
                    timer: 4500,
                    timerProgressBar: true
                });
            } else {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: msg,
                    showConfirmButton: false,
                    timer: 2800,
                    timerProgressBar: true
                });
            }
            return;
        }
        if (typeof showSuccessNotification === 'function') {
            showSuccessNotification(msg, isError ? 'error' : 'success');
            return;
        }
        console[isError ? 'error' : 'log'](msg);
    }

    function closeSwalIfOpen() {
        if (typeof Swal !== 'undefined' && Swal.isVisible && Swal.isVisible()) {
            Swal.close();
        }
    }

    window.navigateToOrdinanceDashboard = function navigateToOrdinanceDashboard() {
        const pos = (window.CurrentUser && window.CurrentUser.position) || '';
        const p = String(pos).trim().toLowerCase();
        window.location.href = p === 'admin' ? 'admin-dashboard.html' : 'document-dashboard.html';
    };

    function escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function formatTs(createdAt) {
        if (!createdAt) return '';
        const t = String(createdAt).replace(' ', 'T');
        const d = new Date(t);
        if (Number.isNaN(d.getTime())) return escapeHtml(String(createdAt));
        return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }

    function clearPreview() {
        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
            previewObjectUrl = null;
        }
        if (previewImg) previewImg.removeAttribute('src');
        if (previewWrap) previewWrap.hidden = true;
        if (confirmActions) confirmActions.hidden = true;
        if (imageInput) imageInput.value = '';
    }

    function galleryMediaInner(imgUrl, alt) {
        return (
            `<div class="bo-card-media bo-card-media--pending">` +
            `<div class="bo-img-status" role="status" aria-live="polite">` +
            `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>` +
            `<span>Loading image…</span>` +
            `</div>` +
            `<img src="${escapeHtml(imgUrl)}" class="bo-card-img" alt="${escapeHtml(alt)}" decoding="async">` +
            `</div>`
        );
    }

    function wireImageLoads(root) {
        if (!root) return;
        root.querySelectorAll('.bo-card-media').forEach((wrap) => {
            const img = wrap.querySelector('img.bo-card-img');
            const statusEl = wrap.querySelector('.bo-img-status');
            if (!img) return;

            const showLoaded = () => {
                wrap.classList.remove('bo-card-media--pending');
                wrap.classList.add('bo-card-media--loaded');
            };
            const showError = () => {
                wrap.classList.remove('bo-card-media--pending');
                wrap.classList.add('bo-card-media--error');
                if (statusEl) {
                    statusEl.innerHTML =
                        '<span><i class="fas fa-image" aria-hidden="true"></i> Hindi ma-load ang larawan.</span>';
                }
            };

            if (img.complete) {
                if (img.naturalWidth > 0) showLoaded();
                else showError();
                return;
            }
            img.addEventListener('load', showLoaded, { once: true });
            img.addEventListener('error', showError, { once: true });
        });
    }

    function wireCarousel(root) {
        if (!root) return;
        const track = root.querySelector('.bo-carousel-track');
        const prev = root.querySelector('.bo-carousel-prev');
        const next = root.querySelector('.bo-carousel-next');
        const thumbs = root.querySelectorAll('.bo-carousel-thumb');
        if (!track || !prev || !next) return;
        const slides = root.querySelectorAll('.bo-carousel-slide');
        const n = slides.length;
        if (n === 0) return;
        track.style.width = `${n * 100}%`;
        slides.forEach((slide) => {
            slide.style.flex = `0 0 ${100 / n}%`;
            slide.style.maxWidth = `${100 / n}%`;
        });
        let i = 0;
        let thumbScrollReady = false;
        const syncThumbs = () => {
            thumbs.forEach((btn, idx) => {
                const on = idx === i;
                btn.classList.toggle('bo-carousel-thumb--active', on);
                btn.setAttribute('aria-selected', on ? 'true' : 'false');
                if (on && thumbScrollReady) {
                    try {
                        btn.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
                    } catch (e) {
                        btn.scrollIntoView();
                    }
                }
            });
            thumbScrollReady = true;
        };
        const apply = () => {
            track.style.transform = `translateX(-${(i / n) * 100}%)`;
            prev.disabled = i <= 0;
            next.disabled = i >= n - 1;
            const showArrows = n > 1;
            prev.style.display = showArrows ? '' : 'none';
            next.style.display = showArrows ? '' : 'none';
            const navRow = root.querySelector('.bo-carousel-nav-row');
            if (navRow) navRow.style.display = showArrows ? '' : 'none';
            const strip = root.querySelector('.bo-carousel-thumbs');
            if (strip) strip.style.display = showArrows ? '' : 'none';
            syncThumbs();
        };
        thumbs.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                if (Number.isNaN(idx) || idx < 0 || idx >= n) return;
                i = idx;
                apply();
            });
        });
        prev.addEventListener('click', (e) => {
            e.stopPropagation();
            if (i > 0) {
                i -= 1;
                apply();
            }
        });
        next.addEventListener('click', (e) => {
            e.stopPropagation();
            if (i < n - 1) {
                i += 1;
                apply();
            }
        });
        apply();
    }

    function loadingMarkup() {
        return (
            '<div class="bo-loading" role="status" aria-live="polite">' +
            '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>' +
            '<span>Loading Barangay Ordinance…</span>' +
            '</div>'
        );
    }

    async function removeItem(idStr) {
        const id = parseInt(idStr, 10);
        if (Number.isNaN(id) || id < 1) return;
        let confirmed = false;
        if (typeof Swal !== 'undefined' && Swal.fire) {
            const result = await Swal.fire({
                title: 'Remove this entry?',
                text: 'This Barangay Ordinance image will be removed.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, remove',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#dc2626',
                cancelButtonColor: '#64748b',
                focusCancel: true,
                reverseButtons: true
            });
            confirmed = result.isConfirmed === true;
        } else {
            confirmed = window.confirm('Remove this entry?');
        }
        if (!confirmed) return;
        if (typeof Swal !== 'undefined' && Swal.fire) {
            Swal.fire({
                title: 'Removing...',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
        }
        try {
            const res = await fetch('php/ordinance_policy.php', {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'ordinance', id })
            });
            const data = await res.json().catch(() => ({}));
            closeSwalIfOpen();
            if (data.ok) {
                notify('Removed.');
                loadGallery();
            } else {
                notify(data.error || 'Delete failed', true);
            }
        } catch (e) {
            closeSwalIfOpen();
            notify('Network error.', true);
        }
    }

    async function loadGallery() {
        if (!galleryRoot) return;
        galleryRoot.innerHTML = loadingMarkup();
        try {
            const res = await fetch('php/ordinance_policy.php?list=ordinance', {
                credentials: 'same-origin',
                cache: 'no-store'
            });
            if (res.status === 401) {
                galleryRoot.innerHTML =
                    '<p class="bo-empty">Please log in to view Barangay Ordinance.</p>';
                return;
            }
            const data = await res.json().catch(() => ({}));
            if (!data.ok || !Array.isArray(data.items)) {
                galleryRoot.innerHTML = '<p class="bo-empty">Could not load Barangay Ordinance.</p>';
                return;
            }
            if (data.items.length === 0) {
                galleryRoot.innerHTML =
                    '<div class="bo-empty"><i class="fas fa-image" aria-hidden="true"></i>No ordinance images yet.</div>';
                return;
            }
            const cacheBust = Date.now();
            const slides = data.items
                .map((item) => {
                    const id = item.id;
                    const imgUrl = item.image + (item.image.indexOf('?') >= 0 ? '&' : '?') + 't=' + cacheBust;
                    const del = canManage
                        ? `<div class="bo-card-actions"><button type="button" class="bo-btn bo-btn--danger bo-remove-btn" data-id="${id}"><i class="fas fa-trash-alt" aria-hidden="true"></i> Remove</button></div>`
                        : '';
                    return `<div class="bo-carousel-slide">
                        <article class="bo-card">
                        ${galleryMediaInner(imgUrl, 'Barangay Ordinance')}
                        <div class="bo-card-meta">${formatTs(item.created_at)}</div>
                        ${del}
                    </article></div>`;
                })
                .join('');
            const thumbs = data.items
                .map((item, idx) => {
                    const imgUrl = item.image + (item.image.indexOf('?') >= 0 ? '&' : '?') + 't=' + cacheBust;
                    return (
                        `<button type="button" class="bo-carousel-thumb${idx === 0 ? ' bo-carousel-thumb--active' : ''}" ` +
                        `data-index="${idx}" role="tab" aria-selected="${idx === 0 ? 'true' : 'false'}" ` +
                        `aria-label="Page ${idx + 1}">` +
                        `<img src="${escapeHtml(imgUrl)}" alt="" loading="lazy" decoding="async">` +
                        `</button>`
                    );
                })
                .join('');
            galleryRoot.innerHTML =
                `<div class="bo-carousel" role="region" aria-label="Ordinance pages">` +
                `<div class="bo-carousel-main-stage">` +
                `<div class="bo-carousel-viewport">` +
                `<div class="bo-carousel-track">${slides}</div>` +
                `</div></div>` +
                `<div class="bo-carousel-thumbs" role="tablist">${thumbs}</div>` +
                `<div class="bo-carousel-nav-row">` +
                `<button type="button" class="bo-carousel-arrow bo-carousel-prev" aria-label="Previous page"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>` +
                `<button type="button" class="bo-carousel-arrow bo-carousel-next" aria-label="Next page"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>` +
                `</div></div>`;
            wireCarousel(galleryRoot.querySelector('.bo-carousel'));
            wireImageLoads(galleryRoot);
            galleryRoot.querySelectorAll('.bo-remove-btn').forEach((btn) => {
                btn.addEventListener('click', () => removeItem(btn.getAttribute('data-id')));
            });
        } catch (e) {
            galleryRoot.innerHTML = '<p class="bo-empty">Network error.</p>';
        }
    }

    function openImagePicker() {
        if (imageInput) imageInput.click();
    }

    async function performUpload() {
        if (!canManage || !uploadForm || !imageInput) return;
        const f = imageInput.files && imageInput.files[0];
        if (!f) {
            notify('Please choose an image first.', true);
            return;
        }
        const maxBytes = 10 * 1024 * 1024;
        if (f.size > maxBytes) {
            notify('Image must be 10MB or smaller.', true);
            return;
        }
        if (confirmUploadBtn) {
            confirmUploadBtn.disabled = true;
            if (pickAnotherBtn) pickAnotherBtn.disabled = true;
        }
        const fd = new FormData(uploadForm);
        fd.append('type', 'ordinance');
        if (typeof Swal !== 'undefined' && Swal.fire) {
            Swal.fire({
                title: 'Uploading...',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
        }
        try {
            const res = await fetch('php/ordinance_policy.php', {
                method: 'POST',
                body: fd,
                credentials: 'same-origin'
            });
            const data = await res.json().catch(() => ({}));
            closeSwalIfOpen();
            if (data.ok) {
                notify(data.message || 'Saved.');
                uploadForm.reset();
                clearPreview();
                loadGallery();
            } else {
                notify(data.error || 'Upload failed', true);
            }
        } catch (err) {
            closeSwalIfOpen();
            notify('Network error.', true);
        } finally {
            if (confirmUploadBtn) confirmUploadBtn.disabled = false;
            if (pickAnotherBtn) pickAnotherBtn.disabled = false;
        }
    }

    if (imageInput && previewWrap && previewImg) {
        imageInput.addEventListener('change', () => {
            if (previewObjectUrl) {
                URL.revokeObjectURL(previewObjectUrl);
                previewObjectUrl = null;
            }
            previewImg.removeAttribute('src');
            const f = imageInput.files && imageInput.files[0];
            if (!f) {
                previewWrap.hidden = true;
                if (confirmActions) confirmActions.hidden = true;
                return;
            }
            previewObjectUrl = URL.createObjectURL(f);
            previewImg.src = previewObjectUrl;
            previewWrap.hidden = false;
            if (confirmActions) confirmActions.hidden = false;
        });
    }

    if (pickImageBtn) {
        pickImageBtn.addEventListener('click', () => openImagePicker());
    }

    if (clearPreviewBtn) {
        clearPreviewBtn.addEventListener('click', () => clearPreview());
    }

    if (pickAnotherBtn && imageInput) {
        pickAnotherBtn.addEventListener('click', () => {
            if (previewObjectUrl) {
                URL.revokeObjectURL(previewObjectUrl);
                previewObjectUrl = null;
            }
            if (previewImg) previewImg.removeAttribute('src');
            if (previewWrap) previewWrap.hidden = true;
            if (confirmActions) confirmActions.hidden = true;
            imageInput.value = '';
            openImagePicker();
        });
    }

    if (confirmUploadBtn) {
        confirmUploadBtn.addEventListener('click', () => performUpload());
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
        });
    }

    document.addEventListener('DOMContentLoaded', async function () {
        if (typeof window.Session !== 'undefined' && typeof window.Session.load === 'function') {
            try {
                await window.Session.load();
            } catch (err) {
                /* continue */
            }
        }
        const u = window.CurrentUser || (window.Session && window.Session.data) || {};
        const pos = String(u.position || '').trim().toLowerCase();
        canManage = pos === 'admin';

        if (uploadSection) {
            uploadSection.hidden = !canManage;
        }

        if (!u.logged_in) {
            if (galleryRoot) {
                galleryRoot.innerHTML =
                    '<p class="bo-empty">Please log in to view Barangay Ordinance.</p>';
            }
            return;
        }

        loadGallery();
    });
})();
