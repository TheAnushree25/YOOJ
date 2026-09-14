/**
 * Run something once the page has had a chance to paint.
 *
 * A route change is one task: the old page unmounts, the new one mounts, and
 * every `onMounted` runs — all before the browser draws a single frame of the
 * new page. Three WebGL contexts and seven shader programs were being built
 * inside that task, which is why pressing the link froze the old page for
 * over a second and then cut to the new one. Building them here instead lets
 * the new page appear at once, with the scenes arriving a frame or two behind
 * it, which the eye reads as the page loading rather than the site hanging.
 *
 * A frame, then a task: `requestAnimationFrame` fires just before the next
 * paint, and the `setTimeout` inside it lands just after — so `fn` runs with
 * the frame already on screen. The second timer is for the case where no
 * frame is coming: a tab in the background never fires rAF, and without this
 * its scenes would never be built at all.
 *
 * `order` staggers callers by whole frames, so three heavy constructions do
 * not all land in the same task and recreate the freeze one paint later.
 */
export const afterPaint = (fn: () => void, order = 0) => {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    fn();
  };

  let frames = order + 1;
  const onFrame = () => {
    if (--frames > 0) { requestAnimationFrame(onFrame); return; }
    setTimeout(run, 0);
  };
  requestAnimationFrame(onFrame);

  setTimeout(run, 120 + order * 40);
};
