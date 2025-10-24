import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Clock, QrCode, CheckCircle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Checkpoint {
  id: string;
  name: string;
  description?: string;
  qr_code?: string;
  manual_code?: string;
  order_index: number;
  completed?: boolean;
  checklist_items?: any;
}

interface RoundCheckpointsListProps {
  roundId: string;
  clientId: string;
  clientName: string;
  onBack: () => void;
  onCheckpointSelect: (checkpointId: string) => void;
}

const RoundCheckpointsList = ({ 
  roundId, 
  clientId, 
  clientName, 
  onBack, 
  onCheckpointSelect 
}: RoundCheckpointsListProps) => {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [completedCheckpoints, setCompletedCheckpoints] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCheckpoints();
    fetchCompletedCheckpoints();
  }, [clientId, roundId]);

  const fetchCheckpoints = async () => {
    try {
      console.log("🔍 Fetching checkpoints for client:", clientId, "round:", roundId);
      
      // Buscar checkpoints físicos do cliente
      const { data: checkpointsData, error } = await supabase
        .from("checkpoints")
        .select("*")
        .eq("client_id", clientId)
        .eq("active", true)
        .order("order_index");

      if (error) {
        console.error("❌ Error fetching checkpoints:", error);
        throw error;
      }

      console.log(`📍 Physical checkpoints found for client ${clientId}:`, checkpointsData?.length || 0, checkpointsData);

      if (checkpointsData && checkpointsData.length > 0) {
        const formattedCheckpoints = checkpointsData.map((cp, index) => ({
          id: cp.id,
          name: cp.name,
          description: cp.description || `Checkpoint ${index + 1}`,
          qr_code: cp.qr_code,
          manual_code: cp.manual_code,
          order_index: cp.order_index,
          checklist_items: cp.checklist_items
        }));
        console.log(`✅ Using ${formattedCheckpoints.length} physical checkpoints:`, formattedCheckpoints);
        setCheckpoints(formattedCheckpoints);
      } else {
        console.warn(`⚠️ No physical checkpoints found for client ${clientId}`);
        setCheckpoints([]);
      }
    } catch (error) {
      console.error("❌ Error fetching checkpoints:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar pontos de ronda",
        variant: "destructive",
      });
      setCheckpoints([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletedCheckpoints = async () => {
    try {
      const { data, error } = await supabase
        .from("checkpoint_visits")
        .select("checkpoint_id")
        .eq("round_id", roundId)
        .eq("status", "completed");

      if (error) throw error;

      const completed = data?.map(visit => visit.checkpoint_id) || [];
      setCompletedCheckpoints(completed);
    } catch (error) {
      console.error("Error fetching completed checkpoints:", error);
    }
  };

  const isCheckpointCompleted = (checkpointId: string) => {
    return completedCheckpoints.includes(checkpointId);
  };

  const canAccessCheckpoint = (checkpoint: Checkpoint, index: number) => {
    // Primeiro checkpoint sempre pode ser acessado
    if (index === 0) return true;
    
    // Próximo checkpoint só pode ser acessado se o anterior foi completado
    const previousCheckpoint = checkpoints[index - 1];
    return previousCheckpoint ? isCheckpointCompleted(previousCheckpoint.id) : false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tactical-blue mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando pontos de ronda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="outline" 
            onClick={onBack}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </Button>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">{clientName}</h1>
            <p className="text-sm text-muted-foreground">
              {checkpoints.length} ponto(s) de ronda
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {checkpoints.map((checkpoint, index) => {
            const isCompleted = isCheckpointCompleted(checkpoint.id);
            const canAccess = canAccessCheckpoint(checkpoint, index);
            
            return (
              <Card 
                key={checkpoint.id} 
                className={`transition-all cursor-pointer border-2 ${
                  isCompleted 
                    ? 'border-tactical-green bg-tactical-green/10 shadow-lg' 
                    : canAccess 
                    ? 'border-tactical-blue bg-tactical-blue/10 hover:shadow-lg hover:border-tactical-blue/80' 
                    : 'border-tactical-red bg-tactical-red/10 opacity-80 cursor-not-allowed'
                }`}
                onClick={() => canAccess && !isCompleted && onCheckpointSelect(checkpoint.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        {isCompleted ? (
                          <CheckCircle className="w-6 h-6 text-tactical-green fill-tactical-green/20" />
                        ) : canAccess ? (
                          <Circle className="w-6 h-6 text-tactical-blue" />
                        ) : (
                          <Circle className="w-6 h-6 text-tactical-red" />
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-medium">{checkpoint.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            #{index + 1}
                          </Badge>
                        </div>
                        
                        {checkpoint.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {checkpoint.description}
                          </p>
                        )}
                        
                        <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                          {checkpoint.qr_code && (
                            <div className="flex items-center space-x-1">
                              <QrCode className="w-3 h-3" />
                              <span>QR Code</span>
                            </div>
                          )}
                          
                          {checkpoint.checklist_items && Array.isArray(checkpoint.checklist_items) && checkpoint.checklist_items.length > 0 && (
                            <div className="flex items-center space-x-1">
                              <CheckCircle className="w-3 h-3" />
                              <span>{Array.isArray(checkpoint.checklist_items) ? checkpoint.checklist_items.length : 0} itens</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <Badge className="bg-tactical-green hover:bg-tactical-green text-white border-tactical-green">
                          ✓ Concluído
                        </Badge>
                      ) : canAccess ? (
                        <Button
                          size="sm"
                          className="bg-tactical-blue hover:bg-tactical-blue/90 text-white border-tactical-blue shadow-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCheckpointSelect(checkpoint.id);
                          }}
                        >
                          <QrCode className="w-4 h-4 mr-2" />
                          Escanear QR
                        </Button>
                      ) : (
                        <Badge className="bg-tactical-red hover:bg-tactical-red text-white border-tactical-red">
                          ⏳ Aguardando
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {checkpoints.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhum ponto de ronda encontrado
            </h3>
            <p className="text-muted-foreground">
              Este cliente não possui pontos de ronda configurados.
            </p>
          </div>
        )}

        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium text-foreground mb-2">Instruções:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Complete os pontos de ronda em ordem sequencial</li>
            <li>• Cada ponto deve ser escaneado, fotografado e ter o checklist completado</li>
            <li>• O próximo ponto só será liberado após completar o anterior</li>
            <li>• Pontos concluídos ficam marcados em verde</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RoundCheckpointsList;