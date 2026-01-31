'use client';

import { useEffect, useState } from 'react';
import { supabase, Opportunity } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, List, LayoutGrid, Target, CheckCircle2, XCircle, GripVertical, Calendar, Building2, TrendingUp } from 'lucide-react';
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

// Dark mode compatible colors
const stageColors: Record<string, string> = {
  PROSPECTING: 'bg-slate-500/20 border-slate-500/50',
  QUALIFIED: 'bg-cyan-500/20 border-cyan-500/50',
  PROPOSAL: 'bg-amber-500/20 border-amber-500/50',
  NEGOTIATION: 'bg-orange-500/20 border-orange-500/50',
  CLOSED_WON: 'bg-emerald-500/20 border-emerald-500/50',
  CLOSED_LOST: 'bg-rose-500/20 border-rose-500/50',
};

const stageHeaderColors: Record<string, string> = {
  PROSPECTING: 'from-slate-600 to-slate-700',
  QUALIFIED: 'from-cyan-600 to-cyan-700',
  PROPOSAL: 'from-amber-600 to-amber-700',
  NEGOTIATION: 'from-orange-600 to-orange-700',
  CLOSED_WON: 'from-emerald-600 to-emerald-700',
  CLOSED_LOST: 'from-rose-600 to-rose-700',
};

