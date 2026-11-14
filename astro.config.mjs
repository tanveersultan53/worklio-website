// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

const repo = "https://github.com/tanveersultan53/worklio";

// The landing page lives in src/pages/index.astro; Starlight serves the docs under /docs.
// Set `site` to the production URL once a domain is chosen (enables canonical URLs and a sitemap).
export default defineConfig({
  integrations: [
    starlight({
      title: "Worklio Docs",
      description: "Documentation for Worklio, the open-source team chat you host yourself.",
      logo: { src: "./src/assets/logo.svg", alt: "Worklio" },
      favicon: "/favicon.svg",
      social: [{ icon: "github", label: "GitHub", href: repo }],
      customCss: ["./src/styles/docs.css"],
      head: [
        { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" } },
        { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: true } },
        {
          tag: "script",
          attrs: { type: "module" },
          content:
            'const pres = document.querySelectorAll("pre.mermaid"); if (pres.length) { const { default: mermaid } = await import("https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs"); const dark = document.documentElement.dataset.theme === "dark"; mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "neutral", fontFamily: "Instrument Sans, system-ui, sans-serif" }); await mermaid.run({ nodes: pres }); }',
        },
        {
          tag: "link",
          attrs: {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Instrument+Sans:wght@400..700&family=JetBrains+Mono:wght@400;600&display=swap",
          },
        },
      ],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Introduction", slug: "docs" },
            { label: "Quick start", slug: "docs/quick-start" },
            { label: "Screenshots", slug: "docs/screenshots" },
          ],
        },
        {
          label: "Using Worklio",
          items: [
            { label: "Messaging", slug: "docs/features/messaging" },
            { label: "Calls and huddles", slug: "docs/features/calls" },
            { label: "Canvases, whiteboards and boards", slug: "docs/features/collaboration" },
            { label: "Worklio AI", slug: "docs/features/ai" },
            { label: "Admin and permissions", slug: "docs/features/admin" },
          ],
        },
        {
          label: "Self-hosting",
          items: [
            { label: "Deploy to production", slug: "docs/self-hosting/deployment" },
            { label: "Configuration", slug: "docs/self-hosting/configuration" },
            { label: "Security", slug: "docs/self-hosting/security" },
          ],
        },
        {
          label: "Contributing",
          items: [
            { label: "How to contribute", slug: "docs/contributing" },
            { label: "Governance and roles", slug: "docs/contributing/governance" },
            { label: "Architecture", slug: "docs/contributing/architecture" },
            { label: "Lessons learned", slug: "docs/contributing/lessons-learned" },
            { label: "Roadmap", slug: "docs/contributing/roadmap" },
          ],
        },
      ],
    }),
  ],
});
