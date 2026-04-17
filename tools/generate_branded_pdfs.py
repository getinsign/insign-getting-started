#!/usr/bin/env python3
"""
Branded PDF Contract Generator
===============================
Reads contract data from docs/data/branded-contracts.json and header SVGs from
docs/img/doc-headers/, then generates beautifully branded PDF contracts for each
brand — both sigtags and sigfields variants.

SVG→PDF conversion uses cairosvg.svg2pdf() which produces VECTOR output (not rasterized).

Usage:
    python3 tools/generate_branded_pdfs.py          # generate all brands
    python3 tools/generate_branded_pdfs.py acme      # generate one brand
"""

import json
import os
import sys
import io
import tempfile

import cairosvg
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, Color, white, black
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER

# Try to use PyPDF2/pypdf for merging vector SVG pages, fall back to pdfrw
try:
    from pypdf import PdfReader, PdfWriter, Transformation
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False

try:
    from pdfrw import PdfReader as PdfrwReader, PageMerge, PdfWriter as PdfrwWriter
    HAS_PDFRW = True
except ImportError:
    HAS_PDFRW = False

# ---------------------------------------------------------------------------
# Paths (relative to project root)
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(PROJECT_ROOT, "docs", "data", "branded-contracts.json")
HEADER_DIR = os.path.join(PROJECT_ROOT, "docs", "img", "doc-headers")
LOGO_DIR = os.path.join(PROJECT_ROOT, "docs", "img", "sample-logos")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "docs", "data")

# ---------------------------------------------------------------------------
# Page geometry
# ---------------------------------------------------------------------------
PAGE_W, PAGE_H = A4  # 595.28, 841.89
MARGIN_LEFT = 55
MARGIN_RIGHT = 55
MARGIN_TOP = 40
MARGIN_BOTTOM = 40
CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT
HEADER_HEIGHT = 130  # matches SVG viewBox height
FONT_DIR = os.path.join(PROJECT_ROOT, "docs", "fonts")

# ---------------------------------------------------------------------------
# Font registration
# ---------------------------------------------------------------------------
_fonts_registered = False

# Fonts that render very thin and need heavy thickening (stroke factor relative to font size)
_THIN_FONTS = {
    'Raleway-Regular', 'Nunito-Regular', 'DMSans-Regular',
    'WorkSans-Regular', 'Lato-Regular', 'Oswald-Regular',
    'Archivo-Regular',
}
# Bold fonts that are already thick — minimal thickening
_BOLD_FONTS = {
    'Montserrat-Bold', 'Poppins-Bold', 'Lato-Bold',
    'CrimsonText-Bold', 'LibreBaskerville-Bold', 'Merriweather-Bold',
}


def _stroke_width_for_font(font_name, font_size):
    """Return stroke width to thicken text via render mode 2 (fill+stroke).

    - Thin fonts:   factor 0.042  (~90% visual thickening)
    - Normal fonts:  factor 0.024  (~30% visual thickening)
    - Bold fonts:    factor 0.009 (subtle, already thick)
    - Helvetica/builtins: 0 (no thickening)
    """
    if font_name.startswith('Helvetica'):
        return 0
    if font_name in _THIN_FONTS:
        return font_size * 0.042
    if font_name in _BOLD_FONTS:
        return font_size * 0.009
    # Normal custom fonts (CrimsonText-Regular, SourceSerif4, PlayfairDisplay, etc.)
    return font_size * 0.024


def _set_bold_text(c, font_name, font_size):
    """Set font and configure stroke thickening. Stores state for _draw_thick."""
    c.setFont(font_name, font_size)
    c._thick_sw = _stroke_width_for_font(font_name, font_size)


def _draw_thick(c, x, y, text):
    """Draw text with fill+stroke thickening if configured by _set_bold_text."""
    sw = getattr(c, '_thick_sw', 0)
    if sw > 0:
        c.saveState()
        c.setLineWidth(sw)
        c.setStrokeColor(c._fillColorObj)
        c.drawString(x, y, text, mode=2)
        c.restoreState()
    else:
        c.drawString(x, y, text)


def _reset_text_mode(c):
    """Reset thickening state."""
    c._thick_sw = 0


