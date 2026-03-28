import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Theme = Tables<"themes">;
export type Hub = Tables<"hubs">;
export type Spoke = Tables<"spokes">;
export type ComponentSpec = Tables<"component_specs">;

// Themes
export async function getThemes(projectId: string) {
  const { data, error } = await supabase.from("themes").select("*").eq("project_id", projectId).order("created_at");
  if (error) throw error;
  return data;
}

export async function createTheme(projectId: string, name: string, description?: string, feishuDocToken?: string) {
  const insertData: any = { project_id: projectId, name, description };
  if (feishuDocToken) insertData.feishu_doc_token = feishuDocToken;
  const { data, error } = await supabase.from("themes").insert(insertData).select().single();
  if (error) throw error;
  return data;
}

export async function updateTheme(id: string, updates: { name?: string; description?: string; feishu_doc_token?: string }) {
  const { data, error } = await supabase.from("themes").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

// Hubs
export async function getHubs(themeId: string) {
  const { data, error } = await supabase.from("hubs").select("*").eq("theme_id", themeId).order("created_at");
  if (error) throw error;
  return data;
}

export async function createHub(hub: TablesInsert<"hubs">) {
  const { data, error } = await supabase.from("hubs").insert(hub).select().single();
  if (error) throw error;
  return data;
}

export async function updateHub(id: string, updates: Partial<TablesInsert<"hubs">>) {
  const { data, error } = await supabase.from("hubs").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function findHubByTheme(themeId: string) {
  const { data, error } = await supabase
    .from("hubs")
    .select("*")
    .eq("theme_id", themeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Spokes
export async function getSpokes(themeId: string) {
  const { data, error } = await supabase.from("spokes").select("*").eq("theme_id", themeId).order("created_at");
  if (error) throw error;
  return data;
}

export async function getSpokesByHub(hubId: string) {
  const { data, error } = await supabase.from("spokes").select("*").eq("hub_id", hubId).order("created_at");
  if (error) throw error;
  return data;
}

export async function createSpoke(spoke: TablesInsert<"spokes">) {
  const { data, error } = await supabase.from("spokes").insert(spoke).select().single();
  if (error) throw error;
  return data;
}

export async function updateSpoke(id: string, updates: Partial<TablesInsert<"spokes">>) {
  const { data, error } = await supabase.from("spokes").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function findSpokeByFeishuToken(themeId: string, feishuDocToken: string) {
  const { data, error } = await supabase
    .from("spokes")
    .select("*")
    .eq("theme_id", themeId)
    .eq("feishu_doc_token", feishuDocToken)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertSpoke(themeId: string, feishuDocToken: string | null, spokeData: Omit<TablesInsert<"spokes">, "theme_id">) {
  if (feishuDocToken) {
    const existing = await findSpokeByFeishuToken(themeId, feishuDocToken);
    if (existing) {
      return updateSpoke(existing.id, { ...spokeData, theme_id: themeId });
    }
  }
  return createSpoke({ ...spokeData, theme_id: themeId });
}

// Component Specs
export async function getComponentSpecs(projectId: string) {
  const { data, error } = await supabase.from("component_specs").select("*").eq("project_id", projectId).order("created_at");
  if (error) throw error;
  return data;
}

export async function createComponentSpec(spec: TablesInsert<"component_specs">) {
  const { data, error } = await supabase.from("component_specs").insert(spec).select().single();
  if (error) throw error;
  return data;
}

export async function deleteComponentSpec(id: string) {
  const { error } = await supabase.from("component_specs").delete().eq("id", id);
  if (error) throw error;
}

// Component Specs with theme support (uses REST API to bypass TypeScript type constraints)
export async function getComponentSpecsByTheme(projectId: string, themeId: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(
    `${supabaseUrl}/rest/v1/component_specs?project_id=eq.${projectId}&theme_id=eq.${themeId}&order=created_at.asc`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
  );
  if (!res.ok) throw new Error("Failed to load component specs");
  return res.json();
}

export async function upsertComponentSpecByTheme(spec: {
  project_id: string; theme_id: string; name: string; type: string; json_schema?: any;
}) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  // Check existing
  const checkRes = await fetch(
    `${supabaseUrl}/rest/v1/component_specs?project_id=eq.${spec.project_id}&theme_id=eq.${spec.theme_id}&type=eq.${spec.type}&limit=1`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
  );
  const existing = await checkRes.json();
  if (existing.length > 0) {
    const res = await fetch(`${supabaseUrl}/rest/v1/component_specs?id=eq.${existing[0].id}`, {
      method: "PATCH",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ json_schema: spec.json_schema, name: spec.name }),
    });
    if (!res.ok) throw new Error("Failed to update component spec");
    return (await res.json())[0];
  }
  const res = await fetch(`${supabaseUrl}/rest/v1/component_specs`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(spec),
  });
  if (!res.ok) throw new Error("Failed to create component spec");
  return (await res.json())[0];
}

// Full tree for a project (with publish times, all spokes under single hub)
export async function getProjectTree(projectId: string) {
  const themes = await getThemes(projectId);

  // Get latest publication dates
  const { data: pubs } = await supabase
    .from("publications")
    .select("source_id, published_at")
    .eq("project_id", projectId)
    .order("published_at", { ascending: false });

  const pubMap = new Map<string, string>();
  for (const p of (pubs || [])) {
    if (!pubMap.has(p.source_id)) pubMap.set(p.source_id, p.published_at);
  }

  const tree = await Promise.all(
    themes.map(async (theme) => {
      const hubs = await getHubs(theme.id);
      const spokes = await getSpokes(theme.id);

      const allSpokesWithPub = spokes.map((s) => ({
        ...s,
        published_at: pubMap.get(s.id) || null,
      }));

      // Single hub per theme, all spokes go under hub
      const hub = hubs.length > 0 ? hubs[0] : null;
      return {
        ...theme,
        hubs: hub
          ? [{
              ...hub,
              published_at: pubMap.get(hub.id) || null,
              spokes: allSpokesWithPub,
            }]
          : [],
        unlinkedSpokes: hub ? [] : allSpokesWithPub,
      };
    })
  );
  return tree;
}

// Publications
export async function getPublications(projectId: string) {
  const { data, error } = await supabase.from("publications").select("*").eq("project_id", projectId).order("published_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPublication(pub: TablesInsert<"publications">) {
  const { data, error } = await supabase.from("publications").insert(pub).select().single();
  if (error) throw error;
  return data;
}

export async function createPublicationsBatch(pubs: TablesInsert<"publications">[]) {
  const { data, error } = await supabase.from("publications").insert(pubs).select();
  if (error) throw error;
  return data;
}

// Documents
export async function getDocuments(projectId: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(`${supabaseUrl}/rest/v1/documents?project_id=eq.${projectId}&order=created_at.asc`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) throw new Error("Failed to load documents");
  return res.json();
}

export async function createDocument(doc: { project_id: string; token: string; name: string; type: string; content?: string }) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(`${supabaseUrl}/rest/v1/documents`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(doc),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`创建文档失败: ${err}`);
  }
  return (await res.json())[0];
}

export async function updateDocument(projectId: string, token: string, updates: { name?: string; content?: string }) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(`${supabaseUrl}/rest/v1/documents?project_id=eq.${projectId}&token=eq.${token}`, {
    method: "PATCH",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`更新文档失败: ${err}`);
  }
  return (await res.json())[0];
}
