import { supabase } from "@/integrations/supabase/client";

/**
 * 调用 generate-json edge function 生成 Spoke 或 Hub JSON
 */
export async function generateJson(params: {
  type: "spoke" | "hub";
  feishu_content?: string;
  custom_prompt?: string;
  context?: string;
}): Promise<{ generated_json: any; prompt_used?: string; raw_content?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke("generate-json", {
    body: params,
  });

  if (error) throw new Error(error.message || "调用生成函数失败");
  if (data?.error) throw new Error(data.error);
  return data;
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
