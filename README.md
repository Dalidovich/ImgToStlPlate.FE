# ImgToStlPlate — frontend

Angular 21 single-page app that walks a bitmap image through to a printable STL relief plate: crop and
orient the source, tune the black-and-white conversion, then preview and download the extruded model.

All image processing and mesh generation happen on the server. This is the client half of a
two-repository project; the API lives in
[ImgToStlPlate](https://github.com/Dalidovich/ImgToStlPlate), cloned as the sibling folder
`ImgToStlPlate.BE`.

## Tech stack

| | |
|---|---|
| Framework | Angular 21, standalone components, SCSS |
| 3D preview | three.js (`STLLoader`, `OrbitControls`) |
| HTTP | `HttpClient`, blobs in and out |
| Tests | Vitest via `@angular/build:unit-test` |
| Package manager | npm, pinned to `npm@11.6.0` through `packageManager` |

## The three steps

Routes are `/step1`, `/step2`, `/step3`; `/` redirects to `step1`. Everything the steps share lives in
`StateService` — the source file, the crop, the dimensions, and the blobs returned by each call, along
with the object-URL bookkeeping that revokes them.

1. **`step1-crop`** — load an image by file picker or drag-and-drop, then work on a canvas: pan and zoom,
   drag a crop rectangle, rotate freely. Confirming stores the crop and a default plate size derived from
   it, and moves on. No network call happens here.
2. **`step2-bw`** — the working step, and the only one that talks to the API. On entry it posts the
   source, the crop and the rotation to `POST /api/convert/to-bw` and previews the black-and-white
   result; toggling orientation, `fillSpace` or `invert` re-runs that call. A denoise slider is
   debounced by 300 ms and sends each value to `POST /api/convert/denoise` against the *original*
   black-and-white blob, so the effect is never stacked on itself; intensity `0` restores the original
   with no round trip, and superseded requests are switched away from, which the API answers with `499`.
   Width, height and thickness in millimetres are entered here too; continuing posts everything to
   `POST /api/convert/to-stl`.
3. **`step3-stl`** — renders the returned mesh in a three.js viewer with orbit controls, a vertex-color
   invert toggle and a view-rotation reset. The blob is downloaded locally as `model.stl`; saving makes
   no second request. Entering the step without state redirects back.

## Repository layout

```
ImgToStlPlate.FE/
├─ src/app/
│  ├─ components/step1-crop/          canvas load, pan/zoom, crop rectangle, rotation
│  ├─ components/step2-bw/            B&W conversion, denoise, plate size, STL request
│  ├─ components/step3-stl/           three.js viewer and STL download
│  ├─ services/convert.service.ts     the only place that talks to /api/convert
│  ├─ services/state.service.ts       cross-step state and object-URL lifetime
│  ├─ services/model-dimensions.ts    default plate size, limits, validation messages
│  ├─ services/problem-details.ts     unwraps application/problem+json into a message
│  └─ app.routes.ts
├─ proxy.conf.json                    dev-only /api → http://localhost:5257
└─ angular.json                       build, serve and Vitest targets
```

## Prerequisites

- Node.js with npm

## Running in development

```bash
npm install
npm start
```

The dev server runs on `http://localhost:4200`. The app calls the API through the **relative** path
`/api/convert`, never an absolute origin; `proxy.conf.json` forwards `/api` to the API on
`http://localhost:5257`, which is the `http` profile of `ImgToStlPlate.API`. Start the backend
separately (`dotnet run --project ImgToStlPlate.API` in `ImgToStlPlate.BE`) — with no API running, every
request fails with `status 0` and the UI shows "Cannot reach the server."

| Task | Command |
|---|---|
| Dev server | `npm start` |
| Production build into `dist/ImgToStlPlate/browser` | `npm run build` |
| Rebuild on change (development configuration) | `npm run watch` |
| Unit tests | `npm test` |

## Relative API paths are a build requirement

The packaging script in the backend repository copies this bundle into the API's `wwwroot` and then
**fails the build** if any `.js`/`.mjs`/`.css`/`.html` file still contains an absolute
`http://localhost:` or `http://127.0.0.1:` origin. In the packaged executable the SPA and the API share
one origin (port 5108), so an absolute origin would break the shipped app. Keep every call going through
`ConvertService`, which hard-codes the relative `/api/convert` base.

## Sizes and validation

`model-dimensions.ts` mirrors the server's limits — 1–500 mm per side, 0.1–50 mm thickness — and produces
the messages shown next to the inputs, so obvious mistakes never reach the network. The default plate
size is derived from the crop: pixels are scaled at 0.1 mm each, then the scale is adjusted so the
smaller side clears the 1 mm minimum and the larger side stays under 500 mm, preserving the aspect ratio.
Switching orientation swaps width and height.

Server-side failures arrive as `application/problem+json`. `problemDetail()` unwraps the `detail` field
out of a blob, a string or a parsed object and falls back to a caller-supplied message, so the user sees
the server's own explanation of what was wrong instead of a status code.

## The two-repo caveat

`ImgToStlPlate.FE` (this repository, branch `main`) and `ImgToStlPlate` (branch `master`) are independent
git repositories; the folder containing both is not a repository. No single commit can change the API
contract and its client atomically, and there is no cross-project history.

**Convention:** a change spanning both projects is committed to both repositories with the **same commit
subject**, so the pair can be found with `git log --oneline --grep="<subject>"` in each. Consolidating
into one repository remains the preferred long-term fix.
