import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FuelPrice {
  id: string;
  fuel_type: string;
  price_per_liter: number;
  currency: string;
  active: boolean;
}

export const useFuelConfig = () => {
  const [fuelPrices, setFuelPrices] = useState<FuelPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchFuelPrices();
  }, []);

  const fetchFuelPrices = async () => {
    try {
      const { data, error } = await supabase
        .from('fuel_price_config')
        .select('*')
        .eq('active', true)
        .order('fuel_type');
      
      if (error) throw error;
      setFuelPrices(data || []);
    } catch (error) {
      console.error('Error fetching fuel prices:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar preços de combustível",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getFuelPrice = (fuelType: string): number => {
    const config = fuelPrices.find(f => f.fuel_type === fuelType);
    return config?.price_per_liter || 5.50;
  };

  const updateFuelPrice = async (fuelType: string, newPrice: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('fuel_price_config')
        .update({ 
          price_per_liter: newPrice,
          last_updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('fuel_type', fuelType);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Preço atualizado para R$ ${newPrice.toFixed(2)}/L`
      });

      fetchFuelPrices();
    } catch (error) {
      console.error('Error updating fuel price:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar preço",
        variant: "destructive"
      });
    }
  };

  return {
    fuelPrices,
    loading,
    getFuelPrice,
    updateFuelPrice,
    refetch: fetchFuelPrices
  };
};
