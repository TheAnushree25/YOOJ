<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import ActionButton from "../ui/ActionButton.vue";
import { ScrollTrigger } from "../../composables/useMotion";
import { usePlaces, type Place } from "../../composables/usePlaces";
import { closeUnderPulse, onDark } from "../../lib/session";

/**
 * The close: the last call and the colophon, in one frame.
 *
 * Not a band of small print under a separate call to action. The reference ends
 * the page on a single held screen — the invitation set large against the left,
 * the ways out listed on the right, and the legal line along the floor — and
 * that is what makes it read as the end of an argument rather than as the
 * furniture every site has at the bottom.
 *
 * The heading is set flush right. It closes the page against the same axis the
 * thread runs down, so the three lines finish on a hard edge instead of ragging
 * out into the middle of the frame.
 *
 * The same close ends both pages, so every link in it is a place rather than
 * an anchor: on the page it points into, it glides there; from the other page,
 * it goes there and lands on the section (composables/usePlaces).
 */
const props = withDefaults(defineProps<{
  /**
   * Bring its own ground.
   *
   * On the front page the close stands on the field that runs behind every
   * dark section. The solutions page's field is pale, so there the close
   * paints the same wine itself - and tells that page's chrome when it has
   * arrived, which the front page works out for itself from its chapters.
   */
  grounded?: boolean;
}>(), { grounded: false });

type Link = Place & { label: string };

const { href, go, isHere } = usePlaces();

const root = ref<HTMLElement | null>(null);

const title = ["Better health", "for more lives", "everyday"];

/** The two chapters the argument turns on, set large. */
const nav: Link[] = [
  { label: "Reconnecting healthcare", path: "/", id: "reconnect" },
  { label: "The future of healthcare", path: "/", id: "frontier" },
  // 4 R'S SECTION - hidden for now, so its link is too: it would jump to a
  // section that is not on the page. Uncomment with the section (HomeView).
  // { label: "The 4 R’s", path: "/", id: "tenets" },
];

const reach = [
  { label: "Email", href: "mailto:hello@yooj.example" },
  { label: "LinkedIn", href: "#" },
];

/**
 * The map, in the order the front page tells it: the problem, who is answering
 * it, where it is going, how it works, and the card that carries it - and then
 * the other page.
 */
const columns: Array<{ title: string; links: Link[] }> = [
  {
    title: "Explore",
    links: [
      { label: "Problem / The Gap", path: "/", id: "reconnect" },
      { label: "About YOOJ", path: "/", id: "about" },
      { label: "Vision", path: "/", id: "frontier" },
      { label: "How it works", path: "/", id: "centre" },
      { label: "JeevanBhar", path: "/", id: "solution" },
    ],
  },
  {
    title: "Company",
    links: [{ label: "Solutions", path: "/solutions" }],
  },
];

/** The fine print, folded behind one word on the floor of the frame. */
const legal: Link[] = [
  { label: "Privacy Policy", path: "/legal/privacy" },
  { label: "Terms of Service", path: "/legal/terms" },
  { label: "Cookie Policy", path: "/legal/cookies" },
];

/** "Start your journey": the solutions page - or, already on it, its top. */
const JOURNEY: Place = { path: "/solutions" };

const year = new Date().getFullYear();

/* ------------------------------------------------------------------ legal */

/**
 * "Legal", and the three documents behind it.
 *
 * A pointer opens it by hovering, which is what the word invites. A press
 * opens it as well - that is all a keyboard or a finger has - and one opened
 * by a press closes on Escape, on a press anywhere else, or when focus walks
 * out of it.
 */
const legalOpen = ref(false);
const legalBox = ref<HTMLElement | null>(null);
const legalWord = ref<HTMLButtonElement | null>(null);

const closeLegal = (refocus = false) => {
  legalOpen.value = false;
  if (refocus) legalWord.value?.focus();
};

const pressedElsewhere = (e: PointerEvent) => {
  if (legalBox.value && !legalBox.value.contains(e.target as Node)) closeLegal();
};

const focusLeft = (e: FocusEvent) => {
  const next = e.relatedTarget as Node | null;
  if (next && !legalBox.value?.contains(next)) closeLegal();
};

watch(legalOpen, (open) => {
  if (open) document.addEventListener("pointerdown", pressedElsewhere, true);
  else document.removeEventListener("pointerdown", pressedElsewhere, true);
});

