<script setup lang="ts">
import SplitHeading from "../SplitHeading.vue";
const emit = defineEmits<{ jump: [id: string] }>();

const nav = [
  { id: "frontier", label: "Frontier work" },
  { id: "tenets", label: "Principles" },
  { id: "approach", label: "Approach" },
  { id: "principles", label: "Principles" },
  { id: "engine", label: "Tideline" },
];

const year = new Date().getFullYear();
</script>

<template>
  <footer id="contact" class="section footer">
    <div class="wrap footer__grid">
      <div class="footer__cta">
        <SplitHeading
          as="p"
          class="label"
          mode="chars"
          :lines="['Get in touch']"
          :rise="14"
        />
        <h2 v-reveal="80" class="display footer__h">
          <span class="reveal-line"><span>Build the</span></span>
          <span class="reveal-line"><span>quiet part</span></span>
        </h2>
        <div v-reveal="200" class="footer__actions">
          <a class="btn btn--solid" href="mailto:hello@halcyon.example" data-cursor="Email">Start a conversation</a>
          <a class="btn" href="#top" data-cursor="Top" @click.prevent="emit('jump', 'top')">Back to top</a>
        </div>
      </div>

      <nav v-reveal="120" class="footer__nav" aria-label="Sections">
        <a v-for="n in nav" :key="n.id" :href="`#${n.id}`" @click.prevent="emit('jump', n.id)">{{ n.label }}</a>
      </nav>
    </div>

    <div class="wrap footer__base">
      <span>&copy; {{ year }} Halcyon Labs</span>
      <span class="footer__disclaimer">
        A design and engineering demonstration. Not a medical device, and not
        a source of clinical advice.
      </span>
    </div>
  </footer>
</template>

<style scoped lang="scss">
.footer {
  min-height: 100vh;
  min-height: calc(var(--vh, 1vh) * 100);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: clamp(3rem, 10vh, 6rem);
  padding-bottom: clamp(4.5rem, 10vh, 6rem);
}

.footer__grid {
  display: grid;
  gap: clamp(2.4rem, 6vw, 4rem);
  align-items: end;

  @media (min-width: 62rem) { grid-template-columns: minmax(0, 1fr) auto; }
}

.footer__cta { display: grid; gap: clamp(1rem, 2.6vh, 1.7rem); justify-items: start; }
.footer__h { max-width: 10ch; }

.footer__actions { display: flex; flex-wrap: wrap; gap: 0.8rem; margin-top: 0.7rem; }

.btn {
  display: inline-flex;
  align-items: center;
  padding: 0.85rem 1.5rem;
  border: 1px solid var(--c-bone-faint);
  border-radius: 999px;
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  transition: border-color 0.5s var(--e-out-quart), background-color 0.5s var(--e-out-quart), color 0.5s var(--e-out-quart);

  &:hover { border-color: var(--c-mint); background: rgba(127, 209, 185, 0.08); }

  &--solid {
    background: var(--c-mint);
    border-color: var(--c-mint);
    color: var(--c-ink);
    &:hover { background: var(--c-bone); border-color: var(--c-bone); }
  }
}

.footer__nav {
  display: grid;
  gap: 0.55rem;
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;

  a {
    color: var(--c-bone-dim);
    transition: color 0.4s var(--e-out-quart);
    &:hover { color: var(--c-mint); }
  }
}

.footer__base {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem 2rem;
  justify-content: space-between;
  padding-top: clamp(1.4rem, 4vh, 2.2rem);
  border-top: 1px solid var(--c-line);
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: var(--c-bone-dim);
}

.footer__disclaimer { max-width: 44ch; text-transform: none; letter-spacing: 0.02em; }
</style>
