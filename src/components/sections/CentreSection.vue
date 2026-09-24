<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { ScrollTrigger, prefersReduced } from "../../composables/useMotion";
import { isDevice } from "../../composables/useViewport";

/**
 * The YOOJ Primary Care Centre: one roof, and what is under it.
 *
 * A stage the reader travels through rather than a row they have to operate.
 * The section holds the screen, and the scroll that would have carried the
 * page on carries the four services across it instead: three stand in the
 * frame with room between them, the fourth waits at the edge, and as the
 * reader moves the row slides one card along until the fourth is in and the
 * first is leaving. Sticky, like the network section, and for the reason
 * recorded there - a pinned trigger re-measures its own start as zero on any
 * refresh that lands while the pin is applied.
 *
 * What makes it float rather than sit:
 *
 * - The cards ride a long, low wave. Each one's height is read off where it
 *   stands across the screen, so as the row slides they rise and fall past
 *   one another - the row is never a ruled line, and it never moves as a
 *   block.
 * - The photographs are windows. Each is a little larger than its card and
 *   shifts against the card's travel, so the scene behind the frame moves at
 *   its own depth.
 * - Each drifts on a slow breath of its own, out of step with its neighbours.
 * - They are dealt in as the section arrives, one after another, falling a
 *   short way and turning square as they land.
 * - Under the pointer a card tilts toward it and catches the light.
 *
 * The layout is measured, not guessed: the card is sized from the height the
 * words leave, and the spacing from whatever width is left once three of them
 * and a sliver of the fourth are placed. On a wide screen that is generous;
 * the gap is capped so the three never drift so far apart that they stop
 * reading as one row.
 */

const services = [
  { key: "opds", name: "YOOJ OPDs", note: "a YOOJ nurse taking an older patient’s blood pressure in a YOOJ OPD" },
  { key: "pharmacy", name: "YOOJ Pharmacy", note: "a YOOJ pharmacist handing a customer her medicine across the counter" },
  { key: "pathology", name: "YOOJ Pathology", note: "a YOOJ technician pipetting a blood sample in the pathology lab" },
  { key: "radiology", name: "YOOJ Radiology", note: "a YOOJ radiographer settling a patient into the scanner" },
] as const;

const COUNT = services.length;
const RATIO = 576 / 405;

const root = ref<HTMLElement | null>(null);
const gallery = ref<HTMLElement | null>(null);
const row = ref<HTMLElement | null>(null);
const slots = ref<HTMLElement[]>([]);
const fill = ref<HTMLElement | null>(null);

const reduced = prefersReduced();

/** The row's travel, 0 to 1: from the first three to the last three. */
let travel = 0;
/** The approach: 0 as the section's top enters the screen, 1 as it locks. */
let arrival = reduced ? 1 : 0;

/** The measured layout, in pixels. */
const box = {
  width: 0,
  card: 0,
  tall: 0,
  step: 0,
  start: 0,
  steps: 0,
  wave: 0,
};

let travelTrigger: ScrollTrigger | null = null;
let arrivalTrigger: ScrollTrigger | null = null;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ease = (t: number) => 1 - (1 - t) ** 3;

/**
 * Size and place the row from the room the stage actually has.
 *
 * The index sits over each card and the wave needs headroom either side, so
 * both come off the height before the card is sized from it.
 */
const INDEX = 34;
/** Clear space kept under the row for the progress rule. */
const RULE = 30;

