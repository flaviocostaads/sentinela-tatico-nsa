-- Enable tactical users to create rounds by adding proper policies
DROP POLICY IF EXISTS "Taticos can create and update their own rounds" ON public.rounds;

-- Create new policy that allows tactical users to create rounds
CREATE POLICY "Taticos can create rounds"
ON public.rounds
FOR INSERT
WITH CHECK (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM profiles
  WHERE user_id = auth.uid() AND role IN ('admin', 'operador', 'tatico')
));

-- Ensure user_locations table has proper foreign key to rounds
ALTER TABLE public.user_locations 
DROP CONSTRAINT IF EXISTS user_locations_round_id_fkey;

ALTER TABLE public.user_locations 
ADD CONSTRAINT user_locations_round_id_fkey 
FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE SET NULL;

-- Enable realtime for user_locations table
ALTER TABLE public.user_locations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;