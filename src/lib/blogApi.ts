import { supabase } from "@/integrations/supabase/client";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const headers = () => ({
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  "Content-Type": "application/json",
});

export interface BlogGroup {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPost {
  id: string;
  project_id: string;
  group_id: string | null;
  title: string;
  slug: string | null;
  original_filename: string | null;
  json_data: any;
  status: string;
  created_at: string;
  updated_at: string;
}

// Blog Groups
export async function getBlogGroups(projectId: string): Promise<BlogGroup[]> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/blog_groups?project_id=eq.${projectId}&order=created_at.asc`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
  );
  if (!res.ok) throw new Error("Failed to load blog groups");
  return res.json();
}

export async function createBlogGroup(projectId: string, name: string, description?: string): Promise<BlogGroup> {
  const res = await fetch(`${supabaseUrl}/rest/v1/blog_groups`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify({ project_id: projectId, name, description: description || null }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`创建分组失败: ${err}`);
  }
  return (await res.json())[0];
}

export async function deleteBlogGroup(id: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/blog_groups?id=eq.${id}`, {
    method: "DELETE",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) throw new Error("删除分组失败");
}

// Blog Posts
export async function getBlogPosts(projectId: string, groupId?: string): Promise<BlogPost[]> {
  let url = `${supabaseUrl}/rest/v1/blog_posts?project_id=eq.${projectId}&order=created_at.desc`;
  if (groupId) url += `&group_id=eq.${groupId}`;
  const res = await fetch(url, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) throw new Error("Failed to load blog posts");
  return res.json();
}

export async function createBlogPost(post: {
  project_id: string;
  group_id?: string;
  title: string;
  original_filename?: string;
  json_data?: any;
  status?: string;
}): Promise<BlogPost> {
  const res = await fetch(`${supabaseUrl}/rest/v1/blog_posts`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify(post),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`创建 Blog 失败: ${err}`);
  }
  return (await res.json())[0];
}

export async function updateBlogPost(id: string, updates: Partial<BlogPost>): Promise<BlogPost> {
  const res = await fetch(`${supabaseUrl}/rest/v1/blog_posts?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("更新 Blog 失败");
  return (await res.json())[0];
}

export async function deleteBlogPost(id: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/blog_posts?id=eq.${id}`, {
    method: "DELETE",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) throw new Error("删除 Blog 失败");
}
