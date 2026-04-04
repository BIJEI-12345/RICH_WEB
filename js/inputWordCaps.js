/**
 * Auto title-case per word while typing: "dela cruz" -> "Dela Cruz".
 * Add class "word-caps" to text inputs or textareas. Use "no-word-caps" to opt out.
 */
(function () {
    function capitalizeEachWord(str) {
        return str.replace(/[^\s]+/g, function (word) {
            if (!word.length) {
                return word;
            }
            return word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase();
        });
    }

    function shouldHandle(el) {
        if (!el || el.readOnly || el.disabled) {
            return false;
        }
        if (el.classList && el.classList.contains('no-word-caps')) {
            return false;
        }
        if (!el.classList || !el.classList.contains('word-caps')) {
            return false;
        }
        const tag = el.tagName;
        if (tag === 'TEXTAREA') {
            return true;
        }
        if (tag !== 'INPUT') {
            return false;
        }
        const t = (el.type || 'text').toLowerCase();
        return t === 'text' || t === 'search';
    }

    document.addEventListener(
        'input',
        function (e) {
            const el = e.target;
            if (!shouldHandle(el)) {
                return;
            }
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const oldVal = el.value;
            const newVal = capitalizeEachWord(oldVal);
            if (oldVal === newVal) {
                return;
            }
            el.value = newVal;
            try {
                if (typeof start === 'number' && typeof end === 'number') {
                    el.setSelectionRange(start, end);
                }
            } catch (_) {}
        },
        true
    );
})();
