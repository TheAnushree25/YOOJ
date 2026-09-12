<script setup lang="ts">
import ActionButton from "../ui/ActionButton.vue";

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
 */

const emit = defineEmits<{ jump: [id: string] }>();

const title = ["Begin the", "work of a", "steadier mind"];

const nav = [
  { id: "reconnect", label: "Reconnecting" },
  { id: "frontier", label: "Frontier work" },
  { id: "tenets", label: "Principles" },
];

const reach = [
  { label: "Email", href: "mailto:hello@halcyon.example" },
  { label: "LinkedIn", href: "#" },
  { label: "Press", href: "#" },
];

const year = new Date().getFullYear();
</script>

<template>
  <footer id="contact" class="cl">
    <div class="cl__wash" aria-hidden="true" />

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
          <ActionButton label="Partner with us" href="mailto:hello@halcyon.example" variant="solid" />
          <ActionButton label="Start your journey" href="#top" @activate="emit('jump', 'top')" />
        </div>
      </div>

      <div class="cl__ways">
        <nav v-reveal="160" class="cl__nav" aria-label="Sections">
          <a
            v-for="n in nav"
            :key="n.id"
            :href="`#${n.id}`"
            data-cursor="scale"
            @click.prevent="emit('jump', n.id)"
          >{{ n.label }}</a>
        </nav>

        <ul v-reveal="260" class="cl__reach">
          <li v-for="r in reach" :key="r.label">
            <a :href="r.href" data-cursor="scale">{{ r.label }}</a>
          </li>
        </ul>
      </div>
    </div>

    <div class="cl__base">
      <p>&copy; {{ year }} Halcyon Labs — a design and engineering demonstration, not a medical device.</p>
      <p class="cl__credit">Built in the open</p>
    </div>
  </footer>
</template>

<style scoped lang="scss">
.cl {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: grid;
  grid-template-rows: 1fr auto;
  min-height: 100vh;
  min-height: calc(var(--vh, 1vh) * 100);
  padding: clamp(6rem, 16vh, 11rem) 0 clamp(1.6rem, 4vh, 2.6rem);
}

// Deep in the top-left corner, opening to cyan across the upper right and
// again, more softly, low on the right — two lights rather than one ramp, which
// is what keeps a dark full-screen panel from reading as flat.
.cl__wash {
  // Translucent on purpose. The dark ground of this page is the shared
  // ShaderGradient field behind every section, not a gradient painted here —
  // these layers only shape the light falling across it. Given an opaque base
  // they would hide the field completely and the site would have a running
  // WebGL layer nobody ever sees.
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    // The header is fixed and blends with difference, which turns white type
    // over open cyan into an unreadable dark red. The section is exactly one
    // viewport and sits at the end of the document, so the header can only ever
    // overlap this top strip — darkening it here is enough.
    linear-gradient(180deg, rgb(var(--rgb-void) / 0.8) 0%, rgb(var(--rgb-void) / 0.42) 8%, transparent 19%),
    radial-gradient(44% 52% at 92% 14%, rgb(var(--rgb-accent) / 0.92) 0%, rgb(var(--rgb-accent) / 0.34) 40%, transparent 74%),
    radial-gradient(46% 40% at 88% 92%, rgb(var(--rgb-accent) / 0.34) 0%, transparent 72%),
    radial-gradient(56% 46% at -6% 2%, #080105 0%, transparent 68%),
    linear-gradient(116deg, rgb(var(--rgb-ink) / 0.62) 4%, rgb(var(--rgb-deep) / 0.34) 40%, transparent 86%);
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

  @media (min-width: 60rem) { grid-column: 3; }
}

.cl__nav {
  display: grid;
  gap: 0.1em;

  a {
    font-size: var(--t-h3);
    line-height: 1.28;
    font-weight: 250;
    letter-spacing: -0.014em;
    color: var(--c-bone-dim);
    transition: color var(--t-hover) var(--e-out-quart);

    &:first-child { color: var(--c-bone); }
    &:hover { color: var(--c-accent); }
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

    &:hover { color: var(--c-accent); }
  }
}

.cl__base {
  position: relative;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.8rem clamp(1rem, 4vw, 3rem);
  padding: clamp(3rem, 9vh, 6rem) var(--gutter) 0;
  font-size: var(--t-body);
  color: rgb(var(--rgb-bone) / 0.52);

  // On the same two axes as everything above: the legal line on the page's left
  // gutter, the credit starting where the ways out start. It also keeps the
  // credit out of the bottom-right corner, which belongs to the sound control —
  // flush right, the two sat on top of each other.
  @media (min-width: 60rem) {
    display: grid;
    grid-template-columns: 71% minmax(0, 1fr);
    align-items: baseline;
    padding-inline: 0 var(--gutter);

    > :first-child { padding-left: var(--gutter); }
  }
}

.cl__credit {
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
}
</style>
