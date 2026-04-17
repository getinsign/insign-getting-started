'use strict';

/* ==========================================================================
   Getting Started Guide - Monaco Editor Setup
   ========================================================================== */

var editors = {};
var responseEditors = {};

// Step -> API path mapping for schema resolution
var STEP_PATHS = {
    1: { path: '/configure/session', method: 'post' },
    2: { path: '/extern/beginmulti', method: 'post' },
    3: { path: '/get/status', method: 'post' },
    4: { path: '/get/document', method: 'post' }
};

// Shared editor options matching API Explorer quality
function getMonacoTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'vs-dark' : 'vs';
}

var EDITOR_OPTS = {
    theme: getMonacoTheme(),
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: false,
    tabSize: 2,
    wordWrap: 'on',
    formatOnPaste: true,
    renderLineHighlight: 'none',
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    fixedOverflowWidgets: true,
    scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8, alwaysConsumeMouseWheel: false },
    suggest: {
        showInlineDetails: true,
        detailsVisible: true,
        preview: true,
        showStatusBar: true
    },
    quickSuggestions: {
        other: true,
        strings: true
    }
};

/**
 * Force the suggest details panel to always be expanded.
 * Uses Monaco's fixedOverflowWidgets so the suggest widget renders in
 * a fixed-position overlay (not clipped by the editor container), and
 * a MutationObserver that force-expands the docs panel whenever the
 * suggest widget becomes visible.
 */
function forceSuggestDetails(editor) {
    // Force the details/docs panel open whenever the suggest widget appears.
    // Uses the suggest controller's onDidShow event to toggle exactly once
    // per show - avoiding the infinite loop a MutationObserver would cause.
    try {
        var ctrl = editor.getContribution('editor.contrib.suggestController');
        var w = ctrl && (ctrl.widget && (ctrl.widget.value || ctrl.widget));
        if (w && typeof w.toggleDetails === 'function') {
            w.onDidShow(function () {
                var dom = editor.getDomNode();
                var el = dom && dom.querySelector('.suggest-widget');
                if (el && !el.classList.contains('docs-side')) {
                    try { w.toggleDetails(); } catch (e) {}
                }
            });
        }
    } catch (e) {}
}

function autoResizeEditor(editor) {
    var rafId = 0;
    function resize() {
        if (rafId) return;               // already scheduled
        rafId = requestAnimationFrame(function () {
            rafId = 0;
            var container = editor.getDomNode().parentElement;
            var newHeight = Math.max(80, editor.getContentHeight() + 4);
            container.style.height = newHeight + 'px';
            editor.layout();
        });
    }
    editor.onDidContentSizeChange(resize);
    resize();
}

function initMonaco() {
    require.config({
        paths: { vs: 'vendor/monaco-editor/min/vs' }
    });

    require(['vs/editor/editor.main'], function () {

        for (var i = 1; i <= 4; i++) {
            var modelUri = monaco.Uri.parse('insign://models/step' + i + '/step' + i + '.json');
            var model = monaco.editor.createModel(STEP_DEFAULTS[i], 'json', modelUri);

            editors[i] = monaco.editor.create(
                document.getElementById('editor-step' + i),
                Object.assign({}, EDITOR_OPTS, { model: model })
            );
            forceSuggestDetails(editors[i]);
            autoResizeEditor(editors[i]);

            responseEditors[i] = monaco.editor.create(
                document.getElementById('response-step' + i),
                Object.assign({}, EDITOR_OPTS, {
                    value: '',
                    language: 'json',
                    readOnly: true,
                    lineNumbers: 'off'
                })
            );
            forceSuggestDetails(responseEditors[i]);
            autoResizeEditor(responseEditors[i]);
        }

        // Relayout all editors on window resize (replaces automaticLayout)
        var resizeRaf = 0;
        window.addEventListener('resize', function () {
            if (resizeRaf) return;
            resizeRaf = requestAnimationFrame(function () {
                resizeRaf = 0;
                for (var r = 1; r <= 4; r++) {
                    if (editors[r]) editors[r].layout();
                    if (responseEditors[r]) responseEditors[r].layout();
                }
            });
        });

        // Editors are now rendered - trigger step1 reveal after layout settles
        requestAnimationFrame(function () {
            setTimeout(function () {
                var step1 = document.getElementById('step1');
                if (step1 && window._scrollRevealObserver) {
                    window._scrollRevealObserver.observe(step1);
                }
            }, 50);
        });

        schemaLoader.load(SANDBOX.url, null).then(function (ok) {
            if (ok) {
                schemaLoader.registerWithMonaco(monaco);
                assignSchemaModels();
            }
        });
    });
}

/**
 * Re-create Monaco models with URIs whose filename matches the schema's
 * fileMatch pattern, enabling autocomplete, validation, and hover tooltips.
 */
function assignSchemaModels() {
    for (var i = 1; i <= 4; i++) {
        var info = STEP_PATHS[i];

        var schemaKey = schemaLoader.getRequestSchemaKey(info.path, info.method);
        if (schemaKey && editors[i]) {
            var currentValue = editors[i].getValue();
            var oldModel = editors[i].getModel();
            var newModel = monaco.editor.createModel(
                currentValue, 'json',
                monaco.Uri.parse('insign://models/step' + i + '/' + schemaKey + '.json')
            );
            editors[i].setModel(newModel);
            if (oldModel) oldModel.dispose();
        }

        var respKey = schemaLoader.getResponseSchemaKey(info.path, info.method);
        if (respKey && responseEditors[i]) {
            var respValue = responseEditors[i].getValue();
            var oldRespModel = responseEditors[i].getModel();
            var newRespModel = monaco.editor.createModel(
                respValue, 'json',
                monaco.Uri.parse('insign://models/resp' + i + '/' + respKey + '.json')
            );
            responseEditors[i].setModel(newRespModel);
            if (oldRespModel) oldRespModel.dispose();
        }
    }
}
