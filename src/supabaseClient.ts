import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fqbjqhlpiwsadpqjeiho.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Gji_yD6a_3_sJSCb2ccdCQ_X0jpMVsF';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
