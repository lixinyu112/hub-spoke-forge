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
async function translateJson(jsonData: any, targetLang: string): Promise<any> {
  if (targetLang === "zh") return jsonData; // 源语言，无需翻译

  const llmApiKey = Deno.env.get("CUSTOM_LLM_API_KEY");
  if (!llmApiKey) {
    console.warn("CUSTOM_LLM_API_KEY not set, skipping translation");
    return jsonData;
  }

  const langName = LANG_NAMES[targetLang] || targetLang;
  const prompt = `你是一个专业翻译引擎。请将以下 JSON 中所有面向用户的文本内容翻译为 ${langName}（语言代码：${targetLang}）。
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
          { role: "system", content: "你是一个精确的 JSON 翻译引擎，只输出翻译后的 JSON。" },
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
    // Strip markdown code fences if present
    content = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    return JSON.parse(content);
  } catch (err) {
    console.error("Translation failed:", err);
    return jsonData;
  }
}

// Pure JS MD5 implementation (no dependencies, Deno-compatible)
function md5(input: string): string {
  const bytes = new TextEncoder().encode(input);

  function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    a = (a + q + x + t) | 0;
    return (((a << s) | (a >>> (32 - s))) + b) | 0;
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  // Pre-processing: adding padding bits
  const len = bytes.length;
  const bitLen = len * 8;
  const padLen = ((56 - (len + 1) % 64) + 64) % 64;
  const totalLen = len + 1 + padLen + 8;
  const buf = new Uint8Array(totalLen);
  buf.set(bytes);
  buf[len] = 0x80;
  // Append length in bits as 64-bit little-endian
  const view = new DataView(buf.buffer);
  view.setUint32(totalLen - 8, bitLen >>> 0, true);
  view.setUint32(totalLen - 4, 0, true);

  let a0 = 0x67452301;
  let b0 = 0xEFCDAB89;
  let c0 = 0x98BADCFE;
  let d0 = 0x10325476;

  for (let i = 0; i < totalLen; i += 64) {
    const w = new Array<number>(16);
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, true);
    }

    let a = a0, b = b0, c = c0, d = d0;

    a = ff(a, b, c, d, w[0], 7, 0xD76AA478);
    d = ff(d, a, b, c, w[1], 12, 0xE8C7B756);
    c = ff(c, d, a, b, w[2], 17, 0x242070DB);
    b = ff(b, c, d, a, w[3], 22, 0xC1BDCEEE);
    a = ff(a, b, c, d, w[4], 7, 0xF57C0FAF);
    d = ff(d, a, b, c, w[5], 12, 0x4787C62A);
    c = ff(c, d, a, b, w[6], 17, 0xA8304613);
    b = ff(b, c, d, a, w[7], 22, 0xFD469501);
    a = ff(a, b, c, d, w[8], 7, 0x698098D8);
    d = ff(d, a, b, c, w[9], 12, 0x8B44F7AF);
    c = ff(c, d, a, b, w[10], 17, 0xFFFF5BB1);
    b = ff(b, c, d, a, w[11], 22, 0x895CD7BE);
    a = ff(a, b, c, d, w[12], 7, 0x6B901122);
    d = ff(d, a, b, c, w[13], 12, 0xFD987193);
    c = ff(c, d, a, b, w[14], 17, 0xA679438E);
    b = ff(b, c, d, a, w[15], 22, 0x49B40821);

    a = gg(a, b, c, d, w[1], 5, 0xF61E2562);
    d = gg(d, a, b, c, w[6], 9, 0xC040B340);
    c = gg(c, d, a, b, w[11], 14, 0x265E5A51);
    b = gg(b, c, d, a, w[0], 20, 0xE9B6C7AA);
    a = gg(a, b, c, d, w[5], 5, 0xD62F105D);
    d = gg(d, a, b, c, w[10], 9, 0x02441453);
    c = gg(c, d, a, b, w[15], 14, 0xD8A1E681);
    b = gg(b, c, d, a, w[4], 20, 0xE7D3FBC8);
    a = gg(a, b, c, d, w[9], 5, 0x21E1CDE6);
    d = gg(d, a, b, c, w[14], 9, 0xC33707D6);
    c = gg(c, d, a, b, w[3], 14, 0xF4D50D87);
    b = gg(b, c, d, a, w[8], 20, 0x455A14ED);
    a = gg(a, b, c, d, w[13], 5, 0xA9E3E905);
    d = gg(d, a, b, c, w[2], 9, 0xFCEFA3F8);
    c = gg(c, d, a, b, w[7], 14, 0x676F02D9);
    b = gg(b, c, d, a, w[12], 20, 0x8D2A4C8A);

    a = hh(a, b, c, d, w[5], 4, 0xFFFA3942);
    d = hh(d, a, b, c, w[8], 11, 0x8771F681);
    c = hh(c, d, a, b, w[11], 16, 0x6D9D6122);
    b = hh(b, c, d, a, w[14], 23, 0xFDE5380C);
    a = hh(a, b, c, d, w[1], 4, 0xA4BEEA44);
    d = hh(d, a, b, c, w[4], 11, 0x4BDECFA9);
    c = hh(c, d, a, b, w[7], 16, 0xF6BB4B60);
    b = hh(b, c, d, a, w[10], 23, 0xBEBFBC70);
    a = hh(a, b, c, d, w[13], 4, 0x289B7EC6);
    d = hh(d, a, b, c, w[0], 11, 0xEAA127FA);
    c = hh(c, d, a, b, w[3], 16, 0xD4EF3085);
    b = hh(b, c, d, a, w[6], 23, 0x04881D05);
    a = hh(a, b, c, d, w[9], 4, 0xD9D4D039);
    d = hh(d, a, b, c, w[12], 11, 0xE6DB99E5);
    c = hh(c, d, a, b, w[15], 16, 0x1FA27CF8);
    b = hh(b, c, d, a, w[2], 23, 0xC4AC5665);

    a = ii(a, b, c, d, w[0], 6, 0xF4292244);
    d = ii(d, a, b, c, w[7], 10, 0x432AFF97);
    c = ii(c, d, a, b, w[14], 15, 0xAB9423A7);
    b = ii(b, c, d, a, w[5], 21, 0xFC93A039);
    a = ii(a, b, c, d, w[12], 6, 0x655B59C3);
    d = ii(d, a, b, c, w[3], 10, 0x8F0CCC92);
    c = ii(c, d, a, b, w[10], 15, 0xFFEFF47D);
    b = ii(b, c, d, a, w[1], 21, 0x85845DD1);
    a = ii(a, b, c, d, w[8], 6, 0x6FA87E4F);
    d = ii(d, a, b, c, w[15], 10, 0xFE2CE6E0);
    c = ii(c, d, a, b, w[6], 15, 0xA3014314);
    b = ii(b, c, d, a, w[13], 21, 0x4E0811A1);
    a = ii(a, b, c, d, w[4], 6, 0xF7537E82);
    d = ii(d, a, b, c, w[11], 10, 0xBD3AF235);
    c = ii(c, d, a, b, w[2], 15, 0x2AD7D2BB);
    b = ii(b, c, d, a, w[9], 21, 0xEB86D391);

    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }

  function toHex(n: number): string {
    // little-endian bytes to hex
    return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  return (toHex(a0) + toHex(b0) + toHex(c0) + toHex(d0)).toUpperCase();
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
        const sourceType: string = item.type;
        const baseUrl =
          sourceType === "hub"
            ? `https://api-test.crescendia.ai/api/v1/hubs`
            : `https://api-test.crescendia.ai/api/v1/spokes`;

        const url = `${baseUrl}?lang=${lang}`;

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const baseString = APP_ID + apiToken + timestamp;
        const sign = md5(baseString);

        try {
          // Translate JSON content to target language
          const translatedData = await translateJson(item.json_data, lang);

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