/* ------------------------------------------------------------ the ground */

let head: ScrollTrigger | null = null;
let corner: ScrollTrigger | null = null;

onMounted(() => {
  if (!props.grounded || !root.value) return;
  // The header's ink turns as the close passes under it...
  head = ScrollTrigger.create({
    trigger: root.value,
    start: "top 6%",
    onToggle: (self) => { onDark.value = self.isActive; },
  });
  // ...and the pulse's a viewport sooner: it is at the foot of the frame.
  corner = ScrollTrigger.create({
    trigger: root.value,
    start: "top bottom-=60",
    onToggle: (self) => { closeUnderPulse.value = self.isActive; },
  });
});

onBeforeUnmount(() => {
  head?.kill();
  corner?.kill();
  document.removeEventListener("pointerdown", pressedElsewhere, true);
});
</script>

<template>
  <footer id="contact" ref="root" class="cl" :class="{ 'is-grounded ground-drift': grounded }">

    <!-- The thread one last time, running down the axis the heading closes on
         and stopping short of the floor rather than meeting it. -->
    <svg class="cl__thread" viewBox="0 0 120 1000" preserveAspectRatio="none" aria-hidden="true">
      <path d="M 116 0 L 116 150 C 116 300 4 330 4 470 L 4 1000" />
    </svg>

    <div class="cl__grid">
      <div class="cl__call">
        <h2 class="cl__h" :aria-label="title.join(' ')">
          <span v-for="(line, i) in title" :key="i" v-reveal="i * 90" class="cl__line" aria-hidden="true">
            {{ line }}
          </span>
        </h2>

        <div v-reveal="300" class="cl__acts">
          <ActionButton label="Partner with us" href="mailto:hello@yooj.example" variant="solid" />
          <ActionButton label="Start your journey" :href="href(JOURNEY)" @activate="go(JOURNEY, $event)" />
        </div>
      </div>

      <div class="cl__ways">
        <nav v-reveal="160" class="cl__nav" aria-label="Chapters">
          <a
            v-for="n in nav"
            :key="n.label"
            :href="href(n)"
            data-cursor="scale"
            @click="go(n, $event)"
          >{{ n.label }}</a>
        </nav>

        <ul v-reveal="260" class="cl__reach">
          <li v-for="r in reach" :key="r.label">
            <a :href="r.href" data-cursor="scale">{{ r.label }}</a>
          </li>
        </ul>

        <!-- The map: every chapter by what it is for, and the other page. -->
        <div v-reveal="340" class="cl__map">
          <nav v-for="col in columns" :key="col.title" class="cl__col" :aria-label="col.title">
            <p class="cl__col-h">{{ col.title }}</p>
            <ul>
              <li v-for="link in col.links" :key="link.label">
                <a
                  :href="href(link)"
                  :aria-current="!link.id && isHere(link) ? 'page' : undefined"
                  data-cursor="scale"
                  @click="go(link, $event)"
                >{{ link.label }}</a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>

    <div class="cl__base">
      <p>&copy; YOOJ {{ year }}. All Rights Reserved</p>

      <div
        ref="legalBox"
        class="cl__legal"
        :class="{ 'is-open': legalOpen }"
        @keydown.esc="closeLegal(true)"
        @focusout="focusLeft"
      >
        <button
          ref="legalWord"
          class="cl__legal-word"
          type="button"
          aria-controls="cl-legal"
          :aria-expanded="legalOpen"
          data-cursor="scale"
          @click="legalOpen = !legalOpen"
        >
          Legal
          <svg class="cl__legal-chev" viewBox="0 0 12 8" aria-hidden="true" focusable="false">
            <path d="M1 6.5 6 1.5 11 6.5" />
          </svg>
        </button>

        <!-- Drawn above the word, since the word is on the floor of the frame,
             but after it in the document: Tab from "Legal" steps into the
             list, not out of the page. The padding under the card is the
             bridge a pointer crosses from the word to the list without the
             hover letting go. -->
        <div id="cl-legal" class="cl__legal-menu">
          <ul class="cl__legal-card" aria-label="Legal">
            <li v-for="(doc, i) in legal" :key="doc.path" :style="{ '--i': i }">
              <a :href="href(doc)" data-cursor="scale" @click="go(doc, $event)">
                <span>{{ doc.label }}</span>
                <svg class="cl__legal-go" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" />
                </svg>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;

