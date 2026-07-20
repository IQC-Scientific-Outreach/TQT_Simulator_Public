# Web Simulator (no install)

A fully in-browser version of the TQT photonic quantum simulator. It runs the
**same Python physics engine** as the desktop app via
[Pyodide](https://pyodide.org) (CPython + NumPy compiled to WebAssembly), so
there is nothing to install — users just open a URL.

```
web/
├── index.html        UI markup
├── styles.css        UI styling
├── app.js            UI logic + Pyodide bootstrap
├── .nojekyll         tells GitHub Pages to serve files as-is
└── py/
    ├── sim_bridge.py            browser replacement for experiment_public.py
    ├── timetagger_uqd_sim.py    copied from tqt/simulator/ (do not edit here)
    ├── laser_toptica_sim.py     copied from tqt/simulator/ (do not edit here)
    └── powermeter_thorlabs_sim.py
```

The three `*_sim.py` files in `py/` are **copies**. Edit the originals in
`tqt/simulator/` — `publish.sh` refreshes the copies automatically.

## Run locally

Any static file server works (the browser must fetch `py/*.py`, so opening
`index.html` from `file://` will not work):

```bash
cd web
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy on GitHub Pages

In the **public** repo (`TQT_Simulator_Public`):

1. Settings → Pages → Build and deployment → Source: **Deploy from a branch**.
2. Branch: `main`, folder: **`/ (root)`** (so `/web/` and `/tqt/` are both
   served). Save.
3. The simulator is then at `https://<user>.github.io/<repo>/web/`.

> Serving from root (not `/web`) keeps the layout simple and lets the `.nojekyll`
> at the repo root (or `web/.nojekyll`) disable Jekyll so the `.py` files are
> served verbatim. If you prefer the site at the repo root URL, move the
> contents of `web/` up one level.

## Deploy on Vercel

The app is fully static (Pyodide fetches `py/*.py` at runtime), so no build step
is needed. Two options:

**A. Vercel CLI — deploys just this folder, no GitHub needed:**

```bash
npm i -g vercel
cd web
vercel          # first run: log in + create project (accept defaults)
vercel --prod   # promote to production -> https://<project>.vercel.app
```

**B. Vercel dashboard — connect the GitHub repo:**

1. Import the public repo at [vercel.com/new](https://vercel.com/new).
2. **Framework Preset:** Other. **Root Directory:** `web`.
3. Leave the Build Command empty (no build) and deploy.

Notes: Pyodide 0.26 needs no special cross-origin headers. The `.nojekyll` file
is only for GitHub Pages and is harmless on Vercel.

## How it maps to the desktop app

| Desktop (PyQt) | Web |
|---|---|
| `interface_public.py` (PyQt5/pyqtgraph) | `index.html` + `app.js` + Plotly |
| `experiment_public.py` (yaml/importlib/disk) | `py/sim_bridge.py` (in-memory) |
| `tqt/simulator/*_sim.py` | same files, run in Pyodide (unchanged) |
| `tqt/analysis/histogram.py` (+ file IO) | `histogram()` in `sim_bridge.py` (in-memory) |

The physics — density matrices, waveplate operators, Poisson/multinomial
sampling, accidentals, the Sagnac/mystery sources — is byte-for-byte the same
code as the desktop simulator.
