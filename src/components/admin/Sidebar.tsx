import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  LogOut, Menu, X, LayoutDashboard, KeyRound, Users, Blocks, Download,
  Settings, Code, Shield, BarChart3, Coins, Megaphone, Settings2,
  ShieldAlert, FolderGit2, Flame, Tag, ChevronRight, Crown, ShieldOff,
} from 'lucide-react';
import logoImg from '@/assets/logo.webp';
import { useState } from 'react';

const navGroups = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/licenses', label: 'Licenças', icon: KeyRound },
      { href: '/customers', label: 'Clientes', icon: Users },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/resellers', label: 'Revendedores', icon: Users },
      { href: '/managers', label: 'Gerentes', icon: Shield },
      { href: '/templates', label: 'Templates', icon: Blocks },
      { href: '/admin/desconto-progressivo', label: 'Desc. Comunidade', icon: Flame },
      { href: '/admin/promocoes', label: 'Promoções', icon: Tag },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/extension', label: 'Extensão', icon: Download },
      { href: '/extension-front', label: 'Front', icon: Code },
      { href: '/settings', label: 'Configurações', icon: Settings },
      { href: '/token-metrics', label: 'Tokens', icon: BarChart3 },
      { href: '/admin/lvb-credits', label: 'LVB Credits', icon: Coins },
      { href: '/admin/creditos-config', label: 'Créditos', icon: Settings2 },
      { href: '/admin/remarketing', label: 'Remarketing', icon: Megaphone },
      { href: '/admin/ip-audit', label: 'Auditoria IP', icon: ShieldAlert },
      { href: '/admin/project-audit', label: 'Auditoria Projetos', icon: FolderGit2 },
      { href: '/admin/key-projects', label: 'Chaves × Projetos', icon: ShieldOff },
    ],
  },
];

export function Sidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2.5 rounded-xl bg-background/90 backdrop-blur-xl border border-primary/15 shadow-xl shadow-black/30"
      >
        {isOpen ? <X className="h-4 w-4 text-foreground" /> : <Menu className="h-4 w-4 text-foreground" />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsOpen(false)} />
      )}

      <aside className={cn(
        'fixed left-0 top-0 z-40 h-screen w-[260px] transition-transform duration-300 ease-out',
        'lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Background */}
        <div className="absolute inset-0 bg-[#0a0a0a] border-r border-white/[0.05]" />

        {/* Linha vermelha lateral esquerda */}
        <div className="absolute left-0 top-0 w-[2px] h-full bg-gradient-to-b from-transparent via-primary/60 to-transparent" />

        {/* Glow topo */}
        <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-primary/[0.06] to-transparent pointer-events-none" />

        <div className="relative flex h-full flex-col">

          {/* Logo area */}
          <div className="px-5 pt-6 pb-5">
            <div className="flex items-center gap-3">
              <img src={logoImg} alt="LoveKing" className="h-10 w-auto" />
            </div>
            {/* Divisor com glow */}
            <div className="mt-5 h-px bg-gradient-to-r from-primary/40 via-primary/10 to-transparent" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 overflow-y-auto scrollbar-none space-y-5">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/20 px-3 mb-2">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
                          isActive
                            ? 'text-white'
                            : 'text-white/40 hover:text-white/80'
                        )}
                      >
                        {/* Active background */}
                        {isActive && (
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary to-primary/70 shadow-lg shadow-primary/25" />
                        )}

                        {/* Hover background */}
                        {!isActive && (
                          <div className="absolute inset-0 rounded-xl bg-transparent group-hover:bg-white/[0.04] transition-colors duration-200" />
                        )}

                        {/* Left accent for active */}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white/50 rounded-full -translate-x-3" />
                        )}

                        <Icon className={cn(
                          'relative h-[16px] w-[16px] shrink-0 transition-all duration-200',
                          isActive ? 'text-white' : 'text-white/30 group-hover:text-white/70'
                        )} />
                        <span className="relative flex-1 truncate text-[12.5px] tracking-wide">{item.label}</span>
                        {isActive && (
                          <ChevronRight className="relative h-3 w-3 text-white/50 shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User footer */}
          <div className="p-3 pt-4">
            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent mb-4" />

            {/* User card */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 mb-2 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-md shadow-primary/30">
                <span className="text-[13px] font-black text-white">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-white/90 truncate">{user?.email?.split('@')[0]}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Crown className="h-2.5 w-2.5 text-primary" />
                  <p className="text-[9px] font-bold uppercase tracking-wider text-primary">Admin</p>
                </div>
              </div>
            </div>

            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-medium text-white/30 hover:text-red-400 hover:bg-red-500/[0.08] transition-all duration-200"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sair da conta</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
