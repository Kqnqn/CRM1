import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { googleCalendar } from '@/lib/google-calendar';
import { addMonths, addYears, parseISO, addHours } from 'date-fns';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
    try {
        const { action, serviceId, data, userId } = await req.json(); // Data depends on action

        // Auth check: In a real app, verify the session/token here.
        // For now, we trust the 'userId' passed from client (validated by RLS effectively if we used client, 
        // but here we use service role so we MUST validate auth if we were strict).
        // Let's assume the client passes the session token and we validate it.
        const token = req.headers.get('Authorization')?.replace('Bearer ', '');
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: { user }, error: authError } = await createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        }).auth.getUser();

        if (authError || !user || user.id !== userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch current service details
        const { data: service } = await supabase
            .from('service_contracts')
            .select('*, account:accounts(name)')
            .eq('id', serviceId)
            .single();

        if (!service) {
            return NextResponse.json({ error: 'Service not found' }, { status: 404 });
        }

        let googleEventId = service.google_event_id;

        if (action === 'RESCHEDULE') {
            const { newDate, reason } = data;

            // 1. Update DB
            const { error: dbError } = await supabase
                .from('service_contracts')
                .update({ next_service_due_at: newDate })
                .eq('id', serviceId);

            if (dbError) throw dbError;

            // 2. Audit Log
            await supabase.from('audit_log').insert({
                entity_type: 'SERVICE',
                entity_id: serviceId,
                action: 'RESCHEDULE',
                field_name: 'Next Due Date',
                old_value: service.next_service_due_at,
                new_value: newDate,
                user_id: userId
            });

            // 3. Sync with Google Calendar
            if (googleEventId) {
                // Update existing event
                await googleCalendar.updateEvent(userId, googleEventId, {
                    startTime: newDate,
                    endTime: addHours(parseISO(newDate), 1).toISOString(), // Assume 1 hour duration
                });
            } else {
                // Create new event if missing?
                const newEvent = await googleCalendar.createEvent(userId, {
                    summary: `Service Due: ${service.device_type}`,
                    description: `Rescheduled to ${newDate}. Reason: ${reason}`,
                    location: service.location_address,
                    startTime: newDate,
                    endTime: addHours(parseISO(newDate), 1).toISOString(),
                });
                if (newEvent) {
                    await supabase.from('service_contracts').update({ google_event_id: newEvent.id }).eq('id', serviceId);
                }
            }

        } else if (action === 'COMPLETE') {
            const { performedAt, note, priceCharged, nextDueAt } = data;
            console.log('Completing service:', { serviceId, userId, performedAt, nextDueAt });

            // 1. Insert Log
            console.log('Inserting service log...');
            const { error: logError } = await supabase.from('service_logs').insert({
                service_id: serviceId,
                performed_at: performedAt,
                performed_by_id: userId,
                note: note,
                price_charged: priceCharged
            });
            if (logError) {
                console.error('Error inserting log:', logError);
                throw logError;
            }

            // 2. Update Contract
            console.log('Updating service contract...');
            const { error: updateError } = await supabase
                .from('service_contracts')
                .update({
                    last_service_at: performedAt,
                    next_service_due_at: nextDueAt,
                    google_event_id: null // Clear old event ID as we will create new one for next due
                })
                .eq('id', serviceId);
            if (updateError) {
                console.error('Error updating contract:', updateError);
                throw updateError;
            }

            // 3. Audit Log
            console.log('Inserting audit log...');
            await supabase.from('audit_log').insert({
                entity_type: 'SERVICE',
                entity_id: serviceId,
                action: 'SERVICE_COMPLETED',
                user_id: userId
            });

            // 4. Cleanup old logs (keep only most recent 5)
            console.log('Cleaning up old logs...');
            const { data: oldLogs } = await supabase
                .from('service_logs')
                .select('id')
                .eq('service_id', serviceId)
                .order('performed_at', { ascending: false });

            if (oldLogs && oldLogs.length > 5) {
                const logsToDelete = oldLogs.slice(5).map(log => log.id);
                console.log(`Deleting ${logsToDelete.length} old logs...`);
                await supabase
                    .from('service_logs')
                    .delete()
                    .in('id', logsToDelete);
            }

            // 5. Sync Google Calendar
            console.log('Syncing with Google Calendar...');
            try {
                const newEvent = await googleCalendar.createEvent(userId, {
                    summary: `Service Due: ${service.device_type}`,
                    description: `Scheduled Service.`,
                    location: service.location_address,
                    startTime: nextDueAt,
                    endTime: addHours(parseISO(nextDueAt), 1).toISOString(),
                });

                if (newEvent) {
                    console.log('New calendar event created:', newEvent.id);
                    await supabase.from('service_contracts').update({ google_event_id: newEvent.id }).eq('id', serviceId);
                } else {
                    console.log('No calendar event created (maybe not connected?)');
                }
            } catch (calError) {
                console.error('Non-blocking Calendar Sync error:', calError);
                // We don't throw here to avoid failing the whole operation if calendar fails
            }
        }

        console.log('Service update successful');
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Service Update Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
