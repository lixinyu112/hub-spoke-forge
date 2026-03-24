import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as hex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APP_ID = "tripo";

async function md5Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items, languages } = await req.json();

    if (!items?.length || !languages?.length) {
      return new Response(
        JSON.stringify({ error: "items and languages are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiToken = Deno.env.get("CRESCENDIA_API_TOKEN");
    if (!apiToken) {
      return new Response(
        JSON.stringify({ error: "CRESCENDIA_API_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { item_id: string; language: string; success: boolean; error?: string }[] = [];

    for (const item of items) {
      for (const lang of languages) {
        const sourceType: string = item.type; // "hub" or "spoke"
        const baseUrl =
          sourceType === "hub"
            ? `https://api-test.crescendia.ai/api/v1/hubs`
            : `https://api-test.crescendia.ai/api/v1/spokes`;

        const url = `${baseUrl}?lang=${lang}`;

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const baseString = APP_ID + apiToken + timestamp;
        const sign = await md5Hex(baseString);

        try {
          const resp = await fetch(url, {
            method: "POST",
            headers: {
              "X-Api-AppId": APP_ID,
              "X-Api-Sign": sign,
              "X-Api-Timestamp": timestamp,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(item.json_data),
          });

          if (!resp.ok) {
            const errText = await resp.text();
            results.push({ item_id: item.id, language: lang, success: false, error: `${resp.status}: ${errText}` });
          } else {
            results.push({ item_id: item.id, language: lang, success: true });
          }
        } catch (fetchErr) {
          results.push({ item_id: item.id, language: lang, success: false, error: String(fetchErr) });
        }
      }
    }

    const failCount = results.filter((r) => !r.success).length;
    return new Response(
      JSON.stringify({ results, total: results.length, failed: failCount }),
      { status: failCount === results.length ? 502 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
