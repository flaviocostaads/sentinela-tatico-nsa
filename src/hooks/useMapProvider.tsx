import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type MapProvider = 'mapbox' | 'google';

interface MapProviderConfig {
  provider: MapProvider;
  googleMapsApiKey?: string;
}

export const useMapProvider = () => {
  const [provider, setProvider] = useState<MapProvider>('mapbox');
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');
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
        .select('map_provider, google_maps_api_key')
        .single();

      if (error) {
        console.error('Error fetching map provider config:', error);
        return;
      }

      if (data) {
        setProvider((data.map_provider as MapProvider) || 'mapbox');
        setGoogleMapsApiKey(data.google_maps_api_key || '');
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateMapProvider = async (newProvider: MapProvider, apiKey?: string) => {
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({
          map_provider: newProvider,
          ...(apiKey && { google_maps_api_key: apiKey })
        })
        .eq('id', (await supabase.from('company_settings').select('id').single()).data?.id);

      if (error) throw error;

      setProvider(newProvider);
      if (apiKey) setGoogleMapsApiKey(apiKey);

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
    loading,
    updateMapProvider,
    refreshConfig: fetchMapProviderConfig,
  };
};