def register_fonts():
    """Register all TTF fonts from docs/fonts/ with reportlab."""
    global _fonts_registered
    if _fonts_registered:
        return
    for fname in os.listdir(FONT_DIR):
        if fname.endswith('.ttf'):
            name = fname.replace('.ttf', '')
            try:
                pdfmetrics.registerFont(TTFont(name, os.path.join(FONT_DIR, fname)))
            except Exception as e:
                print(f"  WARNING: Could not register font {name}: {e}")
    _fonts_registered = True


def hex_to_color(hex_str):
    """Convert '#RRGGBB' to a reportlab Color."""
    return HexColor(hex_str)


def load_contracts():
    """Load branded contract data from JSON."""
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def svg_to_pdf_bytes(svg_path, width=None, height=None):
    """Convert an SVG file to PDF bytes (vector, not rasterized) using cairosvg."""
    kwargs = {}
    if width:
        kwargs["output_width"] = width
    if height:
        kwargs["output_height"] = height
    return cairosvg.svg2pdf(url=svg_path, **kwargs)


def draw_header_overlay(c, brand_key, colors):
    """
    Draw the branded SVG header as a vector overlay on the current page.
    Uses cairosvg to produce a vector PDF of the header, then we draw it
    as a Form XObject on the page.
    """
    header_svg = os.path.join(HEADER_DIR, f"{brand_key}-header.svg")
    if not os.path.exists(header_svg):
        # Fallback: draw a solid color header
        primary = hex_to_color(colors.get("dark", colors["primary"]))
        c.setFillColor(primary)
        c.rect(0, PAGE_H - HEADER_HEIGHT, PAGE_W, HEADER_HEIGHT, fill=1, stroke=0)
        return

    # Convert SVG header to a temporary PDF
    pdf_bytes = svg_to_pdf_bytes(header_svg)
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    try:
        tmp.write(pdf_bytes)
        tmp.close()
        # Draw the PDF page as a form on our canvas
        # reportlab can import PDF pages as forms
        from reportlab.lib.utils import open_and_read
        # Use the lower-level pdfrw or just overlay approach
        # Actually, reportlab doesn't natively import external PDFs.
        # We'll use a different approach: draw the SVG as a high-res image
        # BUT the user wants vector. Let's use pdfrw for merging.
        pass
    finally:
        os.unlink(tmp.name)


def _prepare_logo(brand_key, size_pt, dpi_scale=4):
    """Pre-render the brand logo SVG to a high-DPI PNG ImageReader, or None."""
    logo_svg = os.path.join(LOGO_DIR, f"{brand_key}-icon.svg")
    if not os.path.exists(logo_svg):
        return None
    logo_png = cairosvg.svg2png(
        url=logo_svg,
        output_width=int(size_pt * dpi_scale),
        output_height=int(size_pt * dpi_scale),
    )
    return ImageReader(io.BytesIO(logo_png))


def _draw_bottom_logo(c, logo_img, logo_size):
    """Draw small brand icon at bottom-right of page, close to edge, semi-transparent."""
    if not logo_img:
        return
    logo_x = PAGE_W - 10 - logo_size   # 10pt from right edge
    logo_y = 8                          # 8pt from bottom edge
    c.saveState()
    c.setFillAlpha(0.22)
    c.drawImage(logo_img, logo_x, logo_y, logo_size, logo_size,
                preserveAspectRatio=True, mask='auto')
    c.restoreState()


def _draw_top_right_mail(c, mail_img, mail_w, mail_h):
    """Draw brand mail logo at top-right corner of non-first pages, close to page edge."""
    if not mail_img:
        return
    mail_x = PAGE_W - 10 - mail_w   # 10pt from right edge (same as bottom icon)
    mail_y = PAGE_H - 10 - mail_h   # 10pt from top edge
    c.drawImage(mail_img, mail_x, mail_y, mail_w, mail_h,
                preserveAspectRatio=True, mask='auto')

# Height reserved for mail logo on page 2+ (logo height + gap below it)
MAIL_RESERVE = 42  # ~28pt logo + 14pt gap


