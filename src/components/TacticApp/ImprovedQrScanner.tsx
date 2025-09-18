import { useState, useRef, useEffect } from "react";
import { X, Camera, Flashlight, Type, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ImprovedQrScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (qrCode: string) => void;
  expectedCompany?: string;
}

const ImprovedQrScanner = ({ open, onClose, onScan, expectedCompany = "Cliente" }: ImprovedQrScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      checkPermissionsAndStart();
    } else {
      stopCamera();
      resetState();
    }

    return () => stopCamera();
  }, [open]);

  const resetState = () => {
    setError("");
    setIsLoading(false);
    setHasPermission(null);
    setShowManualInput(false);
    setManualCode("");
    setFlashOn(false);
    setHasFlash(false);
  };

  const checkPermissionsAndStart = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("BROWSER_NOT_SUPPORTED");
      }

      console.log("Starting camera...");
      await startCamera();
      
    } catch (error: any) {
      console.error("Permission check failed:", error);
      setHasPermission(false);
      
      if (error.name === 'NotAllowedError' || error.message === 'PERMISSION_DENIED') {
        setError("Permissão de câmera necessária para leitura do QR Code. Clique em 'Permitir' quando solicitado.");
      } else if (error.name === 'NotFoundError') {
        setError("Nenhuma câmera encontrada no dispositivo.");
      } else if (error.name === 'NotReadableError') {
        setError("Câmera está sendo usada por outro aplicativo. Feche outros apps e tente novamente.");
      } else if (error.message === 'BROWSER_NOT_SUPPORTED') {
        setError("Navegador não suporta acesso à câmera. Use o código manual.");
      } else {
        setError("Erro ao acessar câmera. Tente novamente ou use o código manual.");
      }
      
      setShowManualInput(true);
    } finally {
      setIsLoading(false);
    }
  };

  const startCamera = async () => {
    if (!videoRef.current) return;

    try {
      console.log("Starting camera...");
      
      const configs = [
        { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        { facingMode: "environment" },
        { video: true }
      ];

      let stream: MediaStream | null = null;
      
      for (let attempt = 0; attempt < configs.length; attempt++) {
        try {          
          stream = await navigator.mediaDevices.getUserMedia({
            video: configs[attempt]
          });
          
          break; // Success, exit the retry loop
          
        } catch (attemptError) {          
          if (attempt === configs.length - 1) {
            throw attemptError; // Last attempt failed
          }
          
          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!stream) {
        throw new Error("Failed to get camera stream");
      }

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        await new Promise((resolve, reject) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              if (videoRef.current) {
                videoRef.current.play()
                  .then(resolve)
                  .catch(reject);
              }
            };
            videoRef.current.onerror = reject;
          }
        });
      }
      
      console.log("Camera started successfully");
      setHasPermission(true);
      setError("");

      // Check for flash capability
      setTimeout(() => {
        if (stream) {
          const track = stream.getVideoTracks()[0];
          try {
            const capabilities = track.getCapabilities() as any;
            if (capabilities?.torch) {
              setHasFlash(true);
            }
          } catch (e) {
            // Flash not available
          }
        }
      }, 1000);
      
    } catch (error: any) {
      console.error("Camera start error:", error);
      
      let errorMessage = "Erro ao iniciar a câmera. Use o código manual.";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Permissão de câmera negada.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "Câmera não encontrada.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Câmera em uso por outro aplicativo.";
      }
      
      setError(errorMessage);
      setShowManualInput(true);
      throw error;
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setFlashOn(false);
  };

  const handleScanResult = (data: string) => {
    console.log("QR Code scanned:", data);
    
    // Validate QR code format
    if (!validateQrCode(data)) {
      toast({
        title: "QR Code Inválido",
        description: "Formato de QR code não reconhecido",
        variant: "destructive",
      });
      return;
    }

    onScan(data);
    onClose();
  };

  const validateQrCode = (qrData: string): boolean => {
    try {
      // Try to parse as JSON (structured QR code)
      const parsed = JSON.parse(qrData);
      if (parsed.type === 'checkpoint' && parsed.manualCode) {
        // Valid QR format
        return true;
      }
      // If it's a checkpoint QR but from different company, still valid but warn
      if (parsed.type === 'checkpoint') {
        return true;
      }
    } catch (e) {
      // Not JSON, check manual codes
    }
    
    // Check if it's a 9-digit number (manual codes)
    const isNineDigitCode = /^\d{9}$/.test(qrData);
    
    return isNineDigitCode;
  };

  const toggleFlash = async () => {
    if (streamRef.current && hasFlash) {
      const track = streamRef.current.getVideoTracks()[0];
      try {
        const capabilities = track.getCapabilities() as any;
        if (capabilities?.torch) {
          await track.applyConstraints({
            advanced: [{ torch: !flashOn } as any]
          });
          setFlashOn(!flashOn);
        }
      } catch (err) {
        console.error("Error toggling flash:", err);
      }
    }
  };

  const handleManualInput = () => {
    if (!manualCode.trim()) {
      toast({
        title: "Código necessário",
        description: "Digite o código QR manualmente",
        variant: "destructive",
      });
      return;
    }

    // Validate manual code (should be 9 digits)
    if (!/^\d{9}$/.test(manualCode)) {
      toast({
        title: "Código inválido",
        description: "O código deve conter exatamente 9 dígitos",
        variant: "destructive",
      });
      return;
    }

    // Always accept 9-digit codes for manual input
    onScan(manualCode);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle>Escanear QR Code - {expectedCompany}</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="relative">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
              <p className="text-sm text-muted-foreground mb-2">Verificando permissões da câmera...</p>
              <p className="text-xs text-muted-foreground">Clique em "Permitir" quando solicitado</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <Camera className="w-16 h-16 text-destructive mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <div className="space-y-2">
                <Button onClick={() => checkPermissionsAndStart()} variant="outline" className="w-full">
                  Tentar novamente
                </Button>
                <Button onClick={() => setShowManualInput(true)} variant="outline" className="w-full">
                  Inserir código manualmente
                </Button>
              </div>
            </div>
          ) : showManualInput ? (
            <div className="p-6 space-y-4">
              <div>
                <Label htmlFor="manual-code">Código Manual (9 dígitos)</Label>
                <Input
                  id="manual-code"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="Digite o código de 9 dígitos"
                  maxLength={9}
                />
              </div>

              <div className="flex space-x-2">
                <Button onClick={() => setShowManualInput(false)} variant="outline" className="flex-1">
                  Voltar ao Scanner
                </Button>
                <Button onClick={handleManualInput} className="flex-1 bg-tactical-green hover:bg-tactical-green/90">
                  Confirmar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-80 object-cover bg-black rounded-lg"
                autoPlay
                playsInline
                muted
                style={{ 
                  transform: 'scaleX(-1)', // Mirror the video for better UX
                  backgroundColor: '#000'
                }}
              />
              
              {/* QR Scanner Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="w-48 h-48 border-2 border-white/50 rounded-lg"></div>
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-tactical-green"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-tactical-green"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-tactical-green"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-tactical-green"></div>
                </div>
              </div>
            </>
          )}
        </div>

        {!showManualInput && (
          <div className="p-4 space-y-2">
            <div className="flex space-x-2">
              {hasFlash && (
                <Button
                  onClick={toggleFlash}
                  variant="outline"
                  className="flex-1"
                >
                  <Flashlight className={`w-4 h-4 mr-2 ${flashOn ? 'text-yellow-500' : ''}`} />
                  {flashOn ? 'Desligar Flash' : 'Ligar Flash'}
                </Button>
              )}
              
              <Button
                onClick={() => setShowManualInput(true)}
                variant="outline"
                className="flex-1"
              >
                <Type className="w-4 h-4 mr-2" />
                Inserir manualmente
              </Button>
            </div>
            
            <p className="text-xs text-center text-muted-foreground">
              Posicione o QR code da {expectedCompany} dentro do quadrado para escanear manualmente ou use o botão Manual
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImprovedQrScanner;