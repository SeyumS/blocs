import { Suspense } from 'react';
import ClaimPageContent from './claimPageContent';

export default function ClaimPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <ClaimPageContent />
    </Suspense>
  );
}