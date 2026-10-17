// Peanut, the gameplay sprite. Drawn from scratch as a top-down illustration (no photo is used in play).
//
// Peanut is a tiny Jack Russell Terrier: a mostly white body with rust-tan patches on the back and
// head, semi-erect ears, a compact body and a short tail. The master drawing faces up and is painted
// once into a canvas. Other directions are the same drawing turned, and animation states (idle breath,
// hop lift, landing squash, splat tumble) are transforms on that drawing, so each state reads clearly.
(function (global) {
  'use strict';

  const SIZE = 128;      // master canvas, in drawing units
  const DRAW = 68;       // on-screen size in logical pixels
  const INK = '#4a2a16';
  const TAN = '#c77d43';
  const TAN_DARK = '#9a5a2c';
  const WHITE = '#fffdf8';
  const COLLAR = '#e4572e';
  const TAU = Math.PI * 2;

  function ellipsePath(g, x, y, rx, ry) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
  }

  function outlined(g, fill, lineW = 2.6) {
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = lineW;
    g.strokeStyle = INK;
    g.stroke();
  }

  function paintMaster(g) {
    g.clearRect(0, 0, SIZE, SIZE);
    g.lineJoin = 'round';

    // Tail: a short stub at the rear, tan tip.
    g.beginPath();
    g.moveTo(58, 100);
    g.quadraticCurveTo(54, 118, 64, 122);
    g.quadraticCurveTo(74, 118, 70, 100);
    g.closePath();
    outlined(g, WHITE);
    ellipsePath(g, 64, 119, 5.5, 4.5);
    g.fillStyle = TAN;
    g.fill();

    // Hind paws, then front paws tucked at the shoulders.
    for (const [x, y] of [[45, 104], [83, 104]]) {
      ellipsePath(g, x, y, 9.5, 7.5);
      outlined(g, WHITE);
      g.beginPath();
      g.moveTo(x - 4, y + 4); g.lineTo(x - 4, y + 7);
      g.moveTo(x + 4, y + 4); g.lineTo(x + 4, y + 7);
      g.lineWidth = 1.4; g.strokeStyle = INK; g.stroke();
    }
    for (const [x, y] of [[41, 54], [87, 54]]) {
      ellipsePath(g, x, y, 9, 8);
      outlined(g, WHITE);
    }

    // Body: white, with a rust saddle over the back and a patch on the hips.
    ellipsePath(g, 64, 74, 30, 37);
    const body = g.createLinearGradient(34, 40, 94, 110);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(1, '#efe4d6');
    outlined(g, body);

    g.save();
    ellipsePath(g, 64, 74, 30, 37);
    g.clip();
    const saddle = g.createRadialGradient(60, 66, 6, 62, 72, 26);
    saddle.addColorStop(0, TAN);
    saddle.addColorStop(1, TAN_DARK);
    ellipsePath(g, 62, 70, 20, 24);
    g.fillStyle = saddle;
    g.fill();
    ellipsePath(g, 42, 98, 8, 6);
    g.fillStyle = TAN;
    g.fill();
    ellipsePath(g, 86, 90, 5, 4);
    g.fillStyle = TAN;
    g.fill();
    g.restore();

    // Collar with a small tag, the only bright accent on the dog.
    g.beginPath();
    g.moveTo(43, 49);
    g.quadraticCurveTo(64, 56, 85, 49);
    g.lineWidth = 4.5; g.strokeStyle = COLLAR; g.lineCap = 'round'; g.stroke();
    g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke();
    ellipsePath(g, 64, 56, 3, 3);
    g.fillStyle = '#ffd166';
    g.fill();
    g.lineWidth = 1; g.strokeStyle = INK; g.stroke();

    // Ears: semi-erect and tan, with a darker inner edge.
    for (const side of [-1, 1]) {
      const x = 64 + side * 20;
      g.beginPath();
      g.moveTo(x - side * 4, 22);
      g.quadraticCurveTo(x + side * 2, 4, x + side * 14, 6);
      g.quadraticCurveTo(x + side * 10, 18, x + side * 1, 28);
      g.closePath();
      outlined(g, TAN);
      g.beginPath();
      g.moveTo(x - side * 1, 20);
      g.quadraticCurveTo(x + side * 3, 10, x + side * 9, 10);
      g.quadraticCurveTo(x + side * 6, 16, x - side * 1, 23);
      g.fillStyle = TAN_DARK;
      g.fill();
    }

    // Head: white with a tan cap and a tan cheek.
    ellipsePath(g, 64, 34, 24, 23);
    const head = g.createLinearGradient(44, 14, 84, 52);
    head.addColorStop(0, '#ffffff');
    head.addColorStop(1, '#f2e8da');
    outlined(g, head);
    g.save();
    ellipsePath(g, 64, 34, 24, 23);
    g.clip();
    ellipsePath(g, 60, 18, 17, 10);
    g.fillStyle = TAN;
    g.fill();
    ellipsePath(g, 80, 40, 7, 6);
    g.fillStyle = TAN;
    g.fill();
    g.restore();

    // Muzzle and nose at the front of the head.
    ellipsePath(g, 64, 24, 9, 7);
    g.fillStyle = WHITE;
    g.fill();
    ellipsePath(g, 64, 19.5, 4.6, 3.4);
    g.fillStyle = '#1d120a';
    g.fill();
    ellipsePath(g, 62.8, 18.6, 1.2, 0.9);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fill();

    // Eyes with a small highlight, set a little forward so the face reads at a glance.
    for (const x of [55, 73]) {
      ellipsePath(g, x, 33, 4.2, 4.6);
      g.fillStyle = '#1d120a';
      g.fill();
      ellipsePath(g, x + 1.3, 31.6, 1.3, 1.3);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fill();
    }

    // Highlight on the back for a little polish.
    g.beginPath();
    g.ellipse(56, 58, 9, 14, -0.3, 0, TAU);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fill();
  }

  function createSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    paintMaster(canvas.getContext('2d'));
    return canvas;
  }

  // Direction to rotation: the master faces up.
  const ANGLE = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };

  // Draws Peanut centred on (x, y). `pose` is idle | hop | land | splat.
  function draw(ctx, sprite, x, y, opts) {
    const { dir = 'up', pose = 'idle', t = 0, lift = 0, landT = 0, splatT = 0, alpha = 1, size = DRAW, shrink = 0 } = opts;
    let sx = 1;
    let sy = 1;
    let angle = ANGLE[dir] || 0;
    let a = alpha;
    let dy = 0;

    if (pose === 'idle') {
      const breath = Math.sin(t * 4.2);
      sx = 1 - 0.012 * breath;
      sy = 1 + 0.018 * breath;
    } else if (pose === 'hop') {
      sx = 1 - 0.07 * lift;
      sy = 1 + 0.16 * lift;
      dy = -lift * 12;
    } else if (pose === 'land') {
      const k = Math.min(1, landT / 0.1);
      sx = 1 + 0.16 * (1 - k);
      sy = 1 - 0.14 * (1 - k);
    } else if (pose === 'splat') {
      const k = Math.min(1, splatT / 0.7);
      angle += k * TAU * 1.5;
      sx = 1 + 0.25 * k;
      sy = 1 - 0.35 * k;
      a = alpha * Math.max(0, 1 - Math.max(0, (splatT - 0.5) / 0.45));
    }

    // Stepping through a doorway: Peanut shrinks and fades into the house.
    sx *= 1 - 0.75 * shrink;
    sy *= 1 - 0.75 * shrink;
    a *= 1 - shrink;

    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate(x, y + dy);
    ctx.rotate(angle);
    ctx.scale(sx, sy);
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  global.Dogger = global.Dogger || {};
  global.Dogger.Peanut = { createSprite, draw, DRAW, ANGLE };
})(window);
