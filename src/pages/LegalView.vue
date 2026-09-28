<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import BrandMark from "../components/ui/BrandMark.vue";
import { pageScrollTo, useSmoothScroll } from "../composables/useSmoothScroll";
import { LEGAL_DOCS, LEGAL_ORDER, type LegalKey } from "../lib/legal";

/**
 * /legal/privacy, /legal/terms, /legal/cookies: the fine print behind the
 * footer's "Legal".
 *
 * One page for the three, because they are one kind of thing and a reader who
 * came for one often wants the next: the other two sit beside the one being
 * read, over an index of the one being read. It is lit like the solutions page
 * and the menu - the pale ground - and scrolls on the site's own engine, so it
 * moves under the hand exactly as the pages it was opened from.
 *
 * The documents are YOOJ's, word for word (lib/legal).
 */

const route = useRoute();
const router = useRouter();
const { mount, toTop } = useSmoothScroll();

const key = computed<LegalKey>(() => {
  const doc = route.params.doc as string;
  return (LEGAL_ORDER as string[]).includes(doc) ? (doc as LegalKey) : "privacy";
});

const doc = computed(() => LEGAL_DOCS[key.value]);

/** The document after this one, round to the first. */
const next = computed(() => {
  const i = LEGAL_ORDER.indexOf(key.value);
  return LEGAL_DOCS[LEGAL_ORDER[(i + 1) % LEGAL_ORDER.length]];
});

const year = new Date().getFullYear();
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Back to where the reader was: the footer they opened this from.
 *
 * Taken once, as the page is entered - stepping between the three documents
 * must not make "back" mean the previous document. A reader who arrived from
 * outside the site goes to the front page's top.
 */
const came = String(router.options.history.state.back ?? "").split(/[?#]/)[0];
const back = came === "/" || came === "/solutions" ? { path: came, hash: "#contact" } : { path: "/" };

/* ------------------------------------------------------------ the index */

/** The section being read, lit in the index. */
const current = ref("");
let spy: IntersectionObserver | null = null;
const article = ref<HTMLElement | null>(null);

const watchSections = () => {
  spy?.disconnect();
  const seen = new Map<string, boolean>();
  spy = new IntersectionObserver(
    (entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting);
      // The first section down the page that is inside the reading band.
      const first = doc.value.sections.find((s) => seen.get(s.id));
      if (first) current.value = first.id;
    },
    // A band a little above the middle of the screen: a section is "being
    // read" once its heading has come up past the lower half.
    { rootMargin: "-18% 0px -58% 0px" },
  );
  article.value?.querySelectorAll<HTMLElement>(".lg__sec").forEach((el) => spy?.observe(el));
  current.value = doc.value.sections[0]?.id ?? "";
};

/** To a section, on the page's own glide, with room above its heading. */
const jump = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  current.value = id;
  pageScrollTo(el.getBoundingClientRect().top + window.scrollY - 28, 1.2);
};

/**
 * A mention of another policy inside the text is a link to it, and it goes
 * there through the router - the documents are authored HTML, so their links
 * are caught here rather than bound one by one.
 */
const follow = (e: MouseEvent) => {
  const a = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[data-legal]");
  if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  void router.push(`/legal/${a.dataset.legal}`);
};

/* ---------------------------------------------------------------- the tab */

// The tab says which document, as the deck's does.
let titleWas = "";
const name = () => { document.title = `${doc.value.title} — YOOJ`; };

onMounted(() => {
  titleWas = document.title;
  name();
  mount();
  watchSections();
});

watch(key, async () => {
  name();
  // A new document starts at its top, and its index is watched afresh.
  toTop();
  await nextTick();
  watchSections();
});

onBeforeUnmount(() => {
  document.title = titleWas;
  spy?.disconnect();
});
</script>

