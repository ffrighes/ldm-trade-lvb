import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_ROWS = 5000;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ---- AuthN ----
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return jsonResponse({ error: "Não autorizado." }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return jsonResponse({ error: "Não autorizado." }, 401);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ---- AuthZ: admin or gerente ----
    const [{ data: isAdmin }, { data: isGerente }] = await Promise.all([
      adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      adminClient.rpc("has_role", { _user_id: user.id, _role: "gerente" }),
    ]);
    if (!isAdmin && !isGerente) {
      return jsonResponse({ error: "Acesso negado." }, 403);
    }

    // ---- Body size guard ----
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: "Payload muito grande." }, 413);
    }
    const rawText = await req.text();
    if (rawText.length > MAX_BODY_BYTES) {
      return jsonResponse({ error: "Payload muito grande." }, 413);
    }

    const lines = rawText.split("\n").filter(l => l.startsWith("|") && !l.startsWith("|-"));

    const materials: any[] = [];

    for (const line of lines) {
      if (materials.length >= MAX_ROWS) break;
      const inner = line.replace(/^\|/, '').replace(/\|$/, '');
      const cols = inner.split("|").map((c: string) => c.trim());
      if (cols.length < 15) continue;
      if (cols[0] === 'Descrição (Família)') continue;

      const descricao = cols[0].replace(/\\_/g, '_').replace(/\\/g, '');
      const bitola = (cols[10] || cols[8] || '').replace(/\\/g, '').replace(/\[|\]/g, '');
      const sch = (cols[9] || '').replace(/\\/g, '');
      const rawUn = cols[11] || '';
      const unidade = rawUn === 'M' ? 'm' : (rawUn === 'STK' ? 'un' : rawUn.toLowerCase() || 'un');
      const erpVal = cols[12] || '';
      const erp = (erpVal === '-' || erpVal === '') ? '' : erpVal;
      const custoRaw = cols[13] || '';
      const custo = (!custoRaw || custoRaw === '#N/A' || custoRaw === '-') ? 0 : parseFloat(custoRaw) || 0;
      const notasRaw = cols[14] || '';
      const notas = (!notasRaw || notasRaw === '-') ? '' : notasRaw.replace(/<br\/>/g, '\n').replace(/\\/g, '');

      if (descricao && bitola) {
        materials.push({ descricao, bitola, sch, unidade, erp, custo, notas });
      }
    }

    if (materials.length > MAX_ROWS) {
      return jsonResponse({ error: `Limite de ${MAX_ROWS} linhas excedido.` }, 400);
    }

    const batchSize = 100;
    let inserted = 0;
    for (let i = 0; i < materials.length; i += batchSize) {
      const batch = materials.slice(i, i + batchSize);
      const { error } = await adminClient.from("materials").insert(batch);
      if (error) {
        return jsonResponse({ error: error.message, batch: i }, 500);
      }
      inserted += batch.length;
    }

    return jsonResponse({ success: true, inserted, parsed: materials.length });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
