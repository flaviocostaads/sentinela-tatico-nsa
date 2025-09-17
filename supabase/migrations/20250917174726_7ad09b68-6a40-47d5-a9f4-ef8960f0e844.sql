-- Fix RLS policies for profiles table to ensure proper access control
-- Drop existing problematic policies and recreate them with proper security

-- First, drop all existing policies for profiles table
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view only their own profile" ON public.profiles;

-- Create secure policies for profiles table
-- Users can only view their own profile
CREATE POLICY "Users can view own profile only"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (check_admin_role(auth.uid()));

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Only admins can manage all profiles
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
USING (check_admin_role(auth.uid()));

-- Fix user_locations table policies
DROP POLICY IF EXISTS "Admins and operadores can view all locations" ON public.user_locations;
DROP POLICY IF EXISTS "Round-assigned users can view recent round locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users can view their own locations" ON public.user_locations;

-- Create secure policies for user_locations
-- Users can only view their own locations
CREATE POLICY "Users can view own locations only"
ON public.user_locations
FOR SELECT
USING (auth.uid() = user_id);

-- Admins and operators can view all locations
CREATE POLICY "Admins and operators can view all locations"
ON public.user_locations
FOR SELECT
USING (check_admin_or_operator_role(auth.uid()));

-- Round-assigned users can view locations for rounds they're assigned to (within 24 hours)
CREATE POLICY "Round assigned users can view round locations"
ON public.user_locations
FOR SELECT
USING (
  round_id IS NOT NULL 
  AND recorded_at >= (now() - interval '24 hours')
  AND is_user_assigned_to_round(round_id, auth.uid())
);

-- Users can insert their own location
CREATE POLICY "Users can insert own location"
ON public.user_locations
FOR INSERT
WITH CHECK (auth.uid() = user_id);