# Dogger

A stylised, top-down Frogger-style game starring **Peanut**, a small white terrier with light brown spots.
Help Peanut cross a busy street, ten levels of rising difficulty, without getting splattered.

## Play

No build step and no dependencies. Open `index.html` in a modern browser, or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

Press **Start Game**. The first level begins straight away and the levels run in order to 10.

### Controls

| Action            | Keyboard                    | Gamepad (standard layout)        |
| ----------------- | --------------------------- | -------------------------------- |
| Hop forward       | Up / W, Space, Enter        | D-pad up, left stick up, **A**   |
| Hop back          | Down / S                    | D-pad down, left stick down      |
| Hop sideways      | Left / A, Right / D         | D-pad or left stick left / right |
| Start game        | Enter, Space                | **A**                            |
| Pause / resume    | P, Esc                      | **Start**                        |

Holding a direction repeats the hop. A hop pressed mid-air is queued and played as soon as Peanut lands.

## Rewards

- **+10** for each new row reached. Forward hops climb a pentatonic scale, so a long run sounds like a melody.
- **Bones** (+50 each). Pick them up in quick succession for a **Bone Combo** that multiplies up to x5.
- **Close call** (+25) when a vehicle passes within a whisker.
- **Crossing** (+150) on each trip to the far curb. Bones refill after every crossing.
- **Level clear** bonus, with 1 to 3 stars based on how many times Peanut was hit.
- **Extra life** every 2,000 points, up to five lives.

Lives are shown as paw prints. Each hit costs a life, and the level's progress is kept.

## Levels

| #  | Name               | Street                         | Traffic and hazards                          | Crossings |
| -- | ------------------ | ------------------------------ | -------------------------------------------- | --------- |
| 1  | Quiet Street       | 2 lanes                        | Hatchbacks and delivery vans, slow           | 3 |
| 2  | Morning Rush       | 3 lanes                        | Faster, denser                               | 3 |
| 3  | School Run         | 3 lanes                        | Buses join                                   | 4 |
| 4  | Scooter Alley      | 4 lanes                        | E-scooters weave between lanes               | 4 |
| 5  | Median Mayhem      | 4 lanes and a median           | Sports cars, traffic cones on the median     | 4 |
| 6  | Delivery Day       | 5 lanes and a median           | Delivery bots                                | 5 |
| 7  | Bus Lane Blitz     | 5 lanes and a median           | More cones, all vehicle types                | 5 |
| 8  | Rush Hour          | 6 lanes and a median           | Fast and dense                               | 6 |
| 9  | Electric Avenue    | 8 lanes and a median           | Much faster traffic                          | 6 |
| 10 | Peanut's Big Walk  | 8 lanes and two medians        | Maximum speed and density                    | 8 |

Level definitions live in [`js/levels.js`](js/levels.js). Change `speed`, `gap`, `pool`, `cones`, `bones` or `crossings` there to retune the game.

## Project layout

```
index.html          page and canvas
js/audio.js         synthesised sound effects (WebAudio, no sound files)
js/levels.js        level table, grid geometry, layout builder
js/render.js        street, backdrop, vehicles, Peanut, HUD, title and overlays
js/input.js         keyboard and gamepad input with edge detection and repeat
js/game.js          game loop, screens, traffic, collisions, rewards, progression
assets/peanut.png   Peanut's transparent sprite, cut from the photo
tools/make_peanut_sprite.py   regenerates the sprite from the original photo
```

The sprite comes from the photo's flat blue backdrop, so it is keyed out by colour and despilled at the edges. Rerun the tool with your own photo to swap Peanut out.

## Play the latest build on Windows

Double-click **`Start-Dogger.bat`** in the Dogger folder. It:

1. checks GitHub for the newest commit on `origin/claude/epic-einstein-mgwon8`,
2. updates your copy if that is safe,
3. starts the local server (or reuses the one already running) and checks that it answers,
4. opens Dogger in Chrome (or your default browser if Chrome is not installed).

No terminal commands are needed. The launcher window closes on its own when all is well, and waits for Enter if it has a warning.

Other options (run from a command prompt, or make a shortcut with the options in its target):

- `Start-Dogger.bat -Stop` stops the local server.
- `Start-Dogger.bat -CreateDesktopShortcut` puts a **Dogger** shortcut on your desktop.
- `Start-Dogger.bat -NoUpdate` runs your local copy without checking GitHub.

You can also copy `Start-Dogger.bat` to the desktop. The copy remembers where the repository is, from the last time you ran it from the Dogger folder.

Requirements: Git for Windows (Git must be on PATH). Windows PowerShell and Chrome come with Windows, but Chrome is optional.

### What happens on launch

| Situation | What the launcher does |
| --- | --- |
| Up to date | Runs the local copy. |
| Behind GitHub, no conflicts with your files | Fast-forwards to the newest commit (never resets, never deletes), then runs it. |
| Behind GitHub, but you have uncommitted edits to a file the update changes | Skips the update, leaves everything as it is, shows the file names, and runs your local copy. Commit, stash, or move those files and launch again. |
| Uncommitted edits to other files, or untracked files | The update goes ahead. Your files are kept. |
| Local commits that GitHub does not have | Runs your local version. Nothing is pushed or changed. |
| Local and GitHub both have new commits (diverged) | Stops with an explanation and changes nothing. |
| Copy is on a different branch | Switches to the Dogger branch only when there are no local changes. Otherwise it leaves the copy alone. |
| GitHub cannot be reached | Shows a warning and runs the local copy. |

Nothing is ever deleted or reset by the launcher. Git itself also refuses any update that would overwrite a file you have changed.

### The server

- Serves the repository folder at `http://localhost:8765/` (falls back to 8766-8774 if the port is taken by another program).
- Runs hidden in the background, so Dogger keeps working after the launcher window closes.
- Checks GitHub about every two minutes and applies safe updates on its own, so a Claude session pushing to the branch reaches your copy without a relaunch.
- `version.json` at the top of the site says which commit is served. The file is git-ignored.
- Logs: `%LOCALAPPDATA%\Dogger\launcher.log` and `serve.log`.

### Start-screen update check

While the title screen is showing, Dogger checks `version.json` about every 20 seconds. The page remembers the commit it loaded. When the local server reports a newer commit, the title screen shows a short "Newer Dogger build found" note and refreshes into the new build after a moment. The check never runs during play, and a refresh never interrupts a game. If a newer build arrives mid-game, the refresh waits until you return to the title screen.

The check is in `js/build-watch.js`. It only reads the local `version.json`. It does not call GitHub.

## Notes

- The game is designed for a 9:16 portrait window. It scales to fit any window and letterboxes the rest.
- Sound effects are generated in the browser. Background music is not included yet.
- Best score is stored in `localStorage` as a per-browser convenience.
- Only the first setting (the neighbourhood street) is included. Further backgrounds can slot in beside `drawBackdrop` and `drawStreet` in `js/render.js`.
