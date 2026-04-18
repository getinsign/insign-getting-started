'use strict';

/* ==========================================================================
   FEATURE GRID - click a card to zoom the screenshot in a lightbox

   Paired with docs/css/feature-grid.css. Lightbox element must exist at
   body-level (not inside a transform-animated ancestor) or position:fixed
   will be scoped to the wrong containing block.
   ========================================================================== */

(function () {
    var cards = document.querySelectorAll('.feature-card');
    var lightbox = document.getElementById('feature-lightbox');
    if (!cards.length || !lightbox) return;

    var img = document.getElementById('feature-lightbox-img');
    var closeBtn = lightbox.querySelector('.feature-lightbox-close');

    function open(src, alt) {
        img.src = src;
        img.alt = alt || '';
        lightbox.classList.add('active');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }
    function close() {
        lightbox.classList.remove('active');
        lightbox.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        img.src = '';
    }

    cards.forEach(function (card) {
        card.addEventListener('click', function () {
            var thumb = card.querySelector('img');
            var src = card.getAttribute('data-full') || (thumb && thumb.src);
            var alt = thumb ? thumb.alt : '';
            if (src) open(src, alt);
        });
    });

    // Click anywhere on the backdrop (but not on the image itself) closes.
    lightbox.addEventListener('click', function (e) {
        if (e.target !== img) close();
    });
    if (closeBtn) closeBtn.addEventListener('click', close);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) close();
    });
})();
