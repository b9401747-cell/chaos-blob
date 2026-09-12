# 🫠 Chaos Blob

A completely useless, mildly addictive blob you poke, drag, and fling around the screen. Built with nothing but HTML, CSS, and vanilla JavaScript — no frameworks, no build step, no dependencies.

**[Live Demo](https://b9401747-cell.github.io/chaos-blob/)**

## What it does

- **Poke the blob** — each poke scores points, plays a synthesized pop sound, spawns a particle burst, and shows a floating `+N`.
- **Combo system** — poke fast enough (within ~1.4s) to keep your combo climbing; the shrinking bar under the HUD shows how much time is left before it resets. Higher combos mean more points per poke, a shifting color hue, and increasingly unhinged facial expressions.
- **Drag & fling** — grab the blob and throw it. It obeys gravity, bounces off the floor and walls, and squishes on impact.
- **Score + best score** — your best run is saved to `localStorage` and survives a refresh, along with a lifetime "total pokes" counter.
- **Dark / light mode** — toggle in the top right, remembered across visits.
- **Mute toggle** — all sound is generated live with the Web Audio API (no audio files).
- **Random toasts** — milestone callouts and sarcastic one-liners pop up as you play.
- **Easter egg** — enter the Konami code (`↑ ↑ ↓ ↓ ← → ← → b a`) for a secret rainbow bonus round.

## Run it locally

No build tools needed — it's static files.

```bash
# just open it
open index.html      # macOS
start index.html      # Windows
xdg-open index.html   # Linux
```

Or serve it with any static server, e.g. `npx serve .`

## Files

- `index.html` — markup
- `style.css` — theming, layout, animations
- `script.js` — game state, physics, particles, audio, easter egg

## Deploy to GitHub Pages

Already deployed for this repo — pushing to `main` is enough; GitHub Pages serves straight from the branch root.

---

Made as a "build something useless and fun" challenge submission.
