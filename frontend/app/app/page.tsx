'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/supabase/client';
import { canViewAll } from '@/lib/auth/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, Building2, Target, TrendingUp, CheckCircle2, AlertCircle, DollarSign, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/language-context';

interface Activity {
  id: string;
  subject: string;
  type: string;
  due_date: string;
  status: string;
  completed: boolean;
  related_to_type: string;
  related_to_id: string;
}

interface UnpaidAccount {
  id: string;
  name: string;
  total_outstanding: number;
  invoice_count: number;
  currency: string;
}

interface ServiceDue {
  id: string;
  device_type: string;
  account_name: string;
  next_service_due_at: string;
  status: string;
}

interface LeadStats {
  status: string;
  count: number;
}

interface OpportunityStats {
  stage: string;
  count: number;
  total_amount: number;
}

interface Stats {
  totalLeads: number;
  totalAccounts: number;
  totalOpportunities: number;
  totalRevenue: number;
  winRate: number;
  leadsByStatus: LeadStats[];
  opportunitiesByStage: OpportunityStats[];
}

export default function HomePage() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const { t, formatCurrency } = useLanguage();
  const [openTasks, setOpenTasks] = useState<Activity[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Activity[]>([]);
  const [unpaidAccounts, setUnpaidAccounts] = useState<UnpaidAccount[]>([]);
  const [servicesDueSoon, setServicesDueSoon] = useState<ServiceDue[]>([]);
  const [servicesOverdue, setServicesOverdue] = useState<ServiceDue[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0,
    totalAccounts: 0,
    totalOpportunities: 0,
    totalRevenue: 0,
    winRate: 0,
    leadsByStatus: [],
    opportunitiesByStage: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    if (!user) return;

    const now = new Date().toISOString();

    const [openTasksRes, overdueTasksRes] = await Promise.all([
      supabase
        .from('activities')
        .select('*')
        .eq('assigned_to', user.id)
        .eq('completed', false)
        .order('due_date', { ascending: true })
        .limit(10),
      supabase
        .from('activities')
        .select('*')
        .eq('assigned_to', user.id)
        .eq('completed', false)
        .lt('due_date', now)
        .order('due_date', { ascending: true })
        .limit(10),
    ]);

    if (openTasksRes.data) setOpenTasks(openTasksRes.data);
    if (overdueTasksRes.data) setOverdueTasks(overdueTasksRes.data);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !profile) return;

      const now = new Date().toISOString();
      const isAdmin = profile && canViewAll(profile.role);

      const [
        openTasksRes,
        overdueTasksRes,
        ordersRes,
        accountsRes,
        leadsRes,
        opportunitiesRes,
        servicesRes,
      ] = await Promise.all([
        supabase
          .from('activities')
          .select('*')
          .eq('assigned_to', user.id)
          .eq('completed', false)
          .order('due_date', { ascending: true })
          .limit(10),
        supabase
          .from('activities')
          .select('*')
          .eq('assigned_to', user.id)
          .eq('completed', false)
          .lt('due_date', now)
          .order('due_date', { ascending: true })
          .limit(10),
        supabase.from('orders').select('account_id, amount, paid_amount, currency'),
        supabase.from('accounts').select('id, name'),
        isAdmin
          ? supabase.from('leads').select('status')
          : supabase.from('leads').select('status').eq('owner_id', user.id),
        isAdmin
          ? supabase.from('opportunities').select('stage, amount')
          : supabase.from('opportunities').select('stage, amount').eq('owner_id', user.id),
        isAdmin
          ? supabase
            .from('service_contracts')
            .select('id, device_type, next_service_due_at, status, account:accounts(name)')
            .eq('status', 'ACTIVE')
            .order('next_service_due_at', { ascending: true })
          : supabase
            .from('service_contracts')
            .select('id, device_type, next_service_due_at, status, account:accounts(name)')
            .eq('status', 'ACTIVE')
            .eq('assigned_to_id', user.id)
            .order('next_service_due_at', { ascending: true }),
      ]);

      if (openTasksRes.data) setOpenTasks(openTasksRes.data);
      if (overdueTasksRes.data) setOverdueTasks(overdueTasksRes.data);

      if (ordersRes.data && accountsRes.data) {
        const accountMap = new Map(accountsRes.data.map((a) => [a.id, a.name]));
        const accountTotals = new Map<
          string,
          { outstanding: number; count: number; currency: string }
        >();

        ordersRes.data.forEach((order) => {
          const outstanding = Number(order.amount) - Number(order.paid_amount);
          if (outstanding > 0) {
            const current = accountTotals.get(order.account_id) || {
              outstanding: 0,
              count: 0,
              currency: order.currency,
            };
            accountTotals.set(order.account_id, {
              outstanding: current.outstanding + outstanding,
              count: current.count + 1,
              currency: order.currency,
            });
          }
        });

        const unpaid: UnpaidAccount[] = [];
        accountTotals.forEach((totals, accountId) => {
          const accountName = accountMap.get(accountId) || 'Unknown';
          unpaid.push({
            id: accountId,
            name: accountName,
            total_outstanding: totals.outstanding,
            invoice_count: totals.count,
            currency: totals.currency,
          });
        });

        unpaid.sort((a, b) => b.total_outstanding - a.total_outstanding);
        setUnpaidAccounts(unpaid.slice(0, 10));
      }

      const leadsByStatus = new Map<string, number>();
      if (leadsRes.data) {
        leadsRes.data.forEach((lead) => {
          leadsByStatus.set(lead.status, (leadsByStatus.get(lead.status) || 0) + 1);
        });
      }

      const oppsByStage = new Map<string, { count: number; amount: number }>();
      let wonCount = 0;
      let lostCount = 0;
      let totalRevenue = 0;

      if (opportunitiesRes.data) {
        opportunitiesRes.data.forEach((opp) => {
          const current = oppsByStage.get(opp.stage) || { count: 0, amount: 0 };
          oppsByStage.set(opp.stage, {
            count: current.count + 1,
            amount: current.amount + Number(opp.amount || 0),
          });

          if (opp.stage === 'CLOSED_WON') {
            wonCount++;
            totalRevenue += Number(opp.amount || 0);
          } else if (opp.stage === 'CLOSED_LOST') {
            lostCount++;
          }
        });
      }

      const winRate =
        wonCount + lostCount > 0 ? (wonCount / (wonCount + lostCount)) * 100 : 0;

      if (servicesRes.data) {
        const dueSoon: ServiceDue[] = [];
        const overdue: ServiceDue[] = [];
        const now = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(now.getDate() + 7);

        servicesRes.data.forEach((service: any) => {
          const dueDate = new Date(service.next_service_due_at);
          const serviceDue: ServiceDue = {
            id: service.id,
            device_type: service.device_type,
            account_name: service.account?.name || 'Unknown',
            next_service_due_at: service.next_service_due_at,
            status: service.status,
          };

          if (dueDate < now) {
            overdue.push(serviceDue);
          } else if (dueDate <= sevenDaysFromNow) {
            dueSoon.push(serviceDue);
          }
        });

        setServicesDueSoon(dueSoon.slice(0, 10));
        setServicesOverdue(overdue.slice(0, 10));
      }

      setStats({
        totalLeads: leadsRes.data?.length || 0,
        totalAccounts: accountsRes.data?.length || 0,
        totalOpportunities: opportunitiesRes.data?.length || 0,
        totalRevenue,
        winRate,
        leadsByStatus: Array.from(leadsByStatus.entries()).map(([status, count]) => ({
          status,
          count,
        })),
        opportunitiesByStage: Array.from(oppsByStage.entries()).map(([stage, data]) => ({
          stage,
          count: data.count,
          total_amount: data.amount,
        })),
      });

      setLoading(false);
    };

    fetchData();
  }, [user, profile]);

  const handleMarkComplete = async (taskId: string) => {
    await supabase
      .from('activities')
      .update({ completed: true, status: 'COMPLETED' })
      .eq('id', taskId);

    await fetchTasks();
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t('dashboard.welcome', { name: profile?.full_name || '' })}
        </h1>
        <p className="text-gray-600 mt-1">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link href="/app/leads">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">{t('dashboard.total_leads')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-gray-900">{stats.totalLeads}</div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/app/accounts">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t('dashboard.total_accounts')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-gray-900">{stats.totalAccounts}</div>
                <Building2 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/app/opportunities">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t('dashboard.open_opportunities')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-gray-900">
                  {stats.totalOpportunities}
                </div>
                <Target className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">{t('dashboard.win_rate')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-gray-900">
                {stats.winRate.toFixed(0)}%
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.leads_by_status')}</CardTitle>
            <CardDescription>{t('dashboard.leads_by_status_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.leadsByStatus.length === 0 ? (
              <p className="text-center py-4 text-gray-500">{t('dashboard.no_leads')}</p>
            ) : (
              <div className="space-y-3">
                {stats.leadsByStatus.map((item) => (
                  <div key={item.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          item.status === 'CONVERTED'
                            ? 'bg-green-100 text-green-800'
                            : item.status === 'QUALIFIED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>
                    <div className="text-lg font-semibold">{item.count}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.opportunities_by_stage')}</CardTitle>
            <CardDescription>{t('dashboard.opportunities_by_stage_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.opportunitiesByStage.length === 0 ? (
              <p className="text-center py-4 text-gray-500">{t('dashboard.no_opportunities')}</p>
            ) : (
              <div className="space-y-3">
                {stats.opportunitiesByStage.map((item) => (
                  <div key={item.stage} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          item.stage === 'CLOSED_WON'
                            ? 'bg-green-500/20 text-green-300'
                            : item.stage === 'CLOSED_LOST'
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-blue-500/20 text-blue-300'
                        }
                      >
                        {t(`stage.${item.stage.toLowerCase()}`)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">({item.count})</span>
                    </div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(item.total_amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => router.push('/app/activities')}>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              {t('dashboard.my_open_tasks')}
            </CardTitle>
            <CardDescription>{t('dashboard.my_open_tasks_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-4 text-gray-500">{t('dashboard.loading')}</p>
            ) : openTasks.length === 0 ? (
              <p className="text-center py-4 text-gray-500">{t('empty.no_open_tasks')}</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {openTasks.map((task) => (
                  <div key={task.id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{task.subject}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {task.type} • {t('dashboard.due')} {new Date(task.due_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkComplete(task.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => router.push('/app/activities')}>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              {t('dashboard.overdue_tasks')}
            </CardTitle>
            <CardDescription>{t('dashboard.overdue_tasks_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-4 text-gray-500">{t('dashboard.loading')}</p>
            ) : overdueTasks.length === 0 ? (
              <p className="text-center py-4 text-gray-500">{t('empty.no_overdue_tasks')}</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {overdueTasks.map((task) => (
                  <div key={task.id} className="p-3 border border-red-200 bg-red-50 rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-red-900">{task.subject}</p>
                        <p className="text-xs text-red-600 mt-1">
                          {task.type} • {t('dashboard.overdue_since')} {new Date(task.due_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkComplete(task.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-600" />
              {t('dashboard.unpaid_invoices')}
            </CardTitle>
            <CardDescription>{t('dashboard.unpaid_invoices_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-4 text-gray-500">{t('dashboard.loading')}</p>
            ) : unpaidAccounts.length === 0 ? (
              <p className="text-center py-4 text-gray-500">{t('empty.all_invoices_paid')}</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {unpaidAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/app/accounts/${account.id}?tab=orders`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{account.name}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {account.invoice_count} {account.invoice_count === 1 ? t('dashboard.unpaid_invoice') : t('dashboard.unpaid_invoices')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">
                          {formatCurrency(account.total_outstanding)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => router.push('/app/services?tab=due-soon')}>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-orange-600" />
              {t('dashboard.services_due_soon')}
            </CardTitle>
            <CardDescription>{t('dashboard.services_due_soon_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-4 text-gray-500">{t('dashboard.loading')}</p>
            ) : servicesDueSoon.length === 0 ? (
              <p className="text-center py-4 text-gray-500">{t('empty.no_services_due')}</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {servicesDueSoon.map((service) => (
                  <div
                    key={service.id}
                    className="p-3 border border-orange-200 bg-orange-50 rounded-lg hover:bg-orange-100 cursor-pointer"
                    onClick={() => router.push(`/app/services/${service.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-orange-900">{service.device_type}</p>
                        <p className="text-xs text-orange-600 mt-1">{service.account_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-orange-700">
                          {new Date(service.next_service_due_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => router.push('/app/services?tab=overdue')}>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              {t('dashboard.overdue_services')}
            </CardTitle>
            <CardDescription>{t('dashboard.overdue_services_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-4 text-gray-500">{t('dashboard.loading')}</p>
            ) : servicesOverdue.length === 0 ? (
              <p className="text-center py-4 text-gray-500">{t('empty.no_overdue_services')}</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {servicesOverdue.map((service) => (
                  <div
                    key={service.id}
                    className="p-3 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer"
                    onClick={() => router.push(`/app/services/${service.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-red-900">{service.device_type}</p>
                        <p className="text-xs text-red-600 mt-1">{service.account_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-red-700">
                          {new Date(service.next_service_due_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
