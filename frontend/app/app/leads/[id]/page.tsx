'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, Lead } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { RecordHeader } from '@/components/shared/record-header';
import { RecordTabs } from '@/components/shared/record-tabs';
import { ActivityTimeline } from '@/components/shared/activity-timeline';
import { DocumentsTab } from '@/components/accounts/documents-tab';
import { TagInput } from '@/components/ui/tag-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tag as TagIcon, X } from 'lucide-react';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { canUpdate, canDelete } from '@/lib/auth/permissions';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/language-context';

const statusColors: Record<string, any> = {
  NEW: 'default',
  CONTACTED: 'secondary',
  QUALIFIED: 'outline',
  CONVERTED: 'default',
  ARCHIVED: 'secondary',
};

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile, user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const { t } = useLanguage();

  const fetchLead = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*, owner:profiles!leads_owner_id_fkey(*)')
      .eq('id', params.id)
      .maybeSingle();

    if (data && !error) {
      const normalizedData = {
        ...data,
        tags: data.tags || [],
      };
      setLead(normalizedData);
      setFormData(normalizedData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLead();
  }, [params.id]);

  const handleUpdate = async () => {
    const { data, error } = await supabase
      .from('leads')
      .update({
        company_name: formData.company_name,
        contact_person_name: formData.contact_person_name,
        email: formData.email,
        phone: formData.phone,
        source: formData.source,
        status: formData.status,
        tags: formData.tags || [],
      })
      .eq('id', params.id)
      .select('*, owner:profiles!leads_owner_id_fkey(*)')
      .single();

    if (!error && data) {
      // Sync with associated contact if exists
      if (data.contact_id) {
        const [firstName, ...lastNameParts] = formData.contact_person_name.trim().split(/\s+/);
        const lastName = lastNameParts.join(' ') || 'Unknown';

        await supabase
          .from('contacts')
          .update({
            first_name: firstName,
            last_name: lastName,
            email: formData.email,
            phone: formData.phone,
          })
          .eq('id', data.contact_id);
      }

      const normalizedData = {
        ...data,
        tags: data.tags || [],
      };
      setLead(normalizedData);
      setFormData(normalizedData);
      setEditing(false);
    } else if (error) {
      console.error('Error updating lead:', error);
      alert('Error updating lead: ' + error.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this lead?')) return;

    const { error } = await supabase.from('leads').delete().eq('id', params.id);

    if (!error) {
      router.push('/app/leads');
    }
  };

  const handleConvert = async () => {
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .insert({
        name: lead?.company_name,
        phone: lead?.phone,
        owner_id: lead?.owner_id,
        tags: lead?.tags || [],
      })
      .select()
      .single();

    if (accountError || !accountData) return;

    if (lead?.contact_id) {
      // Update existing contact to associate with new account
      await supabase
        .from('contacts')
        .update({ account_id: accountData.id })
        .eq('id', lead.contact_id);
    } else {
      // Fallback for leads created before this feature
      const [firstName, ...lastNameParts] = lead?.contact_person_name.split(/\s+/) || ['', ''];
      const lastName = lastNameParts.join(' ') || 'Unknown';

      await supabase
        .from('contacts')
        .insert({
          account_id: accountData.id,
          first_name: firstName,
          last_name: lastName,
          email: lead?.email,
          phone: lead?.phone,
          owner_id: lead?.owner_id,
        });
    }

    await supabase
      .from('leads')
      .update({
        status: 'CONVERTED',
        converted_account_id: accountData.id,
        converted_at: new Date().toISOString(),
      })
      .eq('id', params.id);

    await supabase.from('audit_log').insert({
      entity_type: 'LEAD',
      entity_id: params.id as string,
      action: 'CONVERT',
      new_value: accountData.id,
      user_id: user?.id,
    });

    setShowConvertDialog(false);
    router.push(`/app/accounts/${accountData.id}`);
  };

  if (loading) {
    return <div className="p-6">{t('dashboard.loading')}</div>;
  }

  if (!lead) {
    return <div className="p-6">{t('leads.no_leads')}</div>;
  }

  const canEdit = profile && canUpdate(profile.role, lead.owner_id, user?.id);
  const canRemove = profile && canDelete(profile.role);

  const actions = [];
  if (lead.status !== 'CONVERTED' && canEdit) {
    actions.push({
      label: t('leads.convert_lead'),
      onClick: () => setShowConvertDialog(true),
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
        title={lead.company_name}
        status={lead.status}
        statusVariant={statusColors[lead.status]}
        fields={[
          { label: t('nav.contacts'), value: lead.contact_person_name },
          { label: t('common.email'), value: lead.email },
          { label: t('leads.table.owner'), value: lead.owner?.full_name || '' },
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
                  {lead.status === 'CONVERTED' && lead.converted_account_id && (
                    <div className="mb-6 p-4 bg-muted border border-border rounded-lg">
                      <p className="text-sm font-medium text-foreground">
                        {t('leads.converted_msg')}
                      </p>
                      <Link
                        href={`/app/accounts/${lead.converted_account_id}`}
                        className="text-sm text-primary hover:underline mt-1 inline-block"
                      >
                        {t('leads.view_account')}
                      </Link>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>{t('leads.table.company')}</Label>
                      {editing ? (
                        <Input
                          value={formData.company_name}
                          onChange={(e) =>
                            setFormData({ ...formData, company_name: e.target.value })
                          }
                        />
                      ) : (
                        <p className="text-gray-900">{lead.company_name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>{t('common.person_name')}</Label>
                      {editing ? (
                        <Input
                          value={formData.contact_person_name}
                          onChange={(e) =>
                            setFormData({ ...formData, contact_person_name: e.target.value })
                          }
                        />
                      ) : (
                        <p className="text-gray-900">{lead.contact_person_name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>{t('common.email')}</Label>
                      {editing ? (
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                        />
                      ) : (
                        <p className="text-gray-900">{lead.email}</p>
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
                        <p className="text-gray-900">{lead.phone || '-'}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>{t('leads.table.source')}</Label>
                      {editing ? (
                        <Input
                          value={formData.source || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, source: e.target.value })
                          }
                        />
                      ) : (
                        <p className="text-gray-900">{lead.source || '-'}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>{t('common.status')}</Label>
                      {editing ? (
                        <Select
                          value={formData.status}
                          onValueChange={(value) =>
                            setFormData({ ...formData, status: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NEW">{t('status.new')}</SelectItem>
                            <SelectItem value="CONTACTED">{t('status.contacted')}</SelectItem>
                            <SelectItem value="QUALIFIED">{t('status.qualified')}</SelectItem>
                            <SelectItem value="ARCHIVED">{t('status.cancelled')}</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-foreground">{t(`status.${lead.status.toLowerCase()}`)}</p>
                      )}
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label className="flex items-center gap-2">
                        <TagIcon className="h-4 w-4" />
                        Oznake
                      </Label>
                      {editing ? (
                        <TagInput
                          tags={formData.tags || []}
                          onChange={(tags) => setFormData({ ...formData, tags })}
                        />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {lead.tags && lead.tags.length > 0 ? (
                            lead.tags.map((tag) => (
                              <Badge key={tag} variant="soft" className="bg-primary/10 text-primary border-primary/20">
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-muted-foreground text-sm">-</p>
                          )}
                        </div>
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
            label: t('common.documents'),
            value: 'documents',
            content: <DocumentsTab entityType="LEAD" entityId={params.id as string} />,
          },
          {
            label: t('common.activity'),
            value: 'activity',
            content: <ActivityTimeline relatedToType="LEAD" relatedToId={params.id as string} />,
          },
        ]}
      />

      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('leads.convert_lead')}</DialogTitle>
            <DialogDescription>
              {t('leads.convert_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-3 mt-4">
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => handleConvert()}>
              Konvertuj
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
