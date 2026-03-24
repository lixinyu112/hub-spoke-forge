import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============================================================
// 【配置项修改位置】Tripo_Schema — Spoke / Hub JSON 规范 prompt
// 基于 Tripo3D Hub-Spoke 内容系统 API 与组件规范
// ============================================================
const SPOKE_SCHEMA_PROMPT = `你是一个 SEO 内容专家。请根据提供的飞书文档内容，生成一个符合 Tripo3D Spoke 页面规范的 JSON。

## Spoke 页面 JSON Schema

{
  "slug": "spoke-url-slug",
  "hubSlug": "所属hub的slug",
  "type": "spoke",
  "title": "页面主标题（含目标关键词）",
  "description": "页面描述文案",
  "meta": {
    "title": "SEO标题 | Tripo3D",
    "description": "160字符以内的SEO描述",
    "keywords": ["关键词1", "关键词2"],
    "ogImage": "OG图片URL（可选）"
  },
  "breadcrumb": [
    { "label": "首页", "url": "/" },
    { "label": "Hub名称", "url": "/hub-slug" },
    { "label": "当前页面", "url": "/hub-slug/spoke-slug" }
  ],
  "components": [
    // 组件数组，按页面结构顺序排列
  ],
  "nextSpoke": { "title": "下一篇标题", "url": "/path", "thumbnail": "缩略图URL" },
  "previousSpoke": { "title": "上一篇标题", "url": "/path", "thumbnail": "缩略图URL" },
  "lastUpdated": "ISO 8601时间"
}

## 可用组件类型（在 components 数组中使用）

每个组件格式: { "id": "唯一ID", "type": "组件类型", "props": { ... } }

1. **articleHeader** — 文章头部（Spoke必需，放在首位）
   props: { title, subtitle?, author?: { name, avatar?, url? }, publishDate, updateDate?, readTime, coverImage?, tags?: string[], difficulty?: "入门"|"中级"|"高级" }

2. **contentBlock** — Markdown正文内容块
   props: { content: "Markdown格式正文" }

3. **imageGallery** — 图片画廊
   props: { title?, images: [{ src, alt, caption? }], columns?: 2|3|4, lightbox?: boolean, studioModelUrl?: string }

4. **tipBox** — 提示框
   props: { variant: "info"|"success"|"warning"|"error", icon?: "lightbulb"|"check"|"alert"|"error", title?, content: "纯文本内容" }

5. **codeBlock** — 代码块
   props: { title?, language: string, code: string, showLineNumbers?: boolean, highlightLines?: number[] }

6. **stepByStep** — 步骤指南
   props: { title, steps: [{ number, title, description, image? }], layout?: "vertical"|"horizontal" }

7. **videoEmbed** — 视频嵌入
   props: { title?, youtubeId?, bilibiliId?, videoUrl?, thumbnail?, duration?, autoplay?: boolean, aspectRatio?: "16:9"|"4:3"|"1:1" }

8. **faq** — 常见问题
   props: { title, items: [{ question, answer }], defaultExpanded?: boolean }

9. **relatedLinks** — 相关链接
   props: { title, links: [{ title, url, description?, thumbnail?, tag?, external?: boolean }], layout?: "list"|"cards", maxItems?: number }

10. **downloadSection** — 下载区
    props: { name, description?, hubLabel?, columns?: 2|3|4, plugins: [{ tags?: string[], imageUrl, title?, description?, level: "Intermediate"|"Advanced", downloadText?, downloadUrl, downloadIconUrl? }] }

11. **videoSection** — 视频列表
    props: { title, subtitle?, videos: [{ thumbnail, title, duration, youtubeId?, link }], layout?: "grid"|"carousel" }

12. **ctaBanner** — 行动号召横幅
    props: { title, subtitle?, primaryCta: { text, url }, secondaryCta?: { text, url }, backgroundImage?, backgroundColor?, variant?: "default"|"gradient"|"dark" }

13. **categoryCards** — 分类卡片
    props: { title?, subtitle?, sub?: { label, items: string[] }, cards: [{ icon?, title, description, link, tag? }], layout?: "grid"|"list", columns?: 2|3|4 }

14. **overview** — 概述
    props: { title, subtitle?, description, subItems: [{ label, description, icon? }] }

15. **tocNav** — 页面导航
    props: { title, items: [{ name, url, description? }] }

## 生成要求
1. 内容基于飞书文档原文，不要凭空编造
2. 第一个组件必须是 articleHeader
3. 使用 contentBlock 承载主要正文（Markdown格式）
4. 合理穿插 tipBox、imageGallery、codeBlock、stepByStep 等组件丰富页面
5. 末尾添加 relatedLinks 和/或 ctaBanner
6. 生成2-4个FAQ（使用 faq 组件）
7. 只输出合法JSON，不要附加说明文字`;

