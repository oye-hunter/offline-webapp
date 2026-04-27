# Project: Offline-First Notes PWA

## Overview
A Next.js 14+ App Router PWA for saving notes with full offline support. Notes are written locally first, encrypted on device, and synced to NeonDB when connectivity is restored. The app is HIPAA compliant with two-mode authentication: Clerk online, PIN offline.

This is a **proof of concept** meant to validate offline-first sync + HIPAA-safe local storage before integrating into a larger production project that already uses Next.js and NeonDB.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Local DB | Dexie.js (IndexedDB wrapper) |
| Remote DB | NeonDB (Postgres, serverless) |
| ORM | Drizzle ORM |
| PWA | Serwist |
| Auth | Clerk (HIPAA compliant, BAA available) |
| Encryption | Web Crypto API (AES-GCM 256-bit) |

---

## Authentication Strategy — Two-Mode Auth

### Online Mode
Clerk handles auth normally. On successful login, user sets a PIN. A MasterKey is derived from the PIN using PBKDF2. The MasterKey wraps the CryptoKey used to encrypt/decrypt all local data. The WrappedKey is stored in IndexedDB (safe — it is encrypted).

### Offline Mode (session still valid)
PIN unlocks the in-memory CryptoKey. No network needed. Clerk JWT is self-contained and can be validated client-side without a server call.

### Offline Mode (session expired)
PIN still unlocks the app. The CryptoKey is unwrapped from IndexedDB using the PIN-derived MasterKey. A `reAuthPending: true` flag is set. A visible banner shows "Offline — re-authentication required when online." App remains fully functional for up to **5 hours** from when the session expired.

### Comes Back Online
If `reAuthPending === true`, Clerk re-auth is triggered automatically. CryptoKey is refreshed silently. User is not interrupted if PIN was already verified.

### Auth State Machine
```
ONLINE  + SESSION VALID   + UNLOCKED  → full access
ONLINE  + SESSION VALID   + LOCKED    → PIN screen
OFFLINE + SESSION VALID   + UNLOCKED  → full access
OFFLINE + SESSION VALID   + LOCKED    → PIN screen
OFFLINE + SESSION EXPIRED + UNLOCKED  → full access + "re-auth pending" banner
OFFLINE + SESSION EXPIRED + LOCKED    → PIN screen (PIN is sole gatekeeper)
OFFLINE + TTL EXCEEDED (5h)           → full wipe, must re-auth online
ONLINE  + SESSION EXPIRED             → force Clerk re-auth → refresh CryptoKey
```

---

## Offline Session TTL — 5 Hour Rule

When the Clerk session expires while offline, the PIN keeps the app accessible for a maximum of **5 hours**.

- On session expiry while offline: save `offlineSessionStart = Date.now()` encrypted in IndexedDB.
- On every PIN unlock attempt: check `Date.now() - offlineSessionStart > 18000000` (5h in ms).
- If TTL exceeded: wipe local session entirely → show "Session expired. Reconnect to continue."
- User must re-auth with Clerk online to regain access.
- `offlineSessionStart` is stored encrypted — it cannot be tampered with.

---

## Key Derivation Strategy

```
User sets PIN (first login, online)
    │
    ▼
MasterKey ← PBKDF2(PIN, salt, 310000 iterations, AES-GCM 256)
    │
    ▼
CryptoKey ← fresh AES-GCM 256 key (generated once)
    │
    ▼
WrappedKey ← MasterKey.wrapKey(CryptoKey) → stored in IndexedDB
CryptoKey → held in memory only during active session

To unlock after lock / session expiry:
    User enters PIN
    → derive MasterKey from PIN + stored salt
    → unwrapKey(WrappedKey from IndexedDB)
    → CryptoKey restored in memory
    → app unlocks
```

**Key rules:**
- PIN is never stored anywhere.
- Changing PIN = re-wrap CryptoKey with new MasterKey. Data does not need re-encryption.
- CryptoKey survives session expiry because it is protected by PIN, not session token.

---

## Core Concept: Offline-First Sync

Every write goes to **Dexie (local) first**, encrypted, stamped with `syncStatus: "pending"`. When online, the sync engine flushes pending records to NeonDB.

```
User Action
    │
    ▼
Encrypt PHI fields (AES-GCM, fresh IV per write)
    │
    ▼
Dexie.js (stores encrypted blob + IV, syncStatus: "pending")
    │
    ▼
UI updates instantly (optimistic, decrypted in memory)
    │
    ▼ [when navigator.onLine === true]
useSyncEngine decrypts pending records → POST array to API route
    │
    ▼
NeonDB stores plaintext (HIPAA server environment)
    │
    ▼
Dexie record → syncStatus: "synced"
```

**Conflict strategy:** Last-write-wins using `updatedAt` timestamp.
**Delete sync:** Not in POC scope. Local deletes only.
**Multi-device:** Not in scope. Single user per device assumed.

---

## Project Structure