def generate_branded_pdf(brand_key, brand_data):
    """Generate a single branded PDF contract (SIG-tags variant)."""
    register_fonts()
    output_path = os.path.join(OUTPUT_DIR, f"{brand_key}-contract.pdf")

    colors = brand_data["colors"]
    primary_color = hex_to_color(colors["primary"])
    accent_color = hex_to_color(colors["accent"])
    dark_color = hex_to_color(colors.get("dark", colors["primary"]))

    # Font assignments from JSON (fall back to Helvetica if missing)
    fonts = brand_data.get("fonts", {})
    f_heading = fonts.get("heading", "Helvetica-Bold")
    f_body = fonts.get("body", "Helvetica")
    f_label = fonts.get("label", "Helvetica")

    # Pre-render logo icon (60% of original 65pt = 39pt for bottom)
    LOGO_SIZE_BOTTOM = 39
    logo_img = _prepare_logo(brand_key, LOGO_SIZE_BOTTOM)

    # Pre-render mail banner for top-right of page 2+
    MAIL_HEIGHT = 28  # height of mail banner on page
    mail_img = None
    mail_w = MAIL_HEIGHT * 4  # approximate aspect ratio (~5:1 for wide banner)
    mail_svg = os.path.join(LOGO_DIR, f"{brand_key}-mail.svg")
    if os.path.exists(mail_svg):
        # Read SVG viewBox to get aspect ratio
        import re as _re
        with open(mail_svg, 'r') as _f:
            _svg_head = _f.read(500)
        _vb = _re.search(r'viewBox="([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)"', _svg_head)
        if _vb:
            vb_w = float(_vb.group(3)) - float(_vb.group(1))
            vb_h = float(_vb.group(4)) - float(_vb.group(2))
            mail_w = MAIL_HEIGHT * (vb_w / vb_h)
        dpi_scale = 4
        mail_png = cairosvg.svg2png(
            url=mail_svg,
            output_width=int(mail_w * dpi_scale),
            output_height=int(MAIL_HEIGHT * dpi_scale),
        )
        mail_img = ImageReader(io.BytesIO(mail_png))

    # Page tracking
    page_num = 1

    def content_top():
        """Y position for top of content area on the current page."""
        if page_num > 1 and mail_img:
            return PAGE_H - MARGIN_TOP - MAIL_RESERVE
        return PAGE_H - MARGIN_TOP

    def finish_page(is_last=False):
        """Draw per-page elements (footer, logo, mail banner) before ending page."""
        nonlocal page_num
        draw_footer(c, accent_color, page_num)
        _draw_bottom_logo(c, logo_img, LOGO_SIZE_BOTTOM)
        if page_num > 1:
            _draw_top_right_mail(c, mail_img, mail_w, MAIL_HEIGHT)
        if not is_last:
            c.showPage()
            page_num += 1

    # Step 1: Generate the text content PDF with reportlab
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(brand_data["contractTitle"])
    c.setAuthor("inSign Demo")
    c.setSubject(brand_data["contractSubtitle"])
    c.setCreator("inSign Getting Started — Branded Contract Generator")

    y = PAGE_H - MARGIN_TOP

    # --- Reserve space for header (will be overlaid) ---
    y -= HEADER_HEIGHT
    y -= 15  # gap after header

    # --- Contract title ---
    c.setFillColor(primary_color)
    _set_bold_text(c, f_heading, 18)
    title = brand_data["contractTitle"]
    title_w = c.stringWidth(title, f_heading, 18)
    _draw_thick(c, (PAGE_W - title_w) / 2, y, title)
    _reset_text_mode(c)
    y -= 20

    c.setFillColor(HexColor("#666666"))
    _set_bold_text(c, f_body, 10.5)
    subtitle = brand_data["contractSubtitle"]
    sub_w = c.stringWidth(subtitle, f_body, 10.5)
    _draw_thick(c, (PAGE_W - sub_w) / 2, y, subtitle)
    _reset_text_mode(c)
    y -= 14

    c.setFillColor(HexColor("#666666"))
    _set_bold_text(c, f_body, 9)
    contract_no = f"Contract No. {brand_data['contractNo']}"
    cn_w = c.stringWidth(contract_no, f_body, 9)
    _draw_thick(c, (PAGE_W - cn_w) / 2, y, contract_no)
    _reset_text_mode(c)
    y -= 10

    # --- Accent line under title ---
    c.setStrokeColor(accent_color)
    c.setLineWidth(1.5)
    line_w = 120
    c.line((PAGE_W - line_w) / 2, y, (PAGE_W + line_w) / 2, y)
    y -= 46  # extra breathing room before first section heading

    c.setFillColor(black)

    # --- Parties section ---
    y = draw_section_title(c, "1. CONTRACTING PARTIES", y, primary_color, accent_color, f_heading)
    y -= 4
    for party in brand_data["parties"]:
        c.setFillColor(primary_color)
        _set_bold_text(c, f_label, 10.5)
        _draw_thick(c, MARGIN_LEFT, y, f"{party['label']}:")
        _reset_text_mode(c)
        y -= 15
        c.setFillColor(black)
        _set_bold_text(c, f_body, 10.5)
        name_line = party["name"]
        if party.get("company"):
            name_line += f"  ({party['company']})"
        _draw_thick(c, MARGIN_LEFT + 10, y, name_line)
        _reset_text_mode(c)
        y -= 14
        c.setFillColor(HexColor("#444444"))
        _set_bold_text(c, f_body, 9)
        _draw_thick(c, MARGIN_LEFT + 10, y, f"Email: {party['email']}")
        _reset_text_mode(c)
        y -= 16
        c.setFillColor(black)

    # --- Contract sections ---
    for i, section in enumerate(brand_data["sections"], start=2):
        y -= 21  # consistent pre-heading spacing
        if y < 120:
            finish_page()
            y = content_top()

        y = draw_section_title(c, f"{i}. {section['title']}", y, primary_color, accent_color, f_heading)
        y -= 4

        for para_text in section["paragraphs"]:
            y = draw_paragraph(c, para_text, y, MARGIN_LEFT, CONTENT_W, f_body)
            y -= 4
            if y < 80:
                finish_page()
                y = content_top()

    # --- Signatures section ---
    sig_section_num = len(brand_data["sections"]) + 2
    y -= 21  # consistent pre-heading spacing
    if y < 180:
        finish_page()
        y = content_top()

    y = draw_section_title(c, f"{sig_section_num}. SIGNATURES", y, primary_color, accent_color, f_heading)
    y -= 4
    c.setFillColor(HexColor("#444444"))
    _set_bold_text(c, f_body, 9)
    _draw_thick(c, MARGIN_LEFT, y, "By signing below, all parties confirm that they have read, understood,")
    y -= 12
    _draw_thick(c, MARGIN_LEFT, y, "and agree to all terms and conditions set forth in this agreement.")
    _reset_text_mode(c)
    y -= 38

    c.setFillColor(black)

    parties = brand_data["parties"]
    num_parties = len(parties)
    gap = 12
    sig_col_w = (CONTENT_W - gap * (num_parties - 1)) / num_parties
    sig_box_h = 1.8 * 28.35  # ~1.8cm
    sig_box_w = sig_col_w - 4

    sig_variant = brand_data.get("sigVariant", "full")  # full, no-names, no-roles
    sig_level = brand_data.get("signatureLevel", "SES")
    sig_provider = brand_data.get("sigProvider", "")

    for idx, party in enumerate(parties):
        x = MARGIN_LEFT + idx * (sig_col_w + gap)

        show_role = sig_variant != "no-roles"
        show_name = sig_variant != "no-names"

        # Line 1 (role label) — skip if no-roles variant
        if show_role:
            c.setFillColor(primary_color)
            _set_bold_text(c, f_label, 8.5)
            role_text = party['label']
            _draw_thick(c, x, y + 13, role_text)
            _reset_text_mode(c)

        # Line 2 (name) — skip if no-names variant
        if show_name:
            c.setFillColor(black)
            _set_bold_text(c, f_label, 8.5)
            name_text = party['name']
            while c.stringWidth(name_text, f_label, 8.5) > sig_col_w and len(name_text) > 20:
                name_text = name_text[:-4] + "..."
            line2_y = y + 2 if show_role else y + 13
            _draw_thick(c, x, line2_y, name_text)
            _reset_text_mode(c)
        c.setFillColor(black)

        # Dashed signature box
        box_top = y - 6
        c.setStrokeColor(Color(0.75, 0.75, 0.75))
        c.setDash(3, 3)
        c.setLineWidth(0.5)
        c.rect(x, box_top - sig_box_h, sig_box_w, sig_box_h, fill=0, stroke=1)
        c.setDash()
        c.setStrokeColor(black)
        c.setLineWidth(1)

        # Build SIG-tag — only documented sigtag attributes per "3.5 Creating signature fields" docs:
        # x, y, w, h (with unit: mm/cm/%), role, externRole, displayname, required,
        # signatureLevel, id, stampType
        sig_role = party.get("sigRole", party["role"])
        display_name = party["name"]
        use_extern_role = brand_data.get("useExternRole", False)

        # Convert box dimensions from pt to cm (1cm = 28.35pt)
        field_w_cm = round(sig_box_w / 28.35, 1)
        field_h_cm = round(sig_box_h / 28.35, 1)

        # When useExternRole is set, identify signers by email via externRole
        # instead of the role attribute
        if use_extern_role:
            role_attr = f"externRole:'{party['email']}'"
        else:
            role_attr = f"role:'{sig_role}'"

        tag_parts = [
            role_attr,
            f"displayname:'{display_name}'",
            "required:true",
            f"w:'{field_w_cm}cm'",
            f"h:'{field_h_cm}cm'",
            f"y:'-{field_h_cm}cm'",
        ]

        # Place tag at bottom-left of dashed box; y offset shifts field up by its height
        tag_y = box_top - sig_box_h
        tag = "##SIG{" + ",".join(tag_parts) + "}"
        c.setFont("Lato-Regular", 0.5)  # TTF font for full Unicode support in SIG tags
        c.setFillColor(black)
        c.drawString(x, tag_y, tag)
        c.setFillColor(black)

    # Final page elements
    finish_page(is_last=True)

    # Save the content PDF
    c.save()
    content_pdf_bytes = buf.getvalue()

    # Step 2: Generate header SVG as vector PDF
    header_svg = os.path.join(HEADER_DIR, f"{brand_key}-header.svg")
    header_pdf_bytes = None
    if os.path.exists(header_svg):
        header_pdf_bytes = svg_to_pdf_bytes(header_svg)

    # Step 3: Merge header PDF overlay onto content PDF
    final_pdf = merge_header_onto_content(
        content_pdf_bytes, header_pdf_bytes, None
    )

    with open(output_path, "wb") as f:
        f.write(final_pdf)

    size = os.path.getsize(output_path)
    print(f"  {output_path}  ({size:,} bytes)")
    return output_path


