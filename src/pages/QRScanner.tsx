import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { X, Camera, Flashlight, Type, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const QRScannerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  const expectedCompany = searchParams.get("company") || "Cliente";
  const returnPath = searchParams.get("return");

  useEffect(() => {
    checkPermissionsAndStart();
    return () => stopCamera();
  }, []);

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
    resetState();
    
    try {
      console.log("Starting camera initialization...");
      
      // Check if MediaDevices API is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("BROWSER_NOT_SUPPORTED");
      }
      
      console.log("Starting camera...");
      await startCamera();
      
    } catch (error: any) {
      console.error("Camera initialization failed:", error);
      setHasPermission(false);
      
      let errorMessage = "Erro ao acessar câmera. Tente novamente ou use o código manual.";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Permissão de câmera necessária para leitura do QR Code. Vá em configurações do navegador para permitir o acesso.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "Nenhuma câmera encontrada no dispositivo.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Câmera está sendo usada por outro aplicativo. Feche outros apps e tente novamente.";
      } else if (error.message === 'BROWSER_NOT_SUPPORTED') {
        errorMessage = "Navegador não suporta acesso à câmera. Use o código manual.";
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "Configuração de câmera não suportada. Use o código manual.";
      }
      
      setError(errorMessage);
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
          console.log(`Camera attempt ${attempt + 1} with config:`, configs[attempt]);
          
          stream = await navigator.mediaDevices.getUserMedia({
            video: configs[attempt]
          });
          
          break; // Success, exit the retry loop
          
        } catch (attemptError) {
          console.error(`Camera attempt ${attempt + 1} failed:`, attemptError);
          
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
        
        // Wait for video to be ready
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
              console.log("Flash available");
            } else {
              console.log("Flash not available");
            }
          } catch (e) {
            console.log("Flash check error:", e);
          }
        }
      }, 1000);
      
    } catch (error: any) {
      console.error("Camera start error:", error);
      let errorMessage = "Erro ao iniciar a câmera. Use o código manual.";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Permissão de câmera negada. Permita o acesso à câmera e tente novamente.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "Câmera não encontrada. Use o código manual.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Câmera em uso por outro aplicativo. Feche outros apps e tente novamente.";
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
    
    if (!validateQrCode(data)) {
      toast({
        title: "QR Code Inválido",
        description: "Formato de QR code não reconhecido",
        variant: "destructive",
      });
      return;
    }

    // Store the result in sessionStorage and navigate back
    sessionStorage.setItem('qrScanResult', data);
    
    if (returnPath) {
      navigate(returnPath);
    } else {
      navigate(-1);
    }
  };

  const validateQrCode = (qrData: string): boolean => {
    try {
      const parsed = JSON.parse(qrData);
      if (parsed.type === 'checkpoint' && parsed.manualCode) {
        return true;
      }
      if (parsed.type === 'checkpoint') {
        return true;
      }
    } catch (e) {
      // Not JSON, check manual codes
    }
    
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

    if (!/^\d{9}$/.test(manualCode)) {
      toast({
        title: "Código inválido",
        description: "O código deve conter exatamente 9 dígitos",
        variant: "destructive",
      });
      return;
    }

    // Store the result in sessionStorage and navigate back
    sessionStorage.setItem('qrScanResult', manualCode);
    
    if (returnPath) {
      navigate(returnPath);
    } else {
      navigate(-1);
    }
  };

  const handleBack = () => {
    if (returnPath) {
      navigate(returnPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-tactical-green text-white p-4 flex items-center justify-between relative z-10">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleBack}
          className="text-white hover:bg-white/20"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">Scanner QR - {expectedCompany}</h1>
        <div className="w-9" /> {/* Spacer for centering */}
      </div>

      {/* Main Content */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center bg-black text-white">
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-tactical-green mx-auto mb-4 animate-spin" />
              <p className="text-sm mb-2">Verificando permissões da câmera...</p>
              <p className="text-xs opacity-70">Clique em "Permitir" quando solicitado</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center bg-black text-white p-6">
            <div className="text-center">
              <Camera className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <p className="text-sm mb-6">{error}</p>
              <div className="space-y-3">
                <Button 
                  onClick={() => checkPermissionsAndStart()} 
                  variant="outline" 
                  className="w-full bg-white text-black"
                >
                  Tentar novamente
                </Button>
                <Button 
                  onClick={() => setShowManualInput(true)} 
                  variant="outline" 
                  className="w-full bg-tactical-green text-white border-tactical-green"
                >
                  Inserir código manualmente
                </Button>
              </div>
            </div>
          </div>
        ) : showManualInput ? (
          <div className="flex-1 bg-black text-white p-6 flex items-center justify-center">
            <div className="w-full max-w-sm space-y-6">
              <div>
                <Label htmlFor="manual-code" className="text-white">Código Manual (9 dígitos)</Label>
                <Input
                  id="manual-code"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="Digite o código de 9 dígitos"
                  maxLength={9}
                  className="mt-2 bg-white text-black"
                />
              </div>
              
              <div className="flex space-x-3">
                <Button 
                  onClick={() => setShowManualInput(false)} 
                  variant="outline" 
                  className="flex-1 bg-white text-black"
                >
                  Voltar Scanner
                </Button>
                <Button 
                  onClick={handleManualInput} 
                  className="flex-1 bg-tactical-green hover:bg-tactical-green/90"
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Camera View */}
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover bg-black"
              autoPlay
              playsInline
              muted
              webkit-playsinline="true"
              style={{
                transform: 'scaleX(-1)', // Mirror effect for better UX
              }}
            />
            
            {/* QR Scanner Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="w-64 h-64 border-2 border-white/50 rounded-lg"></div>
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-tactical-green"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-tactical-green"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-tactical-green"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-tactical-green"></div>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-4 space-y-4">
              <div className="flex space-x-3">
                {hasFlash && (
                  <Button
                    onClick={toggleFlash}
                    variant="outline"
                    className="flex-1 bg-white/10 text-white border-white/30"
                  >
                    <Flashlight className={`w-4 h-4 mr-2 ${flashOn ? 'text-yellow-400' : ''}`} />
                    {flashOn ? 'Desligar Flash' : 'Ligar Flash'}
                  </Button>
                )}
                
                <Button
                  onClick={() => setShowManualInput(true)}
                  variant="outline"
                  className="flex-1 bg-white/10 text-white border-white/30"
                >
                  <Type className="w-4 h-4 mr-2" />
                  Manual
                </Button>
              </div>
              
              <p className="text-xs text-center text-white/70">
                Posicione o QR code da {expectedCompany} dentro do quadrado para escanear manualmente ou use o botão Manual
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default QRScannerPage;