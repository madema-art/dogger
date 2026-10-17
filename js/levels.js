// Dogger level design and board geometry.
//
// The board is a fixed screen, like a classic arcade crossing: every lane of every level is visible
// at once and nothing scrolls. A level is a stack of strips, listed bottom (start) to top (goal):
//
//   S  sidewalk, safe start            G  far curb, the goal
//   M  median, safe strip (obstacles may stand here)
//   R  commuter lane   (mixed cars, medium speed)
//   H  heavy lane      (buses and vans, slow, long gaps)
//   F  fast lane       (sports cars and sedans, quick and sparse)
//   D  delivery lane   (vans and robots, bursty: groups then a pause)
//   B  bike lane       (cyclists, scooters and robots, slow, close to the curb)
//
// Lanes alternate direction from bottom to top, so traffic always flows both ways.
(function (global) {
  'use strict';

  const WIDTH = 1280;
  const HEIGHT = 720;
  const COLS = 16;
  const COL_W = 80;
  const START_COL = 7;
  const HUD_H = 62;
  const BOARD_BOTTOM = HEIGHT - 10;
  const MAX_ROW_H = 72;

  // Fits any number of strips inside the screen under the HUD. Rows get shorter as levels add lanes.
  function geometry(rowCount) {
    const rowH = Math.min(MAX_ROW_H, Math.floor((BOARD_BOTTOM - HUD_H - 8) / rowCount));
    return { rowH, bottom: BOARD_BOTTOM, top: BOARD_BOTTOM - rowCount * rowH };
  }

  const colX = (col) => col * COL_W + COL_W / 2;
  const rowY = (geo, row) => geo.bottom - (row + 0.5) * geo.rowH;
  const rowTop = (geo, row) => geo.bottom - (row + 1) * geo.rowH;

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

  // Ten levels, each one a clear step up.
  //   rows:   strip layout (see the key above)
  //   speed:  base speed in px/s for commuter lanes (other identities scale from it)
  //   gap:    minimum space between vehicles in a lane, before the identity scaling
  //   cones / barriers / vans: obstacles placed on median strips
  //   bones / crossings: pickups on the board, and trips across needed to clear the level
  const LEVELS = [
    { name: 'Quiet Street', tag: 'Five lanes of school-run traffic. Hop when the gap opens.', rows: 'SRRHRFG', speed: 74, gap: 260, cones: 0, barriers: 0, vans: 0, bones: 4, crossings: 3 },
    { name: 'Morning Rush', tag: 'The commuters are up. Watch the fast lane.', rows: 'SRRHRFG', speed: 90, gap: 240, cones: 0, barriers: 0, vans: 0, bones: 5, crossings: 3 },
    { name: 'Median Break', tag: 'A safe median splits the street. Rest there.', rows: 'SRRHMRFRG', speed: 102, gap: 230, cones: 2, barriers: 0, vans: 0, bones: 5, crossings: 4 },
    { name: 'School Run', tag: 'Buses take the heavy lane. Give them room.', rows: 'SRRHMRFRG', speed: 114, gap: 210, cones: 2, barriers: 1, vans: 0, bones: 6, crossings: 4 },
    { name: 'Bike Lane', tag: 'Cyclists and scooters roll along the curb.', rows: 'SRRHMRFRBG', speed: 124, gap: 200, cones: 2, barriers: 1, vans: 0, bones: 6, crossings: 4 },
    { name: 'Delivery Day', tag: 'Delivery vans come in bunches, then pause.', rows: 'SRRHMRDFRBG', speed: 136, gap: 190, cones: 3, barriers: 1, vans: 0, bones: 7, crossings: 5 },
    { name: 'Roadworks', tag: 'Barriers close the median. Find a clear cell.', rows: 'SRRHMRDFRBG', speed: 148, gap: 178, cones: 3, barriers: 2, vans: 1, bones: 7, crossings: 5 },
    { name: 'Rush Hour', tag: 'Two medians now. Commuters all the way.', rows: 'SRRHMRDFMRBG', speed: 160, gap: 168, cones: 3, barriers: 2, vans: 1, bones: 8, crossings: 6 },
    { name: 'Electric Avenue', tag: 'Faster lanes, tighter gaps, robots in the bike lane.', rows: 'SRRHMRDFMRBG', speed: 174, gap: 156, cones: 4, barriers: 2, vans: 2, bones: 8, crossings: 6 },
    { name: "Peanut's Big Walk", tag: 'Every lane at full speed. Every gap counts.', rows: 'SRRHMRDFMRBG', speed: 192, gap: 146, cones: 4, barriers: 2, vans: 2, bones: 9, crossings: 8 },
  ];

  function shuffle(list, rand) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // Turns a level definition into a concrete board: lanes with directions, speeds and vehicle pools,
  // plus the obstacle cells that sit on median strips.
  function build(index, rand = Math.random) {
    const def = LEVELS[index];
    const rows = def.rows.split('');
    const geo = geometry(rows.length);
    const lanes = [];

    let dir = rand() < 0.5 ? 1 : -1;
    rows.forEach((code, row) => {
      const type = ROW_TYPES[code];
      if (type.kind !== 'road') return;
      const id = IDENTITY[type.identity];
      lanes.push({
        row,
        dir,
        identity: type.identity,
        pool: id.pool,
        bursty: id.bursty,
        speed: def.speed * id.speed * (0.9 + rand() * 0.2),
        gapMin: def.gap * id.gap,
      });
      dir = -dir;
    });

    // Obstacles only stand on median strips, so every crossing always has a way through.
    const medianCells = [];
    rows.forEach((code, row) => {
      if (code !== 'M') return;
      for (let col = 0; col < COLS; col++) medianCells.push({ col, row });
    });
    const obstacles = [];
    const taken = new Set();
    const key = (c, r) => c + ':' + r;
    const place = (kind, count, span) => {
      for (const cell of shuffle(medianCells.slice(), rand)) {
        if (count <= 0) break;
        const cells = [];
        for (let s = 0; s < span; s++) cells.push({ col: cell.col + s, row: cell.row });
        if (cells.some((c) => c.col >= COLS || taken.has(key(c.col, c.row)))) continue;
        // Keep at least one clear cell on every median row.
        const rowBlocked = obstacles.filter((o) => o.row === cell.row).reduce((n, o) => n + o.span, 0) + span;
        if (rowBlocked > COLS - 4) continue;
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
    MAX_ROW_H,
    VEHICLES,
    IDENTITY,
    LEVELS,
    build,
    geometry,
    colX,
    rowY,
    rowTop,
    shuffle,
  };
})(window);
