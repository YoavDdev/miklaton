# Events Security Refactor (YOA-5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All emergency-events reads/writes go through authenticated API routes (login cookie OR event invite-token), guest identity is derived server-side, browser Supabase clients are removed from event pages, and events tables + storage are locked to anon.

**Architecture:** A single `requireEventAccess(request, eventId)` gate in `lib/auth.js` (mirrors `requireRole`), consumed by every `/api/events/*` route. Guests authenticate with an `X-Event-Token` header equal to the event's `invite_token` (timing-safe compare). Pages poll the API (10s, existing pattern) instead of Supabase Realtime. A final SQL migration removes the temporary `anon_full_temp` policies and the public storage INSERT policy — deployed code must land **before** the migration runs.

**Tech Stack:** Next.js 14 App Router (JS), Supabase JS v2 (service-role server-side only), `lib/auth.js` helpers, `lib/rate-limit.js`.

**Spec:** `docs/superpowers/specs/2026-08-17-events-security-design.md`

## Global Constraints

- No test framework exists in this repo (CI/tests = YOA-14). Each task's "test" steps are `npm run build` + scripted `curl` checks against the dev server (`npm run dev`, port 3000) — run them exactly as written.
- Response shape convention: `{ success: true, data }` / `{ success: false, error }` with proper HTTP status — keep it on every route.
- Auth errors: 401 `{ success: false, error: 'לא מחובר' }`; 404 event: `{ success: false, error: 'אירוע לא נמצא' }`. Guests must NEVER receive `phone`/`guest_phone` of participants.
- Existing invite links keep working: never regenerate `invite_token` for existing events.
- Do NOT touch `middleware.js` (event pages stay public by design) and do NOT run the SQL migration during development — it runs in production only after deploy (Task 14 notes).
- Work on branch `yoa-5-events-security` off `main`. Commit after every task.

## File Structure

| File | Responsibility |
|---|---|
| `lib/auth.js` (modify) | + `generateEventToken()`, `requireEventAccess()` |
| `app/api/events/route.js` (modify) | list/create/close/delete — `requireRole`, crypto token, `summary` in PATCH |
| `app/api/events/[id]/route.js` (modify) | single-event GET — `requireEventAccess`, guest sanitization |
| `app/api/events/[id]/journal/route.js` (modify) | journal POST — server-side identity + length limit |
| `app/api/events/[id]/journal/[entryId]/route.js` (create) | PATCH pin/task, DELETE map_marker |
| `app/api/events/[id]/participants/[participantId]/route.js` (create) | PATCH field_status/display_name |
| `app/api/events/[id]/map-data/route.js` (modify) | GET/PUT — `requireEventAccess` |
| `app/api/events/[id]/join/route.js` (modify) | authed join — `requireRole`, user from JWT |
| `app/api/events/join/route.js` (modify) | token join — rate limit + slim response |
| `app/api/events/upload/route.js` (modify) | `requireEventAccess` + active-event check |
| `app/api/events/live/[token]/route.js` (create) | guest page data endpoint |
| `app/event/live/[token]/page.js` (modify) | remove Supabase client; poll live endpoint; writes send `X-Event-Token` |
| `app/events/[id]/page.js` (modify) | remove Supabase client; writes via API |
| `components/ActiveEventBanner.js` (modify) | poll instead of realtime |
| `supabase/migrations/20260817_events_lockdown.sql` (create) | drop temp policies, storage INSERT policy, realtime publication |

---

### Task 1: Event-token helpers in `lib/auth.js`

**Files:**
- Modify: `lib/auth.js` (append after `verifyDutyFormToken`, before `requireRole`)

**Interfaces:**
- Produces: `generateEventToken(length = 16): string` — crypto-random, alphabet `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789`.
- Produces: `requireEventAccess(request, eventId): Promise<{ user?, guest?, event } | { error: NextResponse }>` — `user` = JWT payload when logged in; `guest: true` when `X-Event-Token` matches; always includes loaded `event` row on success.

- [ ] **Step 1: Add the code**

