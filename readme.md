# Spring 2026 Advisor Selection

Simple application for MS CDP students to select their advisors. The advisors for this academic year are stored in `2026-Capstone-Advisors.csv` in the repo root. Served with Netlify at <https://mscdp-sp2026-advisor-selection.netlify.app/>.

## Project Contents

- `index.html` – password gate, Netlify form, sortable advisor table (PapaParse + SortableJS loaded via CDN).
- `style.css` – Roboto Mono layout, animated plus-grid background, shared color variables in `:root`.
- `main.js` – splash auth (SHA-256), CSV parsing, drag-and-drop ordering, CSV download + Netlify submission wiring.
- `2026-Capstone-Advisors.csv` – advisor roster (name, capacity, experience tags).
- `netlify.toml` – publish root + security headers.

## Up to 25 Ranked Choices

Netlify only exports fields declared at build-time. The form exposes `1st Choice` through `25th Choice` (hidden inputs). If you ever need more advisors, add more hidden inputs in `index.html` **and** redeploy so Netlify detects the extra columns.

## Local Development

```bash
# run a quick static server
python3 -m http.server 5500
# visit http://localhost:5500 to test
```

The password hash lives in `main.js` (`PASSWORD_HASH` constant). Swap it before sharing a build.

## Deployment

1. Push changes to GitHub.
2. Netlify is configured with no build command and publish dir `.` – choose “Deploy site” in the dashboard or rely on automatic builds from the connected repo.
3. After every deploy, submit one test entry to confirm it appears under **Netlify → Forms → advisor-lottery**.
