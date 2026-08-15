import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

Deno.serve(async (_req) => {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL") ||
    `postgresql://postgres.dbemwakooelapusoguhq:${Deno.env.get("POSTGRES_PASSWORD")}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`;

  try {
    const sql = postgres(dbUrl, { max: 1 });

    await sql`
      CREATE OR REPLACE FUNCTION public.use_reseller_lifetime_credit(_reseller_id uuid)
      RETURNS boolean
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $func$
      DECLARE
        _available integer;
      BEGIN
        SELECT lifetime_credits_total - lifetime_credits_used INTO _available
        FROM public.reseller_credits
        WHERE reseller_id = _reseller_id
        FOR UPDATE;

        IF _available IS NULL OR _available <= 0 THEN
          RETURN false;
        END IF;

        UPDATE public.reseller_credits
        SET lifetime_credits_used = lifetime_credits_used + 1, updated_at = now()
        WHERE reseller_id = _reseller_id;

        RETURN true;
      END;
      $func$
    `;

    await sql.end();
    return new Response(JSON.stringify({ success: true, message: "Função criada com sucesso!" }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
