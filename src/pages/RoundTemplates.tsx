import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Route, 
  Plus, 
  Building2, 
  Clock, 
  Users,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit,
  Calendar
} from "lucide-react";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";
import CreateRoundDialog from "@/components/TacticApp/CreateRoundDialog";

interface RoundTemplate {
  id: string;
  name: string;
  description?: string;
  shift_type: 'diurno' | 'noturno';
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  requires_signature: boolean;
  round_template_checkpoints: TemplateCheckpoint[];
}

interface TemplateCheckpoint {
  id: string;
  template_id: string;
  client_id: string;
  order_index: number;
  estimated_duration_minutes: number;
  required_signature: boolean;
  clients: {
    name: string;
    address: string;
  };
}

interface Client {
  id: string;
  name: string;
  address: string;
}

const RoundTemplates = () => {
  const [templates, setTemplates] = useState<RoundTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createRoundDialogOpen, setCreateRoundDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RoundTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    shift_type: "diurno" as 'diurno' | 'noturno',
    checkpoints: [] as Array<{
      client_id: string;
      required_signature: boolean;
    }>
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchTemplates(),
        fetchClients()
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
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
            *,
            clients (name, address)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates((data || []).map(template => ({
        ...template,
        shift_type: template.shift_type as 'diurno' | 'noturno'
      })));
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("active", true)
        .order("name");

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (formData.checkpoints.length === 0) {
        toast({
          title: "Erro",
          description: "Adicione pelo menos um checkpoint ao template",
          variant: "destructive",
        });
        return;
      }

      let templateId: string;

      if (editingTemplate) {
        // Atualizar template existente
        const { error: updateError } = await supabase
          .from("round_templates")
          .update({
            name: formData.name,
            description: formData.description,
            shift_type: formData.shift_type
          })
          .eq("id", editingTemplate.id);

        if (updateError) throw updateError;

        // Remover checkpoints existentes
        await supabase
          .from("round_template_checkpoints")
          .delete()
          .eq("template_id", editingTemplate.id);

        templateId = editingTemplate.id;
      } else {
        // Criar novo template
        const { data: newTemplate, error: insertError } = await supabase
          .from("round_templates")
          .insert([{
            name: formData.name,
            description: formData.description,
            shift_type: formData.shift_type,
            created_by: user.id
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        templateId = newTemplate.id;
      }

      // Inserir checkpoints
      const checkpointsToInsert = formData.checkpoints.map((checkpoint, index) => ({
        template_id: templateId,
        client_id: checkpoint.client_id,
        order_index: index + 1,
        estimated_duration_minutes: 15, // Default duration
        required_signature: checkpoint.required_signature
      }));

      const { error: checkpointsError } = await supabase
        .from("round_template_checkpoints")
        .insert(checkpointsToInsert);

      if (checkpointsError) throw checkpointsError;

      toast({
        title: "Sucesso",
        description: editingTemplate ? "Template atualizado com sucesso!" : "Template criado com sucesso!",
      });

      setDialogOpen(false);
      setEditingTemplate(null);
      resetForm();
      fetchTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar template",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      shift_type: "diurno",
      checkpoints: []
    });
  };

  const addCheckpoint = () => {
    setFormData({
      ...formData,
      checkpoints: [
        ...formData.checkpoints,
        {
          client_id: "",
          required_signature: false
        }
      ]
    });
  };

  const removeCheckpoint = (index: number) => {
    const newCheckpoints = formData.checkpoints.filter((_, i) => i !== index);
    setFormData({ ...formData, checkpoints: newCheckpoints });
  };

  const moveCheckpoint = (index: number, direction: 'up' | 'down') => {
    const newCheckpoints = [...formData.checkpoints];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex >= 0 && newIndex < newCheckpoints.length) {
      [newCheckpoints[index], newCheckpoints[newIndex]] = [newCheckpoints[newIndex], newCheckpoints[index]];
      setFormData({ ...formData, checkpoints: newCheckpoints });
    }
  };

  const updateCheckpoint = (index: number, field: string, value: any) => {
    const newCheckpoints = [...formData.checkpoints];
    newCheckpoints[index] = { ...newCheckpoints[index], [field]: value };
    setFormData({ ...formData, checkpoints: newCheckpoints });
  };

  const editTemplate = (template: RoundTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      shift_type: template.shift_type,
      checkpoints: template.round_template_checkpoints
        .sort((a, b) => a.order_index - b.order_index)
        .map(cp => ({
          client_id: cp.client_id,
          required_signature: cp.required_signature
        }))
    });
    setDialogOpen(true);
  };

  const toggleTemplateStatus = async (templateId: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from("round_templates")
        .update({ active: !active })
        .eq("id", templateId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Template ${!active ? 'ativado' : 'desativado'} com sucesso!`,
      });

      fetchTemplates();
    } catch (error) {
      console.error("Error updating template status:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status do template",
        variant: "destructive",
      });
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      // Primeiro, deletar os checkpoints do template
      const { error: checkpointsError } = await supabase
        .from("round_template_checkpoints")
        .delete()
        .eq("template_id", templateId);

      if (checkpointsError) throw checkpointsError;

      // Depois, deletar o template
      const { error } = await supabase
        .from("round_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Template excluído com sucesso!",
      });

      fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir template",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Templates de Rondas</h1>
              <p className="text-muted-foreground">
                Crie e gerencie trajetos predefinidos para as rondas
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => setCreateRoundDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Criar Ronda
              </Button>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) {
                  setEditingTemplate(null);
                  resetForm();
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-tactical-green hover:bg-tactical-green/90">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Template
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingTemplate ? 'Editar Template' : 'Criar Novo Template'}
                  </DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Template</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        placeholder="Ex: Ronda Centro Comercial"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shift_type">Turno</Label>
                      <Select 
                        value={formData.shift_type} 
                        onValueChange={(value: 'diurno' | 'noturno') => 
                          setFormData({ ...formData, shift_type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="diurno">Diurno</SelectItem>
                          <SelectItem value="noturno">Noturno</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descreva o trajeto e objetivos desta ronda..."
                    />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Checkpoints da Ronda</h3>
                    </div>

                    {/* Add client button */}
                    <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 text-center">
                      <Button type="button" onClick={addCheckpoint} variant="outline" className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Cliente
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {formData.checkpoints.map((checkpoint, index) => (
                        <Card key={index} className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline">{index + 1}</Badge>
                              <span className="font-medium">Checkpoint {index + 1}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => moveCheckpoint(index, 'up')}
                                disabled={index === 0}
                              >
                                <ArrowUp className="w-3 h-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => moveCheckpoint(index, 'down')}
                                disabled={index === formData.checkpoints.length - 1}
                              >
                                <ArrowDown className="w-3 h-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeCheckpoint(index)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                           <div className="space-y-4">
                             <div className="space-y-2">
                               <Label>Cliente</Label>
                               <Select
                                 value={checkpoint.client_id}
                                 onValueChange={(value) => updateCheckpoint(index, 'client_id', value)}
                               >
                                 <SelectTrigger>
                                   <SelectValue placeholder="Selecione o cliente" />
                                 </SelectTrigger>
                                 <SelectContent>
                                   {clients.map((client) => (
                                     <SelectItem key={client.id} value={client.id}>
                                       {client.name} - {client.address}
                                     </SelectItem>
                                   ))}
                                 </SelectContent>
                               </Select>
                             </div>

                             <div className="mt-3">
                               <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                   type="checkbox"
                                   checked={checkpoint.required_signature}
                                   onChange={(e) => updateCheckpoint(index, 'required_signature', e.target.checked)}
                                   className="rounded border-border"
                                 />
                                 <span className="text-sm">Assinatura obrigatória</span>
                               </label>
                             </div>
                           </div>
                         </Card>
                      ))}
                    </div>

                    {formData.checkpoints.length === 0 && (
                      <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                        <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          Nenhum checkpoint adicionado. Clique em "Adicionar Cliente" para começar.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setDialogOpen(false)} 
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 bg-tactical-green hover:bg-tactical-green/90"
                      disabled={!formData.name || formData.checkpoints.length === 0}
                    >
                      {editingTemplate ? 'Atualizar Template' : 'Criar Template'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {/* Lista de templates */}
          <div className="grid gap-6">
            {templates.map((template) => (
              <Card key={template.id} className="tactical-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Route className="w-6 h-6 text-primary" />
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {template.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={template.active ? 'bg-tactical-green text-white' : 'bg-muted text-muted-foreground'}>
                        {template.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge variant="outline">
                        {template.shift_type === 'diurno' ? '☀️ Diurno' : '🌙 Noturno'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">
                        {template.round_template_checkpoints.length} checkpoints
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">
                        Criado em {new Date(template.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Lista de checkpoints */}
                  <div className="space-y-2 mb-4">
                    <h4 className="font-medium text-sm text-muted-foreground">Sequência de Checkpoints:</h4>
                    <div className="flex flex-wrap gap-2">
                      {template.round_template_checkpoints
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((checkpoint, index) => (
                          <Badge key={checkpoint.id} variant="outline" className="text-xs">
                            {index + 1}. {checkpoint.clients.name}
                            {checkpoint.required_signature && ' ✍️'}
                          </Badge>
                        ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => editTemplate(template)}
                        className="bg-tactical-blue/10 hover:bg-tactical-blue/20 text-tactical-blue border-tactical-blue/30"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Editar Template
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleTemplateStatus(template.id, template.active)}
                        className={template.active 
                          ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-300' 
                          : 'bg-green-50 hover:bg-green-100 text-green-600 border-green-300'
                        }
                      >
                        {template.active ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteTemplate(template.id)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Excluir Template
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {templates.length === 0 && (
            <div className="text-center py-12">
              <Route className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum template de ronda criado</p>
            </div>
          )}
        </main>
      </div>

      {/* Create Round Dialog */}
      <CreateRoundDialog
        isOpen={createRoundDialogOpen}
        onClose={() => setCreateRoundDialogOpen(false)}
        onRoundCreated={() => {
          setCreateRoundDialogOpen(false);
          fetchTemplates();
        }}
      />
    </div>
  );
};

export default RoundTemplates;