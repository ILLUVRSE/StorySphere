'use client';

import { redirect } from 'next/navigation';

export default function RiverportRedirect() {
  // Preserve existing /games/riverport links by redirecting to the new experience
  redirect('/riverport');
}
