// 轻量 CMS 推送：接收已翻译好的 articles + locale，直接调用 Crescendia Blog Import API。
// 不做任何 LLM 调用，单次执行通常 < 5s。
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CMS_URLS: Record<string, string> = {
  staging: "https://cms-staging.itripo3d.com",
  production: "https://cms.itripo3d.com",
};
const MAX_ARTICLES_PER_BATCH = 10;
const FETCH_TIMEOUT_MS = 25_000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entries, language, slug_prefix, environment } = await req.json();
    // entries: Array<{ item_id: string; articles: any[] }>
    if (!Array.isArray(entries) || entries.length === 0 || !language) {
      return new Response(
        JSON.stringify({ error: "entries and language are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const env = environment === "production" ? "production" : "staging";
    const apiKeyEnvName = env === "production" ? "BLOG_IMPORT_API_KEY_PROD" : "BLOG_IMPORT_API_KEY";
    const apiKey = Deno.env.get(apiKeyEnvName);
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `${apiKeyEnvName} not configured` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 把所有 entries 拍平成 { item_id, article }[] 以便分批
    const flat: { item_id: string; article: any }[] = [];
    for (const e of entries) {
      const arts = Array.isArray(e?.articles) ? e.articles : [];
      for (const a of arts) flat.push({ item_id: e.item_id, article: a });
    }

    const results: { item_id: string; language: string; success: boolean; error?: string; cms_results?: any[] }[] = [];

    for (let i = 0; i < flat.length; i += MAX_ARTICLES_PER_BATCH) {
      const batch = flat.slice(i, i + MAX_ARTICLES_PER_BATCH);
      const articles = batch.map((b) => b.article);

      try {
        const cmsBaseUrl = CMS_URLS[env];
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
        const resp = await fetch(`${cmsBaseUrl}/api/blog-import`, {
          method: "POST",
          signal: ac.signal,
          headers: {
            "Authorization": `users API-Key ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            locale: language,
            slugPrefix: slug_prefix || "crescendia",
            articles,
          }),
        }).finally(() => clearTimeout(timer));

        if (!resp.ok) {
          const errBody = await resp.text();
          for (const b of batch) {
            results.push({
              item_id: b.item_id,
              language,
              success: false,
              error: `CMS API ${resp.status}: ${errBody}`,
            });
          }
        } else {
          const body = await resp.json();
          const cmsResults = body.results || [];
          for (let j = 0; j < batch.length; j++) {
            const cmsResult = cmsResults[j];
            const success = cmsResult?.status === "created" || cmsResult?.status === "updated";
            results.push({
              item_id: batch[j].item_id,
              language,
              success,
              error: success ? undefined : (cmsResult?.reason || cmsResult?.status || "unknown"),
              cms_results: cmsResult ? [cmsResult] : undefined,
            });
          }
        }
      } catch (fetchErr) {
        for (const b of batch) {
          results.push({
            item_id: b.item_id,
            language,
            success: false,
            error: String(fetchErr),
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ results, total: results.length, failed: results.filter((r) => !r.success).length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
