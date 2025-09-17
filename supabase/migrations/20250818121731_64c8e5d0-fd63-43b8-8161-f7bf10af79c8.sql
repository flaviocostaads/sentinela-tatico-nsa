-- Fix infinite recursion in profiles RLS policies
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a helper function to check admin role without RLS recursion
CREATE OR REPLACE FUNCTION public.check_admin_role(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = user_uuid AND role = 'admin'::user_role
  );
$$;

-- Recreate policies without recursion
CREATE POLICY "Users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all profiles" 
ON public.profiles 
FOR ALL 
USING (public.check_admin_role(auth.uid()));

-- Fix other table policies that might have similar issues
DROP POLICY IF EXISTS "Admins and operadores can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and operadores can manage checkpoints" ON public.checkpoints;
DROP POLICY IF EXISTS "Admins and operadores can manage all rounds" ON public.rounds;

-- Recreate without recursion
CREATE POLICY "Admins and operadores can manage clients" 
ON public.clients 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = ANY (ARRAY['admin'::user_role, 'operador'::user_role])
  )
);

CREATE POLICY "Admins and operadores can manage checkpoints" 
ON public.checkpoints 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = ANY (ARRAY['admin'::user_role, 'operador'::user_role])
  )
);

CREATE POLICY "Admins and operadores can manage all rounds" 
ON public.rounds 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = ANY (ARRAY['admin'::user_role, 'operador'::user_role])
  )
);

-- Enable realtime for all tables
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER TABLE public.checkpoints REPLICA IDENTITY FULL;
ALTER TABLE public.rounds REPLICA IDENTITY FULL;
ALTER TABLE public.route_points REPLICA IDENTITY FULL;
ALTER TABLE public.checkpoint_visits REPLICA IDENTITY FULL;
ALTER TABLE public.photos REPLICA IDENTITY FULL;
ALTER TABLE public.incidents REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checkpoints;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.route_points;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checkpoint_visits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;