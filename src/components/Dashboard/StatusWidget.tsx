import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const StatusWidget = () => {
  const [stats, setStats] = useState({
    tacticsActive: 0,
    activeRounds: 0,
    openIncidents: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Get active tactics
      const { data: tactics } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "tatico")
        .eq("active", true);

      // Get active rounds
      const { data: rounds } = await supabase
        .from("rounds")
        .select("*")
        .eq("status", "active");

      // Get open incidents
      const { data: incidents } = await supabase
        .from("incidents")
        .select("*")
        .eq("status", "open");

      setStats({
        tacticsActive: tactics?.length || 0,
        activeRounds: rounds?.length || 0,
        openIncidents: incidents?.length || 0
      });
    } catch (error) {
      console.error("Error fetching status stats:", error);
    }
  };

  return (
    <div className="mb-6 p-4 bg-gradient-tactical rounded-lg tactical-card border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-card-foreground">Status Geral</span>
        <div className="w-2 h-2 bg-tactical-green rounded-full pulse-tactical"></div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Táticos Ativos</span>
          <span className="text-tactical-green font-medium">{stats.tacticsActive}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Rondas em Curso</span>
          <span className="text-tactical-blue font-medium">{stats.activeRounds}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Ocorrências</span>
          <span className="text-tactical-amber font-medium">{stats.openIncidents}</span>
        </div>
      </div>
    </div>
  );
};

export default StatusWidget;