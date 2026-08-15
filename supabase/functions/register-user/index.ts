import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const email = (body.email || '').toString().trim().toLowerCase();
    const password = (body.password || '').toString();
    const name = (body.name || email.split('@')[0] || 'Revendedor').toString().trim().slice(0, 120);

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email e senha são obrigatórios' }), {
        status: 400, headers: corsHeaders,
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Senha muito curta. Use no mínimo 6 caracteres.' }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Cria usuário via Admin API (sem rate limit)
    const { data: userData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirma email automaticamente
      user_metadata: { name },
    });

    if (createError) {
      console.error('[register-user] createUser error:', createError);

      // Traduz erros comuns
      const msg = createError.message || '';
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        return new Response(JSON.stringify({ error: 'Este email já está cadastrado. Faça login.' }), {
          status: 409, headers: corsHeaders,
        });
      }
      if (msg.includes('weak') || msg.includes('pwned')) {
        return new Response(JSON.stringify({ error: 'Senha muito fraca. Use letras, números e símbolos.' }), {
          status: 400, headers: corsHeaders,
        });
      }
      return new Response(JSON.stringify({ error: msg || 'Erro ao criar conta' }), {
        status: 400, headers: corsHeaders,
      });
    }

    const userId = userData.user.id;

    // Cria perfil de revendedor pendente
    const { error: profileError } = await admin.from('reseller_profiles').insert({
      user_id: userId,
      name,
      status: 'pending',
    });

    if (profileError && !profileError.code?.includes('23505')) {
      console.error('[register-user] profile insert error:', profileError);
    }

    console.log('[register-user] Novo revendedor registrado:', email, userId);

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      status: 'pending',
    }), { headers: corsHeaders });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[register-user] error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: corsHeaders,
    });
  }
});
