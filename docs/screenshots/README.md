# Screenshots

These images are referenced by the root `README.md`. Drop PNGs here with these
exact names (≈1440×900, retina/2× looks best):

| File | What to capture |
|---|---|
| `home.png` | The home page - hero billboard + a couple of rails |
| `detail.png` | A title's detail modal (backdrop, cast, "More Like This") |
| `settings.png` | The Settings screen |
| `mobile.png` | _(optional)_ the home page at a phone width (~390px) |

## Generate them automatically

The static demo is deterministic, so it's the easiest source:

```bash
npm run build:demo                       # produces ./out
npm i -D playwright && npx playwright install chromium
npm run screenshots                      # writes home/detail/settings.png here
```
