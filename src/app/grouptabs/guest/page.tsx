import { Suspense } from 'react';
import GuestContent from './GuestContent';

export default function GuestGroupTabPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <GuestContent />
    </Suspense>
  );
}