<template>
  <div class="lg">
    <div class="lg__ground ground-drift" aria-hidden="true" />

    <header class="lg__head">
      <RouterLink class="lg__back" :to="back" data-cursor="scale">
        <span aria-hidden="true">&larr;</span>
        Back to site
      </RouterLink>

      <RouterLink class="lg__mark" to="/" data-cursor="scale" aria-label="YOOJ, home">
        <BrandMark class="lg__glyph" />
        <span>YOOJ</span>
      </RouterLink>
    </header>

    <main class="lg__main">
      <aside class="lg__side">
        <nav class="lg__docs" aria-label="Legal documents">
          <p class="lg__eyebrow">Legal</p>
          <ul>
            <li v-for="k in LEGAL_ORDER" :key="k">
              <RouterLink
                :to="`/legal/${k}`"
                class="lg__doc"
                :class="{ 'is-here': k === key }"
                :aria-current="k === key ? 'page' : undefined"
                data-cursor="scale"
              >{{ LEGAL_DOCS[k].title }}</RouterLink>
            </li>
          </ul>
        </nav>

        <!-- The one being read, section by section; the section in view is lit. -->
        <nav :key="key" class="lg__toc" aria-label="On this page">
          <p class="lg__toc-h">On this page</p>
          <ol>
            <li v-for="(s, i) in doc.sections" :key="s.id">
              <a
                :href="`#${s.id}`"
                :class="{ 'is-here': s.id === current }"
                :aria-current="s.id === current ? 'location' : undefined"
                data-cursor="scale"
                @click.prevent="jump(s.id)"
              >
                <span class="lg__toc-n">{{ pad(i + 1) }}</span>
                <span>{{ s.title }}</span>
              </a>
            </li>
          </ol>
        </nav>
      </aside>

      <!-- Keyed, so a change of document plays its entrance again rather
           than swapping the words under a reader mid-sentence. -->
      <article :key="key" ref="article" class="lg__body" @click="follow">
        <header class="lg__intro">
          <h1 class="lg__title">{{ doc.title }}</h1>
          <dl class="lg__meta">
            <div>
              <dt>Last updated</dt>
              <dd>{{ doc.updated }}</dd>
            </div>
            <div>
              <dt>Applies to</dt>
              <dd>{{ doc.applies }}</dd>
            </div>
          </dl>
        </header>

        <section
          v-for="(s, i) in doc.sections"
          :id="s.id"
          :key="s.id"
          v-reveal
          class="lg__sec reveal"
          :aria-labelledby="`${s.id}-h`"
        >
          <h2 :id="`${s.id}-h`" class="lg__h">
            <span class="lg__n" aria-hidden="true">{{ pad(i + 1) }}</span>
            <span>{{ s.title }}</span>
          </h2>

          <template v-for="(b, j) in s.blocks" :key="j">
            <p v-if="b.kind === 'p'" class="lg__p" v-html="b.html" />

            <ul v-else-if="b.kind === 'list'" class="lg__list">
              <li v-for="(item, k) in b.items" :key="k" v-html="item" />
            </ul>

            <div v-else-if="b.kind === 'table'" class="lg__table">
              <table>
                <thead>
                  <tr>
                    <th v-for="h in b.head" :key="h" scope="col">{{ h }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, r) in b.rows" :key="r">
                    <td v-for="(cell, c) in row" :key="c" :data-label="b.head[c]" v-html="cell" />
                  </tr>
                </tbody>
              </table>
            </div>

            <aside v-else-if="b.kind === 'callout'" class="lg__callout" role="note">
              <span class="lg__callout-mark" aria-hidden="true" />
              <div>
                <p v-for="(line, k) in b.lines" :key="k" v-html="line" />
              </div>
            </aside>

            <dl v-else-if="b.kind === 'card'" class="lg__card">
              <div v-for="([label, html], k) in b.rows" :key="k">
                <dt>{{ label }}</dt>
                <dd v-html="html" />
              </div>
            </dl>
          </template>
        </section>

        <p v-if="doc.closing" v-reveal class="lg__closing reveal" v-html="doc.closing" />

        <RouterLink v-reveal class="lg__next reveal" :to="`/legal/${next.key}`" data-cursor="scale">
          <span class="lg__next-label">Next</span>
          <span class="lg__next-title">{{ next.title }}</span>
          <svg class="lg__next-go" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" />
          </svg>
        </RouterLink>
      </article>
    </main>

    <footer class="lg__foot">
      <p>&copy; YOOJ {{ year }}. All Rights Reserved</p>
    </footer>
  </div>
