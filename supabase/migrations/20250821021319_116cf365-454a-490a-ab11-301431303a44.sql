-- Add manual_code column to checkpoints table to link QR codes to checkpoints
ALTER TABLE public.checkpoints 
ADD COLUMN IF NOT EXISTS manual_code text UNIQUE;