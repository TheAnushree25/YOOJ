import { createDecipheriv } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { deckKeys } from "./keys.js";

/**
 * The sealed deck on disk: deck/sealed, written by scripts/deck/seal.mjs.
 *
 * Read from the working directory, which is the project root both under the
 * dev server and in a deployed function (where vercel.json's `includeFiles`
 * puts the folder beside the code).
 */
export interface Manifest {
  version: 1;
  title: string;
  pages: number;
  /** Width over height of every page. */
  ratio: number;
  /** The widths each page was sealed at, and the height that gives. */
  sizes: { w: number; h: number }[];
  sealedAt: string;
  source: string;
}

const dir = () => join(process.cwd(), "deck", "sealed");
const MAGIC = Buffer.from("YDK1");

let manifest: Promise<Manifest> | null = null;

/** Null until a deck has been sealed. Only a successful read is kept. */
export const readManifest = async (): Promise<Manifest | null> => {
  manifest ??= readFile(join(dir(), "manifest.json"), "utf8").then((text) => JSON.parse(text) as Manifest);
  try {
    return await manifest;
  } catch {
    manifest = null;
    return null;
  }
};

/** One page as the WebP it was sealed from, or null if it cannot be opened. */
export const openSlide = async (page: number, width: number): Promise<Buffer | null> => {
  const keys = deckKeys();
  if (!keys) return null;

  let file: Buffer;
  try {
    file = await readFile(join(dir(), String(width), `${String(page).padStart(2, "0")}.bin`));
  } catch {
    return null;
  }
  if (file.length < 33 || !file.subarray(0, 4).equals(MAGIC)) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", keys.seal, file.subarray(4, 16));
    // The page and width are part of what was sealed: a file moved into
    // another page's place fails here rather than showing the wrong slide.
    decipher.setAAD(Buffer.from(`${page}@${width}`));
    decipher.setAuthTag(file.subarray(16, 32));
    return Buffer.concat([decipher.update(file.subarray(32)), decipher.final()]);
  } catch {
    return null;
  }
};
