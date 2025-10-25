import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemRow } from "./ItemRow";
import { AddItemDialog } from "./AddItemDialog";
import { Badge } from "@/components/ui/badge";

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

interface CategorySectionProps {
  category: ChecklistCategory;
  onUpdate: (category: ChecklistCategory) => void;
  onDelete: () => void;
}

export const CategorySection = ({ category, onUpdate, onDelete }: CategorySectionProps) => {
  const [showAddItem, setShowAddItem] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleAddItem = (newItem: ChecklistItem) => {
    onUpdate({
      ...category,
      items: [...category.items, newItem]
    });
  };

  const handleUpdateItem = (index: number, updatedItem: ChecklistItem) => {
    const newItems = [...category.items];
    newItems[index] = updatedItem;
    onUpdate({ ...category, items: newItems });
  };

  const handleDeleteItem = (index: number) => {
    onUpdate({
      ...category,
      items: category.items.filter((_, i) => i !== index)
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Button>
              <CardTitle className="text-lg">{category.categoryLabel}</CardTitle>
              <Badge variant="secondary">{category.items.length} itens</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddItem(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Item
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent>
            {category.items.length > 0 ? (
              <div className="space-y-2">
                {category.items.map((item, index) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onUpdate={(updatedItem) => handleUpdateItem(index, updatedItem)}
                    onDelete={() => handleDeleteItem(index)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Nenhum item nesta categoria</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setShowAddItem(true)}
                  className="mt-2"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar primeiro item
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <AddItemDialog
        open={showAddItem}
        onOpenChange={setShowAddItem}
        onAdd={handleAddItem}
      />
    </>
  );
};
