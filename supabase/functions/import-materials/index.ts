import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const rawText = await req.text();
    const lines = rawText.split("\n").filter(l => l.startsWith("|") && !l.startsWith("|-"));

    const materials: any[] = [];
    
    for (const line of lines) {
      const inner = line.replace(/^\|/, '').replace(/\|$/, '');
      const cols = inner.split("|").map((c: string) => c.trim());
      if (cols.length < 15) continue;
      if (cols[0] === 'Descrição (Família)') continue;
      
      const descricao = cols[0].replace(/\\_/g, '_').replace(/\\/g, '');
      // Use col 10 (Bitola = Ø + SCH combined) for uniqueness
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

    const batchSize = 100;
    let inserted = 0;
    for (let i = 0; i < materials.length; i += batchSize) {
      const batch = materials.slice(i, i + batchSize);
      const { error } = await supabase.from("materials").insert(batch);
      if (error) {
        return new Response(JSON.stringify({ error: error.message, batch: i, sample: batch[0] }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      inserted += batch.length;
    }

    return new Response(JSON.stringify({ success: true, inserted, parsed: materials.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
