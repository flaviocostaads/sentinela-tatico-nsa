import { useState, useEffect } from "react";
import { BarChart3, PieChart, TrendingUp, Download, Calendar, Filter, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface ReportData {
  totalRounds: number;
  completedRounds: number;
  incidentRounds: number;
  activeRounds: number;
  averageDuration: number;
  clientsServed: number;
  tacticsActive: number;
  complianceRate: number;
}

interface ClientReport {
  client_id: string;
  client_name: string;
  total_rounds: number;
  completed_rounds: number;
  incident_rounds: number;
  average_duration: number;
}

interface TacticReport {
  user_id: string;
  tactic_name: string;
  total_rounds: number;
  completed_rounds: number;
  incident_rounds: number;
  average_duration: number;
}

const Reports = () => {
  const [reportData, setReportData] = useState<ReportData>({
    totalRounds: 0,
    completedRounds: 0,
    incidentRounds: 0,
    activeRounds: 0,
    averageDuration: 0,
    clientsServed: 0,
    tacticsActive: 0,
    complianceRate: 0
  });
  const [clientReports, setClientReports] = useState<ClientReport[]>([]);
  const [tacticReports, setTacticReports] = useState<TacticReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    reportType: 'general'
  });
  const { toast } = useToast();

  useEffect(() => {
    generateReports();
  }, [filters]);

  const generateReports = async () => {
    setLoading(true);
    try {
      await Promise.all([
        generateGeneralReport(),
        generateClientReports(),
        generateTacticReports()
      ]);
    } catch (error) {
      console.error("Error generating reports:", error);
      toast({
        title: "Erro",
        description: "Erro ao gerar relatórios",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateGeneralReport = async () => {
    try {
      let query = supabase.from("rounds").select("*");
      
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo + 'T23:59:59');
      }

      const { data: rounds, error } = await query;
      if (error) throw error;

      const totalRounds = rounds?.length || 0;
      const completedRounds = rounds?.filter(r => r.status === 'completed').length || 0;
      const incidentRounds = rounds?.filter(r => r.status === 'incident').length || 0;
      const activeRounds = rounds?.filter(r => r.status === 'active').length || 0;

      // Calcular duração média
      const completedWithDuration = rounds?.filter(r => r.status === 'completed' && r.start_time && r.end_time) || [];
      const avgDuration = completedWithDuration.length > 0 
        ? completedWithDuration.reduce((acc, round) => {
            const start = new Date(round.start_time!);
            const end = new Date(round.end_time!);
            return acc + (end.getTime() - start.getTime());
          }, 0) / completedWithDuration.length / 1000 / 60 // em minutos
        : 0;

      // Buscar clientes únicos
      const { data: clients } = await supabase.from("clients").select("id").eq("active", true);
      const clientsServed = new Set(rounds?.map(r => r.client_id)).size;

      // Buscar táticos únicos
      const { data: tactics } = await supabase.from("profiles").select("id").eq("role", "tatico").eq("active", true);
      const tacticsActive = tactics?.length || 0;

      const complianceRate = totalRounds > 0 ? (completedRounds / totalRounds) * 100 : 0;

      setReportData({
        totalRounds,
        completedRounds,
        incidentRounds,
        activeRounds,
        averageDuration: avgDuration,
        clientsServed,
        tacticsActive,
        complianceRate
      });
    } catch (error) {
      console.error("Error generating general report:", error);
    }
  };

  const generateClientReports = async () => {
    try {
      let query = supabase.from("rounds").select(`
        *,
        clients (name)
      `);
      
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo + 'T23:59:59');
      }

      const { data: rounds, error } = await query;
      if (error) throw error;

      const clientData = rounds?.reduce((acc: any, round) => {
        const clientId = round.client_id;
        if (!acc[clientId]) {
          acc[clientId] = {
            client_id: clientId,
            client_name: round.clients?.name || 'N/A',
            total_rounds: 0,
            completed_rounds: 0,
            incident_rounds: 0,
            durations: []
          };
        }
        
        acc[clientId].total_rounds++;
        if (round.status === 'completed') {
          acc[clientId].completed_rounds++;
          if (round.start_time && round.end_time) {
            const duration = (new Date(round.end_time).getTime() - new Date(round.start_time).getTime()) / 1000 / 60;
            acc[clientId].durations.push(duration);
          }
        }
        if (round.status === 'incident') {
          acc[clientId].incident_rounds++;
        }
        
        return acc;
      }, {}) || {};

      const reports = Object.values(clientData).map((client: any) => ({
        ...client,
        average_duration: client.durations.length > 0 
          ? client.durations.reduce((a: number, b: number) => a + b, 0) / client.durations.length 
          : 0
      }));

      setClientReports(reports);
    } catch (error) {
      console.error("Error generating client reports:", error);
    }
  };

  const generateTacticReports = async () => {
    try {
      let query = supabase.from("rounds").select(`
        *,
        profiles (name)
      `);
      
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo + 'T23:59:59');
      }

      const { data: rounds, error } = await query;
      if (error) throw error;

      const tacticData = rounds?.reduce((acc: any, round) => {
        const userId = round.user_id;
        if (!acc[userId]) {
          acc[userId] = {
            user_id: userId,
            tactic_name: round.profiles?.name || 'N/A',
            total_rounds: 0,
            completed_rounds: 0,
            incident_rounds: 0,
            durations: []
          };
        }
        
        acc[userId].total_rounds++;
        if (round.status === 'completed') {
          acc[userId].completed_rounds++;
          if (round.start_time && round.end_time) {
            const duration = (new Date(round.end_time).getTime() - new Date(round.start_time).getTime()) / 1000 / 60;
            acc[userId].durations.push(duration);
          }
        }
        if (round.status === 'incident') {
          acc[userId].incident_rounds++;
        }
        
        return acc;
      }, {}) || {};

      const reports = Object.values(tacticData).map((tactic: any) => ({
        ...tactic,
        average_duration: tactic.durations.length > 0 
          ? tactic.durations.reduce((a: number, b: number) => a + b, 0) / tactic.durations.length 
          : 0
      }));

      setTacticReports(reports);
    } catch (error) {
      console.error("Error generating tactic reports:", error);
    }
  };

  const exportReport = (type: string) => {
    let data: any[] = [];
    let filename = '';

    switch (type) {
      case 'general':
        data = [reportData];
        filename = 'relatorio_geral';
        break;
      case 'clients':
        data = clientReports;
        filename = 'relatorio_clientes';
        break;
      case 'tactics':
        data = tacticReports;
        filename = 'relatorio_taticos';
        break;
    }

    if (data.length === 0) return;

    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
              <p className="text-muted-foreground">
                Análise detalhada do desempenho das rondas e operações
              </p>
            </div>
          </div>

          {/* Filtros */}
          <Card className="tactical-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Filter className="w-5 h-5" />
                <span>Filtros</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Relatório</Label>
                  <Select value={filters.reportType} onValueChange={(value) => setFilters({ ...filters, reportType: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">Geral</SelectItem>
                      <SelectItem value="clients">Por Cliente</SelectItem>
                      <SelectItem value="tactics">Por Tático</SelectItem>
                      <SelectItem value="performance">Performance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex gap-2 items-end">
                  <Button 
                    variant="outline" 
                    onClick={() => setFilters({ dateFrom: '', dateTo: '', reportType: 'general' })}
                    className="flex-1"
                  >
                    Limpar Filtros
                  </Button>
                  <Button onClick={generateReports} className="flex-1">
                    Pesquisar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="clients">Por Cliente</TabsTrigger>
              <TabsTrigger value="tactics">Por Tático</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Métricas gerais */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5 text-tactical-blue" />
                      <span className="text-sm text-muted-foreground">Total de Rondas</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{reportData.totalRounds}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5 text-tactical-green" />
                      <span className="text-sm text-muted-foreground">Concluídas</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{reportData.completedRounds}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <PieChart className="w-5 h-5 text-tactical-red" />
                      <span className="text-sm text-muted-foreground">Com Incidentes</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{reportData.incidentRounds}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-tactical-amber" />
                      <span className="text-sm text-muted-foreground">Taxa de Sucesso</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{reportData.complianceRate.toFixed(1)}%</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="tactical-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Resumo Operacional</CardTitle>
                      <Button size="sm" onClick={() => exportReport('general')}>
                        <Download className="w-4 h-4 mr-2" />
                        Exportar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duração Média:</span>
                      <span className="font-medium">{formatDuration(reportData.averageDuration)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clientes Atendidos:</span>
                      <span className="font-medium">{reportData.clientsServed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Táticos Ativos:</span>
                      <span className="font-medium">{reportData.tacticsActive}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rondas Ativas:</span>
                      <span className="font-medium">{reportData.activeRounds}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="tactical-card">
                  <CardHeader>
                    <CardTitle>Distribuição por Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-tactical-green rounded-full"></div>
                          <span className="text-sm">Concluídas</span>
                        </div>
                        <span className="text-sm font-medium">{reportData.completedRounds}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-tactical-blue rounded-full"></div>
                          <span className="text-sm">Ativas</span>
                        </div>
                        <span className="text-sm font-medium">{reportData.activeRounds}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-tactical-red rounded-full"></div>
                          <span className="text-sm">Com Incidentes</span>
                        </div>
                        <span className="text-sm font-medium">{reportData.incidentRounds}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="clients" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold">Relatório por Cliente</h3>
                <Button onClick={() => exportReport('clients')}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar CSV
                </Button>
              </div>
              
              <div className="space-y-4">
                {clientReports.map((client) => (
                  <Card key={client.client_id} className="tactical-card">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                        <div>
                          <h4 className="font-medium">{client.client_name}</h4>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-foreground">{client.total_rounds}</p>
                          <p className="text-sm text-muted-foreground">Total</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-tactical-green">{client.completed_rounds}</p>
                          <p className="text-sm text-muted-foreground">Concluídas</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-tactical-red">{client.incident_rounds}</p>
                          <p className="text-sm text-muted-foreground">Incidentes</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-medium">{formatDuration(client.average_duration)}</p>
                          <p className="text-sm text-muted-foreground">Duração Média</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="tactics" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold">Relatório por Tático</h3>
                <Button onClick={() => exportReport('tactics')}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar CSV
                </Button>
              </div>
              
              <div className="space-y-4">
                {tacticReports.map((tactic) => (
                  <Card key={tactic.user_id} className="tactical-card">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                        <div>
                          <h4 className="font-medium">{tactic.tactic_name}</h4>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-foreground">{tactic.total_rounds}</p>
                          <p className="text-sm text-muted-foreground">Total</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-tactical-green">{tactic.completed_rounds}</p>
                          <p className="text-sm text-muted-foreground">Concluídas</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-tactical-red">{tactic.incident_rounds}</p>
                          <p className="text-sm text-muted-foreground">Incidentes</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-medium">{formatDuration(tactic.average_duration)}</p>
                          <p className="text-sm text-muted-foreground">Duração Média</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5 text-tactical-green" />
                      <span className="text-sm text-muted-foreground">Eficiência</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{reportData.complianceRate.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Taxa de conclusão</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5 text-tactical-blue" />
                      <span className="text-sm text-muted-foreground">Produtividade</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {reportData.tacticsActive > 0 ? (reportData.totalRounds / reportData.tacticsActive).toFixed(1) : '0'}
                    </p>
                    <p className="text-xs text-muted-foreground">Rondas por tático</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <PieChart className="w-5 h-5 text-tactical-amber" />
                      <span className="text-sm text-muted-foreground">Qualidade</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {reportData.totalRounds > 0 ? ((reportData.totalRounds - reportData.incidentRounds) / reportData.totalRounds * 100).toFixed(1) : '0'}%
                    </p>
                    <p className="text-xs text-muted-foreground">Sem incidentes</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Reports;