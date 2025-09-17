import { useState, useEffect } from "react";
import { Edit, Trash2, Search, Filter, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";

interface MaintenanceLog {
  id: string;
  maintenance_type: string;
  service_type: string;
  description: string;
  location?: string;
  odometer_reading: number;
  cost?: number;
  parts_replaced?: string[];
  service_provider?: string;
  start_time: string;
  end_time?: string;
  created_by: string;
  vehicle_id: string;
  vehicles?: {
    license_plate: string;
    brand: string;
    model: string;
  };
  profiles?: {
    name: string;
  };
}

const MaintenanceHistory = () => {
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<MaintenanceLog[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editingLog, setEditingLog] = useState<MaintenanceLog | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  const [editData, setEditData] = useState({
    maintenance_type: "",
    service_type: "",
    description: "",
    location: "",
    odometer_reading: 0,
    cost: 0,
    parts_replaced: "",
    service_provider: ""
  });

  useEffect(() => {
    checkUserRole();
    fetchMaintenanceLogs();
    fetchVehicles();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [maintenanceLogs, searchTerm, vehicleFilter, typeFilter]);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setIsAdmin(profile?.role === 'admin');
    } catch (error) {
      console.error("Error checking user role:", error);
    }
  };

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, license_plate, brand, model")
        .eq("active", true)
        .order("license_plate");

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    }
  };

  const fetchMaintenanceLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicle_maintenance_logs")
        .select(`
          *,
          vehicles (license_plate, brand, model)
        `)
        .order("start_time", { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      const logsWithProfiles = await Promise.all(
        (data || []).map(async (log) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("user_id", log.created_by)
            .single();

          return {
            ...log,
            vehicles: log.vehicles || { license_plate: "N/A", brand: "N/A", model: "N/A" },
            profiles: profile ? { name: profile.name } : { name: "N/A" }
          };
        })
      );

      setMaintenanceLogs(logsWithProfiles as MaintenanceLog[]);
    } catch (error) {
      console.error("Error fetching maintenance logs:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar histórico de manutenção",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = maintenanceLogs;

    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.service_provider?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.vehicles?.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.profiles?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (vehicleFilter !== "all") {
      filtered = filtered.filter(log => log.vehicle_id === vehicleFilter);
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter(log => log.maintenance_type === typeFilter);
    }

    setFilteredLogs(filtered);
  };

  const handleEdit = (log: MaintenanceLog) => {
    setEditingLog(log);
    setEditData({
      maintenance_type: log.maintenance_type,
      service_type: log.service_type,
      description: log.description,
      location: log.location || "",
      odometer_reading: log.odometer_reading,
      cost: log.cost || 0,
      parts_replaced: log.parts_replaced?.join(", ") || "",
      service_provider: log.service_provider || ""
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingLog) return;

    try {
      const { error } = await supabase
        .from("vehicle_maintenance_logs")
        .update({
          maintenance_type: editData.maintenance_type,
          service_type: editData.service_type,
          description: editData.description,
          location: editData.location || null,
          odometer_reading: editData.odometer_reading,
          cost: editData.cost > 0 ? editData.cost : null,
          parts_replaced: editData.parts_replaced ? editData.parts_replaced.split(",").map(p => p.trim()) : null,
          service_provider: editData.service_provider || null
        })
        .eq("id", editingLog.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Registro de manutenção atualizado com sucesso!",
      });

      setEditDialogOpen(false);
      setEditingLog(null);
      fetchMaintenanceLogs();
    } catch (error) {
      console.error("Error updating maintenance log:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar registro",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (logId: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro de manutenção?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from("vehicle_maintenance_logs")
        .delete()
        .eq("id", logId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Registro de manutenção excluído com sucesso!",
      });

      fetchMaintenanceLogs();
    } catch (error) {
      console.error("Error deleting maintenance log:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir registro",
        variant: "destructive",
      });
    }
  };

  const getMaintenanceTypeBadge = (type: string) => {
    switch (type) {
      case 'preventive':
        return <Badge variant="outline" className="text-tactical-green border-tactical-green">Preventiva</Badge>;
      case 'corrective':
        return <Badge variant="outline" className="text-tactical-amber border-tactical-amber">Corretiva</Badge>;
      case 'emergency':
        return <Badge variant="outline" className="text-tactical-red border-tactical-red">Emergencial</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Histórico de Manutenção</h1>
              <p className="text-muted-foreground">
                Registros de manutenção da frota
              </p>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por descrição, local, prestador..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Veículos</SelectItem>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.license_plate} - {vehicle.brand} {vehicle.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de manutenção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Tipos</SelectItem>
                    <SelectItem value="preventive">Preventiva</SelectItem>
                    <SelectItem value="corrective">Corretiva</SelectItem>
                    <SelectItem value="emergency">Emergencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Maintenance Logs List */}
          <div className="space-y-4">
            {filteredLogs.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Wrench className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum registro encontrado</h3>
                  <p className="text-muted-foreground">
                    {maintenanceLogs.length === 0 
                      ? "Ainda não há registros de manutenção."
                      : "Nenhum registro corresponde aos filtros aplicados."
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredLogs.map((log) => (
                <Card key={log.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">
                            {log.vehicles?.license_plate} - {log.vehicles?.brand} {log.vehicles?.model}
                          </h3>
                          {getMaintenanceTypeBadge(log.maintenance_type)}
                        </div>
                        
                        <p className="text-muted-foreground">{log.description}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                          <div>Data: {new Date(log.start_time).toLocaleDateString('pt-BR')}</div>
                          <div>Serviço: {log.service_type}</div>
                          <div>Odômetro: {log.odometer_reading.toLocaleString()} km</div>
                          <div>Responsável: {log.profiles?.name}</div>
                        </div>
                        
                        {log.location && (
                          <div className="text-sm text-muted-foreground">
                            Local: {log.location}
                          </div>
                        )}
                        
                        {log.service_provider && (
                          <div className="text-sm text-muted-foreground">
                            Prestador: {log.service_provider}
                          </div>
                        )}
                        
                        {log.parts_replaced && log.parts_replaced.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            <span className="text-sm text-muted-foreground mr-2">Peças:</span>
                            {log.parts_replaced.map((part, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {part}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        {log.cost && (
                          <div className="text-lg font-medium text-tactical-green">
                            R$ {log.cost.toFixed(2)}
                          </div>
                        )}
                      </div>
                      
                      {isAdmin && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(log)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(log.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Edit Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Editar Registro de Manutenção</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Manutenção</Label>
                    <Select
                      value={editData.maintenance_type}
                      onValueChange={(value) => setEditData({ ...editData, maintenance_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preventive">Preventiva</SelectItem>
                        <SelectItem value="corrective">Corretiva</SelectItem>
                        <SelectItem value="emergency">Emergencial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Tipo de Serviço</Label>
                    <Select
                      value={editData.service_type}
                      onValueChange={(value) => setEditData({ ...editData, service_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="oil_change">Troca de Óleo</SelectItem>
                        <SelectItem value="tire_change">Troca de Pneu</SelectItem>
                        <SelectItem value="brake_maintenance">Freios</SelectItem>
                        <SelectItem value="engine_maintenance">Motor</SelectItem>
                        <SelectItem value="transmission_maintenance">Transmissão</SelectItem>
                        <SelectItem value="electrical_maintenance">Elétrica</SelectItem>
                        <SelectItem value="cleaning">Limpeza</SelectItem>
                        <SelectItem value="inspection">Inspeção</SelectItem>
                        <SelectItem value="repair">Reparo Geral</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Local</Label>
                    <Input
                      value={editData.location}
                      onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Odômetro (km)</Label>
                    <Input
                      type="number"
                      value={editData.odometer_reading}
                      onChange={(e) => setEditData({ ...editData, odometer_reading: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Custo (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editData.cost}
                      onChange={(e) => setEditData({ ...editData, cost: parseFloat(e.target.value) })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Prestador de Serviço</Label>
                    <Input
                      value={editData.service_provider}
                      onChange={(e) => setEditData({ ...editData, service_provider: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Peças Substituídas (separadas por vírgula)</Label>
                  <Input
                    value={editData.parts_replaced}
                    onChange={(e) => setEditData({ ...editData, parts_replaced: e.target.value })}
                    placeholder="pneu dianteiro, filtro de óleo..."
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleUpdate}
                    className="flex-1 bg-tactical-green hover:bg-tactical-green/90"
                  >
                    Salvar Alterações
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
};

export default MaintenanceHistory;