import { useState, useEffect } from "react";
import { Edit, Trash2, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";

interface FuelLog {
  id: string;
  fuel_amount: number;
  fuel_cost?: number;
  fuel_station?: string;
  odometer_reading: number;
  created_at: string;
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

const FuelHistory = () => {
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<FuelLog[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  const [editData, setEditData] = useState({
    fuel_amount: 0,
    fuel_cost: 0,
    fuel_station: "",
    odometer_reading: 0
  });

  useEffect(() => {
    checkUserRole();
    fetchFuelLogs();
    fetchVehicles();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [fuelLogs, searchTerm, vehicleFilter]);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      console.log("User role check:", { userId: user.id, role: profile?.role });
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

  const fetchFuelLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicle_fuel_logs")
        .select(`
          *,
          vehicles (license_plate, brand, model)
        `)
        .order("created_at", { ascending: false });

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
            profiles: profile ? { name: profile.name } : { name: "N/A" }
          };
        })
      );

      setFuelLogs(logsWithProfiles);
    } catch (error) {
      console.error("Error fetching fuel logs:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar histórico de abastecimentos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = fuelLogs;

    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.fuel_station?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.vehicles?.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.profiles?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (vehicleFilter !== "all") {
      filtered = filtered.filter(log => log.vehicle_id === vehicleFilter);
    }

    setFilteredLogs(filtered);
  };

  const handleEdit = (log: FuelLog) => {
    setEditingLog(log);
    setEditData({
      fuel_amount: log.fuel_amount,
      fuel_cost: log.fuel_cost || 0,
      fuel_station: log.fuel_station || "",
      odometer_reading: log.odometer_reading
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingLog) return;

    try {
      const { error } = await supabase
        .from("vehicle_fuel_logs")
        .update({
          fuel_amount: editData.fuel_amount,
          fuel_cost: editData.fuel_cost > 0 ? editData.fuel_cost : null,
          fuel_station: editData.fuel_station || null,
          odometer_reading: editData.odometer_reading
        })
        .eq("id", editingLog.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Registro de abastecimento atualizado com sucesso!",
      });

      setEditDialogOpen(false);
      setEditingLog(null);
      fetchFuelLogs();
    } catch (error) {
      console.error("Error updating fuel log:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar registro",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (logId: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro de abastecimento?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from("vehicle_fuel_logs")
        .delete()
        .eq("id", logId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Registro de abastecimento excluído com sucesso!",
      });

      fetchFuelLogs();
    } catch (error) {
      console.error("Error deleting fuel log:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir registro",
        variant: "destructive",
      });
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
              <h1 className="text-3xl font-bold text-foreground">Histórico de Abastecimentos</h1>
              <p className="text-muted-foreground">
                Registros de combustível da frota
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por posto, veículo ou responsável..."
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
              </div>
            </CardContent>
          </Card>

          {/* Fuel Logs List */}
          <div className="space-y-4">
            {filteredLogs.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <h3 className="text-lg font-semibold mb-2">Nenhum registro encontrado</h3>
                  <p className="text-muted-foreground">
                    {fuelLogs.length === 0 
                      ? "Ainda não há registros de abastecimento."
                      : "Nenhum registro corresponde aos filtros aplicados."
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredLogs.map((log) => (
                <Card key={log.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-4">
                          <h3 className="font-semibold">
                            {log.vehicles?.license_plate} - {log.vehicles?.brand} {log.vehicles?.model}
                          </h3>
                          <span className="text-2xl font-bold text-tactical-blue">
                            {log.fuel_amount}L
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                          <div>Data: {new Date(log.created_at).toLocaleDateString('pt-BR')}</div>
                          <div>Odômetro: {log.odometer_reading.toLocaleString()} km</div>
                          <div>Posto: {log.fuel_station || 'N/A'}</div>
                          <div>Responsável: {log.profiles?.name}</div>
                        </div>
                        
                        {log.fuel_cost && (
                          <div className="text-lg font-medium text-tactical-green">
                            R$ {log.fuel_cost.toFixed(2)}
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Registro de Abastecimento</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantidade (L)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editData.fuel_amount}
                      onChange={(e) => setEditData({ ...editData, fuel_amount: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custo (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editData.fuel_cost}
                      onChange={(e) => setEditData({ ...editData, fuel_cost: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Posto de Combustível</Label>
                  <Input
                    value={editData.fuel_station}
                    onChange={(e) => setEditData({ ...editData, fuel_station: e.target.value })}
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

export default FuelHistory;