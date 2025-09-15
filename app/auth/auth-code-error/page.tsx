'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

export default function AuthCodeErrorPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">Authentication Error</CardTitle>
          <CardDescription>
            There was a problem with your authentication link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              The authentication link is invalid or has expired. This can happen if:
              <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                <li>The link has already been used</li>
                <li>The link has expired (links are valid for 1 hour)</li>
                <li>The link was corrupted during transmission</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Button 
              onClick={() => router.push('/')} 
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => router.push('/?forgot=true')} 
              className="w-full"
            >
              Request New Link
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              If you continue to have problems, please contact support.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}