def merge_header_onto_content(content_bytes, header_bytes, logo_bytes):
    """
    Merge the SVG header (as vector PDF) onto the first page of the content PDF.
    Uses pypdf if available, otherwise falls back to pdfrw.
    """
    if HAS_PYPDF:
        return _merge_pypdf(content_bytes, header_bytes, logo_bytes)
    elif HAS_PDFRW:
        return _merge_pdfrw(content_bytes, header_bytes, logo_bytes)
    else:
        # No merge library — just return content (header won't be overlaid)
        print("    WARNING: No PDF merge library (pypdf/pdfrw). Header not overlaid.")
        return content_bytes


def _merge_pypdf(content_bytes, header_bytes, logo_bytes):
    """Merge using pypdf library."""
    from pypdf import PdfReader, PdfWriter, Transformation

    content_reader = PdfReader(io.BytesIO(content_bytes))
    writer = PdfWriter()

    for i, page in enumerate(content_reader.pages):
        if i == 0 and header_bytes:
            # Overlay header on first page
            header_reader = PdfReader(io.BytesIO(header_bytes))
            header_page = header_reader.pages[0]

            h_box = header_page.mediabox
            h_width = float(h_box.width)
            h_height = float(h_box.height)

            scale_x = float(A4[0]) / h_width
            scale_y = HEADER_HEIGHT / h_height

            ty = float(A4[1]) - HEADER_HEIGHT
            transformation = Transformation().scale(scale_x, scale_y).translate(0, ty)
            page.merge_transformed_page(header_page, transformation)

        writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def _merge_pdfrw(content_bytes, header_bytes, logo_bytes):
    """Merge using pdfrw library."""
    from pdfrw import PdfReader as PdfrwReader, PageMerge, PdfWriter as PdfrwWriter

    content_reader = PdfrwReader(fdata=content_bytes)
    writer = PdfrwWriter()

    for i, page in enumerate(content_reader.pages):
        if i == 0 and header_bytes:
            header_reader = PdfrwReader(fdata=header_bytes)
            header_page = header_reader.pages[0]

            merger = PageMerge(page)

            # Scale header to page width and position at top
            h_box = header_page.MediaBox
            h_width = float(h_box[2]) - float(h_box[0])
            h_height = float(h_box[3]) - float(h_box[1])

            scale_x = float(A4[0]) / h_width
            scale_y = HEADER_HEIGHT / h_height

            merger.add(header_page).rect = (
                0,
                float(A4[1]) - HEADER_HEIGHT,
                float(A4[0]),
                HEADER_HEIGHT
            )
            page = merger.render()

        writer.addpage(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def draw_section_title(c, title, y, primary_color, accent_color, font_name="Helvetica-Bold"):
    """Draw a section title with accent bar."""
    # Small accent bar
    c.setFillColor(accent_color)
    c.rect(MARGIN_LEFT, y - 1, 3, 14, fill=1, stroke=0)

    c.setFillColor(primary_color)
    _set_bold_text(c, font_name, 13)
    _draw_thick(c, MARGIN_LEFT + 10, y, title)
    _reset_text_mode(c)
    c.setFillColor(black)

    # Thin line under title
    c.setStrokeColor(Color(0.85, 0.85, 0.85))
    c.setLineWidth(0.5)
    c.line(MARGIN_LEFT, y - 6, PAGE_W - MARGIN_RIGHT, y - 6)
    c.setStrokeColor(black)

    return y - 22


def draw_paragraph(c, text, y, x, max_width, font_name="Helvetica"):
    """Draw a word-wrapped paragraph, returns new y position."""
    font_size = 9.8
    line_height = 13.8
    c.setFillColor(HexColor("#333333"))
    _set_bold_text(c, font_name, font_size)

    words = text.split()
    line = ""

    for word in words:
        test_line = f"{line} {word}".strip() if line else word
        test_width = pdfmetrics.stringWidth(test_line, font_name, font_size)
        if test_width > max_width and line:
            _draw_thick(c, x, y, line)
            y -= line_height
            line = word
            if y < MARGIN_BOTTOM + 30:
                _reset_text_mode(c)
                return y  # caller should handle page break
        else:
            line = test_line

    if line:
        _draw_thick(c, x, y, line)
        y -= line_height

    _reset_text_mode(c)
    c.setFillColor(black)
    return y


def draw_footer(c, accent_color, page_num=1):
    """Draw branded footer with page number at bottom of current page."""
    footer_y = 25
    # Accent line
    c.setStrokeColor(accent_color)
    c.setLineWidth(0.5)
    c.line(MARGIN_LEFT, footer_y + 8, PAGE_W - MARGIN_RIGHT, footer_y + 8)

    c.setFont("Helvetica-Oblique", 6.5)
    c.setFillColor(Color(0.5, 0.5, 0.5))
    c.drawString(MARGIN_LEFT, footer_y, "Generated by inSign Getting Started Demo  \u2014  getinsign.com")

    # Page number on the right
    page_str = f"Page {page_num}"
    page_w = c.stringWidth(page_str, "Helvetica-Oblique", 6.5)
    c.drawString(PAGE_W - MARGIN_RIGHT - page_w, footer_y, page_str)

    c.setFillColor(black)
    c.setStrokeColor(black)


def main():
    contracts = load_contracts()

    # Filter to specific brand(s) if requested
    brands = list(contracts.keys())
    if len(sys.argv) > 1:
        requested = [b.lower() for b in sys.argv[1:]]
        brands = [b for b in brands if b in requested]
        if not brands:
            print(f"Unknown brand(s): {sys.argv[1:]}. Available: {list(contracts.keys())}")
            sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"Generating branded PDFs for {len(brands)} brand(s)...\n")

    for brand_key in brands:
        brand_data = contracts[brand_key]
        print(f"[{brand_key}] {brand_data['name']}")
        generate_branded_pdf(brand_key, brand_data)
        print()

    print("Done!")


if __name__ == "__main__":
    main()
