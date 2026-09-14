/**
 * The hero's subject, fetched before anything asks for her.
 *
 * This module runs at import — the app's own first moments, well before the
 * front page mounts — and starts the decode straight away, so by the time the
 * hero renders the image is already in memory. The gate waits on the same
 * promise before it opens (see SplashGate's `waitFor`), and index.html
 * preloads the file with the document, earlier still.
 *
 * WebP first, and lossless: the same pixels as the PNG at a third less
 * weight, alpha intact. Lossy WebP was tried and rejected on sight — it
 * smooths the skin's grain and the knit of the collar, which is the
 * difference between a photograph and a render. The PNG stays on disk for
 * a browser that cannot decode WebP, and is what this resolves to then.
 */
export const HERO_CUTOUT = "/hero/subject-front.webp";
export const HERO_CUTOUT_FALLBACK = "/hero/subject-front.png";

const decode = (url: string) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onerror = () => reject(new Error(url));
    img.src = url;
    img.decode().then(() => resolve(url), reject);
  });

export const heroImageReady: Promise<string> = decode(HERO_CUTOUT)
  .catch(() => decode(HERO_CUTOUT_FALLBACK))
  .catch(() => HERO_CUTOUT_FALLBACK);
