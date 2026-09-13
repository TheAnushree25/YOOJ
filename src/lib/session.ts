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
