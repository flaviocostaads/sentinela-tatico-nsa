import { useState } from "react";
import { Camera, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface ChecklistItemProps {
  itemId: string;
  itemName: string;
  required: boolean;
  requiresPhoto: boolean;
  allowReportProblem: boolean;
  checked: boolean;
  hasPhoto: boolean;
  hasProblem: boolean;
  onCheckChange: (checked: boolean) => void;
  onPhotoClick: () => void;
  onReportProblem: () => void;
}

const ChecklistItemCard = ({
  itemId,
  itemName,
  required,
  requiresPhoto,
  allowReportProblem,
  checked,
  hasPhoto,
  hasProblem,
  onCheckChange,
  onPhotoClick,
  onReportProblem
}: ChecklistItemProps) => {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
      checked
        ? 'bg-tactical-green/10 border-tactical-green/30'
        : hasProblem
        ? 'bg-tactical-red/10 border-tactical-red/30'
        : 'bg-muted/30 border-border'
    }`}>
      {/* Checkbox */}
      <div className="flex-shrink-0">
        <Checkbox
          id={itemId}
          checked={checked}
          onCheckedChange={onCheckChange}
          className={checked ? 'data-[state=checked]:bg-tactical-green data-[state=checked]:border-tactical-green' : ''}
        />
      </div>

      {/* Item Name */}
      <Label
        htmlFor={itemId}
        className="flex-1 cursor-pointer text-foreground font-medium"
      >
        {itemName}
        {required && <span className="text-tactical-red ml-1">*</span>}
      </Label>

      {/* Status Badges */}
      <div className="flex items-center space-x-2">
        {checked && (
          <Badge className="bg-tactical-green text-white">
            <Check className="w-3 h-3" />
          </Badge>
        )}
        {hasProblem && (
          <Badge className="bg-tactical-red text-white">
            <AlertTriangle className="w-3 h-3" />
          </Badge>
        )}
        {hasPhoto && (
          <Badge className="bg-tactical-blue text-white">
            <Camera className="w-3 h-3" />
          </Badge>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-1">
        {/* Report Problem Button */}
        {allowReportProblem && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onReportProblem}
            className={hasProblem ? 'text-tactical-red hover:text-tactical-red/80' : ''}
          >
            <AlertTriangle className="w-4 h-4" />
          </Button>
        )}

        {/* Photo Button */}
        {requiresPhoto && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onPhotoClick}
            className={hasPhoto ? 'text-tactical-blue hover:text-tactical-blue/80' : ''}
          >
            <Camera className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default ChecklistItemCard;
