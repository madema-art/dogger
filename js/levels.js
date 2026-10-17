// Dogger level design and board geometry.
//
// The board is a fixed screen, like a classic arcade crossing: every lane of every level is visible
// at once and nothing scrolls. Every level has the same bones:
//
//   G  far curb, the goal
//   five lanes   (road group A)   every vehicle in group A drives the same way
//   M  median    the one safe strip in the middle, between the two roads
//   five lanes   (road group B)   every vehicle in group B drives the opposite way
//   S  sidewalk, the safe start
//
// That is ten lanes to cross. Each lane has an identity that sets its traffic character:
//
//   R  commuter  (mixed cars, medium speed)
//   H  heavy     (buses and vans, slow, long gaps)
//   F  fast      (sports cars and sedans, quick and sparse)
//   D  delivery  (vans and robots, bursty: groups then a pause)
//   B  bike lane (cyclists, scooters and robots, slow, close to the kerb)
//
// Identities can mix within a group, but the direction rule never changes: group A drives right and
// group B drives left, so the player can read the flow of the whole street.
(function (global) {
  'use strict';

  const WIDTH = 1280;
  const HEIGHT = 720;
  const COLS = 16;
  const COL_W = 80;
  const START_COL = 7;
  // The five home openings in the far hedge. Each one is a house Peanut has to reach.
  const HOME_COLS = [2, 5, 8, 11, 14];
  const HOMES_PER_LEVEL = 5;
  const HUD_H = 62;
  const BOARD_BOTTOM = HEIGHT - 10;
  const MEDIAN_WEIGHT = 0.6; // the median is narrower than a traffic lane

  // Lays out the strips from `codes` (bottom to top) so they fill the screen under the HUD.
  // Lanes share one height; the median is a narrower strip. Heights are integers.
  function geometry(codes) {
    const avail = BOARD_BOTTOM - HUD_H - 8;
    const weight = codes.map((c) => (c === 'M' ? MEDIAN_WEIGHT : 1));
    const unit = avail / weight.reduce((a, b) => a + b, 0);
    const heights = weight.map((w) => Math.floor(w * unit));
    const tops = [];
    let y = BOARD_BOTTOM;
    heights.forEach((h, r) => {
      y -= h;
      tops[r] = y;
    });
    return { heights, tops, bottom: BOARD_BOTTOM, top: y, laneH: Math.floor(unit) };
  }

  const colX = (col) => col * COL_W + COL_W / 2;
  const rowTop = (geo, row) => geo.tops[row];
  const rowY = (geo, row) => geo.tops[row] + geo.heights[row] / 2;

  // Vehicle sizes in logical pixels, all drawn facing right. Hit boxes use these too.
  // kind: which painter draws it (see art-vehicles.js).
  const VEHICLES = {
    compact: { w: 84, h: 40, kind: 'compact' },
    sedan: { w: 110, h: 44, kind: 'sedan' },
    rideshare: { w: 110, h: 44, kind: 'rideshare' },
    suv: { w: 120, h: 50, kind: 'suv' },
    pickup: { w: 130, h: 48, kind: 'pickup' },
    sport: { w: 98, h: 36, kind: 'sport' },
    van: { w: 138, h: 50, kind: 'van' },
    bus: { w: 206, h: 52, kind: 'bus' },
    scooter: { w: 46, h: 30, kind: 'scooter' },
    bike: { w: 56, h: 22, kind: 'bike' },
    bot: { w: 36, h: 36, kind: 'bot' },
    parked: { w: 150, h: 46, kind: 'van' },
  };

  // Lane identities. Each one has a character the player can learn.
  const IDENTITY = {
    commuter: { pool: ['compact', 'sedan', 'suv', 'rideshare', 'pickup'], speed: 1.0, gap: 1.0, bursty: false },
    heavy: { pool: ['bus', 'van', 'pickup'], speed: 0.6, gap: 1.35, bursty: false },
    fast: { pool: ['sport', 'sedan', 'sport'], speed: 1.6, gap: 1.5, bursty: false },
    delivery: { pool: ['van', 'bot', 'van', 'bot'], speed: 0.95, gap: 1.0, bursty: true },
    bike: { pool: ['bike', 'scooter', 'bike', 'bot'], speed: 0.55, gap: 0.9, bursty: false },
  };

  const ROW_TYPES = {
    S: { kind: 'safe' },
    G: { kind: 'goal' },
    M: { kind: 'median' },
    R: { kind: 'road', identity: 'commuter' },
    H: { kind: 'road', identity: 'heavy' },
    F: { kind: 'road', identity: 'fast' },
    D: { kind: 'road', identity: 'delivery' },
    B: { kind: 'road', identity: 'bike' },
  };

  // Ten levels, each one a clear step up. Every layout has the same ten lanes:
  // five in group A (driving right), a median, and five in group B (driving left).
  //   rows:   the strip codes, bottom to top (see the key above)
  //   speed:  base speed in px/s for commuter lanes (other identities scale from it)
  //   gap:    minimum space between vehicles in a lane, before the identity scaling
  //   cones / barriers / vans: obstacles placed on the median
  //   bones / crossings: pickups on the board, and trips across needed to clear the level
  const LAYOUT = {
    rowsOf(groupA, groupB) {
      return 'S' + groupA + 'M' + groupB + 'G';
    },
  };

  const LEVELS = [
    { name: 'Quiet Street', tag: 'Two five-lane roads. Each one flows one way.', rows: LAYOUT.rowsOf('RRRRR', 'RRRRR'), speed: 70, gap: 280, cones: 0, barriers: 0, vans: 0, bones: 4, crossings: HOMES_PER_LEVEL },
    { name: 'Morning Rush', tag: 'The fast lane joins the commute.', rows: LAYOUT.rowsOf('RRHRF', 'RRRRF'), speed: 84, gap: 250, cones: 0, barriers: 0, vans: 0, bones: 5, crossings: HOMES_PER_LEVEL },
    { name: 'Median Break', tag: 'The median is your only rest stop. Two cones guard it.', rows: LAYOUT.rowsOf('RRHRF', 'RRHRF'), speed: 96, gap: 230, cones: 2, barriers: 0, vans: 0, bones: 5, crossings: HOMES_PER_LEVEL },
    { name: 'School Run', tag: 'Buses on both roads. Give them room.', rows: LAYOUT.rowsOf('RRHRF', 'HRRRF'), speed: 108, gap: 215, cones: 2, barriers: 1, vans: 0, bones: 6, crossings: HOMES_PER_LEVEL },
    { name: 'Bike Lane', tag: 'Cyclists ride the kerbs on both roads.', rows: LAYOUT.rowsOf('RBHRF', 'RRBRF'), speed: 118, gap: 200, cones: 2, barriers: 1, vans: 0, bones: 6, crossings: HOMES_PER_LEVEL },
    { name: 'Delivery Day', tag: 'Delivery vans arrive in bunches, then pause.', rows: LAYOUT.rowsOf('RDHRF', 'RRDRF'), speed: 130, gap: 190, cones: 3, barriers: 1, vans: 0, bones: 7, crossings: HOMES_PER_LEVEL },
    { name: 'Roadworks', tag: 'Barriers close the median. Find a clear cell.', rows: LAYOUT.rowsOf('DRHRF', 'RRDRF'), speed: 142, gap: 178, cones: 3, barriers: 2, vans: 1, bones: 7, crossings: HOMES_PER_LEVEL },
    { name: 'Rush Hour', tag: 'Fast lanes on both sides. Commuters everywhere.', rows: LAYOUT.rowsOf('RDHFR', 'FRDRB'), speed: 156, gap: 166, cones: 3, barriers: 2, vans: 1, bones: 8, crossings: HOMES_PER_LEVEL },
    { name: 'Electric Avenue', tag: 'Tighter gaps, robots in the bike lanes.', rows: LAYOUT.rowsOf('RDHFR', 'FRDFB'), speed: 170, gap: 154, cones: 4, barriers: 2, vans: 2, bones: 8, crossings: HOMES_PER_LEVEL },
    { name: "Peanut's Big Walk", tag: 'Full speed on both roads. Every gap counts.', rows: LAYOUT.rowsOf('FDHFR', 'FRDFB'), speed: 186, gap: 144, cones: 4, barriers: 2, vans: 2, bones: 9, crossings: HOMES_PER_LEVEL },
  ];

  function shuffle(list, rand) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // Turns a level definition into a concrete board: lanes with directions, speeds and vehicle pools,
  // plus the obstacle cells that sit on the median.
  function build(index, rand = Math.random) {
    const def = LEVELS[index];
    const rows = def.rows.split('');
    const geo = geometry(rows);
    const lanes = [];

    // Group A (below the median) drives right, group B (above it) drives left.
    const medianRow = rows.indexOf('M');
    rows.forEach((code, row) => {
      const type = ROW_TYPES[code];
      if (type.kind !== 'road') return;
      const id = IDENTITY[type.identity];
      lanes.push({
        row,
        dir: row < medianRow ? 1 : -1,
        identity: type.identity,
        pool: id.pool,
        bursty: id.bursty,
        speed: def.speed * id.speed * (0.9 + rand() * 0.2),
        gapMin: def.gap * id.gap,
        laneH: geo.heights[row],
      });
    });

    // Obstacles only stand on the median, so every crossing always has a way through.
    const medianCells = [];
    rows.forEach((code, row) => {
      if (code !== 'M') return;
      for (let col = 0; col < COLS; col++) medianCells.push({ col, row });
    });
    const obstacles = [];
    const taken = new Set();
    for (let col = 0; col < COLS; col++) {
      if (!HOME_COLS.includes(col)) taken.add(col + ':' + (rows.length - 1));
    }
    const key = (c, r) => c + ':' + r;
    const place = (kind, count, span) => {
      for (const cell of shuffle(medianCells.slice(), rand)) {
        if (count <= 0) break;
        const cells = [];
        for (let s = 0; s < span; s++) cells.push({ col: cell.col + s, row: cell.row });
        if (cells.some((c) => c.col >= COLS || taken.has(key(c.col, c.row)))) continue;
        // Keep at least four clear cells on the median.
        const used = obstacles.reduce((n, o) => n + o.span, 0) + span;
        if (used > COLS - 4) continue;
        cells.forEach((c) => taken.add(key(c.col, c.row)));
        obstacles.push({ kind, col: cell.col, row: cell.row, span });
        count--;
      }
    };
    place('cone', def.cones, 1);
    place('barrier', def.barriers, 2);
    place('van', def.vans, 2);

    return {
      index,
      def,
      rows,
      rowCount: rows.length,
      goalRow: rows.length - 1,
      homeCols: HOME_COLS.slice(),
      medianRow,
      geo,
      lanes,
      obstacles,
      blocked: taken,
    };
  }

  global.Dogger = global.Dogger || {};
  global.Dogger.Levels = {
    WIDTH,
    HEIGHT,
    COLS,
    COL_W,
    START_COL,
    HUD_H,
    VEHICLES,
    IDENTITY,
    LEVELS,
    build,
    geometry,
    colX,
    rowY,
    rowTop,
    shuffle,
    HOME_COLS,
    HOMES_PER_LEVEL,
  };
})(window);
