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

    return new Response(JSON.stringify({ error: 'Unknown action. Use: list_docs, search_docs, get_doc_content' }), {
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
