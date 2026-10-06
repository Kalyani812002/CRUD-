# CURD Task Management

Daymark is a task management application with a responsive React interface and an Express API backed by MongoDB. It supports creating, viewing, editing, and deleting tasks, with status-based navigation and search.

## Technology

- Frontend: React, Vite, Lucide React
- Backend: Node.js, Express 5, Mongoose
- Database: MongoDB
- Environment configuration: dotenv

## Project Structure

```text
frontend/
	src/                 React application, task form, and styles
	index.html           Frontend HTML entry point
	vite.config.js       Vite build config and /api proxy
	package.json         Frontend scripts and dependencies
backend/
	config/              MongoDB connection
	controllers/         HTTP request handlers
	models/              Mongoose Task model
	routes/              API route definitions
	server.js            Express application entry point
	.env.example         Backend configuration template
package.json           Workspace scripts
.gitignore             Ignored files (.env, node_modules, dist, data/)
```

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- A running MongoDB instance or MongoDB Atlas URI

## Installation

Run these commands from the project root:

```sh
npm install
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set the connection string for your MongoDB instance:

```env
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/task-management
```

For MongoDB Atlas, use the connection URI supplied by Atlas as `MONGODB_URI`. Keep credentials in `backend/.env`; real `.env` files are ignored by Git. The committed `.env.example` contains placeholders only.

The backend connects to MongoDB before opening its HTTP port. Tasks are stored in the `tasks` collection and receive an automatic `createdAt` value.

## Run Locally

Start the frontend and backend together:

```sh
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:3001`

The Vite development server proxies `/api` requests to Express. To run one workspace separately:

```sh
npm run dev:frontend
npm run dev:backend
```

Start the backend without file watching with `npm start`. The API defaults to port `3001`, matching the Vite proxy. To use another port with `npm run dev`, set `PORT` in the shell before starting the root command so both Vite and Express use the same value; keep `backend/.env` in sync when starting the backend separately.

## Google Sign-In

The login page can offer **Continue with Google** via Google Identity Services when `VITE_GOOGLE_CLIENT_ID` is set in `frontend/.env` (see `frontend/.env.example`).

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **APIs & Services** → **Credentials** → your *Web application* OAuth client ID, add these **Authorized JavaScript origins** (otherwise Google rejects the request with an origin error):

- `http://localhost:5173` — local development
- `https://<project>.vercel.app` — the deployed Vercel frontend (use your real Vercel domain)

## CORS

The Express API only sets CORS headers for allowed origins:

- `http://localhost:5173` (local frontend)
- `https://*.vercel.app` (deployed frontend)
- Any extra origins listed in `CORS_ALLOWED_ORIGINS` in `backend/.env` (comma-separated)

`OPTIONS` preflights are answered with `204`, and the `Authorization` and `Content-Type` request headers are allowed for `GET, POST, PUT, PATCH, DELETE`.

## API Reference

All task endpoints use MongoDB. Task status is one of `Pending`, `In Progress`, or `Done`.

| Method | Endpoint | Purpose | Success |
| --- | --- | --- | --- |
| GET | `/` | Confirm the API is running | `200` status message |
| GET | `/api/health` | Check API health | `200` `{ "status": "ok" }` |
| GET | `/api/notifications/status` | Check email/SMS/WhatsApp configuration | `200` `{ "configured", "provider", "from", "enabled", "sms": {...}, "whatsapp": {...} }` |
| POST | `/api/notifications/test` | Send a test email | `200` success message |
| POST | `/api/notifications/sms/test` | Send a test SMS | `200` success message |
| POST | `/api/notifications/whatsapp/test` | Send a test WhatsApp message | `200` success message |
| GET | `/api/tasks` | List tasks, newest first | `200` task array |
| POST | `/api/tasks` | Create a task | `201` created task |
| PUT | `/api/tasks/:id` | Partially update a task | `200` updated task |
| DELETE | `/api/tasks/:id` | Delete a task | `200` success message |

Create a task with JSON:

```json
{
	"title": "Review project plan",
	"description": "Check milestones and owners.",
	"status": "Pending"
}
```

`title` is required and cannot be empty. `description` is optional. If omitted, `status` defaults to `Pending`; `createdAt` is assigned by the backend. `PUT` accepts any subset of `title`, `description`, and `status`.

Invalid input or malformed task IDs return `400`. A valid ID for a task that does not exist returns `404`. Unexpected server or database failures return `500` with a JSON error message.

## Email Notifications

