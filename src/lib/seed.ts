/**
 * The seed figure: eight rings around a ninth.
 *
 * The mark a reader meets on the gate before the site begins, and again where
 * the second section turns. It lives here rather than in either component
 * because the two are supposed to be the same figure — copied into both, the
 * numbers drift the first time one of them is adjusted, and the rhyme the page
 * is built on quietly stops rhyming.
 *
 * The offsets are measured rather than derived, which is why the orthogonal
 * four sit further out (205, 213) than the diagonal four (122, 120). A true
 * circle of centres would place the diagonals at 145; these do not, and the
 * difference is what makes the figure read as a squared rosette rather than as
 * a daisy. The pattern's bounding box is exactly the field, so a view box of
 * `0 0 w h` needs no padding of its own.
 */
export const SEED_FIELD = { w: 672, h: 655, cx: 336, cy: 328, r: 122 } as const;

/**
 * Offsets from the centre, in view-box units, in the order they open.
 *
 * The centre is first and stays put; every ring is drawn at the centre and
 * carried out to its place, so a component animating this only has to
 * interpolate the translate from zero.
 */
export const SEED_RINGS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, -205],
  [122, -120],
  [213, 0],
  [122, 120],
  [0, 205],
  [-122, 120],
  [-213, 0],
  [-122, -120],
] as const;

/** The weight both drawings strike the rings at. */
export const SEED_INK = 0.17;

/** The centre ring's share of the field's width, as a CSS percentage. */
export const SEED_HUB_PCT = `${((SEED_FIELD.r * 2) / SEED_FIELD.w * 100).toFixed(1)}%`;
