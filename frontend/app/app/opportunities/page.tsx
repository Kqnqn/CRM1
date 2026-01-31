'use client';

import { useEffect, useState } from 'react';
import { supabase, Opportunity } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, List, LayoutGrid } from 'lucide-react';
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
  PROSPECTING: 'bg-gray-200',
  QUALIFIED: 'bg-blue-200',
  PROPOSAL: 'bg-yellow-200',
  NEGOTIATION: 'bg-orange-200',
  CLOSED_WON: 'bg-green-200',
  CLOSED_LOST: 'bg-red-200',
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
    fetchOpportunities();
  }, [profile]);

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

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('opportunities.title')}</h1>
          <p className="text-gray-600 mt-1">{t('subtitle.manage_opportunities')}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button
            variant={view === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('kanban')}
            className="flex-1 md:flex-none"
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            {t('opportunities.view_kanban')}
          </Button>
          <Button
            variant={view === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('list')}
            className="flex-1 md:flex-none"
          >
            <List className="h-4 w-4 mr-1" />
            {t('opportunities.view_list')}
          </Button>
          <Button onClick={() => router.push('/app/opportunities/new')} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            {t('opportunities.new_opportunity')}
          </Button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="flex space-x-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <div
              key={stage}
              className="flex-shrink-0 w-80"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage)}
            >
              <Card className={`${stageColors[stage]} border-2`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    {t(`stage.${stage.toLowerCase()}`)} ({getOpportunitiesByStage(stage).length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {getOpportunitiesByStage(stage).map((opp) => (
                    <Card
                      key={opp.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, opp.id)}
                      className="cursor-move hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-4">
                        <Link
                          href={`/app/opportunities/${opp.id}`}
                          className="font-medium text-blue-600 hover:underline block"
                        >
                          {opp.name}
                        </Link>
                        <p className="text-sm text-gray-600 mt-1">
                          {opp.account?.name}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-lg font-semibold text-gray-900">
                            {formatCurrency(opp.amount || 0)}
                          </span>
                          <Badge variant="outline">{opp.probability}%</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {opp.close_date
                            ? `${t('common.date')}: ${new Date(opp.close_date).toLocaleDateString()}`
                            : t('opportunities.no_close_date')}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                  {getOpportunitiesByStage(stage).length === 0 && (
                    <p className="text-center text-gray-500 py-4 text-sm">
                      {t('opportunities.no_opportunities')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              {opportunities.map((opp) => (
                <Link
                  key={opp.id}
                  href={`/app/opportunities/${opp.id}`}
                  className="block p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-blue-600">{opp.name}</h3>
                      <p className="text-sm text-gray-600">{opp.account?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(opp.amount || 0)}</p>
                      <Badge className="mt-1">{t(`stage.${opp.stage.toLowerCase()}`)}</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
