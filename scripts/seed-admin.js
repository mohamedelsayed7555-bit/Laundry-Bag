const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://kjqtrmedkvqfofwymoni.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var first')
  console.error('Find it at: Supabase Dashboard → Settings → API → service_role key')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function seedAdmin() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@cleano.com',
    password: 'Cleano@2024',
    email_confirm: true,
    user_metadata: { name: 'Mohamed Admin', role: 'admin' }
  })

  if (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }

  console.log('Admin user created:', data.user.id)

  // Update role to admin in public.users (trigger sets it to customer by default from metadata)
  const { error: updateError } = await supabase
    .from('users')
    .update({ role: 'admin', name: 'Mohamed Admin' })
    .eq('id', data.user.id)

  if (updateError) {
    console.error('Error updating role:', updateError.message)
  } else {
    console.log('Role set to admin')
  }

  console.log('\n✅ Admin account ready:')
  console.log('   Email:    admin@cleano.com')
  console.log('   Password: Cleano@2024')
}

seedAdmin()