</template>

<style scoped lang="scss">
@use "../styles/media" as *;

.lg {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
  min-height: 100dvh;
  color: var(--ga-ink);
  background: #FFF5F6;
}

// The site's pale ground, lit and drifting, fixed behind a page that scrolls.
.lg__ground {
  position: fixed;
  inset: 0;
  z-index: -1;
  background: var(--ground-light);
  // Beside the shorthand, which resets it, and not in the drift class.
  background-size: 190% 190%;
  pointer-events: none;
}

/* --------------------------------------------------------------- the head */

.lg__head {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: clamp(1.1rem, 2.4vw, 1.9rem) var(--gutter);
}

.lg__back {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 0.8em;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  line-height: var(--la-label);
  letter-spacing: var(--ls-fine);
  text-transform: uppercase;
  color: rgb(60 1 14 / 0.7);
  transition: gap var(--t-hover) var(--e-out-quart), color var(--t-hover) var(--e-out-quart);

  @include hover {
    &:hover { gap: 1.2em; color: var(--ga-ink); }
  }
}

// The solutions page's lockup: the mark beside the word, tracked wide.
.lg__mark {
  grid-column: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: 0.875rem;
  letter-spacing: 0.307em;
  text-transform: uppercase;
  color: var(--ga-ink);
}

.lg__glyph { font-size: 1.05rem; }

/* --------------------------------------------------------------- the page */

/**
 * The index down the left - the three documents, and the sections of the one
 * being read - held in view as the document scrolls beside it.
 */
.lg__main {
  display: grid;
  gap: clamp(2.5rem, 7vh, 4.5rem);
  width: min(100%, 78rem);
  margin-inline: auto;
  padding: clamp(2.5rem, 8vh, 6rem) var(--gutter) clamp(4rem, 12vh, 8rem);

  @media (min-width: 60rem) {
    grid-template-columns: minmax(0, 16rem) minmax(0, 1fr);
    column-gap: clamp(3rem, 7vw, 7rem);
    align-items: start;
  }
}

.lg__side {
  display: grid;
  gap: clamp(2rem, 5vh, 3rem);

  @media (min-width: 60rem) {
    position: sticky;
    top: clamp(1.5rem, 5vh, 3rem);
    max-height: calc(100vh - clamp(3rem, 10vh, 6rem));
    overflow: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar { display: none; }
  }
}

.lg__eyebrow,
.lg__toc-h {
  display: inline-flex;
  align-items: center;
  gap: 0.9em;
  margin-bottom: clamp(1rem, 2.6vh, 1.5rem);
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  line-height: var(--la-label);
  letter-spacing: var(--ls-fine);
  text-transform: uppercase;

  &::before {
    content: "";
    width: 0.4em;
    height: 0.4em;
    border-radius: 50%;
    background: var(--ga-dot);
  }
}

