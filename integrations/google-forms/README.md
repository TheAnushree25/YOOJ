# Google Forms: deck visits and network sign-ups

Everything a visitor enters on the website is sent to a Google Form. Google
Forms then writes it into the spreadsheet the form is linked to, one row per
entry, with a timestamp.

| Website | Google Form | Questions (Short answer, titled exactly) |
| --- | --- | --- |
| Email entered at the `/deck` login | YOOJ_Deck | Email (required) |
| "Join the YOOJ network" on `/solutions` | YOOJ_Leads_Form (`affiliate`) | Name, Phone Number, City, Email, Business Name, You are |

The visitor's own browser sends each entry straight to the Google Form
(`src/lib/google-forms.ts`). No server of ours is involved, so it works the
same wherever the site runs - yooj.care on Cloudflare, Vercel, or a laptop.
The deck's email is sent the moment "View the deck" is pressed.

Google doesn't let another website read its reply, so the site can't see a
refusal. That is why it checks every field first, the way the form would:
every question answered, and "You are" exactly one of the form's options. A
form that asks for anything more - a new required question, a sign-in - makes
Google quietly drop every entry, so keep the forms set up as below.

## Setting up a form (once per form)

1. **Questions.** Give each question the title from the table and set its type
   to **Short answer**. For "You are" you can use a **Dropdown** with exactly
   these options: Clinic OPDs, Pathology, Radiology, Pharmacy. Don't add other
   required questions, because the website can't answer them.
2. **Settings → Responses.** Set **Collect email addresses** to **Do not
   collect**, and keep **Limit to 1 response** off. Both of these make Google
   ask for a sign-in, which the website can't do. The email arrives through
   the "Email" question instead.
3. **Responses → Link to Sheets → Select existing spreadsheet.** Choose that
   form's spreadsheet. Google adds a tab called "Form Responses 1" and writes
   every entry there.
4. **Publish.** Set Responders to **Anyone with the link**.
5. **Link icon → Copy responder link.** Then connect it to the website:

   ```
   npm run forms:link -- deck "<YOOJ_Deck responder link>"
   npm run forms:link -- affiliate "<YOOJ_Leads_Form responder link>"
   ```

   This reads the form, matches each question to the website field with the
   same title, writes `forms.json` beside this file, and lists what it matched.
   Commit `forms.json`; the next build of each site picks it up. There are no
   passwords or keys involved, because a form's link and question numbers are
   public anyway.

If you later **delete** a question and add it again, or add a new one, run the
command again. Renaming a question is fine.
