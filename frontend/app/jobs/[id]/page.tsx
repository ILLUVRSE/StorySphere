// frontend/app/jobs/[id]/page.tsx
import React from "react";
import JobClient from "./job-client";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobClient id={id} />;
}
