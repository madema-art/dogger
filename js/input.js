// Dogger input: keyboard and gamepad reduced to a few actions, with edge detection and held-direction repeat.
(function (global) {
  'use strict';

  const KEY_ACTIONS = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Enter: 'confirm', Space: 'confirm',
    KeyP: 'pause', Escape: 'pause',
  };

  // Standard gamepad mapping: A confirms and hops forward, Start pauses, D-pad moves.
  const PAD_ACTIONS = {
    0: 'confirm',
    9: 'pause',
    12: 'up',
    13: 'down',
    14: 'left',
    15: 'right',
  };

  const DIRECTIONS = ['up', 'down', 'left', 'right'];
  const ACTIONS = [...DIRECTIONS, 'confirm', 'pause'];
  const STICK = 0.5;
  const REPEAT_FIRST = 0.32;
  const REPEAT_EVERY = 0.12;

  class Input {
    constructor(onGesture) {
      this.onGesture = onGesture || (() => {});
      this.keys = new Set();
      this.wasHeld = {};
      this.repeatIn = {};
      this.pressed = {};
      this.tapped = new Set(); // key-downs latched until the next poll, so taps shorter than a frame still count
      this.padConnected = false;
      this.connectEvent = false;

      global.addEventListener('keydown', (e) => {
        const action = KEY_ACTIONS[e.code];
        if (!action) return;
        e.preventDefault();
        this.keys.add(e.code);
        if (!e.repeat) this.tapped.add(action);
        this.onGesture();
      });
      global.addEventListener('keyup', (e) => this.keys.delete(e.code));
      global.addEventListener('blur', () => this.keys.clear());
      global.addEventListener('gamepadconnected', () => {
        this.connectEvent = true;
        this.onGesture();
      });
    }

    activePad() {
      const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
      for (const pad of pads) {
        if (pad && pad.connected) return pad;
      }
      return null;
    }

    // Returns true once when a gamepad has just been plugged in.
    takeConnect() {
      const fired = this.connectEvent;
      this.connectEvent = false;
      return fired;
    }

    // Call once per frame. Returns the actions that were pressed this frame.
    poll(dt) {
      const held = {};
      for (const code of this.keys) held[KEY_ACTIONS[code]] = true;

      const pad = this.activePad();
      this.padConnected = !!pad;
      if (pad) {
        pad.buttons.forEach((button, i) => {
          const action = PAD_ACTIONS[i];
          if (action && button.pressed) held[action] = true;
        });
        const x = pad.axes[0] || 0;
        const y = pad.axes[1] || 0;
        if (x < -STICK) held.left = true;
        if (x > STICK) held.right = true;
        if (y < -STICK) held.up = true;
        if (y > STICK) held.down = true;
      }

      this.pressed = {};
      for (const action of ACTIONS) {
        const down = !!held[action];
        if (down && !this.wasHeld[action]) {
          this.pressed[action] = true;
          this.repeatIn[action] = REPEAT_FIRST;
        } else if (down && DIRECTIONS.includes(action)) {
          this.repeatIn[action] -= dt;
          if (this.repeatIn[action] <= 0) {
            this.pressed[action] = true;
            this.repeatIn[action] += REPEAT_EVERY;
          }
        }
        this.wasHeld[action] = down;
      }
      for (const action of this.tapped) this.pressed[action] = true;
      this.tapped.clear();
      return this.pressed;
    }
  }

  global.Dogger = global.Dogger || {};
  global.Dogger.Input = Input;
})(window);
