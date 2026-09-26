#!/usr/bin/env node
/**
 * Seal a PDF deck for the /deck page.
 *
 *   npm run deck:seal -- "C:\path\to\deck.pdf" [--title "YOOJ Pre-Seed 2026"]
 *
 * The repository is public, so the deck never enters it in a readable form.
 * Every page is rendered to WebP at the widths the viewer asks for and sealed
 * with AES-256-GCM under a key derived from DECK_KEY; only that ciphertext is
 * written to deck/sealed. The PDF itself stays wherever it was.
 *
 * deck/sealed and deck/fonts are committed, so the host builds with them: after
 * sealing a new deck, commit both and deploy. Without DECK_KEY they are noise.
 *
 * DECK_KEY lives in .env.local (git-ignored) and in the host's environment
 * settings, never in the repository. If there is no key yet, one is generated
 * and written to .env.local. Changing the key means sealing again, and it signs
 * every reader out, because the same secret signs their passes.
 *
 * The format is read back by server/deck/sealed.ts:
 *   "YDK1" | iv (12 bytes) | GCM tag (16 bytes) | ciphertext
 * with `${page}@${width}` as additional data, so a file cannot be renamed into
 * another page's place.
 *
 * Needs Python with PyMuPDF for the rendering (pip install pymupdf).
 */
import { spawnSync } from "node:child_process";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SEALED = join(ROOT, "deck", "sealed");
const FONTS = join(ROOT, "deck", "fonts");
const ENV_FILE = join(ROOT, ".env.local");
/** What the viewer asks for: a phone's worth, and a retina laptop's. */
const WIDTHS = [1280, 2400];
const MAGIC = Buffer.from("YDK1");

const fail = (message) => {
  console.error(`\n  deck:seal - ${message}\n`);
  process.exit(1);
};

/* ------------------------------------------------------------- arguments */

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  const value = args[i + 1];
  args.splice(i, 2);
  return value ?? null;
};
const titleArg = flag("--title");
const pdf = args[0] ? resolve(args[0]) : null;
if (!pdf || !existsSync(pdf)) fail("give the path to the deck PDF, e.g. npm run deck:seal -- \"C:\\Users\\me\\Downloads\\YOOJ.pdf\"");

/* ------------------------------------------------------------------- key */

const readEnvFile = () => {
  if (!existsSync(ENV_FILE)) return {};
  const out = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
};

let secret = process.env.DECK_KEY?.trim() || readEnvFile().DECK_KEY?.trim();
if (!secret) {
  secret = randomBytes(32).toString("base64url");
  const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const sep = existing && !existing.endsWith("\n") ? "\n" : "";
  writeFileSync(
    ENV_FILE,
    `${existing}${sep}# Unlocks the sealed deck and signs readers' passes. Never commit it;\n`
      + `# set the same value as DECK_KEY in the host's environment variables.\n`
      + `DECK_KEY=${secret}\n`,
  );
  console.log("  A new DECK_KEY was generated and written to .env.local.");
}
const ikm = Buffer.from(secret, "base64url");
if (ikm.length < 32) fail("DECK_KEY must be at least 32 bytes, base64url-encoded.");
const key = Buffer.from(hkdfSync("sha256", ikm, "yooj/deck", "seal", 32));

const seal = (plain, aad) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), data]);
};

const unseal = (file, aad) => {
  const decipher = createDecipheriv("aes-256-gcm", key, file.subarray(4, 16));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(file.subarray(16, 32));
  return Buffer.concat([decipher.update(file.subarray(32)), decipher.final()]);
};

/* ---------------------------------------------------------------- render */

const scratch = mkdtempSync(join(tmpdir(), "yooj-deck-"));
try {
  const python = process.platform === "win32" ? "python" : "python3";
  const run = spawnSync(
    python,
    [join(ROOT, "scripts", "deck", "rasterize.py"), pdf, scratch, WIDTHS.join(",")],
    { encoding: "utf8" },
  );
  if (run.status !== 0) fail(`rendering failed:\n${run.stderr || run.error?.message || "unknown error"}`);
  const report = JSON.parse(run.stdout.trim().split(/\r?\n/).pop());

  const [pw, ph] = report.sizes[0];
  const mixed = report.sizes.some(([w, h]) => Math.abs(w / h - pw / ph) > 0.002);
  if (mixed) console.warn("  Warning: pages differ in shape; the viewer frames every page at the first page's ratio.");

  /* ----------------------------------------------------------------- seal */

  // Read before the folder is cleared, so a re-seal keeps the title it had.
  const previousPath = join(SEALED, "manifest.json");
  const previous = existsSync(previousPath) ? JSON.parse(readFileSync(previousPath, "utf8")) : null;

  rmSync(SEALED, { recursive: true, force: true });
  const sizes = [];
  let bytes = 0;
  for (const w of WIDTHS) {
    mkdirSync(join(SEALED, String(w)), { recursive: true });
    let h = 0;
    for (let page = 1; page <= report.pages; page++) {
      const name = String(page).padStart(2, "0");
      const png = join(scratch, String(w), `${name}.png`);
      const { data, info } = await sharp(png)
        .webp({ quality: 86, effort: 6, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });
      h = Math.max(h, info.height);
      const aad = `${page}@${w}`;
      const file = seal(data, aad);
      // Read it straight back: a seal that cannot be opened is worse than none.
      if (!unseal(file, aad).equals(data)) fail(`page ${page} at ${w}px did not survive the round trip`);
      writeFileSync(join(SEALED, String(w), `${name}.bin`), file);
      bytes += file.length;
    }
    sizes.push({ w, h });
  }

  const manifest = {
    version: 1,
    title: titleArg ?? previous?.title ?? "YOOJ Pre-Seed 2026",
    pages: report.pages,
    ratio: Number((pw / ph).toFixed(5)),
    sizes,
    sealedAt: new Date().toISOString(),
    source: `sha256:${createHash("sha256").update(readFileSync(pdf)).digest("hex")}`,
  };
  writeFileSync(join(SEALED, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  /* -------------------------------------------------------------- the face */

  // The watermark is drawn from glyph outlines, not from a system font - the
  // server has none. Montserrat, the site's own voice, under its OFL licence.
  mkdirSync(FONTS, { recursive: true });
  const face = join(ROOT, "node_modules", "@fontsource", "montserrat", "files", "montserrat-latin-600-normal.woff");
  const licence = join(ROOT, "node_modules", "@fontsource", "montserrat", "LICENSE");
  if (existsSync(face)) copyFileSync(face, join(FONTS, "montserrat-latin-600-normal.woff"));
  if (existsSync(licence)) copyFileSync(licence, join(FONTS, "OFL.txt"));

  console.log(
    `  Sealed ${report.pages} pages at ${WIDTHS.join(" and ")}px `
      + `(${(bytes / 1048576).toFixed(1)} MB) into deck/sealed as "${manifest.title}".`,
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
