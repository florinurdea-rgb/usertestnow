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
- Upload medical text documents (`.txt`, `.md`, `.html`).
- Ingestion + analysis status.
- AI translation into selected target language.
- Side-by-side preview (original / translated).
- Download translated result as PDF.

### Environment variables
Set these in Vercel project settings:

- `OPENAI_API_KEY`: your OpenAI API key/token.
- `OPENAI_MODEL` (optional): defaults to `gpt-4.1-mini`.
