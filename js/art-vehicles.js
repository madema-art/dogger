// Traffic painters. Every vehicle is drawn top-down, facing right (+x), centred on (0, 0) in local
// coordinates, then flipped for leftward lanes. Sizes come from Dogger.Levels.VEHICLES.
// Designs are original: no real-world brands, logos or trade dress.
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const INK = 'rgba(20,24,34,0.55)';

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

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amount));
    const gg = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
    const b = Math.max(0, Math.min(255, (n & 255) + amount));
    return `rgb(${r},${gg},${b})`;
  }

  // Soft contact shadow, offset to the lower-right like sunlight from the upper-left.
  function shadow(g, w, h) {
    g.save();
    g.fillStyle = 'rgba(12,22,30,0.26)';
    g.beginPath();
    g.ellipse(4, 6, w * 0.5, h * 0.44, 0, 0, TAU);
    g.fill();
    g.restore();
  }

  function wheels(g, w, h, xs) {
    g.fillStyle = '#171b24';
    for (const x of xs) {
      rr(g, x - 8, -h / 2 - 3, 16, 7, 3);
      g.fill();
      rr(g, x - 8, h / 2 - 4, 16, 7, 3);
      g.fill();
    }
  }

  // Painted metal: lighter along the top, deeper at the bottom, with a crisp outline.
  function paint(g, color, x, y, w, h, r) {
    const grad = g.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, shade(color, 34));
    grad.addColorStop(0.45, color);
    grad.addColorStop(1, shade(color, -42));
    rr(g, x, y, w, h, r);
    g.fillStyle = grad;
    g.fill();
    g.lineWidth = 1.4;
    g.strokeStyle = INK;
    g.stroke();
  }

  function glass(g, x, y, w, h, r) {
    const grad = g.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#9fdcf5');
    grad.addColorStop(0.55, '#2a3f5f');
    grad.addColorStop(1, '#17233a');
    rr(g, x, y, w, h, r);
    g.fillStyle = grad;
    g.fill();
  }

  function headlamps(g, x, halfH, glowOn) {
    for (const s of [-1, 1]) {
      if (glowOn) {
        const gl = g.createRadialGradient(x, s * halfH, 0, x, s * halfH, 16);
        gl.addColorStop(0, 'rgba(255,246,190,0.7)');
        gl.addColorStop(1, 'rgba(255,246,190,0)');
        g.fillStyle = gl;
        g.beginPath();
        g.arc(x, s * halfH, 16, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#fff8d0';
      g.beginPath();
      g.arc(x, s * halfH, 3.6, 0, TAU);
      g.fill();
    }
  }

  function taillamps(g, x, halfH) {
    for (const s of [-1, 1]) {
      g.fillStyle = '#ff4d5e';
      rr(g, x, s * halfH - 2.4, 4, 5, 1.5);
      g.fill();
    }
  }

  const PAINTERS = {
    compact(g, w, h) {
      shadow(g, w, h);
      wheels(g, w, h, [-w * 0.3, w * 0.3]);
      paint(g, '#2fc6b0', -w / 2, -h / 2, w, h, h * 0.44);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(-w * 0.42, -1.5, w * 0.84, 3);
      glass(g, -w * 0.22, -h * 0.36, w * 0.44, h * 0.72, h * 0.24);
      glass(g, w * 0.1, -h * 0.3, w * 0.12, h * 0.6, 4);
      headlamps(g, w / 2 - 4, h * 0.3, true);
      taillamps(g, -w / 2 + 1, h * 0.3);
    },

    sedan(g, w, h) {
      shadow(g, w, h);
      wheels(g, w, h, [-w * 0.3, w * 0.3]);
      paint(g, '#5f8fd6', -w / 2, -h / 2, w, h, h * 0.4);
      glass(g, -w * 0.16, -h * 0.34, w * 0.4, h * 0.68, h * 0.22);
      glass(g, w * 0.16, -h * 0.3, w * 0.1, h * 0.6, 4);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(-w * 0.12, -h * 0.34, 6, h * 0.68);
      headlamps(g, w / 2 - 4, h * 0.3, true);
      taillamps(g, -w / 2 + 1, h * 0.3);
    },

    rideshare(g, w, h, t) {
      shadow(g, w, h);
      wheels(g, w, h, [-w * 0.3, w * 0.3]);
      paint(g, '#eef1f5', -w / 2, -h / 2, w, h, h * 0.4);
      glass(g, -w * 0.16, -h * 0.34, w * 0.4, h * 0.68, h * 0.22);
      glass(g, w * 0.16, -h * 0.3, w * 0.1, h * 0.6, 4);
      // Roof sign with a soft pulse. Plain colour block, no lettering.
      const pulse = 0.55 + 0.45 * Math.sin(t * 5);
      g.fillStyle = `rgba(255,205,70,${0.6 + 0.4 * pulse})`;
      rr(g, -w * 0.1, -h * 0.12, w * 0.2, h * 0.24, 4);
      g.fill();
      headlamps(g, w / 2 - 4, h * 0.3, true);
      taillamps(g, -w / 2 + 1, h * 0.3);
    },

    suv(g, w, h) {
      shadow(g, w, h);
      wheels(g, w, h, [-w * 0.3, w * 0.3]);
      paint(g, '#c76a4a', -w / 2, -h / 2, w, h, h * 0.36);
      // Roof rack.
      g.strokeStyle = '#3b3f49';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(-w * 0.26, -h * 0.4); g.lineTo(w * 0.22, -h * 0.4);
      g.moveTo(-w * 0.26, h * 0.4); g.lineTo(w * 0.22, h * 0.4);
      g.stroke();
      glass(g, -w * 0.2, -h * 0.34, w * 0.44, h * 0.68, h * 0.2);
      glass(g, w * 0.2, -h * 0.3, w * 0.1, h * 0.6, 4);
      headlamps(g, w / 2 - 4, h * 0.3, true);
      taillamps(g, -w / 2 + 1, h * 0.3);
    },

    pickup(g, w, h) {
      shadow(g, w, h);
      wheels(g, w, h, [-w * 0.32, w * 0.3]);
      // Bed first (rear third), then the cab over the front.
      paint(g, '#8e9aa8', -w / 2, -h / 2, w * 0.5, h, 6);
      g.fillStyle = 'rgba(30,36,46,0.35)';
      g.fillRect(-w / 2 + 6, -h / 2 + 5, w * 0.5 - 12, h - 10);
      paint(g, '#d9dee6', -w * 0.02, -h / 2, w * 0.52, h, h * 0.36);
      glass(g, w * 0.18, -h * 0.34, w * 0.2, h * 0.68, 6);
      headlamps(g, w / 2 - 4, h * 0.3, true);
      taillamps(g, -w / 2 + 1, h * 0.3);
    },

    sport(g, w, h) {
      shadow(g, w, h);
      wheels(g, w, h, [-w * 0.28, w * 0.3]);
      paint(g, '#ff5c7a', -w / 2, -h / 2, w, h, h * 0.5);
      g.fillStyle = '#ffe066';
      g.fillRect(-w * 0.34, -2.5, w * 0.66, 5);
      glass(g, -w * 0.1, -h * 0.3, w * 0.36, h * 0.6, h * 0.26);
      g.fillStyle = '#20232c';
      rr(g, -w / 2 + 2, -h * 0.42, 7, h * 0.84, 3);
      g.fill();
      headlamps(g, w / 2 - 5, h * 0.28, true);
      taillamps(g, -w / 2 + 1, h * 0.28);
    },

    van(g, w, h) {
      shadow(g, w, h);
      wheels(g, w, h, [-w * 0.3, w * 0.3]);
      paint(g, '#eef6ef', -w / 2, -h / 2, w, h, 9);
      // Cargo box with a green band.
      g.fillStyle = 'rgba(40,120,80,0.18)';
      rr(g, -w / 2 + 6, -h / 2 + 6, w * 0.6, h - 12, 6);
      g.fill();
      g.fillStyle = '#2e9e6d';
      g.fillRect(-w / 2 + 6, -3.5, w * 0.6, 7);
      glass(g, w * 0.26, -h * 0.36, w * 0.18, h * 0.72, 7);
      headlamps(g, w / 2 - 4, h * 0.3, true);
      taillamps(g, -w / 2 + 1, h * 0.3);
    },

    bus(g, w, h) {
      shadow(g, w, h);
      wheels(g, w, h, [-w * 0.36, -w * 0.1, w * 0.26]);
      paint(g, '#f2c94c', -w / 2, -h / 2, w, h, 12);
      // Windows run along both flanks.
      const n = 8;
      const cell = (w - 44) / n;
      g.fillStyle = '#243652';
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + 14 + i * cell;
        rr(g, x, -h / 2 + 6, cell - 8, 10, 3); g.fill();
        rr(g, x, h / 2 - 16, cell - 8, 10, 3); g.fill();
      }
      g.fillStyle = '#34495e';
      g.fillRect(-w * 0.3, -2, w * 0.6, 4);
      // Windscreen and a door line near the front.
      glass(g, w / 2 - 16, -h * 0.36, 10, h * 0.72, 4);
      g.fillStyle = 'rgba(30,40,55,0.5)';
      g.fillRect(w / 2 - 34, -h / 2 + 4, 2, h - 8);
      headlamps(g, w / 2 - 4, h * 0.32, true);
      taillamps(g, -w / 2 + 1, h * 0.32);
    },

    scooter(g, w, h, t, phase) {
      shadow(g, w, h);
      g.fillStyle = '#2a3142';
      rr(g, -w * 0.46, -4, w * 0.92, 8, 4); g.fill();
      g.fillStyle = '#10141e';
      g.beginPath();
      g.arc(-w * 0.42, 0, 6, 0, TAU);
      g.arc(w * 0.42, 0, 6, 0, TAU);
      g.fill();
      g.strokeStyle = '#2a3142';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(w * 0.36, -h * 0.42); g.lineTo(w * 0.36, h * 0.42); g.stroke();
      // Rider in a yellow jacket with a white helmet.
      const jacket = g.createRadialGradient(-w * 0.06, -4, 2, -w * 0.06, 0, h * 0.6);
      jacket.addColorStop(0, '#ffe872');
      jacket.addColorStop(1, '#d9a100');
      g.fillStyle = jacket;
      g.beginPath(); g.ellipse(-w * 0.08, 0, w * 0.26, h * 0.42, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(w * 0.06, 0, 9, 0, TAU); g.fill();
      g.fillStyle = '#26324a';
      rr(g, w * 0.1, -4, 7, 8, 2); g.fill();
      headlamps(g, w * 0.46, 0, true);
    },

    bike(g, w, h, t, phase) {
      shadow(g, w, h);
      // Frame: two wheels joined by a bar and a seat post.
      g.strokeStyle = '#2f3440';
      g.lineWidth = 3.2;
      g.beginPath();
      g.moveTo(-w * 0.36, 0); g.lineTo(0, -2); g.lineTo(w * 0.36, 0);
      g.moveTo(0, -2); g.lineTo(-w * 0.06, 6);
      g.moveTo(w * 0.26, 0); g.lineTo(w * 0.36, -h * 0.4);
      g.stroke();
      g.fillStyle = '#141820';
      g.beginPath(); g.arc(-w * 0.36, 0, 5.4, 0, TAU); g.arc(w * 0.36, 0, 5.4, 0, TAU); g.fill();
      // Rider: a teal top and a helmet, leaning a little with the wobble.
      const lean = Math.sin(t * 3 + phase) * 0.8;
      g.fillStyle = '#2ab7a9';
      g.beginPath(); g.ellipse(-w * 0.08, lean, w * 0.2, h * 0.3, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffd166';
      g.beginPath(); g.arc(w * 0.14, lean, 6.4, 0, TAU); g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1;
      g.beginPath(); g.arc(w * 0.14, lean, 6.4, 0, TAU); g.stroke();
    },

    bot(g, w, h, t, phase) {
      shadow(g, w, h);
      g.fillStyle = '#1a2030';
      rr(g, -w / 2 - 2, -h * 0.3, w + 4, h * 0.6, 4); g.fill();
      paint(g, '#f7fbff', -w / 2, -h / 2, w, h, 10);
      const pulse = 0.5 + 0.5 * Math.sin(t * 7 + phase);
      g.fillStyle = `rgba(61,169,255,${0.5 + 0.5 * pulse})`;
      rr(g, -w * 0.34, -h * 0.14, w * 0.68, h * 0.28, 4); g.fill();
      headlamps(g, w / 2 - 4, 0, true);
    },
  };

  // Draws a vehicle centred on its position. `v` needs kind, w, h, dir, x, y, phase.
  function drawVehicle(ctx, v, t) {
    const paintFn = PAINTERS[v.kind];
    if (!paintFn) return;
    ctx.save();
    ctx.translate(v.x, v.y);
    if (v.dir < 0) ctx.scale(-1, 1);
    paintFn(ctx, v.w, v.h, t, v.phase);
    ctx.restore();
  }

  global.Dogger = global.Dogger || {};
  global.Dogger.Vehicles = { drawVehicle, kinds: Object.keys(PAINTERS) };
})(window);
