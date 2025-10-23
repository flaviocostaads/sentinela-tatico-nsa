import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LastOdometerData {
  km: number;
  source: string;
  recorded_at: string;
}

interface ValidationResult {
  valid: boolean;
  message: string;
  error_code?: string;
  last_km?: number;
  last_source?: string;
  last_date?: string;
  km_diff?: number;
}

export const useVehicleOdometer = (vehicleId: string | undefined) => {
  const [lastOdometer, setLastOdometer] = useState<LastOdometerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLastOdometer = useCallback(async () => {
    if (!vehicleId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.rpc('get_last_vehicle_odometer', {
        p_vehicle_id: vehicleId
      });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setLastOdometer(data[0]);
      } else {
        setLastOdometer(null);
      }
    } catch (err: any) {
      console.error('Error fetching last odometer:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  const validateOdometer = async (newKm: number): Promise<ValidationResult> => {
    if (!vehicleId) {
      return {
        valid: false,
        message: 'Veículo não identificado',
      };
    }

    try {
      const { data, error } = await supabase.rpc('validate_odometer_reading', {
        p_vehicle_id: vehicleId,
        p_new_km: newKm
      });

      if (error) throw error;
      
      if (!data) {
        return {
          valid: false,
          message: 'Erro ao validar odômetro',
        };
      }
      
      return data as unknown as ValidationResult;
    } catch (err: any) {
      console.error('Error validating odometer:', err);
      return {
        valid: false,
        message: `Erro ao validar odômetro: ${err.message}`,
      };
    }
  };

  useEffect(() => {
    fetchLastOdometer();
  }, [fetchLastOdometer]);

  return {
    lastOdometer,
    loading,
    error,
    fetchLastOdometer,
    validateOdometer,
  };
};
