const { createClient } = require('@supabase/supabase-js');

// ─── SUPABASE CONFIG ───
const supabaseUrl = 'https://eachhwhxuylstxdltcsd.supabase.co';
const supabaseAnonKey = 'sb_publishable_zo27TKkdwAqmQjjSeY5j3g_ivpQVFVY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = supabase;