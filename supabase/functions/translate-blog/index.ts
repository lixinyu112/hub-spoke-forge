// Lightweight translator: 接收单篇文章 + 目标语言，仅做 LLM 翻译。
// 设计目标：每次调用 < 60s，避免 publish-blog 把"翻译 + CMS 推送"全部串在一个 150s 网关请求里超时。
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

const MAX_CHUNK_TOKENS = 6000;
const estimateTokens = (str: string): number => Math.ceil(str.length / 3);

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

async function translateJson(jsonData: any, targetLang: string, customSystemPrompt?: string): Promise<any> {
  const llmApiKey = Deno.env.get("CUSTOM_LLM_API_KEY");
  if (!llmApiKey) {
    console.warn("CUSTOM_LLM_API_KEY not set, returning original");
    return jsonData;
  }

  const fullStr = JSON.stringify(jsonData, null, 2);
  const tokens = estimateTokens(fullStr);

  if (tokens <= MAX_CHUNK_TOKENS) {
    return await callTranslateApi(fullStr, targetLang, llmApiKey, customSystemPrompt);
  }

  // 大文章：按 components 数组切片翻译
  if (typeof jsonData !== "object" || jsonData === null || Array.isArray(jsonData)) {
    return await callTranslateApi(fullStr, targetLang, llmApiKey, customSystemPrompt);
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
        console.error("meta translate failed:", err);
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

    const flush = async () => {
      if (chunk.length === 0) return;
      try {
        const arr = await callTranslateApi(JSON.stringify(chunk, null, 2), targetLang, llmApiKey, customSystemPrompt);
        translatedComponents.push(...(Array.isArray(arr) ? arr : [arr]));
      } catch (err) {
        console.error(`chunk translate failed (${chunk.length}):`, err);
        translatedComponents.push(...chunk);
      }
      chunk = [];
      chunkSize = 0;
    };

    for (const comp of components) {
      const compTokens = estimateTokens(JSON.stringify(comp));
      if (chunk.length > 0 && chunkSize + compTokens > MAX_CHUNK_TOKENS) {
        await flush();
      }
      chunk.push(comp);
      chunkSize += compTokens;
    }
    await flush();

    result[componentsKey] = translatedComponents;
  }

  return result;
}

/** 将 blog post 的 json_data 转成 CMS 期望的 article（与 publish-blog 中的 toArticle 同步） */
function toArticle(post: any) {
  const data = post.json_data || {};
  const components = Array.isArray(data.components) ? data.components : [];
  const articleHeader = components.find((c: any) => c?.type === "articleHeader")?.props || {};
  const contentBlocks = components
    .filter((c: any) => c?.type === "contentBlock")
    .map((c: any) => c?.props?.content)
    .filter((v: unknown): v is string => typeof v === "string" && v.trim().length > 0);

  const firstString = (...vals: unknown[]): string | undefined => {
    for (const v of vals) {
      if (typeof v === "string") {
        const t = v.trim();
        if (t) return t;
      }
    }
    return undefined;
  };
  const normalizeStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const arr = value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const r = item as Record<string, unknown>;
          return firstString(r.slug, r.value, r.name, r.label, r.title) || "";
        }
        return "";
      })
      .filter(Boolean);
    return arr.length ? arr : undefined;
  };
  const normalizePublishedAt = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const t = value.trim();
    if (!t) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return new Date(`${t}T00:00:00.000Z`).toISOString();
    const p = new Date(t);
    return Number.isNaN(p.getTime()) ? undefined : p.toISOString();
  };

  const markdown = firstString(data.markdown, data.content, data.body, contentBlocks.join("\n\n")) || JSON.stringify(data, null, 2);
  const title = firstString(data.title, articleHeader.title, post.title) || "Untitled";

  const keywordsArr = normalizeStringArray(data.keywords ?? data.tags ?? data.meta?.keywords ?? articleHeader.tags);

  return {
    title,
    markdown,
    slug: firstString(data.slug, post.slug),
    description: firstString(data.description, data.meta?.description, articleHeader.subtitle),
    categorySlugs: normalizeStringArray(
      data.categorySlugs ?? data.categories ?? data.taxonomy?.categories ?? articleHeader.categorySlugs
    ),
    publishedAt: normalizePublishedAt(data.publishedAt ?? data.published_at ?? articleHeader.publishDate),
    heroImage: firstString(data.heroImage, data.hero_image, data.cover, data.meta?.ogImage, articleHeader.coverImage),
    keywords: keywordsArr ? keywordsArr.map((k) => ({ keyword: k })) : undefined,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { item, language, translate_prompt } = body || {};
    if (!item || !language) {
      return new Response(
        JSON.stringify({ error: "item and language are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = item.json_data || {};
    const articles: any[] = [];

    if (Array.isArray(data.articles) && data.articles.length > 0) {
      for (const raw of data.articles) {
        let article: any = { ...raw };
        if (language !== "zh" || translate_prompt) {
          try {
            article = await translateJson(article, language, translate_prompt);
          } catch (err) {
            console.error(`translate article "${article.title}" failed:`, err);
          }
        }
        if (Array.isArray(article.keywords)) {
          article.keywords = article.keywords.map((k: any) => (typeof k === "string" ? { keyword: k } : k));
        }
        articles.push(article);
      }
    } else {
      const translatedData = language === "zh" && !translate_prompt
        ? data
        : await translateJson(data, language, translate_prompt);
      articles.push(toArticle({ ...item, json_data: translatedData }));
    }

    return new Response(
      JSON.stringify({ item_id: item.id, language, articles }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
