-- Create storage bucket for incident photos
INSERT INTO storage.buckets (id, name, public) VALUES ('incident-photos', 'incident-photos', true);

-- Create policies for incident photos
CREATE POLICY "Anyone can view incident photos" ON storage.objects FOR SELECT USING (bucket_id = 'incident-photos');

CREATE POLICY "Authenticated users can upload incident photos" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'incident-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their incident photos" ON storage.objects FOR UPDATE 
USING (bucket_id = 'incident-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can delete incident photos" ON storage.objects FOR DELETE 
USING (bucket_id = 'incident-photos' AND EXISTS (
  SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
));