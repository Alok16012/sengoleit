import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured =
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'your_new_supabase_url' &&
  supabaseUrl.startsWith('https://')

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key')

// SECURITY: the service-role key must NEVER be used here. Anything referenced
// through import.meta.env is compiled into the public JS bundle, so a
// VITE_SUPABASE_SERVICE_KEY handed to this file shipped the database's master
// key to every visitor (it was found in the live site's bundle). Privileged
// operations (auth.admin.createUser / password resets) belong in a Supabase
// Edge Function that holds the key server-side. Until one exists, supabaseAdmin
// stays null — every call site already guards with `if (supabaseAdmin)` or
// falls back to the regular client.
export const supabaseAdmin = null
