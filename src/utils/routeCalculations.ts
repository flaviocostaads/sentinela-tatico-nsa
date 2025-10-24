/**
 * Utilitários para cálculos de rotas e análises de custos
 */

interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Calcula a distância em linha reta entre dois pontos (Haversine formula)
 * Útil para estimativas rápidas sem precisar chamar a API
 */
export const calculateStraightLineDistance = (
  point1: Coordinate,
  point2: Coordinate
): number => {
  const R = 6371; // Raio da Terra em km
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);
  
  const lat1 = toRad(point1.latitude);
  const lat2 = toRad(point2.latitude);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance; // em km
};

const toRad = (value: number): number => {
  return (value * Math.PI) / 180;
};

/**
 * Formata distância para exibição
 */
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
};

/**
 * Formata duração para exibição
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
};

/**
 * Formata custo para exibição em Real
 */
export const formatCost = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

/**
 * Calcula o tempo estimado de chegada (ETA)
 */
export const calculateETA = (durationSeconds: number): Date => {
  const now = new Date();
  return new Date(now.getTime() + durationSeconds * 1000);
};

/**
 * Formata ETA para exibição
 */
export const formatETA = (eta: Date): string => {
  return eta.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Analisa a eficiência da rota
 */
export const analyzeRouteEfficiency = (
  straightLineDistance: number, // km
  routeDistance: number // km
): {
  efficiency: number; // 0-100%
  detourPercentage: number; // % de desvio
  rating: 'excellent' | 'good' | 'moderate' | 'poor';
} => {
  const efficiency = (straightLineDistance / routeDistance) * 100;
  const detourPercentage = ((routeDistance - straightLineDistance) / straightLineDistance) * 100;

  let rating: 'excellent' | 'good' | 'moderate' | 'poor';
  if (efficiency >= 90) rating = 'excellent';
  else if (efficiency >= 80) rating = 'good';
  else if (efficiency >= 70) rating = 'moderate';
  else rating = 'poor';

  return {
    efficiency: parseFloat(efficiency.toFixed(2)),
    detourPercentage: parseFloat(detourPercentage.toFixed(2)),
    rating
  };
};

/**
 * Converte tipo de veículo do sistema para perfil do Mapbox
 */
export const getMapboxProfile = (
  vehicleType: 'car' | 'motorcycle' | 'on_foot'
): 'mapbox.driving' | 'mapbox.walking' | 'mapbox.cycling' => {
  switch (vehicleType) {
    case 'car':
    case 'motorcycle':
      return 'mapbox.driving';
    case 'on_foot':
      return 'mapbox.walking';
    default:
      return 'mapbox.driving';
  }
};

/**
 * Calcula estatísticas de múltiplas rotas
 */
export const calculateRouteStatistics = (routes: Array<{
  distance: number;
  duration: number;
}>): {
  totalDistance: number;
  totalDuration: number;
  averageDistance: number;
  averageDuration: number;
  shortestRoute: number;
  longestRoute: number;
} => {
  const distances = routes.map(r => r.distance);
  const durations = routes.map(r => r.duration);

  return {
    totalDistance: distances.reduce((a, b) => a + b, 0),
    totalDuration: durations.reduce((a, b) => a + b, 0),
    averageDistance: distances.reduce((a, b) => a + b, 0) / distances.length,
    averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    shortestRoute: Math.min(...distances),
    longestRoute: Math.max(...distances)
  };
};

/**
 * Valida se as coordenadas são válidas
 */
export const validateCoordinates = (coord: Coordinate): boolean => {
  return (
    coord.latitude >= -90 &&
    coord.latitude <= 90 &&
    coord.longitude >= -180 &&
    coord.longitude <= 180
  );
};

/**
 * Calcula o custo operacional total de uma ronda
 */
export const calculateOperationalCost = (params: {
  distanceKm: number;
  durationHours: number;
  fuelCost: number;
  hourlyWage?: number; // Salário por hora do tático
  maintenanceCostPerKm?: number; // Custo de manutenção por km
  vehicleDepreciationPerKm?: number; // Depreciação por km
}): {
  fuelCost: number;
  laborCost: number;
  maintenanceCost: number;
  depreciationCost: number;
  totalCost: number;
} => {
  const {
    distanceKm,
    durationHours,
    fuelCost,
    hourlyWage = 15, // R$ 15/hora padrão
    maintenanceCostPerKm = 0.30, // R$ 0,30/km padrão
    vehicleDepreciationPerKm = 0.50 // R$ 0,50/km padrão
  } = params;

  const laborCost = durationHours * hourlyWage;
  const maintenanceCost = distanceKm * maintenanceCostPerKm;
  const depreciationCost = distanceKm * vehicleDepreciationPerKm;
  const totalCost = fuelCost + laborCost + maintenanceCost + depreciationCost;

  return {
    fuelCost: parseFloat(fuelCost.toFixed(2)),
    laborCost: parseFloat(laborCost.toFixed(2)),
    maintenanceCost: parseFloat(maintenanceCost.toFixed(2)),
    depreciationCost: parseFloat(depreciationCost.toFixed(2)),
    totalCost: parseFloat(totalCost.toFixed(2))
  };
};
