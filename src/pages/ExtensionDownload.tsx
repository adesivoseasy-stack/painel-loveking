import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle, Shield, MessageCircle, ChevronRight, Loader2, Check, Zap, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

export default function ExtensionDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [done, setDone] = useState(false);

  const downloadExtension = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDone(false);

    try {
      const res = await fetch(`/loveking-v2.8.rar?t=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
      if (!res.ok) throw new Error(`Arquivo não encontrado (${res.status})`);

      const link = document.createElement('a');
      link.href = `/loveking-v2.8.rar?t=${Date.now()}`;
      link.download = 'LOVE KING 2.8.rar';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDone(true);
      toast.success('Love King 2.8 baixado com sucesso!');
      setTimeout(() => setDone(false), 3000);
    } catch (err: any) {
      toast.error('Falha ao baixar: ' + (err?.message || 'erro desconhecido'));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 px-1 sm:px-0 pt-12 lg:pt-0">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Download da Extensão</h1>
            <p className="text-muted-foreground mt-1">Baixe e instale a extensão Love King no seu Chrome</p>
          </div>
          <a
            href="https://w.app/lovableilimitado"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
          >
            <MessageCircle className="h-4 w-4" />
            Precisa de ajuda?
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>

        {/* Main Download Card */}
        <div className="max-w-2xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0a]">
            {/* Glow */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <div className="p-8 sm:p-10">
              {/* Icon + Title */}
              <div className="flex items-center gap-5 mb-8">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Package className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-md">
                      ⚡ Versão Atual
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-white">Love King <span className="text-primary">2.8</span></h2>
                  <p className="text-sm text-white/40 mt-0.5">Extensão oficial para Chrome</p>
                </div>
              </div>

              {/* Features */}
              <div className="grid gap-3 mb-8">
                {[
                  { icon: Shield, text: 'Validação de licença integrada' },
                  { icon: Zap, text: 'Envio de mensagens via proxy seguro' },
                  { icon: CheckCircle, text: 'Chat com anexos e templates' },
                  { icon: CheckCircle, text: 'Bolinha flutuante de ações rápidas' },
                  { icon: CheckCircle, text: 'Compatível com Chrome 120+' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-sm text-white/70">
                    <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    {text}
                  </div>
                ))}
              </div>

              {/* Download Button */}
              <Button
                onClick={downloadExtension}
                disabled={isDownloading}
                className="w-full h-14 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 transition-all hover:scale-[1.02] active:scale-95"
              >
                {done ? (
                  <><Check className="mr-2 h-5 w-5" />Download Concluído!</>
                ) : isDownloading ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Baixando...</>
                ) : (
                  <><Download className="mr-2 h-5 w-5" />Baixar Love King 2.8</>
                )}
              </Button>

              <p className="text-center text-xs text-white/30 mt-3">
                Arquivo .rar • Extraia com WinRAR ou 7-Zip
              </p>
            </div>
          </div>
        </div>

        {/* Installation Guide */}
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-6">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-3.5 w-3.5 text-primary" />
              </span>
              Como Instalar
            </h3>
            <ol className="space-y-3">
              {[
                'Extraia o arquivo .rar baixado (use WinRAR ou 7-Zip)',
                'Abra o Chrome e acesse chrome://extensions',
                'Ative o "Modo desenvolvedor" (canto superior direito)',
                'Clique em "Carregar sem empacotar"',
                'Selecione a pasta extraída',
                'Clique no ícone da extensão para abrir a sidebar',
                'Faça login com sua licença e comece a usar!',
              ].map((step, i) => (
                <li key={i} className="flex gap-3 items-start text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-white/60 leading-tight pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
