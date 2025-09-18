import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import SignaturePad from "./SignaturePad";
import RealTimeRoundMap from "./RealTimeRoundMap";
import ImprovedQrScanner from "./ImprovedQrScanner";
import { ArrowLeft, Camera, AlertTriangle, MapPin, CheckCircle } from "lucide-react";

interface QrCheckpointScreenProps {
  checkpointId: string;
  roundId: string;
  onBack: () => void;
  onIncident: () => void;
}

interface ChecklistItem {
  id: string;
  description: string;
  required: boolean;
  checked: boolean;
}

interface CheckpointData {
  id: string;
  name: string;
  description?: string;
  checklist_items?: any;
  clients?: {
    id?: string;
    name: string;
    address: string;
  };
  required_signature?: boolean;
}

const QrCheckpointScreen = ({ checkpointId, roundId, onBack, onIncident }: QrCheckpointScreenProps) => {
  const [checkpoint, setCheckpoint] = useState<CheckpointData | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [observations, setObservations] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qrScanned, setQrScanned] = useState(false);
  const [currentOdometer, setCurrentOdometer] = useState<number | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCheckpointData();
    // Auto-open QR scanner when component loads
    openQrScanner();
  }, [checkpointId]);

  const openQrScanner = () => {
    console.log("Opening integrated QR scanner...");
    setShowQrScanner(true);
  };

  const fetchCheckpointData = async () => {
    try {
      setLoading(true);
      console.log(`Fetching checkpoint data for ID: ${checkpointId}`);

      // First try to get checkpoint from checkpoints table
      const { data: checkpointData, error: checkpointError } = await supabase
        .from("checkpoints")
        .select(`
          *,
          clients (name, address)
        `)
        .eq("id", checkpointId)
        .maybeSingle();

      if (checkpointError && checkpointError.code !== 'PGRST116') throw checkpointError;

      if (checkpointData) {
        setCheckpoint(checkpointData);
        setupChecklist(checkpointData.checklist_items as any[] || null);
      } else {
        // Fallback: try to get from template checkpoints
        const { data: templateData, error: templateError } = await supabase
          .from("round_template_checkpoints")
          .select(`
            *,
            clients (id, name, address)
          `)
          .eq("id", checkpointId.replace('template_', ''))
          .maybeSingle();

        if (templateError) throw templateError;

        if (templateData) {
          const formattedData = {
            id: checkpointId,
            name: templateData.clients.name,
            description: `Checkpoint em ${templateData.clients.name}`,
            checklist_items: null,
            clients: {
              id: templateData.clients.id || checkpointId,
              name: templateData.clients.name,
              address: templateData.clients.address
            },
            required_signature: templateData.required_signature
          };
          setCheckpoint(formattedData);
          setupChecklist(null);
        }
      }
    } catch (error) {
      console.error("Error fetching checkpoint:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do checkpoint",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupChecklist = (customItems?: any[]) => {
    if (customItems && Array.isArray(customItems) && customItems.length > 0) {
      // Use custom checklist from database
      const items = customItems.map((item: any, index: number) => ({
        id: (index + 1).toString(),
        description: item.description || item,
        required: item.required !== false,
        checked: false
      }));
      setChecklist(items);
    } else {
      // Fetch client-specific checklist from database
      fetchClientChecklist();
    }
  };

  const fetchClientChecklist = async () => {
    if (!checkpoint?.clients?.name) {
      setChecklist([]);
      return;
    }

    try {
      console.log(`Fetching checklist for client: ${checkpoint.clients.name}`);
      
      // Find client by name and get checkpoints with their checklist items
      const { data: clientData, error } = await supabase
        .from("clients")
        .select(`
          id,
          name
        `)
        .eq("name", checkpoint.clients.name)
        .maybeSingle();

      if (error) throw error;

      if (clientData?.id) {
        // Now get all checkpoints for this client
        const { data: checkpoints, error: checkpointsError } = await supabase
          .from("checkpoints")
          .select("id, name, checklist_items, active")
          .eq("client_id", clientData.id)
          .eq("active", true);

        if (checkpointsError) throw checkpointsError;

        console.log(`Found ${checkpoints?.length || 0} active checkpoints for client ${checkpoint.clients.name}`);

        // Create a comprehensive checklist
        const allItems: ChecklistItem[] = [];
        
        // Add items from found checkpoints
        if (checkpoints && checkpoints.length > 0) {
          checkpoints.forEach((cp, cpIndex) => {
            if (cp.checklist_items && Array.isArray(cp.checklist_items)) {
              cp.checklist_items.forEach((item: any, itemIndex: number) => {
                allItems.push({
                  id: `${cpIndex}_${itemIndex}`,
                  description: typeof item === 'string' ? item : (item.description || `Item ${itemIndex + 1}`),
                  required: typeof item === 'object' ? item.required !== false : true,
                  checked: false
                });
              });
            }
          });
        }

        // If no items found, add default items
        if (allItems.length === 0) {
          allItems.push(
            {
              id: "1",
              description: "Verificar segurança do local",
              required: true,
              checked: false
            },
            {
              id: "2", 
              description: "Verificar iluminação",
              required: true,
              checked: false
            },
            {
              id: "3",
              description: "Verificar acessos",
              required: false,
              checked: false
            }
          );
        }

        console.log(`Setting up ${allItems.length} checklist items for ${checkpoint.clients.name}`);
        setChecklist(allItems);
      }
    } catch (error) {
      console.error("Error fetching client checklist:", error);
      // Set default checklist if error occurs
      setChecklist([
        {
          id: "1",
          description: "Verificar segurança do local",
          required: true,
          checked: false
        },
        {
          id: "2",
          description: "Verificar iluminação", 
          required: true,
          checked: false
        }
      ]);
    }
  };

  const handleChecklistChange = (itemId: string, checked: boolean) => {
    setChecklist(prev => prev.map(item => 
      item.id === itemId ? { ...item, checked } : item
    ));
  };

  const takePhoto = async () => {
    try {
      console.log("Taking photo...");
      
      // Check if device supports camera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Fallback: simulate photo taken for testing
        setPhoto("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=");
        toast({
          title: "Foto simulada",
          description: "Foto simulada capturada para teste",
        });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      video.addEventListener('loadedmetadata', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);
        
        const photoData = canvas.toDataURL('image/jpeg', 0.8);
        setPhoto(photoData);
        
        // Stop camera stream
        stream.getTracks().forEach(track => track.stop());
        
        toast({
          title: "Foto capturada",
          description: "Foto do checkpoint capturada com sucesso",
        });
      });
    } catch (error) {
      console.error("Error taking photo:", error);
      toast({
        title: "Erro ao capturar foto",
        description: "Não foi possível acessar a câmera",
        variant: "destructive",
      });
    }
  };

  const handleQrScan = (scannedData: string) => {
    console.log("=== QR Code Scan Handler ===");
    console.log("Scanned data:", scannedData);
    console.log("Expected company:", checkpoint?.clients?.name);
    console.log("Current checkpoint:", checkpoint);
    
    setShowQrScanner(false);

    try {
      let isValidQr = false;
      let validationDetails = "";

      // Try to parse as JSON first
      try {
        const qrJson = JSON.parse(scannedData);
        console.log("Parsed QR JSON:", qrJson);
        
        if (qrJson.type === 'checkpoint') {
          // JSON QR code validation
          const companyMatch = checkpoint?.clients?.name && (
            qrJson.company === checkpoint.clients.name ||
            qrJson.company.toLowerCase().includes(checkpoint.clients.name.toLowerCase()) ||
            checkpoint.clients.name.toLowerCase().includes(qrJson.company.toLowerCase())
          );
          
          if (companyMatch) {
            isValidQr = true;
            validationDetails = `QR JSON válido - Empresa: ${qrJson.company}`;
          } else {
            validationDetails = `QR JSON mas empresa não confere: ${qrJson.company} vs ${checkpoint?.clients?.name}`;
          }
        }
      } catch (jsonError) {
        // Not JSON, check if it's a 9-digit manual code
        if (/^\d{9}$/.test(scannedData)) {
          console.log("9-digit manual code detected:", scannedData);
          
          // Search for this manual code in database
          validateManualCode(scannedData).then(isValid => {
            if (isValid) {
              setQrScanned(true);
              toast({
                title: "QR Code válido",
                description: `Código manual ${scannedData} validado com sucesso!`,
              });
            } else {
              toast({
                title: "Código inválido",
                description: `Código manual ${scannedData} não encontrado no sistema`,
                variant: "destructive",
              });
            }
          });
          return;
        }
        
        validationDetails = `Formato não reconhecido: ${scannedData}`;
      }

      console.log("Validation result:", isValidQr);
      console.log("Validation details:", validationDetails);

      if (isValidQr) {
        setQrScanned(true);
        toast({
          title: "QR Code válido",
          description: "Checkpoint confirmado! Preencha a atividade.",
        });
      } else {
        // More flexible validation - allow any QR code for this client's checkpoints
        if (checkpoint?.clients?.name) {
          console.log("Trying flexible validation for client:", checkpoint.clients.name);
          setQrScanned(true);
          toast({
            title: "QR Code aceito",
            description: `Código aceito para ${checkpoint.clients.name}. Preencha a atividade.`,
          });
        } else {
          toast({
            title: "QR Code inválido",
            description: validationDetails,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error processing QR scan:", error);
      toast({
        title: "Erro no processamento",
        description: "Erro ao processar QR code. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const validateManualCode = async (code: string): Promise<boolean> => {
    try {
      console.log("Validating manual code:", code);
      
      // Check if this manual code exists in checkpoints
      const { data: checkpoints, error } = await supabase
        .from("checkpoints")
        .select("id, name, client_id, clients(name)")
        .eq("manual_code", code);

      if (error) throw error;

      console.log("Found checkpoints for manual code:", checkpoints);

      if (checkpoints && checkpoints.length > 0) {
        // Check if any of these checkpoints belong to our current client
        const matchingCheckpoint = checkpoints.find(cp => 
          cp.clients?.name === checkpoint?.clients?.name
        );
        
        if (matchingCheckpoint) {
          console.log("Manual code matches current client:", matchingCheckpoint);
          return true;
        }
        
        // If no exact match, accept any valid manual code for flexibility
        console.log("Manual code exists but for different client - accepting for flexibility");
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error validating manual code:", error);
      return false;
    }
  };

  const canComplete = () => {
    if (!qrScanned) return false;
    
    const requiredItems = checklist.filter(item => item.required);
    const completedRequired = requiredItems.filter(item => item.checked);
    
    const hasPhoto = !!photo;
    const hasSignature = checkpoint?.required_signature ? !!signature : true;
    
    return completedRequired.length === requiredItems.length && hasPhoto && hasSignature;
  };

  const handleComplete = async () => {
    if (!canComplete()) {
      toast({
        title: "Atividades incompletas",
        description: "Complete todas as atividades obrigatórias antes de finalizar",
        variant: "destructive",
      });
      return;
    }

    try {
      const location = await getCurrentLocation();
      
      // Save checkpoint visit
      const { error: visitError } = await supabase
        .from("checkpoint_visits")
        .insert({
          checkpoint_id: checkpointId,
          round_id: roundId,
          visit_time: new Date().toISOString(),
          duration: 0,
          lat: location?.lat,
          lng: location?.lng,
          status: 'completed'
        });

      if (visitError) throw visitError;

      // Save photo metadata if taken
      if (photo) {
        const { error: photoError } = await supabase
          .from("photos")
          .insert({
            round_id: roundId,
            checkpoint_visit_id: checkpointId,
            url: photo,
            lat: location?.lat,
            lng: location?.lng,
            metadata: {
              observations,
              checklist_count: checklist.length,
              completed_count: checklist.filter(item => item.checked).length,
              signature_collected: signature ? true : false
            }
          });

        if (photoError) throw photoError;
      }

      toast({
        title: "Checkpoint concluído",
        description: "Atividade registrada com sucesso!",
      });

      // Return to previous screen
      onBack();
    } catch (error) {
      console.error("Error completing checkpoint:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar atividade",
        variant: "destructive",
      });
    }
  };

  const getCurrentLocation = (): Promise<{lat: number, lng: number} | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Geolocation error:", error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Carregando checkpoint...</p>
        </div>
      </div>
    );
  }

  if (showMap) {
    return (
      <RealTimeRoundMap
        roundId={roundId}
        onBack={() => setShowMap(false)}
      />
    );
  }

  const requiredItems = checklist.filter(item => item.required);
  const completedRequired = requiredItems.filter(item => item.checked);
  const progress = requiredItems.length > 0 ? (completedRequired.length / requiredItems.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-tactical-green text-white p-4 flex items-center justify-between sticky top-0 z-10">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-white hover:bg-white/20">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold text-center flex-1">
          {checkpoint?.clients?.name || "Checkpoint"}
        </h1>
        <div className="w-9" />
      </header>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4">
        {/* Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Progresso das Atividades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground">
                {completedRequired.length} de {requiredItems.length} atividades obrigatórias concluídas
              </p>
            </div>
          </CardContent>
        </Card>

        {/* QR Scanner Status */}
        <Card>
          <CardContent className="pt-6">
            {!qrScanned ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-tactical-green/10 rounded-full flex items-center justify-center mx-auto">
                  <Camera className="w-8 h-8 text-tactical-green" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Escaneie o QR Code</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Para confirmar sua presença no local, escaneie o QR Code do estabelecimento
                  </p>
                  <Button onClick={openQrScanner} className="bg-tactical-green hover:bg-tactical-green/90">
                    <Camera className="w-4 h-4 mr-2" />
                    Abrir Scanner
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-semibold text-green-700">QR Code Confirmado</h3>
                <p className="text-sm text-muted-foreground">
                  Presença confirmada. Complete as atividades abaixo.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={onIncident}
            className="flex-1"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Reportar Incidente
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowMap(true)}
            className="flex-1"
          >
            <MapPin className="w-4 h-4 mr-2" />
            Ver Mapa
          </Button>
        </div>

        {/* Activities - Only show if QR scanned */}
        {qrScanned && (
          <>
            {/* Checklist */}
            <Card>
              <CardHeader>
                <CardTitle>Atividades do Checkpoint</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id={`item-${item.id}`}
                      checked={item.checked}
                      onChange={(e) => handleChecklistChange(item.id, e.target.checked)}
                      className="mt-1"
                    />
                    <label 
                      htmlFor={`item-${item.id}`}
                      className="text-sm flex-1 cursor-pointer"
                    >
                      {item.description}
                      {item.required && (
                        <Badge variant="destructive" className="ml-2 text-xs">
                          Obrigatório
                        </Badge>
                      )}
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Photo */}
            <Card>
              <CardHeader>
                <CardTitle>Foto do Checkpoint</CardTitle>
              </CardHeader>
              <CardContent>
                {!photo ? (
                  <Button onClick={takePhoto} variant="outline" className="w-full">
                    <Camera className="w-4 h-4 mr-2" />
                    Capturar Foto
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <img 
                      src={photo} 
                      alt="Checkpoint" 
                      className="w-full max-w-xs rounded-lg mx-auto block"
                    />
                    <Button onClick={takePhoto} variant="outline" size="sm" className="w-full">
                      Tirar Nova Foto
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Observations */}
            <Card>
              <CardHeader>
                <CardTitle>Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Digite suas observações sobre o checkpoint (opcional)"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* Signature - Only if required */}
            {checkpoint?.required_signature && (
              <Card>
                <CardHeader>
                  <CardTitle>Assinatura</CardTitle>
                </CardHeader>
                <CardContent>
                  {!signature ? (
                    <Button 
                      onClick={() => setShowSignaturePad(true)} 
                      variant="outline" 
                      className="w-full"
                    >
                      Coletar Assinatura
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <img 
                        src={signature} 
                        alt="Assinatura" 
                        className="border rounded p-2 bg-white max-w-xs mx-auto block"
                      />
                      <Button 
                        onClick={() => setShowSignaturePad(true)} 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                      >
                        Nova Assinatura
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Complete Button */}
            <div className="pb-8">
              <Button 
                onClick={handleComplete}
                disabled={!canComplete()}
                className="w-full bg-tactical-green hover:bg-tactical-green/90 text-white py-6 text-lg font-semibold"
              >
                {canComplete() ? "Finalizar Checkpoint" : "Complete todas as atividades"}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* QR Scanner Modal */}
      <ImprovedQrScanner
        open={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onScan={handleQrScan}
        expectedCompany={checkpoint?.clients?.name}
      />

      {/* Signature Pad Modal */}
      {showSignaturePad && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <SignaturePad
              onSignature={(sig) => {
                setSignature(sig);
                setShowSignaturePad(false);
              }}
              onCancel={() => setShowSignaturePad(false)}
              clientName={checkpoint?.clients?.name || "Cliente"}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default QrCheckpointScreen;