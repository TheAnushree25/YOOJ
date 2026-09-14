<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { onDark, onPale } from "../../lib/session";

/**
 * The pulse. One circle, bottom right, on every page and every section.
 *
 * A cardiac trace, and a beat. The trace is drawn twice — a dim complete line
 * and a short lit run travelling it on a dash offset, which is how a monitor
 * actually reads: the signal is always there, the sweep is what moves. The
 * beat is everything else: the ring thumps twice on a long rest, a bloom
 * behind the trace brightens on the thump, and a ring lets go of the circle
 * and fades out — a heartbeat is two beats and a wait, and anything evenly
 * periodic reads as a blinking indicator.
 *
 * The rest of the circle is the reference's: a hairline, open, with a short
 * arc walking round it. No filled disc. The ground is now one of exactly two
 * gradients, both of which this is legible on if it changes ink.
 *
 * It also carries the ambience, because the reference puts exactly one control
 * in this corner and two stacked circles is one more than the composition has
 * room for. The pulse runs whether the sound is on or not; switching it on
 * only brightens what is already moving.
 */

const route = useRoute();

// Each page reports its ground its own way: the second page is pale unless a
// section has turned the room dark, and the front page says which sections
// are light and measures which one is under this corner.
const paleGround = computed(() => (route.name === "solutions" ? !onDark.value : onPale.value));

/* ------------------------------------------------------------- the ambience */

// Synthesised rather than streamed: two detuned oscillators through a slow
// filter sweep. No audio file to ship, nothing to license, and it starts
// silent because a page that makes noise unasked is a page people close.
const on = ref(false);
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

const build = () => {
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  filter.Q.value = 0.7;
  filter.connect(master);

  for (const [freq, detune] of [[110, -6], [110, 7], [164.81, 3]] as const) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    osc.connect(g).connect(filter);
    osc.start();
  }

  // A slow LFO on the cutoff so the pad drifts instead of droning.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.045;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();
};

const toggle = async () => {
  if (!ctx) build();
  if (ctx!.state === "suspended") await ctx!.resume();
  on.value = !on.value;
  const now = ctx!.currentTime;
  master!.gain.cancelScheduledValues(now);
  master!.gain.setTargetAtTime(on.value ? 0.06 : 0, now, 0.8);
};

const title = computed(() => (on.value ? "Mute ambience" : "Play ambience"));

const TRACE = "M1 12 H13 L15.5 12 L18 3 L21.5 21 L24.5 8.5 L26.5 12 H33 L35 9 L37 12 H47";
</script>

<template>
  <button
    class="pulse"
    :class="{ 'is-on': on, 'is-pale': paleGround }"
    :aria-label="title"
    :data-cursor="on ? 'Mute' : 'Sound'"
    @click="toggle"
  >
    <!-- Two rings let go per beat, a moment apart: the double thump. -->
    <span class="pulse__wave" aria-hidden="true" />
    <span class="pulse__wave pulse__wave--late" aria-hidden="true" />

    <!-- The bloom behind the trace, which brightens on the thump. -->
    <span class="pulse__bloom" aria-hidden="true" />

    <!-- The circle: a hairline, and a short arc walking round it. -->
    <svg class="pulse__ring" viewBox="0 0 64 64" aria-hidden="true">
      <circle class="pulse__rail" cx="32" cy="32" r="31" />
      <circle class="pulse__arc" cx="32" cy="32" r="31" />
    </svg>

    <svg class="pulse__trace" viewBox="0 0 48 24" aria-hidden="true">
      <path class="pulse__base" :d="TRACE" />
      <path class="pulse__lit" :d="TRACE" />
    </svg>
  </button>
</template>

<style scoped lang="scss">
// One period for everything. The thump, the bloom, the sweep and the rings are
// all cut to it, so the corner reads as one heartbeat rather than four
// animations that happen to share a button.
$beat: 2.4s;

