-- Add default_city column to company_settings
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS default_city text DEFAULT 'São Paulo, SP, Brasil';

-- Add comment
COMMENT ON COLUMN public.company_settings.default_city IS 'Cidade padrão para centralizar o mapa';