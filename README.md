# invited

A modern, platform-agnostic, free, and account-free platform for creating and sharing event invitations.

Built with Next.js App Router, TypeScript, Tailwind CSS v4, and `@vercel/blob`.

## Key Features

- **Account-free Dual-Link Architecture**: Publishing an event returns a public guest link (`/e/[id]`) and a private host management link (`/e/[id]/edit?key=<editKey>`). Capability secrets are SHA-256 hashed (`editKeyHash` and per-guest `guestTokenHash`) and verified server-side in constant time—no logins, passwords, or OAuth walls required.
- **Deterministic NLP Jumpstart**: Describe an event in plain English on `/` (for example, *"Candlelight service celebrating Jesus birth Dec 24 at 7pm at Grace Chapel"*), and `chrono-node` + rule-based occasion detection immediately pre-fills the title, date/time, location, description, RSVP note prompt, and matching seasonal theme—no external LLM API key required.
- **Seasonal Themes, Covers & Ambient Effects**: Includes 18 curated presets (Christmas, Sacred Starlight, Halloween, Autumn Harvest, Fourth of July, New Year's Eve, Valentine's, Baby Shower, Aurora, and more), 6 font pairings, 14 ambient backdrop options, 18 SVG cover presets plus custom image uploads, light/dark modes, and custom palette contrast checks.
- **Strict Binary Yes/No RSVPs**: Guests commit clearly with **Going (`yes`)** or **Can't Go (`no`)** (no ambiguous *Maybe*), optional `+1` counts (zeroed when declining), bringing/dish notes, host-configured expected guest chips (`awaitingNames`), and an interactive event comment wall with emoji reactions.
- **Calendar & Social Sharing**: One-click `.ics` calendar export (`/api/events/[id]/ics`), Temporal-powered timezone formatting, and dynamic per-event Open Graph preview images (`/e/[id]/opengraph-image`).
- **Optional Browser Push Notifications**: Guests and hosts can subscribe to event updates via Web Push (`public/sw.js`) using standard VAPID keys, gracefully disabled when VAPID env vars are omitted.

## Storage Architecture

`invited` switches automatically between local disk storage and Vercel Blob (`src/lib/storage/adapter.ts`):

- **Production (Vercel Blob Private Store)**: When `BLOB_READ_WRITE_TOKEN` is configured, all event JSON records, RSVPs, comments, subscriber lists, and uploaded cover images are stored in a **private** `@vercel/blob` store (`access: 'private'`). Uploaded cover images are streamed securely through `/api/events/[id]/cover` and `/api/uploads/cover` with `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'`.
- **Local Development Fallback**: When `BLOB_READ_WRITE_TOKEN` is unset, data is persisted atomically to `.data/` (or `INVITED_DATA_DIR` if specified).

## Environment Variables

Copy `.env.example` to `.env.local` if you want to configure optional cloud storage or Web Push locally:

```sh
cp .env.example .env.local
```

| Variable | Required | Description |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Optional | Vercel Blob read/write token (provisioned automatically on Vercel; omits to local `.data/` fallback). |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Optional | Public VAPID key exposed to browser push subscribers (`npx web-push generate-vapid-keys --json`). |
| `VAPID_PRIVATE_KEY` | Optional | Server-side VAPID private key for sending Web Push notifications. |
| `VAPID_SUBJECT` | Optional | Contact URI for VAPID claims (defaults to `mailto:hello@invited.app`). |

## Local Development & Testing

```sh
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to jumpstart an event or visit `/create` to open the full Studio directly.

### Verification Commands

```sh
# Typecheck
npm run typecheck

# Unit & API tests (Vitest)
npm test

# Lint
npm run lint

# Production build
npm run build
```
