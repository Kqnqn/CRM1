'use client';

import { useEffect, useState } from 'react';
import { supabase, Account } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Plus,
  Search,
  Building2,
  MoreHorizontal,
  Filter,
  MapPin,
  Phone,
  Globe,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { canViewAll } from '@/lib/auth/permissions';
import { useLanguage } from '@/lib/i18n/language-context';
import { cn } from '@/lib/utils';
import { TagCloud } from '@/components/ui/tag-cloud';
import { Tag as TagIcon } from 'lucide-react';

const stageConfig: Record<string, { color: string; label: string }> = {
  OPEN: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Open' },
  CLOSED_WON: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', label: 'Closed Won' },
  CLOSED_LOST: { color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400', label: 'Closed Lost' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { profile, user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

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

    if (selectedTags.length > 0) {
      query = query.contains('tags', selectedTags);
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
  }, [stageFilter, selectedTags, profile]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (profile) fetchAccounts();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-glow">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{t('accounts.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('subtitle.manage_accounts')}</p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => router.push('/app/accounts/new')}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('accounts.new_account')}
          </Button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('accounts.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('accounts.filter_by_stage')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all_stages')}</SelectItem>
                <SelectItem value="OPEN">{t('stage.open')}</SelectItem>
                <SelectItem value="CLOSED_WON">{t('stage.closed_won')}</SelectItem>
                <SelectItem value="CLOSED_LOST">{t('stage.closed_lost')}</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("gap-2", selectedTags.length > 0 && "border-primary bg-primary/5")}>
                  <TagIcon className="h-4 w-4" />
                  {selectedTags.length > 0 ? `${selectedTags.length} ${t('common.tags')}` : t('common.tags')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="end">
                <TagCloud
                  allTags={Array.from(new Set(accounts.flatMap(a => a.tags || []))).sort()}
                  selectedTags={selectedTags}
                  onTagClick={(tag) => {
                    setSelectedTags(prev =>
                      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                    );
                  }}
                  onClear={() => setSelectedTags([])}
                  className="mb-0 border-none bg-transparent rounded-none"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </motion.div>

      {/* Results count removed from here */}

      {/* Table */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1 text-foreground">{t('accounts.no_accounts')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Get started by creating your first account.
              </p>
              <Button className="mt-6" onClick={() => router.push('/app/accounts/new')}>
                <Plus className="h-4 w-4 mr-2" />
                New Account
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="w-[300px]">{t('accounts.table.name')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('accounts.table.industry')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('accounts.table.location')}</TableHead>
                  <TableHead className="hidden xl:table-cell">{t('accounts.table.phone')}</TableHead>
                  <TableHead>{t('accounts.table.stage')}</TableHead>
                  <TableHead className="hidden md:table-cell">Oznake</TableHead>
                  <TableHead className="hidden xl:table-cell">{t('accounts.table.owner')}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account, index) => (
                  <motion.tr
                    key={account.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="group cursor-pointer hover:bg-muted/50 transition-colors border-border"
                    onClick={() => router.push(`/app/accounts/${account.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center">
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                            {account.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-primary">{account.name}</p>
                          {account.website && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {account.website}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {account.industry || '-'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {account.city ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{account.city}{account.country ? `, ${account.country}` : ''}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {account.phone ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{account.phone}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'font-medium',
                          stageConfig[account.stage]?.color
                        )}
                      >
                        {t(`stage.${account.stage.toLowerCase()}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {account.tags?.map(tag => (
                          <Badge key={tag} variant="soft" className="px-1.5 py-0 text-[10px] bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center text-[10px] font-medium text-primary-foreground">
                          {account.owner?.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-muted-foreground">{account.owner?.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/app/accounts/${account.id}`)}>
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/app/accounts/${account.id}/edit`)}>
                            Edit account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </motion.div>

      {/* Results count */}
      {
        !loading && accounts.length > 0 && (
          <motion.p
            variants={itemVariants}
            className="mt-4 text-sm text-muted-foreground"
          >
            Showing {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </motion.p>
        )
      }
    </motion.div >
  );
}
