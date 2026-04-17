'use strict';

/* ==========================================================================
   Getting Started Guide - Visual Effects & UI Polish
   ========================================================================== */

/* ==========================================================================
   CTA BUTTON ATTENTION GRABBER + MAGNETIC CURSOR
   ========================================================================== */

(function () {
    var anims = ['btn-anim-wiggle', 'btn-anim-breathe', 'btn-anim-bounce'];
    var magnetDone = false;
    var ctaClicked = false;

    function getBtn() { return document.getElementById('btn-send-step1'); }

    // Periodic wiggle/breathe/bounce every 4-8s
    function scheduleAnim() {
        if (ctaClicked) return;
        var delay = 4000 + Math.random() * 4000;
        setTimeout(function () {
            var btn = getBtn();
            if (!btn || ctaClicked) return;
            var cls = anims[Math.floor(Math.random() * anims.length)];
            btn.classList.add(cls);
            btn.addEventListener('animationend', function handler() {
                btn.classList.remove(cls);
                btn.removeEventListener('animationend', handler);
            });
            scheduleAnim();
        }, delay);
    }

    // Magnetic cursor gag - fake cursor slides toward button, then clicks
    function scheduleMagnet() {
        if (magnetDone || ctaClicked) return;
        // Run once, 12-18s after page load
        var delay = 12000 + Math.random() * 6000;
        setTimeout(function () {
            if (ctaClicked) return;
            var btn = getBtn();
            if (!btn) return;
            runMagnetGag(btn);
        }, delay);
    }

    function runMagnetGag(btn) {
        magnetDone = true;
        var cursor = document.getElementById('fake-cursor');

        // Capture initial offset from button to compute start position
        var initRect = btn.getBoundingClientRect();
        var offsetX = (Math.random() > 0.5 ? 1 : -1) * (200 + Math.random() * 150);
        var offsetY = -100 - Math.random() * 100;

        cursor.style.left = (initRect.left + initRect.width / 2 - 5 + offsetX) + 'px';
        cursor.style.top = (initRect.top + initRect.height / 2 - 3 + offsetY) + 'px';
        cursor.style.opacity = '1';

        var duration = 1200;
        var start = Date.now();

        function ease(t) {
            return t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }

        function step() {
            var elapsed = Date.now() - start;
            var t = Math.min(1, elapsed / duration);
            var e = ease(t);

            // Recalculate target every frame to track scrolling
            var rect = btn.getBoundingClientRect();
            var targetX = rect.left + rect.width / 2 - 5;
            var targetY = rect.top + rect.height / 2 - 3;
            var startX = targetX + offsetX;
            var startY = targetY + offsetY;

            // Wobble: small sine wave perpendicular to path
            var wobbleX = Math.sin(t * Math.PI * 5) * (1 - t) * 12;
            var wobbleY = Math.cos(t * Math.PI * 3) * (1 - t) * 6;

            var x = startX + (targetX - startX) * e + wobbleX;
            var y = startY + (targetY - startY) * e + wobbleY;

            cursor.style.left = x + 'px';
            cursor.style.top = y + 'px';

            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                // "Click" the button
                btn.classList.add('btn-anim-bounce');
                btn.addEventListener('animationend', function handler() {
                    btn.classList.remove('btn-anim-bounce');
                    btn.removeEventListener('animationend', handler);
                });

                // Fade cursor out after a beat
                setTimeout(function () {
                    cursor.style.opacity = '0';
                }, 400);
            }
        }
        requestAnimationFrame(step);
    }

    // Stop animations once step 1 is actually clicked
    var origSendStep = window.sendStep;
    window.sendStep = function (step) {
        if (step === 1) ctaClicked = true;
        return origSendStep.apply(this, arguments);
    };

    // Also stop on cheat
    var origCheat = window.cheatCreateSession;
    window.cheatCreateSession = function () {
        ctaClicked = true;
        return origCheat.apply(this, arguments);
    };

    // Start after DOM ready
    $(function () {
        scheduleAnim();
        scheduleMagnet();
    });
})();

/* ==========================================================================
   STICKY CARD HEADERS - detect stuck state
   ========================================================================== */

