/**
 * Keeping the deck on the screen it was sent to.
 *
 * Stated plainly, so nobody mistakes this for more than it is: a browser
 * belongs to the person using it. The deck's real protection is that it is
 * never sent anything worth taking - no PDF, no text, no clean image; every
 * slide arrives with the reader's address already burnt into its pixels (see
 * server/deck/watermark.ts).
 *
 * This is the courtesy layer on top. It takes the easy routes away:
 *
 * - the context menu, and with it "Inspect" and "Save image as";
 * - the inspector's shortcuts, view-source, save and print;
 * - selecting, copying and dragging anything outside a text field;
 * - printing, which comes out blank.
 *
 * Active only while the deck is mounted; `stop()` gives the rest of the site
 * back exactly as it was.
 */
export interface Guard {
  stop(): void;
}

const inField = (target: EventTarget | null) =>
  target instanceof HTMLElement
  && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA");

/** With Ctrl+Shift, or Cmd+Option on a Mac: the inspector, console, picker, network and view-source. */
const INSPECTOR_KEYS = new Set(["KeyI", "KeyJ", "KeyC", "KeyK", "KeyE", "KeyM", "KeyU"]);

const forbidden = (e: KeyboardEvent) => {
  if (e.key === "F12" || e.code === "F12") return true;
  if (!(e.ctrlKey || e.metaKey)) return false;
  if ((e.shiftKey || e.altKey) && INSPECTOR_KEYS.has(e.code)) return true;
  // View source, save the page, print it.
  if (e.code === "KeyU" || e.code === "KeyS" || e.code === "KeyP") return true;
  // Select-all and copy, anywhere but the email field.
  return (e.code === "KeyA" || e.code === "KeyC" || e.code === "KeyX") && !inField(e.target);
};

export const guardDeck = (): Guard => {
  // Development only: VITE_DECK_GUARD=off in .env.local, to work on the page
  // with the usual shortcuts. A production build ignores it.
  if (import.meta.env.DEV && import.meta.env.VITE_DECK_GUARD === "off") return { stop() {} };

  const undo: (() => void)[] = [];
  const listen = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void) => {
    window.addEventListener(type, fn, { capture: true });
    undo.push(() => window.removeEventListener(type, fn, { capture: true }));
  };
  const refuse = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };

  listen("contextmenu", refuse);
  listen("keydown", (e) => { if (forbidden(e)) refuse(e); });
  listen("copy", (e) => { if (!inField(e.target)) refuse(e); });
  listen("cut", (e) => { if (!inField(e.target)) refuse(e); });
  listen("dragstart", refuse);
  listen("selectstart", (e) => { if (!inField(e.target)) e.preventDefault(); });

  const blank = document.createElement("style");
  blank.textContent = "@media print { html { display: none !important; } }";
  document.head.appendChild(blank);
  undo.push(() => blank.remove());

  return {
    stop() {
      undo.splice(0).forEach((fn) => fn());
    },
  };
};
