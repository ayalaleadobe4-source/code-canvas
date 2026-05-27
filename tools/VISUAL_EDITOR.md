# Lovable Visual Editor — Setup

This project was instrumented for the Lovable Visual Editor.

- `.github/workflows/visual-editor.yml` — builds the project on every push and deploys to GitHub Pages.
- `tools/vse-babel-plugin.cjs` — tags JSX elements with source locations during build.
- `tools/vse-vite-plugin.cjs` — injects a small click-forwarder into index.html.
- `vite.config.ts` — patched to use the two plugins.

**One-time manual step:** In your repo Settings → Pages, set Source to **GitHub Actions**.
The first deploy takes ~2 minutes. Subsequent edits from the Lovable Visual Editor commit to the branch and trigger a rebuild.
