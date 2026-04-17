// ---------------------------------------------------------------------------
// signature-path.js - Converts text + handwriting font into drawable points.
//
// Uses opentype.js to parse a .ttf font, then traces the upper edge of each
// glyph outline to produce a single pen-stroke path. For cursive handwriting
// fonts, the top edge closely follows the original pen path.
//
// Usage:
//   const { buildSignaturePath } = require('./signature-path');
//   const points = buildSignaturePath('Chris Signlord', {
//     fontPath: __dirname + '/fonts/DancingScript.ttf',
//     canvasBox: { x: 100, y: 200, width: 600, height: 200 }
//   });
// ---------------------------------------------------------------------------

const opentype = require('opentype.js');
const nodePath = require('path');

const DEFAULT_FONT = nodePath.join(__dirname, 'fonts', 'DancingScript.ttf');

// -- Bezier flattening ------------------------------------------------------

function flattenQ(x0, y0, x1, y1, x2, y2, n) {
  const pts = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push({ x: u*u*x0 + 2*u*t*x1 + t*t*x2, y: u*u*y0 + 2*u*t*y1 + t*t*y2 });
  }
  return pts;
}

function flattenC(x0, y0, x1, y1, x2, y2, x3, y3, n) {
  const pts = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push({
      x: u*u*u*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3,
      y: u*u*u*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3
    });
  }
  return pts;
}

// -- Path extraction --------------------------------------------------------

function extractContours(commands) {
  const contours = [];
  let cur = [];
  let cx = 0, cy = 0;
  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
        if (cur.length > 0) contours.push(cur);
        cur = [{ x: cmd.x, y: cmd.y }];
        cx = cmd.x; cy = cmd.y;
        break;
      case 'L':
        cur.push({ x: cmd.x, y: cmd.y });
        cx = cmd.x; cy = cmd.y;
        break;
      case 'Q':
        cur.push(...flattenQ(cx, cy, cmd.x1, cmd.y1, cmd.x, cmd.y, 8));
        cx = cmd.x; cy = cmd.y;
        break;
      case 'C':
        cur.push(...flattenC(cx, cy, cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y, 10));
        cx = cmd.x; cy = cmd.y;
        break;
      case 'Z':
        if (cur.length > 0) contours.push(cur);
        cur = [];
        break;
    }
  }
  if (cur.length > 0) contours.push(cur);
  return contours;
}

// -- Upper-edge extraction --------------------------------------------------

/**
 * For a closed contour, extract the "top half" - the portion from leftmost
 * to rightmost point that passes through the topmost region (minimum y in
 * font coordinates where y-axis is inverted).
 *
 * For a clockwise contour (standard TrueType outer outlines), this traces
 * the upper edge of the letter shape, which closely follows the pen stroke
 * in handwriting fonts.
 */
function extractTopHalf(contour) {
  if (contour.length < 3) return contour;

  // Find leftmost and rightmost point indices
  let leftIdx = 0, rightIdx = 0;
  for (let i = 1; i < contour.length; i++) {
    if (contour[i].x < contour[leftIdx].x) leftIdx = i;
    if (contour[i].x > contour[rightIdx].x) rightIdx = i;
  }

  // Extract two halves: leftIdx -> rightIdx going both ways around the contour
  const n = contour.length;
  const pathA = []; // one direction
  const pathB = []; // other direction

  // Path A: leftIdx to rightIdx going forward
  for (let i = leftIdx; ; i = (i + 1) % n) {
    pathA.push(contour[i]);
    if (i === rightIdx) break;
    if (pathA.length > n) break; // safety
  }

  // Path B: leftIdx to rightIdx going backward
  for (let i = leftIdx; ; i = (i - 1 + n) % n) {
    pathB.push(contour[i]);
    if (i === rightIdx) break;
    if (pathB.length > n) break;
  }

  // Pick the half with the lower average y (= higher on screen = top edge)
  const avgY = pts => pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return avgY(pathA) < avgY(pathB) ? pathA : pathB;
}

// -- Smoothing --------------------------------------------------------------

function smooth(pts, radius) {
  if (pts.length < 3 || radius < 1) return pts;
  const result = [pts[0]]; // keep first point
  for (let i = 1; i < pts.length - 1; i++) {
    let sx = 0, sy = 0, count = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(pts.length - 1, i + radius); j++) {
      sx += pts[j].x;
      sy += pts[j].y;
      count++;
    }
    result.push({ x: sx / count, y: sy / count });
  }
  result.push(pts[pts.length - 1]); // keep last point
  return result;
}

function subsample(pts, n) {
  if (pts.length <= n) return pts;
  const result = [pts[0]];
  const step = (pts.length - 1) / (n - 1);
  for (let i = 1; i < n - 1; i++) result.push(pts[Math.round(i * step)]);
  result.push(pts[pts.length - 1]);
  return result;
}

