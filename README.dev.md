# Development Environment Setup
## Prerequisites
- Docker & Docker Compose
- Node.js 18+

## Quick Start
1. **Clone & Setup:**
   ```bash
   git clone <repo>
   cd <repo>
   cp .env.example .env
   # Fill in .env (defaults usually work for local dev)
   ```

2. **Start Services (DB, Redis, MinIO):**
   ```bash
   docker-compose up -d postgres redis minio
   ```

3. **Backend Dev:**
   ```bash
   cd backend
   npm install
   npm run migrate:up
   npm run dev
   ```

4. **Frontend Dev:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Access at `http://localhost:3001`

## Tests
- `cd backend && npm test` (or run manual scripts in `test/`)

## Architecture
- **Backend:** Node/Express + Socket.io + Postgres + Redis
- **Frontend:** Next.js + Tailwind + Canvas Renderer
- **Engine:** Shared TS library (`shared/riverport-engine`) used by both.
