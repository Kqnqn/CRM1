import { supabase } from '@/lib/supabase/client';

export interface AuditLogEntry {
    entity_type: string;
    entity_id: string;
    action: string;
    field_name?: string;
    old_value?: string;
    new_value?: string;
    user_id: string;
}

export const auditLogger = {
    log: async (entry: Omit<AuditLogEntry, 'user_id'>) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) return; // Should not happen if called from authenticated context

            const { error } = await supabase.from('audit_log').insert({
                ...entry,
                user_id: user.id
            });

            if (error) {
                console.error('Audit log error:', error);
            }
        } catch (e) {
            console.error('Audit log exception:', e);
        }
    },

    logChange: async (
        entityType: string,
        entityId: string,
        action: string,
        fieldName?: string,
        oldValue?: string,
        newValue?: string
    ) => {
        await auditLogger.log({
            entity_type: entityType,
            entity_id: entityId,
            action,
            field_name: fieldName,
            old_value: oldValue,
            new_value: newValue
        });
    }
};
