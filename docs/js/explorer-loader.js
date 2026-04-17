/* ==========================================================================
   Explorer Loader - Fetches HTML partials and assembles them into the page.

   Replaces the build-time concatenation (scripts/build-explorer.js) with
   runtime loading so that docs/ can be served directly via GitHub Pages
   without a build step.

   The shell explorer.html contains <head>, vendor scripts, and placeholder
   <div> elements. This loader fetches each partial, inserts the HTML,
   then loads the app scripts in order.
   ========================================================================== */

(function () {
    var partials = [
        { id: 'slot-navbar',    src: 'partials/explorer/_navbar.html' },
        { id: 'slot-step1',     src: 'partials/explorer/_step1-connection.html' },
        { id: 'slot-step2',     src: 'partials/explorer/_step2-session.html' },
        { id: 'slot-step3',     src: 'partials/explorer/_step3-operations.html' },
        { id: 'slot-step4',     src: 'partials/explorer/_step4-snippets.html' },
        { id: 'slot-sidebar',   src: 'partials/explorer/_sidebar.html' },
        { id: 'slot-templates', src: 'partials/explorer/_templates.html' },
        { id: 'slot-footer',    src: 'partials/explorer/_footer.html' }
    ];

    var appScripts = [
        'js/webhook-viewer.js',
        'js/code-generator.js',
        'js/pdf-viewer.js',
        'js/app-state.js',
        'js/app-features.js',
        'js/app-persistence.js',
        'js/app-sync.js',
        'js/app-api.js',
        'js/app-editors.js',
        'js/app-operations.js',
        'js/app-documents.js',
        'js/app-ui.js',
        'js/app-branding.js',
        'js/app-init.js',
        'js/app-boot.js'
    ];

    // Fetch all partials in parallel
    Promise.all(partials.map(function (p) {
        return fetch(p.src).then(function (r) {
            if (!r.ok) throw new Error('Failed to load ' + p.src + ' (' + r.status + ')');
            return r.text();
        });
    }))
    .then(function (results) {
        // Insert HTML into placeholder slots
        partials.forEach(function (p, i) {
            var slot = document.getElementById(p.id);
            if (slot) slot.innerHTML = results[i];
        });

        // Load app scripts sequentially (they depend on each other)
        return appScripts.reduce(function (chain, src) {
            return chain.then(function () {
                return new Promise(function (resolve, reject) {
                    var s = document.createElement('script');
                    s.src = src;
                    s.onload = resolve;
                    s.onerror = function () { reject(new Error('Failed to load ' + src)); };
                    document.body.appendChild(s);
                });
            });
        }, Promise.resolve());
    })
    .catch(function (err) {
        console.error('Explorer loader error:', err);
        document.body.innerHTML = '<div style="padding:2rem;color:#f85149;font-family:sans-serif">'
            + '<h2>Failed to load explorer</h2><p>' + err.message + '</p>'
            + '<p>Make sure you are serving from a web server (not file://)</p></div>';
    });
})();
