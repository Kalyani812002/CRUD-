# Daymark Task Management

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

## API Reference

All task endpoints use MongoDB. Task status is one of `Pending`, `In Progress`, or `Done`.

| Method | Endpoint | Purpose | Success |
| --- | --- | --- | --- |
| GET | `/` | Confirm the API is running | `200` status message |
| GET | `/api/health` | Check API health | `200` `{ "status": "ok" }` |
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

## Validation

```sh
npm run lint
npm run build
```