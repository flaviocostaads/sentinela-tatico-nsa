import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MapboxTokenResponse {
  token?: string;
  success: boolean;
  error?: string;
}

export const useSecureMapbox = () => {
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchMapboxToken();
  }, []);

  const fetchMapboxToken = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Usuário não autenticado');
      }

      // Call the secure edge function to get the Mapbox token
      const { data, error } = await supabase.functions.invoke('get-mapbox-token', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      const response = data as MapboxTokenResponse;
      
      if (!response.success || !response.token) {
        throw new Error(response.error || 'Falha ao obter token do Mapbox');
      }

      setToken(response.token);
    } catch (err) {
      console.error('Error fetching Mapbox token:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar token do Mapbox';
      setError(errorMessage);
      
      // Fallback to manual token input
      toast({
        title: "Erro no token do Mapbox",
        description: "Configure manualmente seu token do Mapbox",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetToken = () => {
    setToken('');
    setError(null);
    fetchMapboxToken();
  };

  return {
    token,
    loading,
    error,
    resetToken,
  };
};