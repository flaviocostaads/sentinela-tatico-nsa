import React, { useRef, useEffect, useState } from "react";
import { Printer, Download, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import QRCode from 'qrcode';

interface QrPrintModelProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  pointName: string;
  qrCode: string;
}

const QrPrintModel: React.FC<QrPrintModelProps> = ({ 
  isOpen, 
  onClose, 
  companyName, 
  pointName, 
  qrCode 
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('');
  const [companyLogo, setCompanyLogo] = useState<string>('');
  const { toast } = useToast();

  // Save manual code to database for validation
  const saveManualCodeToDatabase = async (manualCode: string, qrData: string) => {
    try {
      console.log("Saving manual code for checkpoint:", { companyName, pointName, manualCode });
      
      // The pointName is actually the checkpoint name, and companyName is the client name
      // Find the client first by company name
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, name")
        .ilike("name", `%${companyName.replace(/[%_]/g, '\\$&')}%`)
        .single();

      if (clientError) {
        console.error("Error finding client:", clientError);
        return;
      }

      if (client) {
        // Find the specific checkpoint by client_id and checkpoint name (pointName)
        const { data: checkpoints, error } = await supabase
          .from("checkpoints")
          .select("*")
          .eq("client_id", client.id)
          .ilike("name", `%${pointName.replace(/[%_]/g, '\\$&')}%`);

        if (error) {
          console.error("Error finding checkpoint:", error);
          return;
        }

        if (checkpoints && checkpoints.length > 0) {
          // Update the specific checkpoint with the manual code
          const { error: updateError } = await supabase
            .from("checkpoints")
            .update({ 
              manual_code: manualCode,
              qr_code: qrData
            })
            .eq("id", checkpoints[0].id);

          if (updateError) {
            console.error("Error updating checkpoint:", updateError);
          } else {
            console.log("Manual code saved to checkpoint:", manualCode, "for checkpoint:", pointName, "in client:", client.name);
          }
        } else {
          console.log("No checkpoint found with name:", pointName, "for client:", client.name);
        }
      }
    } catch (error) {
      console.error("Error saving manual code:", error);
    }
  };

  // Load company logo
  useEffect(() => {
    loadCompanyLogo();
  }, []);

  // Load existing or generate new QR Code and manual code
  useEffect(() => {
    if (isOpen) {
      loadExistingOrGenerateQRCode();
    }
  }, [isOpen, companyName, pointName]);

  const loadCompanyLogo = async () => {
    try {
      const { data: companySettings, error } = await supabase
        .from("company_settings")
        .select("logo_url")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && companySettings?.logo_url) {
        setCompanyLogo(companySettings.logo_url);
      }
    } catch (error) {
      console.error("Error loading company logo:", error);
    }
  };

  const loadExistingOrGenerateQRCode = async () => {
    try {
      console.log("Loading QR code for checkpoint:", pointName, "in company:", companyName);
      
      // Find the client by company name
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, name")
        .ilike("name", `%${companyName.replace(/[%_]/g, '\\$&')}%`)
        .single();

      if (clientError) {
        console.error("Error finding client:", clientError);
        generateNewQRCode();
        return;
      }

      if (client) {
        // Find the specific checkpoint by client_id and checkpoint name
        const { data: checkpoints } = await supabase
          .from("checkpoints")
          .select("*")
          .eq("client_id", client.id)
          .ilike("name", `%${pointName.replace(/[%_]/g, '\\$&')}%`);

        if (checkpoints && checkpoints.length > 0 && checkpoints[0].manual_code && checkpoints[0].qr_code) {
          // Use existing QR code and manual code
          console.log("Found existing checkpoint with codes:", checkpoints[0].manual_code);
          setManualCode(checkpoints[0].manual_code);
          const existingQrData = checkpoints[0].qr_code;
          
          // Generate QR image from existing data
          QRCode.toDataURL(existingQrData, {
            width: 320,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          })
          .then(url => {
            setQrCodeDataUrl(url);
          })
          .catch(err => {
            console.error('Error generating QR code from existing data:', err);
            generateNewQRCode();
          });
        } else {
          // Generate new QR code
          console.log("No existing QR code found for checkpoint:", pointName, "generating new one");
          generateNewQRCode();
        }
      } else {
        generateNewQRCode();
      }
    } catch (error) {
      console.error("Error loading existing QR code:", error);
      generateNewQRCode();
    }
  };

  const generateNewQRCode = () => {
    const generatedManualCode = Math.floor(100000000 + Math.random() * 900000000).toString();
    setManualCode(generatedManualCode);
    
    // Create QR data with company info and manual code
    const qrData = JSON.stringify({
      company: companyName || "NSA SECURITY",
      checkpoint: pointName,
      manualCode: generatedManualCode,
      type: "checkpoint"
    });

    // Generate QR Code
    QRCode.toDataURL(qrData, {
      width: 320,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })
    .then(url => {
      setQrCodeDataUrl(url);
      
      // Save manual code to checkpoint
      saveManualCodeToDatabase(generatedManualCode, qrData);
    })
    .catch(err => {
      console.error('Error generating QR code:', err);
    });
  };

  const handlePrint = () => {
    if (printRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>QR Code - ${pointName}</title>
              <style>
                @page { size: A4; margin: 0; }
                body { 
                  margin: 0; 
                  padding: 20px;
                  font-family: Arial, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                 }
                 .qr-container {
                   border: 3px solid #1f2937;
                   border-radius: 16px;
                   padding: 40px;
                   text-align: center;
                   background: white;
                   box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                   max-width: 500px;
                 }
                  .company-logo {
                    width: 240px;
                    height: 80px;
                    margin: 0 auto 20px;
                    object-fit: contain;
                  }
                 .company-name {
                  font-size: 28px;
                  font-weight: bold;
                  color: #1f2937;
                  margin-bottom: 16px;
                  letter-spacing: 1px;
                }
                .point-name {
                  font-size: 24px;
                  color: #4b5563;
                  margin-bottom: 32px;
                  font-weight: 600;
                }
                 .qr-code {
                   width: 320px;
                   height: 320px;
                   margin: 0 auto 32px;
                   border: 2px solid #e5e7eb;
                   border-radius: 8px;
                   display: flex;
                   align-items: center;
                   justify-content: center;
                   background: #f9fafb;
                 }
                 .qr-code img {
                   width: 288px;
                   height: 288px;
                   object-fit: contain;
                 }
                 .manual-code-section {
                   border-top: 2px solid #e5e7eb;
                   padding-top: 24px;
                   margin-top: 24px;
                 }
                 .manual-code-label {
                   font-size: 18px;
                   font-weight: 600;
                   color: #374151;
                   margin-bottom: 8px;
                 }
                 .manual-code-value {
                   font-size: 30px;
                   font-weight: bold;
                   color: #1f2937;
                   letter-spacing: 2px;
                   margin-bottom: 8px;
                 }
                 .manual-code-info {
                   font-size: 14px;
                   color: #6b7280;
                 }
              </style>
            </head>
            <body>
              <div class="qr-container">
                ${companyLogo ? `<img src="${companyLogo}" alt="Logo" class="company-logo" />` : ''}
                <div class="company-name">${companyName || "NSA SECURITY"}</div>
                <div class="point-name">${pointName}</div>
                <div class="qr-code">
                  ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" alt="QR Code" />` : '<div>Gerando QR Code...</div>'}
                </div>
                <div class="manual-code-section">
                  <div class="manual-code-label">Código Manual</div>
                  <div class="manual-code-value">${manualCode}</div>
                  <div class="manual-code-info">Use este código em caso de falha na leitura do QR</div>
                </div>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
        printWindow.close();
      }
    }
  };

  const downloadQR = async () => {
    if (!qrCodeDataUrl || !manualCode) {
      toast({
        title: "Erro",
        description: "QR Code não está pronto ainda",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create a canvas to generate the complete PNG with all elements
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas dimensions
      canvas.width = 600;
      canvas.height = 800;

      // Fill background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add border
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 6;
      ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

      // Add company name
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(companyName || "NSA SECURITY", canvas.width / 2, 100);

      // Add point name
      ctx.font = '28px Arial';
      ctx.fillStyle = '#4b5563';
      ctx.fillText(pointName, canvas.width / 2, 150);

      // Add QR code image
      const qrImage = new Image();
      qrImage.onload = () => {
        // Draw QR code
        ctx.drawImage(qrImage, 150, 180, 300, 300);

        // Add manual code section
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(80, 520);
        ctx.lineTo(520, 520);
        ctx.stroke();

        ctx.fillStyle = '#374151';
        ctx.font = 'bold 24px Arial';
        ctx.fillText("Código Manual", canvas.width / 2, 560);

        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 36px Arial';
        ctx.fillText(manualCode, canvas.width / 2, 610);

        ctx.fillStyle = '#6b7280';
        ctx.font = '18px Arial';
        ctx.fillText("Use este código em caso de falha na leitura do QR", canvas.width / 2, 650);

        // Download the canvas as PNG
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `QR-${pointName}-${manualCode}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            toast({
              title: "Sucesso",
              description: "PNG gerado e baixado com sucesso!",
            });
          }
        }, 'image/png');
      };
      qrImage.src = qrCodeDataUrl;
    } catch (error) {
      console.error('Error generating PNG:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar PNG",
        variant: "destructive",
      });
    }
  };

  // Remove this line as we no longer need it
  // const displayQrCode = qrCode || Math.floor(100000000 + Math.random() * 900000000).toString();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Modelo de Impressão QR Code
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div ref={printRef}>
            <div className="qr-container border-2 border-gray-800 rounded-2xl p-10 text-center bg-white">
              {companyLogo && (
                <img 
                  src={companyLogo} 
                  alt="Logo da empresa" 
                  className="w-60 h-20 mx-auto mb-4 object-contain"
                />
              )}
              <div className="company-name text-3xl font-bold text-gray-800 mb-4 tracking-wider">
                {companyName || "NSA SECURITY"}
              </div>
              <div className="point-name text-xl text-gray-600 mb-8 font-semibold">
                {pointName}
              </div>
              <div className="qr-code w-80 h-80 mx-auto mb-8 border-2 border-gray-200 rounded-lg flex items-center justify-center bg-gray-50">
                {qrCodeDataUrl ? (
                  <img 
                    src={qrCodeDataUrl} 
                    alt="QR Code" 
                    className="w-72 h-72 object-contain"
                  />
                ) : (
                  <div className="text-center">
                    <div className="text-lg text-gray-500">Gerando QR Code...</div>
                  </div>
                )}
              </div>
              
              {/* Manual Code Section */}
              <div className="manual-code-section border-t-2 border-gray-200 pt-6">
                <div className="text-lg font-semibold text-gray-700 mb-2">
                  Código Manual
                </div>
                <div className="text-3xl font-bold text-gray-800 tracking-wider">
                  {manualCode}
                </div>
                <div className="text-sm text-gray-500 mt-2">
                  Use este código em caso de falha na leitura do QR
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Fechar
            </Button>
            <Button onClick={generateNewQRCode} variant="outline" className="flex-1">
              🔄 Atualizar QR
            </Button>
            <Button onClick={downloadQR} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Download PNG
            </Button>
            <Button onClick={handlePrint} className="flex-1 bg-tactical-green hover:bg-tactical-green/90">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QrPrintModel;