const layout = () => {
  const g = gallery.value;
  if (!g) return;
  const W = g.clientWidth;
  const H = g.clientHeight;
  if (!W || !H) return;

  /**
   * How many stand in the frame at once: three on a wide screen, one on a
   * phone held upright, and two on a tablet held upright or a phone on its
   * side - where the gallery is the right-hand part of a shallow frame, and
   * three cards in it came out eighty pixels wide. The stylesheet gives each
   * count its own length of travel (`--travel`), on the same queries.
   */
  const portrait = isDevice("portrait");
  const short = isDevice("short");
  const pairs = short || (portrait && W >= 600);
  const visible = reduced ? COUNT : pairs ? 2 : portrait ? 1 : 3;
  const tight = portrait || short;
  const gutter = clamp(W * 0.034, 20, 52);
  const wave = reduced ? 0 : clamp(H * 0.035, 6, 22);

  // As tall as the stage allows...
  let tall = H - INDEX - wave * 2 - RULE;
  let card = tall / RATIO;
  // ...and no wider than leaves room for the others and a real gap.
  const peekMin = tight ? 18 : 28;
  const gapMin = tight ? 18 : 40;
  card = Math.min(card, (W - 2 * gutter - (visible - 1) * gapMin - (visible < COUNT ? 2 * peekMin : 0)) / visible);
  tall = card * RATIO;

  // The spacing is what is left: the visible cards and a sliver of the next
  // share the width, and the gap takes the rest, within bounds.
  const peek = visible < COUNT ? clamp(W * 0.04, peekMin, 84) : 0;
  // Generous before it is loose: on a very wide screen the cards are sized by
  // the height, and a tighter cap left more than half the fourth in view.
  const gapMax = Math.max(gapMin, Math.min(W * 0.12, card * 0.76));
  const gap = clamp((W - visible * card - 2 * peek) / (visible + 1), gapMin, gapMax);

  box.width = W;
  box.card = card;
  box.tall = tall;
  box.step = card + gap;
  box.start = (W - visible * card - (visible - 1) * gap) / 2;
  box.steps = COUNT - visible;
  box.wave = wave;

  g.style.setProperty("--w", `${card.toFixed(2)}px`);
  g.style.setProperty("--h", `${tall.toFixed(2)}px`);
  g.style.setProperty("--step", `${box.step.toFixed(2)}px`);
  g.style.setProperty("--top", `${((H - RULE - (INDEX + tall)) / 2).toFixed(2)}px`);
  render();
};

/**
 * Everything the scroll moves, written in one pass.
 *
 * The row slides; each card rides the wave at the height its position across
 * the screen gives it, and lands from its deal; each photograph shifts
 * against its card. Transforms only - nothing here costs a layout.
 */
const render = () => {
  if (!row.value || !box.width) return;
  const shift = box.start - travel * box.steps * box.step;
  row.value.style.transform = `translate3d(${shift.toFixed(2)}px, 0, 0)`;

  const W = box.width;
  slots.value.forEach((el, i) => {
    const centre = shift + i * box.step + box.card / 2;
    const across = (centre - W / 2) / W;
    const y = box.wave * Math.sin((centre / (W * 1.55)) * Math.PI * 2 + 0.9);

    // The deal: one after another, a short fall, turning square as it lands.
    const own = ease(clamp((arrival - i * 0.09) / 0.62, 0, 1));
    const fall = (1 - own) * box.tall * 0.42;
    const turn = (1 - own) * (i % 2 ? 3.2 : -3.2);

    el.style.transform = `translate3d(0, ${(y + fall).toFixed(2)}px, 0) rotate(${turn.toFixed(2)}deg)`;
    el.style.opacity = own.toFixed(3);

    const img = el.querySelector<HTMLElement>(".ce__img");
    if (img) img.style.transform = `translate3d(${(-across * 7).toFixed(3)}%, 0, 0) scale(1.14)`;
  });

  if (fill.value) {
    const share = box.steps ? travel : 1;
    fill.value.style.transform = `scaleX(${(0.25 + share * 0.75).toFixed(4)})`;
  }
};

/* ------------------------------------------------------------ the tilt */

/**
 * The card leans toward the pointer and the light follows it across the
 * print. Written straight to the card as custom properties: a hover is too
 * quick a thing to route through the component's state.
 */
const lean = (event: PointerEvent) => {
  if (event.pointerType !== "mouse") return;
  const card = event.currentTarget as HTMLElement;
  const r = card.getBoundingClientRect();
  const px = (event.clientX - r.left) / r.width - 0.5;
  const py = (event.clientY - r.top) / r.height - 0.5;
  card.style.setProperty("--ry", `${(px * 11).toFixed(2)}deg`);
  card.style.setProperty("--rx", `${(-py * 9).toFixed(2)}deg`);
  card.style.setProperty("--mx", `${((px + 0.5) * 100).toFixed(1)}%`);
  card.style.setProperty("--my", `${((py + 0.5) * 100).toFixed(1)}%`);
};

const rest = (event: PointerEvent) => {
  const card = event.currentTarget as HTMLElement;
  card.style.setProperty("--ry", "0deg");
  card.style.setProperty("--rx", "0deg");
};

/* ---------------------------------------------------------- the clocks */

