# Deployment

## Build

```bash
npm ci
npm test
npm run check:levels
npm run build
```

`dist/` is a static site. `vite.config.ts` sets `base: './'`, so it runs from a
sub-path such as `/play/` without rewriting asset URLs.

## GitHub Pages

`.github/workflows/pages.yml` runs on every push to `main`:

1. installs dependencies;
2. runs the unit tests;
3. validates all 500 levels (the build fails on any rejected level);
4. type-checks and builds;
5. copies `dist/` to `site/play/`, adds `arcade-client.js`, writes a redirect at
   `site/index.html`;
6. publishes `site/` to Pages.

Repository settings must have **Pages → Source: GitHub Actions**.

Public URL: `https://jd4rider.github.io/brick-blitz/play/`.

## Little Joy Arcade

The game is listed in `littlejoyarcade/src/data/games.ts` and in the Supabase
`games` table, which is what the live portal renders. Publish the manifest
without a database password by using the signed-in Supabase CLI:

```bash
cd ~/Programming/littlejoyarcade
KEY=$(npx supabase projects api-keys --project-ref fqovramltegcfiyebyrt \
  | awk -F'|' '/service_role/{gsub(/[[:space:]]/,"",$2); print $2; exit}')
SUPABASE_SERVICE_ROLE_KEY="$KEY" node scripts/publish-game-rest.mjs ../brick-blitz/arcade-manifest.json
```

`arcade-manifest.json` must match the catalogue entry: same `id`, `playUrl` and
`saveKey`.

## Custom domain

Target: `https://brickblitz.littlejoyarcade.site/play/`.

The portal probes `preferredPlayUrl` and falls back to the `github.io` URL when
the subdomain is not serving, so the entry can ship before DNS exists. DNS and
the Pages custom domain are a separate, explicit step; nothing here changes DNS.

## Save format

`localStorage['brick-blitz-save-v1']` holds a versioned object documented in
`README.md`. Migration is field-by-field, so a partial or corrupt payload keeps
whatever is valid. Cloud saves are not enabled: the page loads
`public/arcade-client.js` for the shared account button, but no cloud-save
service has been approved for this title, so progress stays on the device.

## Quality presets

`low` drops the pixel ratio to 1 and halves particles; `high` (default) uses up
to 2× DPR. Shadows are off everywhere: the visual depth comes from extruded
geometry and emissive materials, which is cheaper and more predictable on
phones than shadow maps.
