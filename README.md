# The Reflective — World Cup 2026

A documentary-grade **schedule and knockout predictor** for the 2026 FIFA World Cup,
with every kick-off shown in **UAE time (Gulf Standard Time, UTC+4)**.

Built as a **PWA** (installable, works offline). No build step, no dependencies —
just static files. Palette: midnight blue · bone white · signal red.

## What it does

- **Schedule** — all 104 matches day by day in UAE time. Group fixtures are final;
  knockout dates/venues are shown with kick-off clock times marked *TBC* (FIFA confirms
  these closer to each round). Kick-offs are stored in US Eastern and converted to
  `Asia/Dubai` at render time, so the clock is always right regardless of device timezone.
- **Groups** — drag teams (or use the arrows) to set your predicted finishing order in
  each of the 12 groups. Top two advance; third place enters the best-thirds race.
- **Predictor** — pick your eight best third-placed teams, then tap winners through
  the Round of 32 → Round of 16 → Quarters → Semis → Final. Results flow automatically
  into the schedule and crown your champion. Everything is saved on the device.

## Run locally

Any static server works, e.g.:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open the printed URL. (A service worker needs `http(s)`, not `file://`.)

## Deploy: GitHub → Vercel

1. **Create the repo and push:**
   ```bash
   git init
   git add .
   git commit -m "The Reflective — World Cup 2026 schedule & predictor"
   git branch -M main
   git remote add origin https://github.com/<you>/reflective-wc26.git
   git push -u origin main
   ```
2. **Import to Vercel:** go to vercel.com → **Add New… → Project** → import the repo.
   - Framework preset: **Other**
   - Build command: *(leave empty)*
   - Output directory: *(leave empty — root)*
3. **Deploy.** Vercel serves the static files and the included `vercel.json` sets the
   correct PWA headers. Every push to `main` redeploys automatically.

### Or deploy from the CLI
```bash
npm i -g vercel
vercel        # preview
vercel --prod # production
```

## File map

```
index.html              app shell, masthead, hero, tabs
styles.css              cinematic navy/white/red theme
data.js                 all groups + 72 group fixtures + knockout bracket
app.js                  time conversion, schedule, standings, predictor, PWA
manifest.webmanifest    PWA manifest
sw.js                   offline service worker
vercel.json             static + PWA headers
icons/                  app icons (svg + png 192/512/maskable)
```

## Updating the data

Edit `data.js`. Group kick-offs use `et: [year, month, day, hour, minute]` in US
Eastern time; the app adds the offset to display UAE time. To set a confirmed knockout
kick-off, you can extend `KNOCKOUT` entries the same way.
