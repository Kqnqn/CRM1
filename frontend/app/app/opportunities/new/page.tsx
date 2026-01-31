'use client';

import { useSearchParams } from 'next/navigation';
import { OpportunityForm } from '@/components/opportunities/opportunity-form';

export default function NewOpportunityPage() {
  const searchParams = useSearchParams();
  const initialAccountId = searchParams.get('accountId') || undefined;

  return <OpportunityForm initialAccountId={initialAccountId} />;
}
