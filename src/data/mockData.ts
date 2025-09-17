import { User, Client, Checkpoint, Round, CheckpointVisit, Incident, DashboardStats, Photo } from '@/types';

// Usuários mocados
export const mockUsers: User[] = [
  {
    id: 'user-001',
    name: 'José Silva',
    email: 'jose.silva@nsa.com.br',
    role: 'tatico',
    active: true,
    createdAt: '2024-01-15T08:00:00Z'
  },
  {
    id: 'user-002', 
    name: 'Maria Santos',
    email: 'maria.santos@nsa.com.br',
    role: 'tatico',
    active: true,
    createdAt: '2024-01-10T08:00:00Z'
  },
  {
    id: 'user-003',
    name: 'Carlos Oliveira',
    email: 'carlos.oliveira@nsa.com.br', 
    role: 'tatico',
    active: true,
    createdAt: '2024-02-01T08:00:00Z'
  },
  {
    id: 'user-004',
    name: 'Admin NOC',
    email: 'admin@nsa.com.br',
    role: 'admin',
    active: true,
    createdAt: '2024-01-01T08:00:00Z'
  }
];

// Clientes mocados
export const mockClients: Client[] = [
  {
    id: 'client-001',
    name: 'Shopping Center Norte',
    address: 'Av. Presidente Vargas, 123 - Centro',
    coordinates: { lat: -23.550520, lng: -46.633308 },
    checkpoints: [],
    active: true,
    createdAt: '2024-01-05T10:00:00Z'
  },
  {
    id: 'client-002',
    name: 'Condomínio Residencial Villa',
    address: 'Rua das Flores, 456 - Jardim América',
    coordinates: { lat: -23.561684, lng: -46.655981 },
    checkpoints: [],
    active: true,
    createdAt: '2024-01-08T14:00:00Z'
  },
  {
    id: 'client-003',
    name: 'Empresa Logística Express',
    address: 'Rod. Castello Branco, km 32 - Industrial',
    coordinates: { lat: -23.532151, lng: -46.721167 },
    checkpoints: [],
    active: true,
    createdAt: '2024-01-12T09:00:00Z'
  }
];

// Checkpoints mocados
export const mockCheckpoints: Checkpoint[] = [
  {
    id: 'checkpoint-001',
    clientId: 'client-001',
    name: 'Portaria Principal',
    description: 'Entrada principal do shopping',
    coordinates: { lat: -23.550520, lng: -46.633308 },
    qrCode: 'QR-SHOP-001',
    geofenceRadius: 50,
    order: 1,
    active: true
  },
  {
    id: 'checkpoint-002',
    clientId: 'client-001', 
    name: 'Estacionamento',
    description: 'Área de estacionamento coberto',
    coordinates: { lat: -23.550712, lng: -46.633156 },
    qrCode: 'QR-SHOP-002',
    geofenceRadius: 75,
    order: 2,
    active: true
  },
  {
    id: 'checkpoint-003',
    clientId: 'client-002',
    name: 'Portaria Residencial',
    description: 'Guarita principal do condomínio',
    coordinates: { lat: -23.561684, lng: -46.655981 },
    qrCode: 'QR-COND-001',
    geofenceRadius: 30,
    order: 1,
    active: true
  },
  {
    id: 'checkpoint-004',
    clientId: 'client-003',
    name: 'Depósito Principal',
    description: 'Área de carga e descarga',
    coordinates: { lat: -23.532151, lng: -46.721167 },
    qrCode: 'QR-LOG-001',
    geofenceRadius: 100,
    order: 1,
    active: true
  }
];

// Fotos mocadas
export const mockPhotos: Photo[] = [
  {
    id: 'photo-001',
    url: '/placeholder.svg',
    timestamp: '2024-08-16T14:35:00Z',
    coordinates: { lat: -23.550520, lng: -46.633308 },
    metadata: {
      client: 'Shopping Center Norte',
      user: 'José Silva',
      checkpoint: 'Portaria Principal'
    }
  }
];

