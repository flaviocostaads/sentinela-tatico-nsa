import { useState, useEffect } from "react";
import { Plus, Calendar, Clock, MapPin, User, Car, Route, Settings, Edit, Trash2, Play, Pause, AlertTriangle, Bike, Info, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RoundRouteDetails from "@/components/Dashboard/RoundRouteDetails";

interface Round {
  id: string;
  client_id: string;
  user_id: string;
  vehicle_id?: string;
  vehicle: 'car' | 'motorcycle' | 'on_foot';
  status: 'pending' | 'active' | 'completed' | 'incident';
  start_time?: string;
  end_time?: string;
  created_at: string;
  template_id?: string;
  round_number?: number;
  current_checkpoint_index?: number;
  clients: {
    name: string;
    address: string;
  };
  profiles?: {
    name: string;
  } | null;
  round_templates?: {
    name: string;
    active: boolean;
    description?: string;
  };
  vehicles?: {
    license_plate: string;
    brand: string;
    model: string;
  };
}

interface TemplateClient {
  id: string;
  name: string;
  address: string;
  checkpoints_count: number;
}

interface RoundTemplate {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  shift_type: string;
  requires_signature?: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  round_template_checkpoints: any[];
}

interface Client {
  id: string;
  name: string;
  address: string;
}

const Rounds = () => {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [templates, setTemplates] = useState<RoundTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [createRoundDialogOpen, setCreateRoundDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [templateClients, setTemplateClients] = useState<Record<string, TemplateClient[]>>({});
  const [routeDetailsOpen, setRouteDetailsOpen] = useState(false);
  const [selectedRouteTemplate, setSelectedRouteTemplate] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    template_id: ""
  });
  const [editingRound, setEditingRound] = useState<Round | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    template_ids: [] as string[],
    vehicle_id: ""
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRounds();
    fetchTemplates();
    fetchVehicles();
  }, []);

  useEffect(() => {
    // Fetch clients for each template
    templates.forEach(template => {
      if (template.id) {
        fetchTemplateClients(template.id);
      }
    });
  }, [templates]);

  const fetchRounds = async () => {
    try {
      const { data, error } = await supabase
        .from("rounds")
        .select(`
          *,
          clients (name, address),
          profiles (name),
          round_templates (name, active),
          vehicles (license_plate, brand, model)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRounds(data || []);
    } catch (error) {
      console.error("Error fetching rounds:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar rondas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("round_templates")
        .select(`
          *,
          round_template_checkpoints (
            id,
            client_id,
            order_index,
            estimated_duration_minutes,
            required_signature,
            clients (name, address)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar templates",
        variant: "destructive",
      });
    } finally {
      setTemplatesLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("active", true)
        .order("license_plate");

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    }
  };

  const fetchTemplateClients = async (templateId: string) => {
    try {
      const { data, error } = await supabase
        .from("round_template_checkpoints")
        .select(`
          client_id,
          clients (
            id,
            name,
            address,
            lat,
            lng
          )
        `)
        .eq("template_id", templateId);

      if (error) throw error;

      // Group by client and count checkpoints
      const clientMap = new Map<string, TemplateClient>();
      
      data?.forEach((item: any) => {
        const client = item.clients;
        if (client) {
          if (clientMap.has(client.id)) {
            const existing = clientMap.get(client.id)!;
            existing.checkpoints_count += 1;
          } else {
            clientMap.set(client.id, {
              id: client.id,
              name: client.name,
              address: client.address,
              checkpoints_count: 1
            });
          }
        }
      });

      setTemplateClients(prev => ({
        ...prev,
        [templateId]: Array.from(clientMap.values())
      }));
    } catch (error) {
      console.error("Error fetching template clients:", error);
    }
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

  const formatDuration = (startTime?: string) => {
    if (!startTime) return '-';
    const start = new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000 / 60);
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}h ${minutes}m`;
  };

  const handleNewRound = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.template_id) {
      toast({
        title: "Erro",
        description: "Selecione um template de ronda",
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedTemplate = templates.find(t => t.id === formData.template_id);
      
      if (!selectedTemplate) {
        throw new Error("Template não encontrado");
      }

      if (!selectedTemplate.round_template_checkpoints || selectedTemplate.round_template_checkpoints.length === 0) {
        toast({
          title: "Erro",
          description: "Template sem checkpoints configurados. Configure checkpoints antes de criar a ronda.",
          variant: "destructive",
        });
        return;
      }

      // Criar ronda sem user_id e sem veículo - disponível para todos os táticos
      const roundData = {
        template_id: formData.template_id,
        user_id: null, // NULL = disponível para qualquer tático
        vehicle_id: null, // Será escolhido pelo tático ao iniciar
        vehicle: null as any, // Será definido ao iniciar a ronda
        status: 'pending' as const,
        round_number: 1,
        client_id: selectedTemplate.round_template_checkpoints[0]?.client_id,
        current_checkpoint_index: 0,
        requires_signature: selectedTemplate.requires_signature || false
      };

      const { error: roundError } = await supabase
        .from("rounds")
        .insert([roundData]);

      if (roundError) throw roundError;

      toast({
        title: "Sucesso",
        description: "Ronda criada com sucesso! Disponível para todos os táticos.",
      });

      setCreateRoundDialogOpen(false);
      setFormData({ template_id: "" });
      fetchRounds();
    } catch (error) {
      console.error("Error creating rounds:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao criar rondas",
        variant: "destructive",
      });
    }
  };

  const toggleTemplateStatus = async (templateId: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from("round_templates")
        .update({ active })
        .eq("id", templateId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Template ${active ? 'ativado' : 'desativado'} com sucesso!`,
      });

      fetchTemplates();
    } catch (error) {
      console.error("Error updating template:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar template",
        variant: "destructive",
      });
    }
  };

  const updateRoundStatus = async (roundId: string, newStatus: Round['status']) => {
    // Verificar se todos os checkpoints obrigatórios foram visitados para status 'completed'
    if (newStatus === 'completed') {
      const round = rounds.find(r => r.id === roundId);
      if (round?.template_id) {
        // Buscar checkpoints obrigatórios do template
        const { data: templateCheckpoints, error: templateError } = await supabase
          .from("round_template_checkpoints")
          .select("*")
          .eq("template_id", round.template_id);
        
        if (templateError) {
          toast({
            title: "Erro",
            description: "Erro ao verificar checkpoints obrigatórios",
            variant: "destructive",
          });
          return;
        }

        // Buscar visitas realizadas
        const { data: visits, error: visitsError } = await supabase
          .from("checkpoint_visits")
          .select("*")
          .eq("round_id", roundId);

        if (visitsError) {
          toast({
            title: "Erro",
            description: "Erro ao verificar visitas realizadas",
            variant: "destructive",
          });
          return;
        }

        // Verificar se todos os checkpoints foram visitados
        const visitedCheckpoints = visits?.length || 0;
        const totalCheckpoints = templateCheckpoints?.length || 0;

        if (visitedCheckpoints < totalCheckpoints) {
          toast({
            title: "Ronda incompleta",
            description: `Apenas ${visitedCheckpoints} de ${totalCheckpoints} checkpoints foram visitados. Complete todos os pontos obrigatórios antes de finalizar.`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === 'active' && rounds.find(r => r.id === roundId)?.status === 'pending') {
        updateData.start_time = new Date().toISOString();
      }
      
      if (newStatus === 'completed') {
        updateData.end_time = new Date().toISOString();
      }

      const { error } = await supabase
        .from("rounds")
        .update(updateData)
        .eq("id", roundId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Status da ronda atualizado para ${getStatusLabel(newStatus)}`,
      });

      fetchRounds();
    } catch (error) {
      console.error("Error updating round status:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da ronda",
        variant: "destructive",
      });
    }
  };

  const deleteRound = async (roundId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta ronda?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from("rounds")
        .delete()
        .eq("id", roundId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Ronda excluída com sucesso!",
      });

      fetchRounds();
    } catch (error) {
      console.error("Error deleting round:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir ronda",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (round: Round) => {
    setEditingRound(round);
    setEditFormData({
      template_ids: round.template_id ? [round.template_id] : [],
      vehicle_id: round.vehicle_id || ""
    });
    setEditDialogOpen(true);
  };

  const updateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingRound || editFormData.template_ids.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um template para a ronda",
        variant: "destructive",
      });
      return;
    }

    try {
      // Atualizar apenas o template principal da ronda (primeiro selecionado)
      const { error } = await supabase
        .from("rounds")
        .update({
          template_id: editFormData.template_ids[0],
          vehicle_id: editFormData.vehicle_id
        })
        .eq("id", editingRound.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Ronda atualizada com sucesso!",
      });

      setEditDialogOpen(false);
      setEditingRound(null);
      setEditFormData({ template_ids: [], vehicle_id: "" });
      fetchRounds();
    } catch (error) {
      console.error("Error updating round:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar ronda",
        variant: "destructive",
      });
    }
  };

  const activeRounds = rounds.filter(r => r.status === 'active');
  const pendingRounds = rounds.filter(r => r.status === 'pending');
  const incidentRounds = rounds.filter(r => r.status === 'incident');
  const completedRounds = rounds.filter(r => r.status === 'completed');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Gestão de Rondas</h1>
              <p className="text-muted-foreground">
                Gerencie templates de rondas e rondas ativas
              </p>
            </div>
            
            <div className="flex space-x-2">
              <Button 
                variant="outline"
                onClick={() => navigate('/round-templates')}
              >
                <Route className="w-4 h-4 mr-2" />
                Templates de Ronda
              </Button>

              <Dialog open={createRoundDialogOpen} onOpenChange={setCreateRoundDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-tactical-green hover:bg-tactical-green/90">
                    <Play className="w-4 h-4 mr-2" />
                    Criar Rondas
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Rondas a partir de Template</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleNewRound} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="template">Template de Ronda</Label>
                      <Select value={formData.template_id} onValueChange={(value) => setFormData({ ...formData, template_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um template ativo" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.filter(t => t.active).map((template) => (
                           <SelectItem key={template.id} value={template.id}>
                             {template.name}
                           </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                      <p>💡 <strong>Atenção:</strong> Esta ronda ficará disponível para <strong>todos os táticos</strong>. O tático escolherá o veículo ao iniciar a ronda.</p>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-tactical-green hover:bg-tactical-green/90"
                      disabled={!formData.template_id}
                    >
                      Criar Ronda
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              
              {/* Dialog de Edição de Ronda */}
              <Dialog open={editDialogOpen} onOpenChange={(open) => {
                setEditDialogOpen(open);
                if (!open) {
                  setEditingRound(null);
                  setEditFormData({ template_ids: [], vehicle_id: "" });
                }
              }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar Ronda</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={updateRound} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_templates">Templates da Ronda</Label>
                      <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                        {templates.filter(t => t.active).map((template) => (
                          <div key={template.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`edit-template-${template.id}`}
                              checked={editFormData.template_ids.includes(template.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditFormData({
                                    ...editFormData,
                                    template_ids: [...editFormData.template_ids, template.id]
                                  });
                                } else {
                                  setEditFormData({
                                    ...editFormData,
                                    template_ids: editFormData.template_ids.filter(id => id !== template.id)
                                  });
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                             <Label htmlFor={`edit-template-${template.id}`} className="text-sm">
                               {template.name}
                             </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_vehicle">Veículo</Label>
                      <Select value={editFormData.vehicle_id} onValueChange={(value) => setEditFormData({ ...editFormData, vehicle_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um veículo" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicles.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id}>
                              {vehicle.license_plate} - {vehicle.brand} {vehicle.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-tactical-green hover:bg-tactical-green/90"
                      disabled={editFormData.template_ids.length === 0}
                    >
                      Atualizar Ronda
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Estatísticas rápidas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-tactical-green rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Ativas</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{activeRounds.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-tactical-amber rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Pendentes</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{pendingRounds.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-tactical-red rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Incidentes</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{incidentRounds.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-muted rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Concluídas</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{completedRounds.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs para diferentes tipos de rondas */}
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="active">Ativas ({activeRounds.length})</TabsTrigger>
              <TabsTrigger value="pending">Pendentes ({pendingRounds.length})</TabsTrigger>
              <TabsTrigger value="incident">Incidentes ({incidentRounds.length})</TabsTrigger>
              <TabsTrigger value="completed">Concluídas ({completedRounds.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              <div className="space-y-4">
                {activeRounds.map((round) => {
                  const clients = round.template_id ? templateClients[round.template_id] || [] : [];
                  const totalCheckpoints = clients.reduce((sum, client) => sum + client.checkpoints_count, 0);
                  
                  return (
                    <Card key={round.id} className="tactical-card">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-xl flex items-center space-x-2">
                              <span>{round.round_templates?.name || round.clients.name}</span>
                              {round.round_number && (
                                <Badge variant="outline">Ronda {round.round_number}</Badge>
                              )}
                            </CardTitle>
                            {round.round_templates?.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {round.round_templates.description}
                              </p>
                            )}
                            <div className="flex items-center space-x-4 mt-2">
                              <span className="text-sm text-muted-foreground flex items-center">
                                <User className="w-3 h-3 mr-1" />
                                {round.profiles?.name || "Não atribuído"}
                              </span>
                              {round.vehicles && (
                                <span className="text-sm text-muted-foreground flex items-center">
                                  <Car className="w-3 h-3 mr-1" />
                                  {round.vehicles.license_plate}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge className={getStatusColor(round.status)}>
                            {getStatusLabel(round.status)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Empresas da Ronda */}
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2 flex items-center">
                            <Building2 className="w-4 h-4 mr-1" />
                            Empresas ({clients.length}):
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {clients.map((client) => (
                              <Badge key={client.id} variant="outline" className="text-xs">
                                {client.name} ({client.checkpoints_count})
                              </Badge>
                            ))}
                            {clients.length === 0 && (
                              <span className="text-sm text-muted-foreground">Nenhuma empresa configurada</span>
                            )}
                          </div>
                        </div>

                        {/* Informações e Ações */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Duração: {formatDuration(round.start_time)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {totalCheckpoints} checkpoints
                            </span>
                          </div>
                          <div className="flex space-x-2 justify-end">
                            {round.template_id && clients.length > 0 && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline">
                                    <Info className="w-3 h-3 mr-1" />
                                    Detalhes
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Detalhes do Trajeto</DialogTitle>
                                  </DialogHeader>
                                  <RoundRouteDetails
                                    templateId={round.template_id}
                                    templateName={round.round_templates?.name || ""}
                                    templateDescription={round.round_templates?.description}
                                    clients={clients}
                                  />
                                </DialogContent>
                              </Dialog>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateRoundStatus(round.id, 'completed')}
                            >
                              <Pause className="w-3 h-3 mr-1" />
                              Finalizar
                            </Button>
                            <Button
                              size="sm"
                              className="bg-tactical-red hover:bg-tactical-red/90"
                              onClick={() => updateRoundStatus(round.id, 'incident')}
                            >
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Incidente
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteRound(round.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {activeRounds.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhuma ronda ativa encontrada</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="pending">
              <div className="space-y-4">
                {pendingRounds.map((round) => {
                  const clients = round.template_id ? templateClients[round.template_id] || [] : [];
                  const totalCheckpoints = clients.reduce((sum, client) => sum + client.checkpoints_count, 0);
                  
                  return (
                    <Card key={round.id} className="tactical-card">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-xl flex items-center space-x-2">
                              <span>{round.round_templates?.name || round.clients.name}</span>
                              {round.round_number && (
                                <Badge variant="outline">Ronda {round.round_number}</Badge>
                              )}
                            </CardTitle>
                            {round.round_templates?.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {round.round_templates.description}
                              </p>
                            )}
                            <div className="flex items-center space-x-4 mt-2">
                              <span className="text-sm text-muted-foreground flex items-center">
                                <User className="w-3 h-3 mr-1" />
                                {round.profiles?.name || "Não atribuído"}
                              </span>
                            </div>
                          </div>
                          <Badge className={getStatusColor(round.status)}>
                            {getStatusLabel(round.status)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2 flex items-center">
                            <Building2 className="w-4 h-4 mr-1" />
                            Empresas ({clients.length}):
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {clients.map((client) => (
                              <Badge key={client.id} variant="outline" className="text-xs">
                                {client.name} ({client.checkpoints_count})
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Criada: {new Date(round.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {totalCheckpoints} checkpoints
                            </span>
                          </div>
                          <div className="flex space-x-2 justify-end">
                            {round.template_id && clients.length > 0 && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline">
                                    <Info className="w-3 h-3 mr-1" />
                                    Detalhes
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Detalhes do Trajeto</DialogTitle>
                                  </DialogHeader>
                                  <RoundRouteDetails
                                    templateId={round.template_id}
                                    templateName={round.round_templates?.name || ""}
                                    templateDescription={round.round_templates?.description}
                                    clients={clients}
                                  />
                                </DialogContent>
                              </Dialog>
                            )}
                            <Button
                              size="sm"
                              className="bg-tactical-green hover:bg-tactical-green/90"
                              onClick={() => updateRoundStatus(round.id, 'active')}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Iniciar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDialog(round)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteRound(round.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {pendingRounds.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhuma ronda pendente encontrada</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="incident">
              <div className="space-y-4">
                {incidentRounds.map((round) => (
                  <Card key={round.id} className="tactical-card">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            {round.vehicle === 'car' ? <Car className="w-5 h-5" /> : <Bike className="w-5 h-5" />}
                            <div>
                              <CardTitle className="text-lg">
                                {round.round_templates?.name || round.clients.name}
                                {round.round_number && (
                                  <span className="text-sm font-normal text-muted-foreground ml-2">
                                    (Ronda {round.round_number})
                                  </span>
                                )}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {round.profiles?.name || "Não atribuído"}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(round.status)}>
                            {getStatusLabel(round.status)}
                          </Badge>
                          <AlertTriangle className="w-5 h-5 text-tactical-red" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {round.clients.address}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Duração: {formatDuration(round.start_time)}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            className="bg-tactical-green hover:bg-tactical-green/90"
                            onClick={() => updateRoundStatus(round.id, 'active')}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Retomar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteRound(round.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {incidentRounds.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhuma ronda com incidente encontrada</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="completed">
              <div className="space-y-4">
                {completedRounds.map((round) => (
                  <Card key={round.id} className="tactical-card">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            {round.vehicle === 'car' ? <Car className="w-5 h-5" /> : <Bike className="w-5 h-5" />}
                            <div>
                              <CardTitle className="text-lg">
                                {round.round_templates?.name || round.clients.name}
                                {round.round_number && (
                                  <span className="text-sm font-normal text-muted-foreground ml-2">
                                    (Ronda {round.round_number})
                                  </span>
                                )}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {round.profiles?.name || "Não atribuído"}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(round.status)}>
                            {getStatusLabel(round.status)}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {round.clients.address}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Finalizada: {round.end_time ? new Date(round.end_time).toLocaleDateString('pt-BR') : '-'}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/history?round=${round.id}`)}
                          >
                            <Settings className="w-3 h-3 mr-1" />
                            Ver Relatório
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteRound(round.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {completedRounds.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhuma ronda concluída encontrada</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Rounds;