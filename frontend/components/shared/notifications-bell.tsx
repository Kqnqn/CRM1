'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Bell, CheckCircle2, AlertCircle, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface Activity {
  id: string;
  subject: string;
  type: string;
  due_date: string;
  related_to_type: string;
  related_to_id: string;
}

interface ServiceDue {
  id: string;
  device_type: string;
  account_name: string;
  next_service_due_at: string;
}

export function NotificationsBell() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [upcomingTasks, setUpcomingTasks] = useState<Activity[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Activity[]>([]);
  const [servicesDueSoon, setServicesDueSoon] = useState<ServiceDue[]>([]);
  const [servicesOverdue, setServicesOverdue] = useState<ServiceDue[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [upcomingRes, overdueRes, servicesRes] = await Promise.all([
      supabase
        .from('activities')
        .select('*')
        .eq('assigned_to', user.id)
        .eq('completed', false)
        .gte('due_date', now.toISOString())
        .lte('due_date', tomorrow.toISOString())
        .order('due_date', { ascending: true }),
      supabase
        .from('activities')
        .select('*')
        .eq('assigned_to', user.id)
        .eq('completed', false)
        .lt('due_date', now.toISOString())
        .order('due_date', { ascending: true }),
      supabase
        .from('service_contracts')
        .select('id, device_type, next_service_due_at, account:accounts(name)')
        .eq('status', 'ACTIVE')
        .or(`assigned_to_id.eq.${user.id}`)
        .lte('next_service_due_at', sevenDaysFromNow.toISOString())
        .order('next_service_due_at', { ascending: true }),
    ]);

    if (upcomingRes.data) setUpcomingTasks(upcomingRes.data);
    if (overdueRes.data) setOverdueTasks(overdueRes.data);

    if (servicesRes.data) {
      const dueSoon: ServiceDue[] = [];
      const overdue: ServiceDue[] = [];

      servicesRes.data.forEach((service: any) => {
        const dueDate = new Date(service.next_service_due_at);
        const serviceDue: ServiceDue = {
          id: service.id,
          device_type: service.device_type,
          account_name: service.account?.name || 'Unknown',
          next_service_due_at: service.next_service_due_at,
        };

        if (dueDate < now) {
          overdue.push(serviceDue);
        } else {
          dueSoon.push(serviceDue);
        }
      });

      setServicesDueSoon(dueSoon);
      setServicesOverdue(overdue);
    }

    const total =
      (upcomingRes.data?.length || 0) +
      (overdueRes.data?.length || 0) +
      (servicesOverdue.length || 0) +
      (servicesDueSoon.length || 0);
    setUnreadCount(total);
  };

  useEffect(() => {
    fetchNotifications();

    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (overdueTasks.length > 0 && unreadCount > 0) {
      toast({
        title: 'Overdue tasks',
        description: `You have ${overdueTasks.length} overdue task${overdueTasks.length !== 1 ? 's' : ''}`,
        variant: 'destructive',
      });
    }
  }, [overdueTasks.length]);

  const handleTaskClick = (task: Activity) => {
    setOpen(false);
    if (task.related_to_type && task.related_to_id) {
      const type = task.related_to_type.toLowerCase();
      router.push(`/app/${type}s/${task.related_to_id}?tab=activity`);
    }
  };

  const handleServiceClick = (service: ServiceDue) => {
    setOpen(false);
    router.push(`/app/services/${service.id}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <p className="text-sm text-gray-600 mt-1">
            Upcoming and overdue tasks and services
          </p>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {overdueTasks.length > 0 && (
            <div className="p-4 border-b bg-red-50">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <h4 className="font-medium text-red-900">Overdue Tasks</h4>
              </div>
              <div className="space-y-2">
                {overdueTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-2 bg-white border border-red-200 rounded cursor-pointer hover:bg-red-50"
                    onClick={() => handleTaskClick(task)}
                  >
                    <p className="text-sm font-medium text-red-900">{task.subject}</p>
                    <p className="text-xs text-red-600 mt-1">
                      {task.type} • Overdue since {new Date(task.due_date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {servicesOverdue.length > 0 && (
            <div className="p-4 border-b bg-red-50">
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="h-4 w-4 text-red-600" />
                <h4 className="font-medium text-red-900">Overdue Services</h4>
              </div>
              <div className="space-y-2">
                {servicesOverdue.map((service) => (
                  <div
                    key={service.id}
                    className="p-2 bg-white border border-red-200 rounded cursor-pointer hover:bg-red-50"
                    onClick={() => handleServiceClick(service)}
                  >
                    <p className="text-sm font-medium text-red-900">{service.device_type}</p>
                    <p className="text-xs text-red-600 mt-1">
                      {service.account_name} • Due {new Date(service.next_service_due_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {servicesDueSoon.length > 0 && (
            <div className="p-4 border-b bg-orange-50">
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="h-4 w-4 text-orange-600" />
                <h4 className="font-medium text-orange-900">Services Due Soon</h4>
              </div>
              <div className="space-y-2">
                {servicesDueSoon.map((service) => (
                  <div
                    key={service.id}
                    className="p-2 bg-white border border-orange-200 rounded cursor-pointer hover:bg-orange-50"
                    onClick={() => handleServiceClick(service)}
                  >
                    <p className="text-sm font-medium text-orange-900">{service.device_type}</p>
                    <p className="text-xs text-orange-600 mt-1">
                      {service.account_name} • Due {new Date(service.next_service_due_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcomingTasks.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <h4 className="font-medium text-gray-900">Upcoming Tasks (Next 24 Hours)</h4>
              </div>
              <div className="space-y-2">
                {upcomingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-50"
                    onClick={() => handleTaskClick(task)}
                  >
                    <p className="text-sm font-medium">{task.subject}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {task.type} • Due {new Date(task.due_date).toLocaleDateString()} at {new Date(task.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcomingTasks.length === 0 &&
            overdueTasks.length === 0 &&
            servicesDueSoon.length === 0 &&
            servicesOverdue.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No notifications</p>
                <p className="text-xs mt-1">You're all caught up!</p>
              </div>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
