'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, ServiceContract, ServiceLog, Profile } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { RecordTabs } from '@/components/shared/record-tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar, MapPin, User, DollarSign, Check, FileText, Clock } from 'lucide-react';
import { format, parseISO, addMonths, addYears, isPast, differenceInDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/language-context';
import { EntityHistory } from '@/components/shared/entity-history';

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params.id as string;
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [service, setService] = useState<ServiceContract | null>(null);
  const [serviceLogs, setServiceLogs] = useState<ServiceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);

  const [completeFormData, setCompleteFormData] = useState({
    performed_at: new Date().toISOString().slice(0, 16),
    note: '',
    price_charged: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [rescheduleFormData, setRescheduleFormData] = useState({
    date: '',
    reason: '',
  });

  const fetchService = async () => {
    const { data } = await supabase
      .from('service_contracts')
      .select('*, account:accounts(*), assigned_to:profiles!service_contracts_assigned_to_id_fkey(*)')
      .eq('id', serviceId)
      .single();

    if (data) setService(data);
  };

  const fetchServiceLogs = async () => {
    const { data } = await supabase
      .from('service_logs')
      .select('*, performed_by:profiles!service_logs_performed_by_id_fkey(*)')
      .eq('service_id', serviceId)
      .order('performed_at', { ascending: false });

    if (data) setServiceLogs(data);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchService(), fetchServiceLogs()]);
      setLoading(false);
    };

    if (serviceId) {
      loadData();
    }
  }, [serviceId]);

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service || !user) return;

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const response = await fetch('/api/services/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'RESCHEDULE',
          serviceId,
          userId: user.id,
          data: {
            newDate: new Date(rescheduleFormData.date).toISOString(),
            reason: rescheduleFormData.reason
          }
        })
      });

      if (!response.ok) {
        throw new Error('Update failed');
      }

      toast({
        title: t('services.rescheduled') || 'Service Rescheduled',
        description: t('services.success_updated'),
      });
      setShowRescheduleDialog(false);
      setRescheduleFormData({ date: '', reason: '' });
      fetchService();
    } catch (error: any) {
      console.error(error);
      toast({
        title: t('common.error'),
        description: 'Failed to reschedule service',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service || !user) return;

    const performedAt = completeFormData.performed_at;
    const nextServiceDueAt = service.interval_unit === 'MONTHS'
      ? addMonths(parseISO(performedAt), service.interval_value)
      : addYears(parseISO(performedAt), service.interval_value);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/services/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'COMPLETE',
          serviceId,
          userId: user.id,
          data: {
            performedAt,
            note: completeFormData.note,
            priceCharged: completeFormData.price_charged ? parseFloat(completeFormData.price_charged) : null,
            nextDueAt: nextServiceDueAt.toISOString()
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Update failed');
      }

      toast({
        title: t('services.complete_service'),
        description: t('services.success_updated'),
      });
      setShowCompleteDialog(false);
      setCompleteFormData({
        performed_at: new Date().toISOString().slice(0, 16),
        note: '',
        price_charged: '',
      });
      fetchService();
      fetchServiceLogs();
    } catch (error: any) {
      console.error('Frontend Error completing service:', error);
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to complete service',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getServiceStatus = () => {
    if (!service) return 'active';
    if (service.status !== 'ACTIVE') return service.status.toLowerCase();
    const dueDate = parseISO(service.next_service_due_at);
    const now = new Date();
    const daysUntilDue = differenceInDays(dueDate, now);

    if (isPast(dueDate)) return 'overdue';
    if (daysUntilDue <= 7) return 'due-soon';
    return 'active';
  };

  const getStatusBadge = () => {
    const status = getServiceStatus();
    switch (status) {
      case 'overdue':
        return <Badge variant="destructive">{t('services.overdue')}</Badge>;
      case 'due-soon':
        return <Badge className="bg-orange-500 text-white">{t('services.due_soon')}</Badge>;
      case 'paused':
        return <Badge variant="secondary">{t('services.paused')}</Badge>;
      case 'closed':
        return <Badge variant="outline">{t('services.closed')}</Badge>;
      default:
        return <Badge className="bg-green-600 text-white">{t('services.active')}</Badge>;
    }
  };

  if (loading || !service) {
    return <div className="p-6">{t('dashboard.loading')}</div>;
  }

  const tabs = [
    {
      value: 'details',
      label: t('common.details'),
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t('services.info')}</span>
                <div className="flex gap-2">
                  {service.status === 'ACTIVE' && ['overdue', 'due-soon'].includes(getServiceStatus()) && (
                    <>
                      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
                        <DialogTrigger asChild>
                          <Button variant="outline">
                            <Clock className="h-4 w-4 mr-2" />
                            {t('services.reschedule') || 'Reschedule'}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t('services.reschedule') || 'Reschedule Service'}</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleReschedule} className="space-y-4">
                            <div className="space-y-2">
                              <Label>{t('services.new_date') || 'New Date'}</Label>
                              <Input
                                type="date"
                                value={rescheduleFormData.date}
                                onChange={(e) => setRescheduleFormData({ ...rescheduleFormData, date: e.target.value })}
                                required
                                min={new Date().toISOString().split('T')[0]}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t('services.reason') || 'Reason'}</Label>
                              <Textarea
                                value={rescheduleFormData.reason}
                                onChange={(e) => setRescheduleFormData({ ...rescheduleFormData, reason: e.target.value })}
                                placeholder={t('services.reschedule_reason_placeholder') || 'Reason for rescheduling...'}
                                required
                                rows={3}
                              />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                              <Button type="button" variant="outline" onClick={() => setShowRescheduleDialog(false)}>
                                {t('common.cancel')}
                              </Button>
                              <Button type="submit">{t('common.save')}</Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
                        <DialogTrigger asChild>
                          <Button>
                            <Check className="h-4 w-4 mr-2" />
                            {t('services.mark_done')}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t('services.complete_service')}</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleCompleteService} className="space-y-4">
                            <div className="space-y-2">
                              <Label>{t('services.log.performed_at')}</Label>
                              <Input
                                type="datetime-local"
                                value={completeFormData.performed_at}
                                onChange={(e) => setCompleteFormData({ ...completeFormData, performed_at: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t('services.notes')}</Label>
                              <Textarea
                                value={completeFormData.note}
                                onChange={(e) => setCompleteFormData({ ...completeFormData, note: e.target.value })}
                                placeholder={t('services.notes_required') || 'Enter service notes'}
                                rows={3}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t('services.log.price_charged')} ({t('common.optional')})</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={completeFormData.price_charged}
                                onChange={(e) => setCompleteFormData({ ...completeFormData, price_charged: e.target.value })}
                                placeholder="0.00"
                              />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                              <Button type="button" variant="outline" onClick={() => setShowCompleteDialog(false)} disabled={isSubmitting}>
                                {t('common.cancel')}
                              </Button>
                              <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? t('common.loading') : t('services.complete_service')}
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-gray-500">{t('common.status')}</Label>
                  <div className="mt-1">{getStatusBadge()}</div>
                </div>
                <div>
                  <Label className="text-gray-500">{t('services.device_type')}</Label>
                  <p className="font-medium mt-1">{service.device_type}</p>
                </div>
                {service.device_serial && (
                  <div>
                    <Label className="text-gray-500">{t('services.device_serial')}</Label>
                    <p className="font-medium mt-1">{service.device_serial}</p>
                  </div>
                )}
                <div>
                  <Label className="text-gray-500">{t('services.last_service_date')}</Label>
                  <p className="font-medium mt-1">
                    {format(parseISO(service.last_service_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">{t('services.table.next_service')}</Label>
                  <p className="font-medium mt-1">
                    {format(parseISO(service.next_service_due_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">{t('services.interval_unit')}</Label>
                  <p className="font-medium mt-1">
                    {service.interval_value} {service.interval_unit === 'MONTHS' ? t('services.months') : t('services.years')}
                  </p>
                </div>
                {service.service_price && (
                  <div>
                    <Label className="text-gray-500">{t('services.service_price')}</Label>
                    <p className="font-medium mt-1">
                      {service.service_price.toFixed(2)} {service.currency}
                    </p>
                  </div>
                )}
                {service.assigned_to && (
                  <div>
                    <Label className="text-gray-500">{t('activities.table.assigned_to')}</Label>
                    <p className="font-medium mt-1">{service.assigned_to.full_name}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('services.location_contact')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-500 flex items-center">
                  <MapPin className="h-4 w-4 mr-1" />
                  {t('services.location_address')}
                </Label>
                <p className="font-medium mt-1">{service.location_address}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-500 flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    {t('services.contact_name')}
                  </Label>
                  <p className="font-medium mt-1">{service.contact_name}</p>
                </div>
                {service.contact_phone && (
                  <div>
                    <Label className="text-gray-500">{t('services.contact_phone')}</Label>
                    <p className="font-medium mt-1">{service.contact_phone}</p>
                  </div>
                )}
                {service.contact_email && (
                  <div>
                    <Label className="text-gray-500">{t('services.contact_email')}</Label>
                    <p className="font-medium mt-1">{service.contact_email}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {
            service.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('services.notes')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap">{service.notes}</p>
                </CardContent>
              </Card>
            )
          }
        </div>
      ),
    },
    {
      value: 'history',
      label: t('services.history'),
      content: (
        <div className="space-y-4">
          {serviceLogs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                {t('services.history.empty')}
              </CardContent>
            </Card>
          ) : (
            serviceLogs.map((log) => (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">
                          {format(parseISO(log.performed_at), 'MMM d, yyyy h:mm a')}
                        </span>
                        {log.performed_by && (
                          <span className="text-sm text-gray-600">
                            by {log.performed_by.full_name}
                          </span>
                        )}
                      </div>
                      {log.note && (
                        <p className="text-gray-700 mt-2 ml-7">{log.note}</p>
                      )}
                      {log.price_charged && (
                        <div className="flex items-center mt-2 ml-7 text-sm text-gray-600">
                          <DollarSign className="h-3 w-3 mr-1" />
                          <span>{t('services.log.price_charged')}: {log.price_charged.toFixed(2)} {service.currency}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ),
    },
    {
      value: 'audit',
      label: 'Audit Log',
      content: <EntityHistory entityType="SERVICE" entityId={serviceId} />,
    },
    {
      value: 'documents',
      label: t('common.documents'),
      content: (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p>{t('services.documents.coming_soon')}</p>
          </CardContent>
        </Card>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link href="/app/services" className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block">
              ← {t('services.back_to_services')}
            </Link>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">{service.device_type}</h1>
              {getStatusBadge()}
            </div>
            <p className="text-gray-600 mt-1">{t('services.info')}</p>
          </div>
        </div>
      </div>
      <RecordTabs tabs={tabs} />
    </div>
  );
}
