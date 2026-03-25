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
  "hubSlug": "所属hub的slug（必须与主题名称完全一致）",
  "type": "spoke",
  "title": "页面主标题（含目标关键词）",
  "description": "页面描述文案",
  "meta": {
    "title": "SEO标题 | 深度指南",
    "description": "160字符以内的SEO描述",
    "keywords": ["关键词1", "关键词2", "关键词3"],
    "ogImage": ""
  },
  "breadcrumb": [
    { "label": "首页", "url": "/" },
    { "label": "Hub名称", "url": "/hub-slug" },
    { "label": "当前页面标题", "url": "/hub-slug/spoke-slug" }
  ],
  "components": [
    // 组件数组，按页面结构顺序排列（见下方组件说明）
  ]
}

## 可用组件类型（在 components 数组中使用）

每个组件格式: { "id": "唯一ID", "type": "组件类型", "props": { ... } }

1. **articleHeader** — 文章头部（Spoke必需，放在首位）
   props: {
     "title": "文章标题",
     "subtitle": "分类标签描述",
     "author": { "name": "Tripo 团队", "avatar": "" },
     "coverImage": "封面图片URL",
     "publishDate": "YYYY-MM-DD",
     "readTime": "预计阅读时间",
     "tags": ["标签1", "标签2"]
   }

2. **contentBlock** — Markdown正文内容块（承载所有主体内容，包括FAQ）
   props: {
     "content": "完整的Markdown格式正文"
   }
   说明：
   - 使用一个大的 contentBlock 承载全部正文内容
   - 正文中使用 Markdown 格式组织内容结构：## 标题、### 子标题、段落、列表、表格、图片等
   - FAQ 部分也直接写在 contentBlock 的 Markdown 中，使用 ### 编号问题格式
   - 图片使用 Markdown 图片语法 ![alt](url)
   - 表格使用 Markdown 表格语法
   - 使用 --- 分隔不同章节

3. **ctaBanner** — 行动号召横幅（放在末尾）
   props: {
     "title": "号召文案",
     "backgroundImage": "背景图URL（可选）",
     "primaryCta": { "text": "按钮文字", "url": "链接URL" }
   }

## 生成要求
1. 内容基于飞书文档原文，不要凭空编造
2. 第一个组件必须是 articleHeader
3. 第二个组件是一个大的 contentBlock，用 Markdown 格式承载所有正文内容
4. contentBlock 中的内容结构应包含：核心洞察概要、各章节详细内容、数据表格（如有）、FAQ问答
5. FAQ 直接嵌入 contentBlock 的 Markdown 中，使用 "## FAQ" 和 "### 1. 问题" 的格式
6. 最后一个组件是 ctaBanner
7. 整个 components 数组通常只有 3 个组件：articleHeader + contentBlock + ctaBanner
8. 只输出合法JSON，不要附加说明文字
9. 如果补充上下文中包含"已有 Spoke JSON"，则必须沿用其结构（组件类型、组件数量、字段格式），仅根据新的飞书文档内容更新具体文案和数据；如用户在补充内容中有特殊结构要求则按用户要求调整`;

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
   props: {
     "title": "页面主标题",
     "subtitle": "副标题描述文案",
     "backgroundImage": "背景图URL（可选）",
     "cta": { "text": "按钮文字", "url": "链接URL", "variant": "primary"|"secondary" }
   }

2. **overview** — 概述（推荐放在hero之后）
   props: {
     "title": "概述标题",
     "subtitle": "副标题",
     "description": "详细描述文案",
     "subItems": [
       { "label": "分项标题", "description": "分项描述", "icon": "图标URL（可选）" }
     ]
   }

3. **tocNav** — 页面导航（推荐放在overview之后）
   props: {
     "title": "导航标题",
     "items": [
       { "name": "分类名称", "url": "/hub-slug#组件id", "description": "分类描述" }
     ]
   }

4. **categoryCards** — 分类卡片（展示Spoke入口，可多次使用）
   props: {
     "title": "分类标题",
     "subtitle": "分类副标题",
     "sub": {
       "label": "学习目标标签",
       "items": ["学习目标1", "学习目标2"]
     },
     "layout": "grid"|"list",
     "columns": 2|3|4,
     "cards": [
       {
         "title": "卡片标题",
         "description": "卡片描述",
         "link": "/spoke-url-path",
         "tag": "标签（可选）",
         "icon": "图标URL（可选）"
       }
     ]
   }

5. **videoSection** — 视频列表
   props: {
     "title": "视频区标题",
     "subtitle": "视频区副标题（可选）",
     "layout": "grid"|"carousel",
     "videos": [
       {
         "thumbnail": "视频缩略图URL",
         "title": "视频标题",
         "duration": "时长",
         "youtubeId": "YouTube视频ID（可选）",
         "link": "视频链接URL"
       }
     ]
   }

6. **faq** — 常见问题
   props: {
     "title": "FAQ标题",
     "defaultExpanded": false,
     "items": [
       { "question": "问题", "answer": "详细回答" }
     ]
   }

7. **ctaBanner** — 行动号召横幅（放在末尾）
   props: {
     "title": "号召文案",
     "backgroundImage": "背景图URL（可选）",
     "primaryCta": { "text": "按钮文字", "url": "链接URL" }
   }

8. **tipBox** — 提示框（可选）
   props: { "variant": "info"|"success"|"warning"|"error", "icon": "lightbulb"|"check"|"alert"|"error", "title": "标题（可选）", "content": "纯文本" }

9. **tutorialList** — 教程列表（可选）
   props: { "title": "标题", "subtitle": "副标题（可选）", "sub": { "label": "标签", "items": ["目标1"] }, "layout": "grid"|"list", "tutorials": [{ "icon": "图标URL（可选）", "title": "教程标题", "description": "描述", "duration": "时长（可选）", "difficulty": "难度（可选）", "link": "链接", "tag": "标签（可选）" }] }

10. **downloadSection** — 下载区（可选）
    props: { "name": "名称", "description": "描述（可选）", "hubLabel": "标签（可选）", "columns": 2|3|4, "plugins": [{ "tags": ["标签"], "imageUrl": "图片URL", "title": "标题", "description": "描述", "level": "级别", "downloadText": "下载文字", "downloadUrl": "下载URL" }] }

## 生成要求
1. 内容基于提供的 Spoke 数据综合归纳
2. 第一个组件必须是 hero，包含 title、subtitle、backgroundImage 和 cta
3. hero 之后推荐添加 overview 概述全局，再添加 tocNav 提供页面内锚点导航
4. 使用多个 categoryCards 按主题分类展示各 Spoke 页面入口，每个 categoryCards 包含 sub 字段说明学习目标
5. categoryCards 的 cards 中每个卡片的 link 指向对应 Spoke 页面路径
6. 可选添加 videoSection 展示视频教程
7. 末尾依次添加 faq（包含 10+ 条高质量问答）和 ctaBanner
8. relatedHubs 列出 2-3 个相关主题Hub
9. tocNav 的 items 中 url 使用 "/hub-slug#组件id" 格式指向页面内锚点
10. 只输出合法JSON，不要附加说明文字`;

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
