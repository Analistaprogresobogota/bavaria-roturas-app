export const CONFIG = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  // URL de la API propia (api-roturas) que reemplaza a Supabase, hablando
  // con la base de datos de Tecnologia en Azure. Ej: https://api-roturas.midominio.com
  apiUrl: (import.meta.env.VITE_API_URL || '').replace(/\/$/, ''),
  sede: import.meta.env.VITE_SEDE || 'Progreso',
};

export const SUPABASE_LISTO = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
export const API_LISTO = Boolean(CONFIG.apiUrl);
