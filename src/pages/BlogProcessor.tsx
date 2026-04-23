import { useState, useEffect, useRef, useCallback } from "react";
import { FileText, FolderPlus, Trash2, Loader2, Globe, X, FileJson, Upload, Map, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CodeViewer } from "@/components/CodeViewer";
import { ValidationBar } from "@/components/ValidationBar";
import { PromptConfigButton } from "@/components/PromptConfigButton";
import { PublishDialog, PublishReportData } from "@/components/PublishDialog";
import { useProject } from "@/contexts/ProjectContext";
import {
  getBlogGroups, createBlogGroup, deleteBlogGroup,
  getBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost,
  type BlogGroup, type BlogPost,
} from "@/lib/blogApi";
import { generateJson, saveJsonRecord } from "@/lib/generate";
import { loadPromptConfig, savePromptConfig } from "@/lib/promptConfig";
import { createPublication } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { BlogSitemapDialog } from "@/components/BlogSitemapDialog";
import { PublishLogsDialog } from "@/components/PublishLogsDialog";

interface MdxFile {
  name: string;
  content: string;
  size: number;
}

/** Extract CMS API article fields from a blog post (mirrors toArticle in publish-blog) */
function extractArticleFields(post: BlogPost) {
  const data: any = post.json_data || {};
  const components = Array.isArray(data.components) ? data.components : [];
  const articleHeader = components.find((c: any) => c?.type === "articleHeader")?.props || {};
  const contentBlocks = components
    .filter((c: any) => c?.type === "contentBlock")
    .map((c: any) => c?.props?.content)
    .filter((v: unknown): v is string => typeof v === "string" && v.trim().length > 0);

  const first = (...vals: unknown[]): string | undefined => {
    for (const v of vals) { if (typeof v === "string" && v.trim()) return v.trim(); }
    return undefined;
  };

  const strArr = (val: unknown): string[] | undefined => {
    if (!Array.isArray(val)) return undefined;
    const r = val.map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        return first(rec.slug, rec.value, rec.name, rec.label, rec.title) || "";
      }
      return "";
    }).filter(Boolean);
    return r.length ? r : undefined;
  };

  const normDate = (val: unknown): string | undefined => {
    if (typeof val !== "string" || !val.trim()) return undefined;
    const t = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return new Date(`${t}T00:00:00.000Z`).toISOString();
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  };

  return {
    title: first(data.title, articleHeader.title, post.title) || "Untitled",
    markdown: first(data.markdown, data.content, data.body, contentBlocks.join("\n\n")) || JSON.stringify(data, null, 2),
    slug: first(data.slug, post.slug),
    description: first(data.description, data.meta?.description, articleHeader.subtitle),
    categorySlugs: strArr(data.categorySlugs ?? data.categories ?? data.taxonomy?.categories ?? articleHeader.categorySlugs),
    publishedAt: normDate(data.publishedAt ?? data.published_at ?? articleHeader.publishDate),
    heroImage: first(data.heroImage, data.hero_image, data.cover, data.meta?.ogImage, articleHeader.coverImage),
    keywords: strArr(data.keywords ?? data.tags ?? data.meta?.keywords ?? articleHeader.tags),
  };
}

