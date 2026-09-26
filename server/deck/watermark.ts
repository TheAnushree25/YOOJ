import { readFileSync } from "node:fs";
import { join } from "node:path";
import opentype, { type Font } from "opentype.js";
import sharp from "sharp";

/**
 * The reader's address, drawn into the slide itself.
 *
 * Burnt into the pixels on the server, not laid over them in the page: an
 * overlay is a separate layer anyone with the inspector can delete, and the
 * clean slide underneath would still have come down the wire. Here the only
 * copy of a slide that ever leaves the server already carries the name of the
 * person it was sent to - a screenshot, a saved image and a scripted download
 * all carry it too.
 *
 * The pattern follows the reference: the address repeated on a diagonal
 * lattice, small and faint, across the whole page. It is struck twice - in the
 * site's ink and, a hair below it, in bone - because the deck alternates wine
 * pages with cream ones, and either tone alone disappears on one of them. The
 * pair reads as a light emboss on both.
 */

let face: Font | null = null;

/** Montserrat 600 from deck/fonts. Outlines, so the server needs no installed fonts. */
const font = () => {
  if (face) return face;
  const file = readFileSync(join(process.cwd(), "deck", "fonts", "montserrat-latin-600-normal.woff"));
  face = opentype.parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
  return face;
};

/**
 * The lattice, in fractions of the slide's width.
 *
 * Opened out from the reference's 0.3 x 0.175 (2026-09-26): at that density
 * the address sat over nearly every photograph and line of type, and read as
 * noise over the deck rather than a name on it. The cell is now 0.4 x 0.24,
 * a little over half as many marks - still no quarter of a slide without one.
 */
const TYPE = 0.0148;
const STEP_X = 0.4;
const STEP_Y = 0.24;
const ANGLE = -30;

const svgFor = (email: string, w: number, h: number) => {
  const path = font().getPath(email, 0, 0, w * TYPE);
  const box = path.getBoundingBox();
  const cx = (box.x1 + box.x2) / 2;
  const cy = (box.y1 + box.y2) / 2;
  const offset = Math.max(1, w / 1400);

  const stepX = w * STEP_X;
  const stepY = w * STEP_Y;
  const places: [number, number][] = [];
  let row = 0;
  // One step past every edge, so the rotated copies at the border are never cut short of the frame.
  for (let y = -stepY / 2; y < h + stepY; y += stepY, row++) {
    const shift = row % 2 ? stepX / 2 : 0;
    for (let x = -stepX + shift; x < w + stepX; x += stepX) places.push([x, y]);
  }

  const centre = `rotate(${ANGLE}) translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})`;
  const strike = (d: number) =>
    places
      .map(([x, y]) => `<use xlink:href="#m" transform="translate(${(x + d).toFixed(1)} ${(y + d).toFixed(1)}) ${centre}"/>`)
      .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<defs><path id="m" d="${path.toPathData(2)}"/></defs>`
    + `<g fill="#FFF5F6" fill-opacity="0.2">${strike(offset)}</g>`
    + `<g fill="#3C010E" fill-opacity="0.13">${strike(0)}</g>`
    + `</svg>`
  );
};

/**
 * The pattern for one reader at one size, rasterised once.
 *
 * A reader turns through the pages in order, so the same address at the same
 * width is asked for eighteen times running; drawing the vector each time
 * would be most of the cost of every slide. Kept per warm instance, a few
 * dozen deep - each is one slide's worth of mostly empty PNG.
 */
const overlays = new Map<string, Promise<Buffer>>();

const overlayFor = (email: string, w: number, h: number) => {
  const key = `${w}x${h}|${email}`;
  const hit = overlays.get(key);
  if (hit) {
    overlays.delete(key);
    overlays.set(key, hit);
    return hit;
  }
  const made = sharp(Buffer.from(svgFor(email, w, h))).png({ compressionLevel: 1 }).toBuffer();
  made.catch(() => overlays.delete(key));
  overlays.set(key, made);
  if (overlays.size > 24) overlays.delete(overlays.keys().next().value as string);
  return made;
};

/** One slide, stamped for one reader, as WebP. */
export const stamp = async (slide: Buffer, email: string, w: number, h: number) => {
  const overlay = await overlayFor(email, w, h);
  return sharp(slide)
    .composite([{ input: overlay, left: 0, top: 0 }])
    .webp({ quality: 84, effort: 4, smartSubsample: true })
    .toBuffer();
};
