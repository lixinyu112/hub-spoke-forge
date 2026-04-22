import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getTenantAccessToken(): Promise<string> {
  const appId = Deno.env.get('FEISHU_APP_ID');
  const appSecret = Deno.env.get('FEISHU_APP_SECRET');
  if (!appId || !appSecret) throw new Error('Missing Feishu credentials');

  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Feishu auth failed: ${data.msg}`);
  return data.tenant_access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const token = await getTenantAccessToken();

    if (action === 'list_docs') {
      const folderToken = url.searchParams.get('folder_token') || '';
      const pageSize = url.searchParams.get('page_size') || '50';

      // Paginate to fetch ALL documents
      let allFiles: any[] = [];
      let pageToken = '';
      let hasMore = true;
      while (hasMore) {
        let apiUrl = `https://open.feishu.cn/open-apis/drive/v1/files?page_size=${pageSize}`;
        if (folderToken) apiUrl += `&folder_token=${folderToken}`;
        if (pageToken) apiUrl += `&page_token=${pageToken}`;

        const res = await fetch(apiUrl, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.code !== 0) {
          // Surface a structured, user-friendly error (esp. 1061004 forbidden)
          const isForbidden = data.code === 1061004 || /forbidden/i.test(data.msg || '');
          const friendlyMsg = isForbidden
            ? `飞书应用无权访问此文件夹（folder_token=${folderToken}）。请在飞书云空间中将应用添加为该文件夹的协作者（可编辑/可查看），或检查 token 是否正确。原始错误: ${data.msg || 'forbidden'}`
            : `飞书 API 返回错误 code=${data.code}: ${data.msg || 'unknown error'}`;
          console.error('list_docs failed:', JSON.stringify(data));
          return new Response(JSON.stringify({
            code: data.code,
            error: friendlyMsg,
            feishu_raw: data,
            data: { files: [], total: 0 },
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        allFiles = allFiles.concat(data.data?.files || []);
        hasMore = !!data.data?.has_more;
        pageToken = data.data?.page_token || data.data?.next_page_token || '';
        console.log(`list_docs: fetched ${allFiles.length} files so far, has_more=${hasMore}, page_token=${pageToken}, keys=${JSON.stringify(Object.keys(data.data || {}))}`);
      }

      console.log(`list_docs: total files fetched = ${allFiles.length}`);
      return new Response(JSON.stringify({ code: 0, data: { files: allFiles, total: allFiles.length } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'search_docs') {
      const query = url.searchParams.get('query') || '';
      const res = await fetch('https://open.feishu.cn/open-apis/suite/docs-api/search/object', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          search_key: query,
          count: 50,
          offset: 0,
          owner_ids: [],
          docs_types: [1, 2, 3, 7, 8, 9, 11, 12, 15, 16, 22],
        }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_doc_content') {
      const docToken = url.searchParams.get('doc_token');
      const docType = url.searchParams.get('doc_type') || 'docx';
      if (!docToken) throw new Error('doc_token is required');

      let apiUrl: string;
      if (docType === 'docx') {
        apiUrl = `https://open.feishu.cn/open-apis/docx/v1/documents/${docToken}/raw_content`;
      } else {
        apiUrl = `https://open.feishu.cn/open-apis/doc/v2/${docToken}/raw_content`;
      }

      const res = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_doc_blocks') {
      const docToken = url.searchParams.get('doc_token');
      if (!docToken) throw new Error('doc_token is required');

      // Fetch all blocks with pagination
      let allBlocks: any[] = [];
      let pageToken = '';
      do {
        let apiUrl = `https://open.feishu.cn/open-apis/docx/v1/documents/${docToken}/blocks?page_size=500`;
        if (pageToken) apiUrl += `&page_token=${pageToken}`;
        const res = await fetch(apiUrl, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.code !== 0) throw new Error(`Feishu blocks API error: ${data.msg}`);
        allBlocks = allBlocks.concat(data.data?.items || []);
        pageToken = data.data?.page_token || '';
      } while (pageToken);

      return new Response(JSON.stringify({ code: 0, data: { blocks: allBlocks } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'extract_first_code') {
      const docToken = url.searchParams.get('doc_token');
      if (!docToken) throw new Error('doc_token is required');

      // Fetch all blocks with pagination
      let allBlocks: any[] = [];
      let pageToken = '';
      do {
        let apiUrl = `https://open.feishu.cn/open-apis/docx/v1/documents/${docToken}/blocks?page_size=500`;
        if (pageToken) apiUrl += `&page_token=${pageToken}`;
        const res = await fetch(apiUrl, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.code !== 0) throw new Error(`Feishu blocks API error: ${data.msg}`);
        allBlocks = allBlocks.concat(data.data?.items || []);
        pageToken = data.data?.page_token || '';
      } while (pageToken);

      // Helper: extract text from elements array
      const extractText = (elements: any[]): string => {
        if (!elements) return '';
        return elements.map((el: any) => el?.text_run?.content || '').join('');
      };

      // Find the first code block (block_type=14)
      let codeContent = '';
      for (const b of allBlocks) {
        if (b.block_type === 14) {
          codeContent = extractText(b.code?.elements || b.code?.body?.elements);
          if (codeContent) break;
        }
      }

      return new Response(JSON.stringify({ code: 0, data: { found: !!codeContent, code_content: codeContent } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action. Use: list_docs, search_docs, get_doc_content, get_doc_blocks, extract_agent3_code' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Feishu API error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
