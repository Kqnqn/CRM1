'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, Contact, ContactType, IndustryType } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/language-context';
import { useToast } from '@/hooks/use-toast';

export default function EditContactPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  
  const [formData, setFormData] = useState<Partial<Contact>>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    mobile: '',
    title: '',
    department: '',
    contact_type: undefined,
    industry: undefined,
    account_id: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch contact
      const { data: contactData } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', params.id)
        .maybeSingle();
      
      if (contactData) {
        setFormData(contactData);
      }
      
      // Fetch accounts for dropdown
      const { data: accountsData } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('stage', 'OPEN')
        .order('name');
      
      if (accountsData) {
        setAccounts(accountsData);
      }
      
      setLoading(false);
    };
    
    fetchData();
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (!formData.first_name || !formData.last_name) {
        throw new Error(t('contacts.first_last_name_required') || 'First and last name are required');
      }

      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email || null,
          phone: formData.phone || null,
          mobile: formData.mobile || null,
          title: formData.title || null,
          department: formData.department || null,
          contact_type: formData.contact_type || null,
          industry: formData.industry || null,
          account_id: formData.account_id,
        })
        .eq('id', params.id);

      if (updateError) throw updateError;

      // Create activity log
      await supabase.from('activities').insert({
        type: 'NOTE',
        subject: 'Contact Updated',
        description: `Contact ${formData.first_name} ${formData.last_name} was updated`,
        related_to_type: 'CONTACT',
        related_to_id: params.id as string,
        owner_id: user?.id,
        status: 'COMPLETED',
      });

      toast({
        title: t('contacts.success_updated') || 'Contact updated successfully',
      });

      router.push(`/app/contacts/${params.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">{t('dashboard.loading')}</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/app/contacts/${params.id}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('common.back')}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('contacts.edit_contact') || 'Edit Contact'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">
                  {t('contacts.first_name') || 'First Name'} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">
                  {t('contacts.last_name') || 'Last Name'} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_id">
                  {t('contacts.account') || 'Account'} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.account_id}
                  onValueChange={(value) => setFormData({ ...formData, account_id: value })}
                  required
                >
                  <SelectTrigger id="account_id">
                    <SelectValue placeholder={t('common.select_account')} />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">{t('contacts.title') || 'Title'}</Label>
                <Input
                  id="title"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('common.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('common.phone')}</Label>
                <Input
                  id="phone"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile">{t('contacts.mobile') || 'Mobile'}</Label>
                <Input
                  id="mobile"
                  value={formData.mobile || ''}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">{t('contacts.department') || 'Department'}</Label>
                <Input
                  id="department"
                  value={formData.department || ''}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_type">{t('contacts.contact_type') || 'Contact Type'}</Label>
                <Select
                  value={formData.contact_type || ''}
                  onValueChange={(value) => setFormData({ ...formData, contact_type: value as ContactType })}
                >
                  <SelectTrigger id="contact_type">
                    <SelectValue placeholder={t('contacts.select_type') || 'Select type'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LEGAL_ENTITY">{t('contacts.legal_entity') || 'Legal Entity'}</SelectItem>
                    <SelectItem value="INDIVIDUAL">{t('contacts.individual') || 'Individual'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">{t('common.industry')}</Label>
                <Select
                  value={formData.industry || ''}
                  onValueChange={(value) => setFormData({ ...formData, industry: value as IndustryType })}
                >
                  <SelectTrigger id="industry">
                    <SelectValue placeholder={t('contacts.select_industry') || 'Select industry'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HORECA">{t('industry.horeca') || 'HORECA'}</SelectItem>
                    <SelectItem value="RETAIL">{t('industry.retail') || 'Retail'}</SelectItem>
                    <SelectItem value="WHOLESALE">{t('industry.wholesale') || 'Wholesale'}</SelectItem>
                    <SelectItem value="MANUFACTURING">{t('industry.manufacturing') || 'Manufacturing'}</SelectItem>
                    <SelectItem value="OTHER">{t('industry.other') || 'Other'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/app/contacts/${params.id}`)}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t('common.saving') : t('common.save_changes')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
