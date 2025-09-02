'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Copy, Mail, Plus, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { InboxAlias } from '@/lib/services/inbox-alias';

export default function InboxAliasManager() {
  const [aliases, setAliases] = useState<InboxAlias[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullEmail, setShowFullEmail] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();

  const fetchAliases = async () => {
    try {
      const response = await fetch('/api/inbox-alias');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch aliases');
      }

      setAliases(data.aliases || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch aliases');
    } finally {
      setIsLoading(false);
    }
  };

  const createAlias = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/inbox-alias', {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create alias');
      }

      await fetchAliases();
      toast({
        title: 'Alias created',
        description: 'Your new inbox alias has been created successfully.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alias');
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: 'Email address copied to clipboard.',
      });
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy to clipboard. Please copy manually.',
        variant: 'destructive',
      });
    }
  };

  const toggleEmailVisibility = (aliasId: string) => {
    setShowFullEmail(prev => ({
      ...prev,
      [aliasId]: !prev[aliasId],
    }));
  };

  const formatEmailForDisplay = (email: string, aliasId: string) => {
    if (showFullEmail[aliasId]) {
      return email;
    }
    
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 8) {
      return email;
    }
    
    return `${localPart.substring(0, 8)}...@${domain}`;
  };

  useEffect(() => {
    fetchAliases();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const activeAlias = aliases.find(alias => alias.isActive);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Inbox Aliases
          </CardTitle>
          <CardDescription>
            Forward receipts to these email addresses for automatic processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {activeAlias && (
            <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                    <span className="text-sm font-medium">Primary Receipt Address</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-white px-2 py-1 rounded border">
                      {formatEmailForDisplay(activeAlias.aliasEmail, activeAlias.id)}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleEmailVisibility(activeAlias.id)}
                      className="h-6 w-6 p-0"
                    >
                      {showFullEmail[activeAlias.id] ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(activeAlias.aliasEmail)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!activeAlias && aliases.length === 0 && (
            <div className="text-center py-8 space-y-4">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="font-medium">No inbox aliases</h3>
                <p className="text-sm text-muted-foreground">
                  Create an alias to start receiving receipt emails
                </p>
              </div>
              <Button onClick={createAlias} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Inbox Alias
                  </>
                )}
              </Button>
            </div>
          )}

          {aliases.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">All Aliases</h4>
                <Button size="sm" onClick={createAlias} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-3 w-3" />
                      New Alias
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                {aliases.map((alias) => (
                  <div
                    key={alias.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={alias.isActive ? 'default' : 'secondary'}>
                        {alias.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <code className="text-sm">
                        {formatEmailForDisplay(alias.aliasEmail, alias.id)}
                      </code>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleEmailVisibility(alias.id)}
                        className="h-8 w-8 p-0"
                      >
                        {showFullEmail[alias.id] ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(alias.aliasEmail)}
                        className="h-8 w-8 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>How to use:</strong> Forward receipt emails to your active alias address.
            </p>
            <p>
              The system will automatically process receipts and extract transaction data.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}