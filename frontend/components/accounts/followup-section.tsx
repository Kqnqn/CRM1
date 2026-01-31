'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/i18n/language-context';

interface FollowUpSectionProps {
  accountId: string;
  onCreated?: () => void;
}

export function FollowUpSection({ accountId, onCreated }: FollowUpSectionProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    type: 'CALL',
    subject: '',
    description: '',
    due_date: '',
    start_time: '',
    end_time: '',
    sync_to_calendar: false,
  });
  const [saving, setSaving] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleCreate = async () => {
    if (!formData.subject || !formData.due_date) {
      toast({
        title: t('common.error'),
        description: t('common.required_field'),
        variant: 'destructive',
      });
      return;
    }

    if (formData.sync_to_calendar && !profile?.google_calendar_connected) {
      toast({
        title: t('followup.calendar_not_connected'),
        description: t('followup.calendar_connect_first'),
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const startTime = formData.start_time
        ? new Date(`${formData.due_date}T${formData.start_time}`)
        : new Date(formData.due_date);

      const endTime = formData.end_time
        ? new Date(`${formData.due_date}T${formData.end_time}`)
        : new Date(startTime.getTime() + 60 * 60 * 1000);

      const { error } = await supabase.from('activities').insert({
        type: formData.type,
        subject: formData.subject,
        description: formData.description,
        due_date: startTime.toISOString(),
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        related_to_type: 'ACCOUNT',
        related_to_id: accountId,
        owner_id: user?.id,
        assigned_to: user?.id,
        sync_to_calendar: formData.sync_to_calendar,
        status: 'NOT_STARTED',
      });

      if (error) throw error;

      toast({
        title: t('followup.success_created'),
        description: t('message.activity_created_desc'),
      });

      setShowDialog(false);
      setFormData({
        type: 'CALL',
        subject: '',
        description: '',
        due_date: '',
        start_time: '',
        end_time: '',
        sync_to_calendar: false,
      });

      if (onCreated) onCreated();
    } catch (error: any) {
      toast({
        title: t('followup.fail_created'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">{t('followup.title')}</h3>
              <p className="text-sm text-gray-600 mt-1">{t('followup.subtitle')}</p>
            </div>
            <Button size="sm" onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('followup.schedule_button')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('followup.create_title')}</DialogTitle>
            <DialogDescription>
              {t('followup.create_desc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('common.type')}</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CALL">{t('activities.type.call')}</SelectItem>
                  <SelectItem value="MEETING">{t('activities.type.meeting')}</SelectItem>
                  <SelectItem value="EMAIL">{t('activities.type.email')}</SelectItem>
                  <SelectItem value="TASK">{t('activities.type.task')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('activities.table.subject')} *</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder={t('followup.subject_placeholder')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('common.description')}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('services.notes') + '...'}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('common.date')} *</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('followup.start_time')}</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('followup.end_time')}</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 p-4 bg-blue-50 rounded-lg">
              <Checkbox
                id="sync_calendar"
                checked={formData.sync_to_calendar}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, sync_to_calendar: checked as boolean })
                }
              />
              <div className="flex-1">
                <label
                  htmlFor="sync_calendar"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  <Calendar className="inline h-4 w-4 mr-1" />
                  {t('followup.sync_calendar')}
                </label>
                {!profile?.google_calendar_connected && (
                  <p className="text-xs text-gray-600 mt-1">
                    {t('followup.calendar_connect_first')}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? t('common.creating') : t('followup.schedule_button')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
