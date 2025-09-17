-- Add multiple logo fields to company_settings table
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS header_logo_url text,
ADD COLUMN IF NOT EXISTS login_logo_url text,
ADD COLUMN IF NOT EXISTS report_logo_url text,
ADD COLUMN IF NOT EXISTS qr_logo_url text,
ADD COLUMN IF NOT EXISTS favicon_url text;

-- Update existing logo_url to be report_logo_url if not null
UPDATE public.company_settings 
SET report_logo_url = logo_url 
WHERE logo_url IS NOT NULL AND report_logo_url IS NULL;