```js
// --- Event access (emergency events) ---

const EVENT_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/**
 * טוקן הזמנה קריפטוגרפי לאירוע חדש (מחליף את Math.random הישן).
 */
export function generateEventToken(length = 16) {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += EVENT_TOKEN_ALPHABET[bytes[i] % EVENT_TOKEN_ALPHABET.length];
  }
  return result;
}

let eventSupabase = null;
function getEventSupabase() {
  if (!eventSupabase) {
    // service role בלבד - הטבלאות נעולות ל-anon אחרי המיגרציה
    const { createClient } = require('@supabase/supabase-js');
    eventSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return eventSupabase;
}

/**
 * שער גישה לאירוע: משתמש מחובר (עוגיית auth-token) או אורח עם
 * header בשם X-Event-Token שתואם את invite_token של האירוע.
 * מחזיר את האירוע הטעון כדי לחסוך שליפה כפולה ב-route.
 */
export async function requireEventAccess(request, eventId) {
  const supabase = getEventSupabase();
  const { data: event } = await supabase
    .from('emergency_events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (!event) {
    return { error: NextResponse.json({ success: false, error: 'אירוע לא נמצא' }, { status: 404 }) };
  }

  const authResult = await verifyAuth(request);
  if (authResult.valid) {
    return { user: authResult.user, event };
  }

  const token = request.headers.get('x-event-token');
  if (token && safeCompare(token, event.invite_token)) {
    return { guest: true, event };
  }

  return { error: NextResponse.json({ success: false, error: 'לא מחובר' }, { status: 401 }) };
}
```

Note: `crypto` and `NextResponse` are already imported at the top of `lib/auth.js`; `safeCompare` and `verifyAuth` already exist in the file.

- [ ] **Step 2: Verify token generator**

Run: `node -e "const {generateEventToken}=require('./lib/auth.js'); const t=generateEventToken(); console.log(t, t.length); if(!/^[A-HJ-NP-Za-km-z2-9]{16}$/.test(t)) process.exit(1)"`
Expected: prints a 16-char token, exit 0. (If Node complains about ESM, verify instead in Step 3 of Task 2 via the API.)

- [ ] **Step 3: Build**

Run: `npm run build 2>&1 | grep -E "(Compiled|error)" | head -3`
Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit** — `git add lib/auth.js && git commit -m "feat: event token helpers (crypto token + requireEventAccess)"`

---

### Task 2: `app/api/events/route.js` — requireRole + crypto token + summary

**Files:**
- Modify: `app/api/events/route.js`

**Interfaces:**
- Consumes: `generateEventToken` from Task 1.
- Produces: `PATCH /api/events` now accepts `{ id, status?: 'closed', summary?: string }` — summary-only update allowed for creator/admin/operator; close flow unchanged but also saves `summary` when provided.

- [ ] **Step 1: Replace imports and manual auth**

Replace lines 3-4 imports with `import { requireRole, generateEventToken } from '@/lib/auth';` (drop `verifyToken`, `cookies`). Delete the local `generateToken` function (lines 11-18).

In **GET**: first lines become:
```js
const auth = await requireRole(request);
if (auth.error) return auth.error;
```

In **POST**: replace the cookie/verifyToken block (lines 47-56) with the same two `requireRole` lines, then use `auth.user` instead of `decoded` (`auth.user.userId`, `auth.user.role`). Replace `const invite_token = generateToken();` with `const invite_token = generateEventToken();`.

In **PATCH**: replace the cookie block the same way (`const decoded = auth.user;` keeps the body unchanged), and extend the handler: after the `if (status === 'closed') { ... }` block, add a summary-only branch:
```js
if (summary !== undefined) {
  const { data: event } = await supabase
    .from('emergency_events').select('created_by').eq('id', id).single();
  if (event?.created_by !== decoded.userId && decoded.role !== 'admin' && decoded.role !== 'operator') {
    return NextResponse.json({ success: false, error: 'אין הרשאה' }, { status: 403 });
  }
  const { data, error } = await supabase
    .from('emergency_events').update({ summary }).eq('id', id).select().single();
  if (error) throw error;
  return NextResponse.json({ success: true, data });
}
```
Destructure `const { id, status, summary } = body;` and inside the close flow add `...(summary !== undefined ? { summary } : {})` to the update object.

In **DELETE**: replace the cookie block with `requireRole` the same way.

- [ ] **Step 2: Verify**

Run (dev server up): `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/events` → Expected `401`.
Run: `npm run build 2>&1 | grep -cE "Compiled successfully"` → Expected `1`.

