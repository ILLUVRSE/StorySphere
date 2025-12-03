// frontend/app/jobs/[id]/job-client.tsx
"use client";
import React from "react";

interface JobResult {
  preview_url?: string;
}

interface JobData {
  [key: string]: unknown;
}

interface Job {
  id: string;
  state: string;
  progress: number;
  data: JobData;
  result?: JobResult;
  failedReason?: string;
}

export default function JobClient({ id }: { id: string }) {
  const [job, setJob] = React.useState<Job | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

  React.useEffect(() => {
    let mounted = true;

    async function fetchJob() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/jobs/${id}`);
        if (!res.ok) {
          if (mounted) setError(`Failed: ${res.status} ${res.statusText}`);
          return;
        }
        const data = await res.json();
        if (mounted) {
          setJob(data);
          setError(null);
        }
      } catch (err: unknown) {
        if (mounted) {
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError("Network error");
          }
        }
      }
    }

    fetchJob();
    const t = setInterval(fetchJob, 1200);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [id, BACKEND_URL]);

  if (error) return <div className="p-6 text-red-400">Error: {error}</div>;
  if (!job) return <div className="p-6">Loading job…</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-serif mb-2">Job {job.id}</h2>
      <div>State: <strong>{job.state}</strong></div>
      <div>Progress: <strong>{job.progress ?? 0}%</strong></div>

      <h3 className="mt-4 font-medium">Submitted data</h3>
      <pre className="bg-black/10 p-3 rounded">{JSON.stringify(job.data, null, 2)}</pre>

      {job.result?.preview_url && (
        <div className="mt-4">
          <h3 className="font-medium">Preview</h3>
          <video controls src={job.result.preview_url} className="w-full max-h-96 bg-black" />
        </div>
      )}

      {job.failedReason && (
        <div className="mt-4 text-red-500">
          <strong>Failed:</strong> {job.failedReason}
        </div>
      )}
    </div>
  );
}
