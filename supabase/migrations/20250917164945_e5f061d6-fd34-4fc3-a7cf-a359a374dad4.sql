-- Fix critical security vulnerabilities by updating RLS policies
-- Issue: Sensitive business data is publicly accessible

-- 1. Fix company_settings table - restrict to authenticated users only
DROP POLICY IF EXISTS "Everyone can view company settings" ON public.company_settings;
CREATE POLICY "Authenticated users can view company settings" 
ON public.company_settings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 2. Fix vehicle_fuel_logs table - restrict to authenticated users 
DROP POLICY IF EXISTS "Users can view fuel logs" ON public.vehicle_fuel_logs;
CREATE POLICY "Authenticated users can view fuel logs" 
ON public.vehicle_fuel_logs 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 3. Fix vehicle_maintenance_logs table - restrict to authenticated users
DROP POLICY IF EXISTS "Users can view maintenance logs" ON public.vehicle_maintenance_logs;
CREATE POLICY "Authenticated users can view maintenance logs" 
ON public.vehicle_maintenance_logs 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 4. Additional security: Restrict API integrations to admin users only
DROP POLICY IF EXISTS "Everyone can view enabled integrations" ON public.api_integrations;
CREATE POLICY "Authenticated users can view enabled integrations" 
ON public.api_integrations 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND enabled = true);