- [ ] **Step 3: Commit** — `git commit -am "security: events list/create/close require login; crypto invite token; summary via PATCH"`

---

### Task 3: `app/api/events/[id]/route.js` — requireEventAccess + guest sanitization

**Files:**
- Modify: `app/api/events/[id]/route.js`

**Interfaces:**
- Produces: response unchanged for logged-in users; for guests, each participant object omits `phone` and `guest_phone`, and the `event` object omits `invite_token` is NOT required (guest already holds it) — keep event as-is.

- [ ] **Step 1: Rewrite GET**

```js
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireEventAccess } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const stripPhones = (p) => {
  const { phone, guest_phone, ...rest } = p;
  return rest;
};

// GET - get single event with participants and journal
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const access = await requireEventAccess(request, id);
    if (access.error) return access.error;

    const [participantsRes, journalRes] = await Promise.all([
      supabase.from('event_participants').select('*').eq('event_id', id).order('joined_at'),
      supabase.from('event_journal').select('*').eq('event_id', id).order('created_at', { ascending: true }),
    ]);

    const participants = access.guest
      ? (participantsRes.data || []).map(stripPhones)
      : (participantsRes.data || []);

    return NextResponse.json({
      success: true,
      data: {
        event: access.event,
        participants,
        journal: journalRes.data || [],
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify** — `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/events/00000000-0000-0000-0000-000000000000` → Expected `404` (event lookup precedes auth) and `curl` on a garbage non-UUID id → `404`/`500` but never a data payload.

- [ ] **Step 3: Commit** — `git commit -am "security: single-event GET requires login or event token; guests get no phones"`

---

### Task 4: journal POST — server-side identity + length limit

**Files:**
- Modify: `app/api/events/[id]/journal/route.js`

**Interfaces:**
- Consumes: `requireEventAccess` (Task 1).
- Produces (contract change): clients may STOP sending `author_name`/`author_role`/`author_field_status` — the server derives them. For guests `participant_id` is REQUIRED. Request body keeps: `entry_type, content, image_url, location_lat, location_lng, location_address, assigned_to, task_status, participant_id`.

- [ ] **Step 1: Rewrite POST**

```js
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireEventAccess } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MAX_CONTENT_LENGTH = 5000;

