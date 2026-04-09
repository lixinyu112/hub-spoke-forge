import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LANG_NAMES: Record<string, string> = {
  zh: "简体中文", en: "English", ja: "日本語", ko: "한국어",
  es: "Español", pt: "Português", ru: "Русский", de: "Deutsch", fr: "Français",
};

const CMS_URLS: Record<string, string> = {
  staging: "https://cms-staging.itripo3d.com",
  production: "https://cms.itripo3d.com",
};
const MAX_ARTICLES_PER_BATCH = 50;

/**
 * Translate JSON content to target language using LLM.
 */
async function translateJson(jsonData: any, targetLang: string, customSystemPrompt?: string): Promise<any> {
  const llmApiKey = Deno.env.get("CUSTOM_LLM_API_KEY");
  if (!llmApiKey) {
    console.warn("CUSTOM_LLM_API_KEY not set, skipping translation");
    return jsonData;
  }

  const langName = LANG_NAMES[targetLang] || targetLang;
  const systemPrompt = customSystemPrompt || "你是一个精确的 JSON 翻译引擎，只输出翻译后的 JSON。";

  const prompt = `请将以下 JSON 中所有面向用户的文本内容翻译为 ${langName}（语言代码：${targetLang}）。
规则：
1. 只翻译 JSON 值中的自然语言文本（标题、描述、段落、按钮文案等）
2. 不要翻译 JSON 的键名（key）
3. 不要翻译 URL、slug、技术标识符、CSS类名、图片路径
4. 不要翻译 type、status 等枚举值
5. 保持 JSON 结构完全不变
6. 直接输出翻译后的 JSON，不要添加任何解释

JSON 内容：
${JSON.stringify(jsonData, null, 2)}`;

  try {
    const resp = await fetch("https://api.babelark.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${llmApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-3.1-flash-lite-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      console.error("Translation API error:", resp.status, await resp.text());
      return jsonData;
    }

    const result = await resp.json();
    let content = result.choices?.[0]?.message?.content || "";
    content = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    return JSON.parse(content);
  } catch (err) {
    console.error("Translation failed:", err);
    return jsonData;
  }
}

/**
 * Convert blog post json_data to the Blog Import API article format.
 * The json_data may contain fields like title, markdown/content, description, etc.
 */
function toArticle(post: any): {
  title: string;
  markdown: string;
  slug?: string;
  description?: string;
  categorySlugs?: string[];
  publishedAt?: string;
  heroImage?: string;
  keywords?: string[];
} {
  const data = post.json_data || {};

  // Extract markdown: prefer explicit markdown field, then content, then stringify
  const markdown = data.markdown || data.content || data.body || JSON.stringify(data, null, 2);

  // Extract title: prefer json_data.title, fallback to post.title
  const title = data.title || post.title || "Untitled";

  return {
    title,
    markdown,
    slug: data.slug || post.slug || undefined,
    description: data.description || data.meta?.description || undefined,
    categorySlugs: data.categorySlugs || data.categories || undefined,
    publishedAt: data.publishedAt || data.published_at || undefined,
    heroImage: data.heroImage || data.hero_image || data.cover || undefined,
    keywords: data.keywords || data.tags || undefined,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items, languages, translate_prompt, slug_prefix } = await req.json();

    if (!items?.length || !languages?.length) {
      return new Response(
        JSON.stringify({ error: "items and languages are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("BLOG_IMPORT_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "BLOG_IMPORT_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { item_id: string; language: string; success: boolean; error?: string; cms_results?: any[] }[] = [];

    for (const lang of languages) {
      // Translate all items for this language
      const translatedItems: { post: any; article: any }[] = [];

      for (const item of items) {
        try {
          // Translate json_data if needed
          const translatedData = lang === "zh" && !translate_prompt
            ? item
            : { ...item, json_data: await translateJson(item.json_data, lang, translate_prompt) };

          const article = toArticle(translatedData);
          translatedItems.push({ post: item, article });
        } catch (err) {
          results.push({ item_id: item.id, language: lang, success: false, error: `Translation failed: ${err}` });
        }
      }

      // Batch articles (max 50 per request)
      for (let i = 0; i < translatedItems.length; i += MAX_ARTICLES_PER_BATCH) {
        const batch = translatedItems.slice(i, i + MAX_ARTICLES_PER_BATCH);
        const articles = batch.map((b) => b.article);

        try {
          const resp = await fetch(`${CMS_BASE_URL}/api/blog-import`, {
            method: "POST",
            headers: {
              "Authorization": `users API-Key ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              locale: lang,
              slugPrefix: slug_prefix || "crescendia",
              articles,
            }),
          });

          if (!resp.ok) {
            const errBody = await resp.text();
            // Mark all items in batch as failed
            for (const b of batch) {
              results.push({
                item_id: b.post.id,
                language: lang,
                success: false,
                error: `CMS API ${resp.status}: ${errBody}`,
              });
            }
          } else {
            const body = await resp.json();
            const cmsResults = body.results || [];

            // Match CMS results back to our items
            for (let j = 0; j < batch.length; j++) {
              const cmsResult = cmsResults[j];
              const success = cmsResult?.status === "created" || cmsResult?.status === "updated";
              results.push({
                item_id: batch[j].post.id,
                language: lang,
                success,
                error: success ? undefined : (cmsResult?.reason || cmsResult?.status || "unknown"),
                cms_results: cmsResult ? [cmsResult] : undefined,
              });
            }
          }
        } catch (fetchErr) {
          for (const b of batch) {
            results.push({
              item_id: b.post.id,
              language: lang,
              success: false,
              error: String(fetchErr),
            });
          }
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
