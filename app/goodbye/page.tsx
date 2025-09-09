import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Home } from 'lucide-react';
import Link from 'next/link';

export default function GoodbyePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Account Deleted</CardTitle>
            <CardDescription>
              Your account and all associated data have been permanently deleted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Thank you for using ChiPhi AI. We're sorry to see you go.
              </p>
              
              <div className="bg-muted/50 rounded-lg p-4 text-left">
                <h4 className="text-sm font-medium mb-2">What was deleted:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• All transaction and receipt data</li>
                  <li>• All email processing history</li>
                  <li>• All merchant mappings and learning data</li>
                  <li>• All organization settings and preferences</li>
                  <li>• Your user account and access credentials</li>
                </ul>
              </div>
              
              <p className="text-sm text-muted-foreground">
                If you change your mind, you can always create a new account in the future.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button asChild className="w-full">
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Return to Home
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="w-full">
                <a 
                  href="mailto:support@chiphi.ai?subject=Account%20Deletion%20Feedback"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Send Feedback
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}