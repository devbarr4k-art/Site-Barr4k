import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tnvlllanpuxvfudtqvwg.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudmxsbGFucHV4dmZ1ZHRxdndnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMTkzMzQsImV4cCI6MjEwNTU5NTMzNH0.xHA0-6zOZCeog-NCu-iqdVHLmVWOAoQVfhGRfhnlnRQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
