import { Clock, MapPin, Camera, AlertTriangle, User, Navigation, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Round, CheckpointVisit } from "@/types";
import { MockDataStore } from "@/data/mockData";

interface RoundDetailsProps {
  round: Round;
  onClose?: () => void;
}

const RoundDetails = ({ round, onClose }: RoundDetailsProps) => {
  const dataStore = MockDataStore.getInstance();
  const checkpoints = dataStore.getClientCheckpoints(round.clientId);
  const visits = dataStore.checkpointVisits.filter(v => v.roundId === round.id);

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
              <span>Checkpoints ({visits.length}/{checkpoints.length})</span>
            </h4>
            <div className="space-y-2">
              {checkpoints.map((checkpoint) => {
                const visit = visits.find(v => v.checkpointId === checkpoint.id);
                return (
                  <div
                    key={checkpoint.id}
                    className={`p-3 rounded-lg border ${
                      visit ? 'bg-tactical-green/10 border-tactical-green/30' : 'bg-muted/20 border-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-foreground">{checkpoint.name}</span>
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
                    {visit && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(visit.visitTime).toLocaleTimeString('pt-BR')}</span>
                          <span>({Math.floor(visit.duration / 60)}m {visit.duration % 60}s)</span>
                        </div>
                        {visit.photos.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <Camera className="h-3 w-3" />
                            <span>{visit.photos.length} foto(s)</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ocorrências */}
          {round.incidents.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-tactical-red" />
                  <span>Ocorrências ({round.incidents.length})</span>
                </h4>
                <div className="space-y-2">
                  {round.incidents.map((incident) => (
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
                          <span>{new Date(incident.reportedAt).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Trajeto */}
          <Separator />
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground flex items-center space-x-2">
              <Navigation className="h-4 w-4" />
              <span>Trajeto ({round.route.length} pontos)</span>
            </h4>
            {round.route.length > 0 ? (
              <div className="text-sm text-muted-foreground">
                <p>Distância percorrida: ~{Math.floor(round.route.length * 0.5)} km</p>
                <p>Velocidade média: ~{Math.floor(Math.random() * 20 + 30)} km/h</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum ponto de trajeto registrado</p>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default RoundDetails;