# Spring 2026 Advisor Selection

Simple application for MS CDP students to select their advisors. The advisors for this academic year are stored in the repo root.

On submission, the app downloads a local copy of a student's selections, and securely sends them to the cdp netlify account.

Served with Netlify at <https://mscdp-sp2026-advisor-selection.netlify.app/>. This repository can be easily duplicated and re-used for future years.

## Project Contents

- `index.html` – password gate, Netlify form, sortable advisor table (PapaParse + SortableJS loaded via CDN).
- `style.css` – Roboto Mono layout, animated plus-grid background, shared color variables in `:root`.
- `main.js` – splash auth (SHA-256), CSV parsing, drag-and-drop ordering, CSV download + Netlify submission wiring.
- `2026-Capstone-Advisors.csv` – advisor roster (name, capacity, experience tags).
- `netlify.toml` – publish root + security headers.

## Notes for next user:

The password hash lives in `main.js` (`PASSWORD_HASH` constant). Make sure to change it. To do that, choose a password, calculate it into a hash using a SHA256 string to hash tool, and copy that value to `PASSWORD_HASH`.

To control whether the form accepts responses, edit the `FORM_IS_OPEN` constant at the top of `main.js`:

- `const FORM_IS_OPEN = true;` – Form is open and password-protected
- `const FORM_IS_OPEN = false;` – Form is closed with message "This form is not currently taking responses."

When the form is closed, the splash screen displays the closed message instead of the password input field. The password functionality remains intact, so you can easily reopen the form by changing the toggle back to `true`.

Netlify only exports fields declared at build-time. The form exposes `1st Choice` through `25th Choice` (hidden inputs). If you ever need more advisors, add more hidden inputs in `index.html` **and** redeploy so Netlify detects the extra columns.

## Local Development

```bash
# run a quick static server
python3 -m http.server 5500
# visit http://localhost:5500 to test
```