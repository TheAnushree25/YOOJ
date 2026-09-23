import { reactive, readonly } from "vue";

/**
 * The device classes, as the stylesheet names them (styles/_media.scss).
 *
 * The layout switches in CSS; the choreography drawn over it switches here,
 * off the same queries, so a flight path or a fade is never tuned for one
 * composition while the page is showing another.
 */
export const MEDIA = {
  phone: "(max-width: 40rem)",
  handheld: "(max-width: 60rem)",
  portrait: "(orientation: portrait)",
  short: "(orientation: landscape) and (max-height: 32rem)",
  touch: "(pointer: coarse)",
} as const;

export type DeviceClass = keyof typeof MEDIA;

const names = Object.keys(MEDIA) as DeviceClass[];

const state = reactive(
  Object.fromEntries(names.map((n) => [n, false])) as Record<DeviceClass, boolean>,
);

/**
 * One listener per query for the whole page, bound on first use. Module scope
 * for the reason the session flags are: a section and the chrome over it have
 * to agree on what device they are on.
 */
let bound = false;
const bind = () => {
  if (bound || typeof window === "undefined") return;
  bound = true;
  for (const name of names) {
    const mq = window.matchMedia(MEDIA[name]);
    state[name] = mq.matches;
    mq.addEventListener("change", (e) => { state[name] = e.matches; });
  }
};

/** The device classes, reactive: a template or computed re-runs when one flips. */
export function useViewport() {
  bind();
  return readonly(state);
}

/** Read now, for code that runs per frame rather than per render. */
export const isDevice = (name: DeviceClass) => {
  bind();
  return state[name];
};
