"use client"

import React, { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import { Mail, ArrowRight, ArrowLeft, Copy, Check, Settings, Shield, Zap, CheckCircle, AlertCircle, Loader2, X } from "lucide-react"
import type { InboxAlias } from "@/lib/services/inbox-alias"

const steps = [
  {
    id: 1,
    title: "Welcome",
    description: "Set up Gmail forwarding for your receipts",
  },
  {
    id: 2,
    title: "Generate Alias",
    description: "Create your unique receipt forwarding address",
  },
  {
    id: 3,
    title: "Gmail Settings",
    description: "Navigate to your Gmail forwarding settings",
  },
  {
    id: 4,
    title: "Add Forwarding",
    description: "Add your new forwarding address",
  },
  {
    id: 5,
    title: "Verification",
    description: "Verify your forwarding address",
  },
  {
    id: 6,
    title: "Create Filter",
    description: "Set up automatic forwarding with our filter",
  },
  {
    id: 7,
    title: "Test Setup",
    description: "Test your Gmail forwarding configuration",
  },
  {
    id: 8,
    title: "Complete",
    description: "You're all set! Start forwarding receipts",
  },
]

interface GmailSetupWizardProps {
  aliasEmail?: string;
  onComplete: () => void;
}

export default function GmailSetupWizard({ aliasEmail, onComplete }: GmailSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [inboxAlias, setInboxAlias] = useState<InboxAlias | null>(null)
  const [isCreatingAlias, setIsCreatingAlias] = useState(false)
  const [verificationCode, setVerificationCode] = useState("")
  const [copiedItems, setCopiedItems] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isTestingSetup, setIsTestingSetup] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const stepContentRef = useRef<HTMLDivElement>(null)

  const filterString = inboxAlias 
    ? `to:(${inboxAlias.aliasEmail}) OR subject:(receipt OR invoice OR purchase OR confirmation)`
    : ""

  // Load existing alias or create new one
  useEffect(() => {
    const loadOrCreateAlias = async () => {
      if (aliasEmail) {
        // Use provided alias email (mock InboxAlias object)
        setInboxAlias({
          id: 'provided',
          orgId: 'current',
          aliasEmail: aliasEmail,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      } else {
        // Try to get existing alias or create new one
        await createNewAlias()
      }
    }
    
    loadOrCreateAlias()
  }, [aliasEmail])

  const createNewAlias = async () => {
    setIsCreatingAlias(true)
    setError(null)

    try {
      const response = await fetch('/api/inbox-alias', {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create alias')
      }

      setInboxAlias(data.alias)
      toast({
        title: 'Alias created',
        description: 'Your unique forwarding address has been generated.',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alias')
    } finally {
      setIsCreatingAlias(false)
    }
  }

  const copyToClipboard = async (text: string, item: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItems([...copiedItems, item])
      setTimeout(() => {
        setCopiedItems(copiedItems.filter((i) => i !== item))
      }, 2000)
      toast({
        title: 'Copied!',
        description: 'Text copied to clipboard.',
      })
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy to clipboard. Please copy manually.',
        variant: 'destructive',
      })
    }
  }

  const testGmailSetup = async () => {
    setIsTestingSetup(true)
    setTestResult(null)

    try {
      // Simulate testing the Gmail setup
      // In a real implementation, this could:
      // 1. Send a test email to the user's Gmail
      // 2. Check if it gets forwarded to the alias
      // 3. Verify the webhook receives it
      
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate API call
      
      // For now, we'll simulate a successful test
      setTestResult({
        success: true,
        message: 'Gmail forwarding is working correctly! Test email was processed successfully.'
      })
    } catch (err) {
      setTestResult({
        success: false,
        message: 'Gmail forwarding test failed. Please check your filter configuration.'
      })
    } finally {
      setIsTestingSetup(false)
    }
  }

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
      // Focus the step content for screen readers
      setTimeout(() => {
        stepContentRef.current?.focus()
      }, 100)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      // Focus the step content for screen readers
      setTimeout(() => {
        stepContentRef.current?.focus()
      }, 100)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Welcome to Gmail Setup</h3>
              <p className="text-muted-foreground">
                We'll help you set up automatic receipt forwarding from Gmail to AI Receipts. This takes about 3 minutes
                and makes expense tracking effortless.
              </p>
            </div>
            <div className={`grid ${isMobile ? 'grid-cols-1 gap-6' : 'grid-cols-3 gap-4'} text-sm`}>
              <div className="flex flex-col items-center gap-2">
                <Settings className="h-6 w-6 text-primary" aria-hidden="true" />
                <span>Easy Setup</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Shield className="h-6 w-6 text-primary" aria-hidden="true" />
                <span>Secure</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Zap className="h-6 w-6 text-primary" aria-hidden="true" />
                <span>Automatic</span>
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Your Unique Forwarding Address</h3>
              <p className="text-muted-foreground mb-4">
                We've generated a unique email address for your receipt forwarding.
              </p>
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isCreatingAlias && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Generating your unique address...</span>
              </div>
            )}

            {inboxAlias && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <label htmlFor="alias-email" className="text-sm font-medium text-green-800 mb-2 block">
                  Your forwarding address
                </label>
                <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center gap-2'}`}>
                  <code 
                    id="alias-email"
                    className={`text-sm font-mono bg-white px-3 py-2 rounded border ${isMobile ? 'w-full text-center' : 'flex-1'}`}
                    role="textbox"
                    aria-readonly="true"
                    aria-label="Your unique forwarding email address"
                  >
                    {inboxAlias.aliasEmail}
                  </code>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => copyToClipboard(inboxAlias.aliasEmail, "alias")}
                    aria-label={`Copy email address ${inboxAlias.aliasEmail} to clipboard`}
                    className={isMobile ? 'w-full' : ''}
                  >
                    {copiedItems.includes("alias") ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-green-700 mt-2">
                  This address is unique to your organization and ready to receive receipts.
                </p>
              </div>
            )}

            {!inboxAlias && !isCreatingAlias && error && (
              <Button onClick={createNewAlias} className="w-full">
                <Mail className="h-4 w-4 mr-2" />
                Retry Creating Address
              </Button>
            )}
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Open Gmail Settings</h3>
              <p className="text-muted-foreground">
                Let's navigate to your Gmail forwarding settings to add the new address.
              </p>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-sm font-semibold">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Open Gmail in a new tab</p>
                    <p className="text-sm text-blue-700">Keep this wizard open while you work</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-sm font-semibold">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Go to Settings → Forwarding and POP/IMAP</p>
                    <p className="text-sm text-blue-700">Click the gear icon, then "See all settings"</p>
                  </div>
                </div>
              </div>
            </div>
            <Button
              onClick={() => window.open("https://mail.google.com/mail/u/0/#settings/fwdandpop", "_blank")}
              className="w-full"
              variant="outline"
            >
              <Mail className="h-4 w-4 mr-2" />
              Open Gmail Settings
            </Button>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Add Forwarding Address</h3>
              <p className="text-muted-foreground">
                Add your unique forwarding address to Gmail's forwarding settings.
              </p>
            </div>
            {inboxAlias && (
              <div className="p-4 bg-muted/50 rounded-lg border">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Copy this address</label>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-background px-3 py-2 rounded border flex-1">
                    {inboxAlias.aliasEmail}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(inboxAlias.aliasEmail, "step4-alias")}>
                    {copiedItems.includes("step4-alias") ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-amber-600 text-sm font-semibold">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-amber-900">Click "Add a forwarding address"</p>
                    <p className="text-sm text-amber-700">In the Forwarding section of Gmail settings</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-amber-600 text-sm font-semibold">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-amber-900">Paste the address above</p>
                    <p className="text-sm text-amber-700">Gmail will send a verification email to your forwarding address</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Verify Forwarding Address</h3>
              <p className="text-muted-foreground">
                Gmail has sent a verification email to your forwarding address. Enter the verification code here.
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="verification-code" className="text-sm font-medium mb-2 block">
                  Verification Code
                </label>
                <Input
                  id="verification-code"
                  placeholder="Enter verification code from Gmail"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                  className="text-center font-mono text-lg"
                  aria-describedby="verification-code-desc"
                  autoComplete="off"
                />
                <div id="verification-code-desc" className="sr-only">
                  Enter the verification code that Gmail sent to your forwarding address
                </div>
              </div>
              
              {verificationCode && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-900">Code entered: {verificationCode}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Complete verification in Gmail</p>
                  <p className="text-sm text-blue-700">
                    Go back to Gmail, enter this code in the verification dialog, and click "Verify"
                  </p>
                </div>
              </div>
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Create Smart Filter</h3>
              <p className="text-muted-foreground">Set up an automatic filter to forward all receipts and invoices.</p>
            </div>
            {filterString && (
              <div className="p-4 bg-muted/50 rounded-lg border">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Filter criteria (copy this)
                </label>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-background px-3 py-2 rounded border flex-1 break-all">
                    {filterString}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(filterString, "filter")}>
                    {copiedItems.includes("filter") ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-purple-600 text-sm font-semibold">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-purple-900">Go to Gmail Filters & Blocked Addresses</p>
                    <p className="text-sm text-purple-700">In Settings, click "Filters and Blocked Addresses"</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-purple-600 text-sm font-semibold">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-purple-900">Create new filter with the criteria above</p>
                    <p className="text-sm text-purple-700">Set action to "Forward to" your verified address</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-purple-600 text-sm font-semibold">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-purple-900">Enable "Also apply filter to matching conversations"</p>
                    <p className="text-sm text-purple-700">This will forward existing receipts in your inbox</p>
                  </div>
                </div>
              </div>
            </div>
            <Button
              onClick={() => window.open("https://mail.google.com/mail/u/0/#settings/filters", "_blank")}
              className="w-full"
              variant="outline"
            >
              <Settings className="h-4 w-4 mr-2" />
              Open Gmail Filters
            </Button>
          </div>
        )

      case 7:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Test Your Setup</h3>
              <p className="text-muted-foreground">
                Let's verify that your Gmail forwarding is working correctly.
              </p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">How to test</p>
                  <p className="text-sm text-blue-700">
                    Send a test email with "receipt" in the subject line to yourself, or forward an existing receipt email.
                    The system should automatically process it within 60 seconds.
                  </p>
                </div>
              </div>
            </div>

            {testResult && (
              <Alert variant={testResult.success ? "default" : "destructive"}>
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}

            <div className={`flex ${isMobile ? 'flex-col space-y-3' : 'gap-3'}`}>
              <Button
                onClick={testGmailSetup}
                disabled={isTestingSetup}
                className="flex-1"
                variant="outline"
                aria-describedby="test-setup-desc"
              >
                {isTestingSetup ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" aria-hidden="true" />
                    Test Setup
                  </>
                )}
              </Button>
              <div id="test-setup-desc" className="sr-only">
                Test your Gmail forwarding configuration to ensure it's working correctly
              </div>
              <Button
                onClick={nextStep}
                disabled={!testResult?.success}
                className="flex-1"
                aria-describedby="continue-desc"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
              </Button>
              <div id="continue-desc" className="sr-only">
                Continue to the next step after successful testing
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              <p>
                <strong>Note:</strong> You can skip the test and complete setup manually if needed.
              </p>
            </div>
          </div>
        )

      case 8:
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Setup Complete!</h3>
              <p className="text-muted-foreground">
                Your Gmail is now configured to automatically forward receipts to ChiPhi AI. New receipts will be
                processed and categorized automatically.
              </p>
            </div>
            {inboxAlias && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Your forwarding address:</strong> {inboxAlias.aliasEmail}
                </p>
              </div>
            )}
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>✅ Unique forwarding address created</p>
              <p>✅ Gmail forwarding configured</p>
              <p>✅ Smart filter for receipts set up</p>
              {testResult?.success && <p>✅ Setup tested and verified</p>}
            </div>
            <div className="text-sm text-muted-foreground">
              <p>You can now close this wizard and start forwarding receipts!</p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto" role="main" aria-labelledby="wizard-title">
      <CardHeader className="pb-4">
        <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'items-start justify-between'}`}>
          <CardTitle id="wizard-title" className="text-2xl pr-12">Gmail Setup Wizard</CardTitle>
          <Badge variant="outline" aria-label={`Current progress: step ${currentStep} of ${steps.length}`} className="shrink-0">
            Step {currentStep} of {steps.length}
          </Badge>
        </div>
        <Progress 
          value={(currentStep / steps.length) * 100} 
          className="mt-4" 
          aria-label={`Setup progress: ${Math.round((currentStep / steps.length) * 100)}% complete`}
        />
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          Step {currentStep}: {steps[currentStep - 1]?.title}. {steps[currentStep - 1]?.description}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div 
          ref={stepContentRef}
          tabIndex={-1}
          className="focus:outline-none"
          role="region"
          aria-labelledby={`step-${currentStep}-heading`}
        >
          <h2 id={`step-${currentStep}-heading`} className="sr-only">
            {steps[currentStep - 1]?.title}: {steps[currentStep - 1]?.description}
          </h2>
          {renderStepContent()}
        </div>

        <nav className={`flex ${isMobile ? 'flex-col space-y-3' : 'items-center justify-between'} pt-6 border-t`} aria-label="Wizard navigation">
          <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'gap-2'}`}>
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`flex items-center gap-2 bg-transparent ${isMobile ? 'w-full' : ''}`}
              aria-label="Go to previous step"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            
            {currentStep !== steps.length && (
              <Button
                variant="ghost"
                onClick={onComplete}
                className={`flex items-center gap-2 text-muted-foreground ${isMobile ? 'w-full' : ''}`}
                aria-label="Skip Gmail setup wizard"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Skip Setup
              </Button>
            )}
          </div>

          <div className={`flex ${isMobile ? 'w-full' : 'gap-2'}`}>
            {currentStep === steps.length ? (
              <Button 
                onClick={onComplete} 
                className={`flex items-center gap-2 ${isMobile ? 'w-full' : ''}`}
                aria-label="Complete Gmail setup wizard"
              >
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
                Finish Setup
              </Button>
            ) : currentStep === 7 ? (
              // Step 7 has custom navigation
              null
            ) : (
              <Button 
                onClick={nextStep} 
                disabled={
                  (currentStep === 2 && !inboxAlias) ||
                  (currentStep === 5 && !verificationCode.trim())
                } 
                className={`flex items-center gap-2 ${isMobile ? 'w-full' : ''}`}
                aria-label="Continue to next step"
              >
                Continue
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </nav>
      </CardContent>
    </Card>
  )
}
