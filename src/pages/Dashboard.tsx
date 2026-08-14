import { AdminLayout } from '@/components/admin/AdminLayout';
import { useLicenseStats, useLicenses, useWildcardUsage } from '@/hooks/useLicenses';
import { Key, CheckCircle, XCircle, Ban, DollarSign, Globe, Activity, Crown, TrendingUp, Clock } from 'lucide-react';
import lovekingBanner from '@/assets/loveking-banner-admin.png';
import { format, differenceInDays, parseISO, formatDistanceToNow, subDays, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GitHubCalendar } from '@/components/ui/git-hub-calendar';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useLicenseStats();
  const { data: licenses, isLoading: licensesLoading } = useLicenses();
  const { data: wildcardUsage } = useWildcardUsage();

  const { data: dailyCounts } = useQuery({
    queryKey: ['activity-daily-counts'],
    queryFn: async () => {
      const startDate = subDays(new Date(), 364).toISOString();
      const paginateFetch = async (selectFn: (from: number, to: number) => Promise<{ data: any[] | null; error: any }>, dateKey: string) => {
        let allDates: string[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await selectFn(from, from + pageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allDates = allDates.concat(data.map((r: any) => r[dateKey]));
          if (data.length < pageSize) break;
          from += pageSize;
        }
        return allDates;
      };
      const [logDates, licenseDates, sessionDates, deviceDates] = await Promise.all([
        paginateFetch(async (f, t) => await supabase.from('license_logs').select('created_at').gte('created_at', startDate).range(f, t), 'created_at'),
        paginateFetch(async (f, t) => await supabase.from('licenses').select('created_at').gte('created_at', startDate).range(f, t), 'created_at'),
        paginateFetch(async (f, t) => await supabase.from('sessions').select('created_at').gte('created_at', startDate).range(f, t), 'created_at'),
        paginateFetch(async (f, t) => await supabase.from('devices').select('activated_at').gte('activated_at', startDate).range(f, t), 'activated_at'),
      ]);
      const allDates = [...logDates, ...licenseDates, ...sessionDates, ...deviceDates];
      const countMap: Record<string, number> = {};
      allDates.forEach(d => {
        const day = format(parseISO(d), 'yyyy-MM-dd');
        countMap[day] = (countMap[day] || 0) + 1;
      });
      return countMap;
    }
  });

  const contributionData = useMemo(() => {
    const today = new Date();
    const start = subDays(today, 364);
    const allDays = eachDayOfInterval({ start, end: today });
    return allDays.map(day => ({
      date: format(day, 'yyyy-MM-dd'),
      count: dailyCounts?.[format(day, 'yyyy-MM-dd')] || 0,
    }));
  }, [dailyCounts]);

  const expiringLicenses = licenses?.filter((l) => {
    if (l.status !== 'active') return false;
    const daysUntilExpiry = differenceInDays(parseISO(l.expires_at), new Date());
    return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
  }) || [];

  const recentLicenses = licenses?.slice(0, 6) || [];
  const recentWildcardUsage = wildcardUsage?.slice(0, 8) || [];

  const statCards = [
    { label: 'Total', value: stats?.total ?? '—', icon: Key, color: 'text-foreground', bg: 'bg-white/5', border: 'border-white/10' },
    { label: 'Ativas', value: stats?.active ?? '—', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { label: 'Expiradas', value: stats?.expired ?? '—', icon: XCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
    { label: 'Revogadas', value: stats?.revoked ?? '—', icon: Ban, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    { label: 'Receita', value: stats ? `R$ ${stats.revenue.toFixed(0)}` : '—', icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6 px-1 sm:px-0 pt-14 lg:pt-0">

        {/* ── BANNER HERO ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative w-full rounded-3xl overflow-hidden shadow-2xl shadow-primary/20"
        >
          <img
            src={lovekingBanner}
            alt="LoveKing Pro"
            className="w-full h-auto block max-h-[260px] sm:max-h-[320px] object-cover"
          />
          {/* Overlay com info */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent flex flex-col justify-end p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Painel de Controle</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
              Dashboard
            </h1>
            <p className="text-sm text-white/60 mt-1">Visão geral do sistema LoveKing Pro</p>
          </div>
        </motion.div>

        {/* ── STATS ROW ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
        >
          {statCards.map((card, i) => (
            <div
              key={card.label}
              className={`relative rounded-2xl border ${card.border} ${card.bg} backdrop-blur-sm p-4 sm:p-5 overflow-hidden group hover:scale-[1.02] transition-transform duration-200`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">{card.label}</span>
                <card.icon className={`h-4 w-4 ${card.color} opacity-70`} />
              </div>
              <p className={`text-2xl sm:text-3xl font-black tabular-nums ${card.color}`}>
                {statsLoading ? '—' : card.value}
              </p>
              {/* linha decorativa */}
              <div className={`absolute bottom-0 left-0 right-0 h-[2px] ${card.bg} opacity-50`} />
            </div>
          ))}
        </motion.div>

        {/* ── ATIVIDADE ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="glass-card rounded-2xl p-5 sm:p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Atividade</h2>
              <p className="text-[10px] text-muted-foreground">últimos 365 dias</p>
            </div>
          </div>
          <div className="overflow-x-auto scrollbar-none">
            <GitHubCalendar
              data={contributionData}
              colors={["hsl(var(--muted))", "hsl(0 60% 30%)", "hsl(0 70% 40%)", "hsl(0 78% 48%)", "hsl(0 85% 58%)"]}
            />
          </div>
        </motion.div>

        {/* ── GRID: Wildcards + Expirando + Recentes ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        >
          {/* Chave Coringa */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-5 border-b border-border/20">
              <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-bold text-foreground flex-1">Chave Coringa</h2>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/10">
                {recentWildcardUsage.length}
              </span>
            </div>
            <div className="p-4 space-y-2 max-h-[280px] overflow-y-auto scrollbar-none">
              {recentWildcardUsage.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum uso registrado</p>
              ) : recentWildcardUsage.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-xl border border-border/15 bg-background/20 px-3 py-2.5 hover:bg-primary/[0.04] transition-colors">
                  <div>
                    <code className="text-[11px] font-mono font-semibold text-foreground">{u.ip_address}</code>
                    <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(parseISO(u.last_used_at), { addSuffix: true, locale: ptBR })}</p>
                  </div>
                  <span className="text-xs font-black text-primary">{u.message_count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Expirando em breve */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-5 border-b border-border/20">
              <div className="h-8 w-8 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-400" />
              </div>
              <h2 className="text-sm font-bold text-foreground flex-1">Expirando em Breve</h2>
              <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/10 px-2.5 py-1 rounded-lg border border-yellow-500/20">
                {expiringLicenses.length}
              </span>
            </div>
            <div className="p-4 space-y-2 max-h-[280px] overflow-y-auto scrollbar-none">
              {expiringLicenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">✅ Nenhuma expirando</p>
              ) : expiringLicenses.map((l) => {
                const daysLeft = differenceInDays(parseISO(l.expires_at), new Date());
                return (
                  <div key={l.id} className="flex items-center justify-between rounded-xl border border-border/15 bg-background/20 px-3 py-2.5 hover:bg-yellow-500/[0.04] transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] font-semibold text-foreground truncate">{l.license_key.slice(0, 16)}...</p>
                      <p className="text-[10px] text-muted-foreground truncate">{l.email}</p>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ml-2 ${daysLeft <= 1 ? 'bg-red-500/15 text-red-400 border border-red-500/20' : 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'}`}>
                      {daysLeft === 0 ? 'HOJE' : `${daysLeft}D`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Licenças Recentes */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-5 border-b border-border/20">
              <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-bold text-foreground flex-1">Licenças Recentes</h2>
            </div>
            <div className="p-4 space-y-2 max-h-[280px] overflow-y-auto scrollbar-none">
              {licensesLoading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
              ) : recentLicenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma licença</p>
              ) : recentLicenses.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-xl border border-border/15 bg-background/20 px-3 py-2.5 hover:bg-primary/[0.04] transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] font-semibold text-foreground truncate">{l.license_key}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{l.email}</p>
                  </div>
                  <span className={`ml-2 shrink-0 text-[10px] font-black px-2 py-1 rounded-lg border ${
                    l.status === 'active' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' :
                    l.status === 'expired' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' :
                    'bg-red-500/15 text-red-400 border-red-500/20'
                  }`}>
                    {l.status === 'active' ? 'ATIVA' : l.status === 'expired' ? 'EXP' : 'REV'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AdminLayout>
  );
}