(function () {
    // Use scroll event to detect when sticky headers are stuck
    function checkStuck() {
        var headers = document.querySelectorAll('.card-insign .card-header');
        for (var i = 0; i < headers.length; i++) {
            var h = headers[i];
            var rect = h.getBoundingClientRect();
            // Stuck when top is at 0 (or very close) and parent card extends below
            var cardRect = h.closest('.card-insign');
            if (cardRect) {
                var cr = cardRect.getBoundingClientRect();
                var isStuck = rect.top <= 1 && cr.bottom > rect.bottom + 20;
                if (isStuck) {
                    h.classList.add('stuck');
                } else {
                    h.classList.remove('stuck');
                }
            }
        }
    }
    window.addEventListener('scroll', function () {
        requestAnimationFrame(checkStuck);
    }, { passive: true });
})();

/* ==========================================================================
   FEATURE SHOWCASE - scroll-linked highlight + screenshot swap
   ========================================================================== */

(function () {
    var items = document.querySelectorAll('.feature-item');
    var container = document.getElementById('feature-preview-inner');
    if (!items.length || !container) return;

    var imgs = container.querySelectorAll('img');
    var frontIdx = 0; // which of the 2 imgs is currently visible
    var currentIdx = 0;
    var swapping = false;

    function activateItem(idx) {
        if (idx === currentIdx && items[idx].classList.contains('active')) return;
        currentIdx = idx;
        for (var i = 0; i < items.length; i++) {
            items[i].classList.toggle('active', i === idx);
        }
        // Crossfade to new screenshot
        var newSrc = items[idx].getAttribute('data-screenshot');
        var front = imgs[frontIdx];
        if (!newSrc || swapping || front.src.indexOf(newSrc) !== -1) return;

        swapping = true;
        var backIdx = 1 - frontIdx;
        var back = imgs[backIdx];

        // Preload new image in the hidden layer
        back.src = newSrc;
        back.onload = function () {
            // Crossfade: bring back to front
            back.classList.add('fp-active');
            front.classList.remove('fp-active');
            frontIdx = backIdx;
            swapping = false;
        };
        // Fallback if onload doesn't fire (cached)
        if (back.complete) {
            back.classList.add('fp-active');
            front.classList.remove('fp-active');
            frontIdx = backIdx;
            swapping = false;
        }
    }

    // Click to select
    for (var i = 0; i < items.length; i++) {
        (function (idx) {
            items[idx].addEventListener('click', function () { activateItem(idx); });
        })(i);
    }

    // Click screenshot -> open explorer
    container.addEventListener('click', function () {
        window.open('explorer.html', '_blank');
    });
})();

/* ==========================================================================
   SCROLL REVEAL - Intersection Observer
   ========================================================================== */

(function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Step containers with Monaco editors must never get exit animations
    // (scale/translate transitions continuously resize editors, causing layout loops)
    var noExitIds = { step1: 1, step2: 1, step3: 1, step4: 1 };

    var observer = window._scrollRevealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            var el = entry.target;
            if (entry.isIntersecting) {
                // Element entering viewport
                el.classList.add('revealed');
                el.classList.remove('reveal-exit-up', 'reveal-exit-down', 'reveal-exit-fade');
                // Once a step with editors is revealed, stop observing it
                if (noExitIds[el.id]) observer.unobserve(el);
            } else if (el.classList.contains('revealed') && !noExitIds[el.id]) {
                // Element leaving viewport - apply exit effect (skip step containers)
                var rect = entry.boundingClientRect;
                if (rect.top < 0) {
                    // Scrolled past (above viewport)
                    el.classList.add('reveal-exit-up');
                } else {
                    // Scrolled below (below viewport)
                    el.classList.add('reveal-exit-down');
                }
                el.classList.remove('revealed');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
    });

    // Observe on DOM ready (skip step1 - it waits for Monaco)
    $(function () {
        document.querySelectorAll('.scroll-reveal').forEach(function (el) {
            if (el.id === 'step1') return;
            observer.observe(el);
        });
    });

    // Re-observe dynamically revealed steps (they start display:none)
    var mutObs = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
            if (m.type === 'attributes' && m.attributeName === 'style') {
                var el = m.target;
                if (el.classList.contains('scroll-reveal') && el.style.display !== 'none') {
                    observer.observe(el);
                }
            }
        });
    });
    $(function () {
        document.querySelectorAll('.scroll-reveal[style*="display:none"]').forEach(function (el) {
            mutObs.observe(el, { attributes: true, attributeFilter: ['style'] });
        });
    });
})();
