import { TransactionDashboard } from '@/components/transaction-dashboard'
import { getCurrentUser } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import AuthGuard from '@/components/auth/auth-guard'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  const supabase = await createClient()
  
  // Get user's organization (first one if multiple)
  const { data: orgMembers } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)

  // If user has no organizations, AuthGuard will handle onboarding
  if (!orgMembers || orgMembers.length === 0) {
    return (
      <AuthGuard>
        <div>Loading...</div>
      </AuthGuard>
    )
  }

  const orgMember = orgMembers[0]

  return <TransactionDashboard orgId={orgMember.org_id} />
}