'use client';

import { useEffect, useState } from 'react';
import { supabase, Contact, ContactType, IndustryType } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Edit } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { canViewAll } from '@/lib/auth/permissions';
import { useLanguage } from '@/lib/i18n/language-context';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [contactTypeFilter, setContactTypeFilter] = useState<ContactType | 'ALL'>('ALL');
  const [industryFilter, setIndustryFilter] = useState<IndustryType | 'ALL'>('ALL');
  const { profile, user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  const fetchContacts = async () => {
    setLoading(true);
    let query = supabase
      .from('contacts')
      .select('*, account:accounts!contacts_account_id_fkey(*), owner:profiles!contacts_owner_id_fkey(*)')
      .order('created_at', { ascending: false });

    if (profile && !canViewAll(profile.role)) {
      query = query.eq('owner_id', user?.id);
    }

    const { data, error } = await query;

    if (data && !error) {
      let filtered = data;
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        filtered = data.filter(
          (contact) =>
            contact.first_name?.toLowerCase().includes(lowerQuery) ||
            contact.last_name?.toLowerCase().includes(lowerQuery) ||
            contact.email?.toLowerCase().includes(lowerQuery)
        );
      }
      if (contactTypeFilter !== 'ALL') {
        filtered = filtered.filter((contact) => contact.contact_type === contactTypeFilter);
      }
      if (industryFilter !== 'ALL') {
        filtered = filtered.filter((contact) => contact.industry === industryFilter);
      }
      setContacts(filtered);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchContacts();
  }, [profile]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (profile) fetchContacts();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, contactTypeFilter, industryFilter]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('contacts.title')}</h1>
          <p className="text-gray-600 mt-1">{t('subtitle.manage_contacts')}</p>
        </div>
        <Button onClick={() => router.push('/app/contacts/new')}>
          <Plus className="h-4 w-4 mr-2" />
          {t('contacts.new_contact')}
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t('contacts.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-4">
            <div className="w-1/2">
              <Select value={contactTypeFilter} onValueChange={(value) => setContactTypeFilter(value as ContactType | 'ALL')}>
                <SelectTrigger>
                  <SelectValue placeholder={t('contacts.filter_by_type') || 'Filter by Type'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('contacts.all_types') || 'All Types'}</SelectItem>
                  <SelectItem value="LEGAL_ENTITY">{t('contacts.legal_entity') || 'Legal Entity'}</SelectItem>
                  <SelectItem value="INDIVIDUAL">{t('contacts.individual') || 'Individual'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-1/2">
              <Select value={industryFilter} onValueChange={(value) => setIndustryFilter(value as IndustryType | 'ALL')}>
                <SelectTrigger>
                  <SelectValue placeholder={t('contacts.filter_by_industry') || 'Filter by Industry'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('contacts.all_industries') || 'All Industries'}</SelectItem>
                  <SelectItem value="HORECA">{t('industry.horeca') || 'HORECA'}</SelectItem>
                  <SelectItem value="RETAIL">{t('industry.retail') || 'Retail'}</SelectItem>
                  <SelectItem value="WHOLESALE">{t('industry.wholesale') || 'Wholesale'}</SelectItem>
                  <SelectItem value="MANUFACTURING">{t('industry.manufacturing') || 'Manufacturing'}</SelectItem>
                  <SelectItem value="OTHER">{t('industry.other') || 'Other'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">{t('dashboard.loading')}</div>
        ) : contacts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {t('contacts.no_contacts')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('contacts.table.name')}</TableHead>
                <TableHead>{t('contacts.table.account')}</TableHead>
                <TableHead>{t('contacts.table.title')}</TableHead>
                <TableHead>{t('contacts.table.email')}</TableHead>
                <TableHead>{t('contacts.table.phone')}</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id} className="cursor-pointer hover:bg-gray-50">
                  <TableCell>
                    <Link
                      href={`/app/contacts/${contact.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {contact.first_name} {contact.last_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {contact.account && (
                      <Link
                        href={`/app/accounts/${contact.account.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {contact.account.name}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>{contact.title || '-'}</TableCell>
                  <TableCell>{contact.email || '-'}</TableCell>
                  <TableCell>{contact.phone || '-'}</TableCell>
                  <TableCell>{contact.owner?.full_name}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/app/contacts/${contact.id}/edit`);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
