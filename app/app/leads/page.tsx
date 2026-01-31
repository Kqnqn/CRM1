'use client';

import { useEffect, useState } from 'react';
import { supabase, Lead } from '@/lib/supabase/client';
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
import { Plus, Search, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { canViewAll } from '@/lib/auth/permissions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/i18n/language-context';

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-yellow-100 text-yellow-800',
  QUALIFIED: 'bg-green-100 text-green-800',
  CONVERTED: 'bg-purple-100 text-purple-800',
  ARCHIVED: 'bg-gray-100 text-gray-800',
};

interface ImportResult {
  createdCount: number;
  duplicateCount: number;
  errors: Array<{ row: number; error: string; data: any }>;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
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
    if (profile) {
      fetchLeads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, profile?.id, user?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (profile) fetchLeads();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/import-leads-csv`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (response.ok) {
        setImportResult(result);
        setShowImportDialog(true);
        fetchLeads();
        toast({
          title: t('leads.import_success'),
          description: `${t('leads.created_count')}: ${result.createdCount}, ${t('leads.duplicate_count')}: ${result.duplicateCount}`,
        });
      } else {
        throw new Error(result.error || 'Import failed');
      }
    } catch (error: any) {
      toast({
        title: t('leads.import_failed'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('leads.title')}</h1>
          <p className="text-gray-600 mt-1">{t('subtitle.manage_leads')}</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <label htmlFor="csv-upload" className="flex-1 md:flex-none">
            <Button variant="outline" disabled={importing} asChild className="w-full md:w-auto">
              <span>
                <Upload className="h-4 w-4 mr-2" />
                {importing ? t('common.importing') : t('common.import_csv')}
              </span>
            </Button>
          </label>
          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
          <Button onClick={() => router.push('/app/leads/new')} className="flex-1 md:flex-none w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            {t('leads.new_lead')}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t('leads.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
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
        </div>

        {loading ? (
          <div className="p-8 text-center">{t('dashboard.loading')}</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {t('leads.no_leads')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('leads.table.company')}</TableHead>
                <TableHead>{t('leads.table.name')}</TableHead>
                <TableHead>{t('leads.table.email')}</TableHead>
                <TableHead>{t('leads.table.phone')}</TableHead>
                <TableHead>{t('leads.table.status')}</TableHead>
                <TableHead>{t('leads.table.owner')}</TableHead>
                <TableHead>{t('leads.table.created')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id} className="cursor-pointer hover:bg-gray-50">
                  <TableCell>
                    <Link
                      href={`/app/leads/${lead.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {lead.company_name}
                    </Link>
                  </TableCell>
                  <TableCell>{lead.contact_person_name}</TableCell>
                  <TableCell>{lead.email}</TableCell>
                  <TableCell>{lead.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[lead.status]}>{t(`status.${lead.status.toLowerCase()}`)}</Badge>
                  </TableCell>
                  <TableCell>{lead.owner?.full_name}</TableCell>
                  <TableCell>
                    {new Date(lead.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('leads.import_results')}</DialogTitle>
            <DialogDescription>
              {t('leads.import_summary')}
            </DialogDescription>
          </DialogHeader>
          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">
                    {importResult.createdCount}
                  </div>
                  <div className="text-sm text-green-600">{t('leads.created_count')}</div>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-700">
                    {importResult.duplicateCount}
                  </div>
                  <div className="text-sm text-yellow-600">{t('leads.duplicate_count')}</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">{t('leads.errors_duplicates')}:</h4>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {importResult.errors.map((error, index) => (
                      <div
                        key={index}
                        className="p-3 bg-red-50 rounded border border-red-200 text-sm"
                      >
                        <div className="font-medium text-red-900">
                          {t('leads.row')} {error.row}: {error.error}
                        </div>
                        <div className="text-red-700 mt-1">
                          Email: {error.data.email || 'N/A'}
                          {error.data.companyName && ` | Company: ${error.data.companyName}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