.cl {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: grid;
  grid-template-rows: 1fr auto;
  min-height: 100vh;
  min-height: calc(var(--vh, 1vh) * 100);
  padding: clamp(6rem, 16vh, 11rem) 0 clamp(1.6rem, 4vh, 2.6rem);
  // Its own ink: the solutions page sets everything inside it in wine, and the
  // outlined call to action takes its colour from here.
  color: var(--c-bone);
}

/**
 * Its own ground, where the page behind it is pale: the site's wine with the
 * rose light on it, drifting, under the same veil the front page lays over its
 * field - so the close reads as the same room on either page.
 */
.cl.is-grounded {
  background: var(--ground-dark);
  // Beside the shorthand, which resets it, and not in the drift class. Drawn
  // at 140% rather than the usual 190%: at 190% the rose light is walked off
  // the frame for half of each cycle, where the front page's close always has
  // its bloom in the upper right.
  background-size: 140% 140%;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 0;
    background: var(--veil);
    pointer-events: none;
  }
}

.cl__thread {
  position: absolute;
  left: 47%;
  top: 0;
  z-index: 1;
  width: 8%;
  height: 76%;
  overflow: visible;
  pointer-events: none;

  path {
    fill: none;
    stroke: rgb(var(--rgb-bone) / 0.2);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
}

.cl__grid {
  position: relative;
  z-index: 2;
  align-self: center;
  display: grid;
  gap: clamp(3rem, 9vh, 5.5rem);
  padding-inline: var(--gutter);

  @media (min-width: 60rem) {
    // 41% / 30% / 29%: the call closes on the axis, the ways out start at the
    // far third, and the gap between them is the frame's quietest part.
    grid-template-columns: 41% 30% minmax(0, 1fr);
    gap: 0;
    padding-inline: 0;
  }
}

.cl__call {
  @media (min-width: 60rem) { text-align: right; }
}

.cl__h {
  font-size: var(--t-h1);
  line-height: 1.04;
  letter-spacing: -0.03em;
  font-weight: 250;
  color: var(--c-bone);
}

.cl__line { display: block; }

.cl__acts {
  display: flex;
  flex-wrap: wrap;
  gap: clamp(0.6rem, 1.4vw, 1rem);
  margin-top: clamp(2rem, 5.5vh, 3.2rem);

  @media (min-width: 60rem) { justify-content: flex-end; }
}

// Skips the middle column, so the nav sits in the last third with the thread
// running through the empty one between.
.cl__ways {
  display: grid;
  gap: clamp(1.8rem, 5vh, 3rem);
  align-content: start;

  @media (min-width: 60rem) {
    grid-column: 3;
    padding-right: var(--gutter);
  }
}

.cl__nav {
  display: grid;
  gap: 0.1em;

  a {
    justify-self: start;
    font-size: var(--t-h3);
    line-height: 1.28;
    font-weight: 250;
    letter-spacing: -0.014em;
    color: var(--c-bone-dim);
    transition: color var(--t-hover) var(--e-out-quart);

    &:first-child { color: var(--c-bone); }

    // A pointer's only: after a tap the accent stayed on the link.
    @include hover {
      &:hover { color: var(--c-accent); }
    }
  }
}

.cl__reach {
  display: grid;
  gap: 0.55em;
  list-style: none;

  a {
    font-family: "Space Grotesk", ui-monospace, monospace;
    font-size: var(--t-label);
    letter-spacing: var(--ls-label);
    text-transform: uppercase;
    color: rgb(var(--rgb-bone) / 0.72);
    transition: color var(--t-hover) var(--e-out-quart);

    @include hover {
      &:hover { color: var(--c-accent); }
    }
  }
}

/* ---------------------------------------------------------------- the map */

/**
 * Two columns under a hairline: the quietest voice in the close, set in plain
 * text rather than in the tracked capitals above it, so it reads as the index
 * it is and not as more of the calls.
 */
.cl__map {
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: 1.5rem clamp(2rem, 4.2vw, 4.75rem);
  padding-top: clamp(1.5rem, 3.6vh, 2.2rem);
  border-top: 1px solid rgb(var(--rgb-bone) / 0.12);
}

.cl__col-h {
  margin-bottom: clamp(0.8rem, 1.8vh, 1.05rem);
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: rgb(var(--rgb-bone) / 0.46);
}

.cl__col ul {
  display: grid;
  gap: clamp(0.35rem, 0.9vh, 0.55rem);
}

.cl__col a {
  position: relative;
  display: inline-block;
  font-size: clamp(0.92rem, 1vw, 1rem);
  line-height: 1.5;
  color: rgb(var(--rgb-bone) / 0.8);
  transition: color var(--t-hover) var(--e-out-quart);

  // A hairline drawn under the word from its first letter, the way a pen
  // underlines: the link says it is one without a rule standing under it at rest.
  &::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0.05em;
    height: 1px;
    background: currentColor;
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform 0.5s var(--e-out-expo);
  }

  &[aria-current="page"] { color: rgb(var(--rgb-bone) / 0.5); }

  @include hover {
    &:hover {
      color: var(--c-accent);

      &::after { transform: scaleX(1); }
    }
  }

  &:focus-visible {
    outline: none;
    color: var(--c-accent);

    &::after { transform: scaleX(1); }
  }
}

