'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  requiresTyping?: {
    expectedText: string;
    placeholder: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  requiresTyping,
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmationDialogProps) {
  const [typedText, setTypedText] = useState('');
  const [isConfirmEnabled, setIsConfirmEnabled] = useState(false);

  // Reset typed text when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTypedText('');
    }
  }, [open]);

  // Check if confirmation should be enabled
  useEffect(() => {
    if (requiresTyping) {
      setIsConfirmEnabled(typedText === requiresTyping.expectedText);
    } else {
      setIsConfirmEnabled(true);
    }
  }, [typedText, requiresTyping]);

  const handleConfirm = () => {
    if (isConfirmEnabled && !isLoading) {
      onConfirm();
    }
  };

  const handleCancel = () => {
    if (!isLoading) {
      onCancel();
      onOpenChange(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isConfirmEnabled && !isLoading) {
      handleConfirm();
    } else if (e.key === 'Escape' && !isLoading) {
      handleCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${variant === 'destructive' ? 'text-destructive' : ''}`}>
            {variant === 'destructive' && <AlertTriangle className="h-5 w-5" />}
            {title}
          </DialogTitle>
          <DialogDescription className="text-left">
            {description}
          </DialogDescription>
        </DialogHeader>

        {requiresTyping && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="confirmation-input" className="text-sm font-medium">
                Type <span className="font-mono bg-muted px-1 rounded">{requiresTyping.expectedText}</span> to confirm:
              </Label>
              <Input
                id="confirmation-input"
                type="text"
                placeholder={requiresTyping.placeholder}
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                disabled={isLoading}
                className={variant === 'destructive' ? 'border-destructive/20 focus:border-destructive' : ''}
                autoComplete="off"
                autoFocus
              />
            </div>
            
            {typedText && typedText !== requiresTyping.expectedText && (
              <p className="text-sm text-muted-foreground">
                Text doesn't match. Please type exactly: <span className="font-mono">{requiresTyping.expectedText}</span>
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}