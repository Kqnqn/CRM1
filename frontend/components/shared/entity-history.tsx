'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { format } from 'date-fns';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface EntityHistoryProps {
    entityType: string;
    entityId: string;
}

export function EntityHistory({ entityType, entityId }: EntityHistoryProps) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            const { data } = await supabase
                .from('audit_log')
                .select('*, user:profiles(full_name)')
                .eq('entity_type', entityType)
                .eq('entity_id', entityId)
                .order('created_at', { ascending: false });

            if (data) {
                setLogs(data);
            }
            setLoading(false);
        };

        fetchLogs();
    }, [entityType, entityId]);

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    if (logs.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    No history available for this record.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Change History</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Field</TableHead>
                            <TableHead>Change</TableHead>
                            <TableHead>Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.map((log) => (
                            <TableRow key={log.id}>
                                <TableCell className="font-medium">{log.user?.full_name || 'Unknown'}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{log.action}</Badge>
                                </TableCell>
                                <TableCell>{log.field_name || '-'}</TableCell>
                                <TableCell>
                                    {log.field_name ? (
                                        <div className="text-sm">
                                            <span className="line-through text-red-400 mr-2">{log.old_value || '(empty)'}</span>
                                            <span className="text-muted-foreground">→</span>
                                            <span className="text-green-600 ml-2">{log.new_value}</span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
