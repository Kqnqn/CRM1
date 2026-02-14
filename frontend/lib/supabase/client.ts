import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'ADMIN' | 'MANAGER' | 'SALES_REP' | 'READ_ONLY';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  password_change_required?: boolean;
  created_at: string;
  updated_at: string;
  google_calendar_connected?: boolean;
  google_access_token?: string;
  google_refresh_token?: string;
  google_token_expiry?: string;
  default_currency?: string;
}

export interface Lead {
  id: string;
  company_name: string;
  contact_person_name: string;
  email: string;
  phone?: string;
  source?: string;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'ARCHIVED';
  owner_id: string;
  converted_account_id?: string;
  converted_at?: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  contact_id?: string;
  owner?: Profile;
}

export interface Account {
  id: string;
  name: string;
  industry?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
  website?: string;
  stage: 'OPEN' | 'CLOSED_WON' | 'CLOSED_LOST';
  closed_at?: string;
  lost_reason?: string;
  default_currency?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  owner?: Profile;
}

export interface Contact {
  id: string;
  account_id?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  title?: string;
  department?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  account?: Account;
  owner?: Profile;
}

export interface Opportunity {
  id: string;
  account_id: string;
  contact_id?: string;
  name: string;
  stage: 'PROSPECTING' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';
  amount: number;
  close_date?: string;
  probability: number;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  account?: Account;
  contact?: Contact;
  owner?: Profile;
}

export interface Activity {
  id: string;
  type: 'TASK' | 'EVENT' | 'CALL' | 'MEETING' | 'EMAIL' | 'NOTE';
  subject: string;
  description?: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  due_date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  related_to_type?: string;
  related_to_id?: string;
  owner_id: string;
  assigned_to?: string;
  sync_to_calendar?: boolean;
  completed?: boolean;
  google_calendar_event_id?: string;
  created_at: string;
  updated_at: string;
  owner?: Profile;
  assignee?: Profile;
}

export interface Document {
  id: string;
  title: string;
  file_name: string;
  file_size: number;
  mime_type?: string;
  storage_key: string;
  uploaded_by: string;
  document_type?: string;
  created_at: string;
  uploader?: Profile;
}

export interface DocumentLink {
  id: string;
  document_id: string;
  linked_to_type: string;
  linked_to_id: string;
  linked_by: string;
  created_at: string;
  document?: Document;
}

export interface Note {
  id: string;
  title?: string;
  content: string;
  related_to_type: string;
  related_to_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: Profile;
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  user_id?: string;
  created_at: string;
  user?: Profile;
}

export type ServiceIntervalUnit = 'MONTHS' | 'YEARS';
export type ServiceStatus = 'ACTIVE' | 'PAUSED' | 'CLOSED';

export interface ServiceContract {
  id: string;
  account_id?: string;
  device_type: string;
  device_serial?: string;
  location_address: string;
  contact_name: string;
  contact_phone?: string;
  contact_email?: string;
  last_service_at: string;
  interval_value: number;
  interval_unit: ServiceIntervalUnit;
  next_service_due_at: string;
  service_price?: number;
  currency: string;
  assigned_to_id?: string;
  status: ServiceStatus;
  notes?: string;
  google_event_id?: string;
  created_at: string;
  updated_at: string;
  account?: Account;
  assigned_to?: Profile;
}

export interface ServiceLog {
  id: string;
  service_id: string;
  performed_at: string;
  performed_by_id?: string;
  note?: string;
  price_charged?: number;
  created_at: string;
  service?: ServiceContract;
  performed_by?: Profile;
}
