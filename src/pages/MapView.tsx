import { useState, useEffect } from "react";
import { MapPin, Navigation, Activity, Clock, Maximize2, X, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";
import RealTimeRoundTracking from "@/components/Dashboard/RealTimeRoundTracking";
import RealtimeMap from "@/components/Dashboard/RealtimeMap";
import EmergencyNotification from "@/components/Dashboard/EmergencyNotification";

interface Round {
  id: string;
  client_id: string;
  user_id: string;
  vehicle: 'car' | 'motorcycle' | 'on_foot';
  status: 'pending' | 'active' | 'completed' | 'incident';
  start_time?: string;
  clients: {
    name: string;
    address: string;
    lat?: number;
    lng?: number;
  };
  profiles?: {
    name: string;
  } | null;
}

interface Client {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  active: boolean;
}

const MapViewPage = () => {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchActiveRounds();
    fetchClients();
  }, []);

  // Auto refresh rounds every 15s
  useEffect(() => {
    const id = setInterval(() => {
      fetchActiveRounds();
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const fetchActiveRounds = async () => {
    try {
      const { data, error } = await supabase
        .from("rounds")
        .select(`
          *,
          clients (name, address, lat, lng),
          profiles (name)
        `)
        .in('status', ['active', 'incident'])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRounds(data || []);
    } catch (error) {
      console.error("Error fetching rounds:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar rondas ativas",
        variant: "destructive",
      });
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("active", true)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .order("name");

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: Round['status']) => {
    switch (status) {
      case 'active': return 'bg-tactical-green text-white';
      case 'incident': return 'bg-tactical-red text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: Round['status']) => {
    switch (status) {
      case 'active': return 'Ativa';
      case 'incident': return 'Incidente';
      default: return status;
    }
  };

  const formatDuration = (startTime?: string) => {
    if (!startTime) return '-';
    const start = new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000 / 60);
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mapa de Rondas</h1>
            <p className="text-muted-foreground">
              Visualização em tempo real das rondas e localizações dos clientes
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Mapa em Tempo Real */}
            <div className="lg:col-span-2">
              <RealtimeMap />
            </div>

            {/* Painel lateral */}
            <div className="space-y-6">
              {/* Real-time Round Tracking */}
              <RealTimeRoundTracking />
              
              {/* Rondas Ativas */}
              <Card className="tactical-card">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="w-5 h-5" />
                    <span>Rondas Ativas</span>
                    <Badge variant="secondary">{rounds.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {rounds.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma ronda ativa no momento
                    </p>
                  ) : (
                    rounds.map((round) => (
                      <div key={round.id} className="p-3 border rounded-lg bg-background/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{round.profiles?.name || 'Não atribuído'}</span>
                          <Badge className={getStatusColor(round.status)}>
                            {getStatusLabel(round.status)}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate">
                              {round.clients.name}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {formatDuration(round.start_time)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Clientes no Mapa */}
              <Card className="tactical-card">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MapPin className="w-5 h-5" />
                    <span>Clientes</span>
                    <Badge variant="secondary">{clients.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {clients.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum cliente com localização cadastrada
                    </p>
                  ) : (
                    clients.map((client) => (
                      <div key={client.id} className="p-3 border rounded-lg bg-background/50">
                        <div className="space-y-1">
                          <span className="font-medium text-sm">{client.name}</span>
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate">
                              {client.address}
                            </span>
                          </div>
                          {client.lat && client.lng && (
                            <div className="text-xs text-muted-foreground">
                              Lat: {client.lat.toFixed(4)}, Lng: {client.lng.toFixed(4)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Legenda */}
              <Card className="tactical-card">
                <CardHeader>
                  <CardTitle className="text-sm">Legenda</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-tactical-green rounded-full"></div>
                    <span className="text-xs text-muted-foreground">Tático com Ronda Ativa</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-tactical-red rounded-full"></div>
                    <span className="text-xs text-muted-foreground">Incidente/Ponto Pendente</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-tactical-blue rounded-full"></div>
                    <span className="text-xs text-muted-foreground">Cliente</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-tactical-green rounded-full border border-white"></div>
                    <span className="text-xs text-muted-foreground">Ponto Visitado</span>
                  </div>
                  <hr className="my-2" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Pontos de Ronda:</p>
                    <p>• Aparecem apenas quando há rondas ativas</p>
                    <p>• Vermelho: Não visitado</p>
                    <p>• Verde: Visitado com sucesso</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {expanded && (
            <div className="fixed inset-0 z-50 bg-background">
              <RealtimeMap 
                isExpanded={true} 
                onClose={() => setExpanded(false)}
                onOpenNewWindow={() => {
                  const url = window.location.href;
                  window.open(url, '_blank', 'width=1200,height=800');
                }}
              />
            </div>
          )}
        </main>
      </div>
      
      {/* Emergency Notification Overlay */}
      <EmergencyNotification />
    </div>
  );
};

export default MapViewPage;