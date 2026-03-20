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

export async function createTheme(projectId: string, name: string, description?: string) {
  const { data, error } = await supabase.from("themes").insert({ project_id: projectId, name, description }).select().single();
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

// Full tree for a project
export async function getProjectTree(projectId: string) {
  const themes = await getThemes(projectId);
  const tree = await Promise.all(
    themes.map(async (theme) => {
      const hubs = await getHubs(theme.id);
      const spokes = await getSpokes(theme.id);
      const hubsWithSpokes = hubs.map((hub) => ({
        ...hub,
        spokes: spokes.filter((s) => s.hub_id === hub.id),
      }));
      const unlinkedSpokes = spokes.filter((s) => !s.hub_id);
      return { ...theme, hubs: hubsWithSpokes, unlinkedSpokes };
    })
  );
  return tree;
}
