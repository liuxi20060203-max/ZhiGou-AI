import { Suspense } from 'react';
import { ReviewWorkbench } from '@/components/learning/review-workbench';

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8" aria-busy="true">
          Loading…
        </main>
      }
    >
      <ReviewWorkbench />
    </Suspense>
  );
}
