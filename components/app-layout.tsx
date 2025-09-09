"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { 
  Receipt, 
  Home, 
  FileText, 
  Settings, 
  Mail, 
  Bell,
  Menu,
  X,
  User,
  LogOut,
  ChevronDown
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth/auth-provider"
import GmailSetupWizard from "@/components/gmail-setup-wizard"

interface AppLayoutProps {
  children: React.ReactNode
}

const navigationItems = [
  { id: "overview", label: "Dashboard", icon: Home, href: "/dashboard" },
  { id: "receipts", label: "Receipts", icon: Receipt, href: "/receipts" },
  { id: "reports", label: "Reports", icon: FileText, href: "/reports" },
  { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
]

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [showGmailWizard, setShowGmailWizard] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const getActiveNavItem = () => {
    if (pathname.startsWith("/reports")) return "reports"
    if (pathname.startsWith("/settings")) return "settings"
    if (pathname.startsWith("/receipts")) return "receipts"
    if (pathname.startsWith("/dashboard")) return "overview"
    return "overview"
  }

  const activeNav = getActiveNavItem()

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setIsSigningOut(false)
    }
  }

  const getUserInitials = () => {
    if (!user?.email) return "U"
    return user.email.charAt(0).toUpperCase()
  }

  const UserMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="relative h-8 w-8 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="User menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.email || "User"} />
            <AvatarFallback className="text-xs">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">Account</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 bg-sidebar border-r border-sidebar-border">
        <div className="p-6 w-full">
          <div className="flex items-center gap-2 mb-8">
            <Receipt className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-semibold text-sidebar-foreground">AI Receipts</h1>
          </div>

          <nav className="space-y-2" role="navigation" aria-label="Desktop navigation">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = activeNav === item.id
              
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-50 transform transition-transform duration-200 ease-in-out md:hidden",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <Receipt className="h-8 w-8 text-primary" />
              <h1 className="text-xl font-semibold text-sidebar-foreground">AI Receipts</h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(false)}
              className="h-8 w-8 p-0"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <nav className="space-y-2" role="navigation" aria-label="Mobile navigation">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = activeNav === item.id
              
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Mobile Header */}
        <div className="md:hidden border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between h-16 px-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(true)}
              className="h-8 w-8 p-0"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-2">
              <Receipt className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-semibold">AI Receipts</h1>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowGmailWizard(true)} 
                className="gap-2"
              >
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Setup</span>
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => {
                  alert("Notifications feature coming soon!")
                }}
                className="gap-2"
              >
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Alerts</span>
              </Button>
              <UserMenu />
            </div>
          </div>
        </div>

        {/* Desktop Header - Only show on dashboard and receipts pages */}
        {!pathname.startsWith("/reports") && !pathname.startsWith("/settings") && (
          <div className="hidden md:block p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-foreground">
                  {activeNav === "receipts" ? "Receipts" : 
                   activeNav === "settings" ? "Settings" : 
                   activeNav === "reports" ? "Reports" : 
                   "Dashboard"}
                </h2>
                <p className="text-muted-foreground">
                  {activeNav === "receipts"
                    ? "Manage and review your AI-processed receipts"
                    : activeNav === "settings"
                    ? "Configure your account and preferences"
                    : activeNav === "reports"
                    ? "Analyze your spending patterns with interactive charts and detailed insights"
                    : "Track your expenses with AI-powered insights"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => setShowGmailWizard(true)} className="gap-2">
                  <Mail className="h-4 w-4" />
                  Setup Gmail
                </Button>
                <Button 
                  className="gap-2"
                  onClick={() => {
                    alert("Notifications feature coming soon!")
                  }}
                >
                  <Bell className="h-4 w-4" />
                  Notifications
                </Button>
                <UserMenu />
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <div className={cn(
          pathname.startsWith("/reports") || pathname.startsWith("/settings") ? "" : "px-8 pb-8"
        )}>
          {children}
        </div>
      </div>

      {/* Gmail Setup Wizard Modal */}
      {showGmailWizard && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowGmailWizard(false)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowGmailWizard(false)
            }
          }}
          tabIndex={-1}
        >
          <div className="bg-background rounded-lg shadow-lg max-h-[90vh] overflow-y-auto relative">
            <GmailSetupWizard onComplete={() => setShowGmailWizard(false)} />
          </div>
        </div>
      )}
    </div>
  )
}