/** How much of the section's scroll is the row's travel: all of it but the exit. */
const travelSpan = () => {
  const el = root.value;
  if (!el) return 1;
  // The last fourteen hundredths of a screen are where the next section
  // fades in over this one; the row has finished moving before it starts.
  return Math.max(1, el.offsetHeight - window.innerHeight * 1.14);
};

onMounted(() => {
  layout();
  window.addEventListener("resize", layout);
  ScrollTrigger.addEventListener("refresh", layout);
  if (reduced || !root.value) return;

  travelTrigger = ScrollTrigger.create({
    trigger: root.value,
    start: "top top",
    end: () => `+=${travelSpan()}`,
    scrub: 0.9,
    invalidateOnRefresh: true,
    onUpdate: (self) => { travel = self.progress; render(); },
  });

  arrivalTrigger = ScrollTrigger.create({
    trigger: root.value,
    start: "top 92%",
    end: "top 12%",
    scrub: 0.9,
    invalidateOnRefresh: true,
    onUpdate: (self) => { arrival = self.progress; render(); },
  });
});

onBeforeUnmount(() => {
  travelTrigger?.kill();
  arrivalTrigger?.kill();
  window.removeEventListener("resize", layout);
  ScrollTrigger.removeEventListener("refresh", layout);
});
</script>

<template>
  <section id="centre" ref="root" class="ce">
    <div class="ce__stage">
      <div class="ce__wash ground-drift" aria-hidden="true" />

      <div class="ce__words">
        <p v-reveal class="ce__eyebrow reveal">The YOOJ Primary Care Centre</p>

        <h2 class="ce__title">
          <span v-reveal="80" class="reveal-line">
            <span>One roof. <strong>Four services.</strong></span>
          </span>
        </h2>

        <p v-reveal="180" class="ce__body reveal">
          <span>A standardised, brand-owned Primary Care Centre for Tier 3 India the flagship</span>
          <span>of every YOOJ cluster, and the anchor the affiliate network plugs into.</span>
        </p>
      </div>

      <div ref="gallery" class="ce__gallery">
        <ul ref="row" class="ce__row" aria-label="The four YOOJ services">
          <li
            v-for="(service, i) in services"
            :key="service.key"
            ref="slots"
            class="ce__slot"
            :style="{ '--i': i }"
          >
            <div class="ce__float">
              <p class="ce__index" aria-hidden="true">
                <span>{{ String(i + 1).padStart(2, "0") }}</span>
              </p>
              <figure class="ce__card" @pointermove="lean" @pointerleave="rest">
                <img
                  class="ce__img"
                  :src="`/centre/cards/${service.key}.webp`"
                  :alt="`${service.name}: ${service.note}`"
                  width="405"
                  height="576"
                  decoding="async"
                  draggable="false"
                >
                <span class="ce__sheen" aria-hidden="true" />
              </figure>
            </div>
          </li>
        </ul>

        <div class="ce__rule" aria-hidden="true"><i ref="fill" /></div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;

/**
 * The stage, the row's travel, and the exit.
 *
 * One screen held while the row makes its one card of travel, and then the
 * fourteen hundredths of a screen the next section fades in over. The travel
 * is stated in scroll units, so on a phone - where the row makes three cards
 * of travel rather than one - it is longer, and where the page is shortened
 * for the thumb it is shortened with it.
 */
.ce {
  --travel: 110;

  position: relative;
  height: calc(var(--vh, 1vh) * 114 + var(--sv) * var(--travel));
}

.ce__stage {
  /**
   * The design's frame is 918 x 662; `--u` is one of its pixels at the scale
   * that fits the whole of it on the screen, and the words are set in it so
   * they keep the design's rhythm at any size.
   */
  --u: min(calc(100vw / 918), calc(var(--vh, 1vh) * 100 / 662));

  position: sticky;
  top: 0;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  isolation: isolate;
  background: var(--ga-bg);
}

// The site's light ground, drifting - the Frontier section's own, in step.
.ce__wash {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--ground-light);
  // Beside the shorthand, which resets it, and not in the drift class.
  background-size: 190% 190%;
}

/* -------------------------------------------------------------- the words */

.ce__words {
  position: relative;
  z-index: 1;
  flex: none;
  padding: calc(var(--vh, 1vh) * 9) var(--gutter) 0;
  text-align: center;
}

