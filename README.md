# UserTestNow — Landing (Vercel-ready)

Value prop: Map · Uncover · Optimize — journey mapping + AI opportunity radar + UX consulting.

## Deploy
1) Push these files at repo root: `index.html`, `styles.css`, `script.js`, `vercel.json`, `assets/`, plus app folders.
2) Vercel → New Project → Import → Framework: Other, Build: (empty), Output: `.`
3) Deploy. Add domain in Settings → Domains.

Forms on landing page are demo-only (`localStorage`). Wire to email/webhook later.

## Medical Doc Translator
A mini app is available at `/medicaltranslator`.

### Features
- Upload medical documents (`.docx`, `.pdf`, `.txt`, `.md`, `.html`).
- Ingestion + analysis status.
- AI translation into one of 5 common target languages (English, Spanish, French, German, Hungarian).
- Layout-preserving translation flow:
  - DOCX: translates text nodes while preserving HTML structure from DOCX conversion.
  - PDF: translates text blocks and redraws translated content at original coordinates.
- Side-by-side preview (original / translated).
- Download translated result as PDF.

### Environment variables
Set these in Vercel project settings:

- `OPENAI_API_KEY`: your OpenAI API key/token.
- `OPENAI_MODEL` (optional): defaults to `gpt-4.1-mini`.


### Troubleshooting routes
If `/medicaltranslator` does not load on your domain, redeploy after the latest `vercel.json` rewrite update so `/medicaltranslator` maps to `/medicaltranslator/index.html`.
