import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface ChecklistItem {
  id: string;
  name: string;
  required: boolean;
  requiresPhoto: boolean;
  allowReportProblem: boolean;
}

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: ChecklistItem) => void;
}

export const AddItemDialog = ({ open, onOpenChange, onAdd }: AddItemDialogProps) => {
  const [itemName, setItemName] = useState("");
  const [required, setRequired] = useState(false);
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [allowReportProblem, setAllowReportProblem] = useState(true);

  const handleAdd = () => {
    if (!itemName.trim()) return;

    const newItem: ChecklistItem = {
      id: itemName.toLowerCase().replace(/\s+/g, '_'),
      name: itemName,
      required,
      requiresPhoto,
      allowReportProblem
    };

    onAdd(newItem);
    
    // Reset form
    setItemName("");
    setRequired(false);
    setRequiresPhoto(false);
    setAllowReportProblem(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Item de Checklist</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Item</Label>
            <Input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Ex: Nível de óleo do motor"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={required}
                onCheckedChange={(checked) => setRequired(checked as boolean)}
                id="required"
              />
              <Label htmlFor="required" className="cursor-pointer">
                Item obrigatório
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={requiresPhoto}
                onCheckedChange={(checked) => setRequiresPhoto(checked as boolean)}
                id="requiresPhoto"
              />
              <Label htmlFor="requiresPhoto" className="cursor-pointer">
                Requer foto
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={allowReportProblem}
                onCheckedChange={(checked) => setAllowReportProblem(checked as boolean)}
                id="allowReportProblem"
              />
              <Label htmlFor="allowReportProblem" className="cursor-pointer">
                Permitir relatar problema
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAdd} disabled={!itemName.trim()}>
            Adicionar Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
