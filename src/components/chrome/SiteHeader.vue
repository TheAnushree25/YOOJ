<script setup lang="ts">
import { computed } from "vue";
import BrandMark from "../ui/BrandMark.vue";

const props = defineProps<{
  progress: number;
  chapter: string;
  index: number;
  total: number;
  /** Stood down - for a film that has the screen to itself. */
  hidden?: boolean;
  /**
   * The wordmark alone stood down: the front page's hero sets its own YOOJ
   * in the same place, and two of them would print one over the other. It
   * comes back once the hero's has scrolled out from under it.
   */
  markHidden?: boolean;
}>();
const emit = defineEmits<{ jump: [id: string]; menu: [] }>();

const pad = (n: number) => String(n).padStart(2, "0");
const readout = computed(() => `${pad(props.index + 1)} / ${pad(props.total)}`);

// Never quite zero. At the very top the rule would otherwise be an empty
// channel, and an empty channel reads as a missing element rather than as a
// measure with nothing in it yet.
const filled = computed(() => Math.max(0.008, Math.min(1, props.progress)));
</script>

<template>
  <header class="head" :class="{ 'is-hidden': hidden }">
    <a
      class="head__mark"
      :class="{ 'is-bare': markHidden }"
      href="#top"
      data-cursor="Top"
      :tabindex="markHidden ? -1 : undefined"
      @click.prevent="emit('jump', 'top')"
    >
      <BrandMark class="head__glyph" />
      <span class="head__name">YOOJ</span>
    </a>

    <div class="head__meta">
      <!-- The rule sits above the readout, and it is the page's own progress:
           it fills left to right and is full at the foot of the document. -->
      <div class="head__bar" aria-hidden="true">
        <i :style="{ transform: `scaleX(${filled})` }" />
      </div>
      <div class="head__readout">
        <!-- Where the reader is, and the way out of it. The word that names
             the chapter is also the control that opens the menu: pointed at,
             it says so. Two words in a one-line window, the stack sliding by
             its own height — nothing cross-fades, so there is never a frame
             with both words half-struck. -->
        <button
          class="head__trigger"
          type="button"
          data-cursor="scale"
          aria-label="Open menu"
          @click="emit('menu')"
        >
          <span class="head__swap" aria-hidden="true">
            <span class="head__stack">
              <span class="head__word head__word--here">{{ chapter }}</span>
              <span class="head__word head__word--menu">Menu</span>
            </span>
          </span>
        </button>
        <span class="head__count">{{ readout }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;

.head {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 60;
  // Three tracks, so the wordmark is optically centred in the frame rather than
  // centred in whatever space the meta block leaves it. The hero used to print
  // its own copy of the mark because this one sat hard left; there is only one
  // now, and it is here.
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  gap: 1rem;
  padding: clamp(1.1rem, 2.4vw, 1.9rem) var(--gutter);
  // Clear of the status bar when the page is given the whole screen.
  padding-top: calc(clamp(1.1rem, 2.4vw, 1.9rem) + var(--safe-t));
  mix-blend-mode: difference;
  // The band is a full-width fixed bar at the top of every section, and almost
  // all of it is paint. Left clickable it silently swallowed whatever sat
  // under its box — the frontier panel's close control was unreachable on any
  // short window, because this bar's height follows the viewport's *width*
  // while that control's offset follows its *height*, so the two crossed. The
  // things in here that are actually controls take their events back.
  pointer-events: none;
  transition:
    opacity 0.8s var(--e-out-quart),
    transform 0.8s var(--e-out-quart),
    visibility 0.8s;

  // Off the screen while the film has it. Visibility goes with the opacity
  // so the controls inside cannot be pressed, or tabbed to, while unseen.
  &.is-hidden {
    opacity: 0;
    transform: translateY(-0.6rem);
    visibility: hidden;
  }
}

.head__mark {
  grid-column: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  justify-self: center;
  pointer-events: auto;
  transition: opacity 0.45s var(--e-out-quart), visibility 0.45s;

  &.is-bare {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
}

// The mark itself, at a size that still reads as a drawing rather than a dot.
// It takes the wordmark's ink and goes through the same difference blend, so
// the two are always the same colour on any ground.
.head__glyph {
  font-size: 1.05rem;
  color: var(--c-bone);
}

// Set in Montserrat, the front page's one face: the header stands over the
// hero and the perspective screen for their whole length, and those two are
// Montserrat throughout, to the letter. Semibold, because tracked capitals at
// label size go thin in the regular weight once the difference blend takes
// the ground out from under them.
.head__name {
  font-family: var(--font-say);
  font-weight: 600;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
}

.head__meta {
  grid-column: 3;
  justify-self: end;
  position: relative;
  display: grid;
  gap: clamp(0.5rem, 1vh, 0.8rem);
  justify-items: stretch;
  min-width: clamp(9rem, 18vw, 15rem);
  font-family: var(--font-say);
  font-weight: 600;
  font-size: var(--t-label);
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.head__readout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(0.7rem, 1.6vw, 1.4rem);
}

.head__trigger {
  pointer-events: auto;
  color: var(--c-bone);
  // The letter-spacing puts a trailing gap after the last character; without
  // this the word sits visibly left of where the old label did.
  text-indent: 0.02em;
}

// One line tall, and it clips. The height is set in `em` so it tracks the
// label's own size rather than a number that has to be kept in step with it.
.head__swap {
  display: block;
  overflow: hidden;
  height: 1em;
}

.head__stack {
  display: block;
  transition: transform var(--t-hover) var(--e-out-quart);
}

.head__word {
  display: block;
  height: 1em;
  line-height: 1;
  white-space: nowrap;
}

.head__word--menu { color: var(--c-accent); }

.head__trigger:focus-visible .head__stack {
  transform: translateY(-1em);
}

// A pointer's only: after a tap on a phone the word stayed swapped to "Menu"
// with the menu already closed again.
@include hover {
  .head__trigger:hover .head__stack { transform: translateY(-1em); }
}

.head__count {
  color: var(--c-bone-dim);
  font-variant-numeric: tabular-nums;
}

// Narrow frames never had room for the chapter name. The control stays —
// it is the only way into the menu — and simply reads "Menu" throughout.
@media (max-width: 40rem) {
  .head__word--here { display: none; }

  .head__trigger:hover .head__stack,
  .head__trigger:focus-visible .head__stack {
    transform: none;
  }
}

/**
 * Handheld: two tracks, not three.
 *
 * The desktop bar centres the wordmark in the frame by giving it a track of
 * its own between two equal ones. That needs the meta block to be narrower
 * than the space beside it, and on a phone it is not — its own minimum is
 * wider than the track left over, so the "centred" mark was pushed left until
 * it sat underneath the chapter word. Optical centring is a wide-frame luxury;
 * here the mark takes the left and the control takes the right, which is what
 * a phone header is anyway.
 *
 * The progress rule leaves the meta block at the same time. Stretched to a
 * few centimetres beside the menu word it read as an underline on the word;
 * across the top of the screen it reads as what it is.
 */
@media (max-width: 48rem) {
  .head {
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0.75rem;
    padding-top: calc(0.9rem + var(--safe-t));
    padding-bottom: 0.9rem;
  }

  .head__mark {
    grid-column: 1;
    justify-self: start;
    gap: 0.5rem;
  }

  .head__meta {
    grid-column: 2;
    justify-self: end;
    min-width: 0;
    gap: 0;
  }

  .head__bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    width: auto;
  }

  .head__readout {
    gap: 0.75rem;
  }
}

/**
 * Touch targets.
 *
 * The menu control measured 38 x 10 — the size of its own text. Padding takes
 * it to the 44px a finger needs, and the matching negative margin keeps the
 * word where it was drawn, so nothing moves visually.
 */
@media (pointer: coarse) {
  .head__trigger {
    min-height: 44px;
    min-width: 44px;
    padding: 0.85rem 0.6rem;
    margin: -0.85rem -0.6rem;
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
  }

  .head__mark {
    min-height: 44px;
    padding-block: 0.7rem;
    margin-block: -0.7rem;
  }
}

.head__bar {
  position: relative;
  width: 100%;
  height: 1px;
  background: var(--c-bone-faint);
  overflow: hidden;

  i {
    position: absolute;
    inset: 0;
    // Was `--c-mint`, which this project has never defined — so the fill was
    // painting an invalid colour and the rule read as a static line at every
    // scroll position. The token is `--c-accent`.
    background: var(--c-accent);
    transform-origin: left center;
    // No transition: the value already arrives eased from the scroll engine,
    // and a second easing here would make the bar lag the page visibly.
  }
}
</style>
