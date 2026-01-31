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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

interface Order {
  id: string;
  order_number: string;
  ordered_at: string;
  status: string;
  amount: number;
  paid_amount: number;
  currency: string;
  due_date: string;
}

export default function OpportunityDetailPage() {
  const params = useParams();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [accountOrders, setAccountOrders] = useState<Order[]>([]);
  const [totalOrdersAmount, setTotalOrdersAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { t, formatCurrency } = useLanguage();

  const fetchAccountOrders = async (accountId: string) => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('account_id', accountId)
      .order('ordered_at', { ascending: false });

    if (data) {
      setAccountOrders(data);
      const total = data.reduce((sum, order) => sum + (Number(order.amount) || 0), 0);
      setTotalOrdersAmount(total);
    }
  };

  useEffect(() => {
    const fetchOpportunity = async () => {
      const { data } = await supabase
        .from('opportunities')
        .select('*, account:accounts!opportunities_account_id_fkey(*), contact:contacts!opportunities_contact_id_fkey(*), owner:profiles!opportunities_owner_id_fkey(*)')
        .eq('id', params.id)
        .maybeSingle();

      if (data) {
        setOpportunity(data);
        if (data.account_id) {
          await fetchAccountOrders(data.account_id);
        }
      }
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
                      <p className="text-foreground">
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
                      <p className="text-foreground">
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
                      <p className="text-foreground">{formatCurrency(opportunity.amount || 0)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('opportunities.table.probability')}</Label>
                      <p className="text-foreground">{opportunity.probability}%</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('opportunities.table.close_date')}</Label>
                      <p className="text-foreground">
                        {opportunity.close_date ? new Date(opportunity.close_date).toLocaleDateString() : '-'}
                      </p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>{t('common.description')}</Label>
                      <p className="text-foreground">{opportunity.description || '-'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('opportunities.table.owner')}</Label>
                      <p className="text-foreground">{opportunity.owner?.full_name}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            label: t('common.related'),
            value: 'related',
            content: (
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium">{t('opportunities.related_orders') || 'Related Orders'}</h3>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">{t('opportunities.total_orders_amount') || 'Total Orders Amount'}</p>
                        <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalOrdersAmount)}</p>
                      </div>
                    </div>
                    {accountOrders.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">{t('orders.no_orders')}</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('orders.table.order_number')}</TableHead>
                            <TableHead>{t('orders.table.date')}</TableHead>
                            <TableHead>{t('common.status')}</TableHead>
                            <TableHead>{t('orders.table.amount')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {accountOrders.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell className="font-medium">{order.order_number}</TableCell>
                              <TableCell>{new Date(order.ordered_at).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <Badge>{t(`status.${order.status.toLowerCase()}`)}</Badge>
                              </TableCell>
                              <TableCell>{formatCurrency(order.amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
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
