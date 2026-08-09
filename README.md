# Medicare Hub: Hospital Appointment & AI Healthcare Assistant Platform

Medicare Hub is a production-grade, full-stack healthcare platform connecting patients with medical specialists. It contains a responsive patient-facing website, a separate secure portal for medical doctors, and a voice-enabled AI Healthcare Assistant powered by Gemini API with real-time doctor recommendation lookups.

---

## 1. Project Structure

The project is initialized as a unified Next.js App Router full-stack TypeScript application styling with Tailwind CSS v4.

```
/
├── supabase_setup.sql          # Complete Postgres database schema, indices & triggers
├── package.json                # Dependencies configuration
├── next.config.ts              # Next.js configurations
├── postcss.config.mjs          # Tailwind CSS postcss setup
├── tsconfig.json               # TypeScript configurations
├── src/
│   ├── middleware.ts           # Role-based route protection middleware & session sync
│   ├── app/
│   │   ├── layout.tsx          # Patient-facing HTML skeleton & Navbar mount
│   │   ├── page.tsx            # Patient home landing view
│   │   ├── login/              # Patient secure session login
│   │   ├── register/           # Patient account sign up
│   │   ├── profile/            # Patient demographic profile completion form
│   │   ├── dashboard/          # Patient appointments list & actions (Cancel/Reschedule)
│   │   ├── doctors/            # Patient doctor search & filtration panel
│   │   │   └── [id]/           # Live doctor availability slot booking calendar
│   │   ├── assistant/          # Hands-free Voice AI Healthcare Assistant panel
│   │   ├── doctor/
│   │   │   ├── layout.tsx      # Doctor-facing layout wrapper (desktop sidebar pad)
│   │   │   ├── login/          # Doctor secure session login
│   │   │   ├── register/       # Doctor account signup
│   │   │   ├── dashboard/      # Doctor daily metrics, notifications & today's schedule
│   │   │   ├── profile/        # Doctor credentials setup & verification triggers
│   │   │   ├── availability/   # Doctor weekly availability slots & blocked dates manager
│   │   │   └── appointments/   # Doctor patients consultation log & action manager
│   │   └── api/
│   │       ├── chat/           # Gemini AI session stream, message logger & database tool
│   │       │   └── [sessionId] # Fetch messages history logs
│   │       └── appointments/   # Strict backend schedule collision validator
│   │           └── [id]        # Cancellation (DELETE) & Reschedule (PATCH) handlers
│   ├── components/
│   │   ├── Navbar.tsx          # Patient site header & auth sync wrapper
│   │   ├── Sidebar.tsx         # Doctor portal drawer & verification status indicator
│   │   └── NotificationBell.tsx# Live websocket notifications client via Supabase Realtime
│   └── lib/
│       ├── supabase.ts         # Supabase Client client wrapper
│       ├── supabaseServer.ts   # Cookie-backed Supabase Server client helper
│       └── gemini.ts           # Gemini system prompt & function calling tools
```

---

## 2. Database Schema

