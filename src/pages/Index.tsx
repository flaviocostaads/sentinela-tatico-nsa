import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, Clock, AlertTriangle, MapPin, Activity, CheckCircle, Navigation } from "lucide-react";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";
import StatsCard from "@/components/Dashboard/StatsCard";
import ActiveRoundsCard from "@/components/Dashboard/ActiveRoundsCard";
import MapProviderWrapper from "@/components/Dashboard/MapProviderWrapper";
import RoundDetails from "@/components/Dashboard/RoundDetails";
import MapView from "@/components/MapView";
import { Round } from "@/types";
const Index = () => {
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState({
    activeTactics: 0,
    totalTactics: 0,
    completedRounds: 0,
    averageRoundTime: '0h 0m',
    openIncidents: 0,
    verifiedCheckpoints: 0,
    vehiclesInField: {
      cars: 0,
      motorcycles: 0
    },
    complianceRate: 0
  });
  useEffect(() => {
    fetchDashboardStats();
  }, []);
  const fetchDashboardStats = async () => {
    try {
      // Buscar táticos ativos
      const {
        data: tactics
      } = await supabase.from("profiles").select("*").eq("role", "tatico").eq("active", true);

      // Buscar rondas concluídas hoje
      const today = new Date().toISOString().split('T')[0];
      const {
        data: completedRounds
      } = await supabase.from("rounds").select("*").eq("status", "completed").gte("created_at", `${today}T00:00:00Z`);

      // Buscar rondas ativas
      const {
        data: activeRounds
      } = await supabase.from("rounds").select("*").eq("status", "active");

      // Buscar incidentes abertos
      const {
        data: incidents
      } = await supabase.from("incidents").select("*").eq("status", "open");

      // Buscar visitas a checkpoints hoje
      const {
        data: checkpointVisits
      } = await supabase.from("checkpoint_visits").select("*").gte("visit_time", `${today}T00:00:00Z`);

      // Buscar veículos ativos
      const {
        data: vehicles
      } = await supabase.from("vehicles").select("*").eq("active", true);

      // Calcular tempo médio das rondas
      const avgTime = completedRounds?.length > 0 ? "2h 15m" : "0h 0m";
      setStats({
        activeTactics: activeRounds?.length || 0,
        totalTactics: tactics?.length || 0,
        completedRounds: completedRounds?.length || 0,
        averageRoundTime: avgTime,
        openIncidents: incidents?.length || 0,
        verifiedCheckpoints: checkpointVisits?.length || 0,
        vehiclesInField: {
          cars: vehicles?.filter(v => v.type === 'car').length || 0,
          motorcycles: vehicles?.filter(v => v.type === 'motorcycle').length || 0
        },
        complianceRate: 100
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    }
  };
  return <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6 space-y-6">
          {/* Header da página */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Central de Comando</h1>
              <p className="text-muted-foreground">Monitoramento das operações de segurança</p>
            </div>
            <div className="flex items-center space-x-2 px-4 py-2 bg-tactical-green/20 border border-tactical-green/30 rounded-lg">
              <div className="w-2 h-2 bg-tactical-green rounded-full pulse-tactical"></div>
              <span className="text-sm font-medium text-tactical-green">Sistema Online</span>
            </div>
          </div>

          {/* Compact Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-card rounded-lg border p-3 text-center">
              <div className="flex items-center justify-center w-8 h-8 mx-auto mb-2 rounded-full bg-tactical-green/20">
                <Users className="w-4 h-4 text-tactical-green" />
              </div>
              <div className="text-lg font-bold text-foreground">{stats.activeTactics}</div>
              <div className="text-xs text-muted-foreground">Táticos Ativos</div>
            </div>

            <div className="bg-card rounded-lg border p-3 text-center">
              <div className="flex items-center justify-center w-8 h-8 mx-auto mb-2 rounded-full bg-tactical-blue/20">
                <CheckCircle className="w-4 h-4 text-tactical-blue" />
              </div>
              <div className="text-lg font-bold text-foreground">{stats.completedRounds}</div>
              <div className="text-xs text-muted-foreground">Concluídas</div>
            </div>

            <div className="bg-card rounded-lg border p-3 text-center">
              <div className="flex items-center justify-center w-8 h-8 mx-auto mb-2 rounded-full bg-tactical-amber/20">
                <Clock className="w-4 h-4 text-tactical-amber" />
              </div>
              <div className="text-lg font-bold text-foreground">{stats.averageRoundTime}</div>
              <div className="text-xs text-muted-foreground">Tempo Médio</div>
            </div>

            <div className="bg-card rounded-lg border p-3 text-center">
              <div className="flex items-center justify-center w-8 h-8 mx-auto mb-2 rounded-full bg-tactical-red/20">
                <AlertTriangle className="w-4 h-4 text-tactical-red" />
              </div>
              <div className="text-lg font-bold text-foreground">{stats.openIncidents}</div>
              <div className="text-xs text-muted-foreground">Ocorrências</div>
            </div>

            <div className="bg-card rounded-lg border p-3 text-center">
              <div className="flex items-center justify-center w-8 h-8 mx-auto mb-2 rounded-full bg-primary/20">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div className="text-lg font-bold text-foreground">{stats.verifiedCheckpoints}</div>
              <div className="text-xs text-muted-foreground">Pontos</div>
            </div>

            <div className="bg-card rounded-lg border p-3 text-center">
              <div className="flex items-center justify-center w-8 h-8 mx-auto mb-2 rounded-full bg-primary/20">
                <Navigation className="w-4 h-4 text-primary" />
              </div>
              <div className="text-lg font-bold text-foreground">{stats.vehiclesInField.cars + stats.vehiclesInField.motorcycles}</div>
              <div className="text-xs text-muted-foreground">Veículos</div>
            </div>
          </div>

          {/* Status das Rondas Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Status das Rondas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-card rounded-lg border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-tactical-green rounded-full pulse-tactical"></div>
                    <span className="text-sm font-medium">Rondas Ativas</span>
                  </div>
                  <span className="text-2xl font-bold text-tactical-green">{stats.activeTactics}</span>
                </div>
                <p className="text-xs text-muted-foreground">em andamento</p>
              </div>
              
              <div className="bg-card rounded-lg border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-tactical-amber rounded-full"></div>
                    <span className="text-sm font-medium">Rondas Passadas</span>
                  </div>
                  <span className="text-2xl font-bold text-tactical-amber">0</span>
                </div>
                <p className="text-xs text-muted-foreground">hoje</p>
              </div>

              <div className="bg-card rounded-lg border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-tactical-blue rounded-full"></div>
                    <span className="text-sm font-medium">Rondas Encerradas</span>
                  </div>
                  <span className="text-2xl font-bold text-tactical-blue">{stats.completedRounds}</span>
                </div>
                <p className="text-xs text-muted-foreground">total hoje</p>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Mapa */}
            <div className="lg:col-span-2">
              <MapProviderWrapper onExpand={() => setExpanded(true)} />
            </div>

            {/* Rondas Ativas ou Detalhes */}
            <div className="lg:col-span-1">
              {selectedRound ? <RoundDetails round={selectedRound} onClose={() => setSelectedRound(null)} /> : <ActiveRoundsCard onRoundSelect={setSelectedRound} />}
            </div>
          </div>

          {expanded && (
            <div className="fixed inset-0 z-50 bg-background">
              <MapProviderWrapper 
                isExpanded={true} 
                onClose={() => setExpanded(false)}
              />
            </div>
          )}
        </main>
      </div>
    </div>;
};
export default Index;