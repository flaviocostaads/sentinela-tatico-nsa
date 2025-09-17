-- Clean up orphaned user_locations records first
UPDATE public.user_locations 
SET round_id = NULL 
WHERE round_id IS NOT NULL 
  AND round_id NOT IN (SELECT id FROM public.rounds);

-- Now add the foreign key constraint safely
ALTER TABLE public.user_locations 
ADD CONSTRAINT user_locations_round_id_fkey 
FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE SET NULL;

-- Enable tactical users to create rounds by updating the policy
DROP POLICY IF EXISTS "Taticos can create and update their own rounds" ON public.rounds;
DROP POLICY IF EXISTS "Taticos can create their own rounds" ON public.rounds;

CREATE POLICY "Taticos can create rounds"
ON public.rounds
FOR INSERT
WITH CHECK (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM profiles
  WHERE user_id = auth.uid() AND role IN ('admin', 'operador', 'tatico')
));

-- Enable realtime for user_locations table
ALTER TABLE public.user_locations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;