export default function BlogProcessor() {
  const { currentProject } = useProject();
  const [groups, setGroups] = useState<BlogGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [uploadGroupId, setUploadGroupId] = useState<string>("");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  
  const [prompt, setPrompt] = useState("");

  // Upload state
  const mdxInputRef = useRef<HTMLInputElement>(null);
  const jsonTemplateRef = useRef<HTMLInputElement>(null);
  const [pendingMdxFiles, setPendingMdxFiles] = useState<MdxFile[]>([]);
  const [uploadedJsonTemplate, setUploadedJsonTemplate] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ total: number; done: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [context, setContext] = useState("");

  // Group creation
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  // Processing
  const [processing, setProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState<{ total: number; done: number } | null>(null);

  // View/Edit selected post
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [editingJson, setEditingJson] = useState("");
  const [validation, setValidation] = useState<"idle" | "passed" | "failed">("idle");
  const [previewingMdx, setPreviewingMdx] = useState<MdxFile | null>(null);

  // Publish
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishReport, setPublishReport] = useState<PublishReportData | null>(null);
  const [publishProgress, setPublishProgress] = useState<{ total: number; done: number } | null>(null);
  const [sitemapOpen, setSitemapOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [allPosts, setAllPosts] = useState<BlogPost[]>([]);

  // Load data
  useEffect(() => {
    if (currentProject) {
      loadGroups();
      loadPosts();
      loadPromptConfig(currentProject.id, "blog").then((saved) => {
        if (saved) setPrompt(saved);
      });
      // Load persisted JSON template
      loadPromptConfig(currentProject.id, "blog_template").then((saved) => {
        if (saved) setUploadedJsonTemplate(saved);
      });
    }
  }, [currentProject]);

  useEffect(() => {
    if (currentProject) loadPosts();
  }, [selectedGroup]);

  const loadGroups = async () => {
    if (!currentProject) return;
    const g = await getBlogGroups(currentProject.id);
    setGroups(g);
  };

  

  const loadPosts = async () => {
    if (!currentProject) return;
    if (!selectedGroup) { setPosts([]); setAllPosts([]); return; }
    const p = await getBlogPosts(currentProject.id, selectedGroup);
    setPosts(p);
    // Load all posts for sitemap
    const all = await getBlogPosts(currentProject.id);
    setAllPosts(all);
  };

  const handleSavePrompt = (val: string) => {
    if (currentProject) savePromptConfig(currentProject.id, "blog", val);
  };

  // Create group
  const handleCreateGroup = async () => {
    if (!currentProject || !newGroupName.trim()) return;
    try {
      await createBlogGroup(currentProject.id, newGroupName.trim());
      setNewGroupName("");
      setShowGroupDialog(false);
      await loadGroups();
      toast({ title: "分组已创建" });
    } catch (e: any) {
      toast({ title: "创建失败", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      await deleteBlogGroup(id);
      if (selectedGroup === id) setSelectedGroup("all");
      await loadGroups();
      await loadPosts();
      toast({ title: "分组已删除" });
    } catch (e: any) {
      toast({ title: "删除失败", description: e.message, variant: "destructive" });
    }
  };

  // Chunked file reader - reads files in batches to avoid memory spikes
  const readFilesInChunks = useCallback(async (files: File[]) => {
    const CHUNK_SIZE = 20; // Read 20 files at a time
    const allNew: MdxFile[] = [];
    const total = files.length;
    setUploadProgress({ total, done: 0 });

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunk = files.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(
          (file) =>
            new Promise<MdxFile | null>((resolve) => {
              const reader = new FileReader();
              reader.onload = (ev) => {
                const content = ev.target?.result as string;
                resolve(content ? { name: file.name, content, size: file.size } : null);
              };
              reader.onerror = () => {
                console.error(`读取文件 ${file.name} 失败`);
                resolve(null);
              };
              reader.readAsText(file);
            })
        )
      );
      allNew.push(...(chunkResults.filter(Boolean) as MdxFile[]));
      setUploadProgress({ total, done: Math.min(i + CHUNK_SIZE, total) });
    }

    setUploadProgress(null);
    return allNew;
  }, []);

  // Filter valid MDX files
  const filterMdxFiles = (files: File[]) =>
    files.filter((f) => /\.(mdx|md|markdown|txt)$/i.test(f.name));

  // MDX multi-file upload handler
  const handleMdxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const validFiles = filterMdxFiles(Array.from(fileList));
    if (validFiles.length === 0) {
      toast({ title: "未找到有效的 MDX 文件", variant: "destructive" });
      e.target.value = "";
      return;
    }

    const newFiles = await readFilesInChunks(validFiles);
    if (newFiles.length > 0) {
      setPendingMdxFiles((prev) => [...prev, ...newFiles]);
      toast({ title: `已添加 ${newFiles.length} 个文件` });
    }
    e.target.value = "";
  };

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    const allFiles: File[] = [];

    // Support folder drops via webkitGetAsEntry
    const readEntry = (entry: FileSystemEntry): Promise<File[]> =>
      new Promise((resolve) => {
        if (entry.isFile) {
          (entry as FileSystemFileEntry).file((f) => resolve([f]), () => resolve([]));
        } else if (entry.isDirectory) {
          const dirReader = (entry as FileSystemDirectoryEntry).createReader();
          dirReader.readEntries(async (entries) => {
            const nested = await Promise.all(entries.map(readEntry));
            resolve(nested.flat());
          }, () => resolve([]));
        } else {
          resolve([]);
        }
      });

    if (items && items.length > 0) {
      const entries = Array.from(items)
        .map((item) => item.webkitGetAsEntry?.())
        .filter(Boolean) as FileSystemEntry[];

      if (entries.length > 0) {
        const nested = await Promise.all(entries.map(readEntry));
        allFiles.push(...nested.flat());
      } else {
        // Fallback to dataTransfer.files
        allFiles.push(...Array.from(e.dataTransfer.files));
      }
    }

    const validFiles = filterMdxFiles(allFiles);
    if (validFiles.length === 0) {
      toast({ title: "未找到有效的 MDX 文件", variant: "destructive" });
      return;
    }

    const newFiles = await readFilesInChunks(validFiles);
    if (newFiles.length > 0) {
      setPendingMdxFiles((prev) => [...prev, ...newFiles]);
      toast({ title: `已添加 ${newFiles.length} 个文件（支持文件夹）` });
    }
  }, [readFilesInChunks]);

  // JSON template upload with persistence
  const handleJsonTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      try {
        JSON.parse(text);
        setUploadedJsonTemplate(text);
        if (currentProject) {
          await savePromptConfig(currentProject.id, "blog_template", text);
        }
        toast({ title: `已加载 JSON 模板: ${file.name}` });
      } catch {
        toast({ title: "无效的 JSON 文件", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Delete persisted JSON template
  const handleDeleteTemplate = async () => {
    setUploadedJsonTemplate(null);
    if (currentProject) {
      await savePromptConfig(currentProject.id, "blog_template", "");
    }
    toast({ title: "JSON 模板已删除" });
  };

  // Batch process MDX files with parallel execution
  const handleProcessAll = async () => {
    if (!currentProject || pendingMdxFiles.length === 0) return;
    setProcessing(true);
    const total = pendingMdxFiles.length;
    setProcessProgress({ total, done: 0 });

    if (!uploadGroupId) {
      toast({ title: "请先选择目标分组", variant: "destructive" });
      setProcessing(false);
      return;
    }
    const groupId = uploadGroupId;
    let done = 0;
    const CONCURRENCY = 3; // Process 3 files in parallel

    const processSingle = async (mdx: MdxFile) => {
      try {
        const ctxParts: string[] = [];
        if (context.trim()) ctxParts.push(context.trim());
        if (uploadedJsonTemplate) {
          ctxParts.push(`\n\n【用户提供的 JSON 模板（请严格按照此格式和字段结构生成，仅更新内容）】\n${uploadedJsonTemplate}`);
        }

        const result = await generateJson({
          type: "spoke",
          feishu_content: mdx.content,
          custom_prompt: prompt || undefined,
          context: ctxParts.length > 0 ? ctxParts.join("\n") : undefined,
        });

        const json = result.generated_json;
        const title = json?.title || json?.meta?.title || mdx.name.replace(/\.(mdx|md)$/, "");

        await createBlogPost({
          project_id: currentProject.id,
          group_id: groupId,
          title,
          original_filename: mdx.name,
          json_data: json,
          status: "draft",
        });

        await saveJsonRecord({
          type: "blog",
          feishu_content: mdx.content.slice(0, 5000),
          prompt_content: prompt,
          generated_json: json,
        });
      } catch (err: any) {
        console.error(`处理 ${mdx.name} 失败:`, err);
        await createBlogPost({
          project_id: currentProject.id,
          group_id: groupId,
          title: mdx.name.replace(/\.(mdx|md)$/, ""),
          original_filename: mdx.name,
          json_data: { error: err.message },
          status: "error",
        }).catch(() => {});
      }
      done++;
      setProcessProgress({ total, done });
    };

    // Process in parallel batches
    for (let i = 0; i < total; i += CONCURRENCY) {
      const batch = pendingMdxFiles.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(processSingle));
    }

    setPendingMdxFiles([]);
    setProcessing(false);
    setProcessProgress(null);
    await loadPosts();
    toast({ title: `已处理 ${done} 个文件` });
  };

  // Select post for viewing
  const handleSelectPost = (post: BlogPost) => {
    setSelectedPost(post);
    const json = post.json_data ? JSON.stringify(post.json_data, null, 2) : "";
    setEditingJson(json);
    setValidation(post.json_data && typeof post.json_data === "object" && !post.json_data.error ? "passed" : "failed");
  };

  // Save edited JSON
  const handleSavePostJson = async (editedCode: string) => {
    if (!selectedPost) return;
    try {
      const parsed = JSON.parse(editedCode);
      await updateBlogPost(selectedPost.id, { json_data: parsed });
      setSelectedPost({ ...selectedPost, json_data: parsed });
      setEditingJson(editedCode);
      await loadPosts();
      toast({ title: "Blog JSON 已保存" });
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" });
    }
  };

  // Discard
  const handleDiscardPost = () => {
    setSelectedPost(null);
    setEditingJson("");
    setValidation("idle");
  };

  // Toggle post selection for publish
  const togglePostSelection = (id: string) => {
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Publish via Blog Import API
  const handlePublish = async (languages: string[], environment: string, _translate: boolean) => {
    if (!currentProject || selectedPostIds.size === 0) return;
    setPublishing(true);
    setPublishReport(null);

    const selectedPosts = posts.filter((p) => selectedPostIds.has(p.id) && p.json_data && !p.json_data.error);
    const total = selectedPosts.length * languages.length;
    const details: PublishReportData["details"] = [];

    setPublishProgress({ total, done: 0 });

    try {
      // Load translate prompt once
      const translatePrompt = await loadPromptConfig(currentProject.id, "translate");

      // Call publish-blog edge function which handles translation + CMS push
      const requestBody = {
        items: selectedPosts.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          json_data: p.json_data,
        })),
        languages,
        translate_prompt: translatePrompt || undefined,
        slug_prefix: "crescendia",
        environment,
      };
      console.log("[publish-blog] Request Body:", JSON.stringify(requestBody, null, 2));

      const { data, error } = await supabase.functions.invoke("publish-blog", {
        body: requestBody,
      });

      console.log("[publish-blog] Response Headers:", data ? "OK" : "Error");
      console.log("[publish-blog] Response Body:", JSON.stringify(data, null, 2));

      if (error) throw error;

      const results = data?.results || [];
      let done = 0;

      for (const r of results) {
        const post = selectedPosts.find((p) => p.id === r.item_id);
        details.push({
          item_id: r.item_id,
          item_title: post?.title || r.item_id,
          language: r.language,
          success: r.success,
          error: r.error,
        });

        // Save publication record for successful items
        if (r.success && post) {
          await createPublication({
            project_id: currentProject.id,
            source_type: "blog",
            source_id: r.item_id,
            title: post.title,
            language: r.language,
            json_data: post.json_data,
            status: "published",
          });
          await updateBlogPost(r.item_id, { status: "published" });
        }

        done++;
        setPublishProgress({ total, done });
      }
    } catch (e: any) {
      // If the entire call failed, mark all as failed
      for (const post of selectedPosts) {
        for (const lang of languages) {
          details.push({ item_id: post.id, item_title: post.title, language: lang, success: false, error: e.message });
        }
      }
    }

    setPublishing(false);
    setPublishProgress(null);
    setPublishReport({
      total,
      success: details.filter((d) => d.success).length,
      failed: details.filter((d) => !d.success).length,
      details,
    });
    await loadPosts();
  };

  const handleDeletePost = async (id: string) => {
    try {
      await deleteBlogPost(id);
      if (selectedPost?.id === id) {
        setSelectedPost(null);
        setEditingJson("");
      }
      selectedPostIds.delete(id);
      setSelectedPostIds(new Set(selectedPostIds));
      await loadPosts();
      toast({ title: "Blog 已删除" });
    } catch (e: any) {
      toast({ title: "删除失败", description: e.message, variant: "destructive" });
    }
  };

  const filteredPosts = posts;

  const renderPostItem = (post: BlogPost) => (
    <div
      key={post.id}
      className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
        selectedPost?.id === post.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50 hover:border-border"
      }`}
    >
      <Checkbox
        checked={selectedPostIds.has(post.id)}
        onCheckedChange={() => togglePostSelection(post.id)}
      />
      <div className="flex-1 min-w-0" onClick={() => handleSelectPost(post)}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm truncate">{post.title}</span>
          <Badge
            variant={post.status === "published" ? "default" : post.status === "error" ? "destructive" : "secondary"}
            className="text-[9px] shrink-0"
          >
            {post.status === "published" ? "已发布" : post.status === "error" ? "错误" : "草稿"}
          </Badge>
        </div>
        {post.original_filename && (
          <p className="text-[10px] text-muted-foreground font-mono truncate">{post.original_filename}</p>
        )}
      </div>
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => handleDeletePost(post.id)}>
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Blog 加工器</h1>
          <PromptConfigButton value={prompt} onChange={setPrompt} onConfirm={handleSavePrompt} placeholder="输入 Blog 转换的 system prompt…" />
        </div>
        <p className="text-sm text-muted-foreground mt-1">上传 MDX 压缩包，通过 AI 转换为结构化 JSON，支持分组管理、查看与发布</p>
      </div>

      <div className="flex-1 grid lg:grid-cols-2 gap-4 min-h-0">
        {/* Left panel: Upload & Posts list */}
        <div className="flex flex-col gap-4 overflow-auto">
          {/* Group management - prominent */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderPlus className="h-4 w-4 text-primary" />
                  分组管理
                </CardTitle>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowGroupDialog(true)}>
                  <FolderPlus className="h-3.5 w-3.5" />
                  新建分组
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">所有 Blog 必须归属于一个分组</p>
            </CardHeader>
            <CardContent>
              {groups.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {groups.map((g) => (
                    <Badge
                      key={g.id}
                      variant="outline"
                      className="gap-1 text-[11px] py-1 px-2"
                    >
                      {g.name}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() => handleDeleteGroup(g.id)}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-2">暂无分组，请先创建分组再上传文件</p>
              )}
            </CardContent>
          </Card>

          {/* Upload area */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">上传与转换</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Target group selector for upload */}
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1">目标分组 <span className="text-destructive">*</span></p>
                <Select value={uploadGroupId} onValueChange={setUploadGroupId}>
                  <SelectTrigger className={`h-8 ${!uploadGroupId ? "border-destructive/50" : ""}`}>
                    <SelectValue placeholder="请选择上传目标分组…" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!uploadGroupId && groups.length > 0 && (
                  <p className="text-[10px] text-destructive mt-1">请选择分组后再上传文件</p>
                )}
                {groups.length === 0 && (
                  <p className="text-[10px] text-destructive mt-1">请先创建分组</p>
                )}
              </div>

              {/* Drag & Drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
                onClick={() => mdxInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  拖放 MDX 文件或文件夹到此处，或点击选择
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  支持 .mdx、.md、.markdown、.txt，可一次上传数百个文件
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <input
                  ref={mdxInputRef}
                  type="file"
                  accept=".mdx,.md,.markdown,.txt"
                  multiple
                  className="hidden"
                  onChange={handleMdxUpload}
                  /* @ts-ignore - webkitdirectory for folder upload */
                  {...({} as any)}
                />
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => mdxInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" />
                  选择文件
                </Button>
                <input ref={jsonTemplateRef} type="file" accept=".json" className="hidden" onChange={handleJsonTemplateUpload} />
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => jsonTemplateRef.current?.click()}>
                  <FileJson className="h-3.5 w-3.5" />
                  {uploadedJsonTemplate ? "更换 JSON 模板" : "上传 JSON 模板"}
                </Button>
              </div>

              {uploadedJsonTemplate && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
                  <FileJson className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">JSON 模板已加载（已持久化）</span>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-auto" onClick={handleDeleteTemplate}>
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              )}

              {/* Upload progress */}
              {uploadProgress && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>读取文件中… {uploadProgress.done}/{uploadProgress.total}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {pendingMdxFiles.length > 0
                      ? `待处理文件（${pendingMdxFiles.length} 个，共 ${(pendingMdxFiles.reduce((s, f) => s + f.size, 0) / 1024).toFixed(0)}KB）：`
                      : "暂无上传文件"}
                  </p>
                  {pendingMdxFiles.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs gap-1 text-muted-foreground hover:text-destructive"
                      onClick={() => { setPendingMdxFiles([]); setPreviewingMdx(null); }}
                    >
                      <Trash2 className="h-3 w-3" />
                      清空全部
                    </Button>
                  )}
                </div>
                {pendingMdxFiles.length > 0 && (
                  <ScrollArea className="max-h-[200px]">
                    {pendingMdxFiles.map((f, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 text-xs p-1.5 rounded cursor-pointer transition-colors ${
                          previewingMdx === f ? "bg-primary/10 border border-primary/30" : "bg-muted/50 hover:bg-muted"
                        }`}
                        onClick={() => setPreviewingMdx(f)}
                      >
                        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate flex-1">{f.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                          {f.size < 1024 ? `${f.size}B` : `${(f.size / 1024).toFixed(1)}KB`}
                        </span>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={(e) => { e.stopPropagation(); setPendingMdxFiles((prev) => prev.filter((_, j) => j !== i)); if (previewingMdx === f) setPreviewingMdx(null); }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                )}
              </div>

              <Textarea
                placeholder="补充内容（可选）：额外的转换指令或上下文…"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="min-h-[80px]"
              />

              {processProgress && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${processProgress.total > 0 ? (processProgress.done / processProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{processProgress.done}/{processProgress.total}</span>
                  </div>
                </div>
              )}

              <Button
                onClick={handleProcessAll}
                className="w-full gap-2"
                disabled={processing || pendingMdxFiles.length === 0 || !uploadGroupId}
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {processing ? "处理中…" : `批量转换 (${pendingMdxFiles.length} 个文件)`}
              </Button>
            </CardContent>
          </Card>

          {/* Posts list */}
          <Card className="flex-1 min-h-0 flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={filteredPosts.length > 0 && selectedPostIds.size === filteredPosts.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedPostIds(new Set(filteredPosts.map((p) => p.id)));
                      } else {
                        setSelectedPostIds(new Set());
                      }
                    }}
                    disabled={!selectedGroup}
                  />
                  <CardTitle className="text-base">Blog 列表</CardTitle>
                  <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                    <SelectTrigger className="h-7 w-[160px] text-xs">
                      <SelectValue placeholder="选择分组查看…" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedGroup && (
                    <Badge variant="secondary" className="text-[9px]">{filteredPosts.length}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => setSitemapOpen(true)}>
                    <Map className="h-3.5 w-3.5" />
                    Sitemap
                  </Button>
                  {selectedPostIds.size > 0 && (
                    <Button size="sm" className="gap-1" onClick={() => { setPublishOpen(true); setPublishReport(null); }}>
                      <Globe className="h-3.5 w-3.5" />
                      发布 ({selectedPostIds.size})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              {!selectedGroup ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-8">
                  <FolderPlus className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm">请先选择一个分组查看 Blog 列表</p>
                  {groups.length === 0 && (
                    <p className="text-xs text-muted-foreground/60">尚无分组，请先在上方创建分组</p>
                  )}
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="space-y-1">
                    {filteredPosts.map((post) => renderPostItem(post))}
                    {filteredPosts.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">该分组下暂无 Blog 内容</p>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right panel: JSON viewer */}
        <div className="flex flex-col gap-3 min-h-0">
          <ValidationBar
            status={validation}
            message={
              validation === "passed" ? "✅ JSON 验证通过" :
              validation === "failed" ? "❌ 内容无效或包含错误" : undefined
            }
          />
          <Card className="flex-1 min-h-0 flex flex-col">
            <Tabs defaultValue="json" className="flex-1 flex flex-col">
              <div className="border-b px-4">
                <TabsList className="bg-transparent h-9">
                  <TabsTrigger value="json" className="text-xs">JSON 输出</TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs">接口字段预览</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="json" className="flex-1 m-0">
                <CodeViewer
                  code={editingJson}
                  loading={processing}
                  filename={selectedPost ? `${selectedPost.title}.json` : "blog-output.json"}
                  editable={!!selectedPost}
                  onConfirm={handleSavePostJson}
                  onDiscard={handleDiscardPost}
                  confirmed={false}
                />
                {selectedPost?.json_data && !selectedPost.json_data.error && (() => {
                  const mapped = extractArticleFields(selectedPost);
                  return (
                    <div className="border-t px-4 py-3 space-y-1.5 bg-muted/20">
                      <p className="text-xs font-semibold text-muted-foreground">字段映射反馈</p>
                      {([
                        ["title", mapped.title, true],
                        ["markdown", mapped.markdown ? `${mapped.markdown.slice(0, 80)}…（共 ${mapped.markdown.length} 字符）` : "", true],
                        ["slug", mapped.slug, false],
                        ["description", mapped.description, false],
                        ["categorySlugs", mapped.categorySlugs?.join(", "), false],
                        ["publishedAt", mapped.publishedAt, false],
                        ["heroImage", mapped.heroImage, false],
                        ["keywords", mapped.keywords?.join(", "), false],
                      ] as [string, string | undefined, boolean][]).map(([field, value, required]) => (
                        <div key={field} className="flex items-start gap-2 text-xs">
                          <Badge variant={value ? "default" : required ? "destructive" : "outline"} className="text-[9px] shrink-0 mt-0.5">
                            {field}{required ? " *" : ""}
                          </Badge>
                          <span className={`break-all ${value ? "text-foreground" : "text-muted-foreground italic"}`}>
                            {value || "未提取到"}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </TabsContent>
              <TabsContent value="preview" className="flex-1 m-0 p-4 overflow-auto">
                {selectedPost?.json_data && !selectedPost.json_data.error ? (() => {
                  const article = extractArticleFields(selectedPost);
                  return (
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">title *</p>
                        <p className="text-base font-semibold">{article.title}</p>
                      </div>
                      {article.slug && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">slug</p>
                          <p className="text-sm font-mono text-muted-foreground">{article.slug}</p>
                        </div>
                      )}
                      {article.description && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">description</p>
                          <p className="text-sm text-muted-foreground">{article.description}</p>
                        </div>
                      )}
                      {article.heroImage && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">heroImage</p>
                          <a href={article.heroImage} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline break-all">{article.heroImage}</a>
                        </div>
                      )}
                      {article.categorySlugs && article.categorySlugs.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">categorySlugs</p>
                          <div className="flex flex-wrap gap-1">
                            {article.categorySlugs.map((c, i) => <Badge key={i} variant="outline" className="text-[10px]">{c}</Badge>)}
                          </div>
                        </div>
                      )}
                      {article.publishedAt && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">publishedAt</p>
                          <p className="text-sm font-mono text-muted-foreground">{article.publishedAt}</p>
                        </div>
                      )}
                      {article.keywords && article.keywords.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">keywords</p>
                          <div className="flex flex-wrap gap-1">
                            {article.keywords.map((k, i) => <Badge key={i} variant="secondary" className="text-[10px]">{k}</Badge>)}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">markdown *</p>
                        <pre className="text-xs bg-muted/30 rounded-md p-3 overflow-auto whitespace-pre-wrap font-mono max-h-[400px]">{article.markdown}</pre>
                      </div>
                    </div>
                  );
                })() : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {selectedPost ? "JSON 数据无效" : "选择一个 Blog 查看接口字段"}
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>

      {/* Group creation dialog */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>新建分组</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="分组名称"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupDialog(false)}>取消</Button>
            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish dialog */}
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        selectedCount={selectedPostIds.size}
        publishing={publishing}
        onPublish={handlePublish}
        report={publishReport}
        progress={publishProgress}
        showEnvironment
        allLanguages
        showTranslateToggle={false}
      />

      {/* Blog Sitemap dialog */}
      <BlogSitemapDialog
        open={sitemapOpen}
        onOpenChange={setSitemapOpen}
        groups={groups}
        posts={allPosts.length > 0 ? allPosts : posts}
        selectedGroupId={selectedGroup !== "all" && selectedGroup !== "ungrouped" ? selectedGroup : undefined}
      />
    </div>
  );
}
