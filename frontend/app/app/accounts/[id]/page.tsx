'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, Account, Contact, Opportunity } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { RecordHeader } from '@/components/shared/record-header';
import { RecordTabs } from '@/components/shared/record-tabs';
import { ActivityTimeline } from '@/components/shared/activity-timeline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { canUpdate, canDelete } from '@/lib/auth/permissions';
import Link from 'next/link';
import { Plus, RotateCcw } from 'lucide-react';
import { DocumentsTab } from '@/components/accounts/documents-tab';
import { OrdersTab } from '@/components/accounts/orders-tab';
import { FollowUpSection } from '@/components/accounts/followup-section';
import { useLanguage } from '@/lib/i18n/language-context';

const stageColors: Record<string, any> = {
  OPEN: 'default',
  CLOSED_WON: 'default',
  CLOSED_LOST: 'destructive',
};

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile, user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeStage, setCloseStage] = useState<'CLOSED_WON' | 'CLOSED_LOST'>('CLOSED_WON');
  const [lostReason, setLostReason] = useState('');
  const { t, formatCurrency } = useLanguage();

  const fetchAccount = async () => {
    const { data, error } = await supabase
      .from('accounts')
      .select('*, owner:profiles!accounts_owner_id_fkey(*)')
      .eq('id', params.id)
      .maybeSingle();

    if (data && !error) {
      setAccount(data);
      setFormData(data);
    }
  };

  const fetchRelated = async () => {
    const [contactsRes, oppsRes] = await Promise.all([
      supabase
        .from('contacts')
        .select('*, owner:profiles!contacts_owner_id_fkey(*)')
        .eq('account_id', params.id),
      supabase
        .from('opportunities')
        .select('*, owner:profiles!opportunities_owner_id_fkey(*)')
        .eq('account_id', params.id),
    ]);

    if (contactsRes.data) setContacts(contactsRes.data);
    if (oppsRes.data) setOpportunities(oppsRes.data);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchAccount(), fetchRelated()]);
      setLoading(false);
    };
    fetchData();
  }, [params.id]);

  const handleUpdate = async () => {
    const { error } = await supabase
      .from('accounts')
      .update({
        name: formData.name,
        industry: formData.industry,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        postal_code: formData.postal_code,
        country: formData.country,
        phone: formData.phone,
        website: formData.website,
      })
      .eq('id', params.id);

    if (!error) {
      setEditing(false);
      fetchAccount();
    }
  };

  const handleClose = async () => {
    if (closeStage === 'CLOSED_LOST' && !lostReason.trim()) {
      alert(t('common.required_field'));
      return;
    }

    const { error } = await supabase
      .from('accounts')
      .update({
        stage: closeStage,
        closed_at: new Date().toISOString(),
        lost_reason: closeStage === 'CLOSED_LOST' ? lostReason : null,
      })
      .eq('id', params.id);

    if (!error) {
      await supabase.from('audit_log').insert({
        entity_type: 'ACCOUNT',
        entity_id: params.id as string,
        action: 'STAGE_CHANGE',
        old_value: account?.stage,
        new_value: closeStage,
        user_id: user?.id,
      });

      setShowCloseDialog(false);
      fetchAccount();
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('common.delete_confirm_record'))) return;

    const { error } = await supabase.from('accounts').delete().eq('id', params.id);

    if (!error) {
      router.push('/app/accounts');
    }
  };

  const handleReopen = async () => {
    if (!confirm(t('common.reopen_confirm'))) return;

    const { error } = await supabase
      .from('accounts')
      .update({
        stage: 'OPEN',
        closed_at: null,
      })
      .eq('id', params.id);

    if (!error) {
      await supabase.from('activities').insert({
        type: 'NOTE',
        subject: 'Account Reopened',
        description: 'Account reopened from Closed Lost status',
        related_to_type: 'ACCOUNT',
        related_to_id: params.id as string,
        owner_id: user?.id,
        status: 'COMPLETED',
      });

      fetchAccount();
    }
  };

  if (loading) {
    return <div className="p-6">{t('dashboard.loading')}</div>;
  }

  if (!account) {
    return <div className="p-6">{t('accounts.no_accounts')}</div>;
  }

  const canEdit = profile && canUpdate(profile.role, account.owner_id, user?.id);
  const canRemove = profile && canDelete(profile.role);

  const actions = [];
  if (account.stage === 'OPEN' && canEdit) {
    actions.push({
      label: t('accounts.close_account'),
      onClick: () => setShowCloseDialog(true),
    });
  }
  if (account.stage === 'CLOSED_LOST' && canEdit) {
    actions.push({
      label: t('accounts.reopen_account'),
      onClick: handleReopen,
      icon: <RotateCcw className="h-4 w-4" />,
    });
  }

  const moreActions = [];
  if (canEdit) {
    moreActions.push({
      label: editing ? t('common.edit_cancel') : t('common.edit'),
      onClick: () => setEditing(!editing),
    });
  }
  if (canRemove) {
    moreActions.push({
      label: t('common.delete'),
      onClick: handleDelete,
    });
  }

  return (
    <div>
      <RecordHeader
        title={account.name}
        status={t(`stage.${account.stage.toLowerCase()}`)}
        statusVariant={stageColors[account.stage]}
        fields={[
          { label: t('common.industry'), value: account.industry || '-' },
          { label: t('common.phone'), value: account.phone || '-' },
          { label: t('accounts.table.owner'), value: account.owner?.full_name || '' },
        ]}
        actions={actions}
        moreActions={moreActions}
      />

      <RecordTabs
        tabs={[
          {
            label: t('common.details'),
            value: 'details',
            content: (
              <Card>
                <CardContent className="p-6">
                  {account.stage === 'CLOSED_LOST' && account.lost_reason && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-medium text-red-800">{t('accounts.lost_reason')}:</p>
                      <p className="text-sm text-red-700 mt-1">{account.lost_reason}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>{t('accounts.table.name')}</Label>
                      {editing ? (
                        <Input
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                        />
                      ) : (
                        <p className="text-gray-900">{account.name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>{t('common.industry')}</Label>
                      {editing ? (
                        <Input
                          value={formData.industry || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, industry: e.target.value })
                          }
                        />
                      ) : (
                        <p className="text-gray-900">{account.industry || '-'}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>{t('common.phone')}</Label>
                      {editing ? (
                        <Input
                          value={formData.phone || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                        />
                      ) : (
                        <p className="text-gray-900">{account.phone || '-'}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>{t('common.website')}</Label>
                      {editing ? (
                        <Input
                          value={formData.website || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, website: e.target.value })
                          }
                        />
                      ) : (
                        <p className="text-gray-900">{account.website || '-'}</p>
                      )}
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>{t('common.street_address')}</Label>
                      {editing ? (
                        <Input
                          value={formData.address || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, address: e.target.value })
                          }
                        />
                      ) : (
                        <p className="text-gray-900">{account.address || '-'}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>{t('common.city')}</Label>
                      {editing ? (
                        <Input
                          value={formData.city || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, city: e.target.value })
                          }
                        />
                      ) : (
                        <p className="text-gray-900">{account.city || '-'}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>{t('common.state')}</Label>
                      {editing ? (
                        <Input
                          value={formData.state || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, state: e.target.value })
                          }
                        />
                      ) : (
                        <p className="text-gray-900">{account.state || '-'}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>{t('common.postal_code')}</Label>
                      {editing ? (
                        <Input
                          value={formData.postal_code || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, postal_code: e.target.value })
                          }
                        />
                      ) : (
                        <p className="text-gray-900">{account.postal_code || '-'}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>{t('common.country')}</Label>
                      {editing ? (
                        <Input
                          value={formData.country || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, country: e.target.value })
                          }
                        />
                      ) : (
                        <p className="text-gray-900">{account.country || '-'}</p>
                      )}
                    </div>
                  </div>

                  {editing && (
                    <div className="mt-6 flex justify-end space-x-3">
                      <Button variant="outline" onClick={() => setEditing(false)}>
                        {t('common.cancel')}
                      </Button>
                      <Button onClick={handleUpdate}>{t('common.save_changes')}</Button>
                    </div>
                  )}
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
                      <h3 className="text-lg font-medium">{t('nav.contacts')}</h3>
                      <Button size="sm" onClick={() => router.push(`/app/contacts/new?accountId=${params.id}`)}>
                        <Plus className="h-4 w-4 mr-1" />
                        {t('contacts.new_contact')}
                      </Button>
                    </div>
                    {contacts.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">{t('contacts.no_contacts')}</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('common.name')}</TableHead>
                            <TableHead>{t('contacts.table.title')}</TableHead>
                            <TableHead>{t('common.email')}</TableHead>
                            <TableHead>{t('common.phone')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contacts.map((contact) => (
                            <TableRow key={contact.id}>
                              <TableCell>
                                <Link
                                  href={`/app/contacts/${contact.id}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {contact.first_name} {contact.last_name}
                                </Link>
                              </TableCell>
                              <TableCell>{contact.title || '-'}</TableCell>
                              <TableCell>{contact.email || '-'}</TableCell>
                              <TableCell>{contact.phone || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium">{t('opportunities.title')}</h3>
                      <Button size="sm" onClick={() => router.push(`/app/opportunities/new?accountId=${params.id}`)}>
                        <Plus className="h-4 w-4 mr-1" />
                        {t('opportunities.new_opportunity')}
                      </Button>
                    </div>
                    {opportunities.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">{t('opportunities.no_opportunities')}</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('common.name')}</TableHead>
                            <TableHead>{t('accounts.table.stage')}</TableHead>
                            <TableHead>{t('common.amount')}</TableHead>
                            <TableHead>{t('opportunities.table.close_date')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {opportunities.map((opp) => (
                            <TableRow key={opp.id}>
                              <TableCell>
                                <Link
                                  href={`/app/opportunities/${opp.id}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {opp.name}
                                </Link>
                              </TableCell>
                              <TableCell>
                                <Badge>{t(`${opp.stage.toLowerCase().startsWith('closed') ? 'stage' : 'stage'}.${opp.stage.toLowerCase()}`)}</Badge>
                              </TableCell>
                              <TableCell>{formatCurrency(opp.amount || 0)}</TableCell>
                              <TableCell>
                                {opp.close_date ? new Date(opp.close_date).toLocaleDateString() : '-'}
                              </TableCell>
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
            label: t('common.activity'),
            value: 'activity',
            content: (
              <div className="space-y-6">
                <FollowUpSection accountId={params.id as string} onCreated={fetchRelated} />
                <ActivityTimeline relatedToType="ACCOUNT" relatedToId={params.id as string} />
              </div>
            ),
          },
          {
            label: t('common.documents'),
            value: 'documents',
            content: <DocumentsTab entityType="ACCOUNT" entityId={params.id as string} />,
          },
          {
            label: t('common.orders_billing'),
            value: 'orders',
            content: <OrdersTab accountId={params.id as string} />,
          },
        ]}
      />

      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('accounts.close_account')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('accounts.close_stage')}</Label>
              <Select value={closeStage} onValueChange={(value: any) => setCloseStage(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLOSED_WON">{t('stage.closed_won')}</SelectItem>
                  <SelectItem value="CLOSED_LOST">{t('stage.closed_lost')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {closeStage === 'CLOSED_LOST' && (
              <div className="space-y-2">
                <Label>
                  {t('accounts.lost_reason')} <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  placeholder={t('message.explain_lost_reason')}
                  rows={4}
                />
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleClose}>{t('accounts.close_account')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
