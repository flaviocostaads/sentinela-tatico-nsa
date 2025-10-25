import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MapPin, Clock, CheckCircle, XCircle, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CheckpointVisit {
  id: string;
  checkpoint_id: string;
  visit_time: string;
  status: 'completed' | 'skipped' | 'delayed';
  duration: number;
  lat?: number;
  lng?: number;
}

interface Checkpoint {
  id: string;
  name: string;
  order_index: number;
  client_id: string;
}

interface Round {
  id: string;
  client_id: string;
  user_id: string;
  status: 'pending' | 'active' | 'completed' | 'incident';
  start_time?: string;
  clients: {
    name: string;
  };
  profiles?: {
    name: string;
  } | null;
  round_templates?: {
    name: string;
  } | null;
}

interface RealTimeRoundTrackingProps {
  selectedRoundId?: string;
  onRoundSelect?: (roundId: string) => void;
}

const RealTimeRoundTracking: React.FC<RealTimeRoundTrackingProps> = ({
  selectedRoundId,
  onRoundSelect
}) => {
  const [activeRounds, setActiveRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [visits, setVisits] = useState<CheckpointVisit[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchActiveRounds();
    
    // Set up real-time subscriptions
    const roundsChannel = supabase
      .channel('active-rounds')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'rounds' },
        () => fetchActiveRounds()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'checkpoint_visits' },
        () => {
          if (selectedRound) {
            fetchRoundDetails(selectedRound.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roundsChannel);
    };
  }, []);

  useEffect(() => {
    if (selectedRoundId) {
      const round = activeRounds.find(r => r.id === selectedRoundId);
      if (round) {
        setSelectedRound(round);
        fetchRoundDetails(selectedRoundId);
      }
    }
  }, [selectedRoundId, activeRounds]);

  const fetchActiveRounds = async () => {
    try {
      const { data, error } = await supabase
        .from('rounds')
        .select(`
          *,
          clients (name),
          profiles (name),
          round_templates (name)
        `)
        .in('status', ['active', 'incident'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActiveRounds(data || []);
    } catch (error) {
      console.error('Error fetching active rounds:', error);
    }
  };

  const fetchRoundDetails = async (roundId: string) => {
    setLoading(true);
    try {
      // Fetch round checkpoints from template
      const { data: round, error: roundError } = await supabase
        .from('rounds')
        .select(`
          *,
          clients (
            id,
            checkpoints (*)
          )
        `)
        .eq('id', roundId)
        .single();

      if (roundError) throw roundError;

      // Get checkpoints for this client
      const clientCheckpoints = round.clients?.checkpoints || [];
      setCheckpoints(clientCheckpoints.sort((a: Checkpoint, b: Checkpoint) => a.order_index - b.order_index));

      // Fetch checkpoint visits
      const { data: visits, error: visitsError } = await supabase
        .from('checkpoint_visits')
        .select('*')
        .eq('round_id', roundId)
        .order('visit_time', { ascending: true });

      if (visitsError) throw visitsError;
      setVisits(visits || []);

    } catch (error) {
      console.error('Error fetching round details:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar detalhes da ronda',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoundSelect = (round: Round) => {
    setSelectedRound(round);
    fetchRoundDetails(round.id);
    onRoundSelect?.(round.id);
  };

  const calculateProgress = () => {
    if (checkpoints.length === 0) return 0;
    const completedVisits = visits.filter(v => v.status === 'completed').length;
    return (completedVisits / checkpoints.length) * 100;
  };

  const getCheckpointStatus = (checkpoint: Checkpoint) => {
    const visit = visits.find(v => v.checkpoint_id === checkpoint.id);
    if (!visit) return 'pending';
    return visit.status;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="space-y-4">
      {/* Round Selection */}
      <Card className="tactical-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Play className="w-5 h-5" />
            <span>Rondas em Tempo Real</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {activeRounds.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma ronda ativa no momento
            </p>
          ) : (
            activeRounds.map((round) => (
              <Button
                key={round.id}
                variant={selectedRound?.id === round.id ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => handleRoundSelect(round)}
              >
                <div className="flex flex-col items-start w-full gap-1">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-medium">{round.profiles?.name || 'Não atribuído'}</span>
                    <Badge
                      variant={round.status === 'active' ? 'default' : 'destructive'}
                      className="ml-2"
                    >
                      {round.status === 'active' ? 'Ativa' : 'Incidente'}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-0.5 w-full">
                    <span className="text-xs text-muted-foreground">📍 {round.clients.name}</span>
                    {round.round_templates && (
                      <span className="text-xs text-primary">📋 {round.round_templates.name}</span>
                    )}
                  </div>
                </div>
              </Button>
            ))
          )}
        </CardContent>
      </Card>

      {/* Round Progress */}
      {selectedRound && (
        <Card className="tactical-card">
          <CardHeader>
            <CardTitle className="text-lg">
              Progresso da Ronda
            </CardTitle>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Checkpoints visitados</span>
                <span>{visits.filter(v => v.status === 'completed').length} de {checkpoints.length}</span>
              </div>
              <Progress value={calculateProgress()} className="w-full" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Carregando detalhes...</p>
              </div>
            ) : checkpoints.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum checkpoint configurado para este cliente
              </p>
            ) : (
              checkpoints.map((checkpoint) => {
                const visit = visits.find(v => v.checkpoint_id === checkpoint.id);
                const status = getCheckpointStatus(checkpoint);
                
                return (
                  <div key={checkpoint.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        status === 'completed' 
                          ? 'bg-tactical-green text-white'
                          : status === 'skipped'
                          ? 'bg-tactical-red text-white' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {status === 'completed' ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : status === 'skipped' ? (
                          <XCircle className="w-4 h-4" />
                        ) : (
                          <span className="text-xs font-bold">{checkpoint.order_index}</span>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{checkpoint.name}</div>
                        {visit && (
                          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(visit.visit_time).toLocaleTimeString()}</span>
                            {visit.duration > 0 && (
                              <span>• {formatDuration(visit.duration)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {visit?.lat && visit?.lng && (
                      <MapPin className="w-4 h-4 text-tactical-blue" />
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RealTimeRoundTracking;