The backend sends an email when a task is assigned to a user and when an assigned task is updated (title, description, or status changes are listed in the message). Emails are sent with [nodemailer](https://nodemailer.com) over SMTP and configured entirely through `backend/.env`:

```env
EMAIL_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
MAIL_FROM=Daymark <no-reply@example.com>
```

Notes:

- Notifications are fire-and-forget: SMTP failures are logged with an `[email]` prefix but never fail or delay a task API response. With `SMTP_HOST` unset (the default), sending is skipped entirely, so task CRUD works without any email setup.
- Use `GET /api/notifications/status` to check whether email is configured and `POST /api/notifications/test` with `{ "email": "you@example.com" }` to verify SMTP end to end.
- `SMTP_SECURE=true` is for implicit TLS (port 465); leave it `false` for STARTTLS ports such as 587.

## SMS Notifications

Alongside email, the backend sends an SMS when a task is assigned to a user and when an assigned task is updated. Recipients are users with a **phone number** set on their profile (Users page → Add/Edit, optional field); numbers without a country code get `SMS_DEFAULT_COUNTRY_CODE` prepended and are normalized to E.164 before sending.

The SMS gateway is configurable through `backend/.env` — either a generic JSON webhook or Twilio:

```env
SMS_ENABLED=true

# Option A — generic webhook (default provider): POSTs { "to", "message", "from" }
SMS_PROVIDER=webhook
SMS_API_URL=https://sms.example.com/api/send
SMS_API_KEY=your-api-key        # optional; sent as "Authorization: Bearer <key>"
SMS_API_HEADER=Authorization    # optional header name override
SMS_API_PREFIX=Bearer           # optional prefix (set empty for raw key)
SMS_FROM=Daymark                # optional sender id

# Option B — Twilio
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM=+15550001111

SMS_DEFAULT_COUNTRY_CODE=+1     # used when a stored number has no country code
```

Notes:

- SMS sending is fire-and-forget like email: failures are logged with an `[sms]` prefix and never fail or delay a task API response. With no provider configured (`SMS_API_URL` empty and no Twilio credentials), sending is skipped entirely.
- Use `POST /api/notifications/sms/test` with `{ "phone": "+15550101234" }` to verify the gateway end to end; `GET /api/notifications/status` includes an `sms` block with the active provider.
- Any provider that accepts a JSON `POST { to, message }` payload works for `webhook`; set `SMS_API_KEY`/`SMS_API_HEADER`/`SMS_API_PREFIX` to match its authentication scheme.

## WhatsApp Notifications

Alongside email and SMS, the backend sends a WhatsApp message when a task is assigned to a user and when an assigned task is updated. Recipients are users with a **phone number** on their profile — the same field SMS uses, normalized to E.164 (with `WHATSAPP_DEFAULT_COUNTRY_CODE` as the fallback when a stored number has no country code).

The gateway is configurable through `backend/.env` — either a generic JSON webhook or the Meta WhatsApp Business Cloud API:

```env
WHATSAPP_ENABLED=true

# Option A — generic webhook (default provider): POSTs { "to", "message", "from" }
WHATSAPP_PROVIDER=webhook
WHATSAPP_API_URL=https://wa.example.com/api/send
WHATSAPP_API_KEY=your-api-key        # optional; sent as "Authorization: Bearer <key>"
WHATSAPP_API_HEADER=Authorization    # optional header name override
WHATSAPP_API_PREFIX=Bearer           # optional prefix (set empty for raw key)
WHATSAPP_FROM=Daymark                # optional sender id

# Option B — Meta WhatsApp Business Cloud API
WHATSAPP_PROVIDER=meta
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_TOKEN=EAAG...               # permanent or temporary access token
WHATSAPP_API_VERSION=v21.0           # Graph API version used in the URL
WHATSAPP_GRAPH_URL=https://graph.facebook.com

WHATSAPP_DEFAULT_COUNTRY_CODE=+1     # fallback when a stored number has no country code
```

Notes:

- WhatsApp sending is fire-and-forget like email and SMS: failures are logged with a `[whatsapp]` prefix and never fail or delay a task API response. With no provider configured (`WHATSAPP_API_URL` empty and no Meta credentials), sending is skipped entirely.
- Use `POST /api/notifications/whatsapp/test` with `{ "phone": "+15550101234" }` to verify the gateway end to end; `GET /api/notifications/status` includes a `whatsapp` block with the active provider.
- The `meta` provider sends free-form text messages, so the destination number must be subscribed to your WhatsApp Business sender. Any gateway that accepts a JSON `POST { to, message }` works with `webhook`.

## Validation

```sh
npm run lint
npm run build
```