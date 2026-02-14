'use client';

import { useEffect, useState } from 'react';
import { supabase, Profile } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Building2, Target, TrendingUp, DollarSign, Download, Filter } from 'lucide-react';
import { canViewAll } from '@/lib/auth/permissions';
import { useLanguage } from '@/lib/i18n/language-context';

export default function ReportsPage() {
  const { profile, user } = useAuth();
  const { t, formatCurrency } = useLanguage();
  const [stats, setStats] = useState({
    totalLeads: 0,
    leadsByStatus: {} as Record<string, number>,
    totalAccounts: 0,
    accountsByStage: {} as Record<string, number>,
  });
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; email: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    ownerId: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!profile || !canViewAll(profile.role)) return;
      const { data } = await supabase.from('profiles').select('id, full_name, email');
      if (data) setUsers(data);
    };

    fetchUsers();
  }, [profile]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!profile) return;

      const viewAll = canViewAll(profile.role);
      const userId = user?.id;

      const [leadsRes, accountsRes] = await Promise.all([
        supabase
          .from('leads')
          .select('status, owner_id')
          .then((res) => {
            if (!viewAll && res.data) {
              return { data: res.data.filter((l: any) => l.owner_id === userId) };
            }
            return res;
          }),
        supabase
          .from('accounts')
          .select('stage, owner_id')
          .then((res) => {
            if (!viewAll && res.data) {
              return { data: res.data.filter((a: any) => a.owner_id === userId) };
            }
            return res;
          }),
      ]);

      const leadsByStatus: Record<string, number> = {};
      leadsRes.data?.forEach((lead: any) => {
        leadsByStatus[lead.status] = (leadsByStatus[lead.status] || 0) + 1;
      });

      const accountsByStage: Record<string, number> = {};
      accountsRes.data?.forEach((account: any) => {
        accountsByStage[account.stage] = (accountsByStage[account.stage] || 0) + 1;
      });

      setStats({
        totalLeads: leadsRes.data?.length || 0,
        leadsByStatus,
        totalAccounts: accountsRes.data?.length || 0,
        accountsByStage,
      });

      setLoading(false);
    };

    fetchStats();
  }, [profile, user, filters]);

  const [exportingPdf, setExportingPdf] = useState(false);

  const exportToPDF = async () => {
    try {
      setExportingPdf(true);
      const response = await fetch('/api/reports/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stats,
          filters,
          profile,
          date: new Date().toLocaleDateString(),
        }),
      });

      if (!response.ok) throw new Error('PDF generation failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert(t('reports.export_error') || 'Failed to export PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const exportToCSV = () => {
    // ... existing CSV logic ...
    const rows: string[] = [];
    rows.push('Report Type,Category,Value');

    rows.push('');
    rows.push('SUMMARY');
    rows.push(`Total Leads,,${stats.totalLeads}`);
    rows.push(`Total Accounts,,${stats.totalAccounts}`);

    rows.push('');
    rows.push('LEADS BY STATUS');
    Object.entries(stats.leadsByStatus).forEach(([status, count]) => {
      rows.push(`Leads,${status},${count}`);
    });

    rows.push('');
    rows.push('ACCOUNTS BY STAGE');
    Object.entries(stats.accountsByStage).forEach(([stage, count]) => {
      rows.push(`Accounts,${stage},${count}`);
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `crm-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div className="p-6">{t('dashboard.loading')}</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')} & {t('nav.home')}</h1>
          <p className="text-gray-600 mt-1">{t('subtitle.sales_overview')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            {showFilters ? t('reports.hide_filters') : t('reports.show_filters')} {t('reports.filters')}
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button onClick={exportToPDF} disabled={exportingPdf}>
            {exportingPdf ? (
              <span className="animate-spin mr-2">⏳</span>
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            PDF
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('reports.filters')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('reports.start_date')}</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('reports.end_date')}</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
              {canViewAll(profile?.role || 'SALES_REP') && (
                <div className="space-y-2">
                  <Label>{t('reports.owner')}</Label>
                  <Select
                    value={filters.ownerId}
                    onValueChange={(value) => setFilters({ ...filters, ownerId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('reports.all_owners')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t('reports.all_owners')}</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => setFilters({ startDate: '', endDate: '', ownerId: '' })}
              >
                {t('reports.clear_filters')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('reports.total_leads')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalLeads}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('reports.total_accounts')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalAccounts}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <Building2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.leads_by_status')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.leadsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{t(`status.${status.toLowerCase()}`)}</span>
                  <span className="text-lg font-semibold text-foreground">{count}</span>
                </div>
              ))}
              {Object.keys(stats.leadsByStatus).length === 0 && (
                <p className="text-center text-muted-foreground py-4">{t('reports.no_leads_data')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('reports.accounts_by_stage')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.accountsByStage).map(([stage, count]) => (
                <div key={stage} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{t(`stage.${stage.toLowerCase()}`)}</span>
                  <span className="text-lg font-semibold text-foreground">{count}</span>
                </div>
              ))}
              {Object.keys(stats.accountsByStage).length === 0 && (
                <p className="text-center text-muted-foreground py-4">{t('reports.no_accounts_data')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
