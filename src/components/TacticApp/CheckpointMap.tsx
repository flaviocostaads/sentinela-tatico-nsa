import { useState, useEffect } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CheckpointMapProps {
  roundId: string;
  onBack: () => void;
}

interface MapCheckpoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  visited: boolean;
  visit_time?: string;
  client_name: string;
}

const CheckpointMap = ({ roundId, onBack }: CheckpointMapProps) => {
  const [checkpoints, setCheckpoints] = useState<MapCheckpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCheckpointsForMap();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel(`checkpoint-map-${roundId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'checkpoint_visits',
        filter: `round_id=eq.${roundId}`
      }, () => {
        console.log('Checkpoint visit updated, refreshing map');
        fetchCheckpointsForMap();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roundId]);

  const fetchCheckpointsForMap = async () => {
    try {
      // Get round data with template
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select(`
          id,
          template_id,
          round_templates (
            round_template_checkpoints (
              id,
              client_id,
              clients (id, name, lat, lng)
            )
          )
        `)
        .eq("id", roundId)
        .single();

      if (roundError) throw roundError;

      // Get checkpoint visits
      const { data: visits, error: visitsError } = await supabase
        .from("checkpoint_visits")
        .select("checkpoint_id, visit_time")
        .eq("round_id", roundId);

      if (visitsError) throw visitsError;

      console.log('Visited checkpoints from DB:', visits);

      // Get checkpoints data to map client_ids from checkpoint visits
      const visitedCheckpointIds = visits?.map(v => v.checkpoint_id) || [];
      const { data: checkpoints, error: checkpointsError } = await supabase
        .from("checkpoints")
        .select("id, client_id, name")
        .in("id", visitedCheckpointIds);

      if (checkpointsError) throw checkpointsError;

      // Create a map of client_id -> visit_time from completed visits
      const visitedByClient = new Map<string, string>();
      checkpoints?.forEach(checkpoint => {
        const visit = visits?.find(v => v.checkpoint_id === checkpoint.id);
        if (visit) {
          visitedByClient.set(checkpoint.client_id, visit.visit_time);
        }
      });

      console.log('Visited by client:', Object.fromEntries(visitedByClient));

      // Format checkpoints for map
      const mapCheckpoints: MapCheckpoint[] = [];

      if (roundData?.round_templates?.round_template_checkpoints) {
        roundData.round_templates.round_template_checkpoints.forEach((tc: any) => {
          if (tc.clients?.lat && tc.clients?.lng) {
            const clientId = tc.client_id;
            const visitTime = visitedByClient.get(clientId);
            const isVisited = !!visitTime;
            
            console.log(`Checkpoint for client ${tc.clients.name} (${clientId}):`, {
              isVisited,
              visitTime
            });
            
            mapCheckpoints.push({
              id: `template_${tc.id}`,
              name: tc.clients.name,
              lat: parseFloat(tc.clients.lat),
              lng: parseFloat(tc.clients.lng),
              visited: isVisited,
              visit_time: visitTime,
              client_name: tc.clients.name
            });
          }
        });
      }

      console.log('Final map checkpoints:', mapCheckpoints);
      setCheckpoints(mapCheckpoints);
    } catch (error) {
      console.error("Error fetching checkpoints for map:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar checkpoints do mapa",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '--';
    return new Date(timeString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCompletionStats = () => {
    const total = checkpoints.length;
    const completed = checkpoints.filter(cp => cp.visited).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, progress };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  const { total, completed, progress } = getCompletionStats();

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
              <h1 className="text-lg font-semibold">Mapa de Checkpoints</h1>
              <p className="text-sm text-muted-foreground">
                {completed} de {total} checkpoints concluídos
              </p>
            </div>
          </div>
          
          <Badge className={`${progress === 100 ? 'bg-tactical-green' : 'bg-tactical-blue'} text-white`}>
            {progress}% Concluído
          </Badge>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="p-4">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Progresso Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-muted rounded-full h-3 mb-4">
              <div 
                className={`h-3 rounded-full transition-all duration-500 ${
                  progress === 100 ? 'bg-tactical-green' : 'bg-tactical-blue'
                }`}
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {progress === 100 ? 'Todos os checkpoints concluídos!' : `${total - completed} checkpoints restantes`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Checkpoint List with Map Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status dos Checkpoints</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {checkpoints.map((checkpoint, index) => (
              <div 
                key={checkpoint.id}
                className={`flex items-center justify-between p-4 border rounded-lg transition-all duration-300 ${
                  checkpoint.visited 
                    ? 'border-tactical-green bg-tactical-green/5' 
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full transition-colors duration-300 ${
                    checkpoint.visited ? 'bg-tactical-green' : 'bg-red-500'
                  }`} />
                  
                  <div className="flex items-center space-x-2">
                    <MapPin className={`w-4 h-4 ${
                      checkpoint.visited ? 'text-tactical-green' : 'text-red-500'
                    }`} />
                    <span className="w-6 h-6 bg-muted rounded-full flex items-center justify-center text-sm">
                      {index + 1}
                    </span>
                  </div>
                  
                  <div>
                    <p className="font-medium">{checkpoint.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Lat: {checkpoint.lat.toFixed(6)}, Lng: {checkpoint.lng.toFixed(6)}
                    </p>
                    {checkpoint.visited && (
                      <p className="text-xs text-tactical-green">
                        Concluído às {formatTime(checkpoint.visit_time)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <Badge 
                    variant={checkpoint.visited ? "default" : "destructive"}
                    className={checkpoint.visited ? "bg-tactical-green" : ""}
                  >
                    {checkpoint.visited ? 'Concluído' : 'Pendente'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Summary */}
        {progress === 100 && (
          <Card className="mt-4 border-tactical-green">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-tactical-green rounded-full flex items-center justify-center mx-auto mb-3">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-tactical-green mb-2">
                  Ronda Completa!
                </h3>
                <p className="text-sm text-muted-foreground">
                  Todos os {total} checkpoints foram visitados com sucesso.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CheckpointMap;