The platform relies on a relational PostgreSQL database (configured natively via Supabase). The schema, triggers, and Row-Level Security (RLS) constraints are stored in [supabase_setup.sql](file:///c:/Users/acer/OneDrive/Desktop/Hospital/supabase_setup.sql).

### Key Tables & Relations

1. **`profiles`**: Links to Supabase Auth UUID. Maps user emails to roles (`PATIENT`, `DOCTOR`, `ADMIN`).
2. **`patient_profiles`**: Personal demographics (DOB, Gender, Contact, Emergency details).
3. **`doctor_profiles`**: Professional credentials (specialty, registration number, fee, hospital, language). Holds a `verification_status` flag (`PENDING`, `VERIFIED`, `REJECTED`).
4. **`doctor_availability`**: Maps weekdays (0-6) to consultation slots (Start Time, End Time, duration, lunch break interval).
5. **`doctor_blocked_dates`**: Unavailability log (vacation/leaves) to prevent booking collision.
6. **`appointments`**: Bookings mapping patients, doctors, date, time slot, visit reason, notes, and status (`BOOKED`, `CONFIRMED`, `CANCELLED`, `COMPLETED`).
7. **`notifications`**: WebSocket-driven alert logs.
8. **`chat_sessions`** & **`chat_messages`**: Chat logs for AI conversation history.

### Double-Booking Prevention Index
A partial unique index prevents two active appointments from occupying the same slot on the database level:
```sql
CREATE UNIQUE INDEX unique_active_doctor_appointment 
ON public.appointments (doctor_id, appointment_date, start_time) 
WHERE (appointment_status != 'CANCELLED');
```

---

## 3. Environment Variables (`.env.local`)

To run the application, create a `.env.local` file at the root:

```bash
# Supabase Postgres connection url (optional, for migrations)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Supabase Auth, DB, and Realtime keys
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-secret-key

# Gemini AI API Configuration (Kept server-side, never public)
GEMINI_API_KEY=AIzaSy...

# Public App Url for redirects
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 4. Setup Instructions & Running Locally

### Step 1: Database Initialization
1. Create a project in [Supabase](https://supabase.com).
2. Go to the **SQL Editor** tab in your Supabase dashboard.
3. Paste the contents of [supabase_setup.sql](file:///c:/Users/acer/OneDrive/Desktop/Hospital/supabase_setup.sql) and click **Run**.
4. Enable **Realtime replication** on the `notifications` table:
   Go to Database -> Replication -> Click '1 table' under 'supabase_realtime' and toggle the switch for `notifications` and `appointments` to enable websocket broadcasts.

### Step 2: Install Dependencies
Run the following commands in your workspace:
```bash
npm install
```

### Step 3: Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the portal.

---

## 5. How to Create Initial Accounts & Test Flow

### Patient Account
1. Open the landing page and click **Get Started** or go to `/register`.
2. Register an email.
3. Fill in your demographics on `/profile`. (You must set Date of Birth, Gender, and Phone to book appointments).

### Doctor Account
1. Go to the Doctor registration portal at `/doctor/register`.
2. Register your email. You will be redirected to the professional profile page `/doctor/profile`.
3. Complete your qualifications, hospital name, address, consultation fee, and languages.
4. **Verification Step**: Since there is no admin panel in development, click the **"Demo: Self-Verify Profile"** button at the top of the profile page. This changes your status from `PENDING` to `VERIFIED` in the database, allowing patients to book you.
5. Setup Availability: Go to `/doctor/availability` (Schedule & Availability) and click the checkboxes for active weekdays, adjust work times/breaks, and click **Save Weekly Schedule**.

---

## 6. How Core Features Work

### Real-Time Appointment Sync & Notifications
When a patient books a date and time slot:
1. The backend API `/api/appointments` validates the slot (working hour checks, overlaps, blocks).
2. If validated, it inserts a row in `appointments` and writes notification alerts for both users in `notifications`.
3. The doctor's dashboard uses a **Supabase Realtime PostgreSQL channel** that listens to changes in the `notifications` and `appointments` tables. The unread bell count increments and a browser alert is shown instantly without page refreshes.

### Voice AI Healthcare Assistant
Located at `/assistant`, the chatbot offers conversational assistance:
1. **Speech-to-Text**: Built using native browser `webkitSpeechRecognition` with active audio permissions detection and indicator states (*Listening*, *Processing*).
2. **AI Logic (Server-side)**: The API route `/api/chat` passes the message along with conversation history securely to Gemini.
3. **Multilingual Support**: Gemini automatically detects if the prompt is in English, Hindi, or Hinglish and replies in the matching dialect.
4. **Database-Linked Lookup (Tool Calling)**: If the patient describes symptoms (e.g. skin rash), Gemini invokes the `search_doctors_by_specialization` function. The server queries active doctors from the PostgreSQL database and returns them.
5. **Interactive UI Cards**: The UI parses doctor list payloads and renders clickable booking buttons directly in the chat balloon.
6. **Text-to-Speech**: Browser-native `speechSynthesis` speaks the AI response using `hi-IN` for Hindi / Hinglish and `en-US` for English (supporting mute toggles).

---

## 7. Security and Constraints

- **Role-Based Guards**: Protected by Next.js middleware checking database claims on each request. Patients cannot load `/doctor/*` dashboards and doctors are blocked from client bookings.
- **Backend Ownership Verification**: Endpoint route handlers derive user ID from session cookies using secure Supabase server clients. All actions (Cancelling, Rescheduling, viewing medical notes) verify that the authenticated caller matches the `patient_id` or `doctor_id`.
- **Database Row-Level Security**: Enabled on all tables to enforce strict user-isolation. Cross-user reading is blocked.

---

## 8. Limitations & External Integrations

- **Transactional Email Notifications**: The backend structure supports email triggers via `EMAIL_API_KEY`. If not supplied, email triggers bypass gracefully to database notifications. To enable email broadcasts, connect an SMTP or Resend API template inside `/api/appointments/route.ts`.
- **Browser-Specific Speech Recognition**: Web Speech API is supported natively in Chrome, Edge, and Safari. Firefox and legacy browsers require polyfills. A text-input fallback is always present.
