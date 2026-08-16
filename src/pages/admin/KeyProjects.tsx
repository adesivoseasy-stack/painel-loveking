import { AdminLayout } from '@/components/admin/AdminLayout';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Shield, ShieldOff, RefreshCw, Search, AlertTriangle,
  Lock, Unlock, Zap, Database, Eye, Save, ChevronDown,
  ChevronUp, Users, FolderOpen
} from 'lucide-react';

interface LicenseProject {
  license_key: string;
  project_id: string;
  project_name: string | null;
  last_seen_at: string;
}

interface License {
  id: string;
  license_key: string;
  email: string;
  status: string;
  is_blocked: boolean;
  blocked_at: string | null;
  blocked_reason: string | null;
}

interface BlockedKey {
  id: string;
  license_key: string;
  reason: string | null;
}

interface KeyRow {
  key: string;
  license: License | null;
  isBlocked: boolean;
  total: number;
  lastSeen: string | null;
  projects: string[];
}

type Tab = 'active' | 'suspicious' | 'blocked' | 'unknown';

const ONE_HOUR = 60 * 60 * 1000;

export default function KeyProjects() {
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('active');
  const [search, setSearch] = useState('');
  const [excludePrefixes, setExcludePrefixes] = useState('');
  const [payloadText, setPayloadText] = useState('');
  const [savingPayload, setSavingPayload] = useState(false);
  const [showPayloadEditor, setShowPayloadEditor] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [blockingAll, setBlockingAll] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, licRes, cfgRes, bkRes] = await Promise.all([
        supabase.from('license_projects').select('*').limit(5000),
        supabase.from('licenses').select('id,license_key,email,status,is_blocked,blocked_at,blocked_reason').limit(5000),
        supabase.from('system_config').select('value').eq('key', 'piracy_payload_text').maybeSingle(),
        supabase.from('blocked_keys').select('*').limit(5000),
      ]);

      const projects: LicenseProject[] = projRes.data || [];
      const licenses: License[] = (licRes.data || []) as License[];
      const blocked: BlockedKey[] = bkRes.data || [];
      if (cfgRes.data?.value) setPayloadText(cfgRes.data.value);

      // Build maps
      const licMap = new Map<string, License>();
      for (const l of licenses) {
        licMap.set(l.license_key.trim().toUpperCase(), l);
      }

      const bkSet = new Set<string>();
      for (const b of blocked) {
        bkSet.add(b.license_key.trim().toUpperCase());
      }

      // Group by key
      const keyMap = new Map<string, { projects: Set<string>; lastSeen: string | null }>();
      for (const p of projects) {
        const k = p.license_key.trim().toUpperCase();
        if (!keyMap.has(k)) keyMap.set(k, { projects: new Set(), lastSeen: null });
        const entry = keyMap.get(k)!;
        entry.projects.add(p.project_id);
        if (!entry.lastSeen || p.last_seen_at > entry.lastSeen) entry.lastSeen = p.last_seen_at;
      }

      const result: KeyRow[] = [];
      for (const [key, data] of keyMap.entries()) {
        const license = licMap.get(key) || null;
        const isBlocked = !!(license?.is_blocked) || bkSet.has(key);
        result.push({
          key,
          license,
          isBlocked,
          total: data.projects.size,
          lastSeen: data.lastSeen,
          projects: [...data.projects],
        });
      }

      result.sort((a, b) => b.total - a.total);
      setRows(result);
    } catch (err: any) {
      toast.error('Erro ao carregar dados: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, ONE_HOUR);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filtered = useMemo(() => {
    const prefixes = excludePrefixes.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);

    return rows.filter(r => {
      if (search && !r.key.toLowerCase().includes(search.toLowerCase()) &&
        !r.license?.email?.toLowerCase().includes(search.toLowerCase())) return false;
      if (prefixes.length && prefixes.some(p => r.key.startsWith(p))) return false;

      if (tab === 'active') return !r.isBlocked;
      if (tab === 'suspicious') return !r.isBlocked && r.total > 20;
      if (tab === 'blocked') return r.isBlocked;
      if (tab === 'unknown') return !r.license && !r.isBlocked;
      return true;
    });
  }, [rows, tab, search, excludePrefixes]);

  const counts = useMemo(() => ({
    active: rows.filter(r => !r.isBlocked).length,
    suspicious: rows.filter(r => !r.isBlocked && r.total > 20).length,
    blocked: rows.filter(r => r.isBlocked).length,
    unknown: rows.filter(r => !r.license && !r.isBlocked).length,
  }), [rows]);

  const toggleBlock = async (row: KeyRow) => {
    const newBlocked = !row.isBlocked;
    try {
      if (row.license) {
        const { error } = await supabase.from('licenses').update({
          is_blocked: newBlocked,
          blocked_at: newBlocked ? new Date().toISOString() : null,
          blocked_reason: newBlocked ? 'Bloqueado manualmente pelo painel admin' : null,
        }).eq('id', row.license.id);
        if (error) throw error;
      }

      if (newBlocked) {
        // Usa INSERT e ignora conflito — funciona com índice de expressão upper(license_key)
        const { error: bkErr } = await supabase.from('blocked_keys').insert({
          license_key: row.key,
          reason: 'Bloqueado manualmente pelo painel admin',
        });
        // código 23505 = duplicate → já existe, tudo certo
        if (bkErr && bkErr.code !== '23505') throw bkErr;
      } else {
        await supabase.from('blocked_keys').delete().ilike('license_key', row.key);
      }

      // Verifica no banco se realmente salvou antes de mostrar toast
      const { data: verify } = await supabase
        .from('blocked_keys')
        .select('id')
        .ilike('license_key', row.key)
        .maybeSingle();

      const confirmedBlocked = newBlocked ? !!verify : !verify;
      if (!confirmedBlocked) {
        toast.error('Falha ao confirmar bloqueio. Tente novamente.');
        await fetchData();
        return;
      }

      toast.success(newBlocked ? `🔒 Chave ${row.key.slice(0, 8)}... bloqueada` : `🔓 Chave ${row.key.slice(0, 8)}... desbloqueada`);
      await fetchData();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  const blockAll = async () => {
    const toBlock = filtered.filter(r => !r.isBlocked);
    if (!toBlock.length) return toast.info('Nenhuma chave para bloquear.');
    if (!confirm(`Bloquear ${toBlock.length} chaves? Esta ação pode ser desfeita individualmente.`)) return;
    setBlockingAll(true);
    try {
      // Insere uma por uma para ignorar duplicatas (índice de expressão upper(license_key))
      let blocked = 0;
      for (const r of toBlock) {
        const { error: e } = await supabase.from('blocked_keys').insert({
          license_key: r.key,
          reason: 'Bloqueio em massa por filtro (painel admin)',
        });
        if (!e || e.code === '23505') blocked++;
      }
      toast.success(`🔒 ${blocked} chaves bloqueadas!`);
      await fetchData();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setBlockingAll(false);
    }
  };

  const savePayload = async () => {
    setSavingPayload(true);
    try {
      const { error } = await supabase.from('system_config').upsert({
        key: 'piracy_payload_text',
        value: payloadText,
        description: 'Texto que substitui o prompt quando a chave está bloqueada por pirataria',
      }, { onConflict: 'key' });
      if (error) throw error;
      toast.success('✅ Payload de pirataria salvo!');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setSavingPayload(false);
    }
  };

  const tabDefs: { id: Tab; label: string; icon: any; color: string }[] = [
    { id: 'active', label: 'Ativas', icon: Zap, color: 'text-green-400' },
    { id: 'suspicious', label: 'Suspeita >20', icon: AlertTriangle, color: 'text-amber-400' },
    { id: 'blocked', label: 'Bloqueadas', icon: Lock, color: 'text-red-400' },
    { id: 'unknown', label: 'Fora do banco', icon: Database, color: 'text-purple-400' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6 px-1 sm:px-0 pt-12 lg:pt-0">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Projetos por Chave
            </h1>
            <p className="text-muted-foreground mt-1">Auditoria antipirataria — {rows.length} chaves rastreadas</p>
          </div>
          <Button onClick={fetchData} disabled={loading} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Ativas', value: counts.active, color: 'bg-green-500/10 text-green-400 border-green-500/20' },
            { label: 'Suspeitas', value: counts.suspicious, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
            { label: 'Bloqueadas', value: counts.blocked, color: 'bg-red-500/10 text-red-400 border-red-500/20' },
            { label: 'Fora do banco', value: counts.unknown, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
              <p className="text-2xl font-black">{s.value}</p>
              <p className="text-xs opacity-70 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Payload Editor */}
        <div className="rounded-xl border border-white/[0.08] bg-[#0a0a0a]">
          <button
            onClick={() => setShowPayloadEditor(!showPayloadEditor)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-white/80 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2">
              <ShieldOff className="h-4 w-4 text-red-400" />
              Texto do Payload de Pirataria
            </span>
            {showPayloadEditor ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showPayloadEditor && (
            <div className="px-5 pb-5 space-y-3 border-t border-white/[0.06]">
              <p className="text-xs text-white/40 mt-3">Este texto substitui 100% o prompt do usuário quando a chave está bloqueada.</p>
              <Textarea
                value={payloadText}
                onChange={e => setPayloadText(e.target.value)}
                rows={4}
                className="font-mono text-sm bg-white/5 border-white/10 resize-none"
                placeholder="Na tela inicial do projeto..."
              />
              <Button onClick={savePayload} disabled={savingPayload} size="sm" className="gap-2">
                <Save className="h-3.5 w-3.5" />
                {savingPayload ? 'Salvando...' : 'Salvar Payload'}
              </Button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por chave ou email..."
              className="pl-9 bg-white/5 border-white/10"
            />
          </div>
          <Input
            value={excludePrefixes}
            onChange={e => setExcludePrefixes(e.target.value)}
            placeholder="Excluir prefixos (ex: QL,PK)"
            className="sm:w-60 bg-white/5 border-white/10"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-white/5 p-1">
          {tabDefs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${tab === t.id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
            >
              <t.icon className={`h-3.5 w-3.5 ${tab === t.id ? t.color : ''}`} />
              <span className="hidden sm:inline">{t.label}</span>
              <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 border-white/20">
                {counts[t.id]}
              </Badge>
            </button>
          ))}
        </div>

        {/* Bulk Action */}
        {(tab === 'active' || tab === 'suspicious' || tab === 'unknown') && filtered.length > 0 && (
          <div className="flex justify-end">
            <Button
              variant="destructive"
              size="sm"
              onClick={blockAll}
              disabled={blockingAll}
              className="gap-2 text-xs"
            >
              <Lock className="h-3.5 w-3.5" />
              {blockingAll ? 'Bloqueando...' : `Bloquear todas as ${filtered.filter(r => !r.isBlocked).length} chaves visíveis`}
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-white/[0.08] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-white/30">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/30">
              <Database className="h-8 w-8 mb-2" />
              <p className="text-sm">Nenhuma chave encontrada</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {/* Header */}
              <div className="grid grid-cols-12 px-4 py-2.5 text-[11px] font-semibold text-white/30 uppercase tracking-wider bg-white/[0.02]">
                <div className="col-span-5">Chave</div>
                <div className="col-span-2 text-center">Projetos</div>
                <div className="col-span-2 text-center hidden md:block">Status</div>
                <div className="col-span-2 hidden lg:block">Último uso</div>
                <div className="col-span-1 text-right">Ação</div>
              </div>

              {filtered.map(row => (
                <div key={row.key}>
                  <div
                    className={`grid grid-cols-12 px-4 py-3 items-center hover:bg-white/[0.03] transition-colors ${row.isBlocked ? 'opacity-60' : ''}`}
                  >
                    {/* Key + Email */}
                    <div className="col-span-5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedKey(expandedKey === row.key ? null : row.key)}
                          className="text-white/20 hover:text-white/60 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <div>
                          <code className="text-xs font-mono text-white/80">
                            {row.key.slice(0, 8)}...{row.key.slice(-4)}
                          </code>
                          {row.license?.email && (
                            <p className="text-[10px] text-white/30 truncate">{row.license.email}</p>
                          )}
                          {!row.license && (
                            <Badge className="text-[9px] px-1 py-0 bg-purple-500/20 text-purple-300 border-purple-500/30 mt-0.5">
                              sem licença
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="col-span-2 text-center">
                      <span className={`text-sm font-bold ${row.total > 20 ? 'text-amber-400' : 'text-white/70'}`}>
                        {row.total}
                      </span>
                      {row.total > 20 && (
                        <AlertTriangle className="inline h-3 w-3 text-amber-400 ml-1" />
                      )}
                    </div>

                    {/* Status */}
                    <div className="col-span-2 text-center hidden md:flex justify-center">
                      {row.isBlocked ? (
                        <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">
                          <Lock className="h-2.5 w-2.5 mr-1" />bloqueada
                        </Badge>
                      ) : row.total > 20 ? (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                          <AlertTriangle className="h-2.5 w-2.5 mr-1" />suspeita
                        </Badge>
                      ) : (
                        <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-[10px]">
                          <Zap className="h-2.5 w-2.5 mr-1" />ativa
                        </Badge>
                      )}
                    </div>

                    {/* Last seen */}
                    <div className="col-span-2 hidden lg:block text-[11px] text-white/30">
                      {row.lastSeen ? new Date(row.lastSeen).toLocaleDateString('pt-BR') : '—'}
                    </div>

                    {/* Action */}
                    <div className="col-span-1 flex justify-end">
                      <Button
                        size="sm"
                        variant={row.isBlocked ? 'outline' : 'destructive'}
                        className={`h-7 text-[10px] px-2 gap-1 ${row.isBlocked ? 'border-green-500/30 text-green-400 hover:bg-green-500/10' : ''}`}
                        onClick={() => toggleBlock(row)}
                      >
                        {row.isBlocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        {row.isBlocked ? 'Liberar' : 'Bloquear'}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded projects */}
                  {expandedKey === row.key && (
                    <div className="px-12 pb-4 bg-white/[0.02]">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <FolderOpen className="h-3 w-3" /> Projetos ({row.projects.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {row.projects.map(pid => (
                          <code key={pid} className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/50 font-mono">
                            {pid}
                          </code>
                        ))}
                      </div>
                      <p className="text-[10px] text-white/20 mt-2">Chave completa: <code className="font-mono">{row.key}</code></p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
