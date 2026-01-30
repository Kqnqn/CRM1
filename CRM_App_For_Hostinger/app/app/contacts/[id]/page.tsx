'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, Contact } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/language-context';
import { RecordHeader } from '@/components/shared/record-header';
import { RecordTabs } from '@/components/shared/record-tabs';
import { ActivityTimeline } from '@/components/shared/activity-timeline';
import { DocumentsTab } from '@/components/accounts/documents-tab';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export default function ContactDetailPage() {
  const params = useParams();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchContact = async () => {
      const { data } = await supabase
        .from('contacts')
        .select('*, account:accounts!contacts_account_id_fkey(*), owner:profiles!contacts_owner_id_fkey(*)')
        .eq('id', params.id)
        .maybeSingle();

      if (data) setContact(data);
      setLoading(false);
    };
    fetchContact();
  }, [params.id]);

  if (loading) return <div className="p-6">{t('dashboard.loading')}</div>;
  if (!contact) return <div className="p-6">{t('contacts.no_contacts')}</div>;

  return (
    <div>
      <RecordHeader
        title={`${contact.first_name} ${contact.last_name}`}
        fields={[
          { label: t('contacts.table.title'), value: contact.title || '-' },
          { label: t('common.email'), value: contact.email || '-' },
          { label: t('common.phone'), value: contact.phone || '-' },
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
                      <Label>{t('contacts.table.account')}</Label>
                      <p className="text-gray-900">
                        {contact.account && (
                          <Link
                            href={`/app/accounts/${contact.account.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {contact.account.name}
                          </Link>
                        )}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('contacts.table.title')}</Label>
                      <p className="text-gray-900">{contact.title || '-'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('common.email')}</Label>
                      <p className="text-gray-900">{contact.email || '-'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('common.phone')}</Label>
                      <p className="text-gray-900">{contact.phone || '-'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Mobile</Label>
                      <p className="text-gray-900">{contact.mobile || '-'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('common.industry')}</Label>
                      <p className="text-gray-900">{contact.department || '-'}</p>
                    </div>
                  </div>
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
