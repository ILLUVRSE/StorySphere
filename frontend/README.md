# Frontend (StorySphere)

## Run locally
1. Install:
   ```bash
   cd frontend
   npm install
   ```

2. Start dev server and point at backend:

   ```bash
   # If backend at http://localhost:3000 (docker-compose up for backend):
   NEXT_PUBLIC_BACKEND_URL=http://localhost:3000 npm run dev
   ```

3. If running full stack with docker-compose, recommended to set:
   `NEXT_PUBLIC_BACKEND_URL=http://host.docker.internal:3000` inside the `frontend` container.

## Smoke test with curl

```bash
curl -X POST http://localhost:3000/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Hello world","title":"smoke","style":"cinematic","voice":"default","language":"en","duration_target":30,"produce_preview":true}'
```

This returns `{ "jobId": "...", ... }`. Poll job:

```bash
curl http://localhost:3000/api/v1/jobs/<jobId>
```
