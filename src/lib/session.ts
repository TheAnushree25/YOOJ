import { ref } from "vue";

/**
 * Whether the reader has answered the gate.
 *
 * Module scope, not component scope: the gate belongs to the visit, not to the
 * page. Held inside a view it would replay every time the router swapped one
 * out, so arriving at a second page would put the loading screen back up on a
 * site that had already finished loading.
 */
export const entered = ref(false);

/**
 * Whether the page currently stands on a dark ground.
 *
 * Module scope for the same reason as the gate above: the ground is a fact
 * about the page, but the two sections that turn it are siblings with no way
 * to tell each other, and the header that has to stay legible on it is neither
 * of them. Scoped to a section it would be invisible to the chrome above it,
 * which is exactly where it is needed — dark ink on a dark room is not a
 * subtle bug, it is a header that is simply not there.
 */
export const onDark = ref(false);

/**
 * Whether the bottom corner of the frame is over a pale ground.
 *
 * The front page is dark with three light sections in it, and the one piece of
 * furniture that is fixed over all of them is the pulse in the corner. It
 * cannot see what is behind it; the page can, and says so here. Measured at
 * the corner rather than at the middle of the viewport, because that is where
 * the thing that needs to know is.
 */
export const onPale = ref(false);

/** Where the pulse sits, in viewport pixels: the point the ground is tested at. */
export const pulseCorner = () => ({ x: window.innerWidth - 74, y: window.innerHeight - 60 });

/**
 * Whether the solutions page's close has risen under the pulse.
 *
 * That page reports its ground as one flag, `onDark`, taken at the header. Its
 * close brings its own wine and comes up from the foot of the screen, so it is
 * under the pulse a whole viewport before it reaches the header - and for all
 * of that stretch the pulse would stand in wine ink on a wine ground.
 */
export const closeUnderPulse = ref(false);

/**
 * Whether the opening film has the screen.
 *
 * The one stretch of the visit with nothing to read and nothing to press: the
 * header, the pulse and the scroll hint all stand down for it. They are three
 * components in three places with no other way to hear that a fourth has
 * taken the screen, so the film says so here and each of them reads it.
 */
export const cinema = ref(false);
