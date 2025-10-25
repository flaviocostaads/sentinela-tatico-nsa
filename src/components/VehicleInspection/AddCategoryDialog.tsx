import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ChecklistCategory {
  category: string;
  categoryLabel: string;
  items: any[];
}

interface AddCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (category: ChecklistCategory) => void;
}

export const AddCategoryDialog = ({ open, onOpenChange, onAdd }: AddCategoryDialogProps) => {
  const [categoryLabel, setCategoryLabel] = useState("");

  const handleAdd = () => {
    if (!categoryLabel.trim()) return;

    const newCategory: ChecklistCategory = {
      category: categoryLabel.toLowerCase().replace(/\s+/g, '_'),
      categoryLabel: categoryLabel,
      items: []
    };

    onAdd(newCategory);
    
    // Reset form
    setCategoryLabel("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Categoria</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Categoria</Label>
            <Input
              value={categoryLabel}
              onChange={(e) => setCategoryLabel(e.target.value)}
              placeholder="Ex: Motor, Pneus, Freios..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAdd} disabled={!categoryLabel.trim()}>
            Adicionar Categoria
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
