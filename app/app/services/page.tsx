'use client';

import { useEffect, useState } from 'react';
import { supabase, ServiceContract, Account, Profile } from '@/lib/supabase/client';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Plus, Wrench, Edit, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { format, addMonths, addYears, parseISO, isPast, differenceInDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/language-context';
import { cn } from '@/lib/utils';

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceContract[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingService, setEditingService] = useState<ServiceContract | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [formData, setFormData] = useState({
    account_id: '',
    device_type: '',
    device_serial: '',
    location_address: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    last_service_at: '',
    interval_value: 12,
    interval_unit: 'MONTHS' as 'MONTHS' | 'YEARS',
    service_price: '',
    currency: 'BAM',
    assigned_to_id: '',
    status: 'ACTIVE' as 'ACTIVE' | 'PAUSED' | 'CLOSED',
    notes: '',
  });

  const fetchServices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('service_contracts')
      .select('*, account:accounts(*), assigned_to:profiles!service_contracts_assigned_to_id_fkey(*)')
      .order('next_service_due_at', { ascending: true });

    if (data) setServices(data);
    setLoading(false);
  };

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('id, name')
      .order('name');
    if (data) setAccounts(data);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name');
    if (data) setUsers(data);
  };

  useEffect(() => {
    if (user) {
      fetchServices();
      fetchAccounts();
      fetchUsers();
    }
  }, [user]);

  const calculateNextServiceDate = (lastServiceAt: string, intervalValue: number, intervalUnit: 'MONTHS' | 'YEARS') => {
    const lastDate = parseISO(lastServiceAt);
    if (intervalUnit === 'MONTHS') {
      return addMonths(lastDate, intervalValue);
    } else {
      return addYears(lastDate, intervalValue);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextServiceDueAt = calculateNextServiceDate(
      formData.last_service_at,
      formData.interval_value,
      formData.interval_unit
    );

    const serviceData: any = {
      account_id: formData.account_id,
      device_type: formData.device_type,
      device_serial: formData.device_serial || null,
      location_address: formData.location_address,
      contact_name: formData.contact_name,
      contact_phone: formData.contact_phone || null,
      contact_email: formData.contact_email || null,
      last_service_at: formData.last_service_at,
      interval_value: formData.interval_value,
      interval_unit: formData.interval_unit,
      next_service_due_at: nextServiceDueAt.toISOString(),
      service_price: formData.service_price ? parseFloat(formData.service_price) : null,
      currency: formData.currency,
      assigned_to_id: formData.assigned_to_id || null,
      status: formData.status,
      notes: formData.notes || null,
    };

    if (editingService) {
      const { error } = await supabase
        .from('service_contracts')
        .update(serviceData)
        .eq('id', editingService.id);

      if (!error) {
        toast({
          title: t('services.success_updated'),
          description: t('services.success_updated'),
        });
      }
    } else {
      const { error } = await supabase.from('service_contracts').insert(serviceData);

      if (!error) {
        toast({
          title: t('services.success_created'),
          description: t('services.success_created'),
        });
      }
    }

    setShowDialog(false);
    setEditingService(null);
    resetForm();
    fetchServices();
  };

  const handleEdit = (service: ServiceContract) => {
    setEditingService(service);
    setFormData({
      account_id: service.account_id,
      device_type: service.device_type,
      device_serial: service.device_serial || '',
      location_address: service.location_address,
      contact_name: service.contact_name,
      contact_phone: service.contact_phone || '',
      contact_email: service.contact_email || '',
      last_service_at: service.last_service_at ? new Date(service.last_service_at).toISOString().slice(0, 16) : '',
      interval_value: service.interval_value,
      interval_unit: service.interval_unit,
      service_price: service.service_price?.toString() || '',
      currency: service.currency,
      assigned_to_id: service.assigned_to_id || '',
      status: service.status,
      notes: service.notes || '',
    });
    setShowDialog(true);
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm(t('services.delete_confirm'))) return;

    const { error } = await supabase
      .from('service_contracts')
      .delete()
      .eq('id', serviceId);

    if (!error) {
      toast({
        title: t('services.success_deleted'),
        description: t('services.success_deleted'),
      });
      fetchServices();
    }
  };

  const resetForm = () => {
    setFormData({
      account_id: '',
      device_type: '',
      device_serial: '',
      location_address: '',
      contact_name: '',
      contact_phone: '',
      contact_email: '',
      last_service_at: '',
      interval_value: 12,
      interval_unit: 'MONTHS',
      service_price: '',
      currency: 'BAM',
      assigned_to_id: '',
      status: 'ACTIVE',
      notes: '',
    });
  };

  const handleDialogClose = (open: boolean) => {
    setShowDialog(open);
    if (!open) {
      setEditingService(null);
      resetForm();
    }
  };

  const getServiceStatus = (service: ServiceContract) => {
    if (service.status !== 'ACTIVE') return service.status.toLowerCase();
    const dueDate = parseISO(service.next_service_due_at);
    const now = new Date();
    const daysUntilDue = differenceInDays(dueDate, now);

    if (isPast(dueDate)) return 'overdue';
    if (daysUntilDue <= 7) return 'due-soon';
    return 'active';
  };

  const getStatusBadge = (service: ServiceContract) => {
    const status = getServiceStatus(service);
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

  const activeServices = services.filter(s => s.status === 'ACTIVE');
  const dueSoonServices = activeServices.filter(s => {
    const daysUntilDue = differenceInDays(parseISO(s.next_service_due_at), new Date());
    return daysUntilDue <= 7 && daysUntilDue >= 0;
  });
  const overdueServices = activeServices.filter(s => isPast(parseISO(s.next_service_due_at)));
  const myServices = services.filter(s => s.assigned_to_id === user?.id);

  if (loading) {
    return <div className="p-6">{t('dashboard.loading')}</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('services.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle.manage_services') || 'Upravljajte vašim ugovorima o servisu'}</p>
        </div>
        <Dialog open={showDialog} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('services.new_service')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingService ? t('services.edit_service') : t('services.create_service')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('common.company')}</Label>
                <Select
                  value={formData.account_id}
                  onValueChange={(value) => setFormData({ ...formData, account_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.select_account')} />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('services.device_type')}</Label>
                  <Input
                    value={formData.device_type}
                    onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                    placeholder={t('services.device_type')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('services.device_serial')} ({t('common.optional')})</Label>
                  <Input
                    value={formData.device_serial}
                    onChange={(e) => setFormData({ ...formData, device_serial: e.target.value })}
                    placeholder={t('services.device_serial')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('services.location_address')}</Label>
                <Input
                  value={formData.location_address}
                  onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                  placeholder={t('services.location_address')}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('services.contact_name')}</Label>
                  <Input
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    placeholder={t('services.contact_name')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('services.contact_phone')}</Label>
                  <Input
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder={t('services.contact_phone')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('services.contact_email')}</Label>
                  <Input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    placeholder={t('services.contact_email')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('services.last_service_date')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.last_service_at && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {formData.last_service_at ? (
                          format(new Date(formData.last_service_at), "PPP")
                        ) : (
                          <span>{t('common.pick_date') || 'Pick a date'}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={formData.last_service_at ? new Date(formData.last_service_at) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            // Set to noon to avoid timezone issues
                            const adjustedDate = new Date(date);
                            adjustedDate.setHours(12, 0, 0, 0);
                            setFormData({ ...formData, last_service_at: adjustedDate.toISOString() });
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>{t('services.interval_value')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.interval_value}
                    onChange={(e) => setFormData({ ...formData, interval_value: parseInt(e.target.value) || 1 })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('services.interval_unit')}</Label>
                  <Select
                    value={formData.interval_unit}
                    onValueChange={(value: 'MONTHS' | 'YEARS') => setFormData({ ...formData, interval_unit: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHS">{t('services.months')}</SelectItem>
                      <SelectItem value="YEARS">{t('services.years')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('services.service_price')} ({t('common.optional')})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.service_price}
                    onChange={(e) => setFormData({ ...formData, service_price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('services.currency')}</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BAM">BAM</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('activities.table.assigned_to')}</Label>
                  <Select
                    value={formData.assigned_to_id}
                    onValueChange={(value) => setFormData({ ...formData, assigned_to_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.select_user')} />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('common.status')}</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'ACTIVE' | 'PAUSED' | 'CLOSED') => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">{t('services.active')}</SelectItem>
                      <SelectItem value="PAUSED">{t('services.paused')}</SelectItem>
                      <SelectItem value="CLOSED">{t('services.closed')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('services.notes')}</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder={t('services.notes')}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit">
                  {editingService ? t('services.update_service') : t('services.create_service')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            {t('common.all_statuses')} ({services.length})
          </TabsTrigger>
          <TabsTrigger value="due-soon">
            <AlertCircle className="h-4 w-4 mr-2" />
            {t('services.due_soon')} ({dueSoonServices.length})
          </TabsTrigger>
          <TabsTrigger value="overdue">
            <AlertCircle className="h-4 w-4 mr-2" />
            {t('services.overdue')} ({overdueServices.length})
          </TabsTrigger>
          <TabsTrigger value="my-services">
            {t('nav.services')} - {t('nav.profile')} ({myServices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <ServiceList services={services} onEdit={handleEdit} onDelete={handleDelete} getStatusBadge={getStatusBadge} />
        </TabsContent>

        <TabsContent value="due-soon" className="mt-6">
          <ServiceList services={dueSoonServices} onEdit={handleEdit} onDelete={handleDelete} getStatusBadge={getStatusBadge} />
        </TabsContent>

        <TabsContent value="overdue" className="mt-6">
          <ServiceList services={overdueServices} onEdit={handleEdit} onDelete={handleDelete} getStatusBadge={getStatusBadge} />
        </TabsContent>

        <TabsContent value="my-services" className="mt-6">
          <ServiceList services={myServices} onEdit={handleEdit} onDelete={handleDelete} getStatusBadge={getStatusBadge} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ServiceList({
  services,
  onEdit,
  onDelete,
  getStatusBadge,
}: {
  services: ServiceContract[];
  onEdit: (service: ServiceContract) => void;
  onDelete: (id: string) => void;
  getStatusBadge: (service: ServiceContract) => JSX.Element;
}) {
  const { t } = useLanguage();
  if (services.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          {t('services.no_services')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {services.map((service) => (
        <Card key={service.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <Link href={`/app/services/${service.id}`}>
                    <h3 className="font-medium text-foreground hover:text-blue-600 cursor-pointer">
                      {service.device_type}
                    </h3>
                  </Link>
                  {getStatusBadge(service)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {service.account?.name} - {service.location_address}
                </p>
                {service.device_serial && (
                  <p className="text-xs text-muted-foreground mt-1">{t('services.device_serial')}: {service.device_serial}</p>
                )}
                <div className="flex items-center space-x-4 mt-2 text-sm">
                  <span className="text-muted-foreground">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {t('services.table.next_service')}: {format(parseISO(service.next_service_due_at), 'MMM d, yyyy')}
                  </span>
                  <span className="text-muted-foreground">
                    {t('services.interval_unit')}: {service.interval_value} {service.interval_unit === 'MONTHS' ? t('services.months') : t('services.years')}
                  </span>
                  {service.assigned_to && (
                    <span className="text-muted-foreground">
                      {t('activities.table.assigned_to')}: {service.assigned_to.full_name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Link href={`/app/services/${service.id}`}>
                  <Button size="sm" variant="ghost" title={t('common.details')}>
                    <Wrench className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(service)}
                  title={t('common.edit')}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(service.id)}
                  title={t('common.delete')}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
