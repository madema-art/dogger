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

## Notes

- The game is designed for a 9:16 portrait window. It scales to fit any window and letterboxes the rest.
- Sound effects are generated in the browser. Background music is not included yet.
- Best score is stored in `localStorage` as a per-browser convenience.
- Only the first setting (the neighbourhood street) is included. Further backgrounds can slot in beside `drawBackdrop` and `drawStreet` in `js/render.js`.
