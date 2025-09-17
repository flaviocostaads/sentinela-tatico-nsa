import { Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ViewModeToggleProps {
  isMobileView: boolean;
  onToggle: () => void;
}

const ViewModeToggle = ({ isMobileView, onToggle }: ViewModeToggleProps) => {
  return (
    <div className="fixed top-4 right-4 z-50">
      <Button
        onClick={onToggle}
        variant="outline"
        size="sm"
        className="bg-background/95 backdrop-blur-sm border-border/50 shadow-lg"
      >
        {isMobileView ? (
          <>
            <Monitor className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Desktop</span>
            <Badge variant="secondary" className="ml-2 text-xs">
              Mobile
            </Badge>
          </>
        ) : (
          <>
            <Smartphone className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Mobile</span>
            <Badge variant="secondary" className="ml-2 text-xs">
              Desktop
            </Badge>
          </>
        )}
      </Button>
    </div>
  );
};

export default ViewModeToggle;