/* --------------------------------------------------------------- the floor */

.cl__base {
  position: relative;
  z-index: 3;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.8rem clamp(1rem, 4vw, 3rem);
  padding: clamp(3rem, 9vh, 6rem) var(--gutter) 0;
  font-size: var(--t-body);
  color: rgb(var(--rgb-bone) / 0.52);

  // On the same two axes as everything above: the legal line on the page's left
  // gutter, "Legal" starting where the ways out start. It also keeps the word
  // out of the bottom-right corner, which belongs to the sound control —
  // flush right, the two sat on top of each other.
  //
  // No padding or column gap on the grid itself: the ways out start at 71% of
  // the full width, and either one moved this column off that line - by 13px
  // at 1440, under a map whose left edge now makes it plain.
  @media (min-width: 60rem) {
    display: grid;
    grid-template-columns: 71% minmax(0, 1fr);
    column-gap: 0;
    align-items: baseline;
    padding-inline: 0;

    > :first-child { padding-left: var(--gutter); }
  }
}

.cl__legal {
  position: relative;
  justify-self: start;
}

.cl__legal-word {
  display: inline-flex;
  align-items: center;
  gap: 0.75em;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: inherit;
  cursor: pointer;
  transition: color var(--t-hover) var(--e-out-quart);

  &:focus-visible {
    outline: 1px solid rgb(var(--rgb-bone) / 0.5);
    outline-offset: 0.45rem;
    border-radius: 2px;
  }
}

.cl__legal-chev {
  width: 0.72em;
  height: 0.5em;
  overflow: visible;
  transform: rotate(180deg);
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

/**
 * The card rises out of the word: glass over the ground, a hairline edge, and
 * the three documents arriving one after another.
 *
 * Hidden only once it has finished leaving, and shown the instant it is asked
 * for - the same arrangement as the site menu, and for the same reason: an
 * interpolated `visibility` waits on a clock a background tab never runs.
 */
.cl__legal-menu {
  position: absolute;
  // Out by the card's padding and a row's, so the documents start on the
  // same vertical as the word they came out of.
  left: -1.3rem;
  bottom: 100%;
  z-index: 1;
  padding-bottom: 0.85rem;
  visibility: hidden;
  opacity: 0;
  transform: translate3d(0, 0.6rem, 0);
  transition:
    opacity 0.3s var(--e-out-quart),
    transform 0.5s var(--e-out-expo),
    visibility 0s linear 0.3s;
}

.cl__legal-card {
  display: grid;
  min-width: 14rem;
  padding: 0.45rem;
  border-radius: 1.05rem;
  border: 1px solid rgb(var(--rgb-bone) / 0.14);
  background: rgb(var(--rgb-ink) / 0.58);
  -webkit-backdrop-filter: blur(16px) saturate(1.25);
  backdrop-filter: blur(16px) saturate(1.25);
  box-shadow:
    inset 0 1px 0 rgb(var(--rgb-bone) / 0.08),
    0 1.4rem 3rem -0.8rem rgb(var(--rgb-void) / 0.6);

  li {
    opacity: 0;
    transform: translate3d(0, 0.45rem, 0);
    transition:
      opacity 0.3s var(--e-out-quart),
      transform 0.5s var(--e-out-expo);
  }

  a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.6rem;
    padding: 0.72rem 0.85rem;
    border-radius: 0.7rem;
    font-size: clamp(0.9rem, 0.95vw, 0.98rem);
    line-height: 1.3;
    color: rgb(var(--rgb-bone) / 0.82);
    transition:
      color var(--t-hover) var(--e-out-quart),
      background-color var(--t-hover) var(--e-out-quart);

    &:focus-visible {
      outline: 1px solid rgb(var(--rgb-bone) / 0.4);
      outline-offset: -1px;
    }
  }
}

