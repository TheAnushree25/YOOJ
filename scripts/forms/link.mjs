#!/usr/bin/env node
/**
 * Link one of the site's Google Forms: which form, and which question each of
 * the site's fields goes to. Writes integrations/google-forms/forms.json.
 *
 *   npm run forms:link -- deck      "https://docs.google.com/forms/d/e/.../viewform"
 *   npm run forms:link -- affiliate "https://forms.gle/..."
 *
 * The link is the form's public one (Send > link). The form's own page lists
 * its questions and their entry numbers, and questions are matched to the
 * site's fields by their titles ("Email", "Phone Number", ...).
 *
 * If a form cannot be read that way, a pre-filled link works too: in the form,
 * ⋮ > Get pre-filled link, type each field's name as its answer ("Email" in
 * the email question, and so on), Get link, and pass that link instead.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FILE = join(ROOT, "integrations", "google-forms", "forms.json");

/** The site's fields, and what a question about each may be called. */
const FIELDS = {
  deck: {
    Email: ["email", "emailaddress", "emailid", "mail", "email address"],
    Location: ["location", "city", "place", "where"],
    Device: ["device", "browser", "devicebrowser"],
  },
  affiliate: {
    Name: ["name", "fullname", "yourname"],
    "Phone Number": ["phonenumber", "phone", "mobile", "mobilenumber", "contact", "contactnumber", "phoneno", "whatsapp"],
    City: ["city", "town", "location"],
    Email: ["email", "emailaddress", "emailid", "mail"],
    "Business Name": ["businessname", "business", "clinicname", "company", "companyname", "organisation", "organization"],
    "You are": ["youare", "iama", "iam", "type", "category", "businesstype", "whoareyou"],
  },
};

/** Every option the site's "You are" can send, so a choice question can be checked. */
const WHO = ["Clinic OPDs", "Pathology", "Radiology", "Pharmacy"];

const squash = (text) => String(text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const fail = (message) => {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
};

const [kind, link] = process.argv.slice(2);
if (!FIELDS[kind] || !link) {
  fail('Usage: npm run forms:link -- <deck|affiliate> "<the form\'s link>"');
}

/* ------------------------------------------------------------ the form */

const res = await fetch(link, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (YOOJ forms:link)" } })
  .catch((error) => fail(`Couldn’t reach the form: ${error.message}`));
const finalUrl = new URL(res.url);
const published = /\/forms\/d\/e\/([^/]+)\//.exec(finalUrl.pathname)?.[1];
if (!published) {
  if (/\/edit\b/.test(finalUrl.pathname) || finalUrl.hostname.startsWith("accounts.")) {
    fail("That is the form's editing link. Use the one from Send > (link icon), which ends in /viewform.");
  }
  fail(`That doesn’t look like a Google Form's public link: ${res.url}`);
}
if (!res.ok) fail(`The form answered ${res.status}. Is it published and accepting responses?`);
const html = await res.text();

/** Questions as the form's own page describes them: title, entry, type, options. */
const questionsFromPage = () => {
  const start = html.indexOf("FB_PUBLIC_LOAD_DATA_");
  if (start < 0) return null;
  const open = html.indexOf("[", start);
  const end = html.indexOf(";</script>", open);
  if (open < 0 || end < 0) return null;
  let data;
  try {
    data = JSON.parse(html.slice(open, end));
  } catch {
    return null;
  }
  const items = data?.[1]?.[1];
  if (!Array.isArray(items)) return null;
  const out = [];
  for (const item of items) {
    const title = item?.[1];
    const type = item?.[3];
    const parts = item?.[4];
    if (typeof title !== "string" || !Array.isArray(parts) || !Array.isArray(parts[0])) continue;
    const entry = parts[0][0];
    if (typeof entry !== "number") continue;
    const options = Array.isArray(parts[0][1]) ? parts[0][1].map((o) => o?.[0]).filter((o) => typeof o === "string" && o) : [];
    out.push({ title: title.trim(), entry: `entry.${entry}`, type, options, required: parts[0][2] === 1 });
  }
  return out;
};

/** Or, from a pre-filled link: each answer is the name of the field it belongs to. */
const questionsFromPrefill = () => {
  const out = [];
  for (const [key, value] of new URL(link).searchParams) {
    if (/^entry\.\d+$/.test(key)) out.push({ title: value, entry: key, type: null, options: [] });
  }
  return out.length ? out : null;
};

const questions = questionsFromPrefill() ?? questionsFromPage();
if (!questions?.length) {
  fail("Couldn’t read the form's questions. Try a pre-filled link instead (see the top of this script).");
}

/* ------------------------------------------------------------ matching */

const wanted = FIELDS[kind];
const entries = {};
const used = new Set();
for (const [field, names] of Object.entries(wanted)) {
  const accept = new Set([squash(field), ...names.map(squash)]);
  const hit = questions.find((q) => !used.has(q.entry) && accept.has(squash(q.title)))
    ?? questions.find((q) => !used.has(q.entry) && [...accept].some((a) => a.length > 3 && squash(q.title).includes(a)));
  entries[field] = hit ? hit.entry : "";
  if (hit) used.add(hit.entry);
}

/* ------------------------------------------------------------- writing */

let all;
try {
  all = JSON.parse(readFileSync(FILE, "utf8"));
} catch {
  all = {};
}
all[kind] = { form: published, entries };
writeFileSync(FILE, JSON.stringify(all, null, 2) + "\n");

/* ------------------------------------------------------------ the report */

console.log(`\n  ${kind} form ${published}\n`);
for (const [field, entry] of Object.entries(entries)) {
  const q = questions.find((x) => x.entry === entry);
  console.log(entry ? `  ✓ ${field.padEnd(14)} → "${q?.title}"  (${entry})` : `  – ${field.padEnd(14)}   no question found; this field won't be sent`);
}
const extra = questions.filter((q) => !used.has(q.entry));
for (const q of extra) {
  console.log(`  ! "${q.title}" isn’t one of the site's fields${q.required ? " and is REQUIRED - every response will be refused" : "; it will stay empty"}`);
}
const who = kind === "affiliate" && questions.find((q) => q.entry === entries["You are"]);
if (who && who.options.length) {
  const missing = WHO.filter((w) => !who.options.includes(w));
  if (missing.length) console.log(`  ! "You are" is a choice question without the option(s): ${missing.join(", ")} - add them, or make it a short-answer question`);
}
if (!entries.Email) console.log("  ! No Email question matched - add a short-answer question titled \"Email\"");
console.log(`\n  Written to integrations/google-forms/forms.json\n`);
