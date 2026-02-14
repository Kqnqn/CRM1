import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface CalendarEvent {
    summary: string;
    description?: string;
    location?: string;
    startTime: string; // ISO string
    endTime: string;   // ISO string
    eventId?: string;
}

export const googleCalendar = {
    getAuthClient: async (userId: string) => {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get user tokens
        const { data: profile } = await supabase
            .from('profiles')
            .select('google_access_token, google_refresh_token, google_token_expiry')
            .eq('id', userId)
            .single();

        if (!profile || !profile.google_refresh_token) {
            return null;
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        oauth2Client.setCredentials({
            access_token: profile.google_access_token,
            refresh_token: profile.google_refresh_token,
            expiry_date: profile.google_token_expiry ? new Date(profile.google_token_expiry).getTime() : undefined,
        });

        // Check if we need to refresh (handled by library automatically if refresh_token is present?)
        // usage of oauth2Client should handle refresh if refresh_token is set.
        // However, we might want to listen to 'tokens' event to save new access token to DB.

        oauth2Client.on('tokens', async (tokens) => {
            if (tokens.access_token) {
                await supabase.from('profiles').update({
                    google_access_token: tokens.access_token,
                    google_token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : undefined,
                    // only update refresh_token if it's returned (it's not always returned on refresh)
                    ...(tokens.refresh_token ? { google_refresh_token: tokens.refresh_token } : {})
                }).eq('id', userId);
            }
        });

        return oauth2Client;
    },

    createEvent: async (userId: string, event: CalendarEvent) => {
        const auth = await googleCalendar.getAuthClient(userId);
        if (!auth) return null;

        const calendar = google.calendar({ version: 'v3', auth });

        try {
            const res = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: {
                    summary: event.summary,
                    description: event.description,
                    location: event.location,
                    start: { dateTime: event.startTime },
                    end: { dateTime: event.endTime },
                },
            });
            return res.data;
        } catch (error) {
            console.error('Error creating calendar event:', error);
            return null;
        }
    },

    updateEvent: async (userId: string, eventId: string, event: Partial<CalendarEvent>) => {
        const auth = await googleCalendar.getAuthClient(userId);
        if (!auth) return null;

        const calendar = google.calendar({ version: 'v3', auth });

        try {
            // First get the event to merge? Or assume patch?
            // patch is better.
            const res = await calendar.events.patch({
                calendarId: 'primary',
                eventId: eventId,
                requestBody: {
                    ...(event.summary && { summary: event.summary }),
                    ...(event.description && { description: event.description }),
                    ...(event.location && { location: event.location }),
                    ...(event.startTime && { start: { dateTime: event.startTime } }),
                    ...(event.endTime && { end: { dateTime: event.endTime } }),
                },
            });
            return res.data;
        } catch (error) {
            console.error('Error updating calendar event:', error);
            return null;
        }
    },

    deleteEvent: async (userId: string, eventId: string) => {
        const auth = await googleCalendar.getAuthClient(userId);
        if (!auth) return null;

        const calendar = google.calendar({ version: 'v3', auth });
        try {
            await calendar.events.delete({
                calendarId: 'primary',
                eventId: eventId
            });
            return true;
        } catch (error) {
            console.error('Error deleting calendar event:', error);
            return false;
        }
    }
};
