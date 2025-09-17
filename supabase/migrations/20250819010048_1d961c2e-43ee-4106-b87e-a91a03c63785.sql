-- Add alternative_email column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN alternative_email text;