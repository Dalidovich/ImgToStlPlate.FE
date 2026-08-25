# ImgToStlPlate — frontend

Angular 21 SPA for ImgToStlPlate. It is the client half of a two-repository project; the backend lives
in `ImgToStlPlate.BE` next to this folder.

**Start with the root `README.md` (`../README.md`)** — it covers the repository layout, the two-repo
caveat, how to run both halves together, how to package the single-file exe, and the API contract.

## Quick reference

| Task | Command |
|---|---|
| Install dependencies | `npm install` |
| Dev server on `http://localhost:4200` | `npm start` |
| Production build into `dist/ImgToStlPlate/browser` | `npm run build` |
| Unit tests (Vitest) | `npm test` |

The app calls the API through the relative path `/api/convert`, never an absolute origin — the packaging
script fails the build if an absolute `localhost` origin ends up in the bundle. In development,
`proxy.conf.json` forwards `/api` to the API on `http://localhost:5257`; in the packaged exe the SPA and
the API share one origin.
