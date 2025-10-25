import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useInspectionTemplates } from '@/hooks/useInspectionTemplates';
import { useVehicleInspections } from '@/hooks/useVehicleInspections';
// import SignaturePad from '@/components/TacticApp/SignaturePad';

interface VehicleInspectionDialogProps {
  open: boolean;
  onClose: () => void;
  vehicleId: string;
  vehicleType: 'car' | 'motorcycle';
}

export default function VehicleInspectionDialog({
  open,
  onClose,
  vehicleId,
  vehicleType
}: VehicleInspectionDialogProps) {
  const { toast } = useToast();
  const { getTemplateByVehicleType } = useInspectionTemplates();
  const { createInspection } = useVehicleInspections();
  const [odometer, setOdometer] = useState('');
  const [fuelLevel, setFuelLevel] = useState([70]);
  const [notes, setNotes] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [checklistData, setChecklistData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const signaturePadRef = useRef<any>(null);

  const template = getTemplateByVehicleType(vehicleType);

  const handleCheckItem = (categoryIdx: number, itemIdx: number, checked: boolean) => {
    const newData = [...(checklistData.length > 0 ? checklistData : template?.items || [])];
    if (!newData[categoryIdx]) return;
    if (!newData[categoryIdx].items[itemIdx]) return;
    newData[categoryIdx].items[itemIdx].checked = checked;
    setChecklistData(newData);
  };

  const handleSubmit = async () => {
    if (!odometer) {
      toast({ title: "Erro", description: "Informe o odômetro", variant: "destructive" });
      return;
    }

    const allChecked = checklistData.every(cat =>
      cat.items.every((item: any) => item.checked || !item.required)
    );

    try {
      setLoading(true);
      await createInspection({
        vehicle_id: vehicleId,
        template_id: template?.id,
        inspection_type: 'pre_shift',
        checklist_data: checklistData.length > 0 ? checklistData : template?.items,
        odometer_reading: parseInt(odometer),
        fuel_level: fuelLevel[0],
        overall_status: allChecked ? 'approved' : 'approved_with_issues',
        notes,
        signature_data: signatureData,
        inspection_date: new Date().toISOString()
      });

      toast({ title: "Sucesso", description: "Inspeção registrada com sucesso" });
      onClose();
    } catch (error) {
      console.error('Error creating inspection:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inspeção Veicular</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Odômetro (km)</Label>
              <Input
                type="number"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                placeholder="Ex: 45230"
              />
            </div>
            <div className="space-y-2">
              <Label>Nível de Combustível: {fuelLevel[0]}%</Label>
              <Slider
                value={fuelLevel}
                onValueChange={setFuelLevel}
                max={100}
                step={5}
                className="mt-2"
              />
            </div>
          </div>

          {template?.items.map((category: any, catIdx: number) => (
            <Card key={catIdx}>
              <CardHeader>
                <CardTitle className="text-lg">{category.categoryLabel}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {category.items.map((item: any, itemIdx: number) => (
                  <div key={itemIdx} className="flex items-center gap-3">
                    <Checkbox
                      id={`${catIdx}-${itemIdx}`}
                      onCheckedChange={(checked) => handleCheckItem(catIdx, itemIdx, !!checked)}
                    />
                    <Label htmlFor={`${catIdx}-${itemIdx}`} className="flex-1 cursor-pointer">
                      {item.name}
                      {item.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações sobre a inspeção..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Assinatura Digital (Opcional)</Label>
            <div className="border rounded-lg p-4 bg-muted text-center text-sm text-muted-foreground">
              Assinatura digital será implementada em breve
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Salvando...' : 'Finalizar Inspeção'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
