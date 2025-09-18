import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { X, Camera, Flashlight, Type, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import QrScanner from "qr-scanner";
import { useToast } from "@/hooks/use-toast";

const QRScannerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);
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
    return () => stopScanner();
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
    
    try {
      console.log("Starting camera initialization...");
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("BROWSER_NOT_SUPPORTED");
      }
      
      setHasPermission(true);
      await startScanner();
      
    } catch (error: any) {
      console.error("Camera initialization failed:", error);
      setHasPermission(false);
      
      if (error.name === 'NotAllowedError') {
        setError("Permissão de câmera necessária para leitura do QR Code. Vá em configurações do navegador para permitir o acesso.");
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

  const startScanner = async () => {
    if (!videoRef.current || !hasPermission) return;

    try {
      console.log("Starting QR Scanner...");
      
      // Let QrScanner handle the camera stream entirely
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        (result) => handleScanResult(result.data),
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment',
          maxScansPerSecond: 3,
        }
      );

      await qrScannerRef.current.start();
      
      console.log("QR Scanner started successfully");
      
      // Check for flash after a delay
      setTimeout(() => {
        if (qrScannerRef.current) {
          try {
            if (qrScannerRef.current.hasFlash()) {
              setHasFlash(true);
              console.log("Flash available");
            }
          } catch (e) {
            console.log("Flash check error:", e);
          }
        }
      }, 1000);
      
    } catch (error: any) {
      console.error("QR Scanner start error:", error);
      setError("Erro ao iniciar o scanner. Use o código manual.");
      setShowManualInput(true);
    }
  };

  const stopScanner = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
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
    if (qrScannerRef.current && hasFlash) {
      try {
        if (flashOn) {
          await qrScannerRef.current.turnFlashOff();
        } else {
          await qrScannerRef.current.turnFlashOn();
        }
        setFlashOn(!flashOn);
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
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              playsInline
              muted
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
                Posicione o QR code da {expectedCompany} dentro do quadrado
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default QRScannerPage;