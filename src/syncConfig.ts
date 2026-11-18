// Supabase project for syncing routines across devices (see supabase/schema.sql).
// The anon key is public by design: the table's row level security lets every user
// read and write only their own row. Empty = sync switched off (the UI hides it).
export const SUPABASE_URL = "https://bbnychbzkbswgsiacxst.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_uOrUoK-caR02sCf-KBm0Jg_Nvcj8q7U";
