'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/supabase/client';
import { canViewAll } from '@/lib/auth/permissions';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  Building2,
  Target,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Wrench,
  ArrowRight,
  Sparkles,
  Zap,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/language-context';
import { cn } from '@/lib/utils';

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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  trend,
  color,
  delay,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  href?: string;
  trend?: string;
  color: string;
  delay: number;
}) {
  const content = (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-card p-6 shadow-card transition-all duration-300 hover:shadow-card-hover',
        href && 'cursor-pointer'
      )}
    >
      {/* Background gradient decoration */}
      <div
        className={cn(
          'absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20',
          color
        )}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="mt-2 text-3xl font-bold tracking-tight">{value}</h3>
          {trend && (
            <p className="mt-1 text-xs font-medium text-emerald-600">{trend}</p>
          )}
        </div>
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl',
            color.replace('bg-', 'bg-').replace('500', '100'),
            color.replace('bg-', 'text-').replace('500', '600')
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>

      {href && (
        <div className="mt-4 flex items-center text-xs font-medium text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          View details
          <ArrowRight className="ml-1 h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      )}
    </motion.div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

function TaskItem({
  task,
  onComplete,
  variant = 'default',
}: {
  task: Activity;
  onComplete: (id: string) => void;
  variant?: 'default' | 'overdue';
}) {
  const isOverdue = variant === 'overdue';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className={cn(
        'group flex items-center gap-3 rounded-xl border p-3 transition-all duration-200',
        isOverdue
          ? 'border-rose-200 bg-rose-50/50 hover:bg-rose-100/50 dark:border-rose-900/30 dark:bg-rose-900/10'
          : 'border-border/50 bg-card/50 hover:bg-accent/50'
      )}
    >
      <Button
        size="icon"
        variant="ghost"
        className={cn(
          'h-8 w-8 shrink-0 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100',
          isOverdue && 'text-rose-600 hover:text-rose-700 hover:bg-rose-100'
        )}
        onClick={() => onComplete(task.id)}
      >
        <CheckCircle2 className="h-4 w-4" />
      </Button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-medium',
            isOverdue && 'text-rose-900 dark:text-rose-200'
          )}
        >
          {task.subject}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className="text-xs font-normal">
            {task.type}
          </Badge>
          <span className="text-xs text-muted-foreground">
            <Calendar className="inline h-3 w-3 mr-1" />
            {new Date(task.due_date).toLocaleDateString()}
          </span>
        </div>
      </div>
    </motion.div>
  );
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

  if (loading) {
    return (
      <div className="page-container">
        <div className="mb-8">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-600 text-primary-foreground shadow-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t('dashboard.welcome', { name: profile?.full_name?.split(' ')[0] || '' })}
            </h1>
            <p className="text-muted-foreground mt-0.5">{t('dashboard.subtitle')}</p>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title={t('dashboard.total_leads')}
          value={stats.totalLeads}
          icon={Users}
          href="/app/leads"
          color="bg-blue-500"
          delay={0}
        />
        <StatCard
          title={t('dashboard.total_accounts')}
          value={stats.totalAccounts}
          icon={Building2}
          href="/app/accounts"
          color="bg-emerald-500"
          delay={0.1}
        />
        <StatCard
          title={t('dashboard.open_opportunities')}
          value={stats.totalOpportunities}
          icon={Target}
          href="/app/opportunities"
          color="bg-violet-500"
          delay={0.2}
        />
        <StatCard
          title={t('dashboard.win_rate')}
          value={`${stats.winRate.toFixed(0)}%`}
          icon={TrendingUp}
          trend="+5% from last month"
          color="bg-amber-500"
          delay={0.3}
        />
      </div>

      {/* Analytics Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {t('dashboard.leads_by_status')}
            </CardTitle>
            <CardDescription>{t('dashboard.leads_by_status_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.leadsByStatus.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">{t('dashboard.no_leads')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.leadsByStatus.map((item, index) => (
                  <motion.div
                    key={item.status}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          item.status === 'CONVERTED'
                            ? 'success'
                            : item.status === 'QUALIFIED'
                            ? 'info'
                            : 'secondary'
                        }
                        className="min-w-[80px] justify-center"
                      >
                        {t(`status.${item.status.toLowerCase()}`)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(item.count / stats.totalLeads) * 100}%` }}
                          transition={{ delay: 0.5 + index * 0.1, duration: 0.5 }}
                          className={cn(
                            'h-full rounded-full',
                            item.status === 'CONVERTED'
                              ? 'bg-emerald-500'
                              : item.status === 'QUALIFIED'
                              ? 'bg-primary'
                              : 'bg-muted-foreground'
                          )}
                        />
                      </div>
                      <span className="text-sm font-semibold w-8 text-right">{item.count}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-violet-500" />
              {t('dashboard.opportunities_by_stage')}
            </CardTitle>
            <CardDescription>{t('dashboard.opportunities_by_stage_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.opportunitiesByStage.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                  <Target className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">{t('dashboard.no_opportunities')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.opportunitiesByStage.map((item, index) => (
                  <motion.div
                    key={item.stage}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          item.stage === 'CLOSED_WON'
                            ? 'success'
                            : item.stage === 'CLOSED_LOST'
                            ? 'error'
                            : 'info'
                        }
                        className="min-w-[100px] justify-center"
                      >
                        {t(`stage.${item.stage.toLowerCase()}`)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">({item.count})</span>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatCurrency(item.total_amount)}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Task Lists Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Open Tasks */}
        <Card>
          <CardHeader className="pb-4 cursor-pointer" onClick={() => router.push('/app/activities')}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                {t('dashboard.my_open_tasks')}
              </CardTitle>
              <Badge variant="secondary">{openTasks.length}</Badge>
            </div>
            <CardDescription>{t('dashboard.my_open_tasks_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {openTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm text-muted-foreground">{t('empty.no_open_tasks')}</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {openTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onComplete={handleMarkComplete}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Overdue Tasks */}
        <Card>
          <CardHeader className="pb-4 cursor-pointer" onClick={() => router.push('/app/activities')}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4" />
                </div>
                {t('dashboard.overdue_tasks')}
              </CardTitle>
              <Badge variant="error">{overdueTasks.length}</Badge>
            </div>
            <CardDescription>{t('dashboard.overdue_tasks_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {overdueTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm text-muted-foreground">{t('empty.no_overdue_tasks')}</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {overdueTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onComplete={handleMarkComplete}
                      variant="overdue"
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Unpaid Invoices */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  <DollarSign className="h-4 w-4" />
                </div>
                {t('dashboard.unpaid_invoices')}
              </CardTitle>
              <Badge variant="warning">{unpaidAccounts.length}</Badge>
            </div>
            <CardDescription>{t('dashboard.unpaid_invoices_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {unpaidAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm text-muted-foreground">{t('empty.all_invoices_paid')}</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {unpaidAccounts.map((account) => (
                    <motion.div
                      key={account.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="group flex items-center justify-between rounded-xl border border-border/50 bg-card/50 p-3 transition-colors hover:bg-accent/50 cursor-pointer"
                      onClick={() => router.push(`/app/accounts/${account.id}?tab=orders`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{account.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {account.invoice_count} {account.invoice_count === 1 ? 'invoice' : 'invoices'}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-rose-600">
                        {formatCurrency(account.total_outstanding)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
