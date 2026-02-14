'use client';

import { useEffect, useState } from 'react';
import { supabase, Lead } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Upload,
  MoreHorizontal,
  Filter,
  Users,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Tag as TagIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { canViewAll } from '@/lib/auth/permissions';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/i18n/language-context';
import { cn } from '@/lib/utils';
import { TagCloud } from '@/components/ui/tag-cloud';

const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'success' | 'warning' | 'info'; color: string }> = {
  NEW: { variant: 'info', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400' },
  CONTACTED: { variant: 'warning', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  QUALIFIED: { variant: 'success', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  CONVERTED: { variant: 'default', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400' },
  ARCHIVED: { variant: 'secondary', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400' },
};

interface ImportResult {
  createdCount: number;
  duplicateCount: number;
  errors: Array<{ row: number; error: string; data: any }>;
}

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

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { profile, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();

  const fetchLeads = async () => {
    setLoading(true);
    let query = supabase
      .from('leads')
      .select('*, owner:profiles!leads_owner_id_fkey(*)')
      .order('created_at', { ascending: false });

    if (profile && !canViewAll(profile.role)) {
      query = query.eq('owner_id', user?.id);
    }

    if (statusFilter !== 'ALL') {
      query = query.eq('status', statusFilter);
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
          (lead) =>
            lead.company_name?.toLowerCase().includes(lowerQuery) ||
            lead.contact_person_name?.toLowerCase().includes(lowerQuery) ||
            lead.email?.toLowerCase().includes(lowerQuery)
        );
      }
      setLeads(filtered);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
  }, [statusFilter, selectedTags, profile]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (profile) fetchLeads();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // New states for import flow
  const [importSummary, setImportSummary] = useState<any>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [createContacts, setCreateContacts] = useState(false);

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportSummary(null);
    setImportId(null);
    setImportResult(null); // Clear previous result

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Step 1: Parse and Validate
      const response = await fetch('/api/leads/import-csv', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${window.localStorage.getItem('sb-access-token') || '' /* Adjust based on auth */}`
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Import failed');

      setImportId(data.importId);
      setImportSummary(data.summary);
      setShowImportDialog(true);

      // If we have access to session from useAuth, we should use it. 
      // But fetch defaults to no auth headers usually unless specified.
      // The supabase client handles auth, but fetch doesn't.
      // We rely on the browser cookie if Supabase SSR is set up, 
      // OR we need to pass the access token. 
      // I'll assume standard supabase.auth.getSession() logic or rely on the helper I'll verify later.

    } catch (error: any) {
      toast({
        title: t('leads.import_failed'),
        description: error.message,
        variant: 'destructive',
      });
      setShowImportDialog(false);
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const confirmImport = async () => {
    if (!importId) return;

    setImporting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const response = await fetch('/api/leads/import-csv/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ importId, createContacts }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Commit failed');

      toast({
        title: t('leads.import_success'),
        description: `${t('leads.created_count')}: ${data.leadsCreated}`,
      });

      setShowImportDialog(false);
      fetchLeads();

    } catch (error: any) {
      toast({
        title: t('leads.import_failed'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-glow">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{t('leads.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('subtitle.manage_leads')}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
            <Button
              variant="outline"
              disabled={importing}
              onClick={() => document.getElementById('csv-upload')?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {importing ? t('common.importing') : t('common.import_csv')}
            </Button>
            <Button
              onClick={() => router.push('/app/leads/new')}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {t('leads.new_lead')}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('leads.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('leads.filter_by_status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all_statuses')}</SelectItem>
                <SelectItem value="NEW">{t('status.new')}</SelectItem>
                <SelectItem value="CONTACTED">{t('status.contacted')}</SelectItem>
                <SelectItem value="QUALIFIED">{t('status.qualified')}</SelectItem>
                <SelectItem value="CONVERTED">{t('status.converted')}</SelectItem>
                <SelectItem value="ARCHIVED">{t('status.archived')}</SelectItem>
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
                  allTags={Array.from(new Set(leads.flatMap(l => l.tags || []))).sort()}
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

      {/* Results count removed from here, moving up or keeping if needed */}

      {/* Table */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{t('leads.no_leads')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Get started by creating your first lead or importing from a CSV file.
              </p>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => document.getElementById('csv-upload')?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
                <Button onClick={() => router.push('/app/leads/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Lead
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[250px]">{t('leads.table.company')}</TableHead>
                  <TableHead>{t('leads.table.name')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('leads.table.email')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('leads.table.phone')}</TableHead>
                  <TableHead>{t('leads.table.status')}</TableHead>
                  <TableHead className="hidden md:table-cell">Oznake</TableHead>
                  <TableHead className="hidden xl:table-cell">{t('leads.table.owner')}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead, index) => (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="group cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/app/leads/${lead.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-600/20 flex items-center justify-center">
                          <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                            {lead.company_name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-primary">{lead.company_name}</p>
                          <p className="text-xs text-muted-foreground md:hidden">
                            {lead.contact_person_name}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{lead.contact_person_name}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="text-sm">{lead.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {lead.phone ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          <span className="text-sm">{lead.phone}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'font-medium',
                          statusConfig[lead.status]?.color
                        )}
                      >
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {lead.tags?.map(tag => (
                          <Badge key={tag} variant="soft" className="px-1.5 py-0 text-[10px] bg-primary/5 text-primary border-primary/10">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center text-[10px] font-medium text-primary-foreground">
                          {lead.owner?.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm">{lead.owner?.full_name}</span>
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
                          <DropdownMenuItem onClick={() => router.push(`/app/leads/${lead.id}`)}>
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/app/leads/${lead.id}/edit`)}>
                            Edit lead
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
      {!loading && leads.length > 0 && (
        <motion.p
          variants={itemVariants}
          className="mt-4 text-sm text-muted-foreground"
        >
          Showing {leads.length} lead{leads.length !== 1 ? 's' : ''}
        </motion.p>
      )}

      {/* Import Results Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              {t('leads.import_results')}
            </DialogTitle>
            <DialogDescription>{t('leads.import_summary')}</DialogDescription>
          </DialogHeader>
          {importSummary ? (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
                  <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {importSummary.validRows}
                  </div>
                  <div className="text-sm text-emerald-700 dark:text-emerald-300">
                    {t('leads.valid_rows')}
                  </div>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-900/30">
                  <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                    {importSummary.duplicateCount}
                  </div>
                  <div className="text-sm text-amber-700 dark:text-amber-300">
                    {t('leads.duplicate_count')}
                  </div>
                </div>
                <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-900/30">
                  <div className="text-3xl font-bold text-rose-600 dark:text-rose-400">
                    {importSummary.errorRows}
                  </div>
                  <div className="text-sm text-rose-700 dark:text-rose-300">
                    {t('leads.error_rows')}
                  </div>
                </div>
              </div>

              {importSummary.errors && importSummary.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-500" />
                    {t('leads.errors_duplicates')}:
                  </h4>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {importSummary.errors.map((error: any, index: number) => (
                      <div
                        key={index}
                        className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-900/30 text-sm"
                      >
                        <div className="font-medium text-rose-900 dark:text-rose-200">
                          {t('leads.row')} {error.row}: {error.reason}
                        </div>
                        <div className="text-rose-700 dark:text-rose-300 mt-1 text-xs font-mono">
                          {error.raw}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2 pt-4 border-t">
                <input
                  type="checkbox"
                  id="createContacts"
                  checked={createContacts}
                  onChange={e => setCreateContacts(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="createContacts" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Create Contacts/Accounts immediately for valid leads
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={confirmImport} disabled={importing || importSummary.validRows === 0}>
                  {importing ? 'Importing...' : `Confirm Import (${importSummary.validRows} rows)`}
                </Button>
              </div>

            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Loading preview...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
