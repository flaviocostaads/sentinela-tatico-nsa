-- Create storage policies for odometer photos
CREATE POLICY "Users can upload their own odometer photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'odometer-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own odometer photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'odometer-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all odometer photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'odometer-photos' AND EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));