-- Create storage bucket for organization assets (logos, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-assets', 'organization-assets', true);

-- Create RLS policies for the organization-assets bucket
CREATE POLICY "Users can view organization assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'organization-assets');

CREATE POLICY "Org admins and owners can upload organization assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'organization-assets' 
  AND (storage.foldername(name))[1] = 'logos'
  AND auth.uid() IN (
    SELECT user_id FROM org_members 
    WHERE role IN ('owner', 'admin')
  )
);

CREATE POLICY "Org admins and owners can update organization assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'organization-assets' 
  AND (storage.foldername(name))[1] = 'logos'
  AND auth.uid() IN (
    SELECT user_id FROM org_members 
    WHERE role IN ('owner', 'admin')
  )
);

CREATE POLICY "Org admins and owners can delete organization assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'organization-assets' 
  AND (storage.foldername(name))[1] = 'logos'
  AND auth.uid() IN (
    SELECT user_id FROM org_members 
    WHERE role IN ('owner', 'admin')
  )
);