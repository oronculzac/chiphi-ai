"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import AuthForm from "@/components/auth/auth-form"
import {
  Mail,
  Brain,
  BarChart3,
  Shield,
  Globe,
  Zap,
  FileText,
  Download,
  Lock,
  Eye,
  RefreshCw,
  CheckCircle,
  ArrowRight,
  Languages,
  Target,
  TrendingUp,
  X,
} from "lucide-react"

interface LandingPageProps {
  showAuthForm?: boolean
}

function LandingPage({ showAuthForm = false }: LandingPageProps) {
  const [authModalOpen, setAuthModalOpen] = useState(showAuthForm)

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-2">
              <Brain className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">ChiPhi AI</span>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="#features" className="text-sm font-medium hover:text-primary transition-colors">
                Features
              </Link>
              <Link href="#security" className="text-sm font-medium hover:text-primary transition-colors">
                Security
              </Link>
              <Link href="#how-it-works" className="text-sm font-medium hover:text-primary transition-colors">
                How it Works
              </Link>
            </nav>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link href="/demo">See Demo</Link>
              </Button>
              <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
                <DialogTrigger asChild>
                  <Button>Get Started</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="sr-only">Authentication</DialogTitle>
                  </DialogHeader>
                  <AuthForm onSuccess={() => setAuthModalOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 lg:py-32 bg-gradient-to-b from-background to-muted/20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-4xl mx-auto">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                Turn inbox receipts into{" "}
                <span className="text-primary">clear, trustworthy</span>{" "}
                spend data
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
                ChiPhi AI ingests emailed receipts, translates any language to English, 
                extracts structured transactions with explainable AI, and generates reports—automatically.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="text-lg px-8 py-6">
                      Get Started
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="sr-only">Authentication</DialogTitle>
                    </DialogHeader>
                    <AuthForm onSuccess={() => setAuthModalOpen(false)} />
                  </DialogContent>
                </Dialog>
                <Button size="lg" variant="outline" className="text-lg px-8 py-6" asChild>
                  <Link href="/demo">See Demo</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>



        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Three simple steps to transform your receipts into actionable financial data
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <div className="bg-primary/5 rounded-full px-4 py-2 text-primary font-semibold text-sm mb-4 inline-block">
                  Step 1
                </div>
                <h3 className="text-xl font-semibold mb-3">Forward receipts</h3>
                <p className="text-muted-foreground">
                  Send receipts to your unique email alias: u_&lt;alias&gt;@chiphi.oronculzac.com
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
                <div className="bg-primary/5 rounded-full px-4 py-2 text-primary font-semibold text-sm mb-4 inline-block">
                  Step 2
                </div>
                <h3 className="text-xl font-semibold mb-3">AI parses & translates</h3>
                <p className="text-muted-foreground">
                  Extract merchant, date, amount, category + 'Why' explanations with confidence scores
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <div className="bg-primary/5 rounded-full px-4 py-2 text-primary font-semibold text-sm mb-4 inline-block">
                  Step 3
                </div>
                <h3 className="text-xl font-semibold mb-3">Review & report</h3>
                <p className="text-muted-foreground">
                  View dashboards, make corrections, and export to CSV/YNAB formats
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-muted/20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Powerful Features</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Everything you need to transform receipts into actionable financial insights
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Languages className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Multilingual Extraction</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Process receipts in any language with automatic translation to English, 
                    preserving both original and translated text.
                  </CardDescription>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>MerchantMap Learning</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    System learns from your corrections to improve future categorization 
                    accuracy for your specific spending patterns.
                  </CardDescription>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Eye className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Explainable AI</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Every transaction includes confidence scores and clear explanations 
                    for AI categorization decisions.
                  </CardDescription>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Real-time dashboards with spending trends, category breakdowns, 
                    and month-to-date summaries.
                  </CardDescription>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Download className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>CSV/YNAB Export</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Export your data in standard CSV format or YNAB-compatible format 
                    for seamless integration with your budgeting tools.
                  </CardDescription>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Real-time Processing</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Receipts are processed within 60 seconds of forwarding, 
                    with instant notifications when transactions are ready.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Security & Privacy Section */}
        <section id="security" className="py-20 bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Security & Privacy</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Enterprise-grade security with complete data isolation and privacy protection
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Shield className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold mb-3">RLS Isolation</h3>
                <p className="text-muted-foreground text-sm">
                  Row-level security ensures complete data isolation between organizations
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <RefreshCw className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold mb-3">Idempotent Processing</h3>
                <p className="text-muted-foreground text-sm">
                  Duplicate emails are automatically detected and handled safely
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lock className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold mb-3">PII Redaction</h3>
                <p className="text-muted-foreground text-sm">
                  Credit card numbers and sensitive data are automatically redacted
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileText className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-lg font-semibold mb-3">Audit Logs</h3>
                <p className="text-muted-foreground text-sm">
                  Complete audit trail with correlation IDs for all processing activities
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-primary/5">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Ready to transform your receipt processing?
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                Join organizations already using ChiPhi AI to automate their expense tracking 
                with transparent, multilingual AI processing.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="text-lg px-8 py-6">
                      Get Started Free
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="sr-only">Authentication</DialogTitle>
                    </DialogHeader>
                    <AuthForm onSuccess={() => setAuthModalOpen(false)} />
                  </DialogContent>
                </Dialog>
                <Button size="lg" variant="outline" className="text-lg px-8 py-6" asChild>
                  <Link href="/demo">Try the Demo</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <Brain className="h-6 w-6 text-primary" />
                <span className="text-lg font-bold">ChiPhi AI</span>
              </div>
              <p className="text-muted-foreground mb-4 max-w-md">
                AI-powered receipt processing that transforms emailed receipts into 
                structured financial data with multilingual support and explainable insights.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#features" className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="#security" className="hover:text-foreground transition-colors">Security</Link></li>
                <li><Link href="/demo" className="hover:text-foreground transition-colors">Demo</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
                    <DialogTrigger asChild>
                      <button className="hover:text-foreground transition-colors">Sign In</button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="sr-only">Authentication</DialogTitle>
                      </DialogHeader>
                      <AuthForm onSuccess={() => setAuthModalOpen(false)} />
                    </DialogContent>
                  </Dialog>
                </li>
                <li>
                  <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
                    <DialogTrigger asChild>
                      <button className="hover:text-foreground transition-colors">Sign Up</button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="sr-only">Authentication</DialogTitle>
                      </DialogHeader>
                      <AuthForm onSuccess={() => setAuthModalOpen(false)} />
                    </DialogContent>
                  </Dialog>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 ChiPhi AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage