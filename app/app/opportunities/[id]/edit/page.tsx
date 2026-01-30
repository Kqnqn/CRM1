'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, Opportunity } from '@/lib/supabase/client';
import { OpportunityForm } from '@/components/opportunities/opportunity-form';

export default function EditOpportunityPage() {
    const params = useParams();
    const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOpportunity = async () => {
            const { data } = await supabase
                .from('opportunities')
                .select('*')
                .eq('id', params.id)
                .maybeSingle();

            if (data) setOpportunity(data);
            setLoading(false);
        };
        fetchOpportunity();
    }, [params.id]);

    if (loading) return <div className="p-6">Loading...</div>;
    if (!opportunity) return <div className="p-6">Opportunity not found</div>;

    return <OpportunityForm initialData={opportunity} />;
}
