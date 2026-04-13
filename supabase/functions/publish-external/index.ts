import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APP_ID = "tripo";

const LANG_NAMES: Record<string, string> = {
  zh: "简体中文", en: "English", ja: "日本語", ko: "한국어",
  es: "Español", pt: "Português", ru: "Русский",
};

/**
 * Translate JSON content to the target language using LLM.
 * Returns translated JSON object, or the original if translation fails or lang is zh.
 */
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

  // If user provided a custom translate prompt, use it as the PRIMARY system instruction
  const defaultSystemPrompt = "你是一个精确的 JSON 翻译引擎，只输出翻译后的 JSON。";

  const baseRules = `请将以下 JSON 中所有面向用户的文本内容翻译为 ${langName}（语言代码：${targetLang}）。
规则：
1. 只翻译 JSON 值中的自然语言文本（标题、描述、段落、按钮文案等）
2. 不要翻译 JSON 的键名（key）
3. 不要翻译 URL、slug、技术标识符、CSS类名、图片路径
4. 不要翻译 type、status 等枚举值
5. 保持 JSON 结构完全不变
6. 直接输出翻译后的 JSON，不要添加任何解释`;

  // When custom prompt exists, prepend it as the authoritative instruction
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

  // Small enough → translate in one shot
  if (tokens <= MAX_CHUNK_TOKENS) {
    try {
      return await callTranslateApi(fullStr, targetLang, llmApiKey, customSystemPrompt);
    } catch (err) {
      console.error("Translation failed (single):", err);
      return jsonData;
    }
  }

  // Large content → chunk by top-level keys
  console.log(`Content too large (${tokens} est. tokens), chunking for translation...`);

  if (typeof jsonData !== "object" || jsonData === null || Array.isArray(jsonData)) {
    // Can't chunk non-objects, try direct anyway
    try {
      return await callTranslateApi(fullStr, targetLang, llmApiKey, customSystemPrompt);
    } catch (err) {
      console.error("Translation failed (large non-object):", err);
      return jsonData;
    }
  }

  // Strategy: translate components array items individually, other fields as a group
  const result: any = {};
  const keys = Object.keys(jsonData);
  const componentsKey = keys.find(
    (k) => k === "components" && Array.isArray(jsonData[k]),
  );

  // Translate non-components fields as one chunk
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

  // Translate components array in chunks
  if (componentsKey) {
    const components = jsonData[componentsKey] as any[];
    const translatedComponents: any[] = [];
    let chunk: any[] = [];
    let chunkSize = 0;

    for (const comp of components) {
      const compStr = JSON.stringify(comp);
      const compTokens = estimateTokens(compStr);

      if (chunk.length > 0 && chunkSize + compTokens > MAX_CHUNK_TOKENS) {
        // Translate current chunk
        try {
          const chunkArr = await callTranslateApi(
            JSON.stringify(chunk, null, 2),
            targetLang,
            llmApiKey,
            customSystemPrompt,
          );
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

    // Translate remaining chunk
    if (chunk.length > 0) {
      try {
        const chunkArr = await callTranslateApi(
          JSON.stringify(chunk, null, 2),
          targetLang,
          llmApiKey,
          customSystemPrompt,
        );
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items, languages, translate_prompt } = await req.json();

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
        const sourceType: string = item.type;
        const baseUrl =
          sourceType === "hub"
            ? `https://api.crescendia.ai/api/v1/hubs`
            : `https://api.crescendia.ai/api/v1/spokes`;

        const url = `${baseUrl}?lang=${lang}`;

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const baseString = APP_ID + apiToken + timestamp;
        const sign = md5(baseString);

        try {
          // Translate JSON content to target language using custom or default prompt
          const translatedData = await translateJson(item.json_data, lang, translate_prompt);

          const resp = await fetch(url, {
            method: "POST",
            headers: {
              "X-Api-AppId": APP_ID,
              "X-Api-Sign": sign,
              "X-Api-Timestamp": timestamp,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(translatedData),
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
