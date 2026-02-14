'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Shield, History, Loader2 } from 'lucide-react';

export default function AuditPage() {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState('login-history');
    const [loginHistory, setLoginHistory] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (activeTab === 'login-history') {
            fetchLoginHistory();
        } else {
            fetchAuditLogs();
        }
    }, [activeTab]);

    const fetchLoginHistory = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('login_history')
            .select('*, user:profiles(full_name, email)')
            .order('created_at', { ascending: false })
            .limit(50);

        if (data) setLoginHistory(data);
        setLoading(false);
    };

    const fetchAuditLogs = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('audit_log')
            .select('*, user:profiles(full_name)')
            .order('created_at', { ascending: false })
            .limit(50);

        if (data) setAuditLogs(data);
        setLoading(false);
    };

    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'MANAGER')) {
        return <div className="p-8">Access Denied</div>;
    }

    return (
        <div className="page-container">
            <div className="flex items-center gap-3 mb-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                    <Shield className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
                    <p className="text-sm text-muted-foreground">Monitor system access and changes</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="login-history" className="gap-2">
                        <History className="h-4 w-4" />
                        Login History
                    </TabsTrigger>
                    <TabsTrigger value="audit-logs" className="gap-2">
                        <Shield className="h-4 w-4" />
                        Action Logs
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="login-history">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Logins</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>User</TableHead>
                                            <TableHead>Time</TableHead>
                                            <TableHead>IP Address</TableHead>
                                            <TableHead>User Agent</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loginHistory.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell>
                                                    <div className="font-medium">{log.user?.full_name || 'Unknown'}</div>
                                                    <div className="text-xs text-muted-foreground">{log.user?.email}</div>
                                                </TableCell>
                                                <TableCell>{format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}</TableCell>
                                                <TableCell>{log.ip_address || '-'}</TableCell>
                                                <TableCell className="max-w-xs truncate" title={log.user_agent}>
                                                    {log.user_agent}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={log.status === 'SUCCESS' ? 'outline' : 'destructive'}>
                                                        {log.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="audit-logs">
                    <Card>
                        <CardHeader>
                            <CardTitle>System Actions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>User</TableHead>
                                            <TableHead>Action</TableHead>
                                            <TableHead>Entity</TableHead>
                                            <TableHead>Details</TableHead>
                                            <TableHead>Time</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {auditLogs.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell>{log.user?.full_name}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">{log.action}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-medium">{log.entity_type}</span>
                                                    <span className="text-xs text-muted-foreground ml-2">ID: {log.entity_id.slice(0, 8)}...</span>
                                                </TableCell>
                                                <TableCell>
                                                    {log.field_name ? (
                                                        <div className="text-sm">
                                                            Changed <span className="font-semibold">{log.field_name}</span> from{' '}
                                                            <span className="line-through text-red-400">{log.old_value || '(prazno)'}</span> to{' '}
                                                            <span className="text-green-600">{log.new_value}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{format(new Date(log.created_at), 'MMM d, HH:mm')}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
