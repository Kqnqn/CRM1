'use client';

import { useEffect, useState } from 'react';
import { supabase, Account } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { canViewAll } from '@/lib/auth/permissions';
import { useLanguage } from '@/lib/i18n/language-context';

const stageColors: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-800',
  CLOSED_WON: 'bg-blue-100 text-blue-800',
  CLOSED_LOST: 'bg-red-100 text-red-800',
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const { profile, user } = useAuth();
  const router = useRouter();
  const { t, formatCurrency } = useLanguage();

  const fetchAccounts = async () => {
    setLoading(true);
    let query = supabase
      .from('accounts')
      .select('*, owner:profiles!accounts_owner_id_fkey(*)')
      .order('created_at', { ascending: false });

    if (profile && !canViewAll(profile.role)) {
      query = query.eq('owner_id', user?.id);
    }

    if (stageFilter !== 'ALL') {
      query = query.eq('stage', stageFilter);
    }

    const { data, error } = await query;

    if (data && !error) {
      let filtered = data;
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        filtered = data.filter(
          (account) =>
            account.name?.toLowerCase().includes(lowerQuery) ||
            account.industry?.toLowerCase().includes(lowerQuery)
        );
      }
      setAccounts(filtered);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, [stageFilter, profile]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (profile) fetchAccounts();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('accounts.title')}</h1>
          <p className="text-gray-600 mt-1">{t('subtitle.manage_accounts')}</p>
        </div>
        <Button onClick={() => router.push('/app/accounts/new')} className="w-full md:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('accounts.new_account')}
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t('accounts.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder={t('accounts.filter_by_stage')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('accounts.all_accounts')}</SelectItem>
              <SelectItem value="OPEN">{t('status.open')}</SelectItem>
              <SelectItem value="CLOSED_WON">{t('status.closed_won')}</SelectItem>
              <SelectItem value="CLOSED_LOST">{t('status.closed_lost')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="p-8 text-center">{t('dashboard.loading')}</div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {t('accounts.no_accounts')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('accounts.table.name')}</TableHead>
                <TableHead>{t('accounts.table.industry')}</TableHead>
                <TableHead>{t('common.city')}</TableHead>
                <TableHead>{t('common.phone')}</TableHead>
                <TableHead>{t('accounts.table.stage')}</TableHead>
                <TableHead>{t('accounts.table.owner')}</TableHead>
                <TableHead>{t('common.created')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id} className="cursor-pointer hover:bg-gray-50">
                  <TableCell>
                    <Link
                      href={`/app/accounts/${account.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {account.name}
                    </Link>
                  </TableCell>
                  <TableCell>{account.industry || '-'}</TableCell>
                  <TableCell>{account.city || '-'}</TableCell>
                  <TableCell>{account.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge className={stageColors[account.stage]}>{t(`status.${account.stage.toLowerCase()}`)}</Badge>
                  </TableCell>
                  <TableCell>{account.owner?.full_name}</TableCell>
                  <TableCell>
                    {new Date(account.created_at).toLocaleDateString()}
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
