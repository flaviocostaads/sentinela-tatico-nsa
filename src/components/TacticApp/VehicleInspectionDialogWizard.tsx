import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Camera, AlertTriangle, Fuel } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useInspectionTemplates } from '@/hooks/useInspectionTemplates';
import { useVehicleInspections } from '@/hooks/useVehicleInspections';
import { supabase } from '@/integrations/supabase/client';
import VehicleSelectionStep from './VehicleSelectionStep';
import OdometerStep from './OdometerStep';
import ChecklistItemCard from './ChecklistItemCard';
import ProblemReportDialog from './ProblemReportDialog';
import SignaturePad from './SignaturePad';

interface VehicleInspectionDialogWizardProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'vehicle' | 'odometer' | 'fuel' | 'checklist' | 'issues' | 'signature';

interface Problem {
  itemId: string;
  itemName: string;
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  photos: File[];
}

export default function VehicleInspectionDialogWizard({
  open,
  onClose,
}: VehicleInspectionDialogWizardProps) {
  const { toast } = useToast();
  const { getTemplateByVehicleType } = useInspectionTemplates();
  const { createInspection } = useVehicleInspections();
  
  const [step, setStep] = useState<Step>('vehicle');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicleType, setSelectedVehicleType] = useState<'car' | 'motorcycle' | 'foot'>('car');
  const [odometerReading, setOdometerReading] = useState<number>(0);
  const [odometerPhotoUrl, setOdometerPhotoUrl] = useState<string>('');
  const [fuelLevel, setFuelLevel] = useState([70]);
  const [checklistData, setChecklistData] = useState<any[]>([]);
  const [checkItemPhotos, setCheckItemPhotos] = useState<{[key: string]: File[]}>({});
  const [problems, setProblems] = useState<Problem[]>([]);
  const [generalIssues, setGeneralIssues] = useState('');
  const [generalIssuesPhotos, setGeneralIssuesPhotos] = useState<File[]>([]);
  const [signatureData, setSignatureData] = useState('');
  const [loading, setLoading] = useState(false);
  const [showProblemDialog, setShowProblemDialog] = useState(false);
  const [currentProblemItem, setCurrentProblemItem] = useState<{itemId: string, itemName: string, category: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const template = selectedVehicleType !== 'foot' 
    ? getTemplateByVehicleType(selectedVehicleType)
    : null;

  const getStepProgress = () => {
    const steps: Step[] = ['vehicle', 'odometer', 'fuel', 'checklist', 'issues', 'signature'];
    const currentIndex = steps.indexOf(step);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  const handleVehicleSelect = (vehicleId: string | null, vehicleType: 'car' | 'motorcycle' | 'foot') => {
    setSelectedVehicleId(vehicleId);
    setSelectedVehicleType(vehicleType);
    
    if (vehicleType === 'foot') {
      // Skip odometer and fuel for on foot
      setStep('signature');
    } else {
      setStep('odometer');
    }
  };

  const handleOdometerComplete = (odometer: number, photoUrl: string) => {
    setOdometerReading(odometer);
    setOdometerPhotoUrl(photoUrl);
    setStep('fuel');
  };

  const handleFuelComplete = () => {
    // Initialize checklist data from template
    if (template) {
      setChecklistData(template.items.map(category => ({
        ...category,
        items: category.items.map(item => ({
          ...item,
          checked: false
        }))
      })));
    }
    setStep('checklist');
  };

  const handleCheckItem = (categoryIdx: number, itemIdx: number, checked: boolean) => {
    const newData = [...checklistData];
    if (newData[categoryIdx] && newData[categoryIdx].items[itemIdx]) {
      newData[categoryIdx].items[itemIdx].checked = checked;
      setChecklistData(newData);
    }
  };

  const handleItemPhoto = async (categoryIdx: number, itemIdx: number) => {
    fileInputRef.current?.click();
    fileInputRef.current!.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const itemId = `${categoryIdx}-${itemIdx}`;
        setCheckItemPhotos(prev => ({
          ...prev,
          [itemId]: [...(prev[itemId] || []), file]
        }));
      }
    };
  };

  const handleReportProblem = (categoryIdx: number, itemIdx: number) => {
    const category = checklistData[categoryIdx];
    const item = category?.items[itemIdx];
    if (item) {
      setCurrentProblemItem({
        itemId: `${categoryIdx}-${itemIdx}`,
        itemName: item.name,
        category: category.categoryLabel
      });
      setShowProblemDialog(true);
    }
  };

  const handleProblemSubmit = (problem: {
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    photos: File[];
  }) => {
    if (currentProblemItem) {
      setProblems(prev => [...prev, {
        itemId: currentProblemItem.itemId,
        itemName: currentProblemItem.itemName,
        category: currentProblemItem.category,
        ...problem
      }]);
    }
  };

  const handleChecklistComplete = () => {
    setStep('issues');
  };

  const handleIssuesComplete = () => {
    setStep('signature');
  };

  const handleSignatureComplete = (signature: string) => {
    setSignatureData(signature);
    handleSubmit(signature);
  };

  const uploadPhotos = async (photos: File[], prefix: string): Promise<string[]> => {
    const uploadPromises = photos.map(async (photo, idx) => {
      const fileExt = photo.name.split('.').pop();
      const fileName = `${prefix}_${Date.now()}_${idx}.${fileExt}`;
      const filePath = `inspection/${fileName}`;

      const { error, data } = await supabase.storage
        .from('inspection-photos')
        .upload(filePath, photo);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('inspection-photos')
        .getPublicUrl(filePath);

      return publicUrl;
    });

    return Promise.all(uploadPromises);
  };

  const handleSubmit = async (signature: string) => {
    if (selectedVehicleType === 'foot') {
      // For on-foot, just record signature and close
      try {
        setLoading(true);
        toast({ 
          title: "Ronda a pé registrada", 
          description: "Pronto para iniciar ronda"
        });
        onClose();
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!selectedVehicleId) {
      toast({ title: "Erro", description: "Selecione um veículo", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);

      // Upload general issues photos
      let generalIssuesPhotoUrls: string[] = [];
      if (generalIssuesPhotos.length > 0) {
        generalIssuesPhotoUrls = await uploadPhotos(generalIssuesPhotos, 'general');
      }

      // Upload problem photos and build reported_problems
      const reportedProblems = await Promise.all(
        problems.map(async (problem) => {
          const photoUrls = problem.photos.length > 0
            ? await uploadPhotos(problem.photos, `problem_${problem.itemId}`)
            : [];

          return {
            item_id: problem.itemId,
            category: problem.category,
            problem_description: problem.description,
            severity: problem.severity,
            photo_urls: photoUrls
          };
        })
      );

      // Check if all required items are checked
      const allRequiredChecked = checklistData.every(cat =>
        cat.items.every((item: any) => item.checked || !item.required)
      );

      await createInspection({
        vehicle_id: selectedVehicleId,
        template_id: template?.id,
        inspection_type: 'pre_shift',
        checklist_data: checklistData,
        odometer_reading: odometerReading,
        fuel_level: fuelLevel[0],
        overall_status: allRequiredChecked && problems.length === 0 ? 'approved' : 'approved_with_issues',
        notes: generalIssues,
        signature_data: signature,
        inspection_date: new Date().toISOString(),
        general_issues_photos: generalIssuesPhotoUrls,
        reported_problems: reportedProblems
      });

      toast({ 
        title: "Inspeção concluída", 
        description: "Inspeção veicular registrada com sucesso"
      });
      onClose();
      
      // Reset all state
      setStep('vehicle');
      setSelectedVehicleId(null);
      setChecklistData([]);
      setProblems([]);
    } catch (error) {
      console.error('Error creating inspection:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar inspeção",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddGeneralIssuePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setGeneralIssuesPhotos(prev => [...prev, ...files]);
  };

  const renderStepContent = () => {
    switch (step) {
      case 'vehicle':
        return <VehicleSelectionStep onVehicleSelect={handleVehicleSelect} />;

      case 'odometer':
        return (
          <OdometerStep
            vehicleId={selectedVehicleId!}
            onComplete={handleOdometerComplete}
            onBack={() => setStep('vehicle')}
          />
        );

      case 'fuel':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold mb-2">Nível de Combustível</h3>
              <p className="text-sm text-muted-foreground">
                Indique o nível atual de combustível do veículo
              </p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Nível de Combustível</Label>
                    <div className="flex items-center space-x-2">
                      <Fuel className="w-4 h-4 text-tactical-blue" />
                      <span className="text-2xl font-bold text-foreground">{fuelLevel[0]}%</span>
                    </div>
                  </div>
                  <Slider
                    value={fuelLevel}
                    onValueChange={setFuelLevel}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Vazio</span>
                    <span>Cheio</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex space-x-2 pt-4">
              <Button variant="outline" onClick={() => setStep('odometer')} className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleFuelComplete} className="flex-1">
                Continuar
              </Button>
            </div>
          </div>
        );

      case 'checklist':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold mb-2">Checklist de Inspeção</h3>
              <p className="text-sm text-muted-foreground">
                Marque os itens conforme a inspeção. Items com * são obrigatórios.
              </p>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {checklistData.map((category, catIdx) => (
                <Card key={catIdx}>
                  <CardHeader>
                    <h4 className="font-semibold text-foreground">{category.categoryLabel}</h4>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {category.items.map((item: any, itemIdx: number) => {
                      const itemId = `${catIdx}-${itemIdx}`;
                      const hasProblem = problems.some(p => p.itemId === itemId);
                      const hasPhoto = checkItemPhotos[itemId]?.length > 0;

                      return (
                        <ChecklistItemCard
                          key={itemIdx}
                          itemId={itemId}
                          itemName={item.name}
                          required={item.required}
                          requiresPhoto={item.requiresPhoto || false}
                          allowReportProblem={item.allowReportProblem !== false}
                          checked={item.checked}
                          hasPhoto={hasPhoto}
                          hasProblem={hasProblem}
                          onCheckChange={(checked) => handleCheckItem(catIdx, itemIdx, checked)}
                          onPhotoClick={() => handleItemPhoto(catIdx, itemIdx)}
                          onReportProblem={() => handleReportProblem(catIdx, itemIdx)}
                        />
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex space-x-2 pt-4">
              <Button variant="outline" onClick={() => setStep('fuel')} className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleChecklistComplete} className="flex-1">
                Continuar
              </Button>
            </div>
          </div>
        );

      case 'issues':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold mb-2">Avarias Gerais</h3>
              <p className="text-sm text-muted-foreground">
                Relate quaisquer avarias gerais do veículo (opcional)
              </p>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Descrição de Avarias</Label>
                  <Textarea
                    placeholder="Ex: Lataria amassada na porta traseira esquerda, vidro trincado..."
                    value={generalIssues}
                    onChange={(e) => setGeneralIssues(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Fotos de Avarias (Opcional)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {generalIssuesPhotos.map((photo, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Issue ${idx + 1}`}
                          className="w-full h-24 object-cover rounded-lg border"
                        />
                      </div>
                    ))}
                    {generalIssuesPhotos.length < 5 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center hover:bg-muted/50 transition-colors"
                      >
                        <Camera className="w-6 h-6 text-muted-foreground mb-1" />
                        <span className="text-xs text-muted-foreground">Adicionar</span>
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handleAddGeneralIssuePhoto}
                    className="hidden"
                  />
                </div>

                {problems.length > 0 && (
                  <div className="space-y-2">
                    <Label>Problemas Relatados</Label>
                    <div className="space-y-2">
                      {problems.map((problem, idx) => (
                        <div key={idx} className="p-3 bg-tactical-red/10 border border-tactical-red/30 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{problem.itemName}</span>
                            <span className="text-xs text-muted-foreground">{problem.severity}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{problem.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex space-x-2 pt-4">
              <Button variant="outline" onClick={() => setStep('checklist')} className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleIssuesComplete} className="flex-1">
                Continuar para Assinatura
              </Button>
            </div>
          </div>
        );

      case 'signature':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold mb-2">Assinatura Digital</h3>
              <p className="text-sm text-muted-foreground">
                Assine para confirmar a inspeção e finalizar o processo
              </p>
            </div>

            <SignaturePad
              onSignature={handleSignatureComplete}
              onCancel={() => selectedVehicleType === 'foot' ? setStep('vehicle') : setStep('issues')}
              clientName="Inspeção Veicular"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Inspeção Veicular - Pré-Plantão</DialogTitle>
            <div className="mt-4">
              <Progress value={getStepProgress()} className="h-2" />
            </div>
          </DialogHeader>

          <div className="py-4">
            {renderStepContent()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Problem Report Dialog */}
      {currentProblemItem && (
        <ProblemReportDialog
          open={showProblemDialog}
          onClose={() => {
            setShowProblemDialog(false);
            setCurrentProblemItem(null);
          }}
          itemName={currentProblemItem.itemName}
          onSubmit={handleProblemSubmit}
        />
      )}
    </>
  );
}
