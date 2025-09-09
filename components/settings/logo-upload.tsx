'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface LogoUploadProps {
  currentLogoUrl?: string | null;
  onLogoUpdate: (logoUrl: string | null) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export default function LogoUpload({ currentLogoUrl, onLogoUpdate, disabled = false }: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Please select a valid image file (JPEG, PNG, or WebP)';
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be less than 5MB';
    }
    
    return null;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      toast({
        title: 'Invalid File',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    // Create preview URL
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    // Upload the file
    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('logo', file);

      const response = await fetch('/api/settings/organization/logo', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload logo');
      }

      if (result.success) {
        onLogoUpdate(result.data.logo_url);
        toast({
          title: 'Success',
          description: 'Logo uploaded successfully',
        });
      } else {
        throw new Error(result.error || 'Failed to upload logo');
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload logo',
        variant: 'destructive',
      });
      
      // Reset preview on error
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    try {
      setRemoving(true);

      const response = await fetch('/api/settings/organization/logo', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove logo');
      }

      if (result.success) {
        onLogoUpdate(null);
        toast({
          title: 'Success',
          description: 'Logo removed successfully',
        });
      } else {
        throw new Error(result.error || 'Failed to remove logo');
      }
    } catch (error) {
      console.error('Error removing logo:', error);
      toast({
        title: 'Remove Failed',
        description: error instanceof Error ? error.message : 'Failed to remove logo',
        variant: 'destructive',
      });
    } finally {
      setRemoving(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Clean up preview URL on unmount
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const displayLogoUrl = previewUrl || currentLogoUrl;

  return (
    <div className="space-y-4">
      <Label>Organization Logo</Label>
      
      {/* Logo Display */}
      <div className="flex items-start gap-4">
        <div className="relative">
          {displayLogoUrl ? (
            <div className="relative w-20 h-20 rounded-lg border border-border overflow-hidden bg-muted">
              <Image
                src={displayLogoUrl}
                alt="Organization logo"
                fill
                className="object-cover"
                sizes="80px"
              />
              {uploading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="w-20 h-20 rounded-lg border border-dashed border-border flex items-center justify-center bg-muted">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Button
              onClick={handleUploadClick}
              variant="outline"
              size="sm"
              disabled={disabled || uploading || removing}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {currentLogoUrl ? 'Change Logo' : 'Upload Logo'}
                </>
              )}
            </Button>

            {currentLogoUrl && (
              <Button
                onClick={handleRemoveLogo}
                variant="outline"
                size="sm"
                disabled={disabled || uploading || removing}
              >
                {removing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Removing...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            <p>Upload a logo for your organization.</p>
            <p>Supported formats: JPEG, PNG, WebP. Max size: 5MB.</p>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading || removing}
      />
    </div>
  );
}