.lg__docs ul {
  display: grid;
  gap: 0.2rem;

  @include handheld {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
}

.lg__doc {
  display: inline-block;
  font-size: clamp(1.05rem, 1.35vw, 1.3rem);
  line-height: 1.5;
  font-weight: 300;
  color: rgb(60 1 14 / 0.5);
  transition: color var(--t-hover) var(--e-out-quart), transform var(--t-hover) var(--e-out-quart);

  &.is-here { color: var(--ga-ink); }

  @include hover {
    &:hover { color: var(--ga-ink); transform: translateX(0.2em); }
  }

  // Upright on a phone the index is a row of pills: three words across the
  // column rather than a list the document has to wait under.
  @include handheld {
    padding: 0.6rem 1rem;
    border-radius: 999px;
    border: 1px solid rgb(60 1 14 / 0.14);
    font-size: 0.92rem;
    line-height: 1.2;

    &.is-here {
      border-color: var(--ga-ink);
      background: var(--ga-ink);
      color: #FFF5F6;
    }
  }
}

/* The sections of the one being read: a hairline rail, the one in view lit. */
.lg__toc {
  animation: lg-in 1s var(--e-out-expo) 0.1s both;

  @include handheld { display: none; }

  ol {
    display: grid;
    border-left: 1px solid rgb(60 1 14 / 0.12);
  }

  a {
    position: relative;
    display: grid;
    grid-template-columns: 1.9rem minmax(0, 1fr);
    align-items: baseline;
    padding: 0.42rem 0 0.42rem 1rem;
    font-size: 0.875rem;
    line-height: 1.4;
    color: rgb(60 1 14 / 0.52);
    transition: color var(--t-hover) var(--e-out-quart);

    // The lit mark on the rail, drawn down from the section's own row.
    &::before {
      content: "";
      position: absolute;
      left: -1px;
      top: 0.35rem;
      bottom: 0.35rem;
      width: 1px;
      background: var(--ga-dot);
      transform: scaleY(0);
      transform-origin: top center;
      transition: transform 0.5s var(--e-out-expo);
    }

    &.is-here {
      color: var(--ga-ink);

      &::before { transform: none; }
    }

    @include hover {
      &:hover { color: var(--ga-ink); }
    }

    &:focus-visible {
      outline: 1px solid rgb(60 1 14 / 0.4);
      outline-offset: 2px;
      border-radius: 2px;
    }
  }
}

.lg__toc-n {
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}

/* ------------------------------------------------------------ the document */

.lg__body {
  min-width: 0;
  max-width: 46rem;
}

@keyframes lg-in {
  from { opacity: 0; transform: translate3d(0, 1rem, 0); }
  to   { opacity: 1; transform: none; }
}

.lg__intro {
  display: grid;
  gap: clamp(1.1rem, 3vh, 1.6rem);
  padding-bottom: clamp(2rem, 5.5vh, 3.25rem);
  margin-bottom: clamp(2.25rem, 6vh, 3.5rem);
  border-bottom: 1px solid rgb(60 1 14 / 0.12);
  animation: lg-in 1s var(--e-out-expo) both;
}

.lg__title {
  font-family: var(--font-say);
  font-size: var(--ta-display);
  line-height: var(--la-display);
  letter-spacing: var(--ls-display);
  font-weight: 300;
}

.lg__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem clamp(1.5rem, 4vw, 3rem);
  margin-top: 0.4rem;

  div { display: grid; gap: 0.3rem; }

  dt {
    font-family: "Space Grotesk", ui-monospace, monospace;
    font-size: var(--ta-label);
    letter-spacing: var(--ls-fine);
    text-transform: uppercase;
    color: rgb(60 1 14 / 0.52);
  }

  dd {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--ga-ink);
  }
}

.lg__sec {
  display: grid;
  gap: 1.1rem;
  padding-top: clamp(1.9rem, 5vh, 2.75rem);
  // The index's jump lands the heading with room above it.
  scroll-margin-top: 1.75rem;

  &:first-of-type { padding-top: 0; }
}

.lg__h {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  column-gap: 1rem;
  margin-bottom: 0.2rem;
  font-family: var(--font-say);
  font-size: clamp(1.3rem, 1.9vw, 1.6rem);
  line-height: 1.25;
  font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--ga-ink);
}

