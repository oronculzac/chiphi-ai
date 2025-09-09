import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Mail,
  Brain,
  BarChart3,
  CheckCircle,
  Clock,
  DollarSign,
  MapPin,
  Calendar,
  Tag,
  FileText,
  Download,
  Eye,
  Languages,
  Target,
} from "lucide-react"

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
              <div className="flex items-center space-x-2">
                <Brain className="h-6 w-6 text-primary" />
                <span className="text-lg font-bold">ChiPhi AI Demo</span>
              </div>
            </div>
            <Button asChild>
              <Link href="/auth/signin">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Demo Introduction */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Interactive Demo</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            See how ChiPhi AI transforms emailed receipts into structured financial data with explainable AI
          </p>
        </div>

        {/* Demo Flow */}
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Step 1: Email Receipt */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Step 1: Email Receipt</CardTitle>
                  <CardDescription>Forward your receipt to your unique email alias</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">To:</Badge>
                    <span className="font-mono text-sm">u_demo@chiphi.oronculzac.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">From:</Badge>
                    <span className="text-sm">receipts@starbucks.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Subject:</Badge>
                    <span className="text-sm">Your Starbucks Receipt</span>
                  </div>
                  <div className="mt-4 p-4 bg-background rounded border">
                    <p className="text-sm font-medium mb-2">Receipt Content:</p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Starbucks Coffee #1234</p>
                      <p>123 Main Street, Seattle WA</p>
                      <p>Date: 2024-01-15 08:30 AM</p>
                      <p>Grande Latte - $5.45</p>
                      <p>Blueberry Muffin - $3.25</p>
                      <p>Tax - $0.78</p>
                      <p><strong>Total: $9.48</strong></p>
                      <p>Card ending in 1234</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: AI Processing */}
          <Card className="border-2 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                  <Brain className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">Step 2: AI Processing</CardTitle>
                  <CardDescription>AI extracts and categorizes transaction data</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Languages className="h-4 w-4" />
                    Language Detection & Translation
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Language: English (detected)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Translation: Not required</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Data Extraction
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Merchant identified</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Amount extracted</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Date parsed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Category assigned</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Structured Output */}
          <Card className="border-2 border-green-200 dark:border-green-800">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">Step 3: Structured Transaction</CardTitle>
                  <CardDescription>Clean, categorized data ready for analysis</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Date</p>
                        <p className="text-sm text-muted-foreground">January 15, 2024</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Amount</p>
                        <p className="text-sm text-muted-foreground">$9.48 USD</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Merchant</p>
                        <p className="text-sm text-muted-foreground">Starbucks Coffee</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Tag className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Category</p>
                        <p className="text-sm text-muted-foreground">Food & Dining</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Last 4 Digits</p>
                        <p className="text-sm text-muted-foreground">****1234</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Eye className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Confidence</p>
                        <p className="text-sm text-muted-foreground">95% (High)</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    AI Explanation
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Categorized as "Food & Dining" because the merchant "Starbucks Coffee" is a well-known 
                    coffee shop chain, and the items purchased (Grande Latte, Blueberry Muffin) are food 
                    and beverage items. Confidence is high due to clear merchant identification and 
                    typical food service transaction pattern.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features Showcase */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <Card>
              <CardHeader>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                  <Languages className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Multilingual Support</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Process receipts in any language with automatic translation to English
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Learning System</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  AI learns from your corrections to improve future categorization accuracy
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Export Options</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Export to CSV or YNAB-compatible formats for seamless integration
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* CTA */}
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-muted-foreground mb-6">
              Transform your receipt processing with AI-powered automation
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href="/auth/signin">Start Free Trial</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/">Learn More</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}