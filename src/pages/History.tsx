import { useState, useEffect } from "react";
import { Clock, MapPin, CheckCircle, AlertTriangle, Filter, Download, Calendar, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import EnhancedRoundDetails from "@/components/Dashboard/EnhancedRoundDetails";

interface Round {
  id: string;
  template_id?: string;
  client_id: string;
  user_id: string;
  vehicle: 'car' | 'motorcycle';
  status: 'pending' | 'active' | 'completed' | 'incident';
  start_time?: string;
  end_time?: string;
  start_odometer?: number;
  end_odometer?: number;
  created_at: string;
  clients: {
    name: string;
    address: string;
  };
  profiles: {
    name: string;
  };
  round_templates?: {
    name: string;
    shift_type: string;
    description?: string;
  };
}

interface CheckpointVisit {
  id: string;
  round_id: string;
  checkpoint_id: string;
  visit_time: string;
  duration: number;
  status: string;
  checkpoints: {
    name: string;
  };
}

interface Incident {
  id: string;
  round_id: string;
  title: string;
  description?: string;
  type: string;
  priority: string;
  status: string;
  reported_at: string;
}

const History = () => {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [filteredRounds, setFilteredRounds] = useState<Round[]>([]);
  const [checkpointVisits, setCheckpointVisits] = useState<CheckpointVisit[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    dateFrom: '',
    dateTo: '',
    client: '',
    tactic: ''
  });
  const { toast } = useToast();
  const { profile } = useAuth();

  useEffect(() => {
    fetchRounds();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [rounds, filters]);

  const fetchRounds = async () => {
    try {
      const { data, error } = await supabase
        .from("rounds")
        .select(`
          *,
          clients (name, address),
          profiles (name),
          round_templates (name, shift_type, description)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRounds(data || []);
    } catch (error) {
      console.error("Error fetching rounds:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar histórico",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRoundDetails = async (roundId: string) => {
    try {
      // Buscar visitas aos checkpoints
      const { data: visits, error: visitsError } = await supabase
        .from("checkpoint_visits")
        .select(`
          *,
          checkpoints (name)
        `)
        .eq("round_id", roundId)
        .order("visit_time");

      if (visitsError) throw visitsError;
      setCheckpointVisits(visits || []);

      // Buscar incidentes
      const { data: incidentsData, error: incidentsError } = await supabase
        .from("incidents")
        .select("*")
        .eq("round_id", roundId)
        .order("reported_at");

      if (incidentsError) throw incidentsError;
      setIncidents(incidentsData || []);
    } catch (error) {
      console.error("Error fetching round details:", error);
    }
  };

  const applyFilters = () => {
    let filtered = [...rounds];

    if (filters.status !== 'all') {
      filtered = filtered.filter(round => round.status === filters.status);
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(round => 
        new Date(round.created_at) >= new Date(filters.dateFrom)
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(round => 
        new Date(round.created_at) <= new Date(filters.dateTo + 'T23:59:59')
      );
    }

    if (filters.client) {
      filtered = filtered.filter(round => 
        round.clients.name.toLowerCase().includes(filters.client.toLowerCase())
      );
    }

    if (filters.tactic) {
      filtered = filtered.filter(round => 
        round.profiles.name.toLowerCase().includes(filters.tactic.toLowerCase())
      );
    }

    setFilteredRounds(filtered);
  };

  const getStatusColor = (status: Round['status']) => {
    switch (status) {
      case 'active': return 'bg-tactical-green text-white';
      case 'pending': return 'bg-tactical-amber text-white';
      case 'incident': return 'bg-tactical-red text-white';
      case 'completed': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: Round['status']) => {
    switch (status) {
      case 'active': return 'Ativa';
      case 'pending': return 'Pendente';
      case 'incident': return 'Incidente';
      case 'completed': return 'Concluída';
      default: return status;
    }
  };

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return '-';
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diff = Math.floor((end.getTime() - start.getTime()) / 1000 / 60);
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}h ${minutes}m`;
  };

  const exportData = () => {
    const csvData = filteredRounds.map(round => ({
      'Data/Hora': new Date(round.created_at).toLocaleString('pt-BR'),
      'Cliente': round.clients.name,
      'Tático': round.profiles.name,
      'Status': getStatusLabel(round.status),
      'Veículo': round.vehicle === 'car' ? 'Carro' : 'Moto',
      'Duração': formatDuration(round.start_time, round.end_time),
      'Início': round.start_time ? new Date(round.start_time).toLocaleString('pt-BR') : '-',
      'Fim': round.end_time ? new Date(round.end_time).toLocaleString('pt-BR') : '-'
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico_rondas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleRoundClick = (round: Round) => {
    setSelectedRound(round);
    fetchRoundDetails(round.id);
    setDetailsOpen(true);
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      dateFrom: '',
      dateTo: '',
      client: '',
      tactic: ''
    });
  };

  const handleDeleteRound = async (roundId: string, roundClient: string) => {
    if (!profile || profile.role !== 'admin') {
      toast({
        title: "Erro",
        description: "Apenas administradores podem excluir rondas",
        variant: "destructive",
      });
      return;
    }

    setDeleteLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('delete_round_with_audit', {
        p_round_id: roundId,
        p_admin_user_id: profile.user_id,
        p_admin_name: profile.name
      });

      if (error) throw error;

      toast({
        title: "Ronda Excluída",
        description: data || "Ronda excluída com sucesso",
      });

      // Refresh the rounds list
      fetchRounds();
      setDetailsOpen(false);
    } catch (error: any) {
      console.error("Error deleting round:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir ronda",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Histórico de Rondas</h1>
              <p className="text-muted-foreground">
                Consulte o histórico completo de todas as rondas realizadas
              </p>
            </div>
            <Button onClick={exportData} className="bg-tactical-blue hover:bg-tactical-blue/90">
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
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
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="incident">Incidente</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                  <Label>Cliente</Label>
                  <Input
                    placeholder="Filtrar por cliente"
                    value={filters.client}
                    onChange={(e) => setFilters({ ...filters, client: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tático</Label>
                  <Input
                    placeholder="Filtrar por tático"
                    value={filters.tactic}
                    onChange={(e) => setFilters({ ...filters, tactic: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-4 flex space-x-2">
                <Button onClick={applyFilters} className="bg-tactical-blue hover:bg-tactical-blue/90">
                  <Filter className="w-4 h-4 mr-2" />
                  Pesquisar
                </Button>
                <Button variant="outline" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-tactical-green" />
                  <span className="text-sm text-muted-foreground">Concluídas</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {filteredRounds.filter(r => r.status === 'completed').length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-tactical-red" />
                  <span className="text-sm text-muted-foreground">Com Incidentes</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {filteredRounds.filter(r => r.status === 'incident').length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-tactical-blue" />
                  <span className="text-sm text-muted-foreground">Duração Média</span>
                </div>
                <p className="text-2xl font-bold text-foreground">2h 45m</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-tactical-amber" />
                  <span className="text-sm text-muted-foreground">Total</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{filteredRounds.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Lista de rondas */}
          <div className="space-y-4">
            {filteredRounds.map((round) => (
              <Card 
                key={round.id} 
                className="tactical-card cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleRoundClick(round)}
              >
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                    <div className="space-y-1">
                      <p className="font-medium">{round.clients.name}</p>
                      <p className="text-sm text-muted-foreground">{round.profiles.name}</p>
                    </div>
                    <div>
                      <Badge className={getStatusColor(round.status)}>
                        {getStatusLabel(round.status)}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(round.created_at).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDuration(round.start_time, round.end_time)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {round.vehicle === 'car' ? 'Carro' : 'Moto'}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground truncate">
                          {round.clients.address}
                        </span>
                      </div>
                      {profile?.role === 'admin' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Ronda</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir esta ronda? Esta ação irá remover permanentemente todos os dados relacionados (checkpoints visitados, incidentes, fotos, etc.) e não pode ser desfeita.
                                <br /><br />
                                <strong>Cliente:</strong> {round.clients.name}
                                <br />
                                <strong>Tático:</strong> {round.profiles.name}
                                <br />
                                <strong>Data:</strong> {new Date(round.created_at).toLocaleDateString('pt-BR')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteRound(round.id, round.clients.name)}
                                disabled={deleteLoading}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                {deleteLoading ? "Excluindo..." : "Excluir"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredRounds.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma ronda encontrada com os filtros aplicados</p>
            </div>
          )}

          {/* Dialog de detalhes */}
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Detalhes da Ronda</DialogTitle>
              </DialogHeader>
              {selectedRound && (
                <EnhancedRoundDetails 
                  round={selectedRound} 
                  onClose={() => setDetailsOpen(false)}
                />
              )}
              
              {/* Admin Delete Button */}
              {profile?.role === 'admin' && selectedRound && (
                <div className="flex justify-end border-t pt-4 mt-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={deleteLoading}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {deleteLoading ? 'Excluindo...' : 'Excluir Ronda'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Ronda</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir esta ronda? Esta ação irá remover permanentemente todos os dados relacionados (checkpoints visitados, incidentes, fotos, etc.) e não pode ser desfeita.
                          <br /><br />
                          <strong>Cliente:</strong> {selectedRound.clients.name}
                          <br />
                          <strong>Tático:</strong> {selectedRound.profiles.name}
                          <br />
                          <strong>Data:</strong> {new Date(selectedRound.created_at).toLocaleDateString('pt-BR')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleDeleteRound(selectedRound.id, selectedRound.clients.name)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Excluir Permanentemente
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
};

export default History;