'use strict';

/* ==========================================================================
   Getting Started Guide - Confetti State & Animation
   ========================================================================== */

function isConfettiEnabled() {
    var match = document.cookie.split(';').find(function (c) {
        return c.trim().indexOf('insign_confetti=') === 0;
    });
    // Default: enabled (no cookie or cookie=on)
    if (!match) return true;
    return match.trim().split('=')[1] !== 'off';
}

function setConfettiEnabled(on) {
    document.cookie = 'insign_confetti=' + (on ? 'on' : 'off') + '; max-age=' + (60 * 60 * 24 * 365) + '; path=/; SameSite=Lax';
    // Sync all toggle checkboxes on the page
    document.querySelectorAll('.confetti-toggle input').forEach(function (cb) { cb.checked = on; });
}

function toggleConfetti(cb) {
    setConfettiEnabled(cb.checked);
    if (cb.checked) launchConfetti();
}

/* ==========================================================================
   CONFETTI CANNON - realistic ribbon/circle particles with shimmer
   ========================================================================== */

var confettiAnimId = null;

function launchConfetti(multiplier) {
    var mul = multiplier || 1;
    var canvas = document.getElementById('confetti-canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var W = canvas.width, H = canvas.height;

    // Cancel any running animation
    if (confettiAnimId) cancelAnimationFrame(confettiAnimId);

    var pieces = [];
    var colors = ['#ff4757', '#ffd93d', '#2ed573', '#1e90ff', '#ff6b6b', '#a55eea', '#ff9f43', '#00d2d3', '#f368e0'];

    // Shapes: 0=ribbon, 1=circle, 2=star, 3=streamer
    // Reduced count: 150 base (was 500) — still looks full, much lighter
    var count = Math.round(150 * mul);

    // Two cannons: bottom-left and bottom-right
    var cannons = [
        { x: W * 0.15, y: H + 20, angle: -75, spread: 30 },
        { x: W * 0.85, y: H + 20, angle: -105, spread: 30 }
    ];

    for (var i = 0; i < count; i++) {
        var cannon = cannons[i % cannons.length];
        var a = (cannon.angle + (Math.random() - 0.5) * cannon.spread) * Math.PI / 180;
        var speed = 18 + Math.random() * 14;
        var col = colors[Math.floor(Math.random() * colors.length)];
        var shape = Math.random();
        // Simplified: only ribbons (rects) and circles — drop stars and streamers
        var shapeType = shape < 0.55 ? 0 : 1;

        var sizeRoll = Math.random();
        var sizeMul = sizeRoll < 0.25 ? (0.3 + Math.random() * 0.3) : sizeRoll < 0.75 ? 1 : (1.5 + Math.random() * 1);

        pieces.push({
            x: cannon.x + (Math.random() - 0.5) * 30,
            y: cannon.y,
            vx: Math.cos(a) * speed + (Math.random() - 0.5) * 3,
            vy: Math.sin(a) * speed + (Math.random() - 0.5) * 2,
            w: (Math.random() * 10 + 6) * sizeMul,
            h: (Math.random() * 7 + 4) * sizeMul,
            color: col,
            shape: shapeType,
            rot: Math.random() * 360,
            rotV: (Math.random() - 0.5) * 15,
            tiltAngle: Math.random() * Math.PI * 2,
            tiltSpeed: 0.03 + Math.random() * 0.06,
            opacity: 1,
            drag: 0.98 + Math.random() * 0.015,
            scale: 0.7 + Math.random() * 0.6
        });
    }

    // Balloons: reduced from 20 to 8
    var balloonColors = ['#ff4757', '#ffd93d', '#2ed573', '#1e90ff', '#a55eea', '#ff9f43', '#f368e0', '#00d2d3'];
    for (var b = 0; b < 8; b++) {
        pieces.push({
            x: Math.random() * W,
            y: H + 40 + Math.random() * 200,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -(2.5 + Math.random() * 2),
            w: 18 + Math.random() * 10,
            h: 22 + Math.random() * 12,
            color: balloonColors[b],
            shape: 4, // balloon
            rot: 0,
            rotV: (Math.random() - 0.5) * 2,
            tiltAngle: Math.random() * Math.PI * 2,
            tiltSpeed: 0.015 + Math.random() * 0.02,
            opacity: 1,
            drag: 0.998,
            scale: 0.8 + Math.random() * 0.4,
            isBalloon: true
        });
    }

    var startTime = Date.now();
    var duration = Math.round(4500 * Math.min(mul, 3));
    // Precompute constants
    var PI180 = Math.PI / 180;
    var TAU = Math.PI * 2;

    function draw() {
        var elapsed = Date.now() - startTime;
        if (elapsed > duration) {
            ctx.clearRect(0, 0, W, H);
            confettiAnimId = null;
            return;
        }

        ctx.clearRect(0, 0, W, H);
        var fadeStart = duration * 0.65;
        var fadeRange = duration - fadeStart;
        var isFading = elapsed > fadeStart;

        for (var i = pieces.length - 1; i >= 0; i--) {
            var p = pieces[i];

            // Physics
            p.vx *= p.drag;
            p.vy *= p.drag;
            if (p.isBalloon) {
                p.vy -= 0.02;
                p.vx += Math.sin(p.tiltAngle) * 0.3;
            } else {
                p.vy += 0.25;
            }
            p.vx += Math.sin(p.tiltAngle) * 0.15;
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.rotV;
            p.tiltAngle += p.tiltSpeed;

            // Cull off-screen particles (with margin for large scaled pieces)
            if (p.y > H + 80 || p.y < -80 || p.x < -80 || p.x > W + 80) {
                pieces.splice(i, 1);
                continue;
            }

            // Fade out
            if (isFading) {
                p.opacity = Math.max(0, 1 - (elapsed - fadeStart) / fadeRange);
            }
            if (p.opacity <= 0) { pieces.splice(i, 1); continue; }

            var tiltX = Math.cos(p.tiltAngle);

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.globalAlpha = p.opacity;

            if (p.isBalloon) {
                ctx.rotate(Math.sin(p.tiltAngle) * 0.15);
                ctx.scale(p.scale, p.scale);
                // Simplified balloon: just an ellipse + knot triangle
                var bw = p.w * 0.5, bh = p.h * 0.55;
                ctx.beginPath();
                ctx.ellipse(0, 0, bw, bh, 0, 0, TAU);
                ctx.fillStyle = p.color;
                ctx.fill();
                // Knot
                ctx.beginPath();
                ctx.moveTo(-2, bh);
                ctx.lineTo(0, bh + 4);
                ctx.lineTo(2, bh);
                ctx.fill();
            } else {
                ctx.rotate(p.rot * PI180);
                ctx.scale(tiltX * p.scale, p.scale);
                var w = p.w, h = p.h;

                if (p.shape === 0) {
                    // Ribbon: simple filled rect (no rounded corners — much cheaper)
                    ctx.fillStyle = p.color;
                    ctx.fillRect(-w / 2, -h / 2, w, h);
                } else {
                    // Circle
                    var rad = Math.min(w, h) * 0.45;
                    ctx.beginPath();
                    ctx.arc(0, 0, rad, 0, TAU);
                    ctx.fillStyle = p.color;
                    ctx.fill();
                }
            }

            ctx.restore();
        }

        confettiAnimId = requestAnimationFrame(draw);
    }
    confettiAnimId = requestAnimationFrame(draw);
}
