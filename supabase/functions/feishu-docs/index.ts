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
      // List recent documents from a folder or search
      const folderToken = url.searchParams.get('folder_token') || '';
      const pageSize = url.searchParams.get('page_size') || '50';
      const pageToken = url.searchParams.get('page_token') || '';

      let apiUrl = `https://open.feishu.cn/open-apis/drive/v1/files?page_size=${pageSize}`;
      if (folderToken) apiUrl += `&folder_token=${folderToken}`;
      if (pageToken) apiUrl += `&page_token=${pageToken}`;

      const res = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
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

    if (action === 'extract_agent3_code') {
      const docToken = url.searchParams.get('doc_token');
      if (!docToken) throw new Error('doc_token is required');

      // Fetch all blocks
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

      // Heading block types: 3=h1, 4=h2, 5=h3, 6=h4, 7=h5, 8=h6, 9=h7..
      const headingTypes = [3, 4, 5, 6, 7, 8, 9];
      const headingFields: Record<number, string> = { 3:'heading1', 4:'heading2', 5:'heading3', 6:'heading4', 7:'heading5', 8:'heading6', 9:'heading7' };

      // Find Agent3 heading
      let agent3Index = -1;
      let agent3Level = -1;
      for (let i = 0; i < allBlocks.length; i++) {
        const b = allBlocks[i];
        if (headingTypes.includes(b.block_type)) {
          const field = headingFields[b.block_type];
          const text = extractText(b[field]?.elements);
          if (text.includes('Agent3')) {
            agent3Index = i;
            agent3Level = b.block_type;
            break;
          }
        }
      }

      if (agent3Index === -1) {
        return new Response(JSON.stringify({ code: 0, data: { agent3_found: false, code_blocks: [] } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Collect code blocks (block_type=14) after Agent3 heading until next heading of same/higher level
      const codeBlocks: string[] = [];
      for (let i = agent3Index + 1; i < allBlocks.length; i++) {
        const b = allBlocks[i];
        if (headingTypes.includes(b.block_type) && b.block_type <= agent3Level) {
          break; // next heading of same or higher level
        }
        if (b.block_type === 14) { // code block
          const codeText = extractText(b.code?.body?.elements);
          if (codeText) codeBlocks.push(codeText);
        }
      }

      return new Response(JSON.stringify({ code: 0, data: { agent3_found: true, code_blocks: codeBlocks } }), {
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