// Rondas mocadas
export const mockRounds: Round[] = [
  {
    id: 'round-001',
    tacticId: 'user-001',
    tacticName: 'José Silva',
    clientId: 'client-001',
    clientName: 'Shopping Center Norte',
    vehicle: 'car',
    status: 'active',
    startTime: '2024-08-16T14:30:00Z',
    startOdometer: 45230,
    route: [
      { lat: -23.550000, lng: -46.630000, timestamp: '2024-08-16T14:30:00Z', speed: 25 },
      { lat: -23.550520, lng: -46.633308, timestamp: '2024-08-16T14:35:00Z', speed: 0 }
    ],
    checkpointVisits: [],
    incidents: [],
    createdAt: '2024-08-16T14:30:00Z'
  },
  {
    id: 'round-002',
    tacticId: 'user-002',
    tacticName: 'Maria Santos',
    clientId: 'client-002',
    clientName: 'Condomínio Residencial Villa',
    vehicle: 'motorcycle',
    status: 'active',
    startTime: '2024-08-16T14:45:00Z',
    startOdometer: 12850,
    route: [],
    checkpointVisits: [],
    incidents: [],
    createdAt: '2024-08-16T14:45:00Z'
  },
  {
    id: 'round-003',
    tacticId: 'user-003',
    tacticName: 'Carlos Oliveira',
    clientId: 'client-003',
    clientName: 'Empresa Logística Express',
    vehicle: 'car',
    status: 'incident',
    startTime: '2024-08-16T15:00:00Z',
    startOdometer: 67890,
    route: [],
    checkpointVisits: [],
    incidents: [
      {
        id: 'incident-001',
        roundId: 'round-003',
        type: 'security',
        title: 'Portão de acesso aberto',
        description: 'Encontrado portão lateral do depósito aberto sem vigilância',
        coordinates: { lat: -23.532151, lng: -46.721167 },
        photos: mockPhotos,
        reportedAt: '2024-08-16T15:15:00Z',
        status: 'investigating',
        priority: 'medium'
      }
    ],
    createdAt: '2024-08-16T15:00:00Z'
  }
];

// Visitas a checkpoints mocadas
export const mockCheckpointVisits: CheckpointVisit[] = [
  {
    id: 'visit-001',
    checkpointId: 'checkpoint-001',
    checkpointName: 'Portaria Principal',
    roundId: 'round-001',
    visitTime: '2024-08-16T14:35:00Z',
    duration: 180, // 3 minutos
    photos: mockPhotos,
    coordinates: { lat: -23.550520, lng: -46.633308 },
    status: 'completed'
  }
];

// Stats do dashboard
export const mockDashboardStats: DashboardStats = {
  activeTactics: 8,
  totalTactics: 12,
  completedRounds: 24,
  averageRoundTime: '2h 15m',
  openIncidents: 2,
  verifiedCheckpoints: 156,
  vehiclesInField: {
    cars: 3,
    motorcycles: 2
  },
  complianceRate: 98.5
};

// Estado global mocado para simular dados em tempo real
export class MockDataStore {
  private static instance: MockDataStore;
  
  public users = mockUsers;
  public clients = mockClients;
  public checkpoints = mockCheckpoints;
  public rounds = mockRounds;
  public checkpointVisits = mockCheckpointVisits;
  public incidents: Incident[] = [];
  public stats = mockDashboardStats;

  static getInstance(): MockDataStore {
    if (!MockDataStore.instance) {
      MockDataStore.instance = new MockDataStore();
    }
    return MockDataStore.instance;
  }

  // Métodos para simular operações
  updateRoundStatus(roundId: string, status: Round['status']) {
    const round = this.rounds.find(r => r.id === roundId);
    if (round) {
      round.status = status;
      if (status === 'completed') {
        round.endTime = new Date().toISOString();
      }
    }
  }

  addCheckpointVisit(visit: CheckpointVisit) {
    this.checkpointVisits.push(visit);
  }

  addIncident(incident: Incident) {
    this.incidents.push(incident);
  }

  getActiveRounds(): Round[] {
    return this.rounds.filter(r => r.status === 'active' || r.status === 'incident');
  }

  getRoundsByTactic(tacticId: string): Round[] {
    return this.rounds.filter(r => r.tacticId === tacticId);
  }

  getClientCheckpoints(clientId: string): Checkpoint[] {
    return this.checkpoints.filter(c => c.clientId === clientId);
  }
}