const HUB_SCHEMA_PROMPT = `你是一个 SEO 内容专家。请根据提供的 Spoke 页面数据和补充上下文，生成一个符合 Tripo3D Hub 聚合页面规范的 JSON。

## Hub 页面 JSON Schema

{
  "slug": "hub-url-slug",
  "type": "hub",
  "title": "Hub 页面主标题",
  "description": "Hub 页面描述",
  "meta": {
    "title": "SEO标题 | Tripo3D",
    "description": "160字符以内的SEO描述",
    "keywords": ["关键词1", "关键词2"],
    "ogImage": "OG图片URL（可选）"
  },
  "breadcrumb": [
    { "label": "首页", "url": "/" },
    { "label": "当前Hub", "url": "/hub-slug" }
  ],
  "components": [
    // 组件数组，按页面结构顺序排列
  ],
  "relatedHubs": [
    { "title": "相关Hub标题", "slug": "hub-slug", "description": "简短描述", "thumbnail": "缩略图URL" }
  ],
  "lastUpdated": "ISO 8601时间"
}

## 可用组件类型（在 components 数组中使用）

每个组件格式: { "id": "唯一ID", "type": "组件类型", "props": { ... } }

1. **hero** — 页面顶部横幅（Hub必需，放在首位）
   props: { title, description, backgroundImage?, backgroundColor?, cta?: { text, url, variant: "primary"|"secondary" } }

2. **categoryCards** — 分类卡片（展示Spoke入口）
   props: { title?, subtitle?, sub?: { label, items: string[] }, cards: [{ icon?, title, description, link, tag? }], layout?: "grid"|"list", columns?: 2|3|4 }

3. **tutorialList** — 教程列表
   props: { title, subtitle?, sub?: { label, items: string[] }, layout?: "grid"|"list", tutorials: [{ icon?, title, description, duration?, difficulty?, link, tag? }] }

4. **videoSection** — 视频列表
   props: { title, subtitle?, videos: [{ thumbnail, title, duration, youtubeId?, link }], layout?: "grid"|"carousel" }

5. **tipBox** — 提示框
   props: { variant: "info"|"success"|"warning"|"error", icon?: "lightbulb"|"check"|"alert"|"error", title?, content: "纯文本" }

6. **faq** — 常见问题
   props: { title, items: [{ question, answer }], defaultExpanded?: boolean }

7. **ctaBanner** — 行动号召横幅
   props: { title, subtitle?, primaryCta: { text, url }, secondaryCta?: { text, url }, backgroundImage?, backgroundColor?, variant?: "default"|"gradient"|"dark" }

8. **overview** — 概述
   props: { title, subtitle?, description, subItems: [{ label, description, icon? }] }

9. **tocNav** — 页面导航
   props: { title, items: [{ name, url, description? }] }

10. **downloadSection** — 下载区
    props: { name, description?, hubLabel?, columns?: 2|3|4, plugins: [{ tags?: string[], imageUrl, title?, description?, level, downloadText?, downloadUrl }] }

## 生成要求
1. 内容基于提供的 Spoke 数据综合归纳
2. 第一个组件必须是 hero
3. 使用 categoryCards 展示各 Spoke 页面入口
4. 可选添加 tutorialList、videoSection、overview、tocNav 丰富页面
5. 末尾添加 faq 和 ctaBanner
6. relatedHubs 列出相关主题Hub
7. 只输出合法JSON，不要附加说明文字`;

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

    const API_KEY = Deno.env.get('CUSTOM_LLM_API_KEY');
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: 'CUSTOM_LLM_API_KEY not configured' }), {
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

    const response = await fetch('https://api.babelark.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-3.1-flash-lite-preview',
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
