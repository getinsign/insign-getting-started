/* ==========================================================================
   PDF Viewer - Lightweight PDF preview using PDF.js from CDN
   Shows uploaded/downloaded documents in a scrollable modal (all pages)
   ========================================================================== */

window.PdfViewer = class PdfViewer {

    constructor() {
        this.pdfDoc = null;
        this.scale = 1.5;
        this.modal = null;
        this.lib = null;
        this._loading = false;
        this._rendered = new Set();
        this._observer = null;
        this._initModal();
    }

    _initModal() {
        const $modal = $(`
            <div class="modal fade" id="pdf-viewer-modal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content" style="background:var(--insign-dark);border:none;border-radius:var(--insign-radius-card)">
                        <div class="modal-header" style="border-bottom:1px solid rgba(255,255,255,0.1);padding:8px 16px">
                            <span class="modal-title text-white" style="font-size:0.9rem" id="pdf-viewer-title">Document Preview</span>
                            <div class="d-flex align-items-center gap-2 ms-auto">
                                <button class="btn btn-sm btn-outline-light" id="pdf-zoom-out" title="Zoom out" style="padding:2px 8px">
                                    <i class="bi bi-zoom-out"></i>
                                </button>
                                <span class="text-white-50" style="font-size:0.8rem" id="pdf-page-info">-</span>
                                <button class="btn btn-sm btn-outline-light" id="pdf-zoom-in" title="Zoom in" style="padding:2px 8px">
                                    <i class="bi bi-zoom-in"></i>
                                </button>
                                <button type="button" class="btn-close btn-close-white ms-2" data-bs-dismiss="modal"></button>
                            </div>
                        </div>
                        <div class="modal-body p-2" id="pdf-scroll-container" style="overflow-y:auto;max-height:80vh;background:#525659">
                            <div id="pdf-loading" style="display:none" class="py-5 text-center">
                                <div class="spinner-border text-light" role="status"></div>
                                <div class="text-white-50 mt-2" style="font-size:0.85rem">Loading PDF...</div>
                            </div>
                            <div id="pdf-pages"></div>
                            <div id="pdf-error" class="text-warning py-4 text-center" style="display:none"></div>
                        </div>
                        <div class="modal-footer" style="border-top:1px solid rgba(255,255,255,0.1);padding:6px 16px;justify-content:space-between;background:var(--insign-dark)">
                            <span class="text-white-50" style="font-size:0.75rem" id="pdf-file-info"></span>
                            <button type="button" class="btn btn-sm btn-outline-light" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>`);
        $('body').append($modal);

        this.modal = new bootstrap.Modal($('#pdf-viewer-modal')[0]);

        // Bind zoom
        $('#pdf-zoom-in').on('click', () => this.zoom(0.2));
        $('#pdf-zoom-out').on('click', () => this.zoom(-0.2));

        // Update page indicator on scroll
        $('#pdf-scroll-container').on('scroll', () => this._updatePageIndicator());

        // Cleanup on close
        $('#pdf-viewer-modal').on('hidden.bs.modal', () => this._cleanup());
    }

    async _ensureLib() {
        if (this.lib) return;
        this.lib = await import('../vendor/pdfjs-dist/build/pdf.min.mjs');
        this.lib.GlobalWorkerOptions.workerSrc =
            'vendor/pdfjs-dist/build/pdf.worker.min.mjs';
    }

    /**
     * Show a PDF in the viewer modal
     * @param {Blob|ArrayBuffer|Uint8Array|string} source - PDF data or URL
     * @param {Object} [opts] - Optional { title, fileSize }
     */
    async show(source, opts = {}) {
        this._showLoading(true);
        this.modal.show();

        $('#pdf-viewer-title').text(opts.title || 'Document Preview');
        $('#pdf-error').css('display', 'none');
        $('#pdf-pages').empty();
        this._rendered.clear();

        try {
            await this._ensureLib();

            let data;
            if (source instanceof Blob) {
                data = await source.arrayBuffer();
            } else if (typeof source === 'string' && (source.startsWith('http') || source.startsWith('data/'))) {
                const resp = await fetch(source);
                data = await resp.arrayBuffer();
            } else {
                data = source;
            }

            this.pdfDoc = await this.lib.getDocument({ data }).promise;

            const info = [];
            if (this.pdfDoc.numPages) info.push(this.pdfDoc.numPages + ' page(s)');
            if (opts.fileSize) info.push(this._formatSize(opts.fileSize));
            $('#pdf-file-info').text(info.join(' \u2022 '));
            $('#pdf-page-info').text('1 / ' + this.pdfDoc.numPages);

            this._showLoading(false);
            this._createPagePlaceholders();
            this._setupLazyRendering();

        } catch (err) {
            this._showLoading(false);
            $('#pdf-error').css('display', '').text('Failed to load PDF: ' + err.message);
        }
    }

    /** Create placeholder canvases for each page */
    _createPagePlaceholders() {
        const $pages = $('#pdf-pages');
        $pages.empty();
        for (let i = 1; i <= this.pdfDoc.numPages; i++) {
            const $wrapper = $('<div>')
                .addClass('pdf-page-wrapper')
                .attr('data-page', i)
                .css({
                    textAlign: 'center',
                    marginBottom: '8px',
                    minHeight: '200px',
                    position: 'relative'
                });
            const canvas = document.createElement('canvas');
            canvas.style.maxWidth = '100%';
            canvas.style.boxShadow = '0 2px 12px rgba(0,0,0,0.4)';
            canvas.style.display = 'block';
            canvas.style.margin = '0 auto';
            $wrapper.append(canvas);
            $pages.append($wrapper);
        }
    }

    /** Use IntersectionObserver to render pages as they scroll into view */
    _setupLazyRendering() {
        if (this._observer) this._observer.disconnect();
        const container = document.getElementById('pdf-scroll-container');
        this._observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const pageNum = parseInt(entry.target.dataset.page);
                    if (!this._rendered.has(pageNum)) {
                        this._rendered.add(pageNum);
                        this._renderPage(pageNum, entry.target.querySelector('canvas'));
                    }
                }
            }
        }, { root: container, rootMargin: '200px 0px' });

        $('#pdf-pages .pdf-page-wrapper').each((_, el) => this._observer.observe(el));
    }

    async _renderPage(pageNum, canvas) {
        if (!this.pdfDoc || !canvas) return;
        const page = await this.pdfDoc.getPage(pageNum);
        const dpr = window.devicePixelRatio || 2;
        const viewport = page.getViewport({ scale: this.scale });
        const hiResViewport = page.getViewport({ scale: this.scale * dpr });

        canvas.width = hiResViewport.width;
        canvas.height = hiResViewport.height;
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';

        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: hiResViewport }).promise;

        // Update wrapper min-height to actual rendered size
        canvas.parentElement.style.minHeight = viewport.height + 'px';
    }

    /** Update the "X / N" page indicator based on scroll position */
    _updatePageIndicator() {
        if (!this.pdfDoc) return;
        const container = document.getElementById('pdf-scroll-container');
        if (!container) return;
        const wrappers = container.querySelectorAll('.pdf-page-wrapper');
        const scrollTop = container.scrollTop;
        const containerMid = scrollTop + container.clientHeight / 3;
        let currentPage = 1;
        for (const wrapper of wrappers) {
            if (wrapper.offsetTop <= containerMid) {
                currentPage = parseInt(wrapper.dataset.page);
            } else {
                break;
            }
        }
        $('#pdf-page-info').text(currentPage + ' / ' + this.pdfDoc.numPages);
    }

    async zoom(delta) {
        this.scale = Math.max(0.5, Math.min(3.0, this.scale + delta));
        if (!this.pdfDoc) return;
        // Re-render all currently rendered pages at new scale
        this._rendered.clear();
        const wrappers = document.querySelectorAll('#pdf-pages .pdf-page-wrapper');
        for (const wrapper of wrappers) {
            const pageNum = parseInt(wrapper.dataset.page);
            this._rendered.add(pageNum);
            await this._renderPage(pageNum, wrapper.querySelector('canvas'));
        }
    }

    _cleanup() {
        if (this._observer) { this._observer.disconnect(); this._observer = null; }
        this._rendered.clear();
        $('#pdf-pages').empty();
        this.pdfDoc = null;
    }

    _showLoading(show) {
        $('#pdf-loading').css('display', show ? '' : 'none');
    }

    _formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
};
