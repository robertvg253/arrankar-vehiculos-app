import { createClient } from "@supabase/supabase-js";

// ✅ Validación explícita de variables env
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Falta la variable de entorno SUPABASE_URL");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("Falta la variable de entorno SUPABASE_ANON_KEY");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY");
}

// 🧠 Cliente Supabase para el servidor con service role key (bypass RLS)
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// 🧠 Cliente Supabase para el cliente (respetando RLS)
export const clientSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
  },
});