.ce__eyebrow {
  position: relative;
  font-family: var(--font-say);
  font-weight: 400;
  font-size: max(11px, calc(20.2 * var(--u)));
  line-height: 1;
  text-transform: uppercase;
  color: #000000;

  // The thread, down from the top of the screen to just over the word.
  &::before {
    content: "";
    position: absolute;
    left: calc(50% + 6 * var(--u));
    bottom: calc(100% + 4.6 * var(--u));
    width: 1px;
    height: 200vh;
    background: rgb(var(--rgb-ink) / 0.2);
  }
}

.ce__title {
  // Clear of the eyebrow: at the design's 9 the two read as one crowded
  // block.
  margin-top: calc(18 * var(--u));
  font-family: var(--font-say);
  font-weight: 300;
  font-size: calc(45.5 * var(--u));
  line-height: 1;
  color: var(--c-wine);

  strong { font-weight: 700; }

  // The mask needs room for descenders the line-height-1 box does not give.
  .reveal-line {
    padding-bottom: 0.14em;
    margin-bottom: -0.14em;
  }
}

.ce__body {
  margin-top: calc(23 * var(--u));
  font-family: var(--font-say);
  font-weight: 400;
  font-size: max(11px, calc(17.8 * var(--u)));
  line-height: max(14px, calc(21.5 * var(--u)));
  color: #121212;

  span { display: block; }
}

/* ------------------------------------------------------------ the gallery */

// Whatever height the words leave, less a margin top and foot. The script
// sizes the cards from this box, so it is the only thing that has to be right.
.ce__gallery {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  margin: calc(var(--vh, 1vh) * 4.5) 0 calc(var(--vh, 1vh) * 5.5);
}

.ce__row {
  position: absolute;
  left: 0;
  top: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  will-change: transform;
}

.ce__slot {
  position: absolute;
  left: calc(var(--i) * var(--step));
  top: var(--top);
  width: var(--w);
  opacity: 0;
  transform-origin: 50% 80%;
}

// A slow breath of its own, a little out of step with its neighbours.
.ce__float {
  animation: ce-breathe 7.5s var(--e-in-out-quad) infinite alternate;
  animation-delay: calc(var(--i) * -1.9s);
}

@keyframes ce-breathe {
  from { transform: translate3d(0, -0.4rem, 0); }
  to   { transform: translate3d(0, 0.4rem, 0); }
}

// The number over each card, with a rule that runs out from it.
.ce__index {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  height: 34px;
  padding-left: 0.15rem;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  color: var(--c-accent-dim);

  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: linear-gradient(to right, rgb(var(--rgb-action) / 0.32), rgb(var(--rgb-action) / 0));
    transform: scaleX(0.35);
    transform-origin: left center;
    transition: transform 0.9s var(--e-out-expo);
  }
}

@include hover {
  .ce__slot:hover .ce__index::after { transform: none; }
}

/**
 * The card.
 *
 * Floating is a matter of the shadow: long, wide and faint, pulled in at the
 * edges, so no card has a hard base and nothing ever joins them into a tray.
 * The tilt answers the pointer quickly and settles slowly - a quick follow and
 * a long release is what reads as weight.
 */
.ce__card {
  --rx: 0deg;
  --ry: 0deg;
  --mx: 50%;
  --my: 30%;

  position: relative;
  margin: 0;
  width: var(--w);
  height: var(--h);
  border-radius: clamp(14px, 1.3vw, 22px);
  overflow: hidden;
  transform: perspective(1100px) rotateX(var(--rx)) rotateY(var(--ry));
  box-shadow:
    0 0.2rem 0.6rem -0.4rem rgb(var(--rgb-ink) / 0.14),
    0 2.4rem 4.2rem -2.2rem rgb(var(--rgb-ink) / 0.36);
  transition:
    transform 0.95s var(--e-out-expo),
    box-shadow 0.95s var(--e-out-expo);

  @media (hover: hover) {
    &:hover {
      transition:
        transform 0.22s var(--e-out-quart),
        box-shadow 0.6s var(--e-out-expo);
      box-shadow:
        0 0.2rem 0.6rem -0.4rem rgb(var(--rgb-ink) / 0.16),
        0 3.4rem 5.4rem -2.4rem rgb(var(--rgb-ink) / 0.46);
    }
  }
}

