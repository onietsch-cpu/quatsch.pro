# quatsch.pro review — 2026-09-14

Source baseline: `75df8ea97843f3c297beeefe69f4bb682181f00a` on `onietsch-cpu/quatsch.pro/main`.

## Changes

- Replace Autodoc with the requested Awin World Businesses for Sale destination and image. Keep sponsored/noopener/noreferrer, lazy image loading and reserved image space. No advertiser JavaScript is added.
- Single and conversation modes now use the same MediaRecorder controller. No silence or duration timer submits audio. Pause/resume preserves captured data; stop releases microphone tracks without uploading; Start translation explicitly submits. Browser/OS interruption retains collected audio for manual submission. Permission races, duplicate submit and stale responses are guarded; unmount cancels capture.
- MediaRecorder format negotiation covers WebM/Opus, MP4 and Ogg/Opus; unsupported browsers retain typed input. Real device recording cannot be guaranteed against OS suspension or revoked permissions. The existing API payload limit is respected with an 8 MiB audio safety limit and an explicit error for oversized recordings.
- Add prominent photo entry on the start screen, opening language selection then the photo panel. Load the photo module on demand.
- Enforce CSP: same-origin scripts and connections, no embedded objects or framing, narrowly allow Awin images and local media/blob previews. Inline styles remain necessary for React UI components; inline scripts are not allowed.
- Reject foreign and malformed request origins even when a custom header is present; remove localhost-prefix bypass. Header-verified non-browser clients remain supported. These checks and rate limits do not constitute authentication for the public API.
- Bound reflected request IDs and exclude URL query strings from access logs.
- Remove render-blocking Google Fonts request and use system fonts. Avoid loading the animation library on the start screen. Cache content-hashed assets for a year; HTML and recovery service worker remain revalidated.
- Update vulnerable transitive/server packages, including esbuild via an override, keeping existing major-version ranges elsewhere.

## Verification

- Clean lockfile install, lint, 60 tests and production Vite build passed.
- npm official bulk advisory endpoint returned `{}` for all lockfile package versions after updates. This is a point-in-time known-advisory check, not proof of absence of all vulnerabilities. Direct npm transport timed out locally; registry requests used curl and package tarballs were verified against lockfile integrity hashes.
- Chromium: real MediaRecorder fed by a synthetic Web Audio stream, with mocked transcription/translation provider responses. Both single and conversation flows produced exactly one transcribe and one translate request per explicit submission; pause/stop produced none. No application browser errors observed.
- Mobile viewport 390 × 844: photo controls visible, no horizontal overflow. Home and photo screenshots inspected.
- Server tests cover CSP, bounded request IDs, source validation, protected API request origins, invalid payloads and unavailable provider responses.
- Largest entry JS: 191.46 kB (63.78 kB gzip estimate); photo chunk about 8.17 kB loaded on demand. Gzip figures are build estimates, not measured production transfer sizes or a real-user speed score.

## Release and limitations

At authoring this is branch work, unpublished until PR merge and Railway deployment are verified. Production target was read back: Railway `awake-dedication`, service `quatsch.pro`, environment `production`, source `onietsch-cpu/quatsch.pro/main`, check suites enabled. No Supabase integration was changed.

Real microphone tests on Safari/Firefox/mobile devices and provider-backed OCR/transcription on the new release remain separate from the synthetic UI tests. Public API abuse/cost controls remain based on existing rate limits; no authentication scheme was added. Roll back via a PR reverting the release commit, then verify Railway and public health/routes.
