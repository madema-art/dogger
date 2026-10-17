// The board. Each level's static world is painted once into a cached canvas: the neighbourhood behind
// the far curb, the lanes with their markings, medians, sidewalks and decor. Only moving things (traffic,
// Peanut, obstacles, bones, effects, HUD) are drawn per frame. Decor is seeded per level, so the same
// level always looks the same. Nothing here is collidable; the game logic only uses the level layout.
(function (global) {
  'use strict';

  const L = global.Dogger.Levels;
  const W = L.WIDTH;
  const H = L.HEIGHT;
  const TAU = Math.PI * 2;

  // Small seeded PRNG so decor is stable from one visit to the next.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const C = {
    lawn: ['#8ccf6a', '#7cc05c'],
    asphalt: '#343b4c',
    asphaltHi: '#3d4558',
    curb: '#d7cdb8',
    curbShade: '#8f8674',
    paver: '#eadfc8',
    paverLine: 'rgba(120,96,70,0.22)',
    lineWhite: 'rgba(255,255,255,0.92)',
    lineYellow: '#ffd44d',
    hedge: ['#4f9a4e', '#3d7d3e'],
    tree: ['#3e9a52', '#5cbc6a', '#2c7340'],
  };

  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function tree(g, x, y, r, rnd) {
    g.fillStyle = 'rgba(20,50,25,0.28)';
    g.beginPath();
    g.ellipse(x + 6, y + 8, r * 1.02, r * 0.86, 0, 0, TAU);
    g.fill();
    const base = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    base.addColorStop(0, C.tree[1]);
    base.addColorStop(0.7, C.tree[0]);
    base.addColorStop(1, C.tree[2]);
    g.fillStyle = base;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    for (let i = 0; i < 5; i++) {
      const a = rnd() * TAU;
      const d = rnd() * r * 0.55;
      g.fillStyle = 'rgba(160,230,150,0.18)';
      g.beginPath();
      g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.28, 0, TAU);
      g.fill();
    }
  }

  function shrub(g, x, y, r) {
    g.fillStyle = 'rgba(20,50,25,0.22)';
    g.beginPath(); g.ellipse(x + 3, y + 4, r, r * 0.8, 0, 0, TAU); g.fill();
    const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    grad.addColorStop(0, '#6cb865');
    grad.addColorStop(1, C.hedge[1]);
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }

  function flowers(g, x, y, rnd) {
    const colors = ['#ff8fa3', '#ffd166', '#fff3f7', '#c8a2ff'];
    for (let i = 0; i < 7; i++) {
      g.fillStyle = colors[Math.floor(rnd() * colors.length)];
      g.beginPath();
      g.arc(x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 16, 2.4, 0, TAU);
      g.fill();
    }
  }

  // A parked car seen from above, facing right. Used in driveways and on the backdrop.
  function parkedCar(g, x, y, color) {
    g.save();
    g.translate(x, y);
    g.fillStyle = 'rgba(15,20,30,0.25)';
    g.beginPath(); g.ellipse(4, 5, 46, 20, 0, 0, TAU); g.fill();
    g.fillStyle = color;
    rr(g, -40, -18, 80, 36, 14); g.fill();
    g.fillStyle = '#243652';
    rr(g, -14, -12, 28, 24, 6); g.fill();
    g.restore();
  }

  function mailbox(g, x, y) {
    g.fillStyle = 'rgba(20,20,20,0.2)';
    g.fillRect(x - 2, y + 4, 10, 4);
    g.fillStyle = '#7a5a3c';
    g.fillRect(x - 1, y - 2, 4, 14);
    g.fillStyle = '#2f6fbf';
    rr(g, x - 9, y - 9, 18, 12, 4); g.fill();
    g.fillStyle = '#ffffff';
    g.fillRect(x - 8, y - 4, 16, 2);
  }

  function hydrant(g, x, y) {
    g.fillStyle = 'rgba(20,20,20,0.22)';
    g.beginPath(); g.ellipse(x + 3, y + 3, 8, 5, 0, 0, TAU); g.fill();
    g.fillStyle = '#e0503a';
    rr(g, x - 6, y - 8, 12, 16, 4); g.fill();
    g.fillStyle = '#b53a27';
    g.fillRect(x - 9, y - 4, 18, 4);
  }

  function bin(g, x, y, color) {
    g.fillStyle = 'rgba(20,20,20,0.2)';
    g.beginPath(); g.ellipse(x + 3, y + 3, 11, 7, 0, 0, TAU); g.fill();
    g.fillStyle = color;
    rr(g, x - 10, y - 7, 20, 14, 3); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(x - 10, y - 2, 20, 2);
  }

  function stopSign(g, x, y) {
    g.fillStyle = 'rgba(20,20,20,0.25)';
    g.beginPath(); g.ellipse(x + 4, y + 5, 16, 16, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      g.lineTo(x + Math.cos(a) * 17, y + Math.sin(a) * 17);
    }
    g.closePath(); g.fill();
    g.fillStyle = '#d6372b';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      g.lineTo(x + Math.cos(a) * 14.5, y + Math.sin(a) * 14.5);
    }
    g.closePath(); g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold 9px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('STOP', x, y + 0.5);
  }

  function streetLamp(g, x, y) {
    g.fillStyle = 'rgba(20,20,20,0.22)';
    g.beginPath(); g.ellipse(x + 5, y + 5, 7, 5, 0, 0, TAU); g.fill();
    g.fillStyle = '#4a5160';
    g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,240,190,0.7)';
    g.beginPath(); g.arc(x, y, 2.5, 0, TAU); g.fill();
  }

  // Backdrop: the neighbourhood beyond the far curb. Lots of houses, driveways, parked cars and trees.
  function paintBackdrop(g, top, rnd) {
    const band = top - L.HUD_H;
    const grass = g.createLinearGradient(0, L.HUD_H, 0, top);
    grass.addColorStop(0, C.lawn[1]);
    grass.addColorStop(1, C.lawn[0]);
    g.fillStyle = grass;
    g.fillRect(0, L.HUD_H, W, Math.max(0, band));
    // Mowing stripes.
    for (let x = 0; x < W; x += 90) {
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(x, L.HUD_H, 45, Math.max(0, band));
    }
    if (band < 70) {
      // Too little room for houses (crowded levels): a hedge line hides the far edge instead.
      for (let x = 10; x < W; x += 34) shrub(g, x, top - 14, 16);
      return;
    }

    const roofH = Math.min(96, band - 30);
    const roofTop = top - 14 - roofH;
    const roofColors = ['#c8553d', '#b5483a', '#d9833f', '#8e4a6f', '#4e7fa8', '#7a6fb3'];
    const lotW = W / 8;
    for (let i = 0; i < 8; i++) {
      const lx = i * lotW;
      const hx = lx + 26 + rnd() * 10;
      const hw = lotW * 0.62 + rnd() * 10;
      // Driveway from the curb up to the house.
      g.fillStyle = '#d8d2c6';
      g.fillRect(hx + hw * 0.18, roofTop + roofH - 4, hw * 0.46, top - (roofTop + roofH) + 4);
      g.fillStyle = 'rgba(0,0,0,0.08)';
      g.fillRect(hx + hw * 0.18, roofTop + roofH - 4, 4, top - (roofTop + roofH) + 4);
      // Roof with a ridge and a shadow.
      g.fillStyle = 'rgba(15,30,20,0.25)';
      rr(g, hx + 6, roofTop + 7, hw, roofH, 6); g.fill();
      const roof = g.createLinearGradient(hx, roofTop, hx + hw, roofTop + roofH);
      const col = roofColors[i % roofColors.length];
      roof.addColorStop(0, shadeHex(col, 26));
      roof.addColorStop(1, shadeHex(col, -22));
      g.fillStyle = roof;
      rr(g, hx, roofTop, hw, roofH, 6); g.fill();
      g.strokeStyle = 'rgba(40,20,10,0.35)';
      g.lineWidth = 2;
      rr(g, hx, roofTop, hw, roofH, 6); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.beginPath();
      g.moveTo(hx + hw * 0.1, roofTop + roofH / 2);
      g.lineTo(hx + hw * 0.9, roofTop + roofH / 2);
      g.stroke();
      // Chimney.
      g.fillStyle = '#7d5a4a';
      g.fillRect(hx + hw * 0.7, roofTop + 12, 14, 18);
      // Parked car in the driveway.
      if (rnd() < 0.7) parkedCar(g, hx + hw * 0.4, top - 26, ['#e7edf3', '#3d6fa8', '#d1603d', '#2e2f36'][Math.floor(rnd() * 4)]);
      // Trees on the lot edges and a mailbox at the kerb.
      tree(g, lx + 22, roofTop + roofH * 0.3, 22 + rnd() * 6, rnd);
      if (rnd() < 0.6) tree(g, lx + lotW - 26, roofTop + roofH * 0.8, 16 + rnd() * 4, rnd);
      mailbox(g, hx + hw * 0.18 - 12, top - 14);
      // Picket fence along the lot front.
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let fx = lx + 8; fx < lx + lotW - 60; fx += 12) g.fillRect(fx, top - 22, 4, 6);
      g.fillRect(lx + 8, top - 19, lotW - 70, 2);
    }
    // Hedges at the far edge of the lawn.
    for (let x = 6; x < W; x += 30) shrub(g, x, L.HUD_H + 14, 12);
  }

  function shadeHex(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, v + amount));
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  }

  // Each lane identity gets a faint tint, so the heavy, fast, delivery and bike lanes read differently.
  const LANE_TINT = {
    H: 'rgba(255,190,110,0.07)',
    F: 'rgba(255,90,120,0.08)',
    D: 'rgba(255,220,120,0.06)',
    B: 'rgba(70,200,170,0.13)',
  };

  function paintRoad(g, top, h, code) {
    g.fillStyle = C.asphalt;
    g.fillRect(0, top, W, h);
    if (LANE_TINT[code]) {
      g.fillStyle = LANE_TINT[code];
      g.fillRect(0, top, W, h);
    }
    const grad = g.createLinearGradient(0, top, 0, top + h);
    grad.addColorStop(0, 'rgba(255,255,255,0.05)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.14)');
    g.fillStyle = grad;
    g.fillRect(0, top, W, h);
  }

  function paintSidewalk(g, top, h, rnd) {
    g.fillStyle = C.paver;
    g.fillRect(0, top, W, h);
    g.strokeStyle = C.paverLine;
    g.lineWidth = 1.5;
    for (let x = 0; x <= W; x += L.COL_W) {
      g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + h); g.stroke();
    }
    g.beginPath(); g.moveTo(0, top + h / 2); g.lineTo(W, top + h / 2); g.stroke();
    // A few darker tiles for texture.
    for (let i = 0; i < 16; i++) {
      g.fillStyle = 'rgba(120,96,70,0.05)';
      g.fillRect(Math.floor(rnd() * 16) * L.COL_W, top + (rnd() < 0.5 ? 0 : h / 2), L.COL_W, h / 2);
    }
  }

  function paintMedian(g, top, h, rnd) {
    const grad = g.createLinearGradient(0, top, 0, top + h);
    grad.addColorStop(0, '#91d47c');
    grad.addColorStop(1, '#73bb63');
    g.fillStyle = grad;
    g.fillRect(0, top, W, h);
    for (let x = 0; x < W; x += 60) {
      const cx = x + 30;
      const cy = top + h / 2;
      if (rnd() < 0.5) flowers(g, cx, cy + 14, rnd);
      shrub(g, cx + (rnd() - 0.5) * 10, cy, 13 + rnd() * 3);
    }
  }

  // The far row: a hedge line with openings. The white houses are drawn live, on top of it.
  function paintHedgeRow(g, top, h, rnd) {
    const grad = g.createLinearGradient(0, top, 0, top + h);
    grad.addColorStop(0, '#6cb865');
    grad.addColorStop(1, '#4f9a4e');
    g.fillStyle = grad;
    g.fillRect(0, top, W, h);
    for (let x = 0; x < W; x += 34) {
      shrub(g, x + 10, top + h / 2 + (rnd() - 0.5) * 6, 17 + rnd() * 3);
    }
  }

  // Kerbs and lane lines along each boundary. `below` is the strip under the boundary, `above` the strip over it.
  function paintBoundary(g, y, below, above, dirs) {
    if (isRoad(below) && isRoad(above)) {
      const sameDir = dirs.below === dirs.above;
      if (sameDir) {
        g.save();
        g.strokeStyle = C.lineWhite;
        g.lineWidth = 3;
        g.setLineDash([22, 18]);
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
        g.restore();
      } else {
        // Opposing traffic: a double yellow centre line.
        g.strokeStyle = C.lineYellow;
        g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(0, y - 2.5); g.lineTo(W, y - 2.5); g.stroke();
        g.beginPath(); g.moveTo(0, y + 2.5); g.lineTo(W, y + 2.5); g.stroke();
      }
      return;
    }
    const roadBelow = below !== undefined && isRoad(below);
    const roadAbove = above !== undefined && isRoad(above);
    if (roadBelow || roadAbove) {
      // Kerb: a raised concrete band with a shadow side, then a white edge line on the road side.
      g.fillStyle = C.curb;
      g.fillRect(0, y - 4, W, 8);
      g.fillStyle = C.curbShade;
      g.fillRect(0, y + 2, W, 2);
      g.strokeStyle = C.lineWhite;
      g.lineWidth = 2;
      if (roadBelow) { g.beginPath(); g.moveTo(0, y - 6); g.lineTo(W, y - 6); g.stroke(); }
      if (roadAbove) { g.beginPath(); g.moveTo(0, y + 6); g.lineTo(W, y + 6); g.stroke(); }
    } else if (above === undefined) {
      g.fillStyle = C.curb;
      g.fillRect(0, y - 4, W, 8);
      g.fillStyle = C.curbShade;
      g.fillRect(0, y + 2, W, 2);
    }
  }

  function isRoad(code) {
    return code === 'R' || code === 'H' || code === 'F' || code === 'D' || code === 'B';
  }

  function paintLanesAndRoads(g, level, geo) {
    const { rows } = level;
    const dirByRow = {};
    level.lanes.forEach((lane) => { dirByRow[lane.row] = lane.dir; });
    for (let r = 0; r < rows.length; r++) {
      const code = rows[r];
      const top = L.rowTop(geo, r);
      const h = geo.heights[r];
      if (isRoad(code)) paintRoad(g, top, h, code);
      else if (code === 'M') paintMedian(g, top, h, mulberry32(level.index * 97 + r));
      else if (code === 'G') paintHedgeRow(g, top, h, mulberry32(level.index * 41 + r));
      else paintSidewalk(g, top, h, mulberry32(level.index * 31 + r));

      const above = rows[r + 1];
      paintBoundary(g, top, code, above, { below: dirByRow[r], above: dirByRow[r + 1] });
    }
  }

  // Bike lanes get a painted cycle symbol at the start, so the lane identity reads at a glance.
  function paintLaneTags(g, level, geo) {
    level.rows.forEach((code, r) => {
      if (code !== 'B') return;
      const y = L.rowY(geo, r);
      g.save();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath(); g.arc(W - 40, y, 9, 0, TAU); g.fill();
      g.restore();
    });
  }

  // Decor sits on sidewalks and medians only, never on a lane.
  function paintDecor(g, level, geo) {
    const rnd = mulberry32(level.index * 7919 + 13);
    level.rows.forEach((code, r) => {
      const y = L.rowY(geo, r);
      if (code === 'S' && r === 0) {
        // Doormat in front of the start, so Peanut's starting point is obvious.
        const mx = L.colX(L.START_COL);
        g.fillStyle = 'rgba(40,20,10,0.25)';
        rr(g, mx - 34, y - 19, 72, 42, 8); g.fill();
        g.fillStyle = '#9b6a45';
        rr(g, mx - 36, y - 22, 72, 42, 8); g.fill();
        g.strokeStyle = '#6e4a2f';
        g.lineWidth = 2;
        rr(g, mx - 30, y - 16, 60, 30, 6); g.stroke();
        g.fillStyle = 'rgba(255,240,200,0.8)';
        g.font = 'bold 12px Arial, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('HOME', mx, y);
      }
      if (code === 'S') {
        for (let x = 30; x < W; x += 210 + rnd() * 80) {
          const pick = rnd();
          if (pick < 0.4) bin(g, x, y, ['#3b6e5a', '#5d6470'][Math.floor(rnd() * 2)]);
          else if (pick < 0.7) hydrant(g, x, y);
          else flowers(g, x, y, rnd);
        }
      } else if (code === 'M') {
        for (let x = 110; x < W; x += 340 + rnd() * 60) streetLamp(g, x, y - 6);
      }
    });
  }

  // Builds the whole static board for one level. Returns a canvas at device resolution.
  function buildBoard(level, dpr) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const geo = level.geo;
    paintBackdrop(g, geo.top, mulberry32(level.index * 53 + 7));
    paintLanesAndRoads(g, level, geo);
    paintDecor(g, level, geo);
    paintLaneTags(g, level, geo);

    // Stop sign on the median of the busiest level so the street reads as a real street.
    const medianRow = level.rows.indexOf('M');
    if (medianRow > 0 && level.index >= 2) stopSign(g, 90, L.rowY(geo, medianRow));

    // Warm light and a little vignette.
    const warm = g.createLinearGradient(0, 0, W, H);
    warm.addColorStop(0, 'rgba(255,214,150,0.07)');
    warm.addColorStop(1, 'rgba(60,70,120,0.10)');
    g.fillStyle = warm;
    g.fillRect(0, 0, W, H);
    return canvas;
  }

  global.Dogger = global.Dogger || {};
  global.Dogger.Board = { buildBoard, mulberry32, parkedCar, shadeHex };
})(window);
