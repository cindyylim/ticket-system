# TicketHub

Full-stack ticketing system that treats **double-booking, flash-sale traffic, and live seat state** as first-class problems — the same constraints Ticketmaster has to get right.

TypeScript · Express · MongoDB · Redis · BullMQ · React · SSE · Jest

---

## Why this exists

Seat inventory is a shared mutable resource. Two users clicking the same seat, a hold that expires mid-checkout, and a surge that saturates the booking path are not edge cases — they are the product.

This repo is a working answer to those constraints: **atomic distributed locks**, a **Redis-backed waiting room**, **cross-instance live updates**, and **background reconciliation** between Redis and MongoDB.

## What a reviewer should look at

| Hard problem | Implementation | Signal |
|---|---|---|
| Two users cannot hold the same seat | Redis `SET key value EX ttl NX` | Atomic acquire; no check-then-set race |
| A user cannot release someone else's lock | Lua compare-and-delete on `lockId` | Ownership-safe unlock |
| Partial multi-seat hold | Acquire-all-or-rollback | No stranded locks |
| Flash-sale stampede | Redis sorted-set FIFO + concurrency cap (10 / event) | Admission control in front of booking |
| Only one instance advances a queue | `SET NX` processing lock | Safe if you run more than one API process |
| Seat map stays live across servers | Redis pub/sub → SSE fanout | Clients on instance B see locks from instance A |
| Redis TTL and Mongo status can drift | BullMQ job every minute | Expired holds return to inventory |
| Hot catalog reads | Cache-aside + pattern invalidation | Lists/details cached; search stays uncached |

Core paths: [`lock.service.ts`](backend/src/services/lock.service.ts) · [`booking.service.ts`](backend/src/services/booking.service.ts) · [`queue.service.ts`](backend/src/services/queue.service.ts) · [`sse.service.ts`](backend/src/services/sse.service.ts) · [`job.service.ts`](backend/src/services/job.service.ts)

---

## Booking flow

```mermaid
sequenceDiagram
    participant U as Client
    participant API as Express
    participant Q as Redis queue
    participant L as Redis lock
    participant DB as MongoDB
    participant SSE as SSE / pub-sub

    U->>API: POST /bookings/lock
    API->>Q: join sorted set (FIFO)
    alt over capacity
        API-->>U: queued + position + ETA
    else admitted
        Q-->>API: active set
        API->>L: SET NX EX per seat
        alt all locks acquired
            API->>DB: seats → locked
            API->>SSE: publish seatUpdate
            API-->>U: lockIds (10 min hold)
            U->>API: POST /bookings/confirm
            API->>L: verify lockId + userId
            API->>DB: seats → booked, create Booking
            API->>L: Lua release
            API->>SSE: publish seatUpdate
        else any lock fails
            API->>L: rollback acquired locks
            API-->>U: 400, retry
        end
    end
```

Seat state machine: `available → locked → booked`. Holds expire after `LOCK_TTL_SECONDS` (default 600). Confirm verifies the caller still owns each `lockId` before writing the booking.
---

## Tests

Jest + `ts-jest` · in-memory MongoDB · Supertest · Redis and BullMQ mocked.

20 test files across **models, services, routes, and middleware**. 

```bash
cd backend && npm test
```

---

## Stack

| Layer | Choice |
|---|---|
| API | Node.js, Express, TypeScript |
| Data | MongoDB, Mongoose (compound + unique indexes) |
| Coordination | Redis / ioredis (locks, cache, sorted sets, pub/sub) |
| Jobs | BullMQ (repeatable lock cleanup) |
| Auth | JWT + bcrypt |
| Client | React 18, TypeScript, Vite, React Router, Zustand, EventSource |
| Tests | Jest, Supertest, mongodb-memory-server |

---

## Screenshots

<img width="1440" height="785" alt="Login" src="https://github.com/user-attachments/assets/9fd5d9a6-6a57-4345-b838-e0cf8a4dde80" />
<img width="1440" height="781" alt="Event catalog" src="https://github.com/user-attachments/assets/5df7b683-1dde-47c4-9696-6391d6b7fb71" />
<img width="1440" height="778" alt="Event detail" src="https://github.com/user-attachments/assets/dcfa8810-9c63-4787-92e9-5155ec0ad979" />
<img width="1440" height="778" alt="Seat map" src="https://github.com/user-attachments/assets/dd030ccf-8567-4b98-b035-584a48f4c4fb" />
<img width="1330" height="720" alt="Waiting queue" src="https://github.com/user-attachments/assets/d48db181-3af6-43a6-9bcc-019cb93fa724" />
<img width="1440" height="778" alt="Checkout" src="https://github.com/user-attachments/assets/dc6caa2c-0493-483a-b448-81c6ca488e45" />
<img width="1440" height="778" alt="My tickets" src="https://github.com/user-attachments/assets/5637a81e-3b73-44f9-8b87-13594d134d46" />

Client: interactive seat map with live SSE status (`available` / selected / locked by others / booked), waiting-room modal with position, 10-minute checkout hold, JWT session via Zustand.

---

## Run locally

Needs Node.js 18+, MongoDB, and Redis.

```bash
# API
cd backend
npm install
cp .env.example .env   # MONGODB_URI, REDIS_URI, JWT_SECRET
npm run seed           # venues, performers, events, seats + test user
npm run dev            # http://localhost:5000

# Client (second terminal)
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Seeded login: `test@example.com` / `password123`

Seat colors: green available · blue selected · yellow locked · gray booked.

---

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | | Liveness |
| `POST` | `/api/auth/register`, `/login` | | JWT |
| `GET` | `/api/events` | | Paginated catalog, category, search |
| `GET` | `/api/events/:id/seats` | | Seat map |
| `GET` | `/api/sse/events/:eventId/seats` | | SSE seat stream |
| `POST` | `/api/bookings/lock` | JWT | Queue + hold seats |
| `GET` | `/api/bookings/queue/:eventId` | JWT | Position / ETA / `canProceed` |
| `POST` | `/api/bookings/confirm` | JWT | Finalize if locks still owned |
| `POST` | `/api/bookings/unlock` | JWT | Release hold |
| `GET` | `/api/bookings/my-bookings` | JWT | Purchase history |

---

## Layout

```
backend/src/
  services/     lock, queue, booking, sse, cache, jobs, redis
  models/       User, Event, Venue, Performer, Seat, Booking
  routes/       auth, events, bookings, sse, queue, venues, performers
  middleware/   JWT auth, error handler
  tests/        models / services / routes / middleware
frontend/src/
  pages/        catalog, event, seats, checkout, tickets, login
  hooks/        useSSE, useAuth
  store/        Zustand auth
```
