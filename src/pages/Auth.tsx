import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, KeyRound, Lock, Mail, Shield, Eye, EyeOff, Crown } from 'lucide-react';
import { z } from 'zod';
import logoImg from '@/assets/logo.webp';
import { motion, AnimatePresence } from 'framer-motion';
import { translateAuthError } from '@/lib/authErrors';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const emailSchema = z.object({
  email: z.string().email('Email inválido'),
});

/* Partículas flutuantes */
function Particles() {
  const particles = Array.from({ length: 22 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    delay: Math.random() * 5,
    duration: Math.random() * 8 + 6,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-primary/40"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{ y: [0, -40, 0], opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

export default function Auth() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const { signIn, signUp, user, isAdmin, isLoading, isReseller, isManager, resellerStatus } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && user) {
      if (isAdmin) navigate('/dashboard');
      else if (isManager) navigate('/manager/dashboard');
      else if (isReseller && resellerStatus === 'approved') navigate('/reseller/dashboard');
      else navigate('/minhas-aprovacoes');
    }
  }, [user, isAdmin, isManager, isReseller, resellerStatus, isLoading, navigate]);

  const handleForgotPassword = async (data: z.infer<typeof emailSchema>) => {
    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Email enviado!', description: 'Verifique sua caixa de entrada para redefinir sua senha.' });
      setShowForgotPassword(false);
      emailForm.reset();
    }
    setIsSubmitting(false);
  };

  const handleSubmit = async (data: z.infer<typeof loginSchema>) => {
    setIsSubmitting(true);
    if (activeTab === 'signup') {
      const { error, needsAdminRole } = await signUp(data.email, data.password);
      if (error) {
        toast({ title: 'Erro no cadastro', description: translateAuthError(error.message), variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }
      if (needsAdminRole) {
        toast({ title: 'Cadastro recebido!', description: 'Sua conta foi criada e está aguardando aprovação.' });
        setActiveTab('login');
        form.reset();
      }
      setIsSubmitting(false);
      return;
    }
    const { error } = await signIn(data.email, data.password);
    if (error) {
      toast({ title: 'Erro no login', description: translateAuthError(error.message), variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }
    setTimeout(() => setIsSubmitting(false), 1500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse-glow" />
          <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
        </div>
      </div>
    );
  }

  const inputClasses = "pl-11 h-[52px] rounded-xl bg-white/[0.04] border border-white/10 focus:border-primary/50 focus:bg-white/[0.06] transition-all duration-300 text-[15px] text-foreground placeholder:text-muted-foreground/40";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden px-4 py-10">

      {/* ── FUNDO: glow vermelho central ── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Radial glow principal */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(ellipse at center top, hsl(0 80% 40% / 0.18) 0%, transparent 70%)' }}
        />
        {/* Brilho inferior */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px]"
          style={{ background: 'radial-gradient(ellipse at center, hsl(0 75% 35% / 0.10) 0%, transparent 70%)' }}
        />
        {/* Grade de pontos */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'radial-gradient(circle, hsl(0 80% 60%) 1px, transparent 1px)',
            backgroundSize: '38px 38px',
          }}
        />
        {/* Linha diagonal decorativa */}
        <div
          className="absolute top-0 right-0 w-px h-full opacity-10"
          style={{ background: 'linear-gradient(to bottom, transparent, hsl(0 80% 50% / 0.6), transparent)' }}
        />
        <div
          className="absolute top-0 left-0 w-px h-full opacity-10"
          style={{ background: 'linear-gradient(to bottom, transparent, hsl(0 80% 50% / 0.4), transparent)' }}
        />
      </div>

      {/* Partículas */}
      <Particles />

      {/* ── LOGO grande centralizada ── */}
      <motion.div
        initial={{ opacity: 0, y: -30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative z-10 mb-10 flex flex-col items-center gap-4"
      >
        {/* Glow atrás da logo */}
        <div
          className="absolute inset-0 -z-10 blur-3xl opacity-30 scale-150"
          style={{ background: 'radial-gradient(ellipse, hsl(0 80% 50%) 0%, transparent 70%)' }}
        />
        <img
          src={logoImg}
          alt="LoveKing Pro"
          className="h-24 sm:h-28 md:h-32 w-auto drop-shadow-[0_0_32px_hsl(0_80%_50%/0.5)]"
        />
        {/* Badge sistema ativo */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/[0.08] backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/70">
            Sistema Operacional
          </span>
        </div>
      </motion.div>

      {/* ── CARD do formulário ── */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25 }}
        className="relative z-10 w-full max-w-[440px]"
      >
        {/* Borda brilhante no card */}
        <div
          className="absolute -inset-[1px] rounded-3xl pointer-events-none z-0"
          style={{
            background: 'linear-gradient(135deg, hsl(0 80% 55% / 0.35), transparent 45%, transparent 55%, hsl(0 70% 45% / 0.2))',
          }}
        />

        <div className="relative z-10 rounded-3xl bg-white/[0.03] backdrop-blur-2xl p-8 shadow-2xl shadow-black/50">

          <AnimatePresence mode="wait">
            {showForgotPassword ? (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="text-center mb-8">
                  <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">Recuperar Senha</h2>
                  <p className="text-sm text-muted-foreground/60 mt-1">Enviaremos um link para redefinir</p>
                </div>

                <Form {...emailForm}>
                  <form onSubmit={emailForm.handleSubmit(handleForgotPassword)} className="space-y-5">
                    <FormField control={emailForm.control} name="email" render={({ field }) => (
                      <FormItem className="space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">Email</div>
                        <FormControl>
                          <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                            <Input {...field} placeholder="seu@email.com" className={inputClasses} disabled={isSubmitting} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-[52px] rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all duration-300 relative overflow-hidden group shadow-lg shadow-primary/25"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                      <span className="relative z-10">
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin inline" />Enviando...</> : 'Enviar link de recuperação'}
                      </span>
                    </button>
                    <button type="button" className="w-full py-3 text-muted-foreground hover:text-foreground text-sm flex items-center justify-center gap-2 transition-colors" onClick={() => setShowForgotPassword(false)}>
                      <ArrowLeft className="h-4 w-4" />Voltar ao login
                    </button>
                  </form>
                </Form>
              </motion.div>
            ) : (
              <motion.div
                key="auth"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {/* Título */}
                <div className="mb-7 text-center">
                  <h2 className="text-2xl sm:text-[1.75rem] font-black text-foreground leading-tight">
                    {activeTab === 'login' ? (
                      <>Bem-vindo <span className="text-gradient">de volta</span></>
                    ) : (
                      <>Criar <span className="text-gradient">conta</span></>
                    )}
                  </h2>
                  <p className="text-sm text-muted-foreground/60 mt-1.5">
                    {activeTab === 'login' ? 'Acesse seu painel de controle' : 'Registre-se para começar'}
                  </p>
                </div>

                {/* Tabs Entrar / Cadastrar */}
                <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.07] mb-7">
                  {(['login', 'signup'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 relative overflow-hidden ${
                        activeTab === tab
                          ? 'text-white'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {activeTab === tab && (
                        <motion.div
                          layoutId="activeTabLK"
                          className="absolute inset-0 bg-primary rounded-lg shadow-lg shadow-primary/30"
                          transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
                        />
                      )}
                      <span className="relative z-10">{tab === 'login' ? 'Entrar' : 'Cadastrar'}</span>
                    </button>
                  ))}
                </div>

                {/* Formulário */}
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">Email</div>
                        <FormControl>
                          <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground/35 group-focus-within:text-primary transition-colors" />
                            <Input {...field} type="email" placeholder="seu@email.com" className={inputClasses} disabled={isSubmitting} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="password" render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">Senha</div>
                        <FormControl>
                          <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground/35 group-focus-within:text-primary transition-colors" />
                            <Input {...field} type={showPassword ? 'text' : 'password'} placeholder="••••••••••" className={`${inputClasses} pr-12`} disabled={isSubmitting} />
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/35 hover:text-foreground/70 transition-colors"
                            >
                              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {activeTab === 'login' && (
                      <div className="flex justify-end">
                        <button type="button" className="text-xs text-muted-foreground/50 hover:text-primary transition-colors" onClick={() => setShowForgotPassword(true)}>
                          Esqueceu sua senha?
                        </button>
                      </div>
                    )}

                    {/* Botão principal */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-[52px] mt-2 rounded-xl bg-primary text-white font-bold text-[15px] hover:bg-primary/90 disabled:opacity-50 transition-all duration-300 relative overflow-hidden group shadow-xl shadow-primary/30 hover:shadow-primary/50"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/12 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {isSubmitting ? (
                          <><Loader2 className="h-4 w-4 animate-spin" />{activeTab === 'signup' ? 'Cadastrando...' : 'Entrando...'}</>
                        ) : (
                          <>{activeTab === 'signup' ? 'Criar Conta' : 'Acessar Painel'}<Crown className="h-4 w-4 opacity-80" /></>
                        )}
                      </span>
                    </button>

                    {activeTab === 'signup' && (
                      <p className="text-[11px] text-center text-muted-foreground/50 leading-relaxed pt-1">
                        Após o cadastro, sua conta ficará pendente até a aprovação de um administrador.
                      </p>
                    )}
                  </form>
                </Form>

                {/* Programa de Revenda */}
                <button
                  onClick={() => navigate('/reseller/register')}
                  className="mt-5 w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-primary/[0.07] hover:border-primary/20 transition-all duration-300 group"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center group-hover:bg-primary/20 transition-all shrink-0">
                    <KeyRound className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <div className="text-[13px] font-bold text-foreground/90">Programa de Revenda</div>
                    <div className="text-[11px] text-muted-foreground/50">Seja um revendedor autorizado →</div>
                  </div>
                </button>

                {/* Badge de segurança */}
                <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/35">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Protegido com criptografia AES-256</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
