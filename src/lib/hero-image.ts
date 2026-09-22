/**
 * The hero's film: two hands reaching, meeting and holding, as a sequence of
 * stills the scroll plays through (see lib/frame-sequence and HeroSection).
 *
 * 185 frames at the film's own 1280 across, and one size for every screen. A
 * smaller set for phones was tried and dropped: a phone crops the film to the
 * clasp, so it needs *more* of the source's pixels across its narrow frame,
 * not fewer - the 800 set upscaled three to four times there. The folder is
 * versioned: the files are served as immutable, so a re-cut film has to ship
 * under a new name rather than over the old one.
 *
 * The frames' paper is pure white, because the film is multiplied onto the
 * page: any grey left in it would print as a panel.
 */
export const HANDS_COUNT = 185;

export const handsFrame = (i: number) =>
  `/hands/v1/1280/${String(i).padStart(3, "0")}.webp`;

/** The frame the page opens on - the hands still apart - and the one it ends on. */
export const HANDS_FIRST = handsFrame(0);
export const HANDS_LAST = handsFrame(HANDS_COUNT - 1);

const decode = (url: string) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onerror = () => reject(new Error(url));
    img.src = url;
    img.decode().then(() => resolve(url), reject);
  });

/**
 * The opening frame, fetched and decoded before anything asks for it.
 *
 * This module runs at import - the app's first moments - so the frame is in
 * the cache by the time the hero builds its canvas, and the gate does not lift
 * until it has arrived (see SplashGate's `waitFor`). Settles either way: a
 * failed fetch still lets the gate open.
 */
export const heroImageReady: Promise<string> = decode(HANDS_FIRST).catch(() => HANDS_FIRST);
