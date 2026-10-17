// Dogger rendering: the fixed arcade board, moving traffic, Peanut, HUD, title and overlay screens.
(function (global) {
  'use strict';

  const D = global.Dogger;
  const L = D.Levels;
  const W = L.WIDTH;
  const H = L.HEIGHT;
  const TAU = Math.PI * 2;
  const FONT = '"Trebuchet MS", "Segoe UI", Verdana, system-ui, sans-serif';
  const DISPLAY = '"Arial Black", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';

  const TITLE_BUTTON = { x: 150, y: 430, w: 340, h: 88 };

  // ---------- helpers ----------

  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function glow(ctx, x, y, r, rgb, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${alpha})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  function star(ctx, x, y, outer, inner, points = 5) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + (i * Math.PI) / points;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }

  function paw(ctx, x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.22, s * 0.42, s * 0.34, 0, 0, TAU);
    ctx.fill();
    for (const [dx, dy] of [[-0.42, -0.22], [-0.14, -0.5], [0.14, -0.5], [0.42, -0.22]]) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, s * 0.16, 0, TAU);
      ctx.fill();
    }
  }

  // Outlined text with a soft drop shadow, for a crisp arcade look.
  function text(ctx, str, x, y, size, color, opts = {}) {
    ctx.save();
    ctx.font = `${opts.weight || 900} ${size}px ${opts.family || FONT}`;
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = 'middle';
    if (opts.shadow) {
      ctx.shadowColor = opts.shadow;
      ctx.shadowOffsetY = opts.shadowY === undefined ? size * 0.08 : opts.shadowY;
    }
    if (opts.outline !== false) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = opts.lineWidth || Math.max(3, size * 0.14);
      ctx.strokeStyle = opts.strokeColor || 'rgba(8,24,60,0.92)';
      ctx.strokeText(str, x, y);
    }
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function fmt(n) {
    return Math.floor(n).toLocaleString('en-US');
  }

  // ---------- effects: particles and floating words ----------

  const Effects = {
    burst(list, x, y, o = {}) {
      const count = o.count || 12;
      const speed = o.speed || 170;
      const life = o.life || 0.6;
      const colors = o.colors || ['#FFFFFF'];
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU;
        const s = speed * (0.35 + Math.random() * 0.75);
        list.push({
          kind: o.kind || 'dot',
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - (o.lift || 0),
          g: o.gravity === undefined ? 260 : o.gravity,
          life: life * (0.7 + Math.random() * 0.5),
          max: life,
          size: (o.size || 4) * (0.6 + Math.random() * 0.8),
          color: colors[(Math.random() * colors.length) | 0],
          rot: Math.random() * TAU,
          vr: (Math.random() - 0.5) * 10,
        });
      }
    },

    text(list, str, x, y, color = '#FFE066', size = 26) {
      list.push({ kind: 'text', text: str, x, y, color, size, life: 1.1, max: 1.1 });
    },

    update(list, dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) {
          list.splice(i, 1);
          continue;
        }
        if (p.kind === 'text') {
          p.y -= 34 * dt;
          continue;
        }
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - 2.2 * dt;
        p.rot += p.vr * dt;
      }
    },

    draw(ctx, list) {
      for (const p of list) {
        const k = Math.max(0, p.life / p.max);
        ctx.save();
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.translate(p.x, p.y);
        if (p.kind === 'text') {
          const age = p.max - p.life;
          const pop = age < 0.14 ? 1 + (0.14 - age) * 2.2 : 1;
          ctx.scale(pop, pop);
          text(ctx, p.text, 0, 0, p.size, p.color);
        } else {
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          if (p.kind === 'spark') {
            star(ctx, 0, 0, p.size, p.size * 0.42, 4);
            ctx.fill();
          } else if (p.kind === 'confetti') {
            ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size * k + 1, 0, TAU);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    },
  };

  // ---------- props: obstacles and bones ----------

  function drawCone(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(10,20,30,0.28)';
    ctx.beginPath(); ctx.ellipse(4, 10, 18, 6, 0, 0, TAU); ctx.fill();
    rr(ctx, -15, 4, 30, 7, 3);
    ctx.fillStyle = '#ff7a1a';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-11, 4);
    ctx.lineTo(-2.5, -16);
    ctx.lineTo(2.5, -16);
    ctx.lineTo(11, 4);
    ctx.closePath();
    ctx.fillStyle = '#ff8c3a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-8, -1); ctx.lineTo(8, -1); ctx.lineTo(9, 2.5); ctx.lineTo(-9, 2.5);
    ctx.closePath();
    ctx.fill();
    rr(ctx, -4.5, -20, 9, 5, 2);
    ctx.fillStyle = '#ff7a1a';
    ctx.fill();
    ctx.restore();
  }

  // Roadworks barrier: a two-cell striped plank on legs.
  function drawBarrier(ctx, x, y, w) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(10,20,30,0.28)';
    ctx.beginPath(); ctx.ellipse(4, 12, w * 0.5, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a4f5c';
    ctx.fillRect(-w / 2 + 8, 2, 5, 9);
    ctx.fillRect(w / 2 - 13, 2, 5, 9);
    rr(ctx, -w / 2 + 2, -12, w - 4, 20, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.save();
    rr(ctx, -w / 2 + 2, -12, w - 4, 20, 4);
    ctx.clip();
    ctx.fillStyle = '#ff6b2c';
    for (let sx = -w / 2; sx < w / 2; sx += 18) {
      ctx.beginPath();
      ctx.moveTo(sx, -12); ctx.lineTo(sx + 9, -12); ctx.lineTo(sx + 1, 8); ctx.lineTo(sx - 8, 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }

  // Parked delivery van on a median. Static, two cells wide, and it blocks the cells under it.
  function drawParkedVan(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    // Parked vans use the traffic painter, so they match the vehicles that drive past them.
    D.Vehicles.drawVehicle(ctx, { kind: 'van', w, h, dir: 1, x: 0, y: 0, phase: 0 }, 0);
    ctx.restore();
  }

  function drawBone(ctx, x, y, t, seed) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 3 + seed) * 3);
    ctx.rotate(Math.sin(t * 2 + seed) * 0.15);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 9, 16, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fffbf0';
    ctx.strokeStyle = '#d9b98a';
    ctx.lineWidth = 2;
    for (const [kx, ky] of [[-12, -3], [-12, 3], [12, -3], [12, 3]]) {
      ctx.beginPath(); ctx.arc(kx, ky, 5.5, 0, TAU); ctx.fill(); ctx.stroke();
    }
    rr(ctx, -12, -4, 24, 8, 4);
    ctx.fill();
    ctx.stroke();
    const twinkle = Math.sin(t * 5 + seed);
    if (twinkle > 0.5) {
      ctx.fillStyle = `rgba(255,255,255,${(twinkle - 0.5) * 2})`;
      star(ctx, 14, -12, 6, 2.2, 4);
      ctx.fill();
    }
    ctx.restore();
  }

  // A little white house with a pitched roof, seen from above. The doorway faces the street.
  // Empty houses have a soft beacon; a claimed house has its door open and a paw badge.
  function drawHome(ctx, x, y, filled, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(12,30,20,0.28)';
    ctx.beginPath(); ctx.ellipse(x + 5, y + 20, 32, 8, 0, 0, TAU); ctx.fill();

    if (!filled) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.2 + x * 0.05);
      glow(ctx, x, y + 14, 34, '255,236,160', 0.18 + 0.2 * pulse);
    }

    // Walls.
    rr(ctx, x - 25, y - 4, 50, 26, 3);
    ctx.fillStyle = '#fbfbf6';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#7f8a9c';
    ctx.stroke();
    // Windows.
    for (const wx of [x - 17, x + 9]) {
      rr(ctx, wx, y + 1, 8, 8, 1.5);
      ctx.fillStyle = '#9fdcf5';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#7f8a9c';
      ctx.stroke();
    }
    // Doorway: dark when empty, open and warm once claimed.
    rr(ctx, x - 6, y + 6, 12, 16, 2);
    ctx.fillStyle = filled ? '#ffd166' : '#4e3324';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#4a2f1d';
    ctx.stroke();

    // Pitched roof: two sloping planes with a ridge down the middle.
    ctx.beginPath();
    ctx.moveTo(x - 31, y - 3);
    ctx.lineTo(x - 26, y - 25);
    ctx.lineTo(x + 26, y - 25);
    ctx.lineTo(x + 31, y - 3);
    ctx.closePath();
    const roof = ctx.createLinearGradient(0, y - 25, 0, y - 3);
    roof.addColorStop(0, '#ffffff');
    roof.addColorStop(1, '#dde5ef');
    ctx.fillStyle = roof;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#7f8a9c';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 26, y - 14);
    ctx.lineTo(x + 26, y - 14);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(90,100,120,0.55)';
    ctx.stroke();
    // Chimney.
    ctx.fillStyle = '#c9785b';
    ctx.fillRect(x + 13, y - 33, 6, 10);

    if (filled) {
      paw(ctx, x + 30, y - 30, 14, '#7CF2C4');
    }
    ctx.restore();
  }

  // ---------- Peanut ----------

  function drawDog(ctx, game) {
    const dog = game.dog;
    if (!dog || !game.peanutSprite) return;
    const size = Math.min(68, Math.round(game.level.geo.laneH * 1.2));
    const opts = { dir: dog.dir, t: game.t, alpha: 1, size };
    if (dog.state === 'hop') {
      opts.pose = 'hop';
      opts.lift = dog.lift;
    } else if (dog.state === 'dead') {
      opts.pose = 'splat';
      opts.splatT = dog.t;
    } else if (dog.state === 'enter') {
      opts.pose = 'idle';
      opts.shrink = Math.min(1, dog.t / 0.45);
    } else if (dog.state === 'spawn') {
      opts.pose = 'idle';
      opts.alpha = Math.min(1, dog.t / 0.35);
    } else if (dog.landT !== null && dog.landT !== undefined) {
      opts.pose = 'land';
      opts.landT = dog.landT;
    } else {
      opts.pose = 'idle';
    }

    // Contact shadow stays on the ground while Peanut hops.
    const lift = opts.lift || 0;
    ctx.save();
    ctx.globalAlpha = Math.max(0, opts.alpha) * 0.9 * (1 - lift * 0.45);
    ctx.fillStyle = 'rgba(10,22,30,0.32)';
    ctx.beginPath();
    ctx.ellipse(dog.x + 3, dog.y + 14, (16 - lift * 3) * (dog.state === 'dead' ? 1.2 : 1), 5 - lift, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    D.Peanut.draw(ctx, game.peanutSprite, dog.x, dog.y, opts);
  }

  // ---------- HUD ----------

  function drawHUD(ctx, game) {
    ctx.save();
    const bar = ctx.createLinearGradient(0, 0, 0, L.HUD_H);
    bar.addColorStop(0, 'rgba(10,22,46,0.92)');
    bar.addColorStop(1, 'rgba(10,22,46,0.7)');
    ctx.fillStyle = bar;
    ctx.fillRect(0, 0, W, L.HUD_H);
    ctx.fillStyle = 'rgba(255,209,102,0.85)';
    ctx.fillRect(0, L.HUD_H - 2, W, 2);

    text(ctx, 'SCORE', 26, 20, 13, '#9FC4FF', { align: 'left', outline: false, weight: 800 });
    text(ctx, fmt(game.score), 26, 42, 30, '#FFFFFF', { align: 'left', family: DISPLAY, weight: 400, outline: false });

    const label = `LEVEL ${game.levelIndex + 1}  ${game.level.def.name.toUpperCase()}`;
    text(ctx, label, W / 2, 20, 16, '#FFE066', { weight: 900, outline: false, family: DISPLAY });
    const need = game.level.def.crossings;
    const startX = W / 2 - ((need - 1) * 14) / 2;
    for (let i = 0; i < need; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * 14, 42, 5, 0, TAU);
      ctx.fillStyle = i < game.crossings ? '#FFE066' : 'rgba(255,255,255,0.22)';
      ctx.fill();
    }

    for (let i = 0; i < 5; i++) {
      const filled = i < game.lives;
      paw(ctx, W - 40 - i * 30, 32, 24, filled ? '#FFE066' : 'rgba(255,255,255,0.16)');
    }

    if (game.combo > 1 && game.comboTimer > 0) {
      const mult = Math.min(game.combo, 5);
      const pulse = 1 + 0.05 * Math.sin(game.t * 10);
      ctx.save();
      ctx.translate(W / 2, L.HUD_H + 26);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(255,79,160,0.92)';
      rr(ctx, -120, -16, 240, 32, 16);
      ctx.fill();
      text(ctx, `BONE COMBO x${mult}`, 0, 0, 18, '#FFFFFF', { outline: false, family: DISPLAY, weight: 400 });
      ctx.restore();
      ctx.fillStyle = 'rgba(255,79,160,0.9)';
      rr(ctx, W / 2 - 120, L.HUD_H + 44, 240 * (game.comboTimer / 5), 5, 3);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- world ----------

  function drawWorld(ctx, game) {
    const { level } = game;
    ctx.save();
    if (game.shakeT > 0) {
      const m = game.shakeMag * game.shakeT;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    if (game.boardCanvas) ctx.drawImage(game.boardCanvas, 0, 0, W, H);

    // The start mat is part of the board, but it has to pulse so the start is easy to find.
    const sx = L.colX(L.START_COL);
    const sy = L.rowY(level.geo, 0);
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(game.t * 2.4);
    glow(ctx, sx, sy, 60, '255,240,170', 0.5);
    ctx.restore();

    // Goal row: soft pulsing glow so the destination is obvious from anywhere on the board.
    const gy = L.rowY(level.geo, level.goalRow);
    for (let c = 0; c < L.COLS; c++) {
      const pulse = 0.5 + 0.5 * Math.sin(game.t * 3 + c * 0.7);
      glow(ctx, L.colX(c), gy, 44, '255,220,120', 0.10 + 0.14 * pulse);
    }

    for (const o of level.obstacles) {
      const cx = L.colX(o.col) + ((o.span - 1) * L.COL_W) / 2;
      const y = L.rowY(level.geo, o.row);
      if (o.kind === 'cone') drawCone(ctx, cx, y);
      else if (o.kind === 'barrier') drawBarrier(ctx, cx, y, o.span * L.COL_W - 14);
      else if (o.kind === 'van') drawParkedVan(ctx, cx, y, o.span * L.COL_W - 10, Math.min(level.geo.heights[o.row] - 6, 46));
    }

    for (const b of game.bones) {
      if (!b.got) drawBone(ctx, L.colX(b.col), L.rowY(level.geo, b.row), game.t, b.seed);
    }

    for (const lane of game.lanes) {
      for (const v of lane.vehicles) D.Vehicles.drawVehicle(ctx, v, game.t);
    }

    const homeY = L.rowY(level.geo, level.goalRow);
    level.homeCols.forEach((col, i) => {
      drawHome(ctx, L.colX(col), homeY, !!(game.homes && game.homes[i]), game.t);
    });

    drawDog(ctx, game);
    Effects.draw(ctx, game.effects);

    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
    vignette.addColorStop(0, 'rgba(10,20,50,0)');
    vignette.addColorStop(1, 'rgba(10,20,50,0.32)');
    ctx.fillStyle = vignette;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.restore();

    drawHUD(ctx, game);
  }

  // ---------- title screen: DOGGER, START GAME, and the real photograph ----------

  const TITLE_BITS = Array.from({ length: 14 }, (_, i) => ({
    x: (i * 149) % W,
    y: (i * 233) % H,
    s: 0.7 + ((i * 37) % 10) / 14,
    seed: i * 1.7,
  }));

  function fitFont(ctx, str, family, weight, maxW, size) {
    ctx.font = `${weight} ${size}px ${family}`;
    const w = ctx.measureText(str).width;
    return w > maxW ? Math.floor(size * (maxW / w)) : size;
  }

  // Arcade marquee lettering: a cream face inside a red ring and a green outer ring, with a hard shadow.
  // The look follows vintage arcade marquees; the letters and palette are Dogger's own.
  function marqueeTitle(ctx, str, x, y, size, centred = false) {
    ctx.save();
    ctx.font = `400 ${size}px ${DISPLAY}`;
    if (centred) x -= ctx.measureText(str).width / 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowOffsetY = size * 0.07;
    ctx.lineWidth = size * 0.2;
    ctx.strokeStyle = '#1f7a4a';
    ctx.strokeText(str, x, y);
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = size * 0.13;
    ctx.strokeStyle = '#d8402c';
    ctx.strokeText(str, x, y);
    ctx.lineWidth = size * 0.04;
    ctx.strokeStyle = '#1b1020';
    ctx.strokeText(str, x, y);
    const face = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
    face.addColorStop(0, '#FFFBEA');
    face.addColorStop(0.55, '#FFE066');
    face.addColorStop(1, '#FFB03B');
    ctx.fillStyle = face;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function drawTitle(ctx, game) {
    const t = game.t;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2B7BFF');
    g.addColorStop(0.55, '#0053DD');
    g.addColorStop(1, '#0339A8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    glow(ctx, 930, 360, 480, '190,220,255', 0.28);

    for (const b of TITLE_BITS) {
      const x = (b.x + t * 8 * b.s) % (W + 80) - 40;
      const y = b.y + Math.sin(t * 0.6 + b.seed) * 12;
      ctx.save();
      ctx.globalAlpha = 0.13;
      ctx.translate(x, y);
      ctx.rotate(t * 0.2 + b.seed);
      ctx.scale(b.s, b.s);
      ctx.fillStyle = '#FFFFFF';
      rr(ctx, -12, -4, 24, 8, 4);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-12, -3, 5, 0, TAU);
      ctx.arc(12, 3, 5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // The photograph of Peanut, on the right. Title screen only.
    const dog = game.dogImg;
    if (dog && dog.naturalWidth) {
      const dh = 560;
      const dw = dh * (dog.naturalWidth / dog.naturalHeight);
      const bob = Math.sin(t * 2.2) * 8;
      ellipse(ctx, 930, 652, dw * 0.34, 18, 'rgba(0,20,80,0.35)');
      ctx.drawImage(dog, 930 - dw / 2, 660 + bob - dh, dw, dh);
    }

    marqueeTitle(ctx, 'DOGGER', 120, 252, fitFont(ctx, 'DOGGER', DISPLAY, 400, 640, 176));

    // Tagline between two red rules, like an arcade marquee.
    const tagY = 340;
    ctx.save();
    ctx.strokeStyle = '#ff4d3d';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const ry of [tagY - 24, tagY + 24]) {
      ctx.beginPath(); ctx.moveTo(122, ry); ctx.lineTo(560, ry); ctx.stroke();
    }
    ctx.restore();
    text(ctx, 'HELP PEANUT CROSS THE STREET!', 341, tagY, 25, '#FFF4DC', { family: DISPLAY, weight: 400, outline: false, shadow: 'rgba(0,0,0,0.45)' });

    if (game.best > 0) {
      text(ctx, `BEST  ${fmt(game.best)}`, 120, 398, 20, '#FFE066', { weight: 800, align: 'left' });
    }

    const pulse = 1 + Math.sin(t * 4) * 0.025;
    const b = TITLE_BUTTON;
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.scale(pulse, pulse);
    ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
    rr(ctx, b.x, b.y + 8, b.w, b.h, 26);
    ctx.fillStyle = '#7A4A00';
    ctx.fill();
    const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    bg.addColorStop(0, '#FFE066');
    bg.addColorStop(1, '#FFB703');
    rr(ctx, b.x, b.y, b.w, b.h, 26);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#0A2466';
    ctx.stroke();
    ctx.restore();
    text(ctx, 'START GAME', b.x + b.w / 2, b.y + b.h / 2, 36, '#0A2466', { outline: false, family: DISPLAY, weight: 400 });

    text(ctx, 'A  /  Enter  /  click', 120, 560, 18, 'rgba(255,255,255,0.85)', { weight: 800, outline: false, align: 'left' });

    if (game.toastT > 0) {
      const msg = game.input.padConnected ? 'Controller ready!' : 'Controller disconnected';
      text(ctx, msg, W / 2, 30, 18, '#7CF2C4', { weight: 800 });
    }

    const note = game.buildWatch.label();
    if (note) text(ctx, note, 120, 620, 17, '#FFE066', { weight: 800, align: 'left' });
  }

  function ellipse(ctx, x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
  }

  function drawLoading(ctx, t) {
    ctx.fillStyle = '#0053DD';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'DOGGER', W / 2, H / 2 - 20, 84, '#FFE066', { family: DISPLAY, weight: 400 });
    text(ctx, `loading${'.'.repeat(1 + (Math.floor(t * 3) % 3))}`, W / 2, H / 2 + 52, 22, '#FFFFFF', { outline: false, weight: 700 });
  }

  // ---------- overlays: intro, pause, clear, game over, win ----------

  function dim(ctx, alpha) {
    ctx.fillStyle = `rgba(6,20,48,${alpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  function drawStars(ctx, count, y) {
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1) * 96;
      const on = i < count;
      ctx.fillStyle = on ? '#FFE066' : 'rgba(255,255,255,0.22)';
      star(ctx, x, y, 38, 17, 5);
      ctx.fill();
      if (on) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#B07A00';
        ctx.stroke();
      }
    }
  }

  function panel(ctx, x, y, w, h) {
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, 'rgba(12,30,62,0.9)');
    grad.addColorStop(1, 'rgba(7,22,52,0.92)');
    ctx.fillStyle = grad;
    rr(ctx, x, y, w, h, 30);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,209,102,0.55)';
    ctx.lineWidth = 2;
    rr(ctx, x, y, w, h, 30);
    ctx.stroke();
  }

  function drawOverlay(ctx, game) {
    const { mode } = game;

    if (mode === 'intro') {
      dim(ctx, 0.3);
      panel(ctx, 380, 170, 520, 300);
      text(ctx, `LEVEL ${game.levelIndex + 1}`, W / 2, 255, 96, '#FFE066', { family: DISPLAY, weight: 400, shadow: 'rgba(0,0,0,0.4)' });
      text(ctx, game.level.def.name, W / 2, 340, 32, '#FFFFFF', { weight: 900 });
      text(ctx, game.level.def.tag, W / 2, 390, 18, '#CFE4FF', { weight: 800, outline: false });
      const label = game.countdownLabel();
      if (label) {
        text(ctx, label, W / 2, 560, label === 'GO!' ? 120 : 150, label === 'GO!' ? '#7CF2C4' : '#FFFFFF', { family: DISPLAY, weight: 400 });
      }
      return;
    }

    if (mode === 'paused') {
      dim(ctx, 0.55);
      panel(ctx, 420, 250, 440, 220);
      text(ctx, 'PAUSED', W / 2, 330, 80, '#FFFFFF', { family: DISPLAY, weight: 400 });
      text(ctx, 'Press Start or P to keep going', W / 2, 410, 20, '#CFE4FF', { weight: 800, outline: false });
      return;
    }

    if (mode === 'clear') {
      dim(ctx, 0.4);
      panel(ctx, 340, 200, 600, 320);
      marqueeTitle(ctx, 'LEVEL CLEAR!', W / 2, 270, 66, true);
      drawStars(ctx, game.stars, 350);
      text(ctx, `Bonus +${fmt(game.lastBonus)}`, W / 2, 430, 30, '#FFE066', { family: DISPLAY, weight: 400, outline: false });
      return;
    }

    if (mode === 'over') {
      dim(ctx, 0.6);
      panel(ctx, 390, 230, 500, 260);
      marqueeTitle(ctx, 'GAME OVER', W / 2, 310, 80, true);
      text(ctx, `Score ${fmt(game.score)}`, W / 2, 396, 32, '#FFFFFF', { weight: 900 });
      text(ctx, 'Peanut needs a nap.', W / 2, 446, 20, '#CFE4FF', { weight: 800, outline: false });
      return;
    }

    if (mode === 'win') {
      dim(ctx, 0.5);
      panel(ctx, 250, 170, 780, 380);
      marqueeTitle(ctx, 'PEANUT MADE IT HOME!', W / 2, 260, 52, true);
      text(ctx, `Score ${fmt(game.score)}`, W / 2, 360, 32, '#FFFFFF', { weight: 900 });
      text(ctx, 'Good dog!', W / 2, 430, 22, '#CFE4FF', { weight: 800, outline: false });
    }
  }

  global.Dogger = global.Dogger || {};
  global.Dogger.Render = {
    Effects,
    TITLE_BUTTON,
    drawWorld,
    drawTitle,
    drawOverlay,
    drawLoading,
  };
})(window);
