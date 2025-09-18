import { useState, useEffect } from "react";
import { Clock, MapPin, Camera, AlertTriangle, User, Navigation, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Round } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useClientCheckpointStats } from "@/hooks/useClientCheckpointStats";

interface RoundDetailsProps {
  round: Round;
  onClose?: () => void;
}

interface CheckpointVisit {
  id: string;
  checkpoint_id: string;
  visit_time: string;
  duration: number;
  status: string;
}

interface TemplateCheckpoint {
  id: string;
  client_id: string;
  order_index: number;
  clients: {
    name: string;
    address: string;
  };
}

interface Incident {
  id: string;
  title: string;
  description?: string;
  type: string;
  priority: string;
  reported_at: string;
}

const RoundDetails = ({ round, onClose }: RoundDetailsProps) => {
  const [checkpointVisits, setCheckpointVisits] = useState<CheckpointVisit[]>([]);
  const [templateCheckpoints, setTemplateCheckpoints] = useState<TemplateCheckpoint[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const { stats, getTotalStats } = useClientCheckpointStats(round.id);

  useEffect(() => {
    fetchRoundData();
  }, [round.id]);

  const fetchRoundData = async () => {
    try {
      setLoading(true);

      // Fetch round data to get template_id
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("id, template_id")
        .eq("id", round.id)
        .single();

      if (roundError) throw roundError;

      // Fetch checkpoint visits
      const { data: visitsData, error: visitsError } = await supabase
        .from("checkpoint_visits")
        .select("*")
        .eq("round_id", round.id)
        .order("visit_time");

      if (visitsError) throw visitsError;
      setCheckpointVisits(visitsData || []);

      // Fetch template checkpoints if template exists
      if (roundData.template_id) {
        const { data: templateData, error: templateError } = await supabase
          .from("round_template_checkpoints")
          .select(`
            id,
            client_id,
            order_index,
            clients (name, address)
          `)
          .eq("template_id", roundData.template_id)
          .order("order_index");

        if (templateError) throw templateError;
        setTemplateCheckpoints(templateData || []);
      }

      // Fetch incidents
      const { data: incidentsData, error: incidentsError } = await supabase
        .from("incidents")
        .select("*")
        .eq("round_id", round.id)
        .order("reported_at");

      if (incidentsError) throw incidentsError;
      setIncidents(incidentsData || []);

    } catch (error) {
      console.error("Error fetching round data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: Round['status']) => {
    switch (status) {
      case 'active': return 'bg-tactical-green text-white';
      case 'incident': return 'bg-tactical-red text-white';
      case 'completed': return 'bg-primary text-primary-foreground';
      case 'pending': return 'bg-tactical-amber text-white';
      default: return 'bg-muted';
    }
  };

  const getStatusLabel = (status: Round['status']) => {
    switch (status) {
      case 'active': return 'Em Andamento';
      case 'incident': return 'Com Ocorrência';
      case 'completed': return 'Concluída';
      case 'pending': return 'Aguardando';
      default: return status;
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="p-6 rounded-lg border tactical-card bg-card">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <h3 className="text-xl font-bold text-foreground">Ronda #{round.id.slice(-3)}</h3>
            <Badge className={getStatusColor(round.status)}>
              {getStatusLabel(round.status)}
            </Badge>
          </div>
          <div className="flex items-center space-x-4 text-muted-foreground">
            <div className="flex items-center space-x-1">
              <User className="h-4 w-4" />
              <span>{round.tacticName}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Navigation className="h-4 w-4" />
              <span>{round.vehicle === 'car' ? '🚗 Viatura' : '🏍️ Motocicleta'}</span>
            </div>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        )}
      </div>

      <ScrollArea className="h-96">
        <div className="space-y-6">
          {/* Informações Gerais */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Informações Gerais</span>
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Cliente</p>
                <p className="font-medium text-foreground">{round.clientName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duração</p>
                <p className="font-medium text-foreground">
                  {round.startTime ? formatDuration(round.startTime, round.endTime) : '-'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Início</p>
                <p className="font-medium text-foreground">
                  {round.startTime ? new Date(round.startTime).toLocaleString('pt-BR') : '-'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Fim</p>
                <p className="font-medium text-foreground">
                  {round.endTime ? new Date(round.endTime).toLocaleString('pt-BR') : 'Em andamento'}
                </p>
              </div>
              {round.startOdometer && (
                <>
                  <div>
                    <p className="text-muted-foreground">Odômetro Inicial</p>
                    <p className="font-medium text-foreground">{round.startOdometer.toLocaleString()} km</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Odômetro Final</p>
                    <p className="font-medium text-foreground">
                      {round.endOdometer ? `${round.endOdometer.toLocaleString()} km` : '-'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* Checkpoints */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground flex items-center space-x-2">
              <MapPin className="h-4 w-4" />
              <span>Checkpoints ({getTotalStats().completed}/{getTotalStats().total})</span>
            </h4>
            {loading ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Carregando checkpoints...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templateCheckpoints.map((checkpoint) => {
                  const visit = checkpointVisits.find(v => 
                    v.checkpoint_id === `template_${checkpoint.id}` || 
                    v.checkpoint_id === checkpoint.id
                  );
                  return (
                    <div
                      key={checkpoint.id}
                      className={`p-3 rounded-lg border ${
                        visit ? 'bg-tactical-green/10 border-tactical-green/30' : 'bg-muted/20 border-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-foreground">{checkpoint.clients.name}</span>
                        {visit ? (
                          <Badge variant="outline" className="text-tactical-green border-tactical-green">
                            Visitado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Pendente
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {checkpoint.clients.address}
                      </div>
                      {visit && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(visit.visit_time).toLocaleTimeString('pt-BR')}</span>
                            <span>({Math.floor(visit.duration / 60)}m {visit.duration % 60}s)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {templateCheckpoints.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum checkpoint configurado
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Ocorrências */}
          {incidents.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-tactical-red" />
                  <span>Ocorrências ({incidents.length})</span>
                </h4>
                <div className="space-y-2">
                  {incidents.map((incident) => (
                    <div
                      key={incident.id}
                      className="p-3 rounded-lg border bg-tactical-red/10 border-tactical-red/30"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-medium text-foreground">{incident.title}</span>
                        <Badge variant="outline" className="text-tactical-red border-tactical-red">
                          {incident.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{incident.description}</p>
                      <div className="text-xs text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(incident.reported_at).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Progress Summary */}
          <Separator />
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground flex items-center space-x-2">
              <Navigation className="h-4 w-4" />
              <span>Progresso da Ronda</span>
            </h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Total de checkpoints: {getTotalStats().total}</p>
              <p>Visitados: {getTotalStats().completed}</p>
              <p>Progresso: {getTotalStats().progress}%</p>
              {incidents.length > 0 && (
                <p className="text-tactical-red">Incidentes: {incidents.length}</p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default RoundDetails;