// POST - add journal entry (identity is derived server-side)
export async function POST(request, { params }) {
  try {
    const { id: event_id } = await params;

    const access = await requireEventAccess(request, event_id);
    if (access.error) return access.error;

    if (access.event.status === 'closed') {
      return NextResponse.json({ success: false, error: 'Event is closed' }, { status: 400 });
    }

    const body = await request.json();
    const { entry_type, content, participant_id, image_url, location_lat, location_lng, location_address, assigned_to, task_status } = body;

    if (!content && !image_url) {
      return NextResponse.json({ success: false, error: 'Content or image required' }, { status: 400 });
    }
    if (content && content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ success: false, error: `תוכן ארוך מדי (מקסימום ${MAX_CONTENT_LENGTH} תווים)` }, { status: 400 });
    }

    // זהות הכותב נקבעת בשרת - לא מה-body
    let author_name, author_role, author_field_status = null, resolvedParticipantId = null;

    if (access.user) {
      const { data: profile } = await supabase
        .from('user_profiles').select('full_name').eq('id', access.user.userId).single();
      author_name = profile?.full_name || access.user.fullName || 'לא ידוע';
      author_role = access.user.role;
      if (participant_id) {
        const { data: p } = await supabase
          .from('event_participants').select('id, field_status').eq('id', participant_id).eq('event_id', event_id).single();
        if (p) { resolvedParticipantId = p.id; author_field_status = p.field_status || null; }
      }
    } else {
      // אורח: חייב participant_id ששייך לאירוע הזה
      if (!participant_id) {
        return NextResponse.json({ success: false, error: 'participant_id required' }, { status: 400 });
      }
      const { data: p } = await supabase
        .from('event_participants')
        .select('id, display_name, role, field_status')
        .eq('id', participant_id).eq('event_id', event_id).single();
      if (!p) {
        return NextResponse.json({ success: false, error: 'משתתף לא נמצא באירוע' }, { status: 403 });
      }
      resolvedParticipantId = p.id;
      author_name = p.display_name;
      author_role = p.role || null;
      author_field_status = p.field_status || null;
    }

    const { data, error } = await supabase
      .from('event_journal')
      .insert({
        event_id,
        participant_id: resolvedParticipantId,
        author_name,
        author_role,
        entry_type: entry_type || 'update',
        content: content || '',
        image_url: image_url || null,
        location_lat: location_lat || null,
        location_lng: location_lng || null,
        location_address: location_address || null,
        assigned_to: assigned_to || null,
        task_status: entry_type === 'task' ? (task_status || 'pending') : null,
        author_field_status,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

Exception: "מערכת" (system) entries are only created server-side by other routes — this route never accepts `author_name`, so impersonating "מערכת" is impossible.

- [ ] **Step 2: Verify** — `curl -s -X POST -H 'Content-Type: application/json' -d '{"content":"x"}' -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/events/00000000-0000-0000-0000-000000000000/journal` → Expected `404`.

- [ ] **Step 3: Commit** — `git commit -am "security: journal entries require event access; author identity derived server-side"`

---

### Task 5: New journal entry route — pin / task / delete marker

**Files:**
- Create: `app/api/events/[id]/journal/[entryId]/route.js`

**Interfaces:**
- Produces: `PATCH /api/events/:id/journal/:entryId` body `{ is_pinned?: boolean, task_status?: string, assigned_to?: string }` → `{ success, data }`. `DELETE` same path — only entries with `entry_type === 'map_marker'`.

- [ ] **Step 1: Create the file**

```js
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireEventAccess } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// PATCH - update journal entry (pin, task status, assignment)
export async function PATCH(request, { params }) {
  try {
    const { id: eventId, entryId } = await params;

    const access = await requireEventAccess(request, eventId);
    if (access.error) return access.error;
    if (access.event.status === 'closed') {
      return NextResponse.json({ success: false, error: 'Event is closed' }, { status: 400 });
    }

    const body = await request.json();
    const updates = {};
    if (typeof body.is_pinned === 'boolean') updates.is_pinned = body.is_pinned;
    if (body.task_status !== undefined) updates.task_status = body.task_status;
    if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('event_journal')
      .update(updates)
      .eq('id', entryId)
      .eq('event_id', eventId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - remove a map marker entry only
export async function DELETE(request, { params }) {
  try {
    const { id: eventId, entryId } = await params;

    const access = await requireEventAccess(request, eventId);
    if (access.error) return access.error;
    if (access.event.status === 'closed') {
      return NextResponse.json({ success: false, error: 'Event is closed' }, { status: 400 });
    }

    const { error } = await supabase
      .from('event_journal')
      .delete()
      .eq('id', entryId)
      .eq('event_id', eventId)
      .eq('entry_type', 'map_marker');

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify** — `curl -s -X PATCH -H 'Content-Type: application/json' -d '{"is_pinned":true}' -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/events/00000000-0000-0000-0000-000000000000/journal/x` → Expected `404`.

- [ ] **Step 3: Commit** — `git commit -am "feat: journal entry PATCH/DELETE endpoints (pin, task, map markers)"`

---

### Task 6: New participants route — field status / display name

**Files:**
- Create: `app/api/events/[id]/participants/[participantId]/route.js`

**Interfaces:**
- Produces: `PATCH /api/events/:id/participants/:participantId` body `{ field_status?: string, display_name?: string }` → `{ success, data }` (data = updated participant, phones stripped for guests).

- [ ] **Step 1: Create the file**

```js
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireEventAccess } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// PATCH - update participant (field status / display name)
export async function PATCH(request, { params }) {
  try {
    const { id: eventId, participantId } = await params;

    const access = await requireEventAccess(request, eventId);
    if (access.error) return access.error;

    const body = await request.json();
    const updates = {};
    if (body.field_status !== undefined) {
      updates.field_status = body.field_status;
      updates.field_status_updated_at = new Date().toISOString();
    }
    if (body.display_name !== undefined) updates.display_name = body.display_name;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('event_participants')
      .update(updates)
      .eq('id', participantId)
      .eq('event_id', eventId)
      .select()
      .single();

    if (error) throw error;

    if (access.guest && data) {
      const { phone, guest_phone, ...rest } = data;
      return NextResponse.json({ success: true, data: rest });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify** — curl PATCH to a fake event id → Expected `404`.

- [ ] **Step 3: Commit** — `git commit -am "feat: participant PATCH endpoint (field status, display name)"`

---

### Task 7: map-data — requireEventAccess

**Files:**
- Modify: `app/api/events/[id]/map-data/route.js`

- [ ] **Step 1: Replace auth in both handlers**

Replace the file's imports of `cookies`/`verifyToken` with `import { requireEventAccess } from '@/lib/auth';`. In **GET** (currently no auth) add at the top of the try:
```js
const { id } = await params;
const access = await requireEventAccess(request, id);
if (access.error) return access.error;
```
In **PUT** replace the manual cookie block with the same two lines, plus after it:
```js
if (access.event.status === 'closed') {
  return NextResponse.json({ success: false, error: 'Event is closed' }, { status: 400 });
}
```
Keep the existing update logic (writes `event_locations` / `road_blocks`).

- [ ] **Step 2: Verify** — GET fake id → `404`; build passes.

- [ ] **Step 3: Commit** — `git commit -am "security: map-data requires event access; guests may edit per spec"`

---

### Task 8: join routes — rate limit + JWT identity + slim response

**Files:**
- Modify: `app/api/events/join/route.js` (public token join)
- Modify: `app/api/events/[id]/join/route.js` (authed join)

**Interfaces:**
- `POST /api/events/join` responses keep their current shape but `event` is trimmed to `{ id, title, description, severity, status, event_type, created_at, created_by_name }` at EVERY return site (lookup, confirm, decline, already-joined).

- [ ] **Step 1: `events/join` (token join)**

Add imports: `import { rateLimit } from '@/lib/rate-limit';`. First line of POST:
```js
const limited = rateLimit(request, 'event-join', { limit: 10, windowMs: 60_000 });
if (limited) return limited;
```
Add a helper at module level and use it at every place the handler returns the event object (the report maps them at lines ~64, 73, 128, 201):
```js
const publicEvent = (e) => e && ({
  id: e.id, title: e.title, description: e.description, severity: e.severity,
  status: e.status, event_type: e.event_type, created_at: e.created_at,
  created_by_name: e.created_by_name,
});
```
Replace each `event` / `event: event` in response payloads with `event: publicEvent(event)`. Do NOT change the phone-matching logic.

- [ ] **Step 2: `[id]/join` (authed join)**

Replace body-supplied `user_id` with the JWT: add `import { requireRole } from '@/lib/auth';`, start POST with the standard two lines, delete the `user_id` extraction from body and use `auth.user.userId` wherever `user_id` was used (profile lookup, participant insert, journal entry).

- [ ] **Step 3: Verify** — `curl -s -X POST -H 'Content-Type: application/json' -d '{"action":"lookup","token":"nope"}' http://localhost:3000/api/events/join` → still returns its normal "not found" error (public route works); 11 rapid repeats → last one `429`. `[id]/join` without cookie → `401`.

- [ ] **Step 4: Commit** — `git commit -am "security: rate-limit token join + slim event payload; authed join uses JWT identity"`

---

### Task 9: upload — event access + active check

**Files:**
- Modify: `app/api/events/upload/route.js`

- [ ] **Step 1: Add the gate**

Add `import { requireEventAccess } from '@/lib/auth';`. After `eventId` is read from formData (line ~13) and the null-check, add:
```js
const access = await requireEventAccess(request, String(eventId));
if (access.error) return access.error;
if (access.event.status === 'closed') {
  return NextResponse.json({ success: false, error: 'Event is closed' }, { status: 400 });
}
```
Keep all existing file validation (type/size/extension/path sanitization).

- [ ] **Step 2: Verify** — POST with a tiny png and fake event_id → `404`; without any auth on a real-shaped id → `404` (not found) or `401`.

- [ ] **Step 3: Commit** — `git commit -am "security: image upload requires event access and active event"`

---

### Task 10: New guest data endpoint — `GET /api/events/live/[token]`

**Files:**
- Create: `app/api/events/live/[token]/route.js`

**Interfaces:**
- Produces: `GET /api/events/live/:token?phone=05x...` → `{ success: true, data: { event, journal, participants, myParticipant } }` where `event` is the full row MINUS `invite_token` is fine to include (caller holds it) — return full row; `participants` phones-stripped; `myParticipant` = the caller's full own participant row (matched by normalized phone server-side) or `null`.

- [ ] **Step 1: Create the file**

```js
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const normalizePhone = (p) => (p || '').replace(/[-\s]/g, '');

// GET - כל נתוני האירוע לדף האורח. הטוקן בנתיב הוא האישור.
export async function GET(request, { params }) {
  try {
    const limited = rateLimit(request, 'event-live', { limit: 60, windowMs: 60_000 });
    if (limited) return limited;

    const { token } = await params;
    const { searchParams } = new URL(request.url);
    const phone = normalizePhone(searchParams.get('phone'));

    const { data: event } = await supabase
      .from('emergency_events')
      .select('*')
      .eq('invite_token', token)
      .single();

    if (!event) {
      return NextResponse.json({ success: false, error: 'אירוע לא נמצא' }, { status: 404 });
    }

    const [participantsRes, journalRes] = await Promise.all([
      supabase.from('event_participants').select('*').eq('event_id', event.id).order('joined_at'),
      supabase.from('event_journal').select('*').eq('event_id', event.id).order('created_at', { ascending: true }),
    ]);

    const all = participantsRes.data || [];
    const myParticipant = phone
      ? all.find((p) => normalizePhone(p.phone) === phone || normalizePhone(p.guest_phone) === phone) || null
      : null;

    const participants = all.map(({ phone: _p, guest_phone: _g, ...rest }) => rest);

    return NextResponse.json({
      success: true,
      data: { event, journal: journalRes.data || [], participants, myParticipant },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify** — `curl -s http://localhost:3000/api/events/live/WRONGTOKEN` → `404`; with a real token from the DB (ask the running app or skip if no local data) → participants have no `phone` key.

- [ ] **Step 3: Commit** — `git commit -am "feat: guest live-event data endpoint (token-authenticated, phones stripped)"`

---

### Task 11: Guest page refactor — `app/event/live/[token]/page.js`

**Files:**
- Modify: `app/event/live/[token]/page.js` (860 lines)

**Interfaces:**
- Consumes: Task 10 endpoint, Task 4 journal POST, Task 5 PATCH/DELETE, Task 7 map-data PUT, Task 9 upload. Every write sends header `'X-Event-Token': token` (token from `useParams`).

Site map of what to replace (line numbers from the pre-refactor audit — re-locate by content):

| Current (direct Supabase) | Replace with |
|---|---|
| module lines 11-14: `createClient(...)` | delete import + client |
| L74-75 `refreshJournal` select | re-fetch via Task 10 endpoint (see loadData below) |
| L91-142 realtime `.channel(...)` subscriptions | delete entirely |
| L165-185 initial load (event by token, journal, participants selects) | single `loadData()` |
| L191-196 client-side phone matching | use `myParticipant` from response |
| L344 journal `task_status` update | `PATCH /api/events/${event.id}/journal/${entryId}` body `{ task_status: 'done', assigned_to: myName }` |
| L531 journal delete (map marker) | `DELETE /api/events/${event.id}/journal/${entryId}` |
| L539/568/597/626 `emergency_events` update (locations/road blocks) | `PUT /api/events/${event.id}/map-data` body `{ event_locations, road_blocks }` |

- [ ] **Step 1: Replace data loading**

```js
const loadData = async () => {
  try {
    const phoneQ = phone ? `?phone=${encodeURIComponent(phone)}` : '';
    const res = await fetch(`/api/events/live/${token}${phoneQ}`);
    if (!res.ok) { setLoading(false); return; }
    const { data } = await res.json();
    setEvent(data.event);
    setJournal(data.journal);
    setParticipants(data.participants);
    setParticipant(data.myParticipant);
    setLoading(false);
  } catch { setLoading(false); }
};

useEffect(() => {
  loadData();
  const interval = setInterval(loadData, 10000);
  return () => clearInterval(interval);
}, [token, phone]);
```
Delete the old `refreshJournal`, the realtime `useEffect`, and the Supabase import/client. Keep the existing state variable names so the rest of the page compiles.

- [ ] **Step 2: Replace the write sites** per the table above. Shared helper at top of component:

```js
const eventHeaders = { 'Content-Type': 'application/json', 'X-Event-Token': token };
```
Each write follows with `await loadData();` to refresh (replaces realtime). The journal POST calls that already exist in the page keep working but must ALSO add the `X-Event-Token` header and stop sending `author_name`/`author_role` (server derives; send `participant_id: participant?.id`). The upload call (L226) adds the header too — note `FormData` requests must NOT set Content-Type manually: `fetch('/api/events/upload', { method: 'POST', headers: { 'X-Event-Token': token }, body: formData })`.

- [ ] **Step 3: Verify** — `npm run build` passes; `grep -c "supabase" app/event/live/[token]/page.js` → `0`.

- [ ] **Step 4: Commit** — `git commit -am "refactor: guest event page uses API polling + event-token header (no browser Supabase)"`

---

### Task 12: Operator event page refactor — `app/events/[id]/page.js`

**Files:**
- Modify: `app/events/[id]/page.js` (1641 lines)

**Interfaces:**
- Consumes: `GET /api/events/[id]` (Task 3), journal PATCH/DELETE (Task 5), participants PATCH (Task 6), map-data PUT (Task 7), events PATCH with summary (Task 2). All calls are cookie-authenticated (same-origin fetch) — no header needed.

Site map (pre-refactor audit line numbers):

| Current | Replace with |
|---|---|
| L13-16 anon client | delete |
| L78-86 `saveMapData` direct update | `PUT /api/events/${eventId}/map-data` body `{ event_locations, road_blocks }` (8 call sites stay unchanged — only the helper body changes) |
| L105-106 `refreshJournal` select + L174 poll | poll `GET /api/events/${eventId}` every 10s and set event/journal/participants from it (one `loadData`, like Task 11) |
| L123-171 realtime subscriptions | delete |
| L199-200, 254-258 `user_profiles` selects (display-name repair) | delete the repair block entirely — server now derives names |
| L217-219 initial selects | `loadData()` via `GET /api/events/${eventId}` |
| L262-265 participant `display_name` update | delete (part of the repair block) |
| L303-309 `field_status` update | `PATCH /api/events/${eventId}/participants/${participant.id}` body `{ field_status }` |
| L503 pin toggle | `PATCH .../journal/${entry.id}` body `{ is_pinned: !entry.is_pinned }` |
| L509 task done | `PATCH .../journal/${entry.id}` body `{ task_status: 'done', assigned_to: name }` |
| L547-550 marker delete | `DELETE .../journal/${entry.id}` |
| L651 summary update + L653 PATCH close | single `PATCH /api/events` body `{ id: eventId, status: 'closed', summary }` (Task 2 supports it) |

Journal POST calls in this page (13 sites) keep their current fetch but stop sending `author_name`/`author_role`/`author_field_status` — pass `participant_id` where the code has it (the server now derives identity from the logged-in cookie; participant_id only enriches field_status).

- [ ] **Step 1: Implement** per the table. Keep all state names and UI intact.
- [ ] **Step 2: Verify** — build passes; `grep -c "supabase\|postgres_changes" "app/events/[id]/page.js"` → `0`.
- [ ] **Step 3: Commit** — `git commit -am "refactor: operator event page uses API polling; all writes via endpoints"`

---

### Task 13: ActiveEventBanner — polling

**Files:**
- Modify: `components/ActiveEventBanner.js` (258 lines)

- [ ] **Step 1: Replace realtime + direct reads**

Delete the anon client (L7-10) and both realtime subscriptions (L34-39, L63-93). Replace the direct selects:
- Active event (L102-106) → `const res = await fetch('/api/events?status=active'); const { data } = await res.json();` — poll every 30s via `setInterval` in the mount `useEffect`.
- Journal count (L53-56) → when an active event exists, `fetch('/api/events/' + activeEvent.id)` inside the same 30s tick and use `data.journal.length` for the unread badge (keep the existing localStorage last-seen logic).
The event-creation POST (L115) is already API-based — unchanged. Note: the banner is mounted only on logged-in dashboards, so the cookie is always present.

- [ ] **Step 2: Verify** — build passes; `grep -c "supabase" components/ActiveEventBanner.js` → `0`.
- [ ] **Step 3: Commit** — `git commit -am "refactor: ActiveEventBanner polls API instead of Supabase realtime"`

---

### Task 14: Lockdown migration

**Files:**
- Create: `supabase/migrations/20260817_events_lockdown.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- נעילת טבלאות האירועים + Storage (סוגר את הריפקטור - YOA-5)
-- להריץ בפרודקשן רק אחרי פריסת הקוד החדש!
-- הקוד החדש עובד כולו דרך service role; ה-anon key לא נזקק יותר
-- לטבלאות האלו (אין Realtime ואין כתיבות מהדפדפן).
-- ============================================================

do $$
declare
  t text;
  pol record;
begin
  foreach t in array array['emergency_events', 'event_journal', 'event_participants'] loop
    execute format('alter table public.%I enable row level security', t);
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    -- אפס policies = נעילה מלאה ל-anon/authenticated (כמו שאר הטבלאות)
  end loop;
end $$;

-- Storage: ביטול ההעלאה הציבורית ל-bucket התמונות (העלאה רק דרך ה-API)
drop policy if exists "Allow upload event images" on storage.objects;
-- קריאה ציבורית של תמונות נשארת ("Public read event images")

-- Realtime: הדפים עברו ל-polling - אין צורך בפרסום הטבלאות
do $$
begin
  begin
    alter publication supabase_realtime drop table public.emergency_events;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime drop table public.event_journal;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime drop table public.event_participants;
  exception when others then null;
  end;
end $$;
```

- [ ] **Step 2: Do NOT run it locally/production now.** It runs manually in the Supabase SQL Editor only after the code deploy is verified (see Task 15).
- [ ] **Step 3: Commit** — `git commit -am "db: events lockdown migration (run after deploy)"`

---

### Task 15: Full verification + merge gate

- [ ] **Step 1: Build + grep sweep**

```bash
npm run build
grep -rn "supabase" "app/event/live/[token]/page.js" "app/events/[id]/page.js" components/ActiveEventBanner.js | grep -v "^Binary" ; echo "expect: no output"
```

- [ ] **Step 2: Anonymous curl suite (dev server up)**

```bash
for r in "events" "events/00000000-0000-0000-0000-000000000000"; do
  curl -s -o /dev/null -w "%{http_code}  /api/$r\n" "http://localhost:3000/api/$r"
done
# expect: 401 (list), 404 (fake id)
curl -s -o /dev/null -w "%{http_code}  live/WRONG\n" http://localhost:3000/api/events/live/WRONGTOKEN   # 404
curl -s -X POST -H 'Content-Type: application/json' -d '{"content":"x","participant_id":"y"}' \
  -o /dev/null -w "%{http_code}  journal-noauth\n" \
  http://localhost:3000/api/events/00000000-0000-0000-0000-000000000000/journal                          # 404
```

- [ ] **Step 3: End-to-end with a real event (requires a login)** — creator flow in the browser: create event → journal entry → pin → task → map location → image upload → open invite link in an incognito tab → join by phone → guest journal entry → guest map edit → close event with summary → verify guest write now returns 400. This step needs the user's credentials — hand the checklist to the user if not available.
- [ ] **Step 4: Code review** — run `/code-review medium` on the branch, fix findings, commit.
- [ ] **Step 5: Merge gate** — present to the user: merge+deploy, then run Task 14's migration in Supabase, then re-run the user regression list (spec §6).

## Self-Review Notes

- Spec coverage: §1 helpers→T1; §2 table rows→T2 (list/create/PATCH), T3 (single GET), T4 (journal POST), T5 (journal PATCH/DELETE), T6 (participants), T7 (map-data), T8 (both joins), T9 (upload), T10 (live endpoint); §3 pages→T11-T13; §4 migration→T14; §6 regression→T15. Gap check: spec's "`GET /api/events` דורש התחברות" → T2 ✓; rate limiting on join → T8 ✓; crypto tokens → T1+T2 ✓.
- Type consistency: `requireEventAccess` returns `{ user?, guest?, event }` — used consistently in T3-T9; header name `X-Event-Token` (client) / `x-event-token` (server read) consistent; journal PATCH body fields match T11/T12 call sites.
- Ordering note: T2-T10 are backward-compatible with the OLD pages (old pages use anon RLS which stays open until T14 runs in production), so tasks can be deployed incrementally, but merge as one branch.
