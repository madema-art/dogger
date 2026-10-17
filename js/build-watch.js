// Dogger build watch. The page remembers the build (commit) it was loaded from. While the start
// screen is showing, it checks version.json from the local server. When that commit changes, a
// newer build has been pulled, so the page reloads into it. Checks never run during play, and a
// reload never happens mid-game: it waits until the player is back on the start screen.
(function (global) {
  'use strict';

  const URL = 'version.json';
  const CHECK_EVERY = 20;   // seconds between checks while on the start screen
  const REFRESH_DELAY = 1.5; // seconds to show the notice before reloading

  class BuildWatch {
    constructor() {
      this.baseline = null;      // commit this page was loaded from
      this.pending = null;       // newer commit seen, waiting for a safe moment
      this.timer = CHECK_EVERY;  // check straight away when the start screen appears
      this.refreshIn = 0;
      this.busy = false;
    }

    // Call once per frame. Returns true when the page should reload now.
    update(dt, onStartScreen) {
      if (!onStartScreen) {
        this.timer = CHECK_EVERY;
        this.refreshIn = 0;
        return false;
      }
      this.timer += dt;
      if (this.timer >= CHECK_EVERY && !this.busy) {
        this.timer = 0;
        this.check();
      }
      if (!this.pending) return false;
      this.refreshIn += dt;
      return this.refreshIn >= REFRESH_DELAY;
    }

    // Text for the start screen while an update is waiting. Empty otherwise.
    label() {
      return this.pending ? 'Newer Dogger build found. Refreshing...' : '';
    }

    async check() {
      this.busy = true;
      try {
        const response = await fetch(`${URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const info = await response.json();
        if (!info || typeof info.commit !== 'string') return;
        if (this.baseline === null) {
          this.baseline = info.commit;
        } else {
          this.pending = info.commit === this.baseline ? null : info.commit;
        }
      } catch (err) {
        // Offline, or opened straight from disk (file://): there is nothing to compare against.
      } finally {
        this.busy = false;
      }
    }
  }

  global.Dogger = global.Dogger || {};
  global.Dogger.BuildWatch = BuildWatch;
})(window);
