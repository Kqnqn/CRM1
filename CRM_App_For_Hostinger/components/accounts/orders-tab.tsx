'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Upload, Download, File, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/i18n/language-context';

interface Order {
  id: string;
  order_number: string;
  ordered_at: string;
  status: string;
  amount: number;
  paid_amount: number;
  currency: string;
  due_date: string;
  notes: string;
  created_at: string;
}

interface OrdersTabProps {
  accountId: string;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  PARTIALLY_PAID: 'bg-blue-100 text-blue-800',
  OVERDUE: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

export function OrdersTab({ accountId }: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [formData, setFormData] = useState({
    order_number: '',
    ordered_at: new Date().toISOString().split('T')[0],
    status: 'PENDING',
    amount: '',
    paid_amount: '0',
    currency: 'USD',
    due_date: '',
    notes: '',
  });
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, formatCurrency } = useLanguage();

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('account_id', accountId)
      .order('ordered_at', { ascending: false });

    if (data) {
      setOrders(data);

      const paid = data.reduce((sum, order) => sum + (Number(order.paid_amount) || 0), 0);
      const outstanding = data.reduce((sum, order) => {
        const amount = Number(order.amount) || 0;
        const paidAmount = Number(order.paid_amount) || 0;
        return sum + (amount - paidAmount);
      }, 0);

      setTotalPaid(paid);
      setTotalOutstanding(outstanding);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [accountId]);

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setFormData({
      order_number: order.order_number,
      ordered_at: order.ordered_at.split('T')[0],
      status: order.status,
      amount: order.amount.toString(),
      paid_amount: order.paid_amount.toString(),
      currency: order.currency,
      due_date: order.due_date ? order.due_date.split('T')[0] : '',
      notes: order.notes || '',
    });
    setShowEditDialog(true);
  };

  const handleUpdateOrder = async () => {
    if (!editingOrder || !formData.order_number || !formData.amount) {
      toast({
        title: t('orders.form.amount_required'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const paidAmount = parseFloat(formData.paid_amount);
      const totalAmount = parseFloat(formData.amount);

      let status = formData.status;
      if (paidAmount >= totalAmount) {
        status = 'PAID';
      } else if (paidAmount > 0 && paidAmount < totalAmount) {
        status = 'PARTIALLY_PAID';
      }

      const { error } = await supabase
        .from('orders')
        .update({
          order_number: formData.order_number,
          ordered_at: formData.ordered_at,
          status: status,
          amount: totalAmount,
          paid_amount: paidAmount,
          currency: formData.currency,
          due_date: formData.due_date || null,
          notes: formData.notes || null,
        })
        .eq('id', editingOrder.id);

      if (error) throw error;

      toast({
        title: t('orders.success_updated'),
      });

      setShowEditDialog(false);
      setEditingOrder(null);
      setFormData({
        order_number: '',
        ordered_at: new Date().toISOString().split('T')[0],
        status: 'PENDING',
        amount: '',
        paid_amount: '0',
        currency: 'USD',
        due_date: '',
        notes: '',
      });
      fetchOrders();
    } catch (error: any) {
      toast({
        title: t('orders.fail_updated'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCreateOrder = async () => {
    if (!formData.order_number || !formData.amount) {
      toast({
        title: t('orders.form.amount_required'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('orders').insert({
        account_id: accountId,
        order_number: formData.order_number,
        ordered_at: formData.ordered_at,
        status: formData.status,
        amount: parseFloat(formData.amount),
        paid_amount: parseFloat(formData.paid_amount),
        currency: formData.currency,
        due_date: formData.due_date || null,
        notes: formData.notes || null,
        created_by: user?.id,
      });

      if (error) throw error;

      toast({
        title: t('orders.success_created'),
      });

      setShowOrderDialog(false);
      setFormData({
        order_number: '',
        ordered_at: new Date().toISOString().split('T')[0],
        status: 'PENDING',
        amount: '',
        paid_amount: '0',
        currency: 'USD',
        due_date: '',
        notes: '',
      });
      fetchOrders();
    } catch (error: any) {
      toast({
        title: t('orders.fail_created'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const isOverdue = (order: Order) => {
    if (!order.due_date || order.status === 'PAID' || order.status === 'CANCELLED') {
      return false;
    }
    const amount = Number(order.amount) || 0;
    const paidAmount = Number(order.paid_amount) || 0;
    return new Date(order.due_date) < new Date() && amount > paidAmount;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-600">{t('orders.total_paid')}</div>
            <div className="text-3xl font-bold text-green-600 mt-2">
              {formatCurrency(totalPaid)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-600">{t('orders.total_outstanding')}</div>
            <div className="text-3xl font-bold text-red-600 mt-2">
              {formatCurrency(totalOutstanding)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">{t('orders.title')}</h3>
            <Button size="sm" onClick={() => setShowOrderDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('orders.new_order')}
            </Button>
          </div>

          {loading ? (
            <p className="text-center py-4 text-gray-500">{t('dashboard.loading')}</p>
          ) : orders.length === 0 ? (
            <p className="text-gray-500 text-center py-4">{t('orders.no_orders')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('orders.table.order_number')}</TableHead>
                  <TableHead>{t('orders.table.date')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('orders.table.amount')}</TableHead>
                  <TableHead>{t('orders.table.paid')}</TableHead>
                  <TableHead>{t('orders.table.outstanding')}</TableHead>
                  <TableHead>{t('orders.table.due_date')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const outstanding = Number(order.amount) - Number(order.paid_amount);
                  const overdue = isOverdue(order);

                  return (
                    <TableRow key={order.id} className={overdue ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{new Date(order.ordered_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[order.status] || statusColors.PENDING}>
                          {t(`status.${order.status.toLowerCase()}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(order.amount)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(order.paid_amount)}
                      </TableCell>
                      <TableCell className={outstanding > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                        {formatCurrency(outstanding)}
                      </TableCell>
                      <TableCell>
                        {order.due_date ? (
                          <span className={overdue ? 'text-red-600 font-semibold' : ''}>
                            {new Date(order.due_date).toLocaleDateString()}
                            {overdue && ` ${t('orders.overdue_tag')}`}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditOrder(order)}
                          title="Edit order"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('orders.edit_order')}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('orders.table.order_number')} *</Label>
              <Input
                value={formData.order_number}
                onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                placeholder="ORD-001"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('orders.table.date')} *</Label>
              <Input
                type="date"
                value={formData.ordered_at}
                onChange={(e) => setFormData({ ...formData, ordered_at: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('common.status')}</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">{t('status.pending')}</SelectItem>
                  <SelectItem value="PAID">{t('status.paid')}</SelectItem>
                  <SelectItem value="PARTIALLY_PAID">{t('status.partially_paid')}</SelectItem>
                  <SelectItem value="OVERDUE">{t('status.overdue')}</SelectItem>
                  <SelectItem value="CANCELLED">{t('status.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {t('orders.status_auto_update')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('services.currency')}</Label>
              <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="JPY">JPY</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('orders.table.amount')} *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('orders.table.paid')}</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.paid_amount}
                onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                placeholder="0.00"
              />
              {parseFloat(formData.amount) > 0 && parseFloat(formData.paid_amount) > 0 && (
                <p className="text-xs text-gray-500">
                  {((parseFloat(formData.paid_amount) / parseFloat(formData.amount)) * 100).toFixed(0)}% {t('orders.table.paid').toLowerCase()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('orders.table.due_date')}</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('services.notes') + '...'}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-4">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUpdateOrder}>{t('orders.update_order')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('orders.create_order')}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('orders.table.order_number')} *</Label>
              <Input
                value={formData.order_number}
                onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                placeholder="ORD-001"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('orders.table.date')} *</Label>
              <Input
                type="date"
                value={formData.ordered_at}
                onChange={(e) => setFormData({ ...formData, ordered_at: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('common.status')}</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">{t('status.pending')}</SelectItem>
                  <SelectItem value="PAID">{t('status.paid')}</SelectItem>
                  <SelectItem value="PARTIALLY_PAID">{t('status.partially_paid')}</SelectItem>
                  <SelectItem value="OVERDUE">{t('status.overdue')}</SelectItem>
                  <SelectItem value="CANCELLED">{t('status.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('services.currency')}</Label>
              <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="JPY">JPY</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('orders.table.amount')} *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('orders.table.paid')}</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.paid_amount}
                onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('orders.table.due_date')}</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>{t('services.notes')}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('services.notes') + '...'}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-4">
            <Button variant="outline" onClick={() => setShowOrderDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateOrder}>{t('orders.create_order')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

