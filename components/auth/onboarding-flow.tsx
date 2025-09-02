'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Building2, User, Mail, Loader2 } from 'lucide-react';

interface OnboardingFlowProps {
  userId: string;
  userEmail: string;
  onComplete: (orgId: string) => void;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export default function OnboardingFlow({ userId, userEmail, onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form data
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');

  const steps: OnboardingStep[] = [
    {
      id: 'profile',
      title: 'Complete your profile',
      description: 'Tell us a bit about yourself',
      completed: currentStep > 0,
    },
    {
      id: 'organization',
      title: 'Create your organization',
      description: 'Set up your workspace for receipt processing',
      completed: currentStep > 1,
    },
    {
      id: 'complete',
      title: 'All set!',
      description: 'Your account is ready to use',
      completed: currentStep > 2,
    },
  ];

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          fullName: fullName.trim(),
          email: userEmail,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update profile');
      }

      setCurrentStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrganizationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!organizationName.trim()) {
      setError('Please enter an organization name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: organizationName.trim(),
          userId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create organization');
      }

      setCurrentStep(2);
      
      // Complete onboarding after a brief delay
      setTimeout(() => {
        onComplete(result.organization.id);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setIsLoading(false);
    }
  };

  const progressPercentage = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Progress indicator */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Step {currentStep + 1} of {steps.length}</span>
          <span>{Math.round(progressPercentage)}% complete</span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {/* Steps overview */}
      <div className="flex justify-between">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-center space-x-2 ${
              index <= currentStep ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            {step.completed ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <div
                className={`h-5 w-5 rounded-full border-2 ${
                  index === currentStep
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground'
                }`}
              />
            )}
            <span className="text-sm font-medium hidden sm:block">{step.title}</span>
          </div>
        ))}
      </div>

      {/* Step content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentStep === 0 && <User className="h-5 w-5" />}
            {currentStep === 1 && <Building2 className="h-5 w-5" />}
            {currentStep === 2 && <CheckCircle className="h-5 w-5 text-green-500" />}
            {steps[currentStep].title}
          </CardTitle>
          <CardDescription>{steps[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {currentStep === 0 && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={userEmail}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="fullName" className="text-sm font-medium">
                  Full name
                </label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving profile...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </form>
          )}

          {currentStep === 1 && (
            <form onSubmit={handleOrganizationSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="organizationName" className="text-sm font-medium">
                  Organization name
                </label>
                <Input
                  id="organizationName"
                  type="text"
                  placeholder="e.g., Acme Corp, John's Business"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  This will be used to organize your receipts and expenses.
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating organization...
                  </>
                ) : (
                  'Create organization'
                )}
              </Button>
            </form>
          )}

          {currentStep === 2 && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Welcome to ChiPhi AI!</h3>
                <p className="text-muted-foreground">
                  Your account has been set up successfully. You'll be redirected to your dashboard shortly.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}