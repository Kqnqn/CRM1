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
    totalOpportunities: 0,
    opportunitiesByStage: {} as Record<string, number>,
    totalRevenue: 0,
    wonRevenue: 0,
    lostRevenue: 0,
    pipelineValue: 0,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!profile) return;

      const viewAll = canViewAll(profile.role);
      const userId = user?.id;
      const filterOwnerId = filters.ownerId || userId;

      const [leadsRes, accountsRes, oppsRes] = await Promise.all([
        supabase
          .from('leads')
          .select('status')
          .then((res) => {
            if (!viewAll && res.data) {
              return { data: res.data.filter((l: any) => l.owner_id === userId) };
            }
            return res;
          }),
        supabase
          .from('accounts')
          .select('stage')
          .then((res) => {
            if (!viewAll && res.data) {
              return { data: res.data.filter((a: any) => a.owner_id === userId) };
            }
            return res;
          }),
        supabase
          .from('opportunities')
          .select('stage, amount')
          .then((res) => {
            if (!viewAll && res.data) {
              return { data: res.data.filter((o: any) => o.owner_id === userId) };
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

      const opportunitiesByStage: Record<string, number> = {};
      let wonRevenue = 0;
      let lostRevenue = 0;
      let pipelineValue = 0;

      oppsRes.data?.forEach((opp: any) => {
        opportunitiesByStage[opp.stage] = (opportunitiesByStage[opp.stage] || 0) + 1;
        const amount = parseFloat(opp.amount) || 0;

        if (opp.stage === 'CLOSED_WON') {
          wonRevenue += amount;
        } else if (opp.stage === 'CLOSED_LOST') {
          lostRevenue += amount;
        } else {
          pipelineValue += amount;
        }
      });

      setStats({
        totalLeads: leadsRes.data?.length || 0,
        leadsByStatus,
        totalAccounts: accountsRes.data?.length || 0,
        accountsByStage,
        totalOpportunities: oppsRes.data?.length || 0,
        opportunitiesByStage,
        totalRevenue: wonRevenue + lostRevenue,
        wonRevenue,
        lostRevenue,
        pipelineValue,
      });

      setLoading(false);
    };

    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, user?.id, filters.startDate, filters.endDate, filters.ownerId]);

  const exportToCSV = () => {
    const rows: string[] = [];

    rows.push('Report Type,Category,Value');

    rows.push('');
    rows.push('SUMMARY');
    rows.push(`Total Leads,,${stats.totalLeads}`);
    rows.push(`Total Accounts,,${stats.totalAccounts}`);
    rows.push(`Total Opportunities,,${stats.totalOpportunities}`);
    rows.push(`Won Revenue,,$${stats.wonRevenue}`);
    rows.push(`Lost Revenue,,$${stats.lostRevenue}`);
    rows.push(`Pipeline Value,,$${stats.pipelineValue}`);
    rows.push(`Win Rate,,${stats.totalRevenue > 0 ? ((stats.wonRevenue / stats.totalRevenue) * 100).toFixed(1) : 0}%`);

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

    rows.push('');
    rows.push('OPPORTUNITIES BY STAGE');
    Object.entries(stats.opportunitiesByStage).forEach(([stage, count]) => {
      rows.push(`Opportunities,${stage},${count}`);
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
          <Button onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            {t('reports.export_csv')}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('reports.open_opportunities')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {stats.totalOpportunities -
                    (stats.opportunitiesByStage['CLOSED_WON'] || 0) -
                    (stats.opportunitiesByStage['CLOSED_LOST'] || 0)}
                </p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('reports.pipeline_value')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatCurrency(stats.pipelineValue)}
                </p>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg">
                <DollarSign className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.leads_by_status')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.leadsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">{t(`status.${status.toLowerCase()}`)}</span>
                  <span className="text-lg font-semibold text-gray-900">{count}</span>
                </div>
              ))}
              {Object.keys(stats.leadsByStatus).length === 0 && (
                <p className="text-center text-gray-500 py-4">{t('reports.no_leads_data')}</p>
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
                  <span className="text-sm font-medium text-gray-600">{t(`status.${stage.toLowerCase()}`)}</span>
                  <span className="text-lg font-semibold text-gray-900">{count}</span>
                </div>
              ))}
              {Object.keys(stats.accountsByStage).length === 0 && (
                <p className="text-center text-gray-500 py-4">{t('reports.no_accounts_data')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('reports.opportunities_by_stage')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.opportunitiesByStage).map(([stage, count]) => (
                <div key={stage} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">{t(`stage.${stage.toLowerCase()}`)}</span>
                  <span className="text-lg font-semibold text-gray-900">{count}</span>
                </div>
              ))}
              {Object.keys(stats.opportunitiesByStage).length === 0 && (
                <p className="text-center text-gray-500 py-4">{t('reports.no_opportunities_data')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('reports.revenue_overview')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('reports.won_revenue')}</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {formatCurrency(stats.wonRevenue)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">{t('reports.lost_revenue')}</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {formatCurrency(stats.lostRevenue)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">{t('reports.win_rate')}</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {stats.totalRevenue > 0
                    ? `${((stats.wonRevenue / stats.totalRevenue) * 100).toFixed(1)}%`
                    : '0%'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
