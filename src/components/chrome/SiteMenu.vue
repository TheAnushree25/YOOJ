<script setup lang="ts">
import { onBeforeUnmount, nextTick, ref, watch } from "vue";
import { useRoute } from "vue-router";
import ActionButton from "../ui/ActionButton.vue";

/**
 * The site's menu: two pages, three ways to reach us, one thing to do.
 *
 * It opens from the readout in the top right — the word that names the chapter
 * is the control, and pointed at it says "Menu". The panel comes in from that
 * side so it reads as the control opening rather than as a dialog arriving
 * from nowhere.
 *
 * Light ground on a dark site, deliberately: the two places this panel can
 * take you are the front page and the solutions page, and the solutions page
 * is light. The menu is the hinge between them and is lit like the destination.
 */
const props = withDefaults(defineProps<{
  open: boolean;
  /** Where "Invest with us" goes on the page that mounted this. */
  contactHref?: string;
}>(), { contactHref: "#contact" });

const emit = defineEmits<{ close: [] }>();

const route = useRoute();
const panel = ref<HTMLElement | null>(null);
const closeBtn = ref<HTMLButtonElement | null>(null);

const pages = [
  { label: "Vision", to: "/" },
  { label: "Solution", to: "/solutions" },
];

const reach = [
  { label: "Twitter", href: "#" },
  { label: "LinkedIn", href: "#" },
  { label: "Email", href: "mailto:hello@yooj.example" },
];

/**
 * The page you are already on is the quiet one.
 *
 * Both words are links either way — the panel is a map, and a map that hides
 * where you are standing is harder to read, not easier.
 */
const isHere = (to: string) =>
  to === "/" ? route.path === "/" : route.path.startsWith(to);

/**
 * Escape and Tab are handled on the window, not on the panel.
 *
 * Bound to the panel they only fire once focus is already inside it, which is
 * precisely the case a keyboard reader cannot get themselves into if anything
 * has gone wrong with the focus move below — Escape then does nothing and the
 * menu is a trap. The window always hears the key.
 */
const onKeydown = (e: KeyboardEvent) => {
  if (!props.open) return;
  if (e.key === "Escape") { emit("close"); return; }
  if (e.key !== "Tab" || !panel.value) return;

  const focusable = panel.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  // Focus outside the panel while it is open — the first Tab after opening,
  // if the move below lost the race — is pulled back in rather than left to
  // walk the page behind.
  if (!panel.value.contains(active)) { e.preventDefault(); first.focus(); return; }
  if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
};

/** Where focus was when the menu opened, so it can be handed back. */
let restoreTo: HTMLElement | null = null;

watch(() => props.open, async (open) => {
  if (open) {
    restoreTo = document.activeElement as HTMLElement | null;
    window.addEventListener("keydown", onKeydown);
    await nextTick();
    /**
     * The style has to be live before the focus, not merely queued.
     *
     * The container carries `visibility: hidden` until the open class lands,
     * and `focus()` inside a hidden subtree is silently ignored — so focusing
     * on nextTick alone left the keyboard parked on the trigger behind the
     * scrim. Reading a layout property forces the pending style and layout to
     * be resolved, which is what makes the button focusable.
     *
     * Deliberately not a requestAnimationFrame hop, which is the more usual
     * way to write this: rAF does not run in a background tab, so that version
     * worked on screen and silently did nothing anywhere else.
     */
    void panel.value?.offsetHeight;
    if (props.open) closeBtn.value?.focus();
  } else {
    window.removeEventListener("keydown", onKeydown);
    restoreTo?.focus();
    restoreTo = null;
  }
});

onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <div class="mn" :class="{ 'is-open': open }" :aria-hidden="!open">
      <!-- The page dims behind it and is clickable to dismiss, which is the
           gesture most readers try first. -->
      <div class="mn__scrim" @click="emit('close')" />

      <div
        ref="panel"
        class="mn__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
      >
        <button
          ref="closeBtn"
          class="mn__close"
          type="button"
          data-cursor="scale"
          :tabindex="open ? 0 : -1"
          @click="emit('close')"
        >
          Close
          <span aria-hidden="true">&rarr;</span>
        </button>

        <nav class="mn__nav" aria-label="Pages">
          <RouterLink
            v-for="page in pages"
            :key="page.to"
            class="mn__link"
            :class="{ 'is-here': isHere(page.to) }"
            :to="page.to"
            :tabindex="open ? 0 : -1"
            :aria-current="isHere(page.to) ? 'page' : undefined"
            data-cursor="scale"
            @click="emit('close')"
          >
            {{ page.label }}
          </RouterLink>
        </nav>

        <ul class="mn__reach">
          <li v-for="item in reach" :key="item.label">
            <a :href="item.href" :tabindex="open ? 0 : -1" data-cursor="scale">{{ item.label }}</a>
          </li>
        </ul>

        <div class="mn__act">
          <ActionButton
            label="Invest with us"
            variant="solid"
            :href="props.contactHref"
            @activate="emit('close')"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.mn {
  position: fixed;
  inset: 0;
  // Above the header, which is the one thing on the page fixed over everything
  // else, and above the gate's own layer is not needed — the gate is answered
  // before there is a menu to open.
  z-index: 90;
  pointer-events: none;
  visibility: hidden;
  /**
   * Hidden only once the panel has finished sliding out — and shown the
   * instant it is asked for.
   *
   * Written as `transition: visibility 0.75s` this was interpolated rather
   * than switched, so the panel was not actually visible until the transition
   * clock had run. Chrome does not advance that clock in a background tab, so
   * a menu opened there stayed invisible and unfocusable: the close button
   * could not take focus and the keyboard was left behind the scrim. A zero
   * duration with a delay on the way out has the same look and no clock in the
   * path of it being usable.
   */
  transition: visibility 0s linear 0.75s;

  &.is-open {
    pointer-events: auto;
    visibility: visible;
    transition-delay: 0s;
  }
}

.mn__scrim {
  position: absolute;
  inset: 0;
  background: rgb(var(--rgb-ink) / 0.5);
  backdrop-filter: blur(3px);
  opacity: 0;
  transition: opacity 0.75s var(--e-out-quart);

  .mn.is-open & { opacity: 1; }
}

// Comes in from the right, under the readout it was opened from. Tall enough
// to hold its content and no taller: on a short window the panel scrolls
// rather than pushing the action off the bottom of the frame.
.mn__panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(34rem, 100vw);
  display: grid;
  align-content: center;
  gap: clamp(1.6rem, 4.5vh, 3rem);
  padding: clamp(5rem, 13vh, 8rem) clamp(1.75rem, 4vw, 3.75rem);
  overflow-y: auto;
  background: linear-gradient(200deg, #FFFFFF 0%, #FFF5F6 58%, #FEE0E2 100%);
  box-shadow: -2rem 0 5rem rgb(var(--rgb-ink) / 0.28);
  transform: translate3d(101%, 0, 0);
  transition: transform 0.85s var(--e-out-expo);
  will-change: transform;

  .mn.is-open & { transform: translate3d(0, 0, 0); }
}

// Above the panel's own content and clear of the fixed header band, exactly as
// the frontier panel's close sits.
.mn__close {
  position: absolute;
  top: clamp(1.75rem, 5vh, 3rem);
  left: clamp(1.75rem, 4vw, 3.75rem);
  display: inline-flex;
  align-items: center;
  gap: 0.8em;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: var(--c-indigo);
  transition: gap var(--t-hover) var(--e-out-quart), color var(--t-hover) var(--e-out-quart);

  &:hover { gap: 1.4em; color: var(--c-accent-dim); }
}

.mn__nav {
  display: grid;
  gap: 0.1em;
}

.mn__link {
  font-size: var(--t-h1);
  font-weight: 250;
  line-height: 1.04;
  letter-spacing: -0.03em;
  color: var(--c-indigo);
  transition: color var(--t-hover) var(--e-out-quart), transform var(--t-hover) var(--e-out-quart);
  transform-origin: left center;

  // The page you are on already. It stays a link and answers the pointer like
  // one; it simply does not compete with the page you are not on.
  &.is-here { color: rgb(158 18 53 / 0.42); }

  &:hover {
    color: var(--c-indigo);
    transform: translateX(0.12em);
  }
}

.mn__reach {
  display: grid;
  gap: 0.55em;
  margin: 0;
  padding: 0;
  list-style: none;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;

  a {
    color: var(--c-accent-dim);
    transition: color var(--t-hover) var(--e-out-quart);
    &:hover { color: var(--c-indigo); }
  }
}

.mn__act {
  margin-top: clamp(0.5rem, 2vh, 1.25rem);
  justify-self: start;
}

// The panel's own control borrows the dark-ground button and has to be read on
// a light one, so its hairline is restated against the ink here.
.mn__act :deep(.act) { border-color: rgb(var(--rgb-ink) / 0.16); }

@media (prefers-reduced-motion: reduce) {
  .mn__panel,
  .mn__scrim { transition-duration: 0.01ms; }
}
</style>
