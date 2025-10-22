-- Allow NULL values for vehicle column since vehicle selection happens when round is started
ALTER TABLE public.rounds 
ALTER COLUMN vehicle DROP NOT NULL;