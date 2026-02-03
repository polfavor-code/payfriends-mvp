import { Suspense } from 'react';
import ReviewContent from './ReviewContent';

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ReviewContent />
    </Suspense>
  );
}
