"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import LandingPage from "@/app/(marketing)/page"

export default function HomePage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [shouldRedirect, setShouldRedirect] = useState(false)

  useEffect(() => {
    // Only redirect if we're not loading and user is authenticated
    if (!isLoading && user && !shouldRedirect) {
      setShouldRedirect(true)
      router.push("/dashboard")
    }
  }, [user, isLoading, router, shouldRedirect])

  // Show loading while checking authentication - prevent flash
  if (isLoading || (user && !shouldRedirect)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Show marketing page for unauthenticated users
  if (!isLoading && !user) {
    return <LandingPage showAuthForm={false} />
  }

  return null
}