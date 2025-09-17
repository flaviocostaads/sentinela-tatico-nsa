import { useState, useRef, useEffect } from "react";
import { X, Camera, Flashlight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface QrScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (qrCode: string) => void;
}

const QrScanner = ({ open, onClose, onScan }: QrScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [open]);

  const startCamera = async () => {
    try {
      setError("");
      
      // Check camera availability
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Câmera não suportada neste navegador. Use o código manual.");
        return;
      }

      // Multiple attempts with different configurations
      const configs = [
        { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        { facingMode: "environment" },
        { video: true }
      ];

      for (let attempt = 0; attempt < configs.length; attempt++) {
        try {
          console.log(`Camera attempt ${attempt + 1} with config:`, configs[attempt]);
          
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: configs[attempt]
          });
          
          setStream(mediaStream);
          
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            
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
          return; // Success, exit the retry loop
          
        } catch (attemptError) {
          console.error(`Camera attempt ${attempt + 1} failed:`, attemptError);
          
          if (attempt === configs.length - 1) {
            throw attemptError; // Last attempt failed
          }
          
          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Não foi possível acessar a câmera. Verifique as permissões ou use o código manual.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setFlashlightOn(false);
  };

  const toggleFlashlight = async () => {
    if (stream) {
      const track = stream.getVideoTracks()[0];
      // Safely check for torch capability
      try {
        const capabilities = track.getCapabilities() as any;
        if (capabilities?.torch) {
          await track.applyConstraints({
            advanced: [{ torch: !flashlightOn } as any]
          });
          setFlashlightOn(!flashlightOn);
        }
      } catch (err) {
        console.error("Error toggling flashlight:", err);
      }
    }
  };

  // Simple QR detection simulation (in a real app, you'd use a QR library like qr-scanner)
  const handleManualInput = () => {
    const qrCode = prompt("Digite o código QR manualmente:");
    if (qrCode) {
      onScan(qrCode);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle>Escanear QR Code</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="relative">
          {error ? (
            <div className="p-8 text-center">
              <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={handleManualInput} variant="outline">
                Inserir código manualmente
              </Button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-64 object-cover bg-black"
                autoPlay
                playsInline
                muted
              />
              
              {/* QR Scanner Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="w-48 h-48 border-2 border-white opacity-50 rounded-lg"></div>
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-tactical-green"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-tactical-green"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-tactical-green"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-tactical-green"></div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 space-y-2">
          <div className="flex space-x-2">
            <Button
              onClick={toggleFlashlight}
              variant="outline"
              className="flex-1"
              disabled={!stream}
            >
              <Flashlight className={`w-4 h-4 mr-2 ${flashlightOn ? 'text-yellow-500' : ''}`} />
              {flashlightOn ? 'Desligar Flash' : 'Ligar Flash'}
            </Button>
            
            <Button
              onClick={handleManualInput}
              variant="outline"
              className="flex-1"
            >
              Inserir manualmente
            </Button>
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            Posicione o QR code dentro do quadrado para escanear
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QrScanner;