.lg__n {
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  font-weight: 400;
  letter-spacing: var(--ls-fine);
  color: var(--ga-dot);
  font-variant-numeric: tabular-nums;
  // Onto the heading's baseline, not its box.
  translate: 0 -0.2em;
}

.lg__p,
.lg__list li {
  font-size: 1.0625rem;
  line-height: 1.72;
  color: rgb(60 1 14 / 0.84);
  text-wrap: pretty;
}

.lg__body :deep(strong) {
  font-weight: 600;
  color: var(--ga-ink);
}

.lg__body :deep(a) {
  color: var(--ga-dot);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.2em;
  text-decoration-color: rgb(158 18 53 / 0.35);
  transition: text-decoration-color var(--t-hover) var(--e-out-quart);

  @include hover {
    &:hover { text-decoration-color: currentColor; }
  }
}

.lg__body :deep(code) {
  padding: 0.05em 0.35em;
  border-radius: 0.3em;
  background: rgb(60 1 14 / 0.06);
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: 0.88em;
}

.lg__body :deep(sup) {
  font-size: 0.65em;
  line-height: 0;
}

// Each item on the page's dot, the mark every label carries.
.lg__list {
  display: grid;
  gap: 0.7rem;

  li {
    position: relative;
    padding-left: 1.5rem;

    &::before {
      content: "";
      position: absolute;
      left: 0.2rem;
      top: 0.72em;
      width: 0.36rem;
      height: 0.36rem;
      border-radius: 50%;
      background: var(--ga-dot);
    }
  }
}

/**
 * A card on the ground, as the form on the solutions page is: white glass, a
 * hairline, and a wine shadow under it.
 */
@mixin card {
  border-radius: 1.25rem;
  background: rgb(255 255 255 / 0.72);
  box-shadow:
    0 0 0 1px rgb(60 1 14 / 0.05),
    0 1.2rem 3rem -1.6rem rgb(117 2 39 / 0.3);
}

.lg__table {
  @include card;
  margin-block: 0.5rem;
  overflow: hidden;

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
    line-height: 1.55;
  }

  th {
    padding: 1rem 1.1rem 0.8rem;
    text-align: left;
    vertical-align: bottom;
    font-family: "Space Grotesk", ui-monospace, monospace;
    font-size: var(--ta-label);
    font-weight: 400;
    letter-spacing: var(--ls-fine);
    text-transform: uppercase;
    color: rgb(60 1 14 / 0.56);
    border-bottom: 1px solid rgb(60 1 14 / 0.1);
  }

  td {
    padding: 0.95rem 1.1rem;
    vertical-align: top;
    color: rgb(60 1 14 / 0.84);
    border-top: 1px solid rgb(60 1 14 / 0.07);
  }

  tbody tr:first-child td { border-top: 0; }
}

