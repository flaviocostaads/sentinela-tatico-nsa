import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface ApiIntegrationDocsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ApiIntegrationDocsDialog = ({ open, onOpenChange }: ApiIntegrationDocsDialogProps) => {
  const projectId = "vwguvnvzomfbdzmbpayc";
  const logsBase = `https://supabase.com/dashboard/project/${projectId}/functions`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Guia de Configuração das Integrações</DialogTitle>
        </DialogHeader>
        <Separator className="my-2" />
        <ScrollArea className="max-h-[70vh] px-6 pb-6">
          <article className="space-y-8">
            <section>
              <h3 className="text-lg font-semibold">Visão Geral</h3>
              <p className="text-sm text-muted-foreground">
                Este guia descreve como configurar cada integração disponível no sistema. Todas as chaves/API Keys são armazenadas de forma segura na tabela de integrações e usadas por Edge Functions dedicadas.
              </p>
            </section>

            <section>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">WhatsApp Business API</h3>
                <Badge variant="secondary">send-whatsapp</Badge>
              </div>
              <ol className="list-decimal pl-5 space-y-1 text-sm">
                <li>Crie/acesse uma conta no <a className="underline" href="https://business.facebook.com/" target="_blank" rel="noreferrer">Meta WhatsApp Business</a>.</li>
                <li>Obtenha o <strong>Access Token</strong> e o <strong>Phone Number ID</strong> no painel da Meta.</li>
                <li>No app: Configurações → API & Integrações → aba "WhatsApp". Preencha <em>Access Token</em> e <em>Phone Number ID</em>.</li>
                <li>Ative a integração com o interruptor "Ativar integração WhatsApp".</li>
                <li>Use "Teste de Integração" para enviar uma mensagem (telefone no formato E.164, ex.: 5511999999999).</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                Dicas: a função edge valida e registra envios na tabela notification_logs. Em caso de erro, verifique os logs: <a className="underline" href={`${logsBase}/send-whatsapp/logs`} target="_blank" rel="noreferrer">Logs do send-whatsapp</a>.
              </p>
            </section>

            <section>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Email (SendGrid / Mailchimp)</h3>
                <Badge variant="secondary">send-email</Badge>
              </div>
              <ol className="list-decimal pl-5 space-y-1 text-sm">
                <li>Crie uma conta no provedor desejado.
                  <ul className="list-disc pl-4 mt-1">
                    <li><strong>SendGrid:</strong> crie uma <em>API Key</em>, valide o remetente (Single Sender) ou domínio.</li>
                    <li><strong>Mailchimp (Transactional):</strong> crie a <em>API Key</em> e confirme domínio/remetente.</li>
                  </ul>
                </li>
                <li>No app: Configurações → API & Integrações → aba "Email".
                  <ul className="list-disc pl-4 mt-1">
                    <li>Preencha API Key, From Email e From Name no bloco do provedor.</li>
                    <li>Ative o provedor desejado.</li>
                  </ul>
                </li>
                <li>Envie um teste com os botões "Testar SendGrid" ou "Testar Mailchimp".</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                Os envios são processados pela função edge e registrados em notification_logs. Verifique: <a className="underline" href={`${logsBase}/send-email/logs`} target="_blank" rel="noreferrer">Logs do send-email</a>.
              </p>
            </section>

            <section>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Mapas</h3>
                <Badge variant="secondary">get-mapbox-token</Badge>
              </div>
              <p className="text-sm mt-1">
                O projeto utiliza Mapbox para renderização de mapas, com recuperação segura do token via Edge Function.
              </p>
              <ol className="list-decimal pl-5 space-y-1 text-sm">
                <li>Obtenha um token em <a className="underline" href="https://account.mapbox.com/" target="_blank" rel="noreferrer">Mapbox</a>.</li>
                <li>No Supabase, adicione/valide o secret <strong>MAPBOX_ACCESS_TOKEN</strong> em Settings → Functions → Secrets.</li>
                <li>No app não é necessário colar o token; ele é lido pela função <em>get-mapbox-token</em> e usado pelos mapas.</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                Checar execução: <a className="underline" href={`${logsBase}/get-mapbox-token/logs`} target="_blank" rel="noreferrer">Logs do get-mapbox-token</a>.
              </p>
              <div className="mt-3">
                <h4 className="font-medium">Opcional: Google Maps</h4>
                <p className="text-sm text-muted-foreground">A aba "Mapas" permite armazenar uma API Key do Google Maps para funcionalidades futuras (ex.: otimização de rotas). O renderizador atual permanece Mapbox.</p>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Relatórios Automatizados</h3>
                <Badge variant="secondary">generate-report</Badge>
              </div>
              <ol className="list-decimal pl-5 space-y-1 text-sm">
                <li>No app: Configurações → API & Integrações → aba "Relatórios".</li>
                <li>Defina a frequência desejada e a lista de destinatários (separados por vírgula).</li>
                <li>Ative a integração e use "Gerar Relatório de Teste" para validar.</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                A função compila dados de rondas, incidentes e visitas e envia por email usando o provedor configurado. Logs: <a className="underline" href={`${logsBase}/generate-report/logs`} target="_blank" rel="noreferrer">Logs do generate-report</a>.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Agendamento automático via cron não está habilitado por padrão. Você pode configurar um scheduler no Supabase para invocar periodicamente a função <em>generate-report</em> conforme a frequência desejada.
              </p>
            </section>

            <section>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">GPS Tracking</h3>
                <Badge variant="secondary">App</Badge>
              </div>
              <ol className="list-decimal pl-5 space-y-1 text-sm">
                <li>Acesse o sistema em ambiente <strong>HTTPS</strong> e conceda permissão de localização ao navegador/dispositivo.</li>
                <li>Inicie uma ronda; o app registra posições na tabela <code>user_locations</code> (RLS aplicada).</li>
                <li>Para testes, use a aba "GPS" para verificar as capacidades e acompanhe mapas em tempo real na Dashboard.</li>
              </ol>
            </section>
          </article>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ApiIntegrationDocsDialog;
