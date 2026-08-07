# alimuhammadaslam.github.io

Personal site: profile and portfolio.

**Live:** https://alimuhammadaslam.github.io

## Stack

Vite + TypeScript, GSAP (ScrollTrigger), Lenis smooth scroll, hand-written CSS,
and a WebGL fragment shader for the hero field. No UI framework, no CSS framework.

## Develop

Requires Node 20+.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check, then emit to dist/
npm run preview  # serve the production build
npm run deploy   # build and publish to the gh-pages branch
```

## Editing content

Everything lives in `index.html`. There is no CMS and no data layer. Projects are
`<li class="work">` entries; add one by copying a neighbour and updating the index
number, `data-preview` key, and `data-href`.

- `src/style.css` holds design tokens at the top (`:root`), then sections in order.
- `src/gl.ts` is the hero shader.
- `src/main.ts` is all interaction, one function per concern.
