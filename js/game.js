// Dogger game loop: screens, Peanut's grid hops, traffic, rewards, lives and levels.
(function (global) {
  'use strict';

  const D = global.Dogger;
  const L = D.Levels;
  const Effects = D.Render.Effects;
  const W = L.WIDTH;
  const H = L.HEIGHT;
  const { COLS, START_COL, VEHICLES, colX, rowY } = L;
  const ENTER_TIME = 0.45;

  const HOP_TIME = 0.12;
  const LAND_TIME = 0.1;
  const START_LIVES = 3;
  const MAX_LIVES = 5;
  const LIFE_EVERY = 2000;
  const COMBO_WINDOW = 5;
  const DOG_HIT = { x: 12, y: 12 };
  const CAR_INSET = 5;
  const NEAR_MISS = 12;
  const INTRO_TIME = 2.8;
  const CLEAR_TIME = 3.4;
  const DEATH_TIME = 1.2;
  const SPAWN_TIME = 0.35;
  const BEST_KEY = 'dogger.best';
  const COUNTDOWN = [
    { at: 0, label: '3', final: false },
    { at: 0.7, label: '2', final: false },
    { at: 1.4, label: '1', final: false },
    { at: 2.1, label: 'GO!', final: true },
  ];

  const lerp = (a, b, k) => a + (b - a) * k;

  function newDog() {
    return {
      col: START_COL,
      row: 0,
      x: colX(START_COL),
      y: 0,
      state: 'idle', // idle | hop | spawn | dead
      dir: 'up',
      t: 0,
      from: null,
      to: null,
      lift: 0,
      landT: null,
      bestRow: 0,
      step: 0,
    };
  }

  function readBest() {
    try {
      return Number(global.localStorage.getItem(BEST_KEY)) || 0;
    } catch (err) {
      return 0;
    }
  }

  function writeBest(score) {
    try {
      global.localStorage.setItem(BEST_KEY, String(score));
    } catch (err) {
      // Storage can be blocked. The best score just won't persist.
    }
  }

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = Math.min(2, global.devicePixelRatio || 1);
      canvas.width = W * this.dpr;
      canvas.height = H * this.dpr;

      this.sound = new D.Sound();
      this.input = new D.Input(() => this.sound.unlock());
      this.best = readBest();
      this.buildWatch = new D.BuildWatch();
      this.peanutSprite = D.Peanut.createSprite();
      this.boardCanvas = null;
      this.t = 0;
      this.modeT = 0;
      this.mode = 'loading';
      this.effects = [];
      this.shakeT = 0;
      this.shakeMag = 0;
      this.toastT = 0;
      this.lastTime = 0;
      this.queued = null;
      this.cdIndex = 0;
      this.level = null;
      this.lanes = [];
      this.bones = [];
      this.dog = newDog();
      this.resetRun();

      this.dogImg = new Image();
      this.dogImg.onload = () => this.setMode('title');
      this.dogImg.onerror = () => this.setMode('title');
      this.dogImg.src = 'assets/peanut.png';

      canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
      global.addEventListener('visibilitychange', () => {
        if (document.hidden && this.mode === 'play') this.pause();
      });

      this.frame = this.frame.bind(this);
      requestAnimationFrame(this.frame);
    }

    resetRun() {
      this.score = 0;
      this.lives = START_LIVES;
      this.nextLifeAt = LIFE_EVERY;
      this.combo = 0;
      this.comboTimer = 0;
      this.levelIndex = 0;
      this.levelDeaths = 0;
      this.crossings = 0;
      this.stars = 3;
      this.lastBonus = 0;
    }

    // ---------- screens ----------

    setMode(mode) {
      this.mode = mode;
      this.modeT = 0;
    }

    onPointer(e) {
      this.sound.unlock();
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (W / rect.width);
      const y = (e.clientY - rect.top) * (H / rect.height);
      const b = D.Render.TITLE_BUTTON;
      if (this.mode === 'title' && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        this.startRun();
      }
    }

    goTitle() {
      this.setMode('title');
      this.queued = null;
    }

    startRun() {
      this.sound.unlock();
      this.sound.start();
      this.resetRun();
      this.beginLevel(0);
    }

    beginLevel(index) {
      this.loadLevel(index);
      this.cdIndex = 0;
      this.setMode('intro');
    }

    advanceLevel() {
      if (this.levelIndex + 1 < L.LEVELS.length) {
        this.beginLevel(this.levelIndex + 1);
      } else {
        this.win();
      }
    }

    pause() {
      if (this.mode !== 'play') return;
      this.setMode('paused');
      this.sound.pause();
    }

    resume() {
      this.setMode('play');
      this.sound.resume();
    }

    gameOver() {
      this.combo = 0;
      this.comboTimer = 0;
      this.saveBest();
      this.setMode('over');
      this.sound.gameOver();
    }

    win() {
      this.saveBest();
      this.setMode('win');
      this.sound.win();
      Effects.burst(this.effects, W / 2, H * 0.4, {
        count: 80, speed: 380, life: 1.7, kind: 'confetti', size: 6, gravity: 260, lift: 260,
        colors: ['#FFE066', '#7CF2C4', '#FFFFFF', '#FF8FD8', '#8EC5FF'],
      });
    }

    saveBest() {
      if (this.score > this.best) {
        this.best = this.score;
        writeBest(this.best);
      }
    }

    countdownLabel() {
      let label = '';
      for (const step of COUNTDOWN) {
        if (this.modeT >= step.at) label = step.label;
      }
      return label;
    }

    // ---------- level setup ----------

    loadLevel(index) {
      this.levelIndex = index;
      this.level = L.build(index);
      this.boardCanvas = D.Board.buildBoard(this.level, this.dpr);
      this.lanes = this.level.lanes.map((lane) => ({
        ...lane,
        vehicles: [],
        last: null,
        nextGap: lane.gapMin,
        spawned: 0,
      }));
      this.crossings = 0;
      this.homes = this.level.homeCols.map(() => false);
      this.levelDeaths = 0;
      this.combo = 0;
      this.comboTimer = 0;
      this.queued = null;
      this.dog = newDog();
      this.dog.y = rowY(this.level.geo, 0);
      this.placeBones();
      // Warm up the traffic so the board is already busy when the level starts.
      for (let i = 0; i < 360; i++) this.updateTraffic(1 / 30);
    }

    resetDog() {
      this.dog = newDog();
      this.dog.y = rowY(this.level.geo, 0);
      this.dog.state = 'spawn';
      this.queued = null;
    }

    placeBones() {
      const free = [];
      for (let row = 1; row < this.level.goalRow; row++) {
        const code = this.level.rows[row];
        if (code === 'S' || code === 'G') continue;
        for (let col = 0; col < COLS; col++) {
          if (!this.isBlocked(col, row)) free.push({ col, row });
        }
      }
      const picks = L.shuffle(free, Math.random).slice(0, this.level.def.bones);
      this.bones = picks.map((p) => ({ ...p, got: false, seed: Math.random() * 6 }));
    }

    isBlocked(col, row) {
      return this.level.blocked.has(col + ':' + row);
    }

    // ---------- traffic ----------

    updateTraffic(dt) {
      const geo = this.level.geo;
      for (const lane of this.lanes) {
        const y = rowY(geo, lane.row);
        for (const v of lane.vehicles) {
          v.x += v.dir * lane.speed * dt;
          v.phase += dt;
          v.y = y + (v.kind === 'scooter' || v.kind === 'bike' ? Math.sin(v.phase * 3) * 4 : 0);
        }
        lane.vehicles = lane.vehicles.filter((v) => (v.dir > 0 ? v.x - v.w / 2 < W + 60 : v.x + v.w / 2 > -60));

        // A new vehicle enters once the previous one has left enough space at the entry edge.
        const last = lane.last;
        const space = !last
          ? Infinity
          : lane.dir > 0
            ? last.x - last.w / 2 + 6
            : W + 6 - (last.x + last.w / 2);
        if (space >= lane.nextGap) {
          const type = lane.pool[Math.floor(Math.random() * lane.pool.length)];
          const spec = VEHICLES[type];
          // Vehicles shrink a little when a lane is narrow, so they always sit inside their lane.
          const k = Math.min(1, (lane.laneH - 8) / spec.h);
          const w = spec.w * k;
          const h = spec.h * k;
          const x = lane.dir > 0 ? -6 - w / 2 : W + 6 + w / 2;
          const v = {
            type,
            kind: spec.kind,
            dir: lane.dir,
            x,
            y,
            w,
            h,
            phase: Math.random() * 6,
            near: false,
          };
          lane.vehicles.push(v);
          lane.last = v;
          lane.spawned += 1;
          // Delivery lanes come in bunches: a short pause after every pair.
          const bunch = lane.bursty && lane.spawned % 2 === 0 ? 2.6 : 1;
          lane.nextGap = lane.gapMin * (1 + Math.random() * 0.7) * bunch;
        }
      }
    }

    checkHits() {
      const dog = this.dog;
      for (const lane of this.lanes) {
        for (const v of lane.vehicles) {
          const dx = Math.abs(v.x - dog.x);
          const dy = Math.abs(v.y - dog.y);
          if (dx < v.w / 2 - CAR_INSET + DOG_HIT.x && dy < v.h / 2 - CAR_INSET + DOG_HIT.y) {
            this.kill();
            return;
          }
          if (!v.near && dx < v.w / 2 + NEAR_MISS + DOG_HIT.x && dy < v.h / 2 + NEAR_MISS + DOG_HIT.y) {
            v.near = true;
            this.closeCall();
          }
        }
      }
    }

    // ---------- Peanut ----------

    requestMove(dc, dr) {
      if (this.dog.state === 'dead') return;
      if (this.dog.state === 'hop') {
        this.queued = { dc, dr };
        return;
      }
      this.startHop(dc, dr);
    }

    startHop(dc, dr) {
      const dog = this.dog;
      if (dog.state !== 'idle' && dog.state !== 'spawn') return;
      const col = dog.col + dc;
      const row = dog.row + dr;
      if (row < 0) return;
      if (col < 0 || col >= COLS || row > this.level.goalRow || this.isBlocked(col, row)) {
        this.sound.blocked();
        return;
      }

      dog.dir = dc > 0 ? 'right' : dc < 0 ? 'left' : dr > 0 ? 'up' : 'down';
      dog.from = { x: dog.x, y: dog.y };
      dog.to = { col, row, x: colX(col), y: rowY(this.level.geo, row) };
      dog.state = 'hop';
      dog.t = 0;
      dog.lift = 0;
      dog.landT = null;

      if (dr > 0 && row > dog.bestRow) {
        dog.bestRow = row;
        dog.step += 1;
        this.sound.hop(dog.step - 1);
        this.addScore(10, dog.x, dog.y - 34, '#FFFFFF');
      } else if (dr < 0) {
        this.sound.backstep();
      } else {
        this.sound.sidestep();
      }

      Effects.burst(this.effects, dog.x, dog.y + 20, {
        count: 6, speed: 80, life: 0.35, size: 3, gravity: 120, lift: 40,
        colors: ['#F4E8CC', '#D8C7A2', '#E9DCC0'],
      });
    }

    land() {
      const dog = this.dog;
      const to = dog.to;
      dog.col = to.col;
      dog.row = to.row;
      dog.x = to.x;
      dog.y = to.y;
      dog.state = 'idle';
      dog.lift = 0;
      dog.landT = 0;

      if (dog.row === this.level.goalRow) {
        this.crossed();
        return;
      }
      this.collectBone();

      const next = this.queued;
      this.queued = null;
      if (next) this.startHop(next.dc, next.dr);
    }

    collectBone() {
      const dog = this.dog;
      const bone = this.bones.find((b) => !b.got && b.col === dog.col && b.row === dog.row);
      if (!bone) return;
      bone.got = true;
      const chained = this.comboTimer > 0;
      this.combo = chained ? this.combo + 1 : 1;
      this.comboTimer = COMBO_WINDOW;
      const points = 50 * Math.min(this.combo, 5);
      this.sound.bone(this.combo);
      Effects.burst(this.effects, colX(bone.col), rowY(this.level.geo, bone.row), {
        count: 14, speed: 150, life: 0.6, kind: 'spark', size: 6, gravity: 120,
        colors: ['#FFFFFF', '#FFE066', '#8EC5FF'],
      });
      this.addScore(points, colX(bone.col), rowY(this.level.geo, bone.row) - 30, '#FFE066');
      this.rumble(0, 0.25, 60);
    }

    // Peanut reached a home opening. The house is claimed for the rest of the level, and Peanut
    // steps into the doorway before the next trip starts.
    crossed() {
      const dog = this.dog;
      const idx = this.level.homeCols.indexOf(dog.col);
      this.queued = null;
      this.homes[idx] = true;
      this.level.blocked.add(dog.col + ':' + this.level.goalRow);
      this.crossings = this.homes.filter(Boolean).length;
      dog.state = 'enter';
      dog.t = 0;
      dog.homeIdx = idx;
      this.sound.crossing();
      this.rumble(0.4, 0.6, 180);
      const x = colX(dog.col);
      const y = rowY(this.level.geo, this.level.goalRow);
      Effects.burst(this.effects, x, y, {
        count: 30, speed: 260, life: 0.9, kind: 'confetti', size: 5, gravity: 320, lift: 220,
        colors: ['#FFE066', '#7CF2C4', '#FFFFFF', '#FF8FD8'],
      });
      Effects.text(this.effects, 'HOME!', x, y - 46, '#7CF2C4', 44);
      this.addScore(150, x, y - 80, '#FFE066');
    }

    finishCrossing() {
      if (this.crossings >= this.level.def.crossings) {
        this.clearLevel();
        return;
      }
      this.placeBones();
      this.resetDog();
    }

    clearLevel() {
      const stars = this.levelDeaths === 0 ? 3 : this.levelDeaths === 1 ? 2 : 1;
      const bonus = 250 * stars + 100 * (this.levelIndex + 1);
      this.stars = stars;
      this.lastBonus = bonus;
      this.combo = 0;
      this.comboTimer = 0;
      this.score += bonus; // the clear panel shows the bonus, so no floating number here
      this.grantExtraLives();
      this.sound.levelClear();
      this.rumble(0.5, 0.5, 400);
      Effects.burst(this.effects, W / 2, H * 0.45, {
        count: 52, speed: 320, life: 1.4, kind: 'confetti', size: 6, gravity: 280, lift: 240,
        colors: ['#FFE066', '#7CF2C4', '#FFFFFF', '#FF8FD8', '#8EC5FF'],
      });
      this.setMode('clear');
    }

    kill() {
      const dog = this.dog;
      dog.state = 'dead';
      dog.t = 0;
      dog.lift = 0;
      dog.landT = null;
      this.queued = null;
      this.lives -= 1;
      this.levelDeaths += 1;
      this.combo = 0;
      this.comboTimer = 0;
      this.sound.hit();
      this.shake(0.35, 12);
      this.rumble(1, 0.6, 380);
      Effects.burst(this.effects, dog.x, dog.y, {
        count: 16, speed: 220, life: 0.8, kind: 'spark', size: 7, gravity: 200,
        colors: ['#FFE066', '#FFFFFF', '#FF5D8F'],
      });
      Effects.text(this.effects, 'YIP!', dog.x, dog.y - 46, '#FF8FB0', 34);
    }

    closeCall() {
      const dog = this.dog;
      this.sound.closeCall();
      this.addScore(25, dog.x, dog.y - 36, '#FF8FD8');
      Effects.text(this.effects, 'CLOSE CALL!', dog.x, dog.y - 62, '#FF8FD8', 20);
    }

    addScore(points, x, y, color) {
      this.score += points;
      Effects.text(this.effects, `+${points}`, x, y, color, 26);
      this.grantExtraLives();
    }

    grantExtraLives() {
      while (this.score >= this.nextLifeAt) {
        this.nextLifeAt += LIFE_EVERY;
        if (this.lives < MAX_LIVES) {
          this.lives += 1;
          this.sound.extraLife();
          Effects.text(this.effects, 'EXTRA LIFE!', W / 2, 120, '#FF8FD8', 30);
        }
      }
    }

    shake(time, magnitude) {
      this.shakeT = time;
      this.shakeMag = magnitude;
    }

    rumble(strong, weak, ms) {
      const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
      for (const pad of pads) {
        if (!pad || !pad.vibrationActuator) continue;
        pad.vibrationActuator
          .playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: strong, weakMagnitude: weak })
          .catch(() => {});
      }
    }

    // ---------- frame ----------

    update(dt) {
      this.t += dt;
      this.modeT += dt;
      this.shakeT = Math.max(0, this.shakeT - dt);
      this.toastT = Math.max(0, this.toastT - dt);
      if (this.input.takeConnect()) {
        this.sound.gamepad();
        this.toastT = 2.4;
      }
      const p = this.input.poll(dt);
      Effects.update(this.effects, dt);
      if (this.buildWatch.update(dt, this.mode === 'title')) global.location.reload();

      switch (this.mode) {
        case 'title':
          if (p.confirm) this.startRun();
          break;

        case 'intro':
          while (this.cdIndex < COUNTDOWN.length && this.modeT >= COUNTDOWN[this.cdIndex].at) {
            this.sound.countdown(COUNTDOWN[this.cdIndex].final);
            this.cdIndex += 1;
          }
          this.updateTraffic(dt);
          if (this.modeT >= INTRO_TIME) this.setMode('play');
          break;

        case 'play':
          this.updatePlay(dt, p);
          break;

        case 'paused':
          if (p.pause || p.confirm) this.resume();
          break;

        case 'clear':
          this.updateTraffic(dt);
          if (this.modeT >= CLEAR_TIME) this.advanceLevel();
          break;

        case 'over':
          this.updateTraffic(dt);
          if ((p.confirm && this.modeT > 1) || this.modeT > 5) this.goTitle();
          break;

        case 'win':
          this.updateTraffic(dt);
          if ((p.confirm && this.modeT > 1.2) || this.modeT > 14) this.goTitle();
          break;

        default:
          break;
      }
    }

    updatePlay(dt, p) {
      if (p.pause) {
        this.pause();
        return;
      }
      if (p.up || p.confirm) this.requestMove(0, 1);
      else if (p.down) this.requestMove(0, -1);
      else if (p.left) this.requestMove(-1, 0);
      else if (p.right) this.requestMove(1, 0);

      const dog = this.dog;
      if (dog.state === 'hop') {
        dog.t += dt;
        const k = Math.min(1, dog.t / HOP_TIME);
        const e = k * k * (3 - 2 * k);
        dog.x = lerp(dog.from.x, dog.to.x, e);
        dog.y = lerp(dog.from.y, dog.to.y, e);
        dog.lift = Math.sin(Math.PI * k);
        if (k >= 1) {
          this.land();
          if (this.mode !== 'play') return;
        }
      } else if (dog.state === 'spawn') {
        dog.t += dt;
        if (dog.t >= SPAWN_TIME) dog.state = 'idle';
      } else if (dog.state === 'enter') {
        dog.t += dt;
        if (dog.t >= ENTER_TIME) {
          this.finishCrossing();
          return;
        }
      } else if (dog.state === 'dead') {
        dog.t += dt;
        if (dog.t >= DEATH_TIME) {
          if (this.lives <= 0) {
            this.gameOver();
            return;
          }
          this.resetDog();
        }
      }

      if (this.dog.landT !== null) {
        this.dog.landT += dt;
        if (this.dog.landT >= LAND_TIME) this.dog.landT = null;
      }

      this.updateTraffic(dt);
      if (this.dog.state !== 'dead') this.checkHits();

      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 0;
      }
    }

    draw() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (this.mode === 'loading') {
        D.Render.drawLoading(ctx, this.t);
        return;
      }
      if (this.mode === 'title') {
        D.Render.drawTitle(ctx, this);
        return;
      }
      D.Render.drawWorld(ctx, this);
      D.Render.drawOverlay(ctx, this);
    }

    frame(ts) {
      const dt = this.lastTime ? Math.min(0.05, (ts - this.lastTime) / 1000) : 0;
      this.lastTime = ts;
      this.update(dt);
      this.draw();
      requestAnimationFrame(this.frame);
    }
  }

  global.Dogger = global.Dogger || {};
  global.Dogger.Game = Game;

  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game');
    global.dogger = new Game(canvas);
  });
})(window);
