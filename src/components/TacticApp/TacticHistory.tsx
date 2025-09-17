import { useState, useEffect } from "react";
import { ArrowLeft, Clock, Navigation, MapPin, CheckCircle, AlertTriangle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TacticHistoryProps {
  onBack: () => void;
}

interface HistoryRound {
  id: string;
  status: 'completed' | 'incident' | 'active' | 'pending';
  start_time: string;
  end_time?: string;
  created_at: string;
  clients: {
    name: string;
    address: string;
  };
  vehicles?: {
    license_plate: string;
    brand: string;
    model: string;
  };
  checkpointVisits: number;
  incidents: Array<{
    id: string;
    title: string;
    type: string;
    priority: string;
    reported_at: string;
  }>;
  routePoints: number;
}

const TacticHistory = ({ onBack }: TacticHistoryProps) => {
  const [rounds, setRounds] = useState<HistoryRound[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);
  const [expandedRound, setExpandedRound] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchHistory();
  }, [selectedPeriod]);

  const fetchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate date range
      const now = new Date();
      let startDate: Date;
      
      switch (selectedPeriod) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }

      // Fetch completed rounds
      const { data: roundsData, error: roundsError } = await supabase
        .from("rounds")
        .select(`
          *,
          clients (name, address),
          vehicles (license_plate, brand, model)
        `)
        .eq("user_id", user.id)
        .in("status", ["completed", "incident"])
        .gte("created_at", startDate.toISOString())
        .order("end_time", { ascending: false });

      if (roundsError) throw roundsError;

      if (!roundsData || roundsData.length === 0) {
        setRounds([]);
        return;
      }

      // Fetch additional data for each round
      const enrichedRounds = await Promise.all(
        roundsData.map(async (round) => {
          // Get checkpoint visits count
          const { data: visitsData } = await supabase
            .from("checkpoint_visits")
            .select("id")
            .eq("round_id", round.id);

          // Get incidents for this round
          const { data: incidentsData } = await supabase
            .from("incidents")
            .select("id, title, type, priority, reported_at")
            .eq("round_id", round.id);

          // Get route points count
          const { data: routeData } = await supabase
            .from("route_points")
            .select("id")
            .eq("round_id", round.id);

          return {
            ...round,
            checkpointVisits: visitsData?.length || 0,
            incidents: incidentsData || [],
            routePoints: routeData?.length || 0
          } as HistoryRound;
        })
      );

      setRounds(enrichedRounds);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar histórico",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (start: string, end?: string) => {
    if (!end) return '--';
    
    const startTime = new Date(start);
    const endTime = new Date(end);
    const diff = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-tactical-green text-white';
      case 'incident': return 'bg-tactical-red text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluída';
      case 'incident': return 'Com Incidente';
      default: return status;
    }
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'today': return 'Hoje';
      case 'week': return 'Últimos 7 dias';
      case 'month': return 'Este mês';
      default: return period;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Histórico de Rondas</h1>
              <p className="text-sm text-muted-foreground">
                {rounds.length} ronda{rounds.length !== 1 ? 's' : ''} - {getPeriodLabel(selectedPeriod)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Period Filter */}
      <div className="p-4 border-b">
        <div className="flex space-x-2">
          {(['today', 'week', 'month'] as const).map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPeriod(period)}
            >
              {getPeriodLabel(period)}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {rounds.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma ronda encontrada</h3>
              <p className="text-muted-foreground">
                Não há rondas finalizadas no período selecionado.
              </p>
            </CardContent>
          </Card>
        ) : (
          rounds.map((round) => (
            <Card key={round.id} className="tactical-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${round.status === 'completed' ? 'bg-tactical-green/20' : 'bg-tactical-red/20'}`}>
                      {round.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-tactical-green" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-tactical-red" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{round.clients.name}</CardTitle>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span>{round.clients.address}</span>
                      </div>
                    </div>
                  </div>
                  <Badge className={getStatusColor(round.status)}>
                    {getStatusLabel(round.status)}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-muted-foreground">Data</p>
                    <p className="font-medium">{formatDate(round.created_at)}</p>
                  </div>
                  
                  <div>
                    <p className="text-muted-foreground">Início</p>
                    <p className="font-medium">{formatTime(round.start_time)}</p>
                  </div>
                  
                  <div>
                    <p className="text-muted-foreground">Duração</p>
                    <p className="font-medium">{formatDuration(round.start_time, round.end_time)}</p>
                  </div>
                  
                  <div>
                    <p className="text-muted-foreground">Checkpoints</p>
                    <p className="font-medium">{round.checkpointVisits}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center space-x-4 text-xs text-muted-foreground mb-4">
                  <div className="flex items-center space-x-1">
                    <Navigation className="w-3 h-3" />
                    <span>{round.routePoints} pontos do trajeto</span>
                  </div>
                  {round.incidents.length > 0 && (
                    <div className="flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3 text-tactical-red" />
                      <span>{round.incidents.length} incidente{round.incidents.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                {/* Vehicle */}
                {round.vehicles && (
                  <div className="p-3 bg-muted/30 rounded-lg mb-4">
                    <div className="flex items-center space-x-2 text-sm">
                      <Navigation className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{round.vehicles.license_plate}</span>
                      <span className="text-muted-foreground">
                        {round.vehicles.brand} {round.vehicles.model}
                      </span>
                    </div>
                  </div>
                )}

                {/* Expandable Incidents */}
                {round.incidents.length > 0 && (
                  <div className="space-y-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedRound(
                        expandedRound === round.id ? null : round.id
                      )}
                      className="p-0 h-auto font-medium text-tactical-red hover:text-tactical-red/80"
                    >
                      {expandedRound === round.id ? 'Ocultar' : 'Ver'} incidentes ({round.incidents.length})
                    </Button>
                    
                    {expandedRound === round.id && (
                      <div className="space-y-2 mt-2 pl-4 border-l-2 border-tactical-red/20">
                        {round.incidents.map((incident) => (
                          <div key={incident.id} className="p-2 bg-tactical-red/5 rounded">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{incident.title}</span>
                              <Badge variant="outline" className="text-xs">
                                {incident.priority}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatTime(incident.reported_at)} • {incident.type}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default TacticHistory;