-- Add created_by to rounds to track who created the round
ALTER TABLE public.rounds
ADD COLUMN IF NOT EXISTS created_by uuid;

-- Optional: backfill existing rows with user_id as creator when null
UPDATE public.rounds
SET created_by = user_id
WHERE created_by IS NULL;