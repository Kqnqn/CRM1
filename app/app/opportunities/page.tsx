'use client';

import { useEffect, useState } from 'react';
import { supabase, Opportunity } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, List, LayoutGrid, Target, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { canViewAll } from '@/lib/auth/permissions';
import { useLanguage } from '@/lib/i18n/language-context';

const stages = [
  'PROSPECTING',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
];

const stageColors: Record<string, string> = {
  PROSPECTING: 'bg-slate-100 border-slate-300',
  QUALIFIED: 'bg-sky-50 border-sky-300',
  PROPOSAL: 'bg-amber-50 border-amber-300',
  NEGOTIATION: 'bg-orange-50 border-orange-300',
  CLOSED_WON: 'bg-emerald-50 border-emerald-300',
  CLOSED_LOST: 'bg-rose-50 border-rose-300',
};

const stageTextColors: Record<string, string> = {
  PROSPECTING: 'text-slate-700',
  QUALIFIED: 'text-sky-700',
  PROPOSAL: 'text-amber-700',
  NEGOTIATION: 'text-orange-700',
  CLOSED_WON: 'text-emerald-700',
  CLOSED_LOST: 'text-rose-700',
};

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const { profile, user } = useAuth();
  const router = useRouter();
  const { t, formatCurrency } = useLanguage();

  const fetchOpportunities = async () => {
    setLoading(true);
    let query = supabase
      .from('opportunities')
      .select('*, account:accounts!opportunities_account_id_fkey(*), owner:profiles!opportunities_owner_id_fkey(*)')
      .order('created_at', { ascending: false });

    if (profile && !canViewAll(profile.role)) {
      query = query.eq('owner_id', user?.id);
    }

    const { data, error } = await query;

    if (data && !error) {
      setOpportunities(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (profile) {
      fetchOpportunities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, user?.id]);

  const handleDragStart = (e: React.DragEvent, oppId: string) => {
    e.dataTransfer.setData('oppId', oppId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    const oppId = e.dataTransfer.getData('oppId');

    await supabase
      .from('opportunities')
      .update({ stage: newStage })
      .eq('id', oppId);

    await supabase.from('audit_log').insert({
      entity_type: 'OPPORTUNITY',
      entity_id: oppId,
      action: 'STAGE_CHANGE',
      new_value: newStage,
      user_id: user?.id,
    });

    fetchOpportunities();
  };

  const getOpportunitiesByStage = (stage: string) => {
    return opportunities.filter((opp) => opp.stage === stage);
  };

  if (loading) {
    return <div className="p-6">{t('dashboard.loading')}</div>;
  }

  const totalValue = opportunities.reduce((sum, opp) => sum + (parseFloat(opp.amount?.toString() || '0')), 0);
  const wonCount = opportunities.filter(opp => opp.stage === 'CLOSED_WON').length;
  const lostCount = opportunities.filter(opp => opp.stage === 'CLOSED_LOST').length;
  const openCount = opportunities.length - wonCount - lostCount;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t('opportunities.title')}</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">{t('subtitle.manage_opportunities')}</p>
          </div>
          <Button
            onClick={() => router.push('/app/opportunities/new')}
            className="w-full sm:w-auto whitespace-nowrap"
            size="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('opportunities.new_opportunity')}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant={view === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('kanban')}
            className="flex-1 sm:flex-none"
          >
            <LayoutGrid className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">{t('opportunities.view_kanban')}</span>
            <span className="sm:hidden">Kanban</span>
          </Button>
          <Button
            variant={view === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('list')}
            className="flex-1 sm:flex-none"
          >
            <List className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">{t('opportunities.view_list')}</span>
            <span className="sm:hidden">List</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-card shadow-sm border-border">
          <CardContent className="p-3 sm:p-4 md:p-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground line-clamp-1">
                  {t('opportunities.total_value')}
                </p>
                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-600" />
                </div>
              </div>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-foreground truncate">
                {formatCurrency(totalValue)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border">
          <CardContent className="p-3 sm:p-4 md:p-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground line-clamp-1">
                  {t('opportunities.open_deals')}
                </p>
                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Target className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-green-600" />
                </div>
              </div>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">{openCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border">
          <CardContent className="p-3 sm:p-4 md:p-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground line-clamp-1">
                  {t('opportunities.won_deals')}
                </p>
                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-emerald-600" />
                </div>
              </div>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-emerald-600">{wonCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border">
          <CardContent className="p-3 sm:p-4 md:p-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground line-clamp-1">
                  {t('opportunities.lost_deals')}
                </p>
                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <XCircle className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-rose-600" />
                </div>
              </div>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-rose-600">{lostCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {view === 'kanban' ? (
        <div className="relative">
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 px-0.5 -mx-1 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {stages.map((stage) => {
              const stageOpps = getOpportunitiesByStage(stage);
              const stageValue = stageOpps.reduce((sum, opp) => sum + (parseFloat(opp.amount?.toString() || '0')), 0);

              return (
                <div
                  key={stage}
                  className="flex-shrink-0 w-[280px] sm:w-[300px] md:w-[320px] snap-start"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage)}
                >
                  <Card className={`${stageColors[stage]} border-2 h-full`}>
                    <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-4 pt-3 sm:pt-4">
                      <div className="flex items-center justify-between mb-1">
                        <CardTitle className={`text-xs sm:text-sm font-semibold uppercase tracking-wide ${stageTextColors[stage]} line-clamp-1`}>
                          {t(`stage.${stage.toLowerCase()}`)}
                        </CardTitle>
                        <Badge variant="secondary" className="font-semibold text-xs flex-shrink-0">
                          {stageOpps.length}
                        </Badge>
                      </div>
                      {stageValue > 0 && (
                        <p className="text-xs font-medium text-muted-foreground truncate">
                          {formatCurrency(stageValue)}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2 sm:space-y-3 px-3 sm:px-4 pb-3 sm:pb-4 min-h-[180px] sm:min-h-[200px]">
                      {stageOpps.map((opp) => (
                        <Card
                          key={opp.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, opp.id)}
                          className="cursor-move hover:shadow-lg active:shadow-xl transition-all touch-none bg-card border-border"
                        >
                          <CardContent className="p-3 sm:p-4">
                            <Link
                              href={`/app/opportunities/${opp.id}`}
                              className="font-semibold text-foreground hover:text-blue-600 active:text-blue-700 block mb-2 text-sm line-clamp-2"
                            >
                              {opp.name}
                            </Link>
                            <p className="text-xs text-muted-foreground mb-2 sm:mb-3 line-clamp-1">
                              {opp.account?.name}
                            </p>
                            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                              <span className="text-sm sm:text-base font-bold text-foreground truncate">
                                {formatCurrency(opp.amount || 0)}
                              </span>
                              <Badge variant="outline" className="text-xs font-semibold flex-shrink-0 ml-2">
                                {opp.probability}%
                              </Badge>
                            </div>
                            {opp.close_date && (
                              <p className="text-xs text-muted-foreground mt-2 truncate">
                                {new Date(opp.close_date).toLocaleDateString()}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                      {stageOpps.length === 0 && (
                        <div className="text-center py-6 sm:py-8">
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {t('opportunities.no_opportunities')}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-center sm:hidden">
            <p className="text-xs text-muted-foreground">Swipe left/right to see all stages</p>
          </div>
        </div>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-3 sm:p-4 md:p-6">
            <div className="space-y-2 sm:space-y-3">
              {opportunities.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <LayoutGrid className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm">{t('opportunities.no_opportunities')}</p>
                </div>
              ) : (
                opportunities.map((opp) => (
                  <Link
                    key={opp.id}
                    href={`/app/opportunities/${opp.id}`}
                    className="block p-3 sm:p-4 border rounded-lg hover:bg-muted active:bg-muted transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-blue-600 text-sm sm:text-base line-clamp-1">
                          {opp.name}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-1">
                          {opp.account?.name}
                        </p>
                      </div>
                      <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                        <p className="font-bold text-sm sm:text-base text-foreground">
                          {formatCurrency(opp.amount || 0)}
                        </p>
                        <Badge className="text-xs whitespace-nowrap">
                          {t(`stage.${opp.stage.toLowerCase()}`)}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
