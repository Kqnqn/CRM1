'use client';

import { useEffect, useState } from 'react';
import { supabase, Activity } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, CheckSquare, Calendar, Edit, Trash2, Check } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/i18n/language-context';

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityType, setActivityType] = useState<'TASK' | 'EVENT'>('TASK');
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [leads, setLeads] = useState<Array<{ id: string; company_name: string }>>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [opportunities, setOpportunities] = useState<Array<{ id: string; name: string }>>([]);

  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    status: 'NOT_STARTED',
    priority: 'MEDIUM',
    due_date: '',
    start_time: '',
    end_time: '',
    location: '',
    related_to_type: '',
    related_to_id: '',
  });

  const fetchActivities = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('activities')
      .select('*, owner:profiles!activities_owner_id_fkey(*)')
      .eq('owner_id', user?.id)
      .order('created_at', { ascending: false });

    if (data) setActivities(data);
    setLoading(false);
  };

  const fetchEntities = async () => {
    const [leadsRes, accountsRes, contactsRes, oppsRes] = await Promise.all([
      supabase.from('leads').select('id, company_name').order('company_name').limit(100),
      supabase.from('accounts').select('id, name').order('name').limit(100),
      supabase.from('contacts').select('id, first_name, last_name').order('first_name').limit(100),
      supabase.from('opportunities').select('id, name').order('name').limit(100),
    ]);

    if (leadsRes.data) setLeads(leadsRes.data);
    if (accountsRes.data) setAccounts(accountsRes.data);
    if (contactsRes.data) setContacts(contactsRes.data);
    if (oppsRes.data) setOpportunities(oppsRes.data);
  };

  useEffect(() => {
    if (user) {
      fetchActivities();
      fetchEntities();
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const activityData: any = {
      type: activityType,
      subject: formData.subject,
      description: formData.description,
      related_to_type: formData.related_to_type || null,
      related_to_id: formData.related_to_id || null,
    };

    if (activityType === 'TASK') {
      activityData.status = formData.status;
      activityData.priority = formData.priority;
      activityData.due_date = formData.due_date || null;
      activityData.completed = formData.status === 'COMPLETED';
    } else {
      activityData.start_time = formData.start_time || null;
      activityData.end_time = formData.end_time || null;
      activityData.location = formData.location || null;
    }

    if (editingActivity) {
      const { error } = await supabase
        .from('activities')
        .update(activityData)
        .eq('id', editingActivity.id);

      if (!error) {
        toast({
          title: t('message.activity_updated'),
          description: t('message.activity_updated_desc'),
        });
      }
    } else {
      activityData.owner_id = user?.id;
      activityData.assigned_to = user?.id;

      const { error } = await supabase.from('activities').insert(activityData);

      if (!error) {
        toast({
          title: t('message.activity_created'),
          description: t('message.activity_created_desc'),
        });
      }
    }

    setShowDialog(false);
    setEditingActivity(null);
    setFormData({
      subject: '',
      description: '',
      status: 'NOT_STARTED',
      priority: 'MEDIUM',
      due_date: '',
      start_time: '',
      end_time: '',
      location: '',
      related_to_type: '',
      related_to_id: '',
    });
    fetchActivities();
  };

  const handleEdit = (activity: Activity) => {
    setEditingActivity(activity);
    setActivityType(activity.type === 'TASK' || activity.type === 'EVENT' ? activity.type : 'TASK');

    setFormData({
      subject: activity.subject || '',
      description: activity.description || '',
      status: activity.status || 'NOT_STARTED',
      priority: activity.priority || 'MEDIUM',
      due_date: activity.due_date ? new Date(activity.due_date).toISOString().slice(0, 16) : '',
      start_time: activity.start_time ? new Date(activity.start_time).toISOString().slice(0, 16) : '',
      end_time: activity.end_time ? new Date(activity.end_time).toISOString().slice(0, 16) : '',
      location: activity.location || '',
      related_to_type: activity.related_to_type || '',
      related_to_id: activity.related_to_id || '',
    });
    setShowDialog(true);
  };

  const handleDelete = async (activityId: string) => {
    if (!confirm(t('message.delete_confirm_activity'))) return;

    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', activityId);

    if (!error) {
      toast({
        title: t('message.activity_deleted'),
        description: t('message.activity_deleted_desc'),
      });
      fetchActivities();
    }
  };

  const handleMarkComplete = async (activityId: string) => {
    const { error } = await supabase
      .from('activities')
      .update({ completed: true, status: 'COMPLETED' })
      .eq('id', activityId);

    if (!error) {
      toast({
        title: t('message.task_completed'),
        description: t('message.task_completed_desc'),
      });
      fetchActivities();
    }
  };

  const handleDialogClose = (open: boolean) => {
    setShowDialog(open);
    if (!open) {
      setEditingActivity(null);
      setFormData({
        subject: '',
        description: '',
        status: 'NOT_STARTED',
        priority: 'MEDIUM',
        due_date: '',
        start_time: '',
        end_time: '',
        location: '',
        related_to_type: '',
        related_to_id: '',
      });
    }
  };

  const getRelatedEntityName = (activity: Activity) => {
    if (!activity.related_to_type || !activity.related_to_id) return null;

    switch (activity.related_to_type) {
      case 'LEAD':
        const lead = leads.find((l) => l.id === activity.related_to_id);
        return lead ? `${t('nav.leads')}: ${lead.company_name}` : t('nav.leads');
      case 'ACCOUNT':
        const account = accounts.find((a) => a.id === activity.related_to_id);
        return account ? `${t('nav.accounts')}: ${account.name}` : t('nav.accounts');
      case 'CONTACT':
        const contact = contacts.find((c) => c.id === activity.related_to_id);
        return contact ? `${t('nav.contacts')}: ${contact.first_name} ${contact.last_name}` : t('nav.contacts');
      case 'OPPORTUNITY':
        const opp = opportunities.find((o) => o.id === activity.related_to_id);
        return opp ? `${t('nav.opportunities')}: ${opp.name}` : t('nav.opportunities');
      default:
        return null;
    }
  };

  const tasks = activities.filter((a) => a.type === 'TASK');
  const events = activities.filter((a) => a.type === 'EVENT');

  if (loading) {
    return <div className="p-6">{t('dashboard.loading')}</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('activities.title')}</h1>
          <p className="text-gray-600 mt-1">{t('subtitle.manage_activities')}</p>
        </div>
        <Dialog open={showDialog} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('activities.new_activity')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingActivity ? t('activities.edit_activity') : t('activities.new_activity')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('common.type')}</Label>
                <Select
                  value={activityType}
                  onValueChange={(value: any) => setActivityType(value)}
                  disabled={!!editingActivity}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TASK">{t('activities.type.task')}</SelectItem>
                    <SelectItem value="EVENT">{t('activities.type.event')}</SelectItem>
                  </SelectContent>
                </Select>
                {editingActivity && (
                  <p className="text-xs text-gray-500">{t('activities.type_change_warning')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t('activities.table.subject')}</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>{t('common.description')}</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('activities.related_to_optional')}</Label>
                <div className="flex items-center space-x-2">
                  <Select
                    value={formData.related_to_type || undefined}
                    onValueChange={(value) => setFormData({ ...formData, related_to_type: value, related_to_id: '' })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={t('common.select_type')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEAD">{t('nav.leads')}</SelectItem>
                      <SelectItem value="ACCOUNT">{t('nav.accounts')}</SelectItem>
                      <SelectItem value="CONTACT">{t('nav.contacts')}</SelectItem>
                      <SelectItem value="OPPORTUNITY">{t('nav.opportunities')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.related_to_type && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, related_to_type: '', related_to_id: '' })}
                    >
                      {t('common.clear')}
                    </Button>
                  )}
                </div>
              </div>

              {formData.related_to_type && (
                <div className="space-y-2">
                  <Label>{t('common.select')} {formData.related_to_type === 'LEAD' ? t('nav.leads') : formData.related_to_type === 'ACCOUNT' ? t('nav.accounts') : formData.related_to_type === 'CONTACT' ? t('nav.contacts') : t('nav.opportunities')}</Label>
                  <Select
                    value={formData.related_to_id}
                    onValueChange={(value) => setFormData({ ...formData, related_to_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.select_placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.related_to_type === 'LEAD' &&
                        leads.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.company_name}
                          </SelectItem>
                        ))}
                      {formData.related_to_type === 'ACCOUNT' &&
                        accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      {formData.related_to_type === 'CONTACT' &&
                        contacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.first_name} {contact.last_name}
                          </SelectItem>
                        ))}
                      {formData.related_to_type === 'OPPORTUNITY' &&
                        opportunities.map((opp) => (
                          <SelectItem key={opp.id} value={opp.id}>
                            {opp.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {activityType === 'TASK' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('common.status')}</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NOT_STARTED">{t('status.not_started')}</SelectItem>
                          <SelectItem value="IN_PROGRESS">{t('status.in_progress')}</SelectItem>
                          <SelectItem value="COMPLETED">{t('status.completed')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{t('common.priority')}</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) => setFormData({ ...formData, priority: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">{t('priority.low')}</SelectItem>
                          <SelectItem value="MEDIUM">{t('priority.medium')}</SelectItem>
                          <SelectItem value="HIGH">{t('priority.high')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('activities.table.due_date')}</Label>
                    <Input
                      type="datetime-local"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('activities.table.start_time')}</Label>
                      <Input
                        type="datetime-local"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t('activities.table.end_time')}</Label>
                      <Input
                        type="datetime-local"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('activities.location')}</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder={t('activities.location_placeholder')}
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit">
                  {editingActivity ? t('activities.edit_activity') : t('activities.new_activity')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">
            <CheckSquare className="h-4 w-4 mr-2" />
            {t('activities.type.tasks')} ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="events">
            <Calendar className="h-4 w-4 mr-2" />
            {t('activities.type.events')} ({events.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-6">
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  {t('activities.no_activities')}
                </CardContent>
              </Card>
            ) : (
              tasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{task.subject}</h3>
                        {task.description && (
                          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                        )}
                        {getRelatedEntityName(task) && (
                          <p className="text-xs text-blue-600 mt-1">
                            {getRelatedEntityName(task)}
                          </p>
                        )}
                        <div className="flex items-center space-x-3 mt-2">
                          <Badge variant="outline">{t('status.' + task.status?.toLowerCase())}</Badge>
                          <Badge variant="secondary">{t('priority.' + task.priority?.toLowerCase())}</Badge>
                          {task.due_date && (
                            <span className="text-xs text-gray-500">
                              {t('dashboard.due')}: {format(new Date(task.due_date), 'MMM d, yyyy h:mm a')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {!task.completed && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMarkComplete(task.id)}
                            title={t('activities.mark_complete_tip')}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(task)}
                          title={t('common.edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(task.id)}
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="events" className="mt-6">
          <div className="space-y-3">
            {events.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  {t('activities.no_activities')}
                </CardContent>
              </Card>
            ) : (
              events.map((event) => (
                <Card key={event.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{event.subject}</h3>
                        {event.description && (
                          <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                        )}
                        {getRelatedEntityName(event) && (
                          <p className="text-xs text-blue-600 mt-1">
                            {getRelatedEntityName(event)}
                          </p>
                        )}
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                          {event.start_time && (
                            <span>{t('activities.table.start_time')}: {format(new Date(event.start_time), 'MMM d, yyyy h:mm a')}</span>
                          )}
                          {event.location && <span>{t('activities.location')}: {event.location}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(event)}
                          title={t('common.edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(event.id)}
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
