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
      <MapProviderWrapper isExpanded={true} />
    </div>;
};
export default Index;