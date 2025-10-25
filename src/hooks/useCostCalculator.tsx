import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CostCalculationInput {
  calculation_name: string;
  client_id?: string;
  client_name: string;
  vehicle_type: 'car' | 'motorcycle';
  vehicle_id?: string;
  fuel_type: string;
  fuel_price_per_liter: number;
  fuel_efficiency: number;
  distance_base_to_client: number;
  rounds_per_day: number;
  time_per_round: number;
  days_per_month: number;
  tactical_salary: number;
  hourly_rate?: number;
  other_monthly_costs?: number;
  profit_margin?: number;
  base_location?: any;
  client_location?: any;
  route_geometry?: any;
  notes?: string;
}

export interface CostCalculationResult {
  daily_distance: number;
  monthly_distance: number;
  daily_fuel_cost: number;
  monthly_fuel_cost: number;
  daily_labor_cost: number;
  monthly_labor_cost: number;
  total_monthly_cost: number;
  suggested_price: number;
  fuel_consumption_monthly: number;
  cost_per_km: number;
  hourly_rate_calculated: number;
}

export const useCostCalculator = () => {
  const [calculations, setCalculations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Função principal de cálculo - IDA E VOLTA
  const calculateCosts = useCallback((input: CostCalculationInput): CostCalculationResult => {
    // 1. Cálculos de Distância (IDA + VOLTA)
    const roundTripDistance = input.distance_base_to_client * 2; // IDA + VOLTA
    const daily_distance = roundTripDistance * input.rounds_per_day;
    const monthly_distance = daily_distance * input.days_per_month;
    
    // 2. Cálculos de Combustível
    const daily_fuel_liters = daily_distance / input.fuel_efficiency;
    const monthly_fuel_liters = monthly_distance / input.fuel_efficiency;
    const daily_fuel_cost = daily_fuel_liters * input.fuel_price_per_liter;
    const monthly_fuel_cost = monthly_fuel_liters * input.fuel_price_per_liter;
    
    // 3. Cálculos de Mão de Obra
    const hourly_rate = input.hourly_rate || (input.tactical_salary / 220);
    const daily_labor_hours = input.time_per_round * input.rounds_per_day;
    const daily_labor_cost = hourly_rate * daily_labor_hours;
    const monthly_labor_cost = daily_labor_cost * input.days_per_month;
    
    // 4. Custo Total
    const total_monthly_cost = monthly_fuel_cost + monthly_labor_cost + (input.other_monthly_costs || 0);
    
    // 5. Valor Sugerido com Margem
    const profit_margin = input.profit_margin || 30;
    const suggested_price = total_monthly_cost * (1 + profit_margin / 100);
    
    // 6. Métricas Adicionais
    const cost_per_km = total_monthly_cost / monthly_distance;
    
    return {
      daily_distance,
      monthly_distance,
      daily_fuel_cost,
      monthly_fuel_cost,
      daily_labor_cost,
      monthly_labor_cost,
      total_monthly_cost,
      suggested_price,
      fuel_consumption_monthly: monthly_fuel_liters,
      cost_per_km,
      hourly_rate_calculated: hourly_rate
    };
  }, []);

  // Salvar cálculo no banco
  const saveCalculation = async (input: CostCalculationInput): Promise<any> => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const results = calculateCosts(input);
      
      const { data, error } = await supabase
        .from('cost_calculations')
        .insert({
          ...input,
          ...results,
          created_by: user.id
        })
        .select()
        .single();
      
      if (error) throw error;
      
      toast({
        title: "Cálculo Salvo",
        description: `"${input.calculation_name}" salvo com sucesso!`
      });
      
      await fetchCalculations();
      return data;
    } catch (error: any) {
      console.error('Error saving calculation:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar cálculo",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Buscar cálculos
  const fetchCalculations = useCallback(async (filters?: any) => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('cost_calculations')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filters?.client_id) {
        query = query.eq('client_id', filters.client_id);
      }
      
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      setCalculations(data || []);
      return data;
    } catch (error) {
      console.error('Error fetching calculations:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar cálculo por ID
  const getCalculationById = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('cost_calculations')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching calculation:', error);
      return null;
    }
  };

  // Atualizar status
  const updateCalculationStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('cost_calculations')
        .update({ status })
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Status Atualizado",
        description: `Cálculo marcado como "${status}"`
      });
      
      await fetchCalculations();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar status",
        variant: "destructive"
      });
    }
  };

  // Deletar cálculo
  const deleteCalculation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('cost_calculations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Cálculo Excluído",
        description: "Cálculo removido com sucesso"
      });
      
      await fetchCalculations();
    } catch (error: any) {
      console.error('Error deleting calculation:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir cálculo",
        variant: "destructive"
      });
    }
  };

  return {
    calculations,
    loading,
    calculateCosts,
    saveCalculation,
    fetchCalculations,
    getCalculationById,
    updateCalculationStatus,
    deleteCalculation
  };
};
