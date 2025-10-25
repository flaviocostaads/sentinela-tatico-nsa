import { useState } from "react";
import { Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CategorySection } from "./CategorySection";
import { AddCategoryDialog } from "./AddCategoryDialog";
import { useToast } from "@/hooks/use-toast";

interface ChecklistItem {
  id: string;
  name: string;
  required: boolean;
  requiresPhoto: boolean;
  allowReportProblem: boolean;
}

interface ChecklistCategory {
  category: string;
  categoryLabel: string;
  items: ChecklistItem[];
}

interface Template {
  id: string;
  name: string;
  vehicle_type: 'car' | 'motorcycle';
  items: ChecklistCategory[];
  active: boolean;
}

interface TemplateEditorAdvancedProps {
  template: Template;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (template: Template) => void;
}

export const TemplateEditorAdvanced = ({
  template: initialTemplate,
  open,
  onOpenChange,
  onSave
}: TemplateEditorAdvancedProps) => {
  const [template, setTemplate] = useState<Template>(initialTemplate);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const { toast } = useToast();

  const handleAddCategory = (category: ChecklistCategory) => {
    setTemplate({
      ...template,
      items: [...template.items, category]
    });
  };

  const handleUpdateCategory = (index: number, updatedCategory: ChecklistCategory) => {
    const newItems = [...template.items];
    newItems[index] = updatedCategory;
    setTemplate({ ...template, items: newItems });
  };

  const handleDeleteCategory = (index: number) => {
    setTemplate({
      ...template,
      items: template.items.filter((_, i) => i !== index)
    });
  };

  const handleSave = () => {
    // Validations
    if (!template.name.trim()) {
      toast({
        title: "Erro",
        description: "O nome do template é obrigatório",
        variant: "destructive"
      });
      return;
    }

    if (template.items.length === 0) {
      toast({
        title: "Aviso",
        description: "Adicione pelo menos uma categoria",
        variant: "destructive"
      });
      return;
    }

    const hasItems = template.items.some(cat => cat.items.length > 0);
    if (!hasItems) {
      toast({
        title: "Aviso",
        description: "Adicione pelo menos um item em alguma categoria",
        variant: "destructive"
      });
      return;
    }

    onSave(template);
  };

  const getTotalItems = () => {
    return template.items.reduce((sum, category) => sum + category.items.length, 0);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl">
              {template.id ? 'Editar Template' : 'Novo Template'}
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Template</Label>
                <Input
                  value={template.name}
                  onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                  placeholder="Ex: Checklist Padrão - Carro"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Veículo</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
                  value={template.vehicle_type}
                  onChange={(e) => setTemplate({
                    ...template,
                    vehicle_type: e.target.value as 'car' | 'motorcycle'
                  })}
                >
                  <option value="car">Carro</option>
                  <option value="motorcycle">Moto</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={template.active}
                  onCheckedChange={(checked) => setTemplate({ ...template, active: checked })}
                  id="active"
                />
                <Label htmlFor="active" className="cursor-pointer">
                  Template ativo
                </Label>
              </div>
              <div className="text-sm text-muted-foreground">
                {template.items.length} categorias • {getTotalItems()} itens
              </div>
            </div>
          </div>

          {/* Categories */}
          <ScrollArea className="h-[400px] px-6">
            <div className="space-y-4 pb-4">
              {template.items.map((category, index) => (
                <CategorySection
                  key={category.category}
                  category={category}
                  onUpdate={(updated) => handleUpdateCategory(index, updated)}
                  onDelete={() => handleDeleteCategory(index)}
                />
              ))}

              {template.items.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground mb-4">
                    Nenhuma categoria adicionada
                  </p>
                  <Button onClick={() => setShowAddCategory(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Primeira Categoria
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t p-6 flex items-center justify-between bg-muted/50">
            <Button
              variant="outline"
              onClick={() => setShowAddCategory(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Categoria
            </Button>

            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Salvar Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddCategoryDialog
        open={showAddCategory}
        onOpenChange={setShowAddCategory}
        onAdd={handleAddCategory}
      />
    </>
  );
};
