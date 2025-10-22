import { useState, useEffect } from "react";
import { AlertTriangle, MapPin, Clock, Plus, Camera, FileText, Filter, Video, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import IncidentDetailsDialog from "@/components/TacticApp/IncidentDetailsDialog";
import AdminEmergencyAlert from "@/components/Dashboard/AdminEmergencyAlert";

interface Incident {
  id: string;
  round_id: string;
  title: string;
  description?: string;
  type: 'security' | 'maintenance' | 'emergency' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  lat?: number;
  lng?: number;
  reported_at: string;
  investigation_report?: string;
  investigation_completed_at?: string;
  investigated_by?: string;
  resolution_comment?: string;
  resolved_at?: string;
  resolved_by?: string;
  rounds?: {
    clients: {
      name: string;
    };
    profiles: {
      name: string;
    };
  };
}

interface Round {
  id: string;
  client_id: string;
  clients: {
    name: string;
  };
  profiles?: {
    name: string;
  } | null;
}

const Incidents = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filteredIncidents, setFilteredIncidents] = useState<Incident[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [formData, setFormData] = useState({
    round_id: "",
    title: "",
    description: "",
    type: "other",
    priority: "medium",
    lat: "",
    lng: ""
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    type: 'all',
    dateFrom: '',
    dateTo: ''
  });
  const { toast } = useToast();
  const { profile } = useAuth();

  useEffect(() => {
    fetchIncidents();
    fetchActiveRounds();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [incidents, filters]);

  const fetchIncidents = async () => {
    try {
      const { data, error } = await supabase
        .from("incidents")
        .select(`
          *,
          rounds (
            clients (name),
            profiles (name)
          )
        `)
        .order("reported_at", { ascending: false });

      if (error) throw error;
      setIncidents(data || []);
    } catch (error) {
      console.error("Error fetching incidents:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar ocorrências",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveRounds = async () => {
    try {
      const { data, error } = await supabase
        .from("rounds")
        .select(`
          id,
          client_id,
          clients (name),
          profiles (name)
        `)
        .in('status', ['active', 'incident'])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRounds(data || []);
    } catch (error) {
      console.error("Error fetching rounds:", error);
    }
  };

  const applyFilters = () => {
    let filtered = [...incidents];

    if (filters.status !== 'all') {
      filtered = filtered.filter(incident => incident.status === filters.status);
    }

    if (filters.priority !== 'all') {
      filtered = filtered.filter(incident => incident.priority === filters.priority);
    }

    if (filters.type !== 'all') {
      filtered = filtered.filter(incident => incident.type === filters.type);
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(incident => 
        new Date(incident.reported_at) >= new Date(filters.dateFrom)
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(incident => 
        new Date(incident.reported_at) <= new Date(filters.dateTo + 'T23:59:59')
      );
    }

    setFilteredIncidents(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const incidentData = {
        round_id: formData.round_id,
        title: formData.title,
        description: formData.description,
        type: formData.type as 'security' | 'maintenance' | 'emergency' | 'other',
        priority: formData.priority as 'low' | 'medium' | 'high' | 'critical',
        lat: formData.lat ? parseFloat(formData.lat) : null,
        lng: formData.lng ? parseFloat(formData.lng) : null,
        status: 'open'
      };

      const { error } = await supabase
        .from("incidents")
        .insert([incidentData]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Ocorrência registrada com sucesso!",
      });

      setDialogOpen(false);
      setFormData({
        round_id: "",
        title: "",
        description: "",
        type: "other",
        priority: "medium",
        lat: "",
        lng: ""
      });
      fetchIncidents();
    } catch (error) {
      console.error("Error creating incident:", error);
      toast({
        title: "Erro",
        description: "Erro ao registrar ocorrência",
        variant: "destructive",
      });
    }
  };

  const updateIncidentStatus = async (incidentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("incidents")
        .update({ status: newStatus })
        .eq("id", incidentId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Status da ocorrência atualizado",
      });

      fetchIncidents();
    } catch (error) {
      console.error("Error updating incident:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status",
        variant: "destructive",
      });
    }
  };

  const deleteIncident = async (incidentId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta ocorrência? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("name, role")
        .eq("user_id", userData.user.id)
        .single();

      if (profileError) throw profileError;

      if (profileData.role !== 'admin') {
        toast({
          title: "Acesso negado",
          description: "Apenas administradores podem excluir ocorrências",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.rpc('delete_incident_with_audit', {
        p_incident_id: incidentId,
        p_admin_user_id: userData.user.id,
        p_admin_name: profileData.name
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: data,
      });

      fetchIncidents();
    } catch (error: any) {
      console.error("Error deleting incident:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir ocorrência",
        variant: "destructive",
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-tactical-red text-white';
      case 'medium': return 'bg-tactical-amber text-white';
      case 'low': return 'bg-tactical-green text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'security': return 'Segurança';
      case 'maintenance': return 'Manutenção';
      case 'emergency': return 'Emergência';
      case 'other': return 'Outro';
      default: return type;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'critical': return 'Crítica';
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-600 text-white';
      case 'investigating': return 'bg-yellow-600 text-white';
      case 'resolved': return 'bg-green-600 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberta';
      case 'investigating': return 'Investigada';
      case 'resolved': return 'Resolvida';
      default: return status;
    }
  };

  const showIncidentDetails = (incident: Incident) => {
    setSelectedIncident(incident);
    setDetailsOpen(true);
  };

  const handleIncidentRefresh = () => {
    fetchIncidents();
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      priority: 'all',
      type: 'all',
      dateFrom: '',
      dateTo: ''
    });
  };

  const openIncidents = filteredIncidents.filter(i => i.status === 'open');
  const investigatingIncidents = filteredIncidents.filter(i => i.status === 'investigating');
  const resolvedIncidents = filteredIncidents.filter(i => i.status === 'resolved');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminEmergencyAlert />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Gestão de Ocorrências</h1>
              <p className="text-muted-foreground">
                Registre e gerencie todas as ocorrências durante as rondas
              </p>
            </div>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-tactical-red hover:bg-tactical-red/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Ocorrência
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Registrar Nova Ocorrência</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="round">Ronda</Label>
                      <Select value={formData.round_id} onValueChange={(value) => setFormData({ ...formData, round_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma ronda" />
                        </SelectTrigger>
                        <SelectContent>
                          {rounds.map((round) => (
                            <SelectItem key={round.id} value={round.id}>
                              {round.clients.name} - {round.profiles?.name || 'Não atribuído'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Tipo</Label>
                      <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="security">Segurança</SelectItem>
                          <SelectItem value="maintenance">Manutenção</SelectItem>
                          <SelectItem value="emergency">Emergência</SelectItem>
                          <SelectItem value="other">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Prioridade</Label>
                      <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baixa</SelectItem>
                          <SelectItem value="medium">Média</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="critical">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">Título</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Título da ocorrência"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descreva detalhadamente a ocorrência..."
                      rows={4}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lat">Latitude (opcional)</Label>
                      <Input
                        id="lat"
                        type="number"
                        step="any"
                        value={formData.lat}
                        onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                        placeholder="-10.1849"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lng">Longitude (opcional)</Label>
                      <Input
                        id="lng"
                        type="number"
                        step="any"
                        value={formData.lng}
                        onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                        placeholder="-48.3336"
                      />
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full bg-tactical-red hover:bg-tactical-red/90">
                    Registrar Ocorrência
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
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
                      <SelectItem value="open">Aberta</SelectItem>
                      <SelectItem value="investigating">Investigando</SelectItem>
                      <SelectItem value="resolved">Resolvida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={filters.priority} onValueChange={(value) => setFilters({ ...filters, priority: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="critical">Crítica</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="low">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={filters.type} onValueChange={(value) => setFilters({ ...filters, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="security">Segurança</SelectItem>
                      <SelectItem value="maintenance">Manutenção</SelectItem>
                      <SelectItem value="emergency">Emergência</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
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
              </div>
              <div className="mt-4">
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
                  <div className="w-3 h-3 bg-tactical-red rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Abertas</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{openIncidents.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-tactical-amber rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Investigando</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{investigatingIncidents.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-tactical-green rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Resolvidas</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{resolvedIncidents.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-muted rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Total</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{filteredIncidents.length}</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="all" className="space-y-6">
            <TabsList>
              <TabsTrigger value="all">Todas ({filteredIncidents.length})</TabsTrigger>
              <TabsTrigger value="open">Abertas ({openIncidents.length})</TabsTrigger>
              <TabsTrigger value="investigating">Investigando ({investigatingIncidents.length})</TabsTrigger>
              <TabsTrigger value="resolved">Resolvidas ({resolvedIncidents.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {filteredIncidents.map((incident) => (
                <Card key={incident.id} className="tactical-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <AlertTriangle className="w-5 h-5 text-tactical-red" />
                        <div>
                          <CardTitle className="text-lg">{incident.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {incident.rounds?.clients.name} - {incident.rounds?.profiles?.name || 'Não atribuído'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getPriorityColor(incident.priority)}>
                          {getPriorityLabel(incident.priority)}
                        </Badge>
                        <Badge className={getStatusColor(incident.status)}>
                          {getStatusLabel(incident.status)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Tipo: {getTypeLabel(incident.type)}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {new Date(incident.reported_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {incident.lat && incident.lng && (
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        {incident.description && (
                          <div className="mb-3">
                            <p className="text-sm">{incident.description}</p>
                          </div>
                        )}
                        <div className="flex space-x-2">
                          {incident.status === 'open' && (
                            <Button
                              size="sm"
                              className="bg-tactical-amber hover:bg-tactical-amber/90"
                              onClick={() => updateIncidentStatus(incident.id, 'investigating')}
                            >
                              Investigar
                            </Button>
                          )}
                          {incident.status === 'investigating' && (
                            <Button
                              size="sm"
                              className="bg-tactical-green hover:bg-tactical-green/90"
                              onClick={() => updateIncidentStatus(incident.id, 'resolved')}
                            >
                              Resolver
                            </Button>
                          )}
                          {incident.status === 'resolved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateIncidentStatus(incident.id, 'open')}
                            >
                              Reabrir
                            </Button>
                          )}
                           <Button
                             size="sm"
                             variant="outline"
                             onClick={() => showIncidentDetails(incident)}
                           >
                             Ver Detalhes
                           </Button>
                          {profile?.role === 'admin' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteIncident(incident.id)}
                              className="ml-2"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Excluir
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="open" className="space-y-4">
              {openIncidents.map((incident) => (
                <Card key={incident.id} className="tactical-card border-l-4 border-l-tactical-red">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{incident.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {incident.rounds?.clients.name} - {new Date(incident.reported_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getPriorityColor(incident.priority)}>
                          {getPriorityLabel(incident.priority)}
                        </Badge>
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => showIncidentDetails(incident)}
                         >
                           Ver Detalhes
                         </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="investigating" className="space-y-4">
              {investigatingIncidents.map((incident) => (
                <Card key={incident.id} className="tactical-card border-l-4 border-l-tactical-amber">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{incident.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {incident.rounds?.clients.name} - {new Date(incident.reported_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getPriorityColor(incident.priority)}>
                          {getPriorityLabel(incident.priority)}
                        </Badge>
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => showIncidentDetails(incident)}
                         >
                           Ver Detalhes
                         </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="resolved" className="space-y-4">
              {resolvedIncidents.map((incident) => (
                <Card key={incident.id} className="tactical-card border-l-4 border-l-tactical-green">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{incident.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {incident.rounds?.clients.name} - {new Date(incident.reported_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                       <div className="flex items-center space-x-2">
                         <Badge className={getPriorityColor(incident.priority)}>
                           {getPriorityLabel(incident.priority)}
                         </Badge>
                         <Badge className="bg-green-600 text-white">
                           Resolvida
                         </Badge>
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => showIncidentDetails(incident)}
                         >
                           Ver Detalhes
                         </Button>
                       </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>

          {filteredIncidents.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma ocorrência encontrada</p>
            </div>
          )}
        </main>
      </div>
      
      {/* Incident Details Dialog */}
      {selectedIncident && (
        <IncidentDetailsDialog
          open={detailsOpen}
          onClose={() => {
            setDetailsOpen(false);
            setSelectedIncident(null);
          }}
          incident={selectedIncident}
          onRefresh={handleIncidentRefresh}
        />
      )}
    </div>
  );
};

export default Incidents;