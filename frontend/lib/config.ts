// frontend/lib/config.ts
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";
// If running frontend inside Docker, set NEXT_PUBLIC_BACKEND_URL=http://host.docker.internal:3000
