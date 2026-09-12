<script setup lang="ts">
import { computed, ref } from "vue";

// An ambient bed, synthesised rather than streamed: two detuned oscillators
// through a slow filter sweep. No audio file to ship, nothing to license, and
// it starts silent because a page that makes noise unasked is a page people
// close.
const on = ref(false);
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

const bars = [0.35, 0.75, 0.5, 0.9, 0.45];

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
</script>

<template>
  <button class="sound" :class="{ 'is-on': on }" :aria-label="title" :data-cursor="on ? 'Mute' : 'Sound'" @click="toggle">
    <span class="sound__bars" aria-hidden="true">
      <i v-for="(h, i) in bars" :key="i" :style="{ '--h': h, animationDelay: `${i * 130}ms` }" />
    </span>
  </button>
</template>

<style scoped lang="scss">
.sound {
  position: fixed;
  right: var(--gutter);
  bottom: clamp(1.1rem, 2.6vw, 1.9rem);
  z-index: 60;
  display: grid;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  border: 1px solid var(--c-bone-faint);
  border-radius: 50%;
  transition: border-color 0.5s var(--e-out-quart);

  &:hover, &.is-on { border-color: var(--c-accent); }
}

.sound__bars {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 0.7rem;

  i {
    width: 1px;
    height: calc(var(--h) * 100%);
    background: var(--c-bone-dim);
    transform-origin: center;
  }
}

.sound.is-on .sound__bars i {
  background: var(--c-accent);
  animation: sound-bounce 1.1s var(--e-in-out-cubic) infinite;
}

@keyframes sound-bounce {
  0%, 100% { transform: scaleY(0.35); }
  50%      { transform: scaleY(1); }
}
</style>
