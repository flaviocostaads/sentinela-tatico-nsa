-- Criar bucket para fotos de inspeção (se não existir)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('inspection-photos', 'inspection-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Policies para upload de fotos de inspeção
CREATE POLICY "Users can upload inspection photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'inspection-photos' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view own inspection photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'inspection-photos' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Admins can view all inspection photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'inspection-photos' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can delete own inspection photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'inspection-photos' AND
  auth.uid() IS NOT NULL
);