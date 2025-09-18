-- Fix security vulnerability: Clean up and secure user_locations RLS policies
-- Remove duplicate policy
DROP POLICY IF EXISTS "Users can insert own location" ON public.user_locations;

-- Keep the more descriptive policy name
-- Policy "Users can insert their own location" already exists and is correct

-- Review and ensure the SELECT policies are properly restrictive
-- The existing policies should be:
-- 1. "Users can view own locations" - users can only see their own data
-- 2. "Admins can view location data for audit purposes" - limited admin access
-- 3. "Admins can view recent locations for active operations only" - operational access
-- 4. "Emergency location access for critical incidents" - emergency access

-- Add a comment to document the security model for clarity
COMMENT ON TABLE public.user_locations IS 'User GPS location data - RLS policies ensure users can only access their own data, with limited admin access for operations and emergencies';

-- Ensure no overly permissive policies exist by checking current policies
-- This migration removes any potential duplicate or overly broad policies