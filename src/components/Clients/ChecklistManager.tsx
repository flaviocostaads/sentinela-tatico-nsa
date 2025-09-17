import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ChecklistItem {
  id: string;
  description: string;
  required: boolean;
}

interface ChecklistManagerProps {
  open: boolean;
  onClose: () => void;
  checkpointId: string;
  checkpointName: string;
}

const ChecklistManager = ({ open, onClose, checkpointId, checkpointName }: ChecklistManagerProps) => {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState({ description: "", required: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState({ description: "", required: true });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchChecklistItems();
    }
  }, [open, checkpointId]);

  const fetchChecklistItems = async () => {
    try {
      const { data, error } = await supabase
        .from("checkpoints")
        .select("checklist_items")
        .eq("id", checkpointId)
        .single();

      if (error) throw error;

      if (data?.checklist_items && Array.isArray(data.checklist_items)) {
        const parsedItems = data.checklist_items.map((item: any, index: number) => ({
          id: (index + 1).toString(),
          description: typeof item === 'string' ? item : item.description,
          required: typeof item === 'string' ? true : (item.required ?? true)
        }));
        setItems(parsedItems);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error("Error fetching checklist items:", error);
      setItems([]);
    }
  };

  const saveChecklistItems = async () => {
    try {
      const checklistData = items.map(item => ({
        description: item.description,
        required: item.required
      }));

      console.log("Salvando checklist:", checklistData);

      const { error } = await supabase
        .from("checkpoints")
        .update({ checklist_items: checklistData })
        .eq("id", checkpointId);

      if (error) throw error;

      console.log("Checklist salvo com sucesso");
      toast({
        title: "Sucesso",
        description: "Checklist atualizado com sucesso!",
      });
    } catch (error) {
      console.error("Error saving checklist:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar checklist",
        variant: "destructive",
      });
    }
  };

  const addItem = () => {
    if (!newItem.description.trim()) {
      toast({
        title: "Erro",
        description: "Digite uma descrição para o item",
        variant: "destructive",
      });
      return;
    }

    if (items.length >= 10) {
      toast({
        title: "Limite atingido",
        description: "Máximo de 10 itens por checklist",
        variant: "destructive",
      });
      return;
    }

    const updatedItems = [...items, {
      id: Date.now().toString(),
      description: newItem.description,
      required: newItem.required
    }];
    setItems(updatedItems);
    setNewItem({ description: "", required: true });
    
    // Salvar após atualizar o estado
    setTimeout(() => saveChecklistItems(), 100);
  };

  const startEdit = (item: ChecklistItem) => {
    setEditingId(item.id);
    setEditingItem({ description: item.description, required: item.required });
  };

  const saveEdit = () => {
    if (!editingItem.description.trim()) {
      toast({
        title: "Erro",
        description: "Digite uma descrição para o item",
        variant: "destructive",
      });
      return;
    }

    const updatedItems = items.map(item => 
      item.id === editingId 
        ? { ...item, description: editingItem.description.trim(), required: editingItem.required }
        : item
    );
    setItems(updatedItems);
    setEditingId(null);
    setEditingItem({ description: "", required: true });
    
    // Salvar após atualizar o estado
    setTimeout(() => saveChecklistItems(), 100);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingItem({ description: "", required: true });
  };

  const deleteItem = (itemId: string) => {
    const updatedItems = items.filter(item => item.id !== itemId);
    setItems(updatedItems);
    
    // Salvar após atualizar o estado  
    setTimeout(() => saveChecklistItems(), 100);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Checklist - {checkpointName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add new item */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <h3 className="font-medium mb-3">Adicionar novo item</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="new-description">Descrição</Label>
                <Input
                  id="new-description"
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Ex: Verificar se as portas estão trancadas"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="new-required"
                  checked={newItem.required}
                  onCheckedChange={(checked) => setNewItem({ ...newItem, required: !!checked })}
                />
                <Label htmlFor="new-required">Item obrigatório</Label>
              </div>
              <Button onClick={addItem} size="sm" className="bg-tactical-green hover:bg-tactical-green/90">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Item
              </Button>
            </div>
          </div>

          {/* Items list */}
          <div className="space-y-3">
            <h3 className="font-medium">Itens do checklist ({items.length})</h3>
            
            {items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum item adicionado ainda</p>
                <p className="text-sm">Adicione itens para personalizar o checklist deste ponto</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="border rounded-lg p-3">
                    {editingId === item.id ? (
                      <div className="space-y-3">
                        <Input
                          value={editingItem.description}
                          onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                          placeholder="Descrição do item"
                        />
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={editingItem.required}
                            onCheckedChange={(checked) => setEditingItem({ ...editingItem, required: !!checked })}
                          />
                          <Label>Item obrigatório</Label>
                        </div>
                        <div className="flex space-x-2">
                          <Button size="sm" onClick={saveEdit} className="bg-tactical-green hover:bg-tactical-green/90">
                            <Save className="w-3 h-3 mr-1" />
                            Salvar
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit}>
                            <X className="w-3 h-3 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm">{item.description}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              item.required ? 'bg-tactical-red/20 text-tactical-red' : 'bg-muted text-muted-foreground'
                            }`}>
                              {item.required ? 'Obrigatório' : 'Opcional'}
                            </span>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteItem(item.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChecklistManager;