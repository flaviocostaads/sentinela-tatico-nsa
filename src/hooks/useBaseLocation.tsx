import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BaseLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export const useBaseLocation = () => {
  const [base, setBase] = useState<BaseLocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBase();
  }, []);

  const fetchBase = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, address, lat, lng')
        .eq('is_base', true)
        .eq('active', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching base:', error);
        setBase(null);
      } else {
        setBase(data);
      }
    } catch (error) {
      console.error('Error fetching base:', error);
      setBase(null);
    } finally {
      setLoading(false);
    }
  };

  return { base, loading, refetch: fetchBase };
};