// -- Main -------------------------------------------------------------------

/**
 * Build a drawable signature path from text and a handwriting font.
 *
 * @param {string} text - The name to sign
 * @param {object} opts
 * @param {string} [opts.fontPath] - Path to .ttf font file
 * @param {{x,y,width,height}} opts.canvasBox - Canvas bounding box (viewport coords)
 * @param {number} [opts.fontSize] - Font size in px (auto-fit if omitted)
 * @param {number} [opts.padding] - Padding inside canvas (default: 15% of height)
 * @param {number} [opts.pointsPerGlyph] - Points per glyph stroke (default: 30)
 * @param {number} [opts.smoothRadius] - Smoothing window radius (default: 3)
 * @returns {Array} Array of {x,y} points and null (pen lift)
 */
function buildSignaturePath(text, opts = {}) {
  const fontPath = opts.fontPath || DEFAULT_FONT;
  const box = opts.canvasBox;
  const padding = opts.padding != null ? opts.padding : box.height * 0.15;
  const pointsPerGlyph = opts.pointsPerGlyph || 30;
  const smoothRadius = opts.smoothRadius != null ? opts.smoothRadius : 3;

  const font = opentype.loadSync(fontPath);

  // Auto-size to fit the padded canvas area
  const availW = box.width - padding * 2;
  const availH = box.height - padding * 2;
  let fontSize = opts.fontSize || 72;

  if (!opts.fontSize) {
    const testPath = font.getPath(text, 0, 0, fontSize);
    const tb = testPath.getBoundingBox();
    const scaleW = availW / (tb.x2 - tb.x1);
    const scaleH = availH / (tb.y2 - tb.y1);
    fontSize = fontSize * Math.min(scaleW, scaleH) * 0.85;
  }

  // Process each glyph individually to extract its top-edge stroke
  const glyphs = font.stringToGlyphs(text);
  let xCursor = 0;
  const glyphStrokes = [];

  for (let gi = 0; gi < glyphs.length; gi++) {
    const g = glyphs[gi];

    if (g.unicode === 32) {
      // Space: just advance cursor
      xCursor += g.advanceWidth * (fontSize / font.unitsPerEm);
      if (gi < glyphs.length - 1) {
        xCursor += font.getKerningValue(g, glyphs[gi + 1]) * (fontSize / font.unitsPerEm);
      }
      continue;
    }

    const gPath = g.getPath(xCursor, 0, fontSize);
    const contours = extractContours(gPath.commands);

    if (contours.length > 0) {
      // Find the largest contour (outer outline)
      let largest = contours[0];
      let largestArea = 0;
      for (const c of contours) {
        const xs = c.map(p => p.x), ys = c.map(p => p.y);
        const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
        if (area > largestArea) { largestArea = area; largest = c; }
      }

      // Extract top half, subsample, and smooth
      let stroke = extractTopHalf(largest);
      stroke = subsample(stroke, pointsPerGlyph);
      stroke = smooth(stroke, smoothRadius);

      if (stroke.length > 1) {
        glyphStrokes.push(stroke);
      }
    }

    // Advance cursor with kerning
    const advance = g.advanceWidth * (fontSize / font.unitsPerEm);
    if (gi < glyphs.length - 1) {
      xCursor += advance + font.getKerningValue(g, glyphs[gi + 1]) * (fontSize / font.unitsPerEm);
    } else {
      xCursor += advance;
    }
  }

  if (glyphStrokes.length === 0) return [];

  // Compute bounding box of all strokes
  const allPts = glyphStrokes.flat();
  const bbMinX = Math.min(...allPts.map(p => p.x));
  const bbMaxX = Math.max(...allPts.map(p => p.x));
  const bbMinY = Math.min(...allPts.map(p => p.y));
  const bbMaxY = Math.max(...allPts.map(p => p.y));

  // Transform: center in canvas box
  const offsetX = box.x + (box.width - (bbMaxX - bbMinX)) / 2 - bbMinX;
  const offsetY = box.y + (box.height - (bbMaxY - bbMinY)) / 2 - bbMinY;

  // Build result with pen lifts between disconnected glyphs
  const result = [];
  for (let si = 0; si < glyphStrokes.length; si++) {
    const stroke = glyphStrokes[si];

    if (si > 0) {
      const prev = glyphStrokes[si - 1];
      const prevEnd = prev[prev.length - 1];
      const curStart = stroke[0];
      const dist = Math.hypot(curStart.x - prevEnd.x, curStart.y - prevEnd.y);

      // Pen lift only if there's a significant gap (space between words or
      // disconnected letters). Small gaps = keep pen down for cursive flow.
      if (dist > fontSize * 1.2) {
        result.push(null);
      }
    }

    for (const p of stroke) {
      result.push({ x: p.x + offsetX, y: p.y + offsetY });
    }
  }

  return result;
}

module.exports = { buildSignaturePath };
