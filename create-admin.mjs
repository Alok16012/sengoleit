import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qovegzlivdjrkqmoavqf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvdmVnemxpdmRqcmtxbW9hdnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MDk2OTAsImV4cCI6MjA5NDM4NTY5MH0.H1GpUuOb8DxwZsYVatvns-H9hYAokAjFqepFEA7iKrY'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const { data, error } = await supabase.auth.signUp({
  email: 'admin@sengol.com',
  password: 'Admin@123456',
  options: {
    data: { role: 'admin', full_name: 'Admin User' }
  }
})

if (error) {
  console.error('Error:', error.message)
} else {
  console.log('Admin user created successfully!')
  console.log('Email: admin@sengol.com')
  console.log('Password: Admin@123456')
  console.log('User ID:', data.user?.id)
  console.log('\nAb Login page pe "Demo Login" button click karo.')
}