// The one thing on the page a reader must not miss.
.lg__callout {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1rem;
  margin-block: 0.4rem;
  padding: clamp(1.1rem, 2.4vw, 1.5rem) clamp(1.2rem, 2.6vw, 1.75rem);
  border-radius: 1.25rem;
  background: var(--ga-ink);
  color: #FFF5F6;
  box-shadow: 0 1.4rem 3rem -1.6rem rgb(60 1 14 / 0.6);

  p {
    font-size: 1.0625rem;
    line-height: 1.6;
    color: rgb(255 245 246 / 0.86);

    & + p { margin-top: 0.35rem; }
  }

  :deep(strong) { color: #FFFFFF; }

  :deep(a) {
    color: #FEB3B8;
    text-decoration-color: rgb(254 179 184 / 0.45);
  }
}

.lg__callout-mark {
  width: 0.55rem;
  height: 0.55rem;
  margin-top: 0.55em;
  border-radius: 50%;
  background: #FEB3B8;
  box-shadow: 0 0 0 0.35rem rgb(254 179 184 / 0.18);
}

.lg__card {
  @include card;
  display: grid;
  margin-block: 0.4rem;
  padding: 0.35rem clamp(1.1rem, 2.4vw, 1.6rem);

  div {
    display: grid;
    grid-template-columns: minmax(0, 11rem) minmax(0, 1fr);
    gap: 0.35rem 1.5rem;
    padding: 0.95rem 0;
    border-top: 1px solid rgb(60 1 14 / 0.07);

    &:first-child { border-top: 0; }
  }

  dt {
    font-family: "Space Grotesk", ui-monospace, monospace;
    font-size: var(--ta-label);
    letter-spacing: var(--ls-fine);
    text-transform: uppercase;
    line-height: 1.9;
    color: rgb(60 1 14 / 0.56);
  }

  dd {
    margin: 0;
    font-size: 1rem;
    line-height: 1.6;
    color: var(--ga-ink);
  }
}

.lg__closing {
  margin-top: clamp(2.5rem, 7vh, 4rem);
  font-family: var(--font-say);
  font-size: var(--ta-lead);
  line-height: var(--la-lead);
  font-weight: 300;
  font-style: italic;
  color: rgb(60 1 14 / 0.8);
}

// The next document, as the last thing on the page.
.lg__next {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.35rem 1rem;
  margin-top: clamp(3rem, 9vh, 5rem);
  padding-top: clamp(1.4rem, 3.5vh, 2rem);
  border-top: 1px solid rgb(60 1 14 / 0.14);
  color: var(--ga-ink);

  @include hover {
    &:hover .lg__next-go { transform: translateX(0.35rem); }
  }

  &:focus-visible {
    outline: 1px solid rgb(60 1 14 / 0.4);
    outline-offset: 0.5rem;
    border-radius: 2px;
  }
}

.lg__next-label {
  grid-column: 1 / -1;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  letter-spacing: var(--ls-fine);
  text-transform: uppercase;
  color: rgb(60 1 14 / 0.52);
}

.lg__next-title {
  font-family: var(--font-say);
  font-size: var(--ta-link);
  line-height: 1.05;
  letter-spacing: var(--ls-display);
  font-weight: 300;
}

.lg__next-go {
  width: clamp(1.4rem, 2.4vw, 2rem);
  height: clamp(1.4rem, 2.4vw, 2rem);
  margin-bottom: 0.35rem;
  overflow: visible;
  color: var(--ga-dot);
  transition: transform 0.5s var(--e-out-expo);

  path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.3;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
}

.lg__foot {
  padding: 0 var(--gutter) clamp(1.6rem, 4vh, 2.6rem);
  font-size: var(--t-body);
  color: rgb(60 1 14 / 0.52);
}

/* --------------------------------------------------------------- handheld */

/**
 * A phone: every table row becomes a card of its own, each cell under the
 * column's name - three columns of prose do not fit a phone's width, and a
 * table scrolled sideways hides the one column the reader needed.
 */
@include phone {
  .lg__table {
    background: none;
    box-shadow: none;
    border-radius: 0;
    overflow: visible;

    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }

    table, tbody, tr, td { display: block; }

    tbody { display: grid; gap: 0.75rem; }

    tr {
      @include card;
      padding: 0.35rem 1.1rem;
    }

    td {
      padding: 0.75rem 0;
      border-top: 1px solid rgb(60 1 14 / 0.07);

      &:first-child { border-top: 0; }

      &::before {
        content: attr(data-label);
        display: block;
        margin-bottom: 0.25rem;
        font-family: "Space Grotesk", ui-monospace, monospace;
        font-size: var(--ta-label);
        letter-spacing: var(--ls-fine);
        text-transform: uppercase;
        color: rgb(60 1 14 / 0.52);
      }
    }
  }

  .lg__card div {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.2rem;
  }

  .lg__p,
  .lg__list li { font-size: 1rem; }
}

@media (prefers-reduced-motion: reduce) {
  .lg__intro,
  .lg__toc { animation: none; }
}
</style>
