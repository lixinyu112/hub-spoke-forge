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
 * Call LLM to translate a JSON string.
 * Returns parsed JSON or throws on failure.
 */
async function callTranslateApi(
  jsonStr: string,
  targetLang: string,
  llmApiKey: string,
  customSystemPrompt?: string,
): Promise<any> {
  const langName = LANG_NAMES[targetLang] || targetLang;

  const defaultSystemPrompt = "你是一个精确的 JSON 翻译引擎，只输出翻译后的 JSON。";

  const baseRules = `请将以下 JSON 中所有面向用户的文本内容翻译为 ${langName}（语言代码：${targetLang}）。
规则：
1. 只翻译 JSON 值中的自然语言文本（标题、描述、段落、按钮文案等）
2. 不要翻译 JSON 的键名（key）
3. 不要翻译 URL、slug、技术标识符、CSS类名、图片路径
4. 不要翻译 type、status 等枚举值
5. 保持 JSON 结构完全不变
6. 直接输出翻译后的 JSON，不要添加任何解释`;

  let systemPrompt: string;
  let userPrompt: string;
  if (customSystemPrompt?.trim()) {
    systemPrompt = customSystemPrompt.trim();
    userPrompt = `${baseRules}\n\n请严格遵循以上系统指令中的翻译要求进行翻译。\n\nJSON 内容：\n${jsonStr}`;
  } else {
    systemPrompt = defaultSystemPrompt;
    userPrompt = `${baseRules}\n\nJSON 内容：\n${jsonStr}`;
  }

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
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Translation API ${resp.status}: ${errText}`);
  }

  const result = await resp.json();
  let content = result.choices?.[0]?.message?.content || "";
  content = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  return JSON.parse(content);
}

/** Rough size estimation for chunking */
function estimateTokens(str: string): number {
  return Math.ceil(str.length / 3);
}

const MAX_CHUNK_TOKENS = 6000;

/**
 * Translate JSON, chunking by top-level components array if content is too large.
 * Strictly follows the custom translate prompt when provided.
 */
async function translateJson(jsonData: any, targetLang: string, customSystemPrompt?: string): Promise<any> {
  const llmApiKey = Deno.env.get("CUSTOM_LLM_API_KEY");
  if (!llmApiKey) {
    console.warn("CUSTOM_LLM_API_KEY not set, skipping translation");
    return jsonData;
  }

  const fullStr = JSON.stringify(jsonData, null, 2);
  const tokens = estimateTokens(fullStr);

  if (tokens <= MAX_CHUNK_TOKENS) {
    try {
      return await callTranslateApi(fullStr, targetLang, llmApiKey, customSystemPrompt);
    } catch (err) {
      console.error("Translation failed (single):", err);
      return jsonData;
    }
  }

  console.log(`Content too large (${tokens} est. tokens), chunking for translation...`);

  if (typeof jsonData !== "object" || jsonData === null || Array.isArray(jsonData)) {
    try {
      return await callTranslateApi(fullStr, targetLang, llmApiKey, customSystemPrompt);
    } catch (err) {
      console.error("Translation failed (large non-object):", err);
      return jsonData;
    }
  }

  const result: any = {};
  const keys = Object.keys(jsonData);
  const componentsKey = keys.find((k) => k === "components" && Array.isArray(jsonData[k]));

  const metaFields: any = {};
  for (const k of keys) {
    if (k !== componentsKey) metaFields[k] = jsonData[k];
  }

  if (Object.keys(metaFields).length > 0) {
    const metaStr = JSON.stringify(metaFields, null, 2);
    if (estimateTokens(metaStr) > 50) {
      try {
        const translated = await callTranslateApi(metaStr, targetLang, llmApiKey, customSystemPrompt);
        Object.assign(result, translated);
      } catch (err) {
        console.error("Translation failed for meta fields:", err);
        Object.assign(result, metaFields);
      }
    } else {
      Object.assign(result, metaFields);
    }
  }

  if (componentsKey) {
    const components = jsonData[componentsKey] as any[];
    const translatedComponents: any[] = [];
    let chunk: any[] = [];
    let chunkSize = 0;

    for (const comp of components) {
      const compTokens = estimateTokens(JSON.stringify(comp));

      if (chunk.length > 0 && chunkSize + compTokens > MAX_CHUNK_TOKENS) {
        try {
          const chunkArr = await callTranslateApi(JSON.stringify(chunk, null, 2), targetLang, llmApiKey, customSystemPrompt);
          translatedComponents.push(...(Array.isArray(chunkArr) ? chunkArr : [chunkArr]));
        } catch (err) {
          console.error(`Translation failed for component chunk (${chunk.length} items):`, err);
          translatedComponents.push(...chunk);
        }
        chunk = [];
        chunkSize = 0;
      }

      chunk.push(comp);
      chunkSize += compTokens;
    }

    if (chunk.length > 0) {
      try {
        const chunkArr = await callTranslateApi(JSON.stringify(chunk, null, 2), targetLang, llmApiKey, customSystemPrompt);
        translatedComponents.push(...(Array.isArray(chunkArr) ? chunkArr : [chunkArr]));
      } catch (err) {
        console.error(`Translation failed for final chunk (${chunk.length} items):`, err);
        translatedComponents.push(...chunk);
      }
    }

    result[componentsKey] = translatedComponents;
  }

  return result;
}

/**
 * Convert blog post json_data to the Blog Import API article format.
 * The json_data may contain fields like title, markdown/content, description, etc.
 */
function toArticle(post: any): {
  title: string;
  markdown: string;
  slug: string;
  description: string;
  categorySlugs: string[];
  publishedAt: string;
  heroImage: string;
  keywords: string[];
} {
  const data = post.json_data || {};

  const components = Array.isArray(data.components) ? data.components : [];
  const articleHeader = components.find((comp: any) => comp?.type === "articleHeader")?.props || {};
  const contentBlocks = components
    .filter((comp: any) => comp?.type === "contentBlock")
    .map((comp: any) => comp?.props?.content)
    .filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0);

  const firstString = (...values: unknown[]): string | undefined => {
    for (const value of values) {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
    }
    return undefined;
  };

  const normalizeStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;

    const normalized = value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const nested = firstString(record.slug, record.value, record.name, record.label, record.title);
          return nested || "";
        }
        return "";
      })
      .filter(Boolean);

    return normalized.length ? normalized : undefined;
  };

  const normalizePublishedAt = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}T00:00:00.000Z`).toISOString();
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  };

  const markdown = firstString(
    data.markdown,
    data.content,
    data.body,
    contentBlocks.length > 0 ? contentBlocks.join("\n\n") : undefined,
  ) || "";

  const title = firstString(
    data.title,
    articleHeader.title,
    post.title,
  ) || "Untitled";

  return {
    title,
    markdown,
    slug: firstString(data.slug, post.slug) || "",
    description: firstString(data.description, data.meta?.description, articleHeader.subtitle) || "",
    categorySlugs: normalizeStringArray(
      data.categorySlugs ?? data.categories ?? data.taxonomy?.categories ?? articleHeader.categorySlugs
    ) || [],
    publishedAt: normalizePublishedAt(
      data.publishedAt ?? data.published_at ?? articleHeader.publishDate
    ) || "",
    heroImage: firstString(
      data.heroImage,
      data.hero_image,
      data.cover,
      data.meta?.ogImage,
      articleHeader.coverImage,
    ) || "",
    keywords: normalizeStringArray(
      data.keywords ?? data.tags ?? data.meta?.keywords ?? articleHeader.tags
    ) || [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items, languages, translate_prompt, slug_prefix, environment } = await req.json();

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
        const articles = batch.map(({ article }) => ({
          title: article.title ?? "",
          markdown: article.markdown ?? "",
          slug: article.slug ?? "",
          description: article.description ?? "",
          categorySlugs: Array.isArray(article.categorySlugs) ? article.categorySlugs : [],
          publishedAt: article.publishedAt ?? "",
          heroImage: article.heroImage ?? "",
          keywords: Array.isArray(article.keywords) ? article.keywords : [],
        }));

        try {
          const cmsBaseUrl = CMS_URLS[environment] || CMS_URLS.production;
          const resp = await fetch(`${cmsBaseUrl}/api/blog-import`, {
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
