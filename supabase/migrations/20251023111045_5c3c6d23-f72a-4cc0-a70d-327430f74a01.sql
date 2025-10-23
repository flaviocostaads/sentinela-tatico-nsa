-- Add signature_data field to checkpoint_visits table
ALTER TABLE public.checkpoint_visits
ADD COLUMN IF NOT EXISTS signature_data TEXT;

COMMENT ON COLUMN public.checkpoint_visits.signature_data IS 'Base64 encoded signature image when required by checkpoint';