```
/
├── CLAUDE.md                        ← You are here. Read before every task.
├── .github/
│   └── copilot-instructions.md      ← Copilot behavior rules
│
├── app/
│   ├── layout.tsx                   ← Includes LockScreen, SyncStatusBadge, ReAuthBanner
│   ├── page.tsx                     ← Notes dashboard / list
│   ├── notes/
│   │   └── [id]/
│   │       └── page.tsx             ← Note editor
│   ├── sign-in/[[...sign-in]]/
│   │   └── page.tsx                 ← Clerk sign-in
│   ├── sign-up/[[...sign-up]]/
│   │   └── page.tsx                 ← Clerk sign-up
│   └── api/
│       └── sync/
│           └── notes/
│               └── route.ts         ← POST: bulk upsert notes to NeonDB
│
├── lib/
│   ├── db/
│   │   ├── dexie.ts                 ← Local DB schema + Dexie instance
│   │   └── drizzle.ts               ← NeonDB client + Drizzle instance
│   ├── schema/
│   │   └── notes.ts                 ← Drizzle schema: notes table
│   ├── crypto/
│   │   ├── encrypt.ts               ← encryptRecord(data, key): Promise<EncryptedBlob>
│   │   ├── decrypt.ts               ← decryptRecord(blob, key): Promise<T>
│   │   ├── key.ts                   ← wrapKey(), unwrapKey()
│   │   └── pin.ts                   ← deriveMasterKey(pin, salt), lockSession(), unlockSession()
│   ├── auth/
│   │   └── offlineSession.ts        ← TTL check, reAuthPending flag, offlineSessionStart management
│   └── sync/
│       ├── engine.ts                ← Flush pending Dexie records to NeonDB
│       └── hooks.ts                 ← useSyncEngine, useOnlineStatus
│
├── components/
│   ├── LockScreen.tsx               ← Full screen PIN prompt overlay (not a route)
│   ├── SyncStatusBadge.tsx          ← "Syncing..." / "All synced" / "Offline"
│   ├── ReAuthBanner.tsx             ← "Re-authentication required when online" banner
│   └── ui/                         ← shadcn/ui components
│
└── public/
    ├── manifest.json                ← PWA manifest
    └── sw.js                        ← Serwist service worker (auto-generated)
```

---

## Data Models

### Notes (Dexie — local)
```ts
{
  id: string                       // UUID, client-side generated
  encryptedTitle: EncryptedBlob    // { iv: string, data: string }
  encryptedContent: EncryptedBlob  // { iv: string, data: string }
  createdAt: number                // Unix timestamp — NOT encrypted
  updatedAt: number                // Unix timestamp — NOT encrypted
  syncStatus: "pending" | "synced"
}
```

### Notes (NeonDB — remote)
```ts
{
  id: string
  userId: string
  title: string        // plaintext — HIPAA server environment
  content: string      // plaintext — HIPAA server environment
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Offline Session (Dexie — singleton, encrypted)
```ts
{
  id: "offline-session"
  encryptedData: EncryptedBlob  // { offlineSessionStart: number, reAuthPending: boolean }
}
```

### Wrapped Key (Dexie — singleton)
```ts
{
  id: "wrapped-crypto-key"
  wrappedKey: string   // base64 encoded AES-GCM key, safe to store
  salt: string         // PBKDF2 salt for PIN derivation
}
```

---

## Key Implementation Rules

1. **Always write to Dexie first.** Never write directly to NeonDB from UI.
2. **Always encrypt PHI fields before Dexie write.** `title` and `content` must never be plaintext in IndexedDB.
3. **UI must never wait for sync.** All interactions are optimistic.
4. **Sync only happens in `useSyncEngine`.** No inline sync in components.
5. **IDs generated client-side** via `crypto.randomUUID()`.
6. **`updatedAt` decides conflict resolution.** Always update on every write.
7. **API routes accept arrays.** Bulk upsert only — never single record.
8. **`SyncStatusBadge` and `ReAuthBanner`** must be in root layout, always visible.
9. **`LockScreen`** is a full-screen overlay rendered in root layout — never a route.
10. **PIN max 5 attempts.** Exceeded → wipe local session → force online re-auth.
11. **Never log decrypted content.** No PHI in console.log, error messages, or telemetry.

---

## HIPAA Compliance Summary

| Requirement | Implementation |
|---|---|
| PHI encrypted at rest | AES-GCM 256-bit on all PHI fields in IndexedDB |
| PHI encrypted in transit | HTTPS only + NeonDB TLS |
| Access control | Clerk auth + PIN lock screen |
| Automatic logoff | 10 min idle timeout + 5h offline TTL |
| Offline access window | Max 5 hours PIN-only, then forced online re-auth |
| Tamper-proof TTL | offlineSessionStart stored encrypted in IndexedDB |
| Brute force protection | Max 5 PIN attempts then local session wipe |
| BAA | Required with NeonDB before production |
| Audit logging | NeonDB-side (v2 feature) |
| No PHI in logs | Enforced by rule — never log decrypted fields |

---

## PIN Rules

- Minimum 6 digits (numeric) for POC.
- Max 5 wrong attempts → wipe local session → force online re-auth.
- Idle timeout: lock after 10 minutes of inactivity.
- Lock immediately on `visibilitychange` (app backgrounded or tab switched).
- PIN never stored. Only used transiently to derive MasterKey in memory.

---

## POC Constraints (do not over-engineer)

- Notes only. No chat, no file attachments, no rich text (plain text for POC).
- No real-time / websockets. Sync is pull-on-reconnect only.
- No delete sync. Local deletes only.
- No conflict UI. Last-write-wins silently.
- No push notifications.
- No multi-device. Single user per device.
- **Encryption is NOT optional even in POC.**

---

## Environment Variables

```env
DATABASE_URL=                          # NeonDB connection string (pooled)
DATABASE_URL_UNPOOLED=                 # NeonDB direct connection (for migrations)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
OFFLINE_SESSION_TTL_MS=18000000        # 5 hours in milliseconds
```