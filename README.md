# YOOJ

A scroll-driven single-page site for a fictional cognitive wellbeing lab.

## Running it

```
npm install
npm run dev      # http://localhost:3030
npm run build    # type-check, then bundle to dist/
npm run preview  # serve the bundle
```

## Layout

```
src/
  main.ts                 entry; scroll restoration is taken manual here
  App.vue                 section order, chapter tracking, the WebGL field
  components/
    chrome/               furniture that is present on every section —
                          header, gate, cursor, scroll hint, sound
    ui/                   reusable primitives — button, split heading
    sections/             one file per section, in page order
  composables/
    useMotion.ts          the motion vocabulary; every entrance goes through it
    useSmoothScroll.ts    Lenis on the document, plus the gate's scroll lock
    useSplitText.ts       line/word/character splitting with clipping masks
    usePointer.ts         normalised pointer, used by the cursor and the field
    useReveal.ts          the v-reveal directive
  lib/
    seed.ts               the eight-around-one figure, shared by the gate and
                          the second section so the two cannot drift apart
  styles/
    _tokens.scss          colour, type ladder, easing, rhythm — one source
    _reset.scss           reset plus the custom-cursor opt-out
    main.scss             global classes
  webgl/
    Backdrop.ts           the full-bleed field behind every section
    shaders/              its vertex and fragment source

public/                   only what the site actually loads
archive/                  retired sections and assets, kept out of the build
```

## How the page moves

Scrolling is the document's own, smoothed by Lenis — not a transform stage and
not a scrolling container. That is deliberate: Vue mounts children before their
parents, so a section registering a ScrollTrigger against a custom scroller
measures a scroller that does not exist yet. Scrolling what the browser already
scrolls removes the ordering problem rather than working around it.

Sections that hold a frame while the reader travels use a tall section with a
`position: sticky` stage inside it, never a pinned ScrollTrigger. A pinned
element becomes `fixed`, reports an offset of zero, and re-measures its own
start as the top of the document on any refresh that lands while the pin is
applied — which strands it over the section above.

## Conventions

- Colour, type and easing come from `_tokens.scss`. A component that restates a
  token is a component that will drift when the token changes.
- Every section is responsible for its own ground and its own timeline.
- Anything scroll-driven reads one normalised progress value and derives
  everything else from it, so the whole section can be reasoned about at once.
