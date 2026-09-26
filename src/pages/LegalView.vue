<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import BrandMark from "../components/ui/BrandMark.vue";

/**
 * /legal/privacy, /legal/terms, /legal/cookies: the fine print behind the
 * footer's "Legal".
 *
 * One page for the three, because they are one kind of thing and a reader who
 * came for one often wants the next: the other two sit beside the one being
 * read. It is lit like the solutions page and the menu - the pale ground - and
 * scrolls natively; there is nothing here to choreograph.
 *
 * The documents themselves are not written yet. Each says what it will cover
 * and where to ask in the meantime, and nothing it cannot stand behind: a
 * policy is a promise, and this page does not make one on YOOJ's behalf.
 */

type Doc = "privacy" | "terms" | "cookies";

const DOCS: Record<Doc, { title: string; covers: string }> = {
  privacy: {
    title: "Privacy Policy",
    covers:
      "How YOOJ collects, uses, stores and protects personal and health "
      + "information - at its centres, through JeevanBhar, and on this website - "
      + "and the choices and rights you have over it.",
  },
  terms: {
    title: "Terms of Service",
    covers:
      "The terms on which this website and YOOJ’s digital services are offered, "
      + "and what YOOJ and the people who use them can expect of each other.",
  },
  cookies: {
    title: "Cookie Policy",
    covers:
      "Which cookies and similar technologies this website uses, what each of "
      + "them is for, and how to control them in your browser.",
  },
};

const ORDER: Doc[] = ["privacy", "terms", "cookies"];

const route = useRoute();

const key = computed<Doc>(() => {
  const doc = route.params.doc;
  return (ORDER as string[]).includes(doc as string) ? (doc as Doc) : "privacy";
});

const doc = computed(() => DOCS[key.value]);

const year = new Date().getFullYear();

// The tab says which document, as the deck's does.
let titleWas = "";
const name = () => { document.title = `${doc.value.title} — YOOJ`; };

onMounted(() => {
  titleWas = document.title;
  name();
});

watch(key, name);

onBeforeUnmount(() => { document.title = titleWas; });
</script>

<template>
  <div class="lg">
    <div class="lg__ground ground-drift" aria-hidden="true" />

    <header class="lg__head">
      <RouterLink class="lg__back" to="/" data-cursor="scale">
        <span aria-hidden="true">&larr;</span>
        Back to site
      </RouterLink>

      <RouterLink class="lg__mark" to="/" data-cursor="scale" aria-label="YOOJ, home">
        <BrandMark class="lg__glyph" />
        <span>YOOJ</span>
      </RouterLink>
    </header>

    <main class="lg__main">
      <nav class="lg__docs" aria-label="Legal documents">
        <p class="lg__eyebrow">Legal</p>
        <ul>
          <li v-for="k in ORDER" :key="k">
            <RouterLink
              :to="`/legal/${k}`"
              class="lg__doc"
              :class="{ 'is-here': k === key }"
              :aria-current="k === key ? 'page' : undefined"
              data-cursor="scale"
            >{{ DOCS[k].title }}</RouterLink>
          </li>
        </ul>
      </nav>

      <!-- Keyed, so a change of document plays its entrance again rather
           than swapping the words under a reader mid-sentence. -->
      <article :key="key" class="lg__body">
        <h1 class="lg__title">{{ doc.title }}</h1>
        <p class="lg__covers">{{ doc.covers }}</p>

        <div class="lg__note">
          <span class="lg__dot" aria-hidden="true" />
          <p>
            The full text of this document will be published on this page. Until
            it is, write to
            <a href="mailto:hello@yooj.example" data-cursor="scale">hello@yooj.example</a>
            with any question about it.
          </p>
        </div>
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
 * The three documents down the left, the one being read beside them: the
 * index a reader steps along, and the page they are on.
 */
.lg__main {
  display: grid;
  align-content: center;
  gap: clamp(2.5rem, 7vh, 4.5rem);
  width: min(100%, 76rem);
  margin-inline: auto;
  padding: clamp(3rem, 10vh, 7rem) var(--gutter);

  @media (min-width: 60rem) {
    grid-template-columns: minmax(0, 16rem) minmax(0, 1fr);
    column-gap: clamp(3rem, 8vw, 8rem);
    align-items: start;
  }
}

.lg__eyebrow {
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

.lg__body {
  display: grid;
  gap: clamp(1.4rem, 4vh, 2.2rem);
  max-width: 44rem;
  animation: lg-in 1s var(--e-out-expo) both;
}

@keyframes lg-in {
  from { opacity: 0; transform: translate3d(0, 1rem, 0); }
  to   { opacity: 1; transform: none; }
}

.lg__title {
  font-size: var(--ta-display);
  line-height: var(--la-display);
  letter-spacing: var(--ls-display);
  font-weight: 200;
}

.lg__covers {
  max-width: 38rem;
  font-size: var(--ta-lead);
  line-height: var(--la-lead);
  font-weight: 300;
  color: rgb(60 1 14 / 0.82);
  text-wrap: pretty;
}

// A card on the ground, as the form on the solutions page is.
.lg__note {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1rem;
  align-items: baseline;
  max-width: 38rem;
  padding: clamp(1.1rem, 2.4vw, 1.6rem) clamp(1.2rem, 2.6vw, 1.9rem);
  border-radius: 1.4rem;
  background: rgb(255 255 255 / 0.72);
  box-shadow:
    0 0 0 1px rgb(60 1 14 / 0.05),
    0 1.2rem 3rem -1.4rem rgb(117 2 39 / 0.28);
  font-size: 1rem;
  line-height: 1.6;
  color: rgb(60 1 14 / 0.78);

  a {
    color: var(--ga-dot);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 0.2em;
  }
}

.lg__dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--ga-dot);
  translate: 0 -0.1em;
}

.lg__foot {
  padding: 0 var(--gutter) clamp(1.6rem, 4vh, 2.6rem);
  font-size: var(--t-body);
  color: rgb(60 1 14 / 0.52);
}

@media (prefers-reduced-motion: reduce) {
  .lg__body { animation: none; }
}
</style>
