import { useState } from 'react';
import { useSecureMapbox } from './useSecureMapbox';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface RouteStep {
  maneuver: {
    type: string;
    instruction: string;
    location: {
      type: string;
      coordinates: [number, number];
    };
  };
  distance: number;
  duration: number;
  way_name: string;
  direction?: string;
  heading?: number;
}

interface RouteResponse {
  distance: number; // metros
  duration: number; // segundos
  summary: string;
  geometry: {
    type: string;
    coordinates: number[][];
  };
  steps?: RouteStep[];
}

interface DirectionsResponse {
  origin: any;
  destination: any;
  waypoints: any[];
  routes: RouteResponse[];
}

type ProfileType = 'mapbox.driving' | 'mapbox.walking' | 'mapbox.cycling';

export const useMapboxDirections = () => {
  const { token } = useSecureMapbox();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Calcula a rota entre dois ou mais pontos
   */
  const calculateRoute = async (
    waypoints: Coordinate[],
    profile: ProfileType = 'mapbox.driving',
    options?: {
      alternatives?: boolean;
      steps?: boolean;
      geometry?: 'geojson' | 'polyline' | 'false';
    }
  ): Promise<DirectionsResponse | null> => {
    if (!token) {
      setError('Token do Mapbox não disponível');
      return null;
    }

    if (waypoints.length < 2) {
      setError('É necessário pelo menos 2 pontos para calcular a rota');
      return null;
    }

    if (waypoints.length > 25) {
      setError('Máximo de 25 pontos permitidos');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      // Formatar coordenadas para a API: longitude,latitude
      const coordinatesString = waypoints
        .map(wp => `${wp.longitude},${wp.latitude}`)
        .join(';');

      // Construir URL com parâmetros
      const params = new URLSearchParams({
        alternatives: options?.alternatives ? 'true' : 'false',
        steps: options?.steps ? 'true' : 'false',
        geometry: options?.geometry || 'geojson',
      });

      const url = `https://api.mapbox.com/v4/directions/${profile}/${coordinatesString}.json?${params}&access_token=${token}`;

      console.log('Calculando rota:', { waypoints: waypoints.length, profile, url });

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
      }

      const data: DirectionsResponse = await response.json();

      console.log('Rota calculada:', {
        distance: data.routes[0]?.distance,
        duration: data.routes[0]?.duration,
        routes: data.routes.length
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao calcular rota';
      console.error('Erro ao calcular rota:', err);
      setError(errorMessage);
      
      toast({
        title: "Erro ao calcular rota",
        description: errorMessage,
        variant: "destructive",
      });
      
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calcula a distância total de uma ronda (todos os checkpoints)
   */
  const calculateRoundDistance = async (
    checkpoints: Coordinate[],
    profile: ProfileType = 'mapbox.driving'
  ): Promise<{
    totalDistance: number; // metros
    totalDuration: number; // segundos
    distanceKm: number;
    durationMinutes: number;
    durationHours: number;
    routes: RouteResponse[];
  } | null> => {
    const result = await calculateRoute(checkpoints, profile, {
      alternatives: false,
      steps: false,
      geometry: 'geojson'
    });

    if (!result || !result.routes || result.routes.length === 0) {
      return null;
    }

    const route = result.routes[0];
    const totalDistance = route.distance;
    const totalDuration = route.duration;

    return {
      totalDistance,
      totalDuration,
      distanceKm: totalDistance / 1000,
      durationMinutes: totalDuration / 60,
      durationHours: totalDuration / 3600,
      routes: result.routes
    };
  };

  /**
   * Calcula a distância entre dois pontos específicos
   */
  const calculateDistanceBetweenPoints = async (
    origin: Coordinate,
    destination: Coordinate,
    profile: ProfileType = 'mapbox.driving'
  ): Promise<{
    distance: number; // metros
    duration: number; // segundos
    distanceKm: number;
    durationMinutes: number;
    summary: string;
    geometry?: any;
  } | null> => {
    const result = await calculateRoute([origin, destination], profile, {
      alternatives: false,
      steps: false,
      geometry: 'geojson'
    });

    if (!result || !result.routes || result.routes.length === 0) {
      return null;
    }

    const route = result.routes[0];

    return {
      distance: route.distance,
      duration: route.duration,
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
      summary: route.summary,
      geometry: route.geometry
    };
  };

  /**
   * Calcula o custo estimado da ronda baseado na distância
   * ATUALIZADO: Agora busca preços e consumo dinâmicos do banco de dados
   */
  const calculateRoundCost = async (
    distanceKm: number,
    vehicleId?: string,
    vehicleType?: 'car' | 'motorcycle'
  ): Promise<{
    fuelConsumption: number; // litros
    estimatedCost: number; // R$
    costPerKm: number;
    fuelPrice: number;
    vehicleEfficiency: number;
  } | null> => {
    try {
      let fuelPrice = 5.50; // Fallback
      let vehicleEfficiency = vehicleType === 'motorcycle' ? 30 : 10; // Fallback
      let fuelType = 'gasoline';

      // Se vehicleId fornecido, buscar dados reais do veículo
      if (vehicleId) {
        const { data: vehicle, error } = await supabase
          .from('vehicles')
          .select('fuel_efficiency, fuel_type')
          .eq('id', vehicleId)
          .maybeSingle();

        if (!error && vehicle) {
          vehicleEfficiency = vehicle.fuel_efficiency || vehicleEfficiency;
          fuelType = vehicle.fuel_type || fuelType;
        }
      }

      // Buscar preço atual do combustível
      const { data: fuelConfig } = await supabase
        .from('fuel_price_config')
        .select('price_per_liter')
        .eq('fuel_type', fuelType)
        .eq('active', true)
        .maybeSingle();

      if (fuelConfig) {
        fuelPrice = fuelConfig.price_per_liter;
      }

      const fuelConsumption = distanceKm / vehicleEfficiency;
      const estimatedCost = fuelConsumption * fuelPrice;
      const costPerKm = estimatedCost / distanceKm;

      return {
        fuelConsumption: parseFloat(fuelConsumption.toFixed(2)),
        estimatedCost: parseFloat(estimatedCost.toFixed(2)),
        costPerKm: parseFloat(costPerKm.toFixed(2)),
        fuelPrice,
        vehicleEfficiency
      };
    } catch (error) {
      console.error('Error calculating round cost:', error);
      return null;
    }
  };

  /**
   * Obtém instruções detalhadas da rota
   */
  const getRouteInstructions = async (
    waypoints: Coordinate[],
    profile: ProfileType = 'mapbox.driving'
  ): Promise<RouteStep[] | null> => {
    const result = await calculateRoute(waypoints, profile, {
      alternatives: false,
      steps: true,
      geometry: 'geojson'
    });

    if (!result || !result.routes || result.routes.length === 0) {
      return null;
    }

    return result.routes[0].steps || null;
  };

  return {
    calculateRoute,
    calculateRoundDistance,
    calculateDistanceBetweenPoints,
    calculateRoundCost,
    getRouteInstructions,
    loading,
    error
  };
};
