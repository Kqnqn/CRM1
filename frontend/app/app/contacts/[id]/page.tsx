'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, Contact } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { useLanguage } from '@/lib/i18n/language-context';
import { RecordHeader } from '@/components/shared/record-header';
import { RecordTabs } from '@/components/shared/record-tabs';
import { ActivityTimeline } from '@/components/shared/activity-timeline';
import { DocumentsTab } from '@/components/accounts/documents-tab';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { canUpdate, canDelete } from '@/lib/auth/permissions';
import Link from 'next/link';

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile, user } = useAuth();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const { t } = useLanguage();

  const fetchContact = async () => {
    const { data } = await supabase
      .from('contacts')
      .select('*, account:accounts!contacts_account_id_fkey(*), owner:profiles!contacts_owner_id_fkey(*)')
      .eq('id', params.id)
      .maybeSingle();

    if (data) {
      setContact(data);
      setFormData(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchContact();
  }, [params.id]);

  const handleUpdate = async () => {
    const { error } = await supabase
      .from('contacts')
      .update({
        first_name: formData.first_name,
        last_name: formData.last_name,
        title: formData.title,
        email: formData.email,
        phone: formData.phone,
        mobile: formData.mobile,
        department: formData.department,
      })
      .eq('id', params.id);

    if (!error) {
      setEditing(false);
      fetchContact();
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('common.delete_confirm_record'))) return;

    const { error } = await supabase.from('contacts').delete().eq('id', params.id);

    if (!error) {
      router.push('/app/contacts');
    }
  };

  if (loading) return <div className="p-6">{t('dashboard.loading')}</div>;
  if (!contact) return <div className="p-6">{t('contacts.no_contacts')}</div>;

  const canEdit = profile && canUpdate(profile.role, contact.owner_id, user?.id);
  const canRemove = profile && canDelete(profile.role);

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
        title={`${contact.first_name} ${contact.last_name}`}
        fields={[
          { label: t('contacts.table.title'), value: contact.title || '-' },
          { label: t('common.email'), value: contact.email || '-' },
          { label: t('common.phone'), value: contact.phone || '-' },
        ]}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>{t('contacts.table.account')}</Label>
                      <p>
                        {contact.account && (
                          <Link
                            href={`/app/accounts/${contact.account.id}`}
                            className="text-primary hover:underline"
                          >
                            {contact.account.name}
                          </Link>
                        )}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('contacts.table.title')}</Label>
                      {editing ? (
                        <Input
                          value={formData.title || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, title: e.target.value })
                          }
                        />
                      ) : (
                        <p>{contact.title || '-'}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>{t('common.email')}</Label>
                      {editing ? (
                        <Input
                          value={formData.email || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                        />
                      ) : (
                        <p>{contact.email || '-'}</p>
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
                        <p>{contact.phone || '-'}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Mobile</Label>
                      {editing ? (
                        <Input
                          value={formData.mobile || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, mobile: e.target.value })
                          }
                        />
                      ) : (
                        <p>{contact.mobile || '-'}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>{t('common.industry')}</Label>
                      {editing ? (
                        <Input
                          value={formData.department || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, department: e.target.value })
                          }
                        />
                      ) : (
                        <p>{contact.department || '-'}</p>
                      )}
                    </div>
                  </div>

                  {editing && (
                    <div className="mt-6 flex justify-end space-x-3">
                      <Button variant="outline" onClick={() => setEditing(false)}>
                        {t('common.cancel')}
                      </Button>
                      <Button onClick={handleUpdate}>{t('common.save')}</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ),
          },
          {
            label: t('common.documents'),
            value: 'documents',
            content: <DocumentsTab entityType="CONTACT" entityId={params.id as string} />,
          },
          {
            label: t('common.activity'),
            value: 'activity',
            content: <ActivityTimeline relatedToType="CONTACT" relatedToId={params.id as string} />,
          },
        ]}
      />
    </div>
  );
}
