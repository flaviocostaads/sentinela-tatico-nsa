import { useState, useEffect } from "react";
import { Clock, MapPin, User, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Round } from "@/types";

interface ActiveRoundsCardProps {
  onRoundSelect?: (round: Round) => void;
}

const statusConfig = {
  active: {
    color: "bg-tactical-green",
    label: "Em Andamento",
    textColor: "text-tactical-green"
  },
  pending: {
    color: "bg-tactical-amber", 
    label: "Aguardando",
    textColor: "text-tactical-amber"
  },
  incident: {
    color: "bg-tactical-red",
    label: "Ocorrência",
    textColor: "text-tactical-red"
  },
  completed: {
    color: "bg-primary",
    label: "Concluída", 
    textColor: "text-primary"
  }
};

const ActiveRoundsCard = ({ onRoundSelect }: ActiveRoundsCardProps) => {
  const [activeRounds, setActiveRounds] = useState<Round[]>([]);

  useEffect(() => {
    fetchActiveRounds();
  }, []);

  const fetchActiveRounds = async () => {
    try {
      const { data: rounds, error } = await supabase
        .from("rounds")
        .select(`
          *,
          clients (name),
          profiles (name)
        `)
        .in("status", ["active", "incident"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      const transformedRounds: Round[] = rounds?.map(round => ({
        id: round.id,
        tacticId: round.user_id,
        tacticName: round.profiles?.name || 'N/A',
        clientName: round.clients?.name || 'N/A',
        clientId: round.client_id,
        status: round.status as any,
        startTime: round.start_time || new Date().toISOString(),
        endTime: round.end_time,
        vehicle: round.vehicle,
        route: [],
        checkpoints: [],
        checkpointVisits: [],
        incidents: [],
        createdAt: round.created_at
      })) || [];

      setActiveRounds(transformedRounds);
    } catch (error) {
      console.error("Error fetching active rounds:", error);
    }
  };

  const getCurrentLocation = (round: Round) => {
    return "Em andamento";
  };

  const getProgress = (round: Round) => {
    return { completed: 0, total: 1 };
  };

  return (
    <div className="p-6 rounded-lg border tactical-card bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Rondas Ativas</h3>
        <Badge variant="secondary" className="bg-primary/20 text-primary">
          {activeRounds.length} em andamento
        </Badge>
      </div>
      
      <ScrollArea className="h-80">
        <div className="space-y-3">
          {activeRounds.map((round) => {
            const progress = getProgress(round);
            return (
              <div
                key={round.id}
                className="p-4 rounded-lg border bg-background/50 hover:bg-background/70 transition-tactical cursor-pointer"
                onClick={() => onRoundSelect?.(round)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary/20 rounded-full">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{round.tacticName}</p>
                      <p className="text-sm text-muted-foreground">{round.clientName}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${statusConfig[round.status].color} pulse-tactical`}></div>
                    <span className={`text-xs font-medium ${statusConfig[round.status].textColor}`}>
                      {statusConfig[round.status].label}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Início: {round.startTime ? new Date(round.startTime).toLocaleTimeString('pt-BR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      }) : '-'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {round.vehicle === "car" ? "🚗" : "🏍️"} {getCurrentLocation(round)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {progress.completed}/{progress.total}
                    </span>
                  </div>
                  {round.status === "incident" && (
                    <AlertCircle className="h-4 w-4 text-tactical-red ml-2" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ActiveRoundsCard;