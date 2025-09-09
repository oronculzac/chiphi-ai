"use client";

import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  requiresTyping?: {
    expectedText: string;
    placeholder: string;
    label?: string;
  };
  onConfirm: () => void;
  onCancel?: () => void;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  requiresTyping,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const [typedText, setTypedText] = useState("");

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTypedText("");
      onCancel?.();
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = () => {
    onConfirm();
    setTypedText("");
    onOpenChange(false);
  };

  const isConfirmDisabled = requiresTyping 
    ? typedText !== requiresTyping.expectedText
    : false;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <div>{description}</div>
            {requiresTyping && (
              <div className="space-y-2">
                <Label htmlFor="confirmation-input">
                  {requiresTyping.label || `Type "${requiresTyping.expectedText}" to confirm:`}
                </Label>
                <Input
                  id="confirmation-input"
                  type="text"
                  placeholder={requiresTyping.placeholder}
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  className="font-mono"
                />
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handleOpenChange(false)}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={
              variant === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}