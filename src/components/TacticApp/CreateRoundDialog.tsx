import { useState, useEffect } from "react";
import { Calendar, Car, Bike, MapPin, Building2, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import RouteAnalysisDialog from "./RouteAnalysisDialog";

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

interface Client {
  id: string;
  name: string;
  address: string;
}

const CreateRoundDialog = ({ isOpen, onClose, onRoundCreated }: CreateRoundDialogProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [roundType, setRoundType] = useState<'template' | 'avulsa'>('template');
  const [clientSearch, setClientSearch] = useState('');
  const [showRoutePreview, setShowRoutePreview] = useState(false);
  const [formData, setFormData] = useState({
    template_id: "",
    client_id: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      fetchClients();
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    if (clientSearch.trim() === '') {
      setFilteredClients(clients);
    } else {
      const search = clientSearch.toLowerCase();
      setFilteredClients(
        clients.filter(client => 
          client.name.toLowerCase().includes(search) ||
          client.address.toLowerCase().includes(search)
        )
      );
    }
  }, [clientSearch, clients]);

  const resetForm = () => {
    setFormData({
      template_id: "",
      client_id: ""
    });
    setRoundType('template');
    setClientSearch('');
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

  const fetchClients = async () => {
    try {
      console.log("Fetching clients...");
      
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, address")
        .eq("active", true)
        .order("name");

      console.log("Clients query result:", { data, error });

      if (error) throw error;
      
      console.log("Setting clients:", data);
      setClients(data || []);
      setFilteredClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar clientes",
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

      if (roundType === 'template') {
        // Criar ronda com template
        console.log("Fetching template and checkpoints for:", formData.template_id);
        
        const { data: templateData, error: templateError } = await supabase
          .from("round_templates")
          .select(`
            id,
            name,
            shift_type,
            requires_signature
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
          .select("id, client_id, order_index, required_signature")
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
          requires_signature: templateData.requires_signature || false,
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
      } else {
        // Criar ronda avulsa (sem template)
        if (!formData.client_id) {
          throw new Error("Selecione uma empresa para criar a ronda avulsa");
        }

        console.log("Creating avulsa round for client:", formData.client_id);

        const roundData = {
          user_id: null, // NULL = disponível para qualquer tático
          client_id: formData.client_id,
          template_id: null, // Ronda avulsa não tem template
          vehicle_id: null,
          vehicle: null,
          status: 'pending' as const,
          current_checkpoint_index: 0,
          round_number: 1,
          requires_signature: false, // Ronda avulsa não requer assinatura por padrão
          created_by: user.id
        };

        console.log("Creating avulsa round with data:", roundData);

        const { error } = await supabase
          .from("rounds")
          .insert([roundData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Ronda avulsa criada com sucesso! Disponível para todos os táticos.",
        });
      }

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
          {/* Tipo de Ronda */}
          <div className="space-y-3">
            <Label>Tipo de Ronda</Label>
            <RadioGroup value={roundType} onValueChange={(value: 'template' | 'avulsa') => setRoundType(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="template" id="template" />
                <Label htmlFor="template" className="font-normal cursor-pointer">
                  Ronda com Template
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="avulsa" id="avulsa" />
                <Label htmlFor="avulsa" className="font-normal cursor-pointer">
                  Ronda Avulsa (Empresa Específica)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Template Selection */}
          {roundType === 'template' && (
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
                  {templates.length === 0 ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      Nenhum template ativo disponível
                    </div>
                  ) : (
                    templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} - {template.shift_type}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              
              {/* Botão de prévia de rota */}
              {formData.template_id && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRoutePreview(true)}
                  className="w-full mt-2"
                  size="sm"
                >
                  <RouteIcon className="w-4 h-4 mr-2" />
                  Ver Prévia da Rota (Distância, Tempo, Custo)
                </Button>
              )}
            </div>
          )}

          {/* Client Selection for Avulsa */}
          {roundType === 'avulsa' && (
            <div className="space-y-2">
              <Label htmlFor="client_search">Buscar Empresa</Label>
              <Input
                id="client_search"
                type="text"
                placeholder="Digite o nome ou endereço da empresa..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="mb-2"
              />
              <Label htmlFor="client_id">Selecionar Empresa</Label>
              <Select 
                value={formData.client_id} 
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  {filteredClients.length === 0 ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      {clientSearch ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa disponível'}
                    </div>
                  ) : (
                    filteredClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          <div className="flex flex-col">
                            <span className="font-medium">{client.name}</span>
                            <span className="text-xs text-muted-foreground">{client.address}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                💡 Ideal para atendimentos direcionados, acionamentos de alarme, solicitações imediatas ou serviços específicos
              </p>
            </div>
          )}

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
              disabled={loading || (roundType === 'template' && !formData.template_id) || (roundType === 'avulsa' && !formData.client_id)}
              className="flex-1 bg-tactical-green hover:bg-tactical-green/90"
            >
              {loading ? "Criando..." : "Criar Ronda"}
            </Button>
          </div>
        </form>
      </DialogContent>
      
      {/* Route Preview Dialog */}
      {formData.template_id && (
        <RouteAnalysisDialog
          open={showRoutePreview}
          onOpenChange={setShowRoutePreview}
          templateId={formData.template_id}
          vehicleType="car"
          roundName={templates.find(t => t.id === formData.template_id)?.name}
        />
      )}
    </Dialog>
  );
};

export default CreateRoundDialog;
