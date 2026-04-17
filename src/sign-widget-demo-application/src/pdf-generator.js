// ============================================================================
// pdf-generator.js — Generates the Broker Mandate (Maklermandat) PDF template
// ============================================================================
//
// This module creates a REUSABLE PDF template with:
//   1. AcroForm text fields for client personal data, address, and existing
//      insurance/banking contracts — filled via inSign's preFilledFields API.
//   2. A ##SIG{...} tag for the client signature.
//   3. A static vector-drawn broker signature.
//
// PAGE BUDGET: All layout uses a computed page budget. After laying out all
// content, the generator asserts that nothing exceeds the footer boundary.
// If it does, the build fails with a clear error showing how many points
// over budget the layout is — so you catch overflow at build time, not in
// the browser.
//
// To regenerate: delete assets/mandate-template.pdf and restart the server.
// ============================================================================

const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, '..', 'assets', 'mandate-template.pdf');

function ensureTemplate() {
  if (fs.existsSync(TEMPLATE_PATH)) return;

  fs.mkdirSync(path.dirname(TEMPLATE_PATH), { recursive: true });

  const PDFDocument = require('pdfkit');

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 30, bottom: 0, left: 45, right: 45 },
    info: {
      Title: 'Maklermandat / Maklervertrag',
      Author: 'Sig-Funnel Demo',
      Subject: 'Versicherungs- und Finanzmaklervollmacht'
    }
  });

  const stream = fs.createWriteStream(TEMPLATE_PATH);
  doc.pipe(stream);
  doc.initForm();

  // ---- Page geometry ----
  const pageW = doc.page.width;    // 595.28 pt
  const pageH = doc.page.height;   // 841.89 pt
  const ml = 45;
  const cw = pageW - ml * 2;       // 505.28 pt
  const col2W = (cw - 20) / 2;

  const FOOTER_H = 22;
  const FOOTER_Y = pageH - FOOTER_H;  // 819.89 — nothing may start below this

  // ---- Compact spacing constants ----
  const FIELD_H = 14;         // form field height
  const ROW_H = 26;           // vertical step per form row
  const SECTION_H = 18;       // section header bar + gap
  const SUB_H = 16;           // sub-header bar + gap

  // Helper: render a label + AcroForm text field
  function formField(name, label, x, yy, w) {
    doc.fillColor('#555').font('Helvetica').fontSize(6).text(label, x, yy);
    doc.formText(name, x, yy + 8, w, FIELD_H, {
      borderColor: '#bbbbbb',
      backgroundColor: '#f8f9fa',
      fontSize: 8,
      font: 'Helvetica',
      align: 'left'
    });
  }

  function sectionHeader(label, yy) {
    doc.rect(ml, yy, cw, 15).fill('#1a237e');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7)
      .text(label, ml + 8, yy + 4);
    return yy + SECTION_H;
  }

  function subHeader(label, yy) {
    doc.rect(ml, yy, cw, 13).fill('#e8eaf6');
    doc.fillColor('#1a237e').font('Helvetica-Bold').fontSize(6.5)
      .text(label, ml + 8, yy + 3);
    return yy + SUB_H;
  }

  // ===== HEADER =====
  const bannerTop = 27;
  doc.rect(0, bannerTop, pageW, 48).fill('#1a237e');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15)
    .text('Maklermandat', ml, bannerTop + 9, { width: cw, align: 'center' });
  doc.fontSize(7.5).font('Helvetica').fillColor('rgba(255,255,255,0.8)')
    .text('Vollmacht und Maklervertrag gem. \u00A7\u00A734d GewO', ml, bannerTop + 28, { width: cw, align: 'center' });

  let y = bannerTop + 54;

  // ===== BROKER INFO BOX =====
  doc.roundedRect(ml, y, cw, 36, 3).lineWidth(0.5).strokeColor('#90caf9').stroke();
  doc.fillColor('#1a237e').font('Helvetica-Bold').fontSize(6.5)
    .text('MAKLER / VERMITTLER', ml + 8, y + 5);
  doc.fillColor('#333').font('Helvetica').fontSize(6.5);
  doc.text('FinanzTeam Muster GmbH  |  IHK-Reg.: D-W0X3-ABCDE-12  |  Musterallee 10, 60311 Frankfurt am Main', ml + 8, y + 15, { width: cw - 16 });
  doc.text('Tel.: +49 69 123456-0  |  E-Mail: info@finanzteam-muster.de  |  USt-IdNr.: DE123456789', ml + 8, y + 25, { width: cw - 16 });
  y += 42;

  // ===== SECTION 1: CLIENT PERSONAL DATA =====
  y = sectionHeader('1. AUFTRAGGEBER / MANDANT', y);

  formField('title', 'Anrede', ml + 8, y, 55);
  formField('firstName', 'Vorname', ml + 73, y, col2W - 10);
  formField('lastName', 'Nachname', ml + 73 + col2W, y, col2W - 10);
  y += ROW_H;

  formField('birthdate', 'Geburtsdatum', ml + 8, y, 90);
  formField('birthplace', 'Geburtsort', ml + 108, y, col2W - 45);
  formField('nationality', 'Staatsangeh\u00f6rigkeit', ml + 108 + col2W - 35, y, col2W - 10);
  y += ROW_H;

  formField('street', 'Stra\u00dfe und Hausnummer', ml + 8, y, cw - 16);
  y += ROW_H;

  formField('zip', 'PLZ', ml + 8, y, 50);
  formField('city', 'Ort', ml + 68, y, col2W - 5);
  formField('country', 'Land', ml + 68 + col2W + 5, y, col2W - 15);
  y += ROW_H;

  formField('phone', 'Telefon / Mobil', ml + 8, y, col2W);
  formField('email', 'E-Mail-Adresse', ml + 18 + col2W, y, col2W);
  y += ROW_H;

  formField('idType', 'Ausweisart', ml + 8, y, col2W);
  formField('idNumber', 'Ausweisnummer', ml + 18 + col2W, y, col2W);
  y += ROW_H + 4;

  // ===== SECTION 2: SCOPE OF MANDATE =====
  y = sectionHeader('2. UMFANG DER MAKLERVOLLMACHT', y);

  doc.fillColor('#333').font('Helvetica').fontSize(6.5)
    .text(
      'Der Auftraggeber erteilt dem Makler Vollmacht zur Beratung, Betreuung und Vertretung gegen\u00fcber Versicherern, Banken und Finanzdienstleistern in folgenden Bereichen:',
      ml + 8, y, { width: cw - 16, lineGap: 1 }
    );
  y += 22;

  const areas = [
    '\u2611 Krankenversicherung (GKV/PKV)     \u2611 Lebens-/Rentenversicherung     \u2611 Sachversicherungen (Haftpflicht, Hausrat, Geb\u00e4ude)',
    '\u2611 KFZ-Versicherung     \u2611 Berufsunf\u00e4higkeitsversicherung     \u2611 Unfallversicherung     \u2611 Rechtsschutzversicherung',
    '\u2611 Gewerbeversicherungen     \u2611 Baufinanzierung / Immobilienkredite     \u2611 Geldanlage / Investment     \u2611 Sonstige'
  ];
  doc.font('Helvetica').fontSize(6).fillColor('#333');
  areas.forEach(line => {
    doc.text(line, ml + 8, y, { width: cw - 16 });
    y += 10;
  });
  y += 4;

  // ===== SECTION 3: AUTHORISATION =====
  y = sectionHeader('3. VOLLMACHT UND BEFUGNISSE', y);

  doc.fillColor('#333').font('Helvetica').fontSize(6.5)
    .text(
      'Der Auftraggeber bevollm\u00e4chtigt den Makler, in seinem Namen und auf seine Rechnung: ' +
      'Versicherungsvertr\u00e4ge zu k\u00fcndigen, umzudecken, abzuschlie\u00dfen oder zu \u00e4ndern; ' +
      'Ausk\u00fcnfte und Unterlagen bei Versicherern, Banken und Bausparkassen einzuholen; ' +
      'Schadensmeldungen zu erstatten und Leistungsanspr\u00fcche geltend zu machen; ' +
      'den Versicherungsschutz zu optimieren; Bestandsdaten zu \u00fcbertragen und zu verarbeiten.',
      ml + 8, y, { width: cw - 16, lineGap: 1 }
    );
  y += 42;

  // ===== SECTION 4: DATA PROTECTION =====
  y = subHeader('4. DATENSCHUTZ (DSGVO Art. 6, 13, 14)', y);

  doc.fillColor('#333').font('Helvetica').fontSize(6)
    .text(
      'Der Auftraggeber willigt ein, dass der Makler personenbezogene Daten zum Zwecke der Vertragsvermittlung, ' +
      '-verwaltung und -betreuung erhebt, verarbeitet und an Produktgeber \u00fcbermittelt. ' +
      'Die Einwilligung ist jederzeit widerrufbar. Weitere Informationen gem. Art. 13/14 DSGVO wurden ausgeh\u00e4ndigt.',
      ml + 8, y, { width: cw - 16, lineGap: 1 }
    );
  y += 30;

  // ===== SECTION 5: EXISTING CONTRACTS =====
  y = subHeader('5. BESTEHENDE VERTR\u00c4GE (soweit bekannt)', y);

  formField('contract1', 'Vertrag 1 (Gesellschaft / Sparte / Vertragsnr.)', ml + 8, y, cw - 16);
  y += 24;
  formField('contract2', 'Vertrag 2', ml + 8, y, cw - 16);
  y += 24;
  formField('contract3', 'Vertrag 3', ml + 8, y, cw - 16);
  y += 28;

  // ===== SECTION 6: SIGNATURES =====
  y = sectionHeader('6. UNTERSCHRIFTEN', y);

  doc.fillColor('#333').font('Helvetica').fontSize(6)
    .text(
      'Mit der Unterschrift best\u00e4tigt der Auftraggeber, die Maklervereinbarung gelesen und verstanden zu haben. Die Vollmacht gilt bis auf Widerruf.',
      ml + 8, y, { width: cw - 16, lineGap: 1 }
    );
  y += 18;

  // Date + Location field
  formField('signDate', 'Ort, Datum', ml + 8, y, 170);
  y += ROW_H;

  // --- Client signature ---
  doc.fillColor('#666').font('Helvetica').fontSize(6)
    .text('Unterschrift Auftraggeber / Mandant', ml + 8, y);
  y += 9;

  const clientSigTag = '##SIG{role:"Kunde",displayname:"Unterschrift Auftraggeber",x:"0cm",y:"0cm",w:"7cm",h:"1.2cm"}';
  doc.font('Helvetica').fontSize(2).fillColor('#ffffff')
    .text(clientSigTag, ml + 8, y);
  y += 38;

  // --- Broker signature (static vector) ---
  doc.fillColor('#666').font('Helvetica').fontSize(6)
    .text('Unterschrift Makler / Vermittler', ml + 8, y);
  y += 10;

  const sx = ml + 12;
  const sy = y + 4;
  doc.save();
  doc.lineWidth(1.8).strokeColor('#1a237e').lineCap('round').lineJoin('round');
  doc.moveTo(sx, sy + 10)
    .bezierCurveTo(sx + 8, sy - 8, sx + 20, sy - 12, sx + 28, sy)
    .bezierCurveTo(sx + 36, sy + 12, sx + 22, sy + 18, sx + 32, sy + 8)
    .bezierCurveTo(sx + 42, sy - 2, sx + 48, sy - 6, sx + 56, sy + 4)
    .stroke();
  doc.lineWidth(1.4);
  doc.moveTo(sx + 60, sy + 2)
    .bezierCurveTo(sx + 65, sy - 4, sx + 72, sy - 2, sx + 68, sy + 6)
    .stroke();
  doc.lineWidth(1.6);
  doc.moveTo(sx + 74, sy + 8)
    .bezierCurveTo(sx + 82, sy - 4, sx + 95, sy - 6, sx + 105, sy + 2)
    .bezierCurveTo(sx + 115, sy + 10, sx + 108, sy + 14, sx + 120, sy + 6)
    .bezierCurveTo(sx + 132, sy - 2, sx + 140, sy + 2, sx + 155, sy + 4)
    .bezierCurveTo(sx + 170, sy + 6, sx + 178, sy - 2, sx + 190, sy + 4)
    .stroke();
  doc.lineWidth(0.8).strokeColor('#1a237e').opacity(0.4);
  doc.moveTo(sx, sy + 18)
    .bezierCurveTo(sx + 60, sy + 20, sx + 140, sy + 16, sx + 200, sy + 18)
    .stroke();
  doc.restore();

  y += 26;
  doc.fillColor('#888').font('Helvetica').fontSize(5.5)
    .text('S. Fischer, Gesch\u00e4ftsf\u00fchrer \u2014 FinanzTeam Muster GmbH', ml + 8, y);
  y += 10;

  // ===== PAGE OVERFLOW GUARD =====
  // If content exceeds the footer boundary, fail the build immediately.
  // This catches layout overflows at startup, not in the user's browser.
  if (y > FOOTER_Y) {
    doc.end();
    // Clean up the partial file
    stream.on('finish', () => {
      try { fs.unlinkSync(TEMPLATE_PATH); } catch (_) {}
    });
    throw new Error(
      `PDF LAYOUT OVERFLOW: content ends at y=${Math.round(y)}pt but footer starts at y=${Math.round(FOOTER_Y)}pt. ` +
      `Over by ${Math.round(y - FOOTER_Y)}pt (${Math.round((y - FOOTER_Y) / 2.835)}mm). ` +
      `Tighten spacing or reduce content to fit on one page.`
    );
  }

  // --- Footer ---
  doc.rect(0, FOOTER_Y, pageW, FOOTER_H).fill('#f5f5f5');
  doc.fillColor('#999').font('Helvetica').fontSize(5)
    .text('Maklermandat \u2014 Demo-Dokument zu Testzwecken  |  \u00a9 FinanzTeam Muster GmbH  |  Erstellt mit Sig-Funnel',
      ml, FOOTER_Y + 7, { width: cw, align: 'center' });

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      console.log(`[pdf-generator] Template created. Content ends at y=${Math.round(y)}pt, footer at y=${Math.round(FOOTER_Y)}pt — ${Math.round(FOOTER_Y - y)}pt remaining.`);
      resolve();
    });
    stream.on('error', reject);
  });
}

