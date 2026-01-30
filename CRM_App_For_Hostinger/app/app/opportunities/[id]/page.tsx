'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, Opportunity } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/language-context';

import { RecordHeader } from '@/components/shared/record-header';
import { RecordTabs } from '@/components/shared/record-tabs';
import { ActivityTimeline } from '@/components/shared/activity-timeline';
import { DocumentsTab } from '@/components/accounts/documents-tab';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function OpportunityDetailPage() {
  const params = useParams();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const { t, formatCurrency } = useLanguage();

  useEffect(() => {
    const fetchOpportunity = async () => {
      const { data } = await supabase
        .from('opportunities')
        .select('*, account:accounts!opportunities_account_id_fkey(*), contact:contacts!opportunities_contact_id_fkey(*), owner:profiles!opportunities_owner_id_fkey(*)')
        .eq('id', params.id)
        .maybeSingle();

      if (data) setOpportunity(data);
      setLoading(false);
    };
    fetchOpportunity();
  }, [params.id]);

  if (loading) return <div className="p-6">{t('dashboard.loading')}</div>;
  if (!opportunity) return <div className="p-6">{t('opportunities.no_opportunities')}</div>;

  return (
    <div>
      <RecordHeader
        title={opportunity.name}
        status={t(`stage.${opportunity.stage.toLowerCase()}`)}
        actions={[
          {
            label: t('common.edit'),
            variant: 'outline',
            onClick: () => window.location.href = `/app/opportunities/${opportunity.id}/edit`
          }
        ]}
        fields={[
          { label: t('opportunities.table.amount'), value: formatCurrency(opportunity.amount || 0) },
          { label: t('opportunities.table.probability'), value: `${opportunity.probability}%` },
          { label: t('opportunities.table.close_date'), value: opportunity.close_date ? new Date(opportunity.close_date).toLocaleDateString() : '-' },
        ]}
      />

      <RecordTabs
        tabs={[
          {
            label: t('common.details'),
            value: 'details',
            content: (
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>{t('opportunities.table.account')}</Label>
                      <p className="text-gray-900">
                        {opportunity.account && (
                          <Link
                            href={`/app/accounts/${opportunity.account.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {opportunity.account.name}
                          </Link>
                        )}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('nav.contacts')}</Label>
                      <p className="text-gray-900">
                        {opportunity.contact ? (
                          <Link
                            href={`/app/contacts/${opportunity.contact.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {opportunity.contact.first_name} {opportunity.contact.last_name}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('opportunities.table.stage')}</Label>
                      <div>
                        <Badge>{t(`stage.${opportunity.stage.toLowerCase()}`)}</Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('opportunities.table.amount')}</Label>
                      <p className="text-gray-900">{formatCurrency(opportunity.amount || 0)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('opportunities.table.probability')}</Label>
                      <p className="text-gray-900">{opportunity.probability}%</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('opportunities.table.close_date')}</Label>
                      <p className="text-gray-900">
                        {opportunity.close_date ? new Date(opportunity.close_date).toLocaleDateString() : '-'}
                      </p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>{t('common.description')}</Label>
                      <p className="text-gray-900">{opportunity.description || '-'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('opportunities.table.owner')}</Label>
                      <p className="text-gray-900">{opportunity.owner?.full_name}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            label: t('common.documents'),
            value: 'documents',
            content: <DocumentsTab entityType="OPPORTUNITY" entityId={params.id as string} />,
          },
          {
            label: t('common.activity'),
            value: 'activity',
            content: <ActivityTimeline relatedToType="OPPORTUNITY" relatedToId={params.id as string} />,
          },
        ]}
      />
    </div>
  );
}
