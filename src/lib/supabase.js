import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

export const isConfigured =
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'your_new_supabase_url' &&
  supabaseUrl.startsWith('https://')

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key')

// Admin client — only used for privileged operations like updating auth passwords.
// Require a real-looking key (placeholders are short) so we don't create a client
// with an invalid key and then silently fail every admin call.
const hasRealServiceKey = supabaseServiceKey && supabaseServiceKey.length > 40
export const supabaseAdmin = (supabaseUrl && hasRealServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null
