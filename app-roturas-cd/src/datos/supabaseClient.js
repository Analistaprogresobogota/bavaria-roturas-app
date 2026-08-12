import { createClient } from '@supabase/supabase-js';
import { CONFIG, SUPABASE_LISTO } from '../config.js';

export const supabase = SUPABASE_LISTO ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey) : null;
