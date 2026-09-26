/**
 * The reader's address, drawn into a slide in the browser.
 *
 * For a host that sends slides unstamped (`X-Slide-Stamped: 0`): yooj.care's
 * Cloudflare Worker cannot redraw an image (cloudflare/worker.js). A Node host
 * burns the address in on the server instead (server/deck/watermark.ts), and
 * this never runs.
 *
 * The server's pattern at the server's measures: the address on a diagonal
 * lattice across the page, struck twice - in bone and, a hair above it, in
 * the site's ink - so it reads on the wine pages and the cream ones alike.
 * The slide the viewer shows is the one drawn here, never the one that came
 * down the wire, so a screenshot or a saved image carries the address too.
 */

const TYPE = 0.0148;
const STEP_X = 0.4;
const STEP_Y = 0.24;
const ANGLE = (-30 * Math.PI) / 180;

/** A decoded image to draw, and how to let it go. */
const decode = async (blob: Blob): Promise<{ image: CanvasImageSource; w: number; h: number; release: () => void }> => {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return { image: bitmap, w: bitmap.width, h: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Falls back to an <img>, as older Safari needs.
    }
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return { image: img, w: img.naturalWidth, h: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
};

/** The slide with `email` drawn across it, as a JPEG. */
export const stampSlide = async (slide: Blob, email: string): Promise<Blob> => {
  const { image, w, h, release } = await decode(slide);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    release();
    throw new Error("The slide could not be drawn.");
  }
  ctx.drawImage(image, 0, 0, w, h);
  release();

  // Montserrat 600, as the server draws it; loaded site-wide (main.ts), and
  // asked for here so the first slide is never drawn in a fallback face.
  const font = `600 ${(w * TYPE).toFixed(2)}px Montserrat`;
  await document.fonts?.load(font, email).catch(() => undefined);
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // One step past every edge, so the rotated copies at the border are never cut short of the frame.
  const stepX = w * STEP_X;
  const stepY = w * STEP_Y;
  const places: [number, number][] = [];
  let row = 0;
  for (let y = -stepY / 2; y < h + stepY; y += stepY, row++) {
    const shift = row % 2 ? stepX / 2 : 0;
    for (let x = -stepX + shift; x < w + stepX; x += stepX) places.push([x, y]);
  }

  const strike = (colour: string, alpha: number, d: number) => {
    ctx.fillStyle = colour;
    ctx.globalAlpha = alpha;
    for (const [x, y] of places) {
      ctx.setTransform(1, 0, 0, 1, x + d, y + d);
      ctx.rotate(ANGLE);
      ctx.fillText(email, 0, 0);
    }
  };
  strike("#FFF5F6", 0.2, Math.max(1, w / 1400));
  strike("#3C010E", 0.13, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The slide could not be drawn."))), "image/jpeg", 0.92),
  );
};
