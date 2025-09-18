import { useState, useEffect } from "react";
import { ArrowLeft, Clock, CheckCircle, QrCode, ChevronRight, Map, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGpsTracking } from "@/hooks/useGpsTracking";
import RoundCheckpointsList from "./RoundCheckpointsList";
import QrCheckpointScreen from "./QrCheckpointScreen";
import SignaturePad from "./SignaturePad";
import CheckpointMap from "./CheckpointMap";
import IncidentDialog from "./IncidentDialog";
import { useClientCheckpointStats } from "@/hooks/useClientCheckpointStats";

interface Client {
  id: string;
  name: string;
  address: string;
}

interface RoundCompaniesProgressProps {
  roundId: string;
  onBack: () => void;
  onCheckpointSelect: (checkpointId: string) => void;
}

const RoundCompaniesProgress = ({ 
  roundId, 
  onBack, 
  onCheckpointSelect 
}: RoundCompaniesProgressProps) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [roundInfo, setRoundInfo] = useState<any>(null);
  const { toast } = useToast();
  const { currentLocation } = useGpsTracking();
  const { stats, getClientProgress, isClientCompleted, getTotalStats } = useClientCheckpointStats(roundId);

  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [clientForSignature, setClientForSignature] = useState<Client | null>(null);
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [showCheckpointMap, setShowCheckpointMap] = useState(false);
  const [showIncidentDialog, setShowIncidentDialog] = useState(false);

  useEffect(() => {
    fetchRoundAndClients();
    
    // Subscribe to checkpoint visits changes for real-time updates
    const channel = supabase
      .channel('checkpoint-visits-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'checkpoint_visits',
        filter: `round_id=eq.${roundId}`
      }, () => {
        console.log('Checkpoint visit change detected, refreshing data');
        fetchRoundAndClients();
        checkClientCompletion();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roundId]);

  const fetchRoundAndClients = async () => {
    try {
      // Buscar informações da ronda
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select(`
          id,
          start_time,
          vehicle,
          template_id,
          client_id,
          round_templates (
            name,
            description,
            requires_signature,
            round_template_checkpoints (
              id,
              client_id,
              order_index,
              required_signature,
              clients (
                id,
                name,
                address,
                lat,
                lng
              )
            )
          ),
          clients (
            id,
            name,
            address,
            lat,
            lng
          )
        `)
        .eq("id", roundId)
        .maybeSingle();

      if (roundError) {
        console.error("Error fetching round data:", roundError);
        throw roundError;
      }
      
      if (!roundData) {
        toast({
          title: "Erro",
          description: "Ronda não encontrada",
          variant: "destructive",
        });
        setClients([]);
        return;
      }
      
      console.log("Round data fetched:", roundData);
      setRoundInfo(roundData);
      
      // Check if any checkpoint requires signature
      const templateRequiresSignature = roundData?.round_templates?.requires_signature || false;
      const anyCheckpointRequiresSignature = roundData?.round_templates?.round_template_checkpoints?.some(
        (checkpoint: any) => checkpoint.required_signature
      ) || false;
      
      setRequiresSignature(templateRequiresSignature || anyCheckpointRequiresSignature);

      // Processar clientes únicos do template ou da ronda direta
      const clientsSet = new Set<string>();
      const clientsList: Client[] = [];
      
      if (roundData?.round_templates?.round_template_checkpoints) {
        console.log("Processing template checkpoints:", roundData.round_templates.round_template_checkpoints);
        
        // Ronda baseada em template
        roundData.round_templates.round_template_checkpoints.forEach((checkpoint: any) => {
          const client = checkpoint.clients;
          
          console.log("Processing checkpoint:", checkpoint, "Client:", client);
          
          // Verificar se o cliente não é null antes de processar
          if (client && client.id && !clientsSet.has(client.id)) {
            clientsSet.add(client.id);
            clientsList.push({
              id: client.id,
              name: client.name || 'Cliente sem nome',
              address: client.address || 'Endereço não informado'
            });
            console.log("Added client to list:", client.name);
          }
        });
      } else if (roundData?.clients) {
        // Ronda direta com cliente único
        clientsList.push({
          id: roundData.clients.id,
          name: roundData.clients.name,
          address: roundData.clients.address
        });
        console.log("Added direct client:", roundData.clients.name);
      }

      console.log("Final clients list:", clientsList);
      setClients(clientsList.sort((a, b) => a.name.localeCompare(b.name)));

    } catch (error) {
      console.error("Error fetching round data:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar informações da ronda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
  };

  const handleBackFromCheckpoints = () => {
    setSelectedClient(null);
  };

  const getClientStatus = (client: Client) => {
    if (isClientCompleted(client.id)) {
      return { text: "✓ Concluído", color: "bg-tactical-green border-tactical-green text-white" };
    } else if (stats[client.id]?.completedCheckpoints > 0) {
      return { text: "🔄 Em andamento", color: "bg-tactical-blue border-tactical-blue text-white" };
    } else {
      return { text: "⏳ Aguardando", color: "bg-tactical-red border-tactical-red text-white" };
    }
  };

  const { total: totalCheckpoints, completed: completedCheckpoints } = getTotalStats();

  const handleCheckpointSelect = (checkpointId: string) => {
    setSelectedCheckpoint(checkpointId);
  };

  const checkClientCompletion = () => {
    // Check if any client was just completed and needs signature
    setTimeout(() => {
      clients.forEach(client => {
        if (isClientCompleted(client.id) && requiresSignature && !showSignaturePad) {
          setClientForSignature(client);
          setShowSignaturePad(true);
        }
      });
    }, 1000); // Small delay to ensure stats are updated
  };

  const handleSignatureSave = (signatureData: string, clientName: string) => {
    console.log(`Assinatura coletada de ${clientName} para o cliente ${clientForSignature?.name}`);
    
    toast({
      title: "Assinatura coletada",
      description: `Assinatura de ${clientName} registrada para ${clientForSignature?.name}`,
    });
    
    // Reset signature state
    setShowSignaturePad(false);
    setClientForSignature(null);
  };

  if (showCheckpointMap) {
    return (
      <CheckpointMap
        roundId={roundId}
        onBack={() => setShowCheckpointMap(false)}
      />
    );
  }

  if (selectedCheckpoint) {
    return (
      <QrCheckpointScreen
        checkpointId={selectedCheckpoint}
        roundId={roundId}
        onBack={() => setSelectedCheckpoint(null)}
        onIncident={() => {
          setShowIncidentDialog(true);
        }}
      />
    );
  }

  if (selectedClient) {
    return (
      <RoundCheckpointsList
        roundId={roundId}
        clientId={selectedClient.id}
        clientName={selectedClient.name}
        onBack={handleBackFromCheckpoints}
        onCheckpointSelect={handleCheckpointSelect}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tactical-blue mx-auto mb-4"></div>
          <p className="text-slate-400">Carregando ronda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header com informações da ronda */}
      <div className="bg-tactical-blue p-4">
        <div className="flex items-center justify-between mb-4">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="text-white hover:bg-white/10 p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="text-right flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCheckpointMap(true)}
              className="bg-tactical-blue text-white hover:bg-tactical-blue/90 border-tactical-blue"
            >
              <Map className="w-4 h-4 mr-2" />
              Ver Mapa
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowIncidentDialog(true)}
              className="bg-tactical-red text-white hover:bg-tactical-red/90 border-tactical-red"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Criar Ocorrência
            </Button>
            <div className="text-sm text-white/80">
              {completedCheckpoints} de {totalCheckpoints} checkpoints
            </div>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">
            {roundInfo?.round_templates?.name || 'Ronda'}
          </h1>
          <div className="text-sm text-white/70 mb-3">
            {clients.length} {clients.length === 1 ? 'empresa' : 'empresas'} • {totalCheckpoints} {totalCheckpoints === 1 ? 'checkpoint' : 'checkpoints'}
          </div>
          
          <div className="flex justify-between items-center bg-white/10 rounded-lg p-3">
            <div>
              <span className="text-sm text-white/80">Início</span>
              <p className="font-medium">
                {roundInfo?.start_time 
                  ? new Date(roundInfo.start_time).toLocaleTimeString('pt-BR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })
                  : '--:--'
                }
              </p>
            </div>
            
            <div>
              <span className="text-sm text-white/80">Veículo</span>
              <p className="font-medium">{roundInfo?.vehicle || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de empresas */}
      <div className="p-4">
        <h2 className="text-xl font-semibold mb-4 text-white">Pontos Obrigatórios</h2>
        
        <div className="space-y-3">
          {clients.map((client, index) => {
            const status = getClientStatus(client);
            const clientStat = stats[client.id] || { totalCheckpoints: 0, completedCheckpoints: 0 };
            const canAccess = index === 0 || isClientCompleted(clients[index - 1]?.id);
            
            return (
              <Card 
                key={client.id}
                className={`transition-all cursor-pointer border-2 ${
                  !canAccess 
                    ? 'bg-tactical-red/10 border-tactical-red opacity-80 cursor-not-allowed' 
                    : isClientCompleted(client.id)
                    ? 'bg-tactical-green/10 border-tactical-green hover:border-tactical-green/80 shadow-lg'
                    : stats[client.id]?.completedCheckpoints > 0
                    ? 'bg-tactical-blue/10 border-tactical-blue hover:border-tactical-blue/80 shadow-lg'
                    : 'bg-slate-800 border-tactical-red hover:border-tactical-red/80'
                }`}
                onClick={() => canAccess && handleClientSelect(client)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-white">{client.name}</h3>
                        <p className="text-sm text-slate-400">
                          Ronda em {client.name}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Badge className={`${status.color} text-white`}>
                        {status.text}
                      </Badge>
                      
                      {canAccess && <ChevronRight className="w-5 h-5 text-slate-400" />}
                    </div>
                  </div>
                  
                  {/* Barra de progresso */}
                  <div className="mt-3">
                    <div className="flex justify-between text-sm text-slate-400 mb-1">
                      <span>Progresso</span>
                      <span>{clientStat.completedCheckpoints}/{clientStat.totalCheckpoints} pontos</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-tactical-green h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${getClientProgress(client.id)}%` 
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer com resumo */}
        {totalCheckpoints > 0 && (
          <div className="mt-6 p-4 bg-tactical-green rounded-lg">
            <div className="flex items-center justify-center space-x-2">
              <CheckCircle className="w-5 h-5 text-white" />
              <span className="text-white font-medium">
                {totalCheckpoints - completedCheckpoints === 0 
                  ? "Todos os checkpoints concluídos!"
                  : `Faltam ${totalCheckpoints - completedCheckpoints} checkpoints`
                }
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Signature Pad Dialog for client completion */}
      {showSignaturePad && clientForSignature && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <SignaturePad
            onSignature={(signature) => {
              handleSignatureSave(signature, clientForSignature.name);
              setShowSignaturePad(false);
            }}
            onCancel={() => setShowSignaturePad(false)}
            clientName={clientForSignature.name}
          />
        </div>
      )}

      {/* Incident Dialog */}
      <IncidentDialog
        open={showIncidentDialog}
        onClose={() => setShowIncidentDialog(false)}
        roundId={roundId}
        currentLocation={currentLocation}
      />
    </div>
  );
};

export default RoundCompaniesProgress;