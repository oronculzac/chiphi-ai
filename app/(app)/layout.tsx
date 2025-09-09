import { getCurrentUser } from '@/lib/auth/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/app-layout'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin')
  }

  return <AppLayout>{children}</AppLayout>
}