// ============================================================================
// getTemplateAndFields — Build the preFilledFields array for a user
// ============================================================================
function getTemplateAndFields(userData) {
  const preFilledFields = [
    { id: 'title',       type: 'text', text: userData.title || '' },
    { id: 'firstName',   type: 'text', text: userData.firstName || '' },
    { id: 'lastName',    type: 'text', text: userData.lastName || '' },
    { id: 'birthdate',   type: 'text', text: userData.birthdate || '' },
    { id: 'birthplace',  type: 'text', text: userData.birthplace || '' },
    { id: 'nationality', type: 'text', text: userData.nationality || '' },
    { id: 'street',      type: 'text', text: userData.street || '' },
    { id: 'zip',         type: 'text', text: userData.zip || '' },
    { id: 'city',        type: 'text', text: userData.city || '' },
    { id: 'country',     type: 'text', text: userData.country || '' },
    { id: 'phone',       type: 'text', text: userData.phone || '' },
    { id: 'email',       type: 'text', text: userData.email || '' },
    { id: 'idType',      type: 'text', text: userData.idType || '' },
    { id: 'idNumber',    type: 'text', text: userData.idNumber || '' },
    { id: 'contract1',   type: 'text', text: userData.contract1 || '' },
    { id: 'contract2',   type: 'text', text: userData.contract2 || '' },
    { id: 'contract3',   type: 'text', text: userData.contract3 || '' },
    { id: 'signDate',    type: 'text', text: userData.signDate || '' }
  ];
  return { templatePath: TEMPLATE_PATH, preFilledFields };
}

module.exports = { ensureTemplate, getTemplateAndFields, TEMPLATE_PATH };
