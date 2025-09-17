import { MapPin, Navigation, AlertTriangle, Clock } from "lucide-react";

interface Vehicle {
  id: string;
  tactic: string;
  type: "car" | "motorcycle";
  status: "active" | "standby" | "incident";
  position: { lat: number; lng: number };
  lastUpdate: string;
}

const mockVehicles: Vehicle[] = [
  {
    id: "V001",
    tactic: "José Silva",
    type: "car",
    status: "active",
    position: { lat: -23.550520, lng: -46.633308 },
    lastUpdate: "14:35"
  },
  {
    id: "V002", 
    tactic: "Maria Santos",
    type: "motorcycle",
    status: "active",
    position: { lat: -23.561684, lng: -46.656139 },
    lastUpdate: "14:33"
  },
  {
    id: "V003",
    tactic: "Carlos Oliveira",
    type: "car", 
    status: "incident",
    position: { lat: -23.533773, lng: -46.625290 },
    lastUpdate: "14:28"
  }
];

const statusConfig = {
  active: {
    color: "bg-tactical-green",
    borderColor: "border-tactical-green",
    label: "Ativo"
  },
  standby: {
    color: "bg-tactical-amber",
    borderColor: "border-tactical-amber", 
    label: "Standby"
  },
  incident: {
    color: "bg-tactical-red",
    borderColor: "border-tactical-red",
    label: "Ocorrência"
  }
};

const MapView = () => {
  return (
    <div className="p-6 rounded-lg border tactical-card bg-card h-96">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Mapa Tático</h3>
        <div className="flex items-center space-x-2">
          <Navigation className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">Tempo Real</span>
          <div className="w-2 h-2 bg-tactical-green rounded-full pulse-tactical"></div>
        </div>
      </div>

      {/* Mapa Placeholder - Aqui seria integrado o Mapbox */}
      <div className="relative w-full h-64 bg-gradient-to-br from-muted/30 to-muted/60 rounded-lg border overflow-hidden">
        {/* Grid pattern para simular mapa */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px'
          }}
        ></div>

        {/* Viaturas no mapa */}
        {mockVehicles.map((vehicle, index) => (
          <div
            key={vehicle.id}
            className={`absolute w-4 h-4 rounded-full border-2 ${statusConfig[vehicle.status].borderColor} ${statusConfig[vehicle.status].color} pulse-tactical cursor-pointer hover:scale-125 transition-all`}
            style={{
              left: `${20 + index * 25}%`,
              top: `${30 + index * 15}%`
            }}
            title={`${vehicle.tactic} - ${statusConfig[vehicle.status].label}`}
          >
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-background/90 backdrop-blur-sm border rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
              <div className="font-medium text-foreground">{vehicle.tactic}</div>
              <div className="text-muted-foreground">
                {vehicle.type === "car" ? "🚗" : "🏍️"} {vehicle.lastUpdate}
              </div>
            </div>
          </div>
        ))}

        {/* Pontos de interesse */}
        <div className="absolute top-4 right-4 space-y-2">
          <div className="flex items-center space-x-2 bg-background/80 backdrop-blur-sm rounded px-2 py-1 text-xs">
            <MapPin className="h-3 w-3 text-primary" />
            <span className="text-foreground">Shopping Norte</span>
          </div>
          <div className="flex items-center space-x-2 bg-background/80 backdrop-blur-sm rounded px-2 py-1 text-xs">
            <AlertTriangle className="h-3 w-3 text-tactical-red" />
            <span className="text-foreground">Ocorrência Ativa</span>
          </div>
        </div>

        {/* Legenda */}
        <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm border rounded-lg p-3">
          <div className="text-xs font-medium text-foreground mb-2">Status das Viaturas</div>
          <div className="space-y-1">
            {Object.entries(statusConfig).map(([status, config]) => (
              <div key={status} className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${config.color}`}></div>
                <span className="text-xs text-muted-foreground">{config.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Info adicional */}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center space-x-2">
          <Clock className="h-3 w-3" />
          <span>Última atualização: 14:35</span>
        </div>
        <span>{mockVehicles.length} viaturas monitoradas</span>
      </div>
    </div>
  );
};

export default MapView;