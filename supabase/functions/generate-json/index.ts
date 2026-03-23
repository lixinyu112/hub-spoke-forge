import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============================================================
// 【配置项修改位置】Spoke / Hub JSON 规范 prompt
// ============================================================
const SPOKE_SCHEMA_PROMPT = `你是一个 SEO 内容专家。请根据提供的飞书文档内容，生成一个符合以下 JSON Schema 的 Spoke 页面 JSON：
{
  "type": "spoke",
  "title": "页面标题（含目标关键词）",
  "slug": "/url-friendly-slug",
  "meta_description": "160字符以内的页面描述",
  "sections": [
    { "heading": "章节标题", "body": "章节正文内容" }
  ],
  "faq": [
    { "question": "常见问题", "answer": "回答" }
  ],
  "cta": { "text": "行动号召按钮文案", "url": "#" }
}
请确保：
1. 内容基于飞书文档原文，不要凭空编造
2. 合理拆分为3-6个章节
3. 生成2-4个FAQ
4. 只输出合法JSON，不要附加说明文字`;

const HUB_SCHEMA_PROMPT = `你是一个 SEO 内容专家。请根据提供的 Spoke 页面数据和补充上下文，生成一个符合以下 JSON Schema 的 Hub 聚合页面 JSON：
{
  "type": "hub",
  "title": "Hub 页面标题",
  "slug": "/hub-url-slug",
  "meta_description": "160字符以内的页面描述",
  "introduction": "Hub 页面简介段落",
  "spoke_links": [
    { "title": "Spoke标题", "slug": "/spoke-slug", "summary": "一句话摘要" }
  ],
  "cta": { "text": "行动号召按钮文案", "url": "#" }
}
请确保：
1. 内容基于提供的 Spoke 数据综合归纳
2. introduction 段落概括全局主题
3. 每个 spoke_link 都有简明的 summary
4. 只输出合法JSON，不要附加说明文字`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, feishu_content, custom_prompt, context } = await req.json();

    if (!type || !['spoke', 'hub'].includes(type)) {
      return new Response(JSON.stringify({ error: 'type must be "spoke" or "hub"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the system prompt
    const schemaPrompt = type === 'spoke' ? SPOKE_SCHEMA_PROMPT : HUB_SCHEMA_PROMPT;
    const systemPrompt = custom_prompt
      ? `${custom_prompt}\n\n${schemaPrompt}`
      : schemaPrompt;

    // Build user message
    let userMessage = '';
    if (type === 'spoke') {
      userMessage = `以下是飞书文档内容，请据此生成 Spoke JSON：\n\n${feishu_content || '（无飞书文档内容，请根据上下文生成示例）'}`;
      if (context) userMessage += `\n\n补充上下文：${context}`;
    } else {
      userMessage = `以下是相关的 Spoke 数据和上下文，请据此生成 Hub JSON：\n\n${feishu_content || '（无Spoke数据）'}`;
      if (context) userMessage += `\n\n补充上下文：${context}`;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: '请求频率超限，请稍后重试' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI 额度已用完，请充值' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      return new Response(JSON.stringify({ error: `AI 调用失败: ${response.status}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResult = await response.json();
    let content = aiResult.choices?.[0]?.message?.content || '';

    // Strip markdown code fences if present
    content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    // Try to parse as JSON
    let parsedJson;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      // Return raw content if not valid JSON
      return new Response(JSON.stringify({
        generated_json: null,
        raw_content: content,
        error: 'AI 返回的内容不是合法 JSON',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      generated_json: parsedJson,
      prompt_used: systemPrompt,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('generate-json error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
