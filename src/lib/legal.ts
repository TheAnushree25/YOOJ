/**
 * The fine print: the Privacy Policy, the Terms of Service and the Cookie
 * Policy, as YOOJ supplied them (YOOJ_Privacy_Policy.docx,
 * YOOJ_Terms_of_Service.docx, YOOJ_Cookie_Policy.docx, 23 September 2026).
 *
 * The words are the documents' own. The only changes are typographic: the
 * square brackets the drafts put around values that have been filled in are
 * gone, addresses and numbers are links, and a mention of another policy is a
 * link to it. Brackets that still hold a placeholder - a provider or a number
 * the drafts leave open - are kept exactly as written, so nothing is promised
 * here that the documents do not say.
 *
 * Inline text is trusted, authored HTML, rendered as such by LegalView.
 */

export type LegalKey = "privacy" | "terms" | "cookies";

export type Block =
  | { kind: "p"; html: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  /** Set apart: the one thing on the page a reader must not miss. */
  | { kind: "callout"; lines: string[] }
  /** A card of labelled lines: who to write to, and where. */
  | { kind: "card"; rows: Array<[label: string, html: string]> };

export interface Section {
  id: string;
  title: string;
  blocks: Block[];
}

export interface LegalDoc {
  key: LegalKey;
  title: string;
  updated: string;
  applies: string;
  sections: Section[];
  /** A last word under the final section, as the document signs off. */
  closing?: string;
}

const mail = (a: string) => `<a href="mailto:${a}">${a}</a>`;
const phone = `<a href="tel:+917044422913">+91-7044422913</a>`;
const ADDRESS = "15, Canal East Road, Bagree Mill Compound, 1<sup>st</sup> Floor, Kolkata 700067";
const LEGAL = mail("legal@yooj.care");
const MAYANK = mail("mayank@yooj.care");
const doc = (key: LegalKey, label: string) => `<a href="/legal/${key}" data-legal="${key}">${label}</a>`;

const UPDATED = "23 September 2026";
const APPLIES = "www.yooj.care, and www.yooj.in and www.yooj.health (which redirect to it)";

/* ---------------------------------------------------------------- privacy */

const privacy: LegalDoc = {
  key: "privacy",
  title: "Privacy Policy",
  updated: UPDATED,
  applies: APPLIES,
  sections: [
    {
      id: "who-we-are",
      title: "Who we are",
      blocks: [
        { kind: "p", html: "YOOJ is a primary healthcare brand building affordable, standardised clinics, pharmacies and diagnostics in Tier 2 and Tier 3 India, starting in Punjab." },
        { kind: "p", html: `The website and the YOOJ brand are operated by <strong>Banyantree Care Private Limited</strong> (“YOOJ”, “we”, “us”, “our”), a company incorporated in India, CIN <strong>U47721WB2026PTC289588</strong>, with its registered office at ${ADDRESS}.` },
        { kind: "p", html: "Under Indian law, and in particular the Digital Personal Data Protection Act, 2023 (“DPDP Act”), we are the <strong>Data Fiduciary</strong> for personal data collected through this website. That means we decide why and how your data is used, and we are responsible for protecting it." },
        { kind: "p", html: "This policy covers the <strong>website only</strong>. When you visit a YOOJ centre, a YOOJ-affiliated clinic or pharmacy, or YOOJ Diagnostics in person, you will get a separate patient privacy notice at registration. That notice covers your medical records, prescriptions and test reports." },
      ],
    },
    {
      id: "short-version",
      title: "The short version",
      blocks: [
        {
          kind: "list",
          items: [
            "The website is mainly for information and enquiries. We collect only what you type into our forms, plus basic technical data from your visit.",
            "<strong>Please do not send us medical records, test reports or prescriptions through the website.</strong> Bring them to your visit or share them at the centre.",
            "We do not sell your data. We do not run advertising trackers that follow you around the internet.",
            `You can ask us to see, correct or delete your data at any time. Write to ${LEGAL}.`,
          ],
        },
      ],
    },
    {
      id: "what-we-collect",
      title: "What we collect, and why",
      blocks: [
        { kind: "p", html: "We collect personal data only for the purposes listed below. We don’t collect it “just in case”." },
        {
          kind: "table",
          head: ["Where it comes from", "What we collect", "Why we use it"],
          rows: [
            ["<strong>Patient enquiry or callback form</strong>", "Name, mobile number, town, preferred language, and a short reason for your enquiry if you choose to give one", "To call or WhatsApp you back, tell you about the nearest YOOJ centre, timings and prices, and help you book a visit"],
            ["<strong>Clinic and pharmacy partner (affiliate) form</strong>", "Your name, clinic or pharmacy name, town, registration or licence details you choose to share, contact number, email", "To assess whether your establishment could join the YOOJ network, and to discuss conversion, upgrade and partnership terms"],
            ["<strong>Doctor and staff careers form</strong>", "Name, contact details, qualifications, registration number, CV", "To consider you for roles at YOOJ centres or YOOJ Diagnostics"],
            ["<strong>Investor and partnership enquiries</strong>", "Name, organisation, email, phone, message", "To respond and share information about YOOJ"],
            ["<strong>WhatsApp, phone or email you send us</strong>", "Whatever you choose to share", "To reply to you"],
            ["<strong>Technical data from your visit</strong>", "IP address, device and browser type, pages visited, time of visit, referring page", `To keep the site running and secure, and to understand which pages people use. See our ${doc("cookies", "Cookie Policy")}`],
          ],
        },
        { kind: "p", html: "<strong>Health information.</strong> A patient enquiry may reveal something about your health, even just a reason like “sugar test”. We treat anything health-related as sensitive. We use it only to handle your enquiry. It is seen only by the YOOJ staff who need it, and it is never used for marketing." },
      ],
    },
    {
      id: "consent",
      title: "Consent",
      blocks: [
        { kind: "p", html: "When you submit a form, we ask for your consent to use your data for the purpose shown on that form. Consent is:" },
        {
          kind: "list",
          items: [
            "<strong>Specific.</strong> Agreeing to a callback is not agreeing to marketing. Promotional messages, such as health camp announcements or JeevanBhar membership offers, need a separate opt-in tick box.",
            `<strong>Withdrawable.</strong> You can withdraw consent at any time by writing to ${LEGAL} or replying “STOP” on WhatsApp or SMS. Withdrawing is as easy as giving consent. It doesn’t affect processing we already carried out lawfully.`,
          ],
        },
        { kind: "p", html: "In a few cases, the law allows us to process data without fresh consent. Examples are complying with a legal obligation, responding to a medical emergency, or legitimate uses permitted under the DPDP Act." },
      ],
    },
    {
      id: "jeevanbhar-abha",
      title: "JeevanBhar, ABHA and your health records",
      blocks: [
        { kind: "p", html: "<strong>JeevanBhar</strong> is YOOJ’s lifetime patient ID. It is issued when you register <strong>in person</strong> at a YOOJ centre, not through this website. Your JeevanBhar records are governed by the patient privacy notice you receive at registration." },
        { kind: "p", html: "Where YOOJ centres link your health records to your <strong>ABHA (Ayushman Bharat Health Account)</strong> under the Ayushman Bharat Digital Mission, this happens only with your explicit consent. It follows the National Health Authority’s Health Data Management Policy. You can see, share or revoke access through ABDM’s consent mechanisms." },
        { kind: "p", html: "This website does not create JeevanBhar IDs or ABHA numbers, and it does not store medical records." },
      ],
    },
    {
      id: "sharing",
      title: "Who we share data with",
      blocks: [
        { kind: "p", html: "We share personal data only when it’s needed for the purpose you gave it for:" },
        {
          kind: "list",
          items: [
            "<strong>The YOOJ centre or YOOJ-affiliated clinic or pharmacy nearest to you,</strong> so it can respond to your enquiry. Affiliated establishments are independently owned. They are bound by written agreements with us to use your data only to serve you and to follow YOOJ’s data standards.",
            "<strong>YOOJ Diagnostics,</strong> our pathology and radiology hub, if your enquiry is about a test.",
            "<strong>Service providers that help us run the website and communications.</strong> This includes website hosting (Vercel Inc.), form handling and email ([provider]), WhatsApp Business messaging (Meta Platforms), and analytics ([provider]). They process data only on our instructions.",
            "<strong>Group entities.</strong> YOOJ Tech Private Limited [if applicable] may process data to support our systems. It does so only under the same protections as this policy.",
            "<strong>Authorities,</strong> where required by law, court order or a lawful government request.",
            "<strong>A successor entity,</strong> if YOOJ is merged, acquired or restructured. Your data would remain protected by commitments no weaker than this policy.",
          ],
        },
        { kind: "p", html: "We <strong>never sell</strong> personal data. We never share it with pharmaceutical companies, insurers or advertisers for their own marketing." },
      ],
    },
    {
      id: "storage",
      title: "Where your data is stored",
      blocks: [
        { kind: "p", html: "Our website and service providers may store data on servers in India or abroad. Where data is transferred outside India, we do so only to countries not restricted by the Government of India under the DPDP Act, and only under contractual safeguards." },
      ],
    },
    {
      id: "retention",
      title: "How long we keep it",
      blocks: [
        {
          kind: "table",
          head: ["Data", "How long"],
          rows: [
            ["Patient enquiries that didn’t lead to a visit", "12 months after the last contact, then deleted"],
            ["Affiliate partner applications", "For the duration of discussions, plus 24 months, or longer if you join the network"],
            ["Job applications", "12 months, unless you ask us to keep your CV on file for longer"],
            ["Server and security logs", "At least one year, as required under the DPDP Rules, 2025"],
            ["Marketing consent records", "As long as you’re subscribed, plus the period needed to prove consent"],
          ],
        },
        { kind: "p", html: "We may keep data longer if the law requires it." },
      ],
    },
    {
      id: "protection",
      title: "How we protect it",
      blocks: [
        { kind: "p", html: "We use encryption in transit (HTTPS), access controls limited to staff who need the data, vetted service providers, and regular review of who has access. No system is perfectly secure. If a personal data breach affects you, we will notify you and the Data Protection Board of India as required by law." },
      ],
    },
    {
      id: "your-rights",
      title: "Your rights",
      blocks: [
        { kind: "p", html: "Under the DPDP Act, you can:" },
        {
          kind: "list",
          items: [
            "<strong>Access</strong> a summary of the personal data we hold about you and how we use it",
            "<strong>Correct, complete or update</strong> inaccurate data",
            "<strong>Erase</strong> data we no longer need, or data you withdraw consent for",
            "<strong>Nominate</strong> someone to exercise your rights if you die or become incapacitated",
            "<strong>Raise a grievance</strong> with us, and escalate to the Data Protection Board of India if you’re not satisfied",
          ],
        },
        { kind: "p", html: `To use any of these rights, write to ${LEGAL} or WhatsApp [number]. You can write in English, Hindi or Punjabi. We’ll respond within 30 days, and never later than the time the law allows.` },
      ],
    },
    {
      id: "children",
      title: "Children",
      blocks: [
        { kind: "p", html: "This website is meant for adults. If you’re booking care for a child, the parent or legal guardian should fill in the form. We don’t knowingly collect data directly from anyone under 18 without verifiable parental consent. If we learn we have, we’ll delete it." },
      ],
    },
    {
      id: "grievance-officer",
      title: "Grievance Officer",
      blocks: [
        {
          kind: "card",
          rows: [
            ["Name", "Mayank Varma"],
            ["Designation", "Grievance Officer, Banyantree Care Private Limited (YOOJ)"],
            ["Email", LEGAL],
            ["Phone / WhatsApp", phone],
            ["Address", ADDRESS],
          ],
        },
        { kind: "p", html: "We will acknowledge your complaint within 48 hours and aim to resolve it within 15 days." },
      ],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      blocks: [
        { kind: "p", html: "YOOJ is growing. As we open centres, onboard affiliated clinics and add services, this policy will change. We’ll update the “Last updated” date. If a change materially affects how we use your data, we’ll tell you through the website or by message before it takes effect." },
      ],
    },
    {
      id: "language",
      title: "Language",
      blocks: [
        { kind: "p", html: "This policy may be made available in Hindi and Punjabi. If there’s any conflict between versions, the English version applies." },
      ],
    },
  ],
  closing: `Questions? Write to ${LEGAL}. We’d rather you ask than wonder.`,
};

/* ------------------------------------------------------------------ terms */

const terms: LegalDoc = {
  key: "terms",
  title: "Terms of Service",
  updated: UPDATED,
  applies: APPLIES,
  sections: [
    {
      id: "about-these-terms",
      title: "About these terms",
      blocks: [
        { kind: "p", html: `These terms govern your use of the YOOJ website. The website is operated by <strong>Banyantree Care Private Limited</strong> (“YOOJ”, “we”, “us”), CIN <strong>U47721WB2026PTC289588</strong>, registered office ${ADDRESS}.` },
        { kind: "p", html: `By using the website, you agree to these terms and to our ${doc("privacy", "Privacy Policy")} and ${doc("cookies", "Cookie Policy")}. If you don’t agree, please don’t use the website.` },
      ],
    },
    {
      id: "what-yooj-is",
      title: "What YOOJ is, and what this website is",
      blocks: [
        { kind: "p", html: "YOOJ is building a network of affordable, standardised primary healthcare in Tier 2 and Tier 3 India. It has three parts:" },
        {
          kind: "list",
          items: [
            "<strong>YOOJ Primary Care Centres,</strong> owned and operated by YOOJ;",
            "<strong>YOOJ-affiliated clinics and pharmacies,</strong> which are independently owned establishments that have upgraded and rebranded to meet YOOJ standards; and",
            "<strong>YOOJ Diagnostics,</strong> our pathology and radiology hub.",
          ],
        },
        { kind: "p", html: "<strong>This website is for information and enquiries.</strong> Through it you can learn about YOOJ, find a centre, request a callback, apply to partner with us, or apply for a job. <strong>The website does not provide medical consultations, diagnosis, prescriptions or online sale of medicines.</strong>" },
      ],
    },
    {
      id: "not-medical-advice",
      title: "Not medical advice",
      blocks: [
        { kind: "p", html: "Everything on this website is general information. That includes descriptions of services, health camp notices and articles. It is <strong>not medical advice</strong> and is not a substitute for examination by a registered medical practitioner. Don’t start, stop or change any treatment based on something you read here." },
        {
          kind: "callout",
          lines: [
            "<strong>In an emergency, do not use this website or wait for a callback.</strong>",
            `Call <strong><a href="tel:112">112</a></strong> or <strong><a href="tel:108">108</a></strong> (ambulance) or go to the nearest hospital emergency department.`,
          ],
        },
      ],
    },
    {
      id: "responsibility",
      title: "Doctors, affiliates and who is responsible for your care",
      blocks: [
        { kind: "p", html: "This section matters, so please read it." },
        {
          kind: "list",
          items: [
            "<strong>Clinical decisions belong to the treating doctor.</strong> All consultations at YOOJ centres and YOOJ-affiliated clinics are given by medical practitioners registered with the National Medical Commission or a State Medical Council. They exercise their own independent professional judgement.",
            "<strong>Affiliated clinics and pharmacies are independently owned.</strong> They operate under the YOOJ brand under a written agreement, and YOOJ sets service, pricing and quality standards for them. But each affiliate holds its own licences and registrations, and is responsible for the care and products it provides. Carrying the YOOJ name doesn’t make an affiliate YOOJ’s employee or agent, except where the law says otherwise.",
            "<strong>Pharmacies</strong> dispense medicines in line with the Drugs and Cosmetics Act, 1940 and its rules. Prescription medicines are dispensed only against a valid prescription.",
            "<strong>YOOJ Diagnostics</strong> reports are issued under the supervision of qualified pathologists and radiologists, and should be interpreted by your treating doctor.",
          ],
        },
        { kind: "p", html: `If you’re unhappy with care you received at any YOOJ-branded location, tell us at ${LEGAL}. We take brand standards seriously and will follow up with the centre or affiliate concerned.` },
      ],
    },
    {
      id: "prices",
      title: "Prices and availability",
      blocks: [
        { kind: "p", html: "Prices shown on the website are <strong>indicative</strong>. That includes consultation fees such as ₹400, medicine pricing, test rates and JeevanBhar membership tiers (Basic, Member, Gold). They may differ by town, centre or affiliate. Services, timings and locations may change as the network grows. The price confirmed at the centre at the time of service is the one that applies." },
        { kind: "p", html: "Any offer or discount shown on the website is subject to the specific terms stated with it, and may be withdrawn at any time." },
      ],
    },
    {
      id: "your-use",
      title: "Your use of the website",
      blocks: [
        { kind: "p", html: "You agree to:" },
        {
          kind: "list",
          items: [
            "give accurate information in any form you submit, and submit enquiries only for yourself or with the permission of the person concerned (for example, as a family member or guardian);",
            "not submit someone else’s personal or health information without their consent;",
            "not use the website for anything unlawful, misleading or harmful. That includes impersonating a YOOJ centre, affiliate, doctor or employee;",
            "not attempt to hack, overload, scrape or interfere with the website or its security; and",
            "not upload viruses or malicious code.",
          ],
        },
      ],
    },
    {
      id: "affiliate-applications",
      title: "Partner (affiliate) applications",
      blocks: [
        { kind: "p", html: "Submitting an affiliate application through the website <strong>doesn’t create any partnership, franchise, agency or commercial relationship</strong>. It also creates no obligation on either side. An affiliation begins only when both parties sign a written affiliation agreement. Any figures shared before that, such as projected footfall, revenue share or upgrade costs, are indicative and not guarantees." },
      ],
    },
    {
      id: "our-content",
      title: "The YOOJ name and our content",
      blocks: [
        { kind: "p", html: "“YOOJ”, the YOOJ logo, “JeevanBhar”, “YOOJ Diagnostics” and related names, logos and brand colours are trademarks of YOOJ or its group companies, used or applied for in India." },
        { kind: "p", html: "The website’s text, design, graphics, photographs and layout are owned by or licensed to YOOJ. You may view and share links to the website for personal, non-commercial use. You may not copy, reproduce, modify or commercially use any of it, or use the YOOJ brand to suggest you’re associated with us, without our written permission." },
        { kind: "p", html: `<strong>Only establishments with a signed YOOJ affiliation agreement may display the YOOJ name or logo.</strong> If you see a clinic, pharmacy or lab using the YOOJ brand and you’re not sure it’s genuine, please tell us at ${LEGAL}.` },
      ],
    },
    {
      id: "links",
      title: "Links to other websites",
      blocks: [
        { kind: "p", html: "The website may link to third-party sites, such as ABDM, WhatsApp, maps or social media. We don’t control them and aren’t responsible for their content or privacy practices." },
      ],
    },
    {
      id: "liability",
      title: "Limitation of liability",
      blocks: [
        { kind: "p", html: "We work to keep the website accurate and available, but it is provided “as is”. To the extent permitted by law, YOOJ isn’t liable for:" },
        {
          kind: "list",
          items: [
            "any loss arising from reliance on general information on the website;",
            "temporary unavailability, errors or interruptions of the website; or",
            "the acts or omissions of independently owned affiliates, except as provided in our agreements with them or as required by law.",
          ],
        },
        { kind: "p", html: "Nothing in these terms limits any liability that can’t be limited under Indian law, including under the Consumer Protection Act, 2019." },
      ],
    },
    {
      id: "indemnity",
      title: "Indemnity",
      blocks: [
        { kind: "p", html: "If you breach these terms or misuse the website, and that causes a claim against YOOJ, you agree to compensate YOOJ for losses reasonably caused by that breach." },
      ],
    },
    {
      id: "suspension",
      title: "Suspension",
      blocks: [
        { kind: "p", html: "We may restrict or block access to the website, or to any feature, for anyone who breaches these terms or misuses it." },
      ],
    },
    {
      id: "changes",
      title: "Changes",
      blocks: [
        { kind: "p", html: "We may update these terms as YOOJ grows. The “Last updated” date shows the latest version. Continuing to use the website after a change means you accept the updated terms." },
      ],
    },
    {
      id: "governing-law",
      title: "Governing law and disputes",
      blocks: [
        { kind: "p", html: "These terms are governed by the laws of India. Subject to your rights under consumer protection law, the courts at Chandigarh have exclusive jurisdiction." },
      ],
    },
    {
      id: "grievances",
      title: "Grievances and contact",
      blocks: [
        {
          kind: "card",
          rows: [
            ["Grievance Officer", "Mayank Varma"],
            ["Email", LEGAL],
            ["Phone / WhatsApp", phone],
            ["Address", ADDRESS],
          ],
        },
        { kind: "p", html: "We’ll acknowledge complaints within 48 hours and aim to resolve them within 15 days." },
      ],
    },
    {
      id: "language",
      title: "Language",
      blocks: [
        { kind: "p", html: "These terms may be made available in Hindi and Punjabi. If there’s any conflict, the English version applies." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- cookies */

const cookies: LegalDoc = {
  key: "cookies",
  title: "Cookie Policy",
  updated: UPDATED,
  applies: APPLIES,
  sections: [
    {
      id: "what-this-covers",
      title: "What this covers",
      blocks: [
        { kind: "p", html: `This policy explains how <strong>Banyantree Care Private Limited</strong> (“YOOJ”, “we”) uses cookies and similar technologies on the YOOJ website. Read it together with our ${doc("privacy", "Privacy Policy")}.` },
      ],
    },
    {
      id: "what-cookies-are",
      title: "What cookies are",
      blocks: [
        { kind: "p", html: "Cookies are small text files a website places on your phone or computer. Similar technologies include local storage, pixels and scripts that do comparable things. We call all of these “cookies” here." },
      ],
    },
    {
      id: "our-approach",
      title: "Our approach",
      blocks: [
        { kind: "p", html: "YOOJ is a healthcare brand, so we keep tracking to a minimum:" },
        {
          kind: "list",
          items: [
            "<strong>We don’t use advertising or retargeting cookies.</strong> No one should see ads following them around because they looked up a clinic or a blood test on our site.",
            "<strong>We never place cookies that record which health services you browsed in order to build a profile of you.</strong>",
            "<strong>Non-essential cookies are off until you say yes.</strong> When you first visit, a banner lets you accept or reject them. Rejecting is as easy as accepting.",
          ],
        },
      ],
    },
    {
      id: "cookies-we-use",
      title: "Cookies we use",
      blocks: [
        {
          kind: "table",
          head: ["Category", "What it does", "Examples", "Can you turn it off?"],
          rows: [
            ["<strong>Strictly necessary</strong>", "Keeps the site working and secure: page delivery, spam and bot protection on our forms, and remembering your cookie choice", "Vercel hosting / security, form spam protection, <code>yooj_consent</code> (stores your cookie choice, 12 months)", "No. The site can’t work properly without them"],
            ["<strong>Preferences</strong>", "Remembers choices such as your language (English, Hindi or Punjabi) or the town you selected", "<code>yooj_lang</code>, <code>yooj_town</code> (12 months)", "Yes"],
            ["<strong>Analytics</strong>", "Tells us, in aggregate, which pages are visited and whether the site loads well on slower phones and networks", "[Tool name, e.g. Vercel Web Analytics / Google Analytics 4] ([duration])", "Yes. Off unless you accept"],
            ["<strong>Third-party embeds</strong>", "Loads maps to show centre locations, or a WhatsApp chat button", "Google Maps, WhatsApp", "Yes. Blocked until you accept or choose to open them"],
          ],
        },
      ],
    },
    {
      id: "your-choices",
      title: "Your choices",
      blocks: [
        {
          kind: "list",
          items: [
            "<strong>On our site:</strong> use the cookie banner on your first visit. You can change your choice anytime through the <strong>“Cookie settings”</strong> link in the website footer.",
            "<strong>In your browser:</strong> most browsers let you block or delete cookies in their settings. Blocking strictly necessary cookies may stop forms from working.",
          ],
        },
        { kind: "p", html: "Turning off analytics or preference cookies doesn’t affect your ability to find a centre, request a callback or contact us." },
      ],
    },
    {
      id: "third-parties",
      title: "Third parties",
      blocks: [
        { kind: "p", html: "Where third-party tools set cookies, such as a maps provider or analytics service, their use of data is also governed by their own privacy policies. We choose providers that let us limit data collection, and we configure them to do so where possible, for example by anonymising IP addresses." },
      ],
    },
    {
      id: "changes",
      title: "Changes",
      blocks: [
        { kind: "p", html: "If we add or remove tools, we’ll update this policy and the table above. If we add a new category of non-essential cookie, we’ll ask for your consent again." },
      ],
    },
    {
      id: "contact",
      title: "Contact",
      blocks: [
        {
          kind: "card",
          rows: [
            ["Questions about cookies or your data", MAYANK],
            ["Grievance Officer", `Mayank Varma, ${MAYANK}, ${phone}`],
          ],
        },
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalKey, LegalDoc> = { privacy, terms, cookies };

export const LEGAL_ORDER: LegalKey[] = ["privacy", "terms", "cookies"];
