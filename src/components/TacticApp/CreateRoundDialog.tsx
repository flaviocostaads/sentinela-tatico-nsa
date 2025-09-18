import { useState, useEffect } from "react";
import { Calendar, Car, Bike, User, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CreateRoundDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRoundCreated: () => void;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  shift_type: string;
}

interface Vehicle {
  id: string;
  license_plate: string;
  brand: string;
  model: string;
  type: 'car' | 'motorcycle';
}

interface Tactic {
  id: string;
  name: string;
  role: string;
}

const CreateRoundDialog = ({ isOpen, onClose, onRoundCreated }: CreateRoundDialogProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tactics, setTactics] = useState<Tactic[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    template_id: "",
    vehicle_id: "",
    tactic_id: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      fetchVehicles();
      fetchTactics();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setFormData({
      template_id: "",
      vehicle_id: "",
      tactic_id: ""
    });
  };

  const fetchTemplates = async () => {
    try {
      console.log("Fetching templates...");
      
      const { data, error } = await supabase
        .from("round_templates")
        .select("id, name, description, shift_type")
        .eq("active", true)
        .order("name");

      console.log("Templates query result:", { data, error });

      if (error) throw error;
      
      console.log("Setting templates:", data);
      setTemplates(data || []);
      
      if (!data || data.length === 0) {
        toast({
          title: "Aviso",
          description: "Nenhum template de ronda ativo encontrado",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar templates de ronda",
        variant: "destructive",
      });
    }
  };

  const fetchVehicles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user profile to check role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        return;
      }

      // Admin can see all vehicles, tactical users see all available vehicles
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, license_plate, brand, model, type")
        .eq("active", true)
        .order("license_plate");

      if (error) {
        console.error("Error fetching vehicles:", error);
        throw error;
      }
      
      console.log('Vehicles loaded:', data);
      setVehicles(data || []);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar veículos. Verifique as permissões.",
        variant: "destructive",
      });
    }
  };

  const fetchTactics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current user's profile to check role
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, name, role, user_id")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        throw error;
      }
      
      console.log("Current user profile:", profile);
      
      if (profile?.role === "tatico") {
        // For tactical users, auto-select themselves
        setTactics([{
          id: profile.user_id,
          name: profile.name,
          role: profile.role
        }]);
        
        // Auto-select the current user
        setFormData(prev => ({ ...prev, tactic_id: profile.user_id }));
        console.log("Auto-selected tactical user:", profile.name);
      } else if (profile?.role === "admin" || profile?.role === "operador") {
        // For admin/operator users, fetch all tactical users
        const { data: tacticalUsers, error: tacticalError } = await supabase
          .from("profiles")
          .select("id, name, role, user_id")
          .eq("role", "tatico")
          .order("name");

        if (tacticalError) {
          console.error("Error fetching tactical users:", tacticalError);
          throw tacticalError;
        }

        console.log("Available tactical users:", tacticalUsers);
        
        if (tacticalUsers && tacticalUsers.length > 0) {
          setTactics(tacticalUsers.map(user => ({
            id: user.user_id,
            name: user.name,
            role: user.role
          })));
        } else {
          toast({
            title: "Aviso",
            description: "Nenhum usuário tático encontrado no sistema",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching tactics:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar usuários táticos",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get selected tactic
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // For tactical users, use their own user_id from auth
      const selectedTacticUserId = user.id;

      // Get selected vehicle to determine type
      const selectedVehicle = vehicles.find(v => v.id === formData.vehicle_id);
      if (!selectedVehicle) throw new Error("Veículo não encontrado");

      // Get template info to validate it has checkpoints
      const { data: templateData, error: templateError } = await supabase
        .from("round_templates")
        .select(`
          id,
          name,
          round_template_checkpoints (
            id,
            client_id
          )
        `)
        .eq("id", formData.template_id)
        .single();

      if (templateError) throw templateError;

      if (!templateData?.round_template_checkpoints || templateData.round_template_checkpoints.length === 0) {
        throw new Error("Template sem checkpoints configurados");
      }

      console.log("Template data for round creation:", templateData);

      // Create ONE round using the template (not tied to a specific client)
      const roundData = {
        user_id: selectedTacticUserId,
        client_id: templateData.round_template_checkpoints[0].client_id, // Use first client as reference
        template_id: formData.template_id,
        vehicle_id: formData.vehicle_id,
        vehicle: selectedVehicle.type,
        status: 'pending' as const,
        current_checkpoint_index: 0,
        round_number: 1,
        requires_signature: false,
        created_by: user.id
      };

      console.log("Creating round with data:", roundData);

      const { error } = await supabase
        .from("rounds")
        .insert([roundData]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Ronda criada com sucesso!",
      });

      onRoundCreated();
      onClose();
    } catch (error) {
      console.error("Error creating round:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao criar ronda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getVehicleIcon = (type: string) => {
    return type === 'car' ? Car : Bike;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Criar Nova Ronda
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tactic_id">Nome do Tático</Label>
            <Select 
              value={formData.tactic_id} 
              onValueChange={(value) => setFormData({ ...formData, tactic_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um tático" />
              </SelectTrigger>
              <SelectContent>
                {tactics.map((tactic) => (
                  <SelectItem key={tactic.id} value={tactic.id}>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>{tactic.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template_id">Template de Ronda</Label>
            <Select 
              value={formData.template_id} 
              onValueChange={(value) => setFormData({ ...formData, template_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <div>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-muted-foreground">{template.shift_type}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle_id">Veículo</Label>
            <Select 
              value={formData.vehicle_id} 
              onValueChange={(value) => setFormData({ ...formData, vehicle_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um veículo" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => {
                  const Icon = getVehicleIcon(vehicle.type);
                  return (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <div>
                          <div className="font-medium">{vehicle.license_plate}</div>
                          <div className="text-xs text-muted-foreground">
                            {vehicle.brand} {vehicle.model}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.template_id || !formData.vehicle_id || !formData.tactic_id}
              className="flex-1 bg-tactical-green hover:bg-tactical-green/90"
            >
              {loading ? "Criando..." : "Criar Ronda"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRoundDialog;