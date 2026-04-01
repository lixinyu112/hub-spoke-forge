import { supabase } from "@/integrations/supabase/client";

type GenerateJsonParams = {
  type: "spoke" | "hub";
  feishu_content?: string;
  custom_prompt?: string;
  context?: string;
};

type GenerateJsonResponse = {
  generated_json: any;
  prompt_used?: string;
  raw_content?: string;
  error?: string;
};

const INVALID_JSON_ERROR = "AI 返回的内容不是合法 JSON";

function repairAndParseJson(text: string): any | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();

  const first = cleaned.search(/[\[{]/);
  if (first === -1) return null;
  const open = cleaned[first];
  const close = open === "[" ? "]" : "}";
  const last = cleaned.lastIndexOf(close);
  if (last === -1) return null;

  let candidate = cleaned.slice(first, last + 1);

  const tryParse = (input: string) => {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  };

  const parsedDirect = tryParse(candidate);
  if (parsedDirect !== null) return parsedDirect;

  candidate = candidate
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]")
    .replace(/\uFEFF/g, "")
    .trim();

  const parsedRepaired = tryParse(candidate);
  if (parsedRepaired !== null) return parsedRepaired;

  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (const ch of candidate) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") openBraces++;
    if (ch === "}") openBraces--;
    if (ch === "[") openBrackets++;
    if (ch === "]") openBrackets--;
  }

  let closed = candidate.replace(/,\s*$/, "");
  if (inString) closed += '"';
  for (let i = 0; i < Math.max(0, openBrackets); i++) closed += "]";
  for (let i = 0; i < Math.max(0, openBraces); i++) closed += "}";

  return tryParse(closed);
}

async function invokeGenerateJson(body: GenerateJsonParams): Promise<GenerateJsonResponse> {
  const { data, error } = await supabase.functions.invoke("generate-json", { body });
  if (error) throw new Error(error.message || "调用生成函数失败");
  return (data || {}) as GenerateJsonResponse;
}

/**
 * 调用 generate-json edge function 生成 Spoke 或 Hub JSON
 */
export async function generateJson(params: GenerateJsonParams): Promise<GenerateJsonResponse> {
  const primary = await invokeGenerateJson(params);
  if (primary?.generated_json) return primary;

  if (primary?.raw_content) {
    const recovered = repairAndParseJson(primary.raw_content);
    if (recovered !== null) {
      return { ...primary, generated_json: recovered, error: undefined };
    }
  }

  const shouldRetryWithTrimmedContent =
    primary?.error === INVALID_JSON_ERROR &&
    params.type === "spoke" &&
    typeof params.feishu_content === "string" &&
    params.feishu_content.length > 16000;

  if (shouldRetryWithTrimmedContent) {
    const retry = await invokeGenerateJson({
      ...params,
      feishu_content: params.feishu_content!.slice(0, 16000),
      custom_prompt: `${params.custom_prompt || ""}\n\n【输出要求】只返回合法 JSON，不要 markdown，不要解释；若正文过长请精简 contentBlock 文案但保持字段完整。`,
    });

    if (retry?.generated_json) return retry;
    if (retry?.raw_content) {
      const recoveredRetry = repairAndParseJson(retry.raw_content);
      if (recoveredRetry !== null) {
        return { ...retry, generated_json: recoveredRetry, error: undefined };
      }
    }

    if (retry?.error) throw new Error(retry.error);
  }

  if (primary?.error) throw new Error(primary.error);
  throw new Error("生成结果为空");
}

/**
 * 保存生成记录到 json_records 表
 */
export async function saveJsonRecord(record: {
  type: string;
  feishu_content?: string;
  prompt_content?: string;
  generated_json?: any;
}) {
  // Use raw fetch since json_records is not in the generated types yet
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const res = await fetch(`${supabaseUrl}/rest/v1/json_records`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(record),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`保存记录失败: ${errBody}`);
  }
  return res.json();
}
