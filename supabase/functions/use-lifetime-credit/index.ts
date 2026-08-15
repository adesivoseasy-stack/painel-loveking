import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Workaround: simula a funcao diretamente no JS
  // Quando chamado com _reseller_id, debita 1 credito vitalicio
  const body = await req.json().catch(() => ({}));
  const resellerId = body._reseller_id || body.reseller_id;

  if (!resellerId) {
    return new Response(JSON.stringify({ error: "reseller_id obrigatorio" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Busca creditos disponiveis
  const { data: credits, error: credErr } = await admin
    .from("reseller_credits")
    .select("lifetime_credits_total, lifetime_credits_used")
    .eq("reseller_id", resellerId)
    .single();

  if (credErr || !credits) {
    return new Response(JSON.stringify(false), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const available = (credits.lifetime_credits_total || 0) - (credits.lifetime_credits_used || 0);
  if (available <= 0) {
    return new Response(JSON.stringify(false), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Debita 1 credito
  const { error: updErr } = await admin
    .from("reseller_credits")
    .update({ lifetime_credits_used: (credits.lifetime_credits_used || 0) + 1 })
    .eq("reseller_id", resellerId);

  if (updErr) {
    console.error("[use-lifetime-credit] update error:", updErr);
    return new Response(JSON.stringify(false), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify(true), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
