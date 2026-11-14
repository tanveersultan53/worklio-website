# Worklio website

The marketing site and documentation for [Worklio](https://github.com/tanveersultan53/worklio), the open-source team chat you host yourself.

Built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build).

## Develop

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static site in dist/
npm run preview    # serve the build locally
```

## Structure

```
src/pages/index.astro        landing page
src/styles/site.css          landing page styles (brand tokens at the top)
src/styles/docs.css          Starlight theme overrides
src/content/docs/docs/       documentation pages (served under /docs)
public/screenshots/          product screenshots and the walkthrough GIF
public/logo.svg              Worklio logo
```

Sidebar order lives in `astro.config.mjs`.

## Docs content

Pages under `docs/self-hosting/` and `docs/contributing/` are adapted from the main repository
(`docs/DEPLOYMENT.md`, `docs/CONFIGURATION.md`, `SECURITY.md`, `CONTRIBUTING.md`, `GOVERNANCE.md`,
`docs/ARCHITECTURE.md`, `docs/LESSONS_LEARNED.md`, `docs/ROADMAP.md`). When those change in the app
repository, update the matching page here.

## Deploy

`npm run build` produces a static site in `dist/` that any static host can serve
(Cloudflare Pages, Netlify, Vercel or GitHub Pages). Set `site` in `astro.config.mjs` to the
production URL to enable canonical URLs and the sitemap.
