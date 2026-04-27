# Copilot Instructions — Offline-First Notes PWA

## 1. Always Read CLAUDE.md First
Before writing any code, read `CLAUDE.md` in the project root.
It contains the full project plan, data models, file structure, auth strategy, and constraints.
Never assume context — always derive it from `CLAUDE.md`.

---

## 2. Review After Every Code Change

After **every** file creation, edit, or deletion:

1. **Re-read the changed file** in full.
2. **Check for these issues:**
   - Is any PHI field (`title`, `content`) written to Dexie as plaintext? → violation
   - Does a component call NeonDB directly? → violation
   - Does the UI await a sync call before updating? → violation
   - Is `updatedAt` updated on every write? → required
   - Is `syncStatus: "pending"` set on every local write? → required
   - Is a fresh IV generated per encrypt call? → required
   - Is the CryptoKey sourced from memory, not IndexedDB? → required
3. **Flag violations before continuing.** Do not silently move on.
4. **State what changed and why** in a brief comment after each edit.

---

## 3. Respect the Project Structure

Follow the structure in `CLAUDE.md` exactly:
- Local DB logic → `lib/db/dexie.ts` only
- Remote DB logic → `lib/db/drizzle.ts` only
- Encryption → `lib/crypto/` only
- PIN / lock logic → `lib/crypto/pin.ts` only
- Offline session / TTL → `lib/auth/offlineSession.ts` only
- Sync logic → `lib/sync/engine.ts` and `lib/sync/hooks.ts` only
- API routes → `app/api/sync/notes/route.ts` only
- Do not create new top-level folders without confirming with the user.

---

## 4. Code Style Rules

- **TypeScript strictly.** No `any` types.
- **Named exports** for all components and utilities.
- **Default exports** only for Next.js page and layout files.
- Components stay **under ~100 lines.** Split if larger.
- **Tailwind only** for styling. No inline styles, no CSS modules.
- Use **shadcn/ui** for all UI primitives (Button, Input, Card, etc.)

---

## 5. Offline-First Sync Rules (Critical)

```
✅ Write to Dexie first → syncStatus: "pending" → update UI optimistically
✅ Sync flushes only in useSyncEngine, triggered by navigator.onLine
✅ API routes accept arrays (bulk upsert), never single records
✅ NeonDB upserts use: ON CONFLICT (id) DO UPDATE SET ...
✅ After successful sync: update Dexie record to syncStatus: "synced"

❌ Never call NeonDB directly from a component
❌ Never await sync before updating UI
❌ Never generate IDs on the server
❌ Never sync deletes (POC scope)
```

---

## 6. Encryption Rules (Non-Negotiable)

```
✅ Encrypt title and content before every Dexie write
✅ Use Web Crypto API only (crypto.subtle) — no third-party crypto libs
✅ Algorithm: AES-GCM 256-bit
✅ Generate a fresh IV for every single encrypt call
✅ Store IV alongside encrypted blob: { iv: string, data: string }
✅ CryptoKey held in memory only — never stored in IndexedDB directly
✅ WrappedKey (MasterKey.wrapKey(CryptoKey)) is what goes in IndexedDB
✅ MasterKey derived from PIN via PBKDF2 (310000 iterations)

❌ Never store plaintext PHI in IndexedDB
❌ Never store PIN anywhere
❌ Never store raw CryptoKey in IndexedDB
❌ Never log decrypted content (no console.log of title/content)
❌ Never use third-party encryption libraries
```

---

## 7. Auth & PIN Rules (Critical)

**Two-mode auth — always respect both modes:**
- Online + session valid → Clerk JWT in memory, CryptoKey derived and in memory
- Offline + session valid → PIN unlocks CryptoKey from WrappedKey in IndexedDB
- Offline + session expired → PIN still unlocks, `reAuthPending` flag set, TTL enforced
- TTL exceeded (5 hours offline) → wipe local session, force online re-auth

**PIN checklist for every PIN-related code:**
```
✅ PIN used only transiently to derive MasterKey (PBKDF2)
✅ MasterKey used to unwrapKey(WrappedKey) → CryptoKey in memory
✅ MasterKey discarded after unwrap
✅ Max 5 PIN attempts enforced — exceeded = wipe session
✅ Idle lock: 10 minutes inactivity → show LockScreen
✅ Background lock: visibilitychange event → show LockScreen immediately
✅ offlineSessionStart stored encrypted in IndexedDB
✅ TTL check on every PIN unlock: Date.now() - offlineSessionStart > 18000000

❌ Never store PIN
❌ Never store MasterKey
❌ Never allow PIN bypass
❌ Never skip TTL check when offline and session expired
```

**LockScreen rules:**
- `LockScreen` is a full-screen overlay rendered in root layout
- It is never a route or a page
- It renders on top of everything when locked

---

## 8. HIPAA Rules (Always Active)

- HTTPS only — never HTTP in any environment
- No PHI in logs, error messages, or telemetry
- NeonDB must have a signed BAA before production
- `userId` from Clerk must be attached to every NeonDB record
- Never hardcode `userId` — always derive from Clerk session

---

## 9. POC Scope — Do Not Over-Engineer

This is a proof of concept. Do not build what is not listed in `CLAUDE.md`:
- ❌ No chat or messaging
- ❌ No file attachments
- ❌ No rich text editor
- ❌ No real-time / websockets
- ❌ No delete sync
- ❌ No multi-device conflict UI
- ❌ No push notifications

If a feature is not in `CLAUDE.md`, **ask before building it.**

---

## 10. When You're Unsure

- Re-read `CLAUDE.md` before asking the user.
- If `CLAUDE.md` doesn't answer it, ask one focused question.
- Never assume scope and silently expand it.
- When in doubt about HIPAA scope, **always encrypt more, not less.**