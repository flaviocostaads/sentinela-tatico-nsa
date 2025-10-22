import { useState, useEffect } from "react";
import { Calendar, Car, Bike, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const CreateRoundDialog = ({ isOpen, onClose, onRoundCreated }: CreateRoundDialogProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    template_id: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setFormData({
      template_id: ""
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


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Get template and checkpoints info
      console.log("Fetching template and checkpoints for:", formData.template_id);
      
      const { data: templateData, error: templateError } = await supabase
        .from("round_templates")
        .select(`
          id,
          name,
          shift_type
        `)
        .eq("id", formData.template_id)
        .single();

      if (templateError) {
        console.error("Template fetch error:", templateError);
        throw templateError;
      }

      console.log("Template data:", templateData);

      // Fetch checkpoints separately to avoid RLS issues
      const { data: checkpoints, error: checkpointsError } = await supabase
        .from("round_template_checkpoints")
        .select("id, client_id, order_index")
        .eq("template_id", formData.template_id)
        .order("order_index");

      console.log("Checkpoints query result:", { checkpoints, checkpointsError });

      if (checkpointsError) {
        console.error("Checkpoints fetch error:", checkpointsError);
        throw new Error("Erro ao buscar checkpoints do template");
      }

      if (!checkpoints || checkpoints.length === 0) {
        throw new Error("Template sem checkpoints configurados. Configure checkpoints antes de criar a ronda.");
      }

      console.log("Template validated with checkpoints:", checkpoints.length);

      // Create round WITHOUT user_id AND vehicle - available for any tactical user
      const roundData = {
        user_id: null, // NULL = disponível para qualquer tático
        client_id: checkpoints[0].client_id,
        template_id: formData.template_id,
        vehicle_id: null, // Será escolhido pelo tático ao iniciar
        vehicle: null, // Será definido ao iniciar a ronda
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
        description: "Ronda criada com sucesso! Disponível para todos os táticos.",
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

      <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
        <p>💡 <strong>Atenção:</strong> Esta ronda ficará disponível para <strong>todos os táticos</strong>. O tático escolherá o veículo ao iniciar a ronda.</p>
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
              disabled={loading || !formData.template_id}
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
