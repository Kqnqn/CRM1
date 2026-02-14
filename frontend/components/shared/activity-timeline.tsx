'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase, Activity, Note, AuditLog } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, CheckSquare, FileText, History, Edit, Trash2, Check } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/i18n/language-context';

interface ActivityTimelineProps {
  relatedToType: string;
  relatedToId: string;
}

export function ActivityTimeline(props: ActivityTimelineProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ActivityTimelineContent {...props} />
    </Suspense>
  );
}

function ActivityTimelineContent({ relatedToType, relatedToId }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({
    subject: '',
    description: '',
    status: 'NOT_STARTED',
    priority: 'MEDIUM',
    due_date: '',
    start_time: '',
    end_time: '',
    location: '',
  });
  const { toast } = useToast();
  const { t } = useLanguage();

  const cleanupOldStageChanges = async (allAuditLogs: AuditLog[]) => {
    // Filter only STAGE_CHANGE entries
    const stageChanges = allAuditLogs.filter((log) => log.action === 'STAGE_CHANGE');

    // If there are more than 7, delete the older ones
    if (stageChanges.length > 7) {
      const sorted = stageChanges.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const toDelete = sorted.slice(7);

      for (const log of toDelete) {
        await supabase.from('audit_log').delete().eq('id', log.id);
      }
    }
  };

  const fetchTimeline = async () => {
    setLoading(true);
    const [activitiesRes, notesRes, auditRes] = await Promise.all([
      supabase
        .from('activities')
        .select('*, owner:profiles!activities_owner_id_fkey(*)')
        .eq('related_to_type', relatedToType)
        .eq('related_to_id', relatedToId)
        .order('created_at', { ascending: false }),
      supabase
        .from('notes')
        .select('*, creator:profiles!notes_created_by_fkey(*)')
        .eq('related_to_type', relatedToType)
        .eq('related_to_id', relatedToId)
        .order('created_at', { ascending: false }),
      supabase
        .from('audit_log')
        .select('*, user:profiles!audit_log_user_id_fkey(*)')
        .eq('entity_type', relatedToType)
        .eq('entity_id', relatedToId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (activitiesRes.data) setActivities(activitiesRes.data);
    if (notesRes.data) setNotes(notesRes.data);

    // Cleanup old stage changes and keep only 7 most recent
    if (auditRes.data) {
      await cleanupOldStageChanges(auditRes.data);
      const stageChanges = auditRes.data.filter((log) => log.action === 'STAGE_CHANGE');
      const otherLogs = auditRes.data.filter((log) => log.action !== 'STAGE_CHANGE');
      const recentStageChanges = stageChanges.slice(0, 7);
      setAuditLogs([...recentStageChanges, ...otherLogs]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchTimeline();
  }, [relatedToType, relatedToId]);

  const searchParams = useSearchParams();
  const taskId = searchParams.get('taskId');

  useEffect(() => {
    if (taskId && activities.length > 0) {
      const task = activities.find((a) => a.id === taskId);
      if (task) {
        handleEditActivity(task);
      }
    }
  }, [taskId, activities]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('notes').insert({
      content: newNote,
      related_to_type: relatedToType,
      related_to_id: relatedToId,
      created_by: user.id,
    });

    setNewNote('');
    fetchTimeline();
  };

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
    setEditFormData({
      subject: activity.subject || '',
      description: activity.description || '',
      status: activity.status || 'NOT_STARTED',
      priority: activity.priority || 'MEDIUM',
      due_date: activity.due_date ? new Date(activity.due_date).toISOString().slice(0, 16) : '',
      start_time: activity.start_time ? new Date(activity.start_time).toISOString().slice(0, 16) : '',
      end_time: activity.end_time ? new Date(activity.end_time).toISOString().slice(0, 16) : '',
      location: activity.location || '',
    });
    setShowEditDialog(true);
  };

  const handleUpdateActivity = async () => {
    if (!editingActivity) return;

    const activityType = editingActivity.type;
    const updateData: any = {
      subject: editFormData.subject,
      description: editFormData.description,
    };

    if (activityType === 'TASK' || activityType === 'CALL' || activityType === 'EMAIL' || activityType === 'NOTE' || activityType === 'MEETING') {
      updateData.status = editFormData.status;
      updateData.priority = editFormData.priority;
      updateData.due_date = editFormData.due_date || null;
      updateData.completed = editFormData.status === 'COMPLETED';
    }

    if (activityType === 'EVENT' || activityType === 'MEETING') {
      updateData.start_time = editFormData.start_time || null;
      updateData.end_time = editFormData.end_time || null;
      updateData.location = editFormData.location || null;
    }

    const { error } = await supabase
      .from('activities')
      .update(updateData)
      .eq('id', editingActivity.id);

    if (!error) {
      toast({
        title: t('message.activity_updated'),
        description: t('message.activity_updated_desc'),
      });
      setShowEditDialog(false);
      setEditingActivity(null);
      fetchTimeline();
    } else {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
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
      fetchTimeline();
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm(t('message.delete_confirm_note'))) return;

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId);

    if (!error) {
      toast({
        title: t('message.note_deleted'),
        description: t('message.note_deleted_desc'),
      });
      fetchTimeline();
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
      fetchTimeline();
    }
  };

  const combinedTimeline = [
    ...activities.map((a) => ({ ...a, itemType: 'activity' })),
    ...notes.map((n) => ({ ...n, itemType: 'note' })),
    ...auditLogs.map((l) => ({ ...l, itemType: 'audit' })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (loading) {
    return <div className="text-center py-4">{t('activities.timeline_loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <Textarea
            placeholder={t('activities.note_placeholder')}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="mb-2"
          />
          <Button onClick={handleAddNote} size="sm">
            {t('activities.add_note')}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {combinedTimeline.map((item: any, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {item.itemType === 'activity' && item.type === 'TASK' && (
                    <CheckSquare className="h-5 w-5 text-blue-600" />
                  )}
                  {item.itemType === 'activity' && item.type === 'EVENT' && (
                    <Calendar className="h-5 w-5 text-green-600" />
                  )}
                  {item.itemType === 'note' && (
                    <FileText className="h-5 w-5 text-purple-600" />
                  )}
                  {item.itemType === 'audit' && (
                    <History className="h-5 w-5 text-gray-600" />
                  )}
                </div>
                <div className="flex-1">
                  {item.itemType === 'activity' && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{item.subject}</span>
                          <Badge variant="outline">{t(`status.${item.status?.toLowerCase()}`)}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {!item.completed && (item.type === 'TASK' || item.type === 'CALL' || item.type === 'EMAIL') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMarkComplete(item.id)}
                              title={t('activities.mark_complete_tip')}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditActivity(item)}
                            title={t('common.edit')}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteActivity(item.id)}
                            title={t('common.delete')}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                      {item.description && (
                        <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                      )}
                      {item.due_date && (
                        <p className="text-xs text-gray-600 mt-1">
                          {t('activities.table.due_date')}: {format(new Date(item.due_date), 'MMM d, yyyy h:mm a')}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {item.owner?.full_name} • {format(new Date(item.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </>
                  )}
                  {item.itemType === 'note' && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {item.title && <p className="font-medium">{item.title}</p>}
                          <p className="text-sm text-gray-700">{item.content}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteNote(item.id)}
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {item.creator?.full_name} • {format(new Date(item.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </>
                  )}
                  {item.itemType === 'audit' && (
                    <>
                      <p className="text-sm">
                        <span className="font-medium">
                          {t(`audit.action.${item.action?.toLowerCase()}`) || item.action}
                        </span>
                        {item.field_name && ` - ${item.field_name}`}
                      </p>
                      {item.old_value && item.new_value && (
                        <p className="text-xs text-gray-600">
                          {t('activities.changed_from_to').replace('{old}', item.old_value).replace('{new}', item.new_value)}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {item.user?.full_name} • {format(new Date(item.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {combinedTimeline.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          {t('activities.no_activity_yet')}
        </div>
      )}

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('activities.edit_activity')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('activities.table.subject')}</Label>
              <Input
                value={editFormData.subject}
                onChange={(e) => setEditFormData({ ...editFormData, subject: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('common.description')}</Label>
              <Textarea
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                rows={3}
              />
            </div>

            {editingActivity && (editingActivity.type === 'TASK' || editingActivity.type === 'CALL' || editingActivity.type === 'EMAIL' || editingActivity.type === 'NOTE') && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('common.status')}</Label>
                    <Select
                      value={editFormData.status}
                      onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NOT_STARTED">{t('status.not_started')}</SelectItem>
                        <SelectItem value="IN_PROGRESS">{t('status.in_progress')}</SelectItem>
                        <SelectItem value="COMPLETED">{t('status.completed')}</SelectItem>
                        <SelectItem value="CANCELLED">{t('status.cancelled')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('common.priority')}</Label>
                    <Select
                      value={editFormData.priority}
                      onValueChange={(value) => setEditFormData({ ...editFormData, priority: value })}
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
                    value={editFormData.due_date}
                    onChange={(e) => setEditFormData({ ...editFormData, due_date: e.target.value })}
                  />
                </div>
              </>
            )}

            {editingActivity && (editingActivity.type === 'EVENT' || editingActivity.type === 'MEETING') && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('activities.table.start_time')}</Label>
                    <Input
                      type="datetime-local"
                      value={editFormData.start_time}
                      onChange={(e) => setEditFormData({ ...editFormData, start_time: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('activities.table.end_time')}</Label>
                    <Input
                      type="datetime-local"
                      value={editFormData.end_time}
                      onChange={(e) => setEditFormData({ ...editFormData, end_time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('activities.location')}</Label>
                  <Input
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                    placeholder={t('activities.location_placeholder')}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button onClick={handleUpdateActivity}>
                {t('activities.edit_activity')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
