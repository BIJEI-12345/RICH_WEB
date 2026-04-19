/**
 * Full Disclosure Policy Board — dedicated page (php/ordinance_policy.php)
 * Same viewer/upload UX as Barangay Ordinance; resident feedback per selected image.
 */
(function () {
    const galleryRoot = document.getElementById('fpGalleryRoot');
    const feedbackSection = document.getElementById('fpFeedbackSection');
    const feedbackRoot = document.getElementById('fpFeedbackRoot');
    const uploadSection = document.getElementById('fpUploadSection');
    const uploadForm = document.getElementById('fpUploadForm');
    const imageInput = document.getElementById('fpImageInput');
    const previewWrap = document.getElementById('fpFilePreview');
    const previewImg = document.getElementById('fpPreviewImg');
    const pickImageBtn = document.getElementById('fpPickImageBtn');
    const confirmActions = document.getElementById('fpConfirmActions');
    const confirmUploadBtn = document.getElementById('fpConfirmUploadBtn');
    const pickAnotherBtn = document.getElementById('fpPickAnotherBtn');
    const clearPreviewBtn = document.getElementById('fpClearPreviewBtn');

    let previewObjectUrl = null;
    let canManage = false;
    let showResidentFeedback = false;
    let policyItems = [];

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

    window.navigateToPolicyDashboard = function navigateToPolicyDashboard() {
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

    function starsDisplayHtml(rating) {
        const raw = parseInt(rating, 10);
        const r = raw >= 1 && raw <= 5 ? raw : 0;
        if (r === 0) {
            return '<span class="doc-feedback-stars-row doc-feedback-stars-row--empty">—</span>';
        }
        const parts = [];
        for (let i = 1; i <= 5; i++) {
            parts.push(
                `<span class="doc-feedback-star ${i <= r ? 'doc-feedback-star--on' : 'doc-feedback-star--off'}">★</span>`
            );
        }
        return `<span class="doc-feedback-stars-row" aria-label="${r} of 5 stars">${parts.join('')}</span>`;
    }

    function renderPolicyFeedbacks(feedbacks) {
        const list = Array.isArray(feedbacks) ? feedbacks : [];
        if (list.length === 0) {
            return '<p class="doc-feedback-empty">No resident feedback yet.</p>';
        }
        return (
            '<ul class="doc-feedback-list">' +
            list
                .map((f) => {
                    return `<li class="doc-feedback-item">
                        <div class="doc-feedback-stars-wrap">${starsDisplayHtml(f.rating)}</div>
                        <div class="doc-feedback-text">${escapeHtml(String(f.comment || ''))}</div>
                        <div class="doc-feedback-when">${formatTs(f.created_at)}</div>
                    </li>`;
                })
                .join('') +
            '</ul>'
        );
    }

    function renderResidentFeedbackForm(policyId) {
        const starBtns = [1, 2, 3, 4, 5]
            .map(
                (n) =>
                    `<button type="button" class="doc-star doc-star--off" data-value="${n}" aria-label="${n} of 5 stars" aria-pressed="false">★</button>`
            )
            .join('');
        return `<form class="doc-policy-feedback-form" data-policy-id="${policyId}">
            <div class="doc-feedback-form-title">Leave feedback (resident)</div>
            <div class="field">
                <label for="policyFbComment_${policyId}">Comment</label>
                <textarea id="policyFbComment_${policyId}" class="doc-policy-fb-comment" rows="2" required placeholder="Your comment…"></textarea>
            </div>
            <div class="field doc-star-field">
                <span class="doc-star-field-label" id="policyFbRatingLabel_${policyId}">Rating — choose 1 to 5 stars</span>
                <div class="doc-star-rating" role="radiogroup" aria-labelledby="policyFbRatingLabel_${policyId}">
                    <div class="doc-star-row">${starBtns}</div>
                    <input type="hidden" class="doc-policy-fb-rating" value="" autocomplete="off">
                </div>
            </div>
            <button type="submit" class="bo-btn bo-btn--primary doc-policy-fb-submit">Submit</button>
        </form>`;
    }

    function updateFeedbackPanel(slideIndex) {
        if (!feedbackRoot || !feedbackSection) return;
        if (!policyItems.length) {
            feedbackSection.hidden = true;
            feedbackRoot.innerHTML = '';
            return;
        }
        const i = Math.max(0, Math.min(slideIndex, policyItems.length - 1));
        const item = policyItems[i];
        const feedbackSectionHtml = `<div class="doc-feedback-section">
            <div class="doc-feedback-section-title">Resident feedback</div>
            ${renderPolicyFeedbacks(item.feedbacks)}
            ${showResidentFeedback ? renderResidentFeedbackForm(item.id) : ''}
        </div>`;
        feedbackRoot.innerHTML = feedbackSectionHtml;
        feedbackSection.hidden = false;
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
                        '<span><i class="fas fa-image" aria-hidden="true"></i> Could not load image.</span>';
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

    function wireCarousel(root, onIndexChange) {
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
            if (typeof onIndexChange === 'function') onIndexChange(i);
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
            '<span>Loading Full Disclosure Policy Board…</span>' +
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
                text: 'This policy board image will be removed.',
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
                body: JSON.stringify({ type: 'policy', id })
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
        policyItems = [];
        galleryRoot.innerHTML = loadingMarkup();
        updateFeedbackPanel(0);
        try {
            const res = await fetch('php/ordinance_policy.php?list=policy', {
                credentials: 'same-origin',
                cache: 'no-store'
            });
            if (res.status === 401) {
                galleryRoot.innerHTML =
                    '<p class="bo-empty">Please log in to view Full Disclosure Policy Board.</p>';
                updateFeedbackPanel(0);
                return;
            }
            const data = await res.json().catch(() => ({}));
            if (!data.ok || !Array.isArray(data.items)) {
                galleryRoot.innerHTML = '<p class="bo-empty">Could not load Full Disclosure Policy Board.</p>';
                updateFeedbackPanel(0);
                return;
            }
            policyItems = data.items;
            if (data.items.length === 0) {
                galleryRoot.innerHTML =
                    '<div class="bo-empty"><i class="fas fa-image" aria-hidden="true"></i>No policy board images yet.</div>';
                updateFeedbackPanel(0);
                return;
            }
            const cacheBust = Date.now();
            const slides = data.items
                .map((item) => {
                    const id = item.id;
                    const imgUrl = item.image + (item.image.indexOf('?') >= 0 ? '&' : '?') + 't=' + cacheBust;
                    const del = canManage
                        ? `<div class="bo-card-actions"><button type="button" class="bo-btn bo-btn--danger fp-remove-btn" data-id="${id}"><i class="fas fa-trash-alt" aria-hidden="true"></i> Remove</button></div>`
                        : '';
                    return `<div class="bo-carousel-slide">
                        <article class="bo-card">
                        ${galleryMediaInner(imgUrl, 'Full Disclosure Policy Board')}
                        <div class="bo-card-meta">Uploaded: ${formatTs(item.created_at)}</div>
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
                `<div class="bo-carousel" role="region" aria-label="Policy board pages">` +
                `<div class="bo-carousel-main-stage">` +
                `<div class="bo-carousel-viewport">` +
                `<div class="bo-carousel-track">${slides}</div>` +
                `</div></div>` +
                `<div class="bo-carousel-thumbs" role="tablist">${thumbs}</div>` +
                `<div class="bo-carousel-nav-row">` +
                `<button type="button" class="bo-carousel-arrow bo-carousel-prev" aria-label="Previous page"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>` +
                `<button type="button" class="bo-carousel-arrow bo-carousel-next" aria-label="Next page"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>` +
                `</div></div>`;
            wireCarousel(galleryRoot.querySelector('.bo-carousel'), (idx) => updateFeedbackPanel(idx));
            wireImageLoads(galleryRoot);
            galleryRoot.querySelectorAll('.fp-remove-btn').forEach((btn) => {
                btn.addEventListener('click', () => removeItem(btn.getAttribute('data-id')));
            });
        } catch (e) {
            galleryRoot.innerHTML = '<p class="bo-empty">Network error.</p>';
            updateFeedbackPanel(0);
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
        fd.append('type', 'policy');
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

    if (feedbackRoot) {
        feedbackRoot.addEventListener('click', (e) => {
            const btn = e.target.closest('.doc-star');
            if (!btn || !feedbackRoot.contains(btn)) return;
            const wrap = btn.closest('.doc-star-rating');
            if (!wrap) return;
            const val = parseInt(btn.getAttribute('data-value'), 10);
            if (Number.isNaN(val) || val < 1 || val > 5) return;
            const hidden = wrap.querySelector('.doc-policy-fb-rating');
            if (hidden) hidden.value = String(val);
            wrap.querySelectorAll('.doc-star').forEach((s) => {
                const n = parseInt(s.getAttribute('data-value'), 10);
                const on = n <= val;
                s.classList.toggle('doc-star--on', on);
                s.classList.toggle('doc-star--off', !on);
                s.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
        });

        feedbackRoot.addEventListener('submit', async (e) => {
            const form = e.target.closest('.doc-policy-feedback-form');
            if (!form || !feedbackRoot.contains(form)) return;
            e.preventDefault();
            if (!showResidentFeedback) return;
            const pid = parseInt(form.getAttribute('data-policy-id'), 10);
            const commentEl = form.querySelector('.doc-policy-fb-comment');
            const comment = (commentEl && commentEl.value.trim()) || '';
            const ratingRaw = form.querySelector('.doc-policy-fb-rating') && form.querySelector('.doc-policy-fb-rating').value;
            const rating = parseInt(ratingRaw, 10);
            if (!comment) {
                notify('Please enter a comment.', true);
                return;
            }
            if (Number.isNaN(rating) || rating < 1 || rating > 5) {
                notify('Choose a rating from 1 to 5.', true);
                return;
            }
            const btn = form.querySelector('.doc-policy-fb-submit');
            if (btn) btn.disabled = true;
            try {
                const res = await fetch('php/ordinance_policy.php', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'policy_feedback',
                        policy_board_id: pid,
                        comment: comment,
                        rating: rating
                    })
                });
                const data = await res.json().catch(() => ({}));
                if (data.ok) {
                    notify(data.message || 'Feedback saved.');
                    loadGallery();
                } else {
                    notify(data.error || 'Could not save feedback.', true);
                }
            } catch (err) {
                notify('Network error.', true);
            } finally {
                if (btn) btn.disabled = false;
            }
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
        showResidentFeedback = !!(u.logged_in && !canManage);

        if (uploadSection) {
            uploadSection.hidden = !canManage;
        }

        if (!u.logged_in) {
            policyItems = [];
            if (galleryRoot) {
                galleryRoot.innerHTML =
                    '<p class="bo-empty">Please log in to view Full Disclosure Policy Board.</p>';
            }
            if (feedbackSection) feedbackSection.hidden = true;
            return;
        }

        loadGallery();
    });
})();