.pulse {
  position: fixed;
  right: var(--gutter);
  bottom: clamp(1.1rem, 2.6vw, 1.9rem);
  z-index: 60;
  display: grid;
  place-items: center;
  width: 3.75rem;
  height: 3.75rem;
  border: 0;
  border-radius: 50%;
  background: none;
  // The ink and the light, for a dark ground: bone, and the rose the ground
  // is lit with.
  --ink: #FFF5F6;
  --glow: #FEB3B8;
  color: var(--ink);
  isolation: isolate;
  animation: pulse-thump $beat var(--e-out-quart) infinite;

  > * { grid-area: 1 / 1; }
}

// On the pale ground the ink is the page's wine and the light is the deeper
// wine the dots are set in — the same relationship, the other way up.
.pulse.is-pale {
  --ink: #3C010E;
  --glow: #9E1235;
}

.pulse__ring {
  width: 100%;
  height: 100%;
  overflow: visible;
  // The arc walks round on its own, slowly, and never in step with the beat.
  animation: pulse-orbit 11s linear infinite;

  circle {
    fill: none;
    stroke: var(--ink);
    vector-effect: non-scaling-stroke;
  }
}

.pulse__rail {
  stroke-width: 1;
  opacity: 0.32;
}

.pulse__arc {
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-dasharray: 26 200;
  opacity: 0.9;
}

// A soft disc of the light colour, mostly off, up on the thump.
.pulse__bloom {
  width: 62%;
  height: 62%;
  border-radius: 50%;
  background: radial-gradient(circle, var(--glow) 0%, transparent 70%);
  opacity: 0.18;
  animation: pulse-bloom $beat var(--e-out-quart) infinite;
  pointer-events: none;
}

.pulse__trace {
  width: 1.95rem;
  overflow: visible;
  z-index: 1;

  path {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
}

// The signal, always present and always dim.
.pulse__base {
  stroke: var(--ink);
  stroke-width: 1.3;
  opacity: 0.34;
}

// The sweep. A short lit run travelling the length of the trace on a dash
// offset, with a glow of its own colour — 110 comfortably exceeds the path, so
// the gap is never seen. Timed so the lit run crosses the spike on the thump.
.pulse__lit {
  stroke: var(--ink);
  stroke-width: 1.8;
  stroke-dasharray: 14 110;
  stroke-dashoffset: 110;
  filter: drop-shadow(0 0 4px var(--glow)) drop-shadow(0 0 1px var(--ink));
  animation: pulse-sweep $beat linear infinite;
}

// The rings that let go. Two, a moment apart.
.pulse__wave {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 1px solid var(--glow);
  opacity: 0;
  animation: pulse-wave $beat var(--e-out-quart) infinite;
  pointer-events: none;
}

.pulse__wave--late { animation-delay: 0.26s; }

.pulse.is-on {
  .pulse__base { opacity: 0.55; }
  .pulse__lit { stroke-width: 2.2; }
  .pulse__bloom { opacity: 0.32; }
}

// Two beats and a wait. The second is smaller, as it is.
@keyframes pulse-thump {
  0%, 38%, 100% { transform: scale(1); }
  5%            { transform: scale(1.07); }
  13%           { transform: scale(1); }
  19%           { transform: scale(1.04); }
}

@keyframes pulse-bloom {
  0%, 40%, 100% { opacity: 0.18; transform: scale(1); }
  5%            { opacity: 0.7;  transform: scale(1.25); }
  13%           { opacity: 0.22; transform: scale(1); }
  19%           { opacity: 0.5;  transform: scale(1.15); }
}

@keyframes pulse-wave {
  0%        { transform: scale(1);    opacity: 0.55; }
  60%, 100% { transform: scale(1.95); opacity: 0; }
}

@keyframes pulse-sweep {
  from { stroke-dashoffset: 110; }
  to   { stroke-dashoffset: -14; }
}

@keyframes pulse-orbit {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

// Still, but not absent: the trace stays drawn, and everything stops moving.
@media (prefers-reduced-motion: reduce) {
  .pulse,
  .pulse__ring,
  .pulse__bloom,
  .pulse__wave { animation: none; }

  .pulse__lit { animation: none; stroke-dasharray: none; stroke-dashoffset: 0; opacity: 0.85; }
  .pulse__wave { display: none; }
}
</style>