// The arrow waits a little behind its row and comes forward when the row is
// pointed at.
.cl__legal-go {
  flex: none;
  width: 0.95rem;
  height: 0.95rem;
  overflow: visible;
  color: var(--c-accent);
  opacity: 0;
  transform: translate3d(-0.35rem, 0, 0);
  transition:
    opacity var(--t-hover) var(--e-out-quart),
    transform 0.5s var(--e-out-expo);

  path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
}

.cl__legal-card a:hover,
.cl__legal-card a:focus-visible {
  color: var(--c-bone);
  background: rgb(var(--rgb-bone) / 0.07);

  .cl__legal-go { opacity: 1; transform: none; }
}

@mixin legal-open {
  .cl__legal-word { color: var(--c-bone); }
  .cl__legal-chev { transform: none; }

  .cl__legal-menu {
    visibility: visible;
    opacity: 1;
    transform: none;
    transition:
      opacity 0.35s var(--e-out-quart),
      transform 0.6s var(--e-out-expo),
      visibility 0s;
  }

  .cl__legal-card li {
    opacity: 1;
    transform: none;
    transition-delay: calc(0.05s + var(--i) * 0.045s);
  }
}

.cl__legal.is-open { @include legal-open; }

// A pointer's hover opens it too; a finger's would stick after the tap.
@include hover {
  .cl__legal:hover { @include legal-open; }
}

/**
 * The contact links are 14px of text. On a pointer device that is a generous
 * target; on a thumb it is a miss waiting to happen. The row keeps its drawn
 * position - the padding is taken back out as negative margin - so this
 * changes the hit area and not the composition.
 */
@media (pointer: coarse) {
  // The section jumps sit straight inside their nav rather than in a list,
  // so they need naming separately from the contact row below them.
  .cl__nav a,
  li > a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding-block: 0.9rem;
    margin-block: -0.9rem;
  }

  .cl__col ul { gap: 1.1rem; }

  // The underline is drawn at the foot of the link's box, which the padding
  // above has just moved a finger's width below the word.
  .cl__col a::after { display: none; }

  .cl__legal-word {
    min-height: 44px;
    padding-block: 0.8rem;
    margin-block: -0.8rem;
  }

  // The card's rows are already a finger tall; they keep their own padding.
  .cl__legal-card li > a {
    min-height: 48px;
    padding-block: 0.72rem;
    margin-block: 0;
  }
}

/**
 * Below the wide layout the floor is a column: "Legal", then the legal line
 * under it, both on the gutter. Side by side, "Legal" was pushed flush right -
 * into the corner the sound control stands in.
 *
 * Stated as the exact complement of the wide floor's query rather than as
 * `handheld`: the two share 60rem itself, and there the reordering would put
 * "Legal" in the wide grid's first column.
 */
@media (max-width: 59.99rem) {
  // The thread runs down the empty column between the call and the ways out.
  // Stacked, there is no empty column, and it ran through the words instead.
  .cl__thread { display: none; }

  .cl__base {
    flex-direction: column;
    align-items: flex-start;
  }

  .cl__legal { order: -1; }

  // On the gutter there is no room out to the left for the card to align on.
  .cl__legal-menu { left: -0.6rem; }
}

/**
 * A phone on its side: the call and the ways out side by side, as on a wide
 * screen, rather than a column three screens tall.
 */
@include short {
  .cl { padding-top: clamp(4.5rem, 18vh, 6rem); }

  .cl__grid {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: 1.5rem clamp(1.5rem, 5vw, 3rem);
    align-items: start;
  }

  .cl__h { font-size: clamp(2rem, 5vw, 3rem); }

  .cl__acts { margin-top: clamp(1.25rem, 5vh, 2rem); }
}

@media (prefers-reduced-motion: reduce) {
  .cl__legal-menu,
  .cl__legal-card li { transform: none !important; }
}
</style>
