// Dogger rendering: a stylised top-down street, traffic, Peanut, HUD and screens.
(function (global) {
  'use strict';

  const L = global.Dogger.Levels;
  const W = L.WIDTH;
  const H = L.HEIGHT;
  const TAU = Math.PI * 2;
  const FONT = '"Trebuchet MS", "Segoe UI", Verdana, system-ui, sans-serif';
  const DOG_H = 58;

  const TITLE_BUTTON = { x: W / 2 - 165, y: 836, w: 330, h: 84 };

  // ---------- drawing helpers ----------

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

  function ellipse(ctx, x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
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

  // Outlined, shadowed text. `size` is the font size in px.
  function text(ctx, str, x, y, size, color, opts = {}) {
    ctx.save();
    ctx.font = `${opts.weight || 900} ${size}px ${FONT}`;
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = 'middle';
    if (opts.outline !== false) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = opts.lineWidth || Math.max(4, size * 0.16);
      ctx.strokeStyle = opts.strokeColor || 'rgba(8,24,60,0.9)';
      ctx.strokeText(str, x, y);
    }
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

  // ---------- backdrop: sky, houses and trees ----------

  const CLOUDS = [
    { x: 80, y: 120, s: 1.0, speed: 9 },
    { x: 330, y: 70, s: 0.75, speed: 6 },
    { x: 470, y: 230, s: 0.6, speed: 12 },
  ];

  const HOUSES = [
    { x: -12, w: 100, h: 150, wall: '#FFD7A8', roof: '#E0633F', roofH: 40, floors: 2 },
    { x: 92, w: 82, h: 118, wall: '#BDE8D2', roof: '#3F7F6A', roofH: 34, floors: 1 },
    { x: 178, w: 104, h: 168, wall: '#C9D7FF', roof: '#4A5BB8', roofH: 42, floors: 2 },
    { x: 288, w: 84, h: 128, wall: '#FFE7A0', roof: '#B8552E', roofH: 36, floors: 1 },
    { x: 378, w: 104, h: 156, wall: '#FFC1CF', roof: '#8B3E5B', roofH: 40, floors: 2 },
    { x: 486, w: 80, h: 120, wall: '#D8F2A8', roof: '#5C8A2E', roofH: 34, floors: 1 },
  ];

  const TREES = [
    { x: 80, s: 1.0 },
    { x: 276, s: 0.9 },
    { x: 366, s: 1.1 },
    { x: 474, s: 0.8 },
  ];

  function drawSky(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#6CC8FF');
    g.addColorStop(0.6, '#BDE9FF');
    g.addColorStop(1, '#FFF1D0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    glow(ctx, 448, 120, 130, '255,236,150', 0.9);
    ellipse(ctx, 448, 120, 34, 34, '#FFE58A');

    for (const c of CLOUDS) {
      const x = ((c.x + t * c.speed) % (W + 160)) - 80;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.arc(x, c.y, 22 * c.s, 0, TAU);
      ctx.arc(x + 26 * c.s, c.y - 10 * c.s, 28 * c.s, 0, TAU);
      ctx.arc(x + 56 * c.s, c.y, 22 * c.s, 0, TAU);
      ctx.fill();
      rr(ctx, x - 22 * c.s, c.y, 100 * c.s, 22 * c.s, 8 * c.s);
      ctx.fill();
    }
  }

  function drawHouse(ctx, h, base) {
    const top = base - h.h;
    ctx.fillStyle = h.wall;
    ctx.fillRect(h.x, top + h.roofH, h.w, h.h - h.roofH);
    ctx.fillStyle = h.roof;
    ctx.beginPath();
    ctx.moveTo(h.x - 10, top + h.roofH);
    ctx.lineTo(h.x + h.w / 2, top);
    ctx.lineTo(h.x + h.w + 10, top + h.roofH);
    ctx.closePath();
    ctx.fill();
    for (let floor = 0; floor < h.floors; floor++) {
      const wy = top + h.roofH + 14 + floor * 52;
      if (wy + 26 > base - 44) break;
      for (const wx of [h.x + 14, h.x + h.w - 34]) {
        rr(ctx, wx, wy, 20, 26, 4);
        ctx.fillStyle = '#4B5C7A';
        ctx.fill();
        rr(ctx, wx + 3, wy + 3, 14, 20, 3);
        ctx.fillStyle = '#FFF0B8';
        ctx.fill();
      }
    }
    rr(ctx, h.x + h.w / 2 - 9, base - 34, 18, 34, 4);
    ctx.fillStyle = '#7A4B3A';
    ctx.fill();
  }

  function drawTree(ctx, x, base, s) {
    ellipse(ctx, x, base - 2, 24 * s, 6 * s, 'rgba(20,60,30,0.2)');
    ctx.fillStyle = '#7A5538';
    ctx.fillRect(x - 4 * s, base - 30 * s, 8 * s, 30 * s);
    ctx.fillStyle = '#4FAE5E';
    ctx.beginPath();
    ctx.arc(x, base - 44 * s, 26 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6CC974';
    ctx.beginPath();
    ctx.arc(x - 8 * s, base - 50 * s, 14 * s, 0, TAU);
    ctx.fill();
  }

  function drawBackdrop(ctx, base, t) {
    drawSky(ctx, t);
    for (const h of HOUSES) drawHouse(ctx, h, base);
    for (const tr of TREES) drawTree(ctx, tr.x, base, tr.s);
  }

  // ---------- street: sidewalks, road, medians ----------

  let roadPattern = null;

  function getRoadPattern(ctx) {
    if (roadPattern) return roadPattern;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#3A4358';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    roadPattern = ctx.createPattern(c, 'repeat');
    return roadPattern;
  }

  function drawRoad(ctx, top, h) {
    ctx.fillStyle = getRoadPattern(ctx);
    ctx.fillRect(0, top, W, h);
    const shade = ctx.createLinearGradient(0, top, 0, top + h);
    shade.addColorStop(0, 'rgba(0,0,0,0.08)');
    shade.addColorStop(0.5, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, top, W, h);
  }

  function drawSidewalk(ctx, top, h, goalT, hasMat) {
    ctx.fillStyle = '#F5E9CF';
    ctx.fillRect(0, top, W, h);
    ctx.fillStyle = 'rgba(150,120,85,0.16)';
    for (let c = 1; c < L.COLS; c++) ctx.fillRect(c * L.COL_W, top, 2, h);
    ctx.fillStyle = 'rgba(150,120,85,0.12)';
    ctx.fillRect(0, top + h / 2, W, 2);

    if (goalT !== null) {
      // The far curb is home: every cell gets a glowing paw print to aim for.
      for (let c = 0; c < L.COLS; c++) {
        const x = L.colX(c);
        const y = top + h / 2;
        const pulse = 0.5 + 0.5 * Math.sin(goalT * 3 + c * 0.6);
        glow(ctx, x, y, 34, '255,220,120', 0.25 + 0.25 * pulse);
        paw(ctx, x, y, 24, `rgba(233,160,90,${0.55 + 0.35 * pulse})`);
      }
    }
    if (hasMat) {
      const x = L.colX(L.START_COL);
      rr(ctx, x - 26, top + 12, 52, h - 24, 8);
      ctx.fillStyle = '#E9A87C';
      ctx.fill();
      paw(ctx, x, top + h / 2, 22, '#B8664A');
    }
  }

  function drawMedian(ctx, top, h) {
    const g = ctx.createLinearGradient(0, top, 0, top + h);
    g.addColorStop(0, '#8ED67F');
    g.addColorStop(1, '#6DBD67');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, h);
    for (let c = 0; c < L.COLS; c++) {
      if (c % 3 === 1) continue;
      const x = L.colX(c);
      const y = top + h / 2 + 4;
      ellipse(ctx, x, y + 14, 24, 8, 'rgba(30,70,30,0.2)');
      ctx.fillStyle = '#3F8F50';
      ctx.beginPath();
      ctx.arc(x - 8, y, 16, 0, TAU);
      ctx.arc(x + 8, y - 2, 18, 0, TAU);
      ctx.arc(x, y + 6, 15, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5FB168';
      ctx.beginPath();
      ctx.arc(x - 12, y - 6, 6, 0, TAU);
      ctx.fill();
    }
  }

  // Strip edges. `below` is the strip under the boundary, `above` the strip over it.
  function drawBoundary(ctx, y, below, above) {
    if (below === 'R' && above === 'R') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,240,190,0.85)';
      ctx.lineWidth = 3;
      ctx.setLineDash([16, 14]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.restore();
    } else if (below === 'R' || above === 'R' || above === undefined) {
      ctx.fillStyle = '#CFC4B0';
      ctx.fillRect(0, y - 4, W, 8);
      ctx.fillStyle = '#A99E8A';
      ctx.fillRect(0, y + 2, W, 2);
    }
  }

  function drawStreet(ctx, game, t) {
    const { rows, rowCount } = game.level;
    for (let r = 0; r < rowCount; r++) {
      const code = rows[r];
      const top = L.FIELD_BOTTOM - (r + 1) * L.ROW_H;
      if (code === 'R') drawRoad(ctx, top, L.ROW_H);
      else if (code === 'M') drawMedian(ctx, top, L.ROW_H);
      else drawSidewalk(ctx, top, L.ROW_H, code === 'G' ? t : null, r === 0);
      drawBoundary(ctx, top, code, rows[r + 1]);
    }
    // Grass below the start sidewalk.
    ctx.fillStyle = '#7FCB70';
    ctx.fillRect(0, L.FIELD_BOTTOM, W, H - L.FIELD_BOTTOM);
  }

  // ---------- props: cones and bones ----------

  function drawCone(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ellipse(ctx, 0, 18, 20, 6, 'rgba(10,30,20,0.25)');
    rr(ctx, -20, 12, 40, 8, 3);
    ctx.fillStyle = '#FF7A1A';
    ctx.fill();
    ctx.fillStyle = '#FF8C3A';
    ctx.beginPath();
    ctx.moveTo(-14, 12);
    ctx.lineTo(-3, -22);
    ctx.lineTo(3, -22);
    ctx.lineTo(14, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-9.5, -2);
    ctx.lineTo(9.5, -2);
    ctx.lineTo(11, 4);
    ctx.lineTo(-11, 4);
    ctx.closePath();
    ctx.fill();
    rr(ctx, -6, -28, 12, 7, 3);
    ctx.fillStyle = '#FF7A1A';
    ctx.fill();
    ctx.restore();
  }

  function drawBone(ctx, x, y, t, seed) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 3 + seed) * 3);
    ctx.rotate(Math.sin(t * 2 + seed) * 0.15);
    ellipse(ctx, 0, 9, 16, 4, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = '#FFFBF0';
    ctx.strokeStyle = '#D9B98A';
    ctx.lineWidth = 2;
    for (const [kx, ky] of [[-12, -3], [-12, 3], [12, -3], [12, 3]]) {
      ctx.beginPath();
      ctx.arc(kx, ky, 5.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
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

  // ---------- traffic: each vehicle is drawn facing right, then flipped for leftward lanes ----------

  const PAINT = {
    hatch: { body: '#2BC4B0', body2: '#17937F', accent: '#E9FFFA', glass: '#24314F' },
    van: { body: '#F9F3E3', body2: '#D9CDB0', accent: '#FF8A3D', glass: '#25304A' },
    bus: { body: '#B8F25C', body2: '#7AB82E', accent: '#FFFFFF', glass: '#2A3550' },
    sport: { body: '#FF5C8A', body2: '#C7335F', accent: '#FFE066', glass: '#1E2740' },
    scooter: { body: '#FFD23F', body2: '#E0A800', accent: '#26324A', glass: '#FFFFFF' },
    bot: { body: '#F7FBFF', body2: '#C9D8EA', accent: '#3DA9FF', glass: '#1E2740' },
  };

  function body(ctx, p, x, y, w, h, r) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, p.body);
    g.addColorStop(1, p.body2);
    ctx.fillStyle = g;
    rr(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.stroke();
  }

  function wheels(ctx, h, xs) {
    ctx.fillStyle = '#141923';
    for (const x of xs) {
      rr(ctx, x - 7, -h / 2 - 3, 14, 6, 2);
      ctx.fill();
      rr(ctx, x - 7, h / 2 - 3, 14, 6, 2);
      ctx.fill();
    }
  }

  function headlights(ctx, w, h, front = '#FFF6C2', back = '#FF4D6D') {
    for (const sy of [-1, 1]) {
      glow(ctx, w / 2 - 3, sy * h * 0.3, 16, '255,242,170', 0.55);
      ellipse(ctx, w / 2 - 4, sy * h * 0.3, 4.5, 3.5, front);
      ellipse(ctx, -w / 2 + 5, sy * h * 0.3, 3.5, 3, back);
    }
  }

  function drawHatch(ctx, p, w, h) {
    wheels(ctx, h, [-w * 0.3, w * 0.3]);
    body(ctx, p, -w / 2, -h / 2, w, h, h * 0.42);
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-w * 0.44, -2, w * 0.88, 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.glass;
    rr(ctx, -w * 0.2, -h * 0.34, w * 0.4, h * 0.68, h * 0.2);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,230,255,0.75)';
    rr(ctx, w * 0.1, -h * 0.3, w * 0.1, h * 0.6, 4);
    ctx.fill();
    headlights(ctx, w, h);
  }

  function drawVan(ctx, p, w, h) {
    wheels(ctx, h, [-w * 0.3, w * 0.3]);
    body(ctx, p, -w / 2, -h / 2, w, h, 9);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    rr(ctx, -w / 2 + 6, -h / 2 + 6, w * 0.6, h - 12, 6);
    ctx.fill();
    ctx.fillStyle = p.accent;
    ctx.fillRect(-w / 2 + 6, -3, w * 0.6, 6);
    ctx.fillStyle = p.glass;
    rr(ctx, w * 0.2, -h * 0.36, w * 0.2, h * 0.72, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,230,255,0.75)';
    rr(ctx, w * 0.34, -h * 0.3, w * 0.06, h * 0.6, 3);
    ctx.fill();
    headlights(ctx, w, h);
  }

  function drawBus(ctx, p, w, h) {
    wheels(ctx, h, [-w * 0.34, -w * 0.1, w * 0.22]);
    body(ctx, p, -w / 2, -h / 2, w, h, 12);
    ctx.fillStyle = p.glass;
    const count = 6;
    const cellW = (w - 40) / count;
    for (let i = 0; i < count; i++) {
      const x = -w / 2 + 12 + i * cellW;
      rr(ctx, x, -h / 2 + 5, cellW - 8, 9, 3);
      ctx.fill();
      rr(ctx, x, h / 2 - 14, cellW - 8, 9, 3);
      ctx.fill();
    }
    ctx.fillStyle = p.accent;
    ctx.fillRect(-w / 2 + 8, -2, w - 16, 4);
    ctx.fillStyle = 'rgba(160,230,255,0.8)';
    rr(ctx, w / 2 - 14, -h * 0.36, 9, h * 0.72, 4);
    ctx.fill();
    headlights(ctx, w, h);
  }

  function drawSport(ctx, p, w, h) {
    wheels(ctx, h, [-w * 0.3, w * 0.3]);
    body(ctx, p, -w / 2, -h / 2, w, h, h * 0.5);
    ctx.fillStyle = p.accent;
    ctx.fillRect(-w * 0.3, -2.5, w * 0.6, 5);
    ctx.fillStyle = p.glass;
    rr(ctx, -w * 0.12, -h * 0.3, w * 0.34, h * 0.6, h * 0.26);
    ctx.fill();
    ctx.fillStyle = '#1B1F2B';
    rr(ctx, -w / 2 + 2, -h * 0.42, 8, h * 0.84, 3);
    ctx.fill();
    headlights(ctx, w, h, '#FFFBD0', '#FF2D55');
  }

  // A rider on an e-scooter, seen from above.
  function drawScooter(ctx, p, w, h) {
    ctx.fillStyle = '#2A3142';
    rr(ctx, -w * 0.46, -4, w * 0.92, 8, 4);
    ctx.fill();
    ctx.fillStyle = '#10141E';
    ctx.beginPath();
    ctx.arc(-w * 0.42, 0, 6, 0, TAU);
    ctx.arc(w * 0.42, 0, 6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#2A3142';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.36, -h * 0.42);
    ctx.lineTo(w * 0.36, h * 0.42);
    ctx.stroke();
    const g = ctx.createRadialGradient(-w * 0.06, -4, 2, -w * 0.06, 0, h * 0.6);
    g.addColorStop(0, '#FFE872');
    g.addColorStop(1, p.body2);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(-w * 0.08, 0, w * 0.26, h * 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(w * 0.06, 0, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = p.accent;
    rr(ctx, w * 0.1, -4, 7, 8, 2);
    ctx.fill();
    glow(ctx, w * 0.46, 0, 10, '255,250,200', 0.6);
    ellipse(ctx, w * 0.46, 0, 3, 3, '#FFFFFF');
  }

  function drawBot(ctx, p, w, h, t, phase) {
    ctx.fillStyle = '#1A2030';
    rr(ctx, -w / 2 - 2, -h * 0.3, w + 4, h * 0.6, 4);
    ctx.fill();
    body(ctx, p, -w / 2, -h / 2, w, h, 10);
    const pulse = 0.5 + 0.5 * Math.sin(t * 8 + phase);
    ctx.fillStyle = `rgba(61,169,255,${0.45 + 0.55 * pulse})`;
    rr(ctx, -w * 0.36, -h * 0.14, w * 0.72, h * 0.28, 4);
    ctx.fill();
    glow(ctx, w / 2 - 2, 0, 12, '190,235,255', 0.6);
    ellipse(ctx, w / 2 - 4, 0, 3.5, 3.5, '#FFFFFF');
  }

  function drawVehicle(ctx, v, t) {
    const p = PAINT[v.type];
    ctx.save();
    ctx.translate(v.x, v.y);
    if (v.dir < 0) ctx.scale(-1, 1);
    if (v.type === 'scooter') ctx.rotate(Math.sin(v.phase * 4) * 0.06);
    ellipse(ctx, 3, 6, v.w * 0.5, v.h * 0.42, 'rgba(10,30,50,0.22)');
    switch (v.type) {
      case 'hatch': drawHatch(ctx, p, v.w, v.h); break;
      case 'van': drawVan(ctx, p, v.w, v.h); break;
      case 'bus': drawBus(ctx, p, v.w, v.h); break;
      case 'sport': drawSport(ctx, p, v.w, v.h); break;
      case 'scooter': drawScooter(ctx, p, v.w, v.h); break;
      case 'bot': drawBot(ctx, p, v.w, v.h, t, v.phase); break;
      default: break;
    }
    ctx.restore();
  }

  // ---------- Peanut ----------

  function drawDog(ctx, dog, img) {
    if (!dog || !img || !img.naturalWidth) return;
    const dw = DOG_H * (img.naturalWidth / img.naturalHeight);
    let sx = 1;
    let sy = 1;
    let alpha = 1;
    let lift = 0;

    if (dog.state === 'hop') {
      lift = dog.lift;
      sx = 1 - 0.05 * lift;
      sy = 1 + 0.1 * lift;
    } else if (dog.state === 'spawn') {
      const k = Math.min(1, dog.t / 0.35);
      sx = sy = 0.6 + 0.4 * k;
      alpha = k;
    } else if (dog.state === 'dead') {
      const k = Math.min(1, dog.t / 0.5);
      sx = 1 + 0.6 * k;
      sy = 1 - 0.75 * k;
      alpha = Math.max(0, 1 - (dog.t - 0.6) / 0.4);
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha) * 0.9;
    const shadowScale = 1 - lift * 0.35;
    ellipse(ctx, dog.x, dog.y + 26, 22 * shadowScale, 7 * shadowScale, 'rgba(10,30,20,0.28)');
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(dog.x, dog.y + 29 - lift * 16);
    ctx.scale(dog.facing * sx, sy);
    ctx.drawImage(img, -dw / 2, -DOG_H, dw, DOG_H);
    ctx.restore();
  }

  // ---------- HUD ----------

  function drawHUD(ctx, game) {
    ctx.save();
    ctx.fillStyle = 'rgba(7,22,52,0.6)';
    rr(ctx, 12, 12, W - 24, 74, 22);
    ctx.fill();

    text(ctx, 'SCORE', 34, 30, 13, '#9FC4FF', { align: 'left', outline: false, weight: 800 });
    text(ctx, fmt(game.score), 34, 60, 32, '#FFFFFF', { align: 'left' });

    text(ctx, `LEVEL ${game.levelIndex + 1}`, W / 2, 30, 17, '#FFE066');
    text(ctx, game.level.def.name, W / 2, 55, 15, '#FFFFFF', { weight: 800 });

    const need = game.level.def.crossings;
    const startX = W / 2 - ((need - 1) * 12) / 2;
    for (let i = 0; i < need; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * 12, 74, 4.5, 0, TAU);
      ctx.fillStyle = i < game.crossings ? '#FFE066' : 'rgba(255,255,255,0.25)';
      ctx.fill();
    }

    for (let i = 0; i < 5; i++) {
      const filled = i < game.lives;
      paw(ctx, W - 38 - i * 26, 48, 22, filled ? '#FFE066' : 'rgba(255,255,255,0.18)');
    }

    if (game.combo > 1 && game.comboTimer > 0) {
      const mult = Math.min(game.combo, 5);
      const pulse = 1 + 0.05 * Math.sin(game.t * 10);
      ctx.save();
      ctx.translate(W / 2, 112);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(255,79,160,0.9)';
      rr(ctx, -110, -16, 220, 32, 16);
      ctx.fill();
      text(ctx, `BONE COMBO x${mult}`, 0, 0, 18, '#FFFFFF', { outline: false });
      ctx.restore();
      ctx.fillStyle = 'rgba(255,79,160,0.9)';
      rr(ctx, W / 2 - 110, 130, 220 * (game.comboTimer / 5), 5, 3);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- world ----------

  function drawWorld(ctx, game) {
    const { level } = game;
    const base = L.fieldTop(level.rowCount);
    ctx.save();
    if (game.shakeT > 0) {
      const m = game.shakeMag * game.shakeT;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    drawBackdrop(ctx, base, game.t);
    drawStreet(ctx, game, game.t);

    for (const c of level.cones) drawCone(ctx, L.colX(c.col), L.rowY(c.row));
    for (const b of game.bones) {
      if (!b.got) drawBone(ctx, L.colX(b.col), L.rowY(b.row), game.t, b.seed);
    }
    for (const lane of game.lanes) {
      for (const v of lane.vehicles) drawVehicle(ctx, v, game.t);
    }
    drawDog(ctx, game.dog, game.dogImg);
    Effects.draw(ctx, game.effects);

    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    vignette.addColorStop(0, 'rgba(10,20,50,0)');
    vignette.addColorStop(1, 'rgba(10,20,50,0.28)');
    ctx.fillStyle = vignette;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.restore();

    drawHUD(ctx, game);
  }

  // ---------- title screen, built around the photo of Peanut ----------

  const TITLE_BITS = Array.from({ length: 12 }, (_, i) => ({
    x: (i * 137) % W,
    y: (i * 211) % H,
    s: 0.7 + ((i * 37) % 10) / 14,
    seed: i * 1.7,
  }));

  function fitFont(ctx, str, maxW, size) {
    ctx.font = `900 ${size}px ${FONT}`;
    const w = ctx.measureText(str).width;
    return w > maxW ? Math.floor(size * (maxW / w)) : size;
  }

  function drawTitle(ctx, game) {
    const t = game.t;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2B7BFF');
    g.addColorStop(0.5, '#0053DD');
    g.addColorStop(1, '#0339A8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    glow(ctx, W / 2, 560, 380, '190,220,255', 0.3);

    for (const b of TITLE_BITS) {
      const x = (b.x + t * 8 * b.s) % (W + 80) - 40;
      const y = b.y + Math.sin(t * 0.6 + b.seed) * 12;
      ctx.save();
      ctx.globalAlpha = 0.14;
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

    const dog = game.dogImg;
    if (dog && dog.naturalWidth) {
      const dh = 470;
      const dw = dh * (dog.naturalWidth / dog.naturalHeight);
      const feetY = 800;
      const bob = Math.sin(t * 2.2) * 8;
      ellipse(ctx, W / 2, feetY + 4, 150, 16, 'rgba(0,20,80,0.35)');
      ctx.drawImage(dog, W / 2 - dw / 2, feetY + bob - dh, dw, dh);
    }

    const titleSize = fitFont(ctx, 'DOGGER', 470, 118);
    const tg = ctx.createLinearGradient(0, 110, 0, 230);
    tg.addColorStop(0, '#FFF6BF');
    tg.addColorStop(1, '#FFB703');
    ctx.save();
    ctx.font = `900 ${titleSize}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#0A2466';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowOffsetY = 8;
    ctx.strokeText('DOGGER', W / 2, 166);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = tg;
    ctx.fillText('DOGGER', W / 2, 166);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(8,30,80,0.45)';
    rr(ctx, W / 2 - 200, 214, 400, 40, 20);
    ctx.fill();
    ctx.restore();
    text(ctx, 'Help Peanut cross the street!', W / 2, 234, 21, '#FFFFFF', { weight: 800, outline: false });

    if (game.best > 0) {
      text(ctx, `BEST  ${fmt(game.best)}`, W / 2, 282, 18, '#FFE066', { weight: 800 });
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
    text(ctx, 'START GAME', W / 2, b.y + b.h / 2, 38, '#0A2466', { outline: false });

    text(ctx, 'A  /  Enter  /  click', W / 2, 948, 17, 'rgba(255,255,255,0.85)', { weight: 800, outline: false });

    if (game.toastT > 0) {
      const msg = game.input.padConnected ? 'Controller ready!' : 'Controller disconnected';
      text(ctx, msg, W / 2, 40, 18, '#7CF2C4', { weight: 800 });
    }
  }

  function drawLoading(ctx, t) {
    ctx.fillStyle = '#0053DD';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'DOGGER', W / 2, H / 2 - 20, 56, '#FFE066');
    text(ctx, `loading${'.'.repeat(1 + (Math.floor(t * 3) % 3))}`, W / 2, H / 2 + 40, 20, '#FFFFFF', { outline: false, weight: 700 });
  }

  // ---------- overlays for intro, pause, clear, game over, win ----------

  function dim(ctx, alpha) {
    ctx.fillStyle = `rgba(6,20,48,${alpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  function drawStars(ctx, count, y) {
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1) * 86;
      const on = i < count;
      ctx.fillStyle = on ? '#FFE066' : 'rgba(255,255,255,0.22)';
      star(ctx, x, y, 34, 15, 5);
      ctx.fill();
      if (on) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#B07A00';
        ctx.stroke();
      }
    }
  }

  function drawOverlay(ctx, game) {
    const { mode } = game;

    if (mode === 'intro') {
      dim(ctx, 0.35);
      ctx.fillStyle = 'rgba(7,22,52,0.6)';
      rr(ctx, 40, 296, W - 80, 240, 28);
      ctx.fill();
      text(ctx, `LEVEL ${game.levelIndex + 1}`, W / 2, 380, 84, '#FFE066');
      text(ctx, game.level.def.name, W / 2, 462, 30, '#FFFFFF');
      text(ctx, game.level.def.tag, W / 2, 506, 18, '#CFE4FF', { weight: 800, outline: false });
      const label = game.countdownLabel();
      if (label) text(ctx, label, W / 2, 640, label === 'GO!' ? 120 : 140, label === 'GO!' ? '#7CF2C4' : '#FFFFFF');
      return;
    }

    if (mode === 'paused') {
      dim(ctx, 0.55);
      text(ctx, 'PAUSED', W / 2, 440, 70, '#FFFFFF');
      text(ctx, 'Press Start or P to keep going', W / 2, 510, 19, '#CFE4FF', { weight: 800, outline: false });
      return;
    }

    if (mode === 'clear') {
      dim(ctx, 0.4);
      ctx.fillStyle = 'rgba(7,22,52,0.78)';
      rr(ctx, 50, 340, W - 100, 280, 28);
      ctx.fill();
      text(ctx, 'LEVEL CLEAR!', W / 2, 395, 58, '#7CF2C4');
      drawStars(ctx, game.stars, 470);
      text(ctx, `Bonus +${fmt(game.lastBonus)}`, W / 2, 544, 26, '#FFE066');
      return;
    }

    if (mode === 'over') {
      dim(ctx, 0.6);
      text(ctx, 'GAME OVER', W / 2, 400, 74, '#FF8FB0');
      text(ctx, `Score ${fmt(game.score)}`, W / 2, 480, 30, '#FFFFFF');
      text(ctx, 'Peanut needs a nap.', W / 2, 530, 20, '#CFE4FF', { weight: 800, outline: false });
      return;
    }

    if (mode === 'win') {
      dim(ctx, 0.5);
      text(ctx, 'PEANUT MADE', W / 2, 360, 46, '#FFE066');
      text(ctx, 'IT HOME!', W / 2, 418, 66, '#FFE066');
      text(ctx, `Score ${fmt(game.score)}`, W / 2, 500, 30, '#FFFFFF');
      text(ctx, 'Good dog!', W / 2, 548, 20, '#CFE4FF', { weight: 800, outline: false });
      return;
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
