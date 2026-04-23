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

function extractJsonFromResponse(response: string): unknown {
  let cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const jsonStart = cleaned.search(/[\{\[]/);
  if (jsonStart === -1) throw new Error("No JSON object found in translation response");

  const closeChar = cleaned[jsonStart] === "[" ? "]" : "}";
  const jsonEnd = cleaned.lastIndexOf(closeChar);
  if (jsonEnd === -1) throw new Error("No closing JSON bracket found in translation response");

  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const repaired = cleaned
      .replace(/\\(?!["\\/bfnrtu])/g, "")
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    return JSON.parse(repaired);
  }
}

function formatTranslationApiError(status: number, body: string): string {
  const redactedBody = body.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***");
  try {
    const parsed = JSON.parse(body);
    const message = parsed?.error?.message || parsed?.message || redactedBody;
    if (status === 401 && /额度已用尽|quota|RemainQuota/i.test(message)) {
      return "Translation API 401: 翻译服务额度已用尽，请更新 CUSTOM_LLM_API_KEY 或补充额度后重试";
    }
    return `Translation API ${status}: ${String(message).replace(/sk-[A-Za-z0-9_-]+/g, "sk-***")}`;
  } catch (_) {
    if (status === 401 && /额度已用尽|quota|RemainQuota/i.test(redactedBody)) {
      return "Translation API 401: 翻译服务额度已用尽，请更新 CUSTOM_LLM_API_KEY 或补充额度后重试";
    }
    return `Translation API ${status}: ${redactedBody}`;
  }
}

function isTranslationAuthOrQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Translation API 401|额度已用尽|quota|RemainQuota|Unauthorized/i.test(message);
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

  const len = bytes.length;
  const bitLen = len * 8;
  const padLen = ((56 - (len + 1) % 64) + 64) % 64;
  const totalLen = len + 1 + padLen + 8;
  const buf = new Uint8Array(totalLen);
  buf.set(bytes);
  buf[len] = 0x80;
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

    a = ff(a, b, c, d, w[0], 7, 0xD76AA478); d = ff(d, a, b, c, w[1], 12, 0xE8C7B756);
    c = ff(c, d, a, b, w[2], 17, 0x242070DB); b = ff(b, c, d, a, w[3], 22, 0xC1BDCEEE);
    a = ff(a, b, c, d, w[4], 7, 0xF57C0FAF); d = ff(d, a, b, c, w[5], 12, 0x4787C62A);
    c = ff(c, d, a, b, w[6], 17, 0xA8304613); b = ff(b, c, d, a, w[7], 22, 0xFD469501);
    a = ff(a, b, c, d, w[8], 7, 0x698098D8); d = ff(d, a, b, c, w[9], 12, 0x8B44F7AF);
    c = ff(c, d, a, b, w[10], 17, 0xFFFF5BB1); b = ff(b, c, d, a, w[11], 22, 0x895CD7BE);
    a = ff(a, b, c, d, w[12], 7, 0x6B901122); d = ff(d, a, b, c, w[13], 12, 0xFD987193);
    c = ff(c, d, a, b, w[14], 17, 0xA679438E); b = ff(b, c, d, a, w[15], 22, 0x49B40821);

    a = gg(a, b, c, d, w[1], 5, 0xF61E2562); d = gg(d, a, b, c, w[6], 9, 0xC040B340);
    c = gg(c, d, a, b, w[11], 14, 0x265E5A51); b = gg(b, c, d, a, w[0], 20, 0xE9B6C7AA);
    a = gg(a, b, c, d, w[5], 5, 0xD62F105D); d = gg(d, a, b, c, w[10], 9, 0x02441453);
    c = gg(c, d, a, b, w[15], 14, 0xD8A1E681); b = gg(b, c, d, a, w[4], 20, 0xE7D3FBC8);
    a = gg(a, b, c, d, w[9], 5, 0x21E1CDE6); d = gg(d, a, b, c, w[14], 9, 0xC33707D6);
    c = gg(c, d, a, b, w[3], 14, 0xF4D50D87); b = gg(b, c, d, a, w[8], 20, 0x455A14ED);
    a = gg(a, b, c, d, w[13], 5, 0xA9E3E905); d = gg(d, a, b, c, w[2], 9, 0xFCEFA3F8);
    c = gg(c, d, a, b, w[7], 14, 0x676F02D9); b = gg(b, c, d, a, w[12], 20, 0x8D2A4C8A);

    a = hh(a, b, c, d, w[5], 4, 0xFFFA3942); d = hh(d, a, b, c, w[8], 11, 0x8771F681);
    c = hh(c, d, a, b, w[11], 16, 0x6D9D6122); b = hh(b, c, d, a, w[14], 23, 0xFDE5380C);
    a = hh(a, b, c, d, w[1], 4, 0xA4BEEA44); d = hh(d, a, b, c, w[4], 11, 0x4BDECFA9);
    c = hh(c, d, a, b, w[7], 16, 0xF6BB4B60); b = hh(b, c, d, a, w[10], 23, 0xBEBFBC70);
    a = hh(a, b, c, d, w[13], 4, 0x289B7EC6); d = hh(d, a, b, c, w[0], 11, 0xEAA127FA);
    c = hh(c, d, a, b, w[3], 16, 0xD4EF3085); b = hh(b, c, d, a, w[6], 23, 0x04881D05);
    a = hh(a, b, c, d, w[9], 4, 0xD9D4D039); d = hh(d, a, b, c, w[12], 11, 0xE6DB99E5);
    c = hh(c, d, a, b, w[15], 16, 0x1FA27CF8); b = hh(b, c, d, a, w[2], 23, 0xC4AC5665);

    a = ii(a, b, c, d, w[0], 6, 0xF4292244); d = ii(d, a, b, c, w[7], 10, 0x432AFF97);
    c = ii(c, d, a, b, w[14], 15, 0xAB9423A7); b = ii(b, c, d, a, w[5], 21, 0xFC93A039);
    a = ii(a, b, c, d, w[12], 6, 0x655B59C3); d = ii(d, a, b, c, w[3], 10, 0x8F0CCC92);
    c = ii(c, d, a, b, w[10], 15, 0xFFEFF47D); b = ii(b, c, d, a, w[1], 21, 0x85845DD1);
    a = ii(a, b, c, d, w[8], 6, 0x6FA87E4F); d = ii(d, a, b, c, w[15], 10, 0xFE2CE6E0);
    c = ii(c, d, a, b, w[6], 15, 0xA3014314); b = ii(b, c, d, a, w[13], 21, 0x4E0811A1);
    a = ii(a, b, c, d, w[4], 6, 0xF7537E82); d = ii(d, a, b, c, w[11], 10, 0xBD3AF235);
    c = ii(c, d, a, b, w[2], 15, 0x2AD7D2BB); b = ii(b, c, d, a, w[9], 21, 0xEB86D391);

    a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
  }

  function toHex(n: number): string {
    return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  return (toHex(a0) + toHex(b0) + toHex(c0) + toHex(d0)).toUpperCase();
}

/**
 * Call LLM to translate a JSON string.
 * Returns parsed JSON or throws on failure.
 */
async function callTranslateApi(
  jsonStr: string,
  targetLang: string,
  llmApiKey: string,
  customSystemPrompt?: string,
  attempt: number = 1,
  lenient: boolean = false,
): Promise<any> {
  const langName = LANG_NAMES[targetLang] || targetLang;

  // 强制目标语言指令——置于最高优先级
  const targetLangDirective = `【目标语言强制要求】\n本次翻译的目标语言是：${langName}（ISO 代码：${targetLang}）。\n输出文本必须 100% 为 ${langName}，禁止混入任何其他语言（包括但不限于日语、中文、英文等非目标语言）。\n如果你不确定某个词的 ${langName} 表达，请使用最贴近的 ${langName} 词汇，绝不能使用其他语言代替。\n注意：行业通用的英文术语缩写（如 3D / AI / API / SDK / Mod 等专有名词或工具名）可保留原文，但所有自然语言句子必须翻译为 ${langName}。`;

  const defaultSystemPrompt = "你是一个精确的 JSON 翻译引擎，只输出翻译后的 JSON。";

  const baseRules = `请将以下 JSON 中所有面向用户的文本内容翻译为 ${langName}（语言代码：${targetLang}）。
规则：
1. 只翻译 JSON 值中的自然语言文本（标题、描述、段落、按钮文案等）
2. 不要翻译 JSON 的键名（key）
3. 不要翻译 URL、slug、技术标识符、CSS类名、图片路径
4. 不要翻译 type、status 等枚举值
5. 保持 JSON 结构完全不变
6. 直接输出翻译后的 JSON，不要添加任何解释
7. 所有自然语言句子必须翻译为 ${langName}（行业通用英文术语缩写如 3D/AI/API/Mod 可保留）`;

  // System prompt 始终以目标语言强制指令开头，保证最高优先级
  let systemPrompt: string;
  let userPrompt: string;
  // 重试时追加更强的提示
  const retryHint = attempt > 1
    ? `\n\n【重试提醒】这是第 ${attempt} 次尝试。上次输出未通过 ${langName} 语言纯度校验（${langName} 字符占比偏低或英文密度过高），请彻底重新翻译，确保正文 100% 输出 ${langName}。`
    : "";
  if (customSystemPrompt?.trim()) {
    systemPrompt = `${targetLangDirective}${retryHint}\n\n${customSystemPrompt.trim()}`;
    userPrompt = `${baseRules}\n\n请严格遵循以上系统指令中的翻译要求，并务必将输出语言锁定为 ${langName}。\n\nJSON 内容：\n${jsonStr}`;
  } else {
    systemPrompt = `${targetLangDirective}${retryHint}\n\n${defaultSystemPrompt}`;
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
      // 重试时略提高温度以打破固定输出
      temperature: attempt === 1 ? 0 : 0.3,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(formatTranslationApiError(resp.status, errText));
  }

  const result = await resp.json();
  const content = result.choices?.[0]?.message?.content || "";
  const parsed = extractJsonFromResponse(content);

  // 语言指纹校验：确保输出语言匹配目标
  validateLanguageFingerprint(parsed, targetLang, lenient);

  return parsed;
}

const TRANSLATE_MAX_ATTEMPTS = 3;

/**
 * 包装 callTranslateApi，对"语言指纹校验失败 / JSON 解析失败"等可恢复错误最多重试 3 次。
 * 鉴权 / 额度类错误（401、quota）不会重试，立即抛出。
 * 策略：前两次严格校验，最后一次启用宽松校验，避免因边缘案例导致整篇发布失败。
 */
async function callTranslateApiWithRetry(
  jsonStr: string,
  targetLang: string,
  llmApiKey: string,
  customSystemPrompt?: string,
): Promise<any> {
  let lastErr: unknown;
  let lastLenientResult: any = undefined;
  for (let attempt = 1; attempt <= TRANSLATE_MAX_ATTEMPTS; attempt++) {
    const lenient = attempt === TRANSLATE_MAX_ATTEMPTS; // 最后一次重试启用宽松校验
    try {
      const data = await callTranslateApi(jsonStr, targetLang, llmApiKey, customSystemPrompt, attempt, lenient);
      if (attempt > 1) {
        console.log(`[translate-retry] success lang=${targetLang} attempt=${attempt} lenient=${lenient}`);
      }
      return data;
    } catch (err) {
      lastErr = err;
      if (isTranslationAuthOrQuotaError(err)) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[translate-retry] attempt=${attempt}/${TRANSLATE_MAX_ATTEMPTS} lang=${targetLang} lenient=${lenient} failed: ${msg}`);
      if (attempt < TRANSLATE_MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
  }
  const finalMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`已重试 ${TRANSLATE_MAX_ATTEMPTS} 次仍失败：${finalMsg}`);
}

/**
 * 校验翻译结果是否包含目标语言的特征字符。
 * 若发现明显的"语言不匹配"（如要求韩语却返回日语），抛出错误。
 */
/**
 * 提取 JSON 中所有面向用户的自然语言文本（值），跳过键名/URL/技术字段。
 * 用于语言指纹检测，避免被 URL、slug、tag 干扰。
 */
function extractNaturalText(data: any): string {
  const SKIP_KEYS = new Set([
    "id", "type", "slug", "hubSlug", "url", "href", "src", "image", "images",
    "coverImage", "avatar", "icon", "className", "color", "bg", "background",
    "publishDate", "date", "readTime", "tags", "tag", "category", "lang",
    "language", "code", "key", "name", // name 在 schema 里多为技术 key
  ]);
  const TEXT_KEYS = new Set([
    "title", "subtitle", "description", "content", "text", "label", "heading",
    "body", "summary", "quote", "answer", "question", "caption", "paragraph",
    "intro", "outro", "cta", "ctaText", "buttonText", "placeholder", "alt",
  ]);
  const out: string[] = [];
  const walk = (node: any, key?: string): void => {
    if (node == null) return;
    if (typeof node === "string") {
      if (key && SKIP_KEYS.has(key)) return;
      // 跳过 URL / 纯 slug
      if (/^https?:\/\//i.test(node)) return;
      if (/^[a-z0-9][a-z0-9\-_/.]*$/i.test(node) && node.length < 60 && !/\s/.test(node)) return;
      // 优先收集明确的文本字段或包含空格的较长字符串
      if ((key && TEXT_KEYS.has(key)) || (node.length > 10 && /\s/.test(node))) {
        out.push(node);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((v) => walk(v, key));
      return;
    }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, k);
    }
  };
  walk(data);
  return out.join(" ").slice(0, 12000);
}

// 典型英语停用词（小写，词边界匹配）。用于判定 es/pt 等非英语目标是否其实仍是英文。
const ENGLISH_STOPWORDS = [
  "the", "and", "for", "with", "this", "that", "from", "your", "you", "are",
  "have", "has", "will", "can", "how", "what", "when", "which", "their", "they",
  "guide", "learn", "more", "about", "into", "using", "use",
];

function countEnglishStopwords(text: string): number {
  const lower = " " + text.toLowerCase() + " ";
  let count = 0;
  for (const w of ENGLISH_STOPWORDS) {
    const re = new RegExp(`[^a-z]${w}[^a-z]`, "g");
    const m = lower.match(re);
    if (m) count += m.length;
  }
  return count;
}

function validateLanguageFingerprint(data: any, targetLang: string, lenient: boolean = false): void {
  const sample = extractNaturalText(data);
  if (!sample.trim()) {
    console.log(`[validate] lang=${targetLang} skip: no natural text`);
    return;
  }

  const koreanChars = (sample.match(/[\uAC00-\uD7AF]/g) || []).length;
  const japaneseKanaChars = (sample.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
  const chineseChars = (sample.match(/[\u4E00-\u9FFF]/g) || []).length;
  const cyrillicChars = (sample.match(/[\u0400-\u04FF]/g) || []).length;
  const hasKorean = koreanChars > 0;
  const hasJapaneseKana = japaneseKanaChars > 0;
  const hasChinese = chineseChars > 0;
  const hasCyrillic = cyrillicChars > 0;

  // 拉丁字母比例（用于检测 es/pt/en 是否被翻译，以及是否还残留大量英文）
  const latinChars = (sample.match(/[A-Za-z]/g) || []).length;
  const totalNonSpace = sample.replace(/\s/g, "").length;
  const latinRatio = totalNonSpace > 0 ? latinChars / totalNonSpace : 0;

  // 西语/葡语特征字符（带变音符号 + ñ/ç + 倒置标点）
  const spanishMarkers = (sample.match(/[áéíóúüñ¡¿]/gi) || []).length;
  const portugueseMarkers = (sample.match(/[áéíóúâêôãõàç]/gi) || []).length;

  // 英语停用词命中密度：每千字符的命中数（避免长文本累积误判）
  const englishHits = countEnglishStopwords(sample);
  const englishHitsPer1k = sample.length > 0 ? (englishHits * 1000) / sample.length : 0;

  // 母语脚本占比（针对 CJK / 西里尔）
  const nativeRatio = (() => {
    if (totalNonSpace === 0) return 0;
    switch (targetLang) {
      case "ko": return koreanChars / totalNonSpace;
      case "ja": return (japaneseKanaChars + chineseChars) / totalNonSpace;
      case "zh": return chineseChars / totalNonSpace;
      case "ru": return cyrillicChars / totalNonSpace;
      default: return 0;
    }
  })();

  console.log(
    `[validate] lang=${targetLang} lenient=${lenient} sampleLen=${sample.length} ` +
    `latinRatio=${latinRatio.toFixed(2)} nativeRatio=${nativeRatio.toFixed(2)} ` +
    `spMarks=${spanishMarkers} ptMarks=${portugueseMarkers} ` +
    `engHits=${englishHits} engPer1k=${englishHitsPer1k.toFixed(1)} ` +
    `ko=${hasKorean} ja=${hasJapaneseKana} zh=${hasChinese} cyr=${hasCyrillic}`,
  );

  // 对 CJK/俄语：核心校验是"母语脚本占比"，而非英文停用词数量。
  // 技术类文章（游戏/3D/AI）大量保留英文术语（Mod, Guide, 3D, Custom, Asset 等）
  // 是合理的本地化习惯，不应判定为翻译失败。
  // 严格模式（前几次尝试）阈值较高，宽松模式（最后一次重试后）阈值较低，避免整篇发布失败。
  const NATIVE_RATIO_STRICT = 0.5;   // 至少一半字符是母语脚本
  const NATIVE_RATIO_LENIENT = 0.25; // 宽松模式：四分之一以上即可
  const nativeMin = lenient ? NATIVE_RATIO_LENIENT : NATIVE_RATIO_STRICT;

  switch (targetLang) {
    case "ko":
      if (!hasKorean) {
        throw new Error(`目标语言为韩语但输出未包含任何韩文字符${hasJapaneseKana ? "（疑似返回了日语）" : ""}`);
      }
      if (nativeRatio < nativeMin) {
        throw new Error(`目标语言为韩语但韩文字符占比过低（${(nativeRatio * 100).toFixed(0)}% < ${nativeMin * 100}%），疑似大量未翻译`);
      }
      break;
    case "ja":
      if (!hasJapaneseKana && !hasChinese) {
        throw new Error(`目标语言为日语但输出未包含日语假名`);
      }
      if (hasKorean && koreanChars > japaneseKanaChars) {
        throw new Error(`目标语言为日语但输出主要为韩文字符`);
      }
      if (nativeRatio < nativeMin) {
        throw new Error(`目标语言为日语但日文（假名+汉字）占比过低（${(nativeRatio * 100).toFixed(0)}% < ${nativeMin * 100}%），疑似大量未翻译`);
      }
      break;
    case "zh":
      if (!hasChinese) {
        throw new Error(`目标语言为中文但输出未包含中文字符`);
      }
      if ((hasKorean && koreanChars > chineseChars) || (hasJapaneseKana && japaneseKanaChars > chineseChars / 4)) {
        throw new Error(`目标语言为中文但输出大量混入了${hasKorean ? "韩语" : "日语假名"}字符`);
      }
      if (nativeRatio < nativeMin) {
        throw new Error(`目标语言为中文但中文字符占比过低（${(nativeRatio * 100).toFixed(0)}% < ${nativeMin * 100}%），疑似大量未翻译`);
      }
      break;
    case "ru":
      if (!hasCyrillic) {
        throw new Error(`目标语言为俄语但输出未包含西里尔字符`);
      }
      if (nativeRatio < nativeMin) {
        throw new Error(`目标语言为俄语但西里尔字符占比过低（${(nativeRatio * 100).toFixed(0)}% < ${nativeMin * 100}%），疑似大量未翻译`);
      }
      break;
    case "es": {
      if (latinRatio < 0.5) {
        throw new Error(`目标语言为西班牙语但输出未以拉丁字母为主`);
      }
      if (hasChinese || hasKorean || hasJapaneseKana || hasCyrillic) {
        throw new Error(`目标语言为西班牙语但输出混入了非拉丁字符`);
      }
      // 用密度（每千字符英语停用词数）替代绝对计数，避免长文本累积误判
      const engDensityMax = lenient ? 25 : 12;
      if (englishHitsPer1k > engDensityMax && englishHits >= 5) {
        throw new Error(
          `目标语言为西班牙语但输出英文密度过高（每千字符 ${englishHitsPer1k.toFixed(1)} 个英语停用词），疑似未翻译`,
        );
      }
      const spMarkersMin = lenient ? 1 : 2;
      if (sample.length >= 400 && spanishMarkers < spMarkersMin) {
        throw new Error(
          `目标语言为西班牙语但输出几乎不含西语特征字符（á/é/í/ó/ú/ñ/¡/¿ 仅 ${spanishMarkers} 个），疑似未翻译保留了英文`,
        );
      }
      break;
    }
    case "pt": {
      if (latinRatio < 0.5) {
        throw new Error(`目标语言为葡萄牙语但输出未以拉丁字母为主`);
      }
      if (hasChinese || hasKorean || hasJapaneseKana || hasCyrillic) {
        throw new Error(`目标语言为葡萄牙语但输出混入了非拉丁字符`);
      }
      const engDensityMax = lenient ? 25 : 12;
      if (englishHitsPer1k > engDensityMax && englishHits >= 5) {
        throw new Error(
          `目标语言为葡萄牙语但输出英文密度过高（每千字符 ${englishHitsPer1k.toFixed(1)} 个英语停用词），疑似未翻译`,
        );
      }
      const ptMarkersMin = lenient ? 1 : 2;
      if (sample.length >= 400 && portugueseMarkers < ptMarkersMin) {
        throw new Error(
          `目标语言为葡萄牙语但输出几乎不含葡语特征字符（á/é/í/ó/ú/ã/õ/ç 仅 ${portugueseMarkers} 个），疑似未翻译保留了英文`,
        );
      }
      break;
    }
    case "en":
      if (latinRatio < 0.5) {
        throw new Error(`目标语言为英语但输出未以拉丁字母为主`);
      }
      if (hasChinese || hasKorean || hasJapaneseKana || hasCyrillic) {
        throw new Error(`目标语言为英语但输出混入了非拉丁字符`);
      }
      break;
  }
}

/** Rough size estimation for chunking */
function estimateTokens(str: string): number {
  return Math.ceil(str.length / 3);
}

const MAX_CHUNK_TOKENS = 6000;

/**
 * Translate JSON, chunking by top-level components array if content is too large.
 * Strictly follows the custom translate prompt when provided.
 * THROWS on any translation failure — caller must handle.
 */
async function translateJson(jsonData: any, targetLang: string, customSystemPrompt?: string): Promise<any> {
  const llmApiKey = Deno.env.get("CUSTOM_LLM_API_KEY");
  if (!llmApiKey) {
    throw new Error("翻译失败：未配置 CUSTOM_LLM_API_KEY");
  }

  const fullStr = JSON.stringify(jsonData, null, 2);
  const tokens = estimateTokens(fullStr);

  // Small enough → translate in one shot
  if (tokens <= MAX_CHUNK_TOKENS) {
    return await callTranslateApiWithRetry(fullStr, targetLang, llmApiKey, customSystemPrompt);
  }

  // Large content → chunk by top-level keys
  console.log(`Content too large (${tokens} est. tokens), chunking for translation...`);

  if (typeof jsonData !== "object" || jsonData === null || Array.isArray(jsonData)) {
    return await callTranslateApiWithRetry(fullStr, targetLang, llmApiKey, customSystemPrompt);
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
      const translated = await callTranslateApiWithRetry(metaStr, targetLang, llmApiKey, customSystemPrompt);
      Object.assign(result, translated);
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
        const chunkArr = await callTranslateApiWithRetry(
          JSON.stringify(chunk, null, 2),
          targetLang,
          llmApiKey,
          customSystemPrompt,
        );
        translatedComponents.push(...(Array.isArray(chunkArr) ? chunkArr : [chunkArr]));
        chunk = [];
        chunkSize = 0;
      }

      chunk.push(comp);
      chunkSize += compTokens;
    }

    if (chunk.length > 0) {
      const chunkArr = await callTranslateApiWithRetry(
        JSON.stringify(chunk, null, 2),
        targetLang,
        llmApiKey,
        customSystemPrompt,
      );
      translatedComponents.push(...(Array.isArray(chunkArr) ? chunkArr : [chunkArr]));
    }

    result[componentsKey] = translatedComponents;
  }

  return result;
}

const PUBLISH_FN_VERSION = "v9-ensure-slug-2026-04-23";

// 规范化 slug：小写、字母数字 + 连字符
function normalizeSlug(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-_/]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// 从多个来源解析 slug，并保证最终非空（CMS dl_hub/dl_spoke 表 slug 字段 NOT NULL）
function resolveSlug(item: any, translatedData: any): string {
  const candidates: unknown[] = [
    item?.slug,
    translatedData?.slug,
    translatedData?.hubSlug,
    translatedData?.metadata?.slug,
    translatedData?.meta?.slug,
    translatedData?.seo?.slug,
    item?.json_data?.slug,
    item?.json_data?.hubSlug,
  ];
  for (const c of candidates) {
    const s = normalizeSlug(c);
    if (s) return s;
  }
  const fromTitle = normalizeSlug(item?.title);
  if (fromTitle) return fromTitle;
  return `auto-${String(item?.id || "item").slice(0, 8)}`;
}

serve(async (req) => {
  console.log(`[publish-external] ${PUBLISH_FN_VERSION} ${req.method}`);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items, languages, translate_prompt, translate } = await req.json();
    // 默认开启翻译以保持向后兼容；显式传 false 时跳过翻译，按原始 JSON 发布
    const shouldTranslate = translate !== false;

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

    const results: { item_id: string; language: string; success: boolean; error?: string; retryable?: boolean }[] = [];

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
          // 根据开关决定是否翻译；关闭翻译时直接使用原始 JSON 数据
          let translatedData: any;
          if (shouldTranslate) {
            console.log(`[translate] start item=${item.id} lang=${lang} hasPrompt=${!!translate_prompt}`);
            try {
              translatedData = await translateJson(item.json_data, lang, translate_prompt);
              // 健全性校验：翻译结果不能与原文完全一致（除非是英文→英文，但本流程不允许）
              const originalStr = JSON.stringify(item.json_data);
              const translatedStr = JSON.stringify(translatedData);
              if (originalStr === translatedStr) {
                console.warn(`[translate] result identical to source for ${item.id}/${lang} — treating as failure`);
                results.push({
                  item_id: item.id,
                  language: lang,
                  success: false,
                  error: `翻译失败（${lang}）: 大模型返回内容与原文完全一致，未实际翻译`,
                });
                continue;
              }
              console.log(`[translate] success item=${item.id} lang=${lang}`);
            } catch (translateErr) {
              console.error(`[translate] failed item=${item.id} lang=${lang}:`, translateErr);
              results.push({
                item_id: item.id,
                language: lang,
                success: false,
                error: `翻译失败（${lang}）: ${translateErr instanceof Error ? translateErr.message : String(translateErr)}`,
                retryable: !isTranslationAuthOrQuotaError(translateErr),
              });
              continue;
            }
          } else {
            translatedData = item.json_data;
          }

          // 内容健全性检查：避免发布空 components / 空 JSON
          const compArr = Array.isArray((translatedData as any)?.components)
            ? (translatedData as any).components
            : null;
          if (!translatedData || (compArr !== null && compArr.length === 0)) {
            results.push({
              item_id: item.id,
              language: lang,
              success: false,
              error: `内容为空（${sourceType} 无 components 或 json_data 缺失），请先生成 JSON 再发布`,
            });
            continue;
          }

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

          const respText = await resp.text();
          if (!resp.ok) {
            results.push({ item_id: item.id, language: lang, success: false, error: `${resp.status}: ${respText.slice(0, 500)}` });
          } else {
            // 检查 CMS 业务层错误：HTTP 200 但 body 中 code !== 0 / success=false / 含 error 字段
            let bizError: string | null = null;
            let parsedBody: any = null;
            try {
              parsedBody = JSON.parse(respText);
            } catch {
              // 非 JSON 响应当作成功（少数 CMS 直接返回空体）
            }
            if (parsedBody && typeof parsedBody === "object") {
              const code = parsedBody.code;
              const success = parsedBody.success;
              const errMsg = parsedBody.error || parsedBody.message || parsedBody.msg;
              const isCodeFail = typeof code === "number" && code !== 0;
              const isCodeStrFail = typeof code === "string" && code !== "0" && code.toLowerCase() !== "ok" && code.toLowerCase() !== "success";
              const isSuccessFalse = success === false;
              if (isCodeFail || isCodeStrFail || isSuccessFalse) {
                bizError = `CMS 业务错误 code=${code ?? "?"}: ${errMsg || respText.slice(0, 300)}`;
              }
            }
            if (bizError) {
              console.warn(`[publish] biz-fail item=${item.id} lang=${lang} url=${url} body=${respText.slice(0, 500)}`);
              results.push({ item_id: item.id, language: lang, success: false, error: bizError });
            } else {
              console.log(`[publish] success item=${item.id} lang=${lang} url=${url} bodyLen=${respText.length}`);
              results.push({ item_id: item.id, language: lang, success: true });
            }
          }
        } catch (fetchErr) {
          results.push({ item_id: item.id, language: lang, success: false, error: String(fetchErr) });
        }
      }
    }

    const failCount = results.filter((r) => !r.success).length;
    return new Response(
      JSON.stringify({ results, total: results.length, failed: failCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
