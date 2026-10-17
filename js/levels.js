// Dogger level design and grid geometry.
//
// A level is a stack of horizontal strips, bottom (start) to top (goal):
//   S = sidewalk (safe)    R = road lane (traffic)
//   M = median (safe, cones may stand here)    G = far curb (goal)
(function (global) {
  'use strict';

  const WIDTH = 540;
  const HEIGHT = 960;
  const COLS = 9;
  const COL_W = 60;
  const ROW_H = 68;
  const START_COL = 4;
  const FIELD_BOTTOM = HEIGHT - 40;

  const colX = (col) => col * COL_W + COL_W / 2;
  const rowY = (row) => FIELD_BOTTOM - (row + 0.5) * ROW_H;
  const fieldTop = (rowCount) => FIELD_BOTTOM - rowCount * ROW_H;

  // Gameplay sizes of each vehicle, all drawn facing right. Hit boxes use these too.
  const VEHICLES = {
    hatch: { w: 92, h: 46 },
    van: { w: 124, h: 52 },
    bus: { w: 176, h: 56 },
    sport: { w: 98, h: 40 },
    scooter: { w: 48, h: 34 },
    bot: { w: 38, h: 38 },
  };

  const ALL_VEHICLES = ['hatch', 'van', 'bus', 'sport', 'scooter', 'bot'];

  // Ten levels, each one a clear step up.
  //   speed: base traffic speed in px/s (each lane varies around it)
  //   gap:   minimum space between cars in a lane, in px (smaller means denser traffic)
  //   pool:  vehicle types that can spawn
  //   cones: traffic cones placed on the medians
  //   bones: bones on the street at any one time (they refill after every crossing)
  //   crossings: trips across the street needed to clear the level
  const LEVELS = [
    { name: 'Quiet Street', tag: 'Two lanes. Hop, hop, home.', rows: 'SRRG', speed: 70, gap: 190, pool: ['hatch', 'van'], cones: 0, bones: 4, crossings: 3 },
    { name: 'Morning Rush', tag: 'A third lane joins the rush.', rows: 'SRRRG', speed: 84, gap: 178, pool: ['hatch', 'van', 'hatch'], cones: 0, bones: 4, crossings: 3 },
    { name: 'School Run', tag: 'Big buses are on the road.', rows: 'SRRRG', speed: 98, gap: 166, pool: ['hatch', 'van', 'bus'], cones: 0, bones: 5, crossings: 4 },
    { name: 'Scooter Alley', tag: 'E-scooters zip between lanes!', rows: 'SRRRRG', speed: 110, gap: 156, pool: ['hatch', 'bus', 'scooter'], cones: 0, bones: 5, crossings: 4 },
    { name: 'Median Mayhem', tag: 'Rest on the median. Mind the cones.', rows: 'SRRMRRG', speed: 122, gap: 146, pool: ['hatch', 'van', 'scooter', 'sport'], cones: 2, bones: 6, crossings: 4 },
    { name: 'Delivery Day', tag: 'Delivery bots join the traffic.', rows: 'SRRMRRRG', speed: 134, gap: 136, pool: ['van', 'bot', 'scooter', 'hatch'], cones: 2, bones: 6, crossings: 5 },
    { name: 'Bus Lane Blitz', tag: 'Sports cars. No brakes.', rows: 'SRRMRRRG', speed: 146, gap: 126, pool: ['bus', 'sport', 'scooter', 'bot', 'hatch'], cones: 3, bones: 7, crossings: 5 },
    { name: 'Rush Hour', tag: 'Six lanes of nonstop traffic.', rows: 'SRRMRRRRG', speed: 158, gap: 116, pool: ['hatch', 'sport', 'van', 'scooter', 'bot'], cones: 3, bones: 7, crossings: 6 },
    { name: 'Electric Avenue', tag: 'Eight lanes. Fast and dense.', rows: 'SRRRMRRRRRG', speed: 172, gap: 106, pool: ['hatch', 'sport', 'van', 'bus', 'scooter', 'bot'], cones: 4, bones: 8, crossings: 6 },
    { name: "Peanut's Big Walk", tag: 'Two medians. Every lane is hungry.', rows: 'SRRMRRRMRRRG', speed: 190, gap: 100, pool: ALL_VEHICLES, cones: 5, bones: 8, crossings: 8 },
  ];

  function shuffle(list, rand) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // Turns a level definition into a concrete layout: lanes with directions and speeds, and cone cells.
  function build(index, rand = Math.random) {
    const def = LEVELS[index];
    const rows = def.rows.split('');
    const lanes = [];

    let dir = rand() < 0.5 ? 1 : -1;
    rows.forEach((code, row) => {
      if (code !== 'R') return;
      lanes.push({ row, dir, speed: def.speed * (0.85 + rand() * 0.3), gapMin: def.gap });
      dir = -dir;
    });

    // Cones only stand on medians, and no median row takes more than three, so a path always exists.
    const cells = [];
    rows.forEach((code, row) => {
      if (code !== 'M') return;
      for (let col = 0; col < COLS; col++) cells.push({ col, row });
    });
    const perRow = {};
    const cones = [];
    for (const cell of shuffle(cells, rand)) {
      if (cones.length >= def.cones) break;
      perRow[cell.row] = perRow[cell.row] || 0;
      if (perRow[cell.row] >= 3) continue;
      perRow[cell.row] += 1;
      cones.push(cell);
    }

    return { index, def, rows, rowCount: rows.length, goalRow: rows.length - 1, lanes, cones };
  }

  global.Dogger = global.Dogger || {};
  global.Dogger.Levels = {
    WIDTH,
    HEIGHT,
    COLS,
    COL_W,
    ROW_H,
    START_COL,
    FIELD_BOTTOM,
    VEHICLES,
    LEVELS,
    build,
    colX,
    rowY,
    fieldTop,
    shuffle,
  };
})(window);
