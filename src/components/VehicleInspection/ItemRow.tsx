import { useState } from "react";
import { GripVertical, Pencil, Trash2, Camera, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  name: string;
  required: boolean;
  requiresPhoto: boolean;
  allowReportProblem: boolean;
}

interface ItemRowProps {
  item: ChecklistItem;
  onUpdate: (item: ChecklistItem) => void;
  onDelete: () => void;
}

export const ItemRow = ({ item, onUpdate, onDelete }: ItemRowProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(item.name);

  const handleSave = () => {
    onUpdate({ ...item, name: editedName });
    setIsEditing(false);
  };

  return (
    <div className="group flex items-center space-x-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
      
      {isEditing ? (
        <Input
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') {
              setEditedName(item.name);
              setIsEditing(false);
            }
          }}
          className="flex-1"
          autoFocus
        />
      ) : (
        <div className="flex-1 flex items-center space-x-2">
          <span className="font-medium">{item.name}</span>
        </div>
      )}

      <div className="flex items-center space-x-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 w-8 p-0", item.required && "text-tactical-red")}
          onClick={() => onUpdate({ ...item, required: !item.required })}
          title={item.required ? "Obrigatório" : "Opcional"}
        >
          <span className="text-xs font-bold">*</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 w-8 p-0", item.requiresPhoto && "text-primary")}
          onClick={() => onUpdate({ ...item, requiresPhoto: !item.requiresPhoto })}
          title={item.requiresPhoto ? "Requer foto" : "Foto opcional"}
        >
          <Camera className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 w-8 p-0", item.allowReportProblem && "text-tactical-orange")}
          onClick={() => onUpdate({ ...item, allowReportProblem: !item.allowReportProblem })}
          title={item.allowReportProblem ? "Pode relatar problema" : "Sem relato de problema"}
        >
          <AlertCircle className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
