// Google reviews carousel.
//
// The real reviews are already in the page HTML (works without JS, and is what
// crawlers see). This script:
//   1. turns that markup into a working carousel (arrows, dots, swipe, autoplay)
//   2. asks /api/google-reviews for live data and swaps it in when available
// If the API is unconfigured or unreachable the HTML reviews just stay as they are.
(function () {
    'use strict';

    var API = '/api/google-reviews';
    var GOOGLE_URL = /^https:\/\/(www\.|maps\.)?google\.com\//;
    var AUTOPLAY_MS = 6500;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var G_SVG =
        '<svg class="greview-g" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
        '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
        '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
        '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
        '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
        '</svg>';

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    function initials(name) {
        var parts = String(name).trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return 'G';
        var a = parts[0].charAt(0);
        var b = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
        return (a + b).toUpperCase();
    }

    function monthYear(iso) {
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        try { return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
        catch (e) { return ''; }
    }

    // ---- live render --------------------------------------------------------

    function buildCard(r) {
        var card = el('article', 'greview');
        card.setAttribute('aria-label', 'Google review by ' + r.author);

        var head = el('div', 'greview-head');
        head.appendChild(el('span', 'greview-avatar', initials(r.author)));

        var who = el('div', 'greview-who');
        var name;
        if (r.authorUrl && GOOGLE_URL.test(r.authorUrl)) {
            name = el('a', 'greview-name', r.author);
            name.href = r.authorUrl;
            name.target = '_blank';
            name.rel = 'noopener noreferrer';
        } else {
            name = el('span', 'greview-name', r.author);
        }
        who.appendChild(name);
        var when = r.publishedAt ? monthYear(r.publishedAt) : '';
        who.appendChild(el('span', 'greview-meta', when ? 'Google review · ' + when : 'Google review'));
        head.appendChild(who);
        head.insertAdjacentHTML('beforeend', G_SVG);
        card.appendChild(head);

        var n = Math.max(1, Math.min(5, r.rating | 0));
        var stars = el('div', 'greview-stars', '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n));
        stars.setAttribute('role', 'img');
        stars.setAttribute('aria-label', n + ' out of 5 stars');
        card.appendChild(stars);

        var quote = el('blockquote', 'greview-text', r.text);
        card.appendChild(quote);
        return card;
    }

    function renderLive(root, data) {
        var track = root.querySelector('.greviews-track');
        if (!track) return;

        var cards = [];
        data.reviews.forEach(function (r) {
            if (r && typeof r.text === 'string' && r.text && typeof r.author === 'string') cards.push(buildCard(r));
        });
        if (!cards.length) return;

        while (track.firstChild) track.removeChild(track.firstChild);
        cards.forEach(function (c) { track.appendChild(c); });

        // Header summary line(s) on the page.
        var section = root.closest('section') || document;
        var summary = section.querySelectorAll('[data-greviews-summary]');
        if (typeof data.rating === 'number' && data.count > 0) {
            var text = 'Rated ' + data.rating.toFixed(1) + ' on Google from ' + data.count +
                (data.count === 1 ? ' review.' : ' reviews.');
            for (var i = 0; i < summary.length; i++) summary[i].textContent = text;
        }
        // Short rating lines elsewhere on the page (e.g. the homepage hero) stay truthful too.
        if (typeof data.rating === 'number' && data.count > 0) {
            var short = document.querySelectorAll('[data-greviews-rating]');
            for (var j = 0; j < short.length; j++) short[j].textContent = 'Rated ' + data.rating.toFixed(1) + ' on Google';
        }
        if (data.url && GOOGLE_URL.test(data.url)) {
            var link = root.querySelector('.greviews-all');
            if (link) link.href = data.url;
        }

        decorate(root);
        track.scrollTo ? track.scrollTo({ left: 0, behavior: 'auto' }) : (track.scrollLeft = 0);
        root.dispatchEvent(new CustomEvent('greviews:updated'));
    }

    function load(root) {
        if (!('fetch' in window)) return;
        var ctl = 'AbortController' in window ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 7000);
        fetch(API, { headers: { Accept: 'application/json' }, signal: ctl ? ctl.signal : undefined })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('bad status')); })
            .then(function (d) {
                if (d && d.source === 'google' && Array.isArray(d.reviews) && d.reviews.length) renderLive(root, d);
            })
            .catch(function () { /* keep the reviews already in the HTML */ })
            .then(function () { clearTimeout(timer); });
    }

    // ---- carousel behaviour -------------------------------------------------

    function cardsOf(track) {
        return Array.prototype.slice.call(track.querySelectorAll('.greview'));
    }

    function decorate(root) {
        var track = root.querySelector('.greviews-track');
        var dotsBox = root.querySelector('.greviews-dots');
        if (!track || !dotsBox) return;

        // Handlers always look cards up fresh, so they keep working after a live swap.
        function goTo(i) {
            var cards = cardsOf(track);
            var c = cards[i];
            if (c) track.scrollTo({ left: c.offsetLeft - cards[0].offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
        }
        function currentIndex() {
            var cards = cardsOf(track);
            if (!cards.length) return 0;
            var x = track.scrollLeft, best = 0, bestDist = Infinity;
            cards.forEach(function (c, i) {
                var dist = Math.abs((c.offsetLeft - cards[0].offsetLeft) - x);
                if (dist < bestDist) { best = i; bestDist = dist; }
            });
            return best;
        }
        function paintDots() {
            var idx = currentIndex();
            var dots = dotsBox.children;
            for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('is-active', i === idx);
        }
        function atEnd() { return track.scrollLeft + track.clientWidth >= track.scrollWidth - 4; }
        function step(dir) {
            var cards = cardsOf(track);
            if (!cards.length) return;
            if (dir > 0 && atEnd()) return goTo(0);
            if (dir < 0 && track.scrollLeft <= 4) return goTo(cards.length - 1);
            var w = cards[0].getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 20);
            track.scrollBy({ left: dir * w, behavior: reduceMotion ? 'auto' : 'smooth' });
        }

        // "Read more" for long reviews (runs on every decorate: initial + after live swap).
        cardsOf(track).forEach(function (card) {
            if (card.querySelector('.greview-more')) return;
            var q = card.querySelector('.greview-text');
            if (!q || q.scrollHeight <= q.clientHeight + 1) return;
            var btn = el('button', 'greview-more', 'Read more');
            btn.type = 'button';
            btn.setAttribute('aria-expanded', 'false');
            btn.addEventListener('click', function () {
                var open = card.classList.toggle('is-expanded');
                btn.textContent = open ? 'Show less' : 'Read more';
                btn.setAttribute('aria-expanded', String(open));
            });
            card.appendChild(btn);
        });

        // Dots (one per review), rebuilt each time the card set changes.
        while (dotsBox.firstChild) dotsBox.removeChild(dotsBox.firstChild);
        cardsOf(track).forEach(function (card, i) {
            var d = el('button', 'greviews-dot');
            d.type = 'button';
            d.setAttribute('aria-label', 'Go to review ' + (i + 1));
            d.addEventListener('click', function () { goTo(i); });
            dotsBox.appendChild(d);
        });

        // One-time wiring.
        if (!root.__greviewsBound) {
            root.__greviewsBound = true;
            var prev = root.querySelector('.greviews-prev');
            var next = root.querySelector('.greviews-next');
            if (prev) prev.addEventListener('click', function () { step(-1); });
            if (next) next.addEventListener('click', function () { step(1); });
            track.addEventListener('scroll', function () { window.requestAnimationFrame(paintDots); }, { passive: true });
            track.addEventListener('keydown', function (e) {
                if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
            });
            window.addEventListener('resize', paintDots);

            // Autoplay: only while visible, never under reduced-motion, paused on interaction.
            if (!reduceMotion) {
                var paused = false, visible = false;
                var pause = function () { paused = true; };
                var resume = function () { paused = false; };
                ['mouseenter', 'focusin', 'touchstart', 'pointerdown'].forEach(function (ev) { root.addEventListener(ev, pause, { passive: true }); });
                ['mouseleave', 'focusout', 'touchend'].forEach(function (ev) { root.addEventListener(ev, resume, { passive: true }); });
                if ('IntersectionObserver' in window) {
                    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }, { threshold: 0.35 }).observe(root);
                } else { visible = true; }
                setInterval(function () {
                    if (!paused && visible && !document.hidden) step(1);
                }, AUTOPLAY_MS);
            }
        }

        root.classList.add('is-ready');
        paintDots();
    }

    function init() {
        var roots = document.querySelectorAll('[data-google-reviews]');
        for (var i = 0; i < roots.length; i++) {
            decorate(roots[i]);
            load(roots[i]);
        }
    }

    // Exposed for testing.
    window.FCCGoogleReviews = { render: renderLive, init: init };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
