import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type MapProvider = 'mapbox' | 'google';

interface MapProviderConfig {
  provider: MapProvider;
  googleMapsApiKey?: string;
  defaultCity?: string;
}

export const useMapProvider = () => {
  const [provider, setProvider] = useState<MapProvider>('mapbox');
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');
  const [defaultCity, setDefaultCity] = useState<string>('São Paulo, SP, Brasil');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchMapProviderConfig();
  }, []);

  const fetchMapProviderConfig = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('company_settings')
        .select('id, map_provider, google_maps_api_key, default_city')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching map provider config:', error);
        return;
      }

      if (data) {
        setProvider((data.map_provider as MapProvider) || 'mapbox');
        setGoogleMapsApiKey(data.google_maps_api_key || '');
        setDefaultCity(data.default_city || 'São Paulo, SP, Brasil');
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateMapProvider = async (newProvider: MapProvider, apiKey?: string, city?: string) => {
    try {
      // Get the first company_settings record
      const { data: settings, error: fetchError } = await supabase
        .from('company_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let settingsId: string;

      if (!settings) {
        // Create a new settings record if none exists
        const { data: newSettings, error: createError } = await supabase
          .from('company_settings')
          .insert({
            map_provider: newProvider,
            ...(apiKey && { google_maps_api_key: apiKey }),
            ...(city && { default_city: city })
          })
          .select('id')
          .single();

        if (createError) throw createError;
        settingsId = newSettings.id;
      } else {
        // Update existing settings
        settingsId = settings.id;
        const { error: updateError } = await supabase
          .from('company_settings')
          .update({
            map_provider: newProvider,
            ...(apiKey && { google_maps_api_key: apiKey }),
            ...(city && { default_city: city })
          })
          .eq('id', settingsId);

        if (updateError) throw updateError;
      }

      setProvider(newProvider);
      if (apiKey) setGoogleMapsApiKey(apiKey);
      if (city) setDefaultCity(city);

      toast({
        title: "Provedor de mapa atualizado",
        description: `Usando ${newProvider === 'mapbox' ? 'Mapbox' : 'Google Maps'}`,
      });

      // Refresh the page to apply changes
      window.location.reload();
    } catch (err) {
      console.error('Error updating map provider:', err);
      toast({
        title: "Erro",
        description: "Erro ao atualizar provedor de mapa",
        variant: "destructive",
      });
    }
  };

  return {
    provider,
    googleMapsApiKey,
    defaultCity,
    loading,
    updateMapProvider,
    refreshConfig: fetchMapProviderConfig,
  };
};
