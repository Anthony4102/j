// Shared Atlas Supabase configuration.
// This must contain only your browser-safe publishable/anon key.
const ATLAS_SUPABASE_URL = 'https://wmedotwgqrsgrhjdzbbn.supabase.co';
const ATLAS_SUPABASE_KEY = 'sb_publishable_6NI-3Sg2gv0NSEm7mBddHw_kNi2sg-f';

let atlasSupabase = null;

function getAtlasSupabase() {
    if (atlasSupabase) return atlasSupabase;
    if (!window.supabase || !ATLAS_SUPABASE_URL || !ATLAS_SUPABASE_KEY) return null;
    atlasSupabase = window.supabase.createClient(ATLAS_SUPABASE_URL, ATLAS_SUPABASE_KEY);
    return atlasSupabase;
}
