# Road to Toronto Standalone Travel Page

This folder is a self-contained export of the Headies Travel page.

Open `index.html` directly in a browser, or run a small local server from this folder:

```bash
python3 -m http.server 8756
```

Then visit `http://127.0.0.1:8756/`.

Included:
- `index.html`
- Local CSS and JavaScript
- Local logo, generated hero/private jet/private car images
- Local copies of the travel section images
- Local Lucide icon script

Notes:
- The lead forms store submissions in browser `localStorage`.
- The CSS still includes the Google Fonts import. If offline, the page falls back to system fonts.
