import { useState, useEffect } from "react";
import { Plus, MapPin, Edit, Trash2, QrCode, ExternalLink, Grid, List, Printer, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";
import { extractDataFromGoogleMapsUrl } from "@/utils/googleMapsParser";
import CompactClientList from "@/components/Clients/CompactClientList";
import QrPrintModel from "@/components/TacticApp/QrPrintModel";
import { Checkbox } from "@/components/ui/checkbox";

interface Client {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  active: boolean;
  created_at: string;
  is_base?: boolean;
}

interface Checkpoint {
  id: string;
  client_id: string;
  name: string;
  description?: string;
  lat?: number;
  lng?: number;
  qr_code?: string;
  order_index: number;
  active: boolean;
}

const Clients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [checkpointDialogOpen, setCheckpointDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    lat: "",
    lng: "",
    googleMapsUrl: "",
    is_base: false
  });
  const [checkpointForm, setCheckpointForm] = useState({
    name: "",
    description: "",
    lat: "",
    lng: "",
    order_index: 1
  });
  const [editingCheckpoint, setEditingCheckpoint] = useState<Checkpoint | null>(null);
  const [editCheckpointDialogOpen, setEditCheckpointDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('compact');
  const [showQrPrint, setShowQrPrint] = useState(false);
  const [qrPrintData, setQrPrintData] = useState<{
    companyName: string;
    pointName: string;
    qrCode: string;
  }>({ companyName: "", pointName: "", qrCode: "" });
  const { toast } = useToast();

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name");

      if (error) throw error;
      setClients(data || []);

      // Fetch checkpoints for all clients to get accurate counts
      if (data && data.length > 0) {
        const { data: checkpointsData, error: checkpointsError } = await supabase
          .from("checkpoints")
          .select("*")
          .in("client_id", data.map(c => c.id));

        if (checkpointsError) throw checkpointsError;
        setCheckpoints(checkpointsData || []);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCheckpoints = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from("checkpoints")
        .select("*")
        .eq("client_id", clientId)
        .order("order_index");

      if (error) throw error;
      setCheckpoints(data || []);
    } catch (error) {
      console.error("Error fetching checkpoints:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const clientData = {
        name: formData.name,
        address: formData.address,
        lat: formData.lat ? parseFloat(formData.lat) : null,
        lng: formData.lng ? parseFloat(formData.lng) : null,
        is_base: formData.is_base,
      };

      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update(clientData)
          .eq("id", editingClient.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: `Cliente ${formData.is_base ? '(BASE) ' : ''}atualizado com sucesso!`,
        });
      } else {
        const { error } = await supabase
          .from("clients")
          .insert([clientData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: `Cliente ${formData.is_base ? '(BASE) ' : ''}cadastrado com sucesso!`,
        });
      }

      setDialogOpen(false);
      setEditDialogOpen(false);
      setFormData({ name: "", address: "", lat: "", lng: "", googleMapsUrl: "", is_base: false });
      setEditingClient(null);
      fetchClients();
    } catch (error) {
      console.error("Error saving client:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar cliente. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      address: client.address,
      lat: client.lat?.toString() || "",
      lng: client.lng?.toString() || "",
      googleMapsUrl: "",
      is_base: client.is_base || false
    });
    setEditDialogOpen(true);
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`Tem certeza que deseja excluir o cliente "${client.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", client.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cliente excluído com sucesso!",
      });

      fetchClients();
    } catch (error) {
      console.error("Error deleting client:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir cliente. Verifique se não há dados relacionados.",
        variant: "destructive",
      });
    }
  };

  const extractDataFromGoogleMaps = () => {
    if (!formData.googleMapsUrl.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, cole o link do Google Maps",
        variant: "destructive",
      });
      return;
    }

    const extractedData = extractDataFromGoogleMapsUrl(formData.googleMapsUrl);
    
    if (extractedData) {
      setFormData({
        ...formData,
        name: extractedData.name || formData.name,
        address: extractedData.address || formData.address,
        lat: extractedData.lat.toString(),
        lng: extractedData.lng.toString()
      });

      toast({
        title: "Sucesso",
        description: "Dados extraídos do Google Maps com sucesso!",
      });
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível extrair dados do link fornecido. Verifique se é um link válido do Google Maps.",
        variant: "destructive",
      });
    }
  };

  const handleCheckpointSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedClient) return;

    // Validar se o cliente tem coordenadas
    if (!selectedClient.lat || !selectedClient.lng) {
      if (!checkpointForm.lat || !checkpointForm.lng) {
        toast({
          title: "Aviso",
          description: "Este cliente não possui coordenadas cadastradas. É necessário preencher as coordenadas manualmente ou atualizar o cadastro do cliente.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      // Generate 9-digit QR code
      const qrCodeNumber = Math.floor(100000000 + Math.random() * 900000000).toString();
      
      const checkpointData = {
        client_id: selectedClient.id,
        name: checkpointForm.name,
        description: checkpointForm.description,
        lat: checkpointForm.lat 
          ? parseFloat(checkpointForm.lat) 
          : selectedClient.lat,  // ✅ Usa coordenada do cliente como fallback
        lng: checkpointForm.lng 
          ? parseFloat(checkpointForm.lng) 
          : selectedClient.lng,  // ✅ Usa coordenada do cliente como fallback
        order_index: checkpointForm.order_index,
        qr_code: qrCodeNumber
      };

      // Log para feedback visual
      console.log('📍 Criando checkpoint com coordenadas:', {
        manual: !!checkpointForm.lat && !!checkpointForm.lng,
        lat: checkpointData.lat,
        lng: checkpointData.lng,
        source: checkpointForm.lat ? 'Manual' : 'Cliente'
      });

      const { error } = await supabase
        .from("checkpoints")
        .insert([checkpointData]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Ponto criado com coordenadas ${checkpointForm.lat ? 'manuais' : 'do cliente'}!`,
      });

      setCheckpointDialogOpen(false);
      setCheckpointForm({ name: "", description: "", lat: "", lng: "", order_index: 1 });
      fetchCheckpoints(selectedClient.id);
    } catch (error) {
      console.error("Error creating checkpoint:", error);
      toast({
        title: "Erro",
        description: "Erro ao criar ponto de verificação",
        variant: "destructive",
      });
    }
  };

  const handleEditCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingCheckpoint) return;

    try {
      const checkpointData = {
        name: checkpointForm.name,
        description: checkpointForm.description,
        lat: checkpointForm.lat ? parseFloat(checkpointForm.lat) : null,
        lng: checkpointForm.lng ? parseFloat(checkpointForm.lng) : null,
        order_index: checkpointForm.order_index,
      };

      const { error } = await supabase
        .from("checkpoints")
        .update(checkpointData)
        .eq("id", editingCheckpoint.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Ponto de verificação atualizado com sucesso!",
      });

      setEditCheckpointDialogOpen(false);
      setEditingCheckpoint(null);
      setCheckpointForm({ name: "", description: "", lat: "", lng: "", order_index: 1 });
      if (selectedClient) {
        fetchCheckpoints(selectedClient.id);
      }
    } catch (error) {
      console.error("Error updating checkpoint:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar ponto de verificação",
        variant: "destructive",
      });
    }
  };

  const generateQRPrint = (checkpoint: Checkpoint) => {
    const client = clients.find(c => c.id === checkpoint.client_id);
    if (client) {
      setQrPrintData({
        companyName: client.name,
        pointName: checkpoint.name,
        qrCode: checkpoint.qr_code || Math.floor(100000000 + Math.random() * 900000000).toString()
      });
      setShowQrPrint(true);
    }
  };

  const handleDeleteCheckpoint = async (checkpoint: Checkpoint) => {
    if (!confirm(`Tem certeza que deseja excluir o ponto "${checkpoint.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("checkpoints")
        .delete()
        .eq("id", checkpoint.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Ponto de verificação excluído com sucesso!",
      });

      // Refresh checkpoints for the selected client
      if (selectedClient) {
        fetchCheckpoints(selectedClient.id);
      }
    } catch (error) {
      console.error("Error deleting checkpoint:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir ponto de verificação",
        variant: "destructive",
      });
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
              <h1 className="text-3xl font-bold text-foreground">Gestão de Clientes</h1>
              <p className="text-muted-foreground">
                Gerencie empresas clientes e pontos de verificação
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="flex items-center border rounded-lg">
                <Button
                  variant={viewMode === 'compact' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('compact')}
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="w-4 h-4" />
                </Button>
              </div>
              
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-tactical-green hover:bg-tactical-green/90">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Cliente
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome da Empresa</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Endereço</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="googleMapsUrl">Link do Google Maps (opcional)</Label>
                      <Input
                        id="googleMapsUrl"
                        type="url"
                        placeholder="Cole o link do Google Maps aqui"
                        value={formData.googleMapsUrl}
                        onChange={(e) => setFormData({ ...formData, googleMapsUrl: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => extractDataFromGoogleMaps()}
                        disabled={!formData.googleMapsUrl}
                        className="w-full"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Extrair Dados do Google Maps
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="lat">Latitude (opcional)</Label>
                        <Input
                          id="lat"
                          type="number"
                          step="any"
                          value={formData.lat}
                          onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
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
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 p-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-lg">
                      <Checkbox
                        id="is_base"
                        checked={formData.is_base}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_base: checked === true })}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor="is_base"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                        >
                          <Home className="w-4 h-4" />
                          Este cliente é a Base de Operações
                        </label>
                        <p className="text-xs text-muted-foreground">
                          A base é o ponto de saída e retorno dos táticos
                        </p>
                      </div>
                    </div>
                    
                    <Button type="submit" className="w-full bg-tactical-green hover:bg-tactical-green/90">
                      {editingClient ? 'Atualizar Cliente' : 'Cadastrar Cliente'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar Cliente</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Nome da Empresa</Label>
                      <Input
                        id="edit-name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-address">Endereço</Label>
                      <Input
                        id="edit-address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-googleMapsUrl">Link do Google Maps (opcional)</Label>
                      <Input
                        id="edit-googleMapsUrl"
                        type="url"
                        placeholder="Cole o link do Google Maps aqui"
                        value={formData.googleMapsUrl}
                        onChange={(e) => setFormData({ ...formData, googleMapsUrl: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => extractDataFromGoogleMaps()}
                        disabled={!formData.googleMapsUrl}
                        className="w-full"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Extrair Dados do Google Maps
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-lat">Latitude (opcional)</Label>
                        <Input
                          id="edit-lat"
                          type="number"
                          step="any"
                          value={formData.lat}
                          onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-lng">Longitude (opcional)</Label>
                        <Input
                          id="edit-lng"
                          type="number"
                          step="any"
                          value={formData.lng}
                          onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 p-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-lg">
                      <Checkbox
                        id="edit-is_base"
                        checked={formData.is_base}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_base: checked === true })}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor="edit-is_base"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                        >
                          <Home className="w-4 h-4" />
                          Este cliente é a Base de Operações
                        </label>
                        <p className="text-xs text-muted-foreground">
                          A base é o ponto de saída e retorno dos táticos
                        </p>
                      </div>
                    </div>
                    
                    <Button type="submit" className="w-full bg-tactical-blue hover:bg-tactical-blue/90">
                      Atualizar Cliente
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {viewMode === 'compact' ? (
            <CompactClientList
              clients={clients}
              checkpoints={checkpoints}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddCheckpoint={(client) => {
                setSelectedClient(client);
                setCheckpointDialogOpen(true);
              }}
              onViewCheckpoints={(client) => {
                setSelectedClient(client);
                fetchCheckpoints(client.id);
              }}
              onGenerateQR={generateQRPrint}
              onDeleteCheckpoint={handleDeleteCheckpoint}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clients.map((client) => (
                <Card key={client.id} className="tactical-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {client.is_base && <Home className="w-5 h-5 text-violet-500" />}
                        <CardTitle className="text-lg">{client.name}</CardTitle>
                      </div>
                      <div className="flex gap-2">
                        {client.is_base && (
                          <Badge className="bg-gradient-to-r from-violet-500 to-purple-500">
                            BASE
                          </Badge>
                        )}
                        <Badge variant={client.active ? "default" : "secondary"}>
                          {client.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-2">
                        <MapPin className="w-4 h-4 mt-1 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{client.address}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedClient(client);
                            fetchCheckpoints(client.id);
                          }}
                        >
                          Ver Pontos
                        </Button>
                        <Button
                          size="sm"
                          className="bg-tactical-blue hover:bg-tactical-blue/90"
                          onClick={() => {
                            setSelectedClient(client);
                            setCheckpointDialogOpen(true);
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Ponto
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(client)}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(client)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {selectedClient && checkpoints.length > 0 && (
            <Card className="tactical-card">
              <CardHeader>
                <CardTitle>Pontos de Verificação - {selectedClient.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {checkpoints.map((checkpoint) => (
                    <div key={checkpoint.id} className="p-4 border rounded-lg bg-background/50">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{checkpoint.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          #{checkpoint.order_index}
                        </Badge>
                      </div>
                      {checkpoint.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {checkpoint.description}
                        </p>
                      )}
                      {checkpoint.lat && checkpoint.lng && (
                        <p className="text-xs text-muted-foreground mb-3">
                          📍 {checkpoint.lat.toFixed(6)}, {checkpoint.lng.toFixed(6)}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => generateQRPrint(checkpoint)}
                        >
                          <Printer className="w-3 h-3 mr-1" />
                          QR
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingCheckpoint(checkpoint);
                            setCheckpointForm({
                              name: checkpoint.name,
                              description: checkpoint.description || "",
                              lat: checkpoint.lat?.toString() || "",
                              lng: checkpoint.lng?.toString() || "",
                              order_index: checkpoint.order_index
                            });
                            setEditCheckpointDialogOpen(true);
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteCheckpoint(checkpoint)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Dialog open={checkpointDialogOpen} onOpenChange={setCheckpointDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Ponto de Verificação</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCheckpointSubmit} className="space-y-4">
                {selectedClient?.lat && selectedClient?.lng && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      💡 <strong>Dica:</strong> Se deixar as coordenadas em branco, o ponto será criado 
                      automaticamente no endereço da empresa: <strong>{selectedClient?.name}</strong>
                      <span className="block mt-1 text-xs opacity-75">
                        ({selectedClient.lat.toFixed(6)}, {selectedClient.lng.toFixed(6)})
                      </span>
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="checkpoint-name">Nome do Ponto</Label>
                  <Input
                    id="checkpoint-name"
                    value={checkpointForm.name}
                    onChange={(e) => setCheckpointForm({ ...checkpointForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkpoint-description">Descrição (opcional)</Label>
                  <Input
                    id="checkpoint-description"
                    value={checkpointForm.description}
                    onChange={(e) => setCheckpointForm({ ...checkpointForm, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order">Ordem de Visitação</Label>
                  <Input
                    id="order"
                    type="number"
                    min="1"
                    value={checkpointForm.order_index}
                    onChange={(e) => setCheckpointForm({ ...checkpointForm, order_index: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="checkpoint-lat">
                      Latitude (opcional)
                      {!checkpointForm.lat && selectedClient?.lat && (
                        <span className="text-xs text-muted-foreground ml-2">
                          Padrão: {selectedClient.lat.toFixed(6)}
                        </span>
                      )}
                    </Label>
                    <Input
                      id="checkpoint-lat"
                      type="number"
                      step="any"
                      placeholder={selectedClient?.lat?.toString() || ""}
                      value={checkpointForm.lat}
                      onChange={(e) => setCheckpointForm({ ...checkpointForm, lat: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="checkpoint-lng">
                      Longitude (opcional)
                      {!checkpointForm.lng && selectedClient?.lng && (
                        <span className="text-xs text-muted-foreground ml-2">
                          Padrão: {selectedClient.lng.toFixed(6)}
                        </span>
                      )}
                    </Label>
                    <Input
                      id="checkpoint-lng"
                      type="number"
                      step="any"
                      placeholder={selectedClient?.lng?.toString() || ""}
                      value={checkpointForm.lng}
                      onChange={(e) => setCheckpointForm({ ...checkpointForm, lng: e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-tactical-green hover:bg-tactical-green/90">
                  Criar Ponto de Verificação
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={editCheckpointDialogOpen} onOpenChange={setEditCheckpointDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Ponto de Verificação</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEditCheckpoint} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-checkpoint-name">Nome do Ponto</Label>
                  <Input
                    id="edit-checkpoint-name"
                    value={checkpointForm.name}
                    onChange={(e) => setCheckpointForm({ ...checkpointForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-checkpoint-description">Descrição (opcional)</Label>
                  <Input
                    id="edit-checkpoint-description"
                    value={checkpointForm.description}
                    onChange={(e) => setCheckpointForm({ ...checkpointForm, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-order">Ordem de Visitação</Label>
                  <Input
                    id="edit-order"
                    type="number"
                    min="1"
                    value={checkpointForm.order_index}
                    onChange={(e) => setCheckpointForm({ ...checkpointForm, order_index: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-checkpoint-lat">Latitude</Label>
                    <Input
                      id="edit-checkpoint-lat"
                      type="number"
                      step="any"
                      value={checkpointForm.lat}
                      onChange={(e) => setCheckpointForm({ ...checkpointForm, lat: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-checkpoint-lng">Longitude</Label>
                    <Input
                      id="edit-checkpoint-lng"
                      type="number"
                      step="any"
                      value={checkpointForm.lng}
                      onChange={(e) => setCheckpointForm({ ...checkpointForm, lng: e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-tactical-blue hover:bg-tactical-blue/90">
                  Atualizar Ponto de Verificação
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* QR Print Model Dialog */}
          <QrPrintModel
            isOpen={showQrPrint}
            onClose={() => setShowQrPrint(false)}
            companyName={qrPrintData.companyName}
            pointName={qrPrintData.pointName}
            qrCode={qrPrintData.qrCode}
          />
        </main>
      </div>
    </div>
  );
};

export default Clients;