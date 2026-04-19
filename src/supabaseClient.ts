import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://lbfplybfspcnnitrzmoj.supabase.co";
const supabaseKey = "sb_publishable_eQPg98Sid1Q2rD2lki6eMg__StzT6EE";

export const supabase = createClient(supabaseUrl, supabaseKey);