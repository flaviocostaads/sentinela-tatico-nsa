// Tipos e interfaces do sistema Sentinela Tático

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operador' | 'tatico';
  avatar?: string;
  active: boolean;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  checkpoints: Checkpoint[];
  active: boolean;
  createdAt: string;
}

export interface Checkpoint {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  qrCode?: string;
  geofenceRadius?: number; // metros
  order: number;
  active: boolean;
}

export interface Round {
  id: string;
  tacticId: string;
  tacticName: string;
  clientId: string;
  clientName: string;
  vehicle: 'car' | 'motorcycle' | 'on_foot';
  status: 'pending' | 'active' | 'completed' | 'incident';
  startTime?: string;
  endTime?: string;
  startOdometer?: number;
  endOdometer?: number;
  route: RoutePoint[];
  checkpointVisits: CheckpointVisit[];
  incidents: Incident[];
  createdAt: string;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: string;
  speed?: number;
}

export interface CheckpointVisit {
  id: string;
  checkpointId: string;
  checkpointName: string;
  roundId: string;
  visitTime: string;
  duration: number; // segundos
  photos: Photo[];
  coordinates: {
    lat: number;
    lng: number;
  };
  status: 'completed' | 'skipped' | 'delayed';
}

export interface Photo {
  id: string;
  url: string;
  timestamp: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  metadata: {
    client: string;
    user: string;
    checkpoint?: string;
  };
}

export interface Incident {
  id: string;
  roundId: string;
  type: 'security' | 'maintenance' | 'emergency' | 'other';
  title: string;
  description: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  photos: Photo[];
  reportedAt: string;
  status: 'open' | 'investigating' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface DashboardStats {
  activeTactics: number;
  totalTactics: number;
  completedRounds: number;
  averageRoundTime: string;
  openIncidents: number;
  verifiedCheckpoints: number;
  vehiclesInField: {
    cars: number;
    motorcycles: number;
  };
  complianceRate: number;
}