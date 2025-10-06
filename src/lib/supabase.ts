// src/lib/supabase.ts

import { createClient } from "@supabase/supabase-js";

// URL y clave pública del proyecto, que obtuviste de Supabase (API settings)
const supabaseUrl = "https://mckiaohbwvuotuqlasyz.supabase.co"; // 🔁 Reemplaza esto con tu URL real
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ja2lhb2hid3Z1b3R1cWxhc3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzODUyODIsImV4cCI6MjA2OTk2MTI4Mn0.jxPFKywYvd41xpQ2NOjczYvBZBkZpsyZZYb5W-QSsAc"; // 🔁 Reemplaza esto con tu anon public key

// Creamos una instancia del cliente Supabase que usaremos en toda la app
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