const stageBadgeColors: Record<string, string> = {
  PROSPECTING: 'bg-slate-500/30 text-slate-200',
  QUALIFIED: 'bg-cyan-500/30 text-cyan-200',
  PROPOSAL: 'bg-amber-500/30 text-amber-200',
  NEGOTIATION: 'bg-orange-500/30 text-orange-200',
  CLOSED_WON: 'bg-emerald-500/30 text-emerald-200',
  CLOSED_LOST: 'bg-rose-500/30 text-rose-200',
};

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [activeStage, setActiveStage] = useState<string | null>(null);
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
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-muted-foreground">{t('dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  const totalValue = opportunities.reduce((sum, opp) => sum + (parseFloat(opp.amount?.toString() || '0')), 0);
  const wonCount = opportunities.filter(opp => opp.stage === 'CLOSED_WON').length;
  const lostCount = opportunities.filter(opp => opp.stage === 'CLOSED_LOST').length;
  const openCount = opportunities.length - wonCount - lostCount;

  // Mobile view - show stages as tabs/accordion
  const MobileKanbanView = () => (
    <div className="space-y-3">
      {/* Stage tabs for mobile */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {stages.map((stage) => {
          const count = getOpportunitiesByStage(stage).length;
          return (
            <button
              key={stage}
              onClick={() => setActiveStage(activeStage === stage ? null : stage)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeStage === stage
                  ? `bg-gradient-to-r ${stageHeaderColors[stage]} text-white shadow-lg`
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(`stage.${stage.toLowerCase()}`)}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                activeStage === stage ? 'bg-white/20' : 'bg-muted'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active stage content */}
      {activeStage && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {getOpportunitiesByStage(activeStage).map((opp) => (
            <OpportunityCard key={opp.id} opp={opp} />
          ))}
          {getOpportunitiesByStage(activeStage).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('opportunities.no_opportunities')}</p>
            </div>
          )}
        </div>
      )}

      {/* Show all if no stage selected */}
      {!activeStage && (
        <div className="text-center py-8 text-muted-foreground">
          <LayoutGrid className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Odaberite fazu za pregled prilika</p>
        </div>
      )}
    </div>
  );

  // Opportunity card component
  const OpportunityCard = ({ opp, draggable = false }: { opp: Opportunity; draggable?: boolean }) => (
    <div
      draggable={draggable}
      onDragStart={draggable ? (e) => handleDragStart(e, opp.id) : undefined}
      className={`group relative bg-card border border-border rounded-xl overflow-hidden transition-all duration-200 hover:border-primary/50 hover:shadow-lg ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {draggable && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      
      <Link href={`/app/opportunities/${opp.id}`} className="block p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {opp.name}
          </h3>
          <Badge className={`${stageBadgeColors[opp.stage]} border-0 text-[10px] font-semibold flex-shrink-0`}>
            {opp.probability}%
          </Badge>
        </div>
        
        {opp.account?.name && (
          <div className="flex items-center gap-1.5 text-muted-foreground mb-3">
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs truncate">{opp.account.name}</span>
          </div>
        )}
        
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="font-bold text-foreground">
              {formatCurrency(opp.amount || 0)}
            </span>
          </div>
          
          {opp.close_date && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-xs">
                {new Date(opp.close_date).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </Link>
    </div>
  );

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t('opportunities.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('subtitle.manage_opportunities')}</p>
          </div>
          <Button
            onClick={() => router.push('/app/opportunities/new')}
            className="w-full sm:w-auto"
            data-testid="new-opportunity-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('opportunities.new_opportunity')}
          </Button>
        </div>

        {/* View toggle */}
        <div className="flex gap-2">
          <Button
            variant={view === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('kanban')}
            className="flex-1 sm:flex-none"
            data-testid="view-kanban-btn"
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
            data-testid="view-list-btn"
          >
            <List className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">{t('opportunities.view_list')}</span>
            <span className="sm:hidden">Lista</span>
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <LayoutGrid className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            <p className="text-xs text-blue-300/80 mb-1">{t('opportunities.total_value')}</p>
            <p className="text-lg font-bold text-foreground truncate">{formatCurrency(totalValue)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Target className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <p className="text-xs text-emerald-300/80 mb-1">{t('opportunities.open_deals')}</p>
            <p className="text-lg font-bold text-foreground">{openCount}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
              </div>
            </div>
            <p className="text-xs text-green-300/80 mb-1">{t('opportunities.won_deals')}</p>
            <p className="text-lg font-bold text-green-400">{wonCount}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-rose-400" />
              </div>
            </div>
            <p className="text-xs text-rose-300/80 mb-1">{t('opportunities.lost_deals')}</p>
            <p className="text-lg font-bold text-rose-400">{lostCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Kanban / List view */}
      {view === 'kanban' ? (
        <>
          {/* Mobile view */}
          <div className="md:hidden">
            <MobileKanbanView />
          </div>

          {/* Desktop view */}
          <div className="hidden md:block">
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              {stages.map((stage) => {
                const stageOpps = getOpportunitiesByStage(stage);
                const stageValue = stageOpps.reduce((sum, opp) => sum + (parseFloat(opp.amount?.toString() || '0')), 0);

                return (
                  <div
                    key={stage}
                    className="flex-shrink-0 w-[300px]"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage)}
                    data-testid={`stage-column-${stage.toLowerCase()}`}
                  >
                    <div className={`rounded-xl border-2 ${stageColors[stage]} overflow-hidden`}>
                      {/* Stage header */}
                      <div className={`bg-gradient-to-r ${stageHeaderColors[stage]} px-4 py-3`}>
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
                            {t(`stage.${stage.toLowerCase()}`)}
                          </h3>
                          <Badge className="bg-white/20 text-white border-0 text-xs">
                            {stageOpps.length}
                          </Badge>
                        </div>
                        {stageValue > 0 && (
                          <p className="text-xs text-white/70 mt-1">
                            {formatCurrency(stageValue)}
                          </p>
                        )}
                      </div>

                      {/* Stage content */}
                      <div className="p-3 space-y-3 min-h-[200px] max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                        {stageOpps.map((opp) => (
                          <OpportunityCard key={opp.id} opp={opp} draggable />
                        ))}
                        {stageOpps.length === 0 && (
                          <div className="text-center py-8">
                            <Target className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                            <p className="text-xs text-muted-foreground">
                              {t('opportunities.no_opportunities')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        /* List view */
        <Card className="border-border">
          <CardContent className="p-0">
            {opportunities.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <LayoutGrid className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">{t('opportunities.no_opportunities')}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {opportunities.map((opp) => (
                  <Link
                    key={opp.id}
                    href={`/app/opportunities/${opp.id}`}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                    data-testid={`opportunity-item-${opp.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate">
                          {opp.name}
                        </h3>
                        <Badge className={`${stageBadgeColors[opp.stage]} border-0 text-[10px] flex-shrink-0`}>
                          {t(`stage.${opp.stage.toLowerCase()}`)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {opp.account?.name && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            <span className="truncate">{opp.account.name}</span>
                          </span>
                        )}
                        {opp.close_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(opp.close_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1">
                      <p className="font-bold text-foreground">
                        {formatCurrency(opp.amount || 0)}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {opp.probability}% vjerojatnost
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