// A window rather than a print: a little larger than the card, and moved
// against it by the script.
.ce__img {
  display: block;
  width: 100%;
  height: 100%;
  max-width: none;
  object-fit: cover;
  transform: scale(1.14);
  user-select: none;
  -webkit-user-drag: none;
}

// The light the tilt catches, following the pointer across the print.
.ce__sheen {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at var(--mx) var(--my), rgb(255 255 255 / 0.42), rgb(255 255 255 / 0) 46%),
    linear-gradient(160deg, rgb(255 255 255 / 0.12), rgb(255 255 255 / 0) 42%);
  mix-blend-mode: soft-light;
  opacity: 0;
  transition: opacity 0.6s var(--e-out-quart);

  @include hover {
    .ce__card:hover & { opacity: 1; }
  }
}

// How far along the row the reader is: a short rule under it, centred.
.ce__rule {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: min(15rem, 34vw);
  height: 1px;
  transform: translateX(-50%);
  background: rgb(var(--rgb-ink) / 0.14);

  i {
    position: absolute;
    inset: 0;
    background: var(--c-indigo);
    transform: scaleX(0.25);
    transform-origin: left center;
  }
}

/**
 * Portrait: the words stacked over a single card at a time, and the scroll
 * carries the reader through all four. Three cards of travel rather than one,
 * so a longer stage.
 *
 * `--u` is a pixel of a 390-wide phone design. Its height term is the page a
 * browser actually shows (760), not the phone's whole screen (844), which had
 * every size here at four-fifths on a real phone - the eyebrow at ten pixels,
 * the paragraph at eleven. The type has floors besides.
 */
@include portrait {
  .ce { --travel: 190; }

  .ce__stage {
    --u: min(calc(100vw / 390), calc(var(--vh, 1vh) * 100 / 760));
  }

  .ce__eyebrow {
    font-size: max(12px, calc(13 * var(--u)));

    &::before { bottom: calc(100% + 14 * var(--u)); }
  }

  .ce__title {
    margin-top: calc(18 * var(--u));
    font-size: max(28px, calc(34 * var(--u)));
    line-height: 1.18;

    strong { display: block; }
  }

  .ce__body {
    margin-inline: auto;
    max-width: 44ch;
    margin-top: calc(16 * var(--u));
    font-size: max(13.5px, calc(14.5 * var(--u)));
    line-height: 1.5;

    span { display: inline; }
    span + span::before { content: " "; }
  }
}

// A tablet held upright shows two cards at a time (see `layout`), so the row
// has two cards of travel to make rather than three.
@include portrait {
  @media (min-width: 37.5rem) {
    .ce { --travel: 150; }
  }
}

/**
 * A phone on its side: the words in a column on the left and the gallery
 * beside them, two cards at a time. Stacked, the words took two thirds of a
 * shallow frame and the cards were sized from what was left.
 */
@include short {
  .ce { --travel: 150; }

  .ce__stage {
    flex-direction: row;
    align-items: stretch;
  }

  .ce__words {
    flex: 0 0 38%;
    align-self: center;
    padding: 3.25rem 0 1rem var(--gutter);
    text-align: left;
  }

  // The thread comes down to the middle of a centred word; beside a column
  // set flush left it would hang in the middle of nothing.
  .ce__eyebrow {
    font-size: 0.75rem;

    &::before { display: none; }
  }

  .ce__title {
    margin-top: 0.9rem;
    font-size: clamp(1.45rem, 3.6vw, 2rem);
    line-height: 1.12;

    strong { display: block; }
  }

  .ce__body {
    margin-top: 0.8rem;
    font-size: 0.8rem;
    line-height: 1.5;

    span { display: inline; }
    span + span::before { content: " "; }
  }

  // Cut at its own left edge, and only there: the row travels left, and here
  // the words stand where a card used to leave the screen. The other three
  // sides are let out so the shadows and the numbers keep their room.
  .ce__gallery {
    flex: 1;
    margin: 3.5rem 0 1.25rem;
    clip-path: inset(-6rem -6rem -6rem 0);
  }
}

/**
 * Without motion there is no travel to spend the scroll on: one screen, and
 * all four cards in it.
 */
@media (prefers-reduced-motion: reduce) {
  .ce {
    --travel: 0;
    height: calc(var(--vh, 1vh) * 114);
  }

  .ce__slot { opacity: 1; }
  .ce__float { animation: none; }
  .ce__card { transition: none; }
}
</style>
