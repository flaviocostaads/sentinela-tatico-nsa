-- Add map provider configuration to company_settings
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS map_provider TEXT DEFAULT 'mapbox' CHECK (map_provider IN ('mapbox', 'google'));

-- Add Google Maps API key storage
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS google_maps_api_key TEXT;

COMMENT ON COLUMN company_settings.map_provider IS 'Map provider: mapbox or google';
COMMENT ON COLUMN company_settings.google_maps_api_key IS 'Encrypted Google Maps API key';