import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email e senha obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Busca o usuario por email (mais eficiente)
    const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({
      perPage: 1,
      page: 1,
    });
    // listUsers nao suporta filtro por email diretamente, usa searchText
    const { data: searchResult, error: searchErr } = await (admin.auth.admin as any).listUsers({
      filter: `email.eq.${email.toLowerCase()}`,
      perPage: 1,
    }).catch(() => ({ data: null, error: null }));

    // Tenta encontrar o usuario via busca simples
    const findResp = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email.toLowerCase())}`, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    const findData = await findResp.json();
    const existingUser = (findData.users || [])[0];

    // Se usuario existe mas email nao confirmado, confirma automaticamente
    if (existingUser && !existingUser.email_confirmed_at) {
      await admin.auth.admin.updateUserById(existingUser.id, { email_confirm: true });
      console.log('[sign-in] Email auto-confirmado para:', email);
    }


    // Faz login normal via anon key (agora o email ja esta confirmado)
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const loginResp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
      },
      body: JSON.stringify({ email, password }),
    });

    const loginData = await loginResp.json();

    if (!loginResp.ok || loginData.error) {
      const msg = loginData.error_description || loginData.message || loginData.error || 'Credenciais inválidas';
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Retorna sessao completa
    return new Response(JSON.stringify(loginData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[sign-in] error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
