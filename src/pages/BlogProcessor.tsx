import { useState, useEffect, useRef } from "react";
import { FileText, FolderPlus, Trash2, Loader2, Globe, X, FileJson, ChevronRight, Upload, Eye } from "lucide-react";
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

interface MdxFile {
  name: string;
  content: string;
  size: number;
}

export default function BlogProcessor() {
  const { currentProject } = useProject();
  const [groups, setGroups] = useState<BlogGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  
  const [prompt, setPrompt] = useState("");

  // Upload state
  const mdxInputRef = useRef<HTMLInputElement>(null);
  const jsonTemplateRef = useRef<HTMLInputElement>(null);
  const [pendingMdxFiles, setPendingMdxFiles] = useState<MdxFile[]>([]);
  const [uploadedJsonTemplate, setUploadedJsonTemplate] = useState<string | null>(null);
  
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
    const gid = selectedGroup === "all" ? undefined : selectedGroup === "ungrouped" ? undefined : selectedGroup;
    let p = await getBlogPosts(currentProject.id, gid);
    if (selectedGroup === "ungrouped") {
      p = p.filter((post) => !post.group_id);
    }
    setPosts(p);
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

  // MDX multi-file upload handler
  const handleMdxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newFiles: MdxFile[] = [];
    let processed = 0;

    Array.from(fileList).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        newFiles.push({ name: file.name, content: ev.target?.result as string, size: file.size });
        processed++;
        if (processed === fileList.length) {
          setPendingMdxFiles((prev) => [...prev, ...newFiles]);
          toast({ title: `已添加 ${newFiles.length} 个 MDX 文件` });
        }
      };
      reader.readAsText(file);
    });
    e.target.value = "";
  };

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

  // Batch process MDX files
  const handleProcessAll = async () => {
    if (!currentProject || pendingMdxFiles.length === 0) return;
    setProcessing(true);
    setProcessProgress({ total: pendingMdxFiles.length, done: 0 });

    const groupId = selectedGroup !== "all" && selectedGroup !== "ungrouped" ? selectedGroup : undefined;
    let done = 0;

    for (const mdx of pendingMdxFiles) {
      try {
        const ctxParts: string[] = [];
        if (context.trim()) ctxParts.push(context.trim());
        if (uploadedJsonTemplate) {
          ctxParts.push(`\n\n【用户提供的 JSON 模板（请严格按照此格式和字段结构生成，仅更新内容）】\n${uploadedJsonTemplate}`);
        }

        const result = await generateJson({
          type: "spoke", // reuse spoke generation logic for blog MDX→JSON
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
        // Still create a record with error
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
      setProcessProgress({ total: pendingMdxFiles.length, done });
      // Small delay between requests to avoid rate limiting
      if (done < pendingMdxFiles.length) {
        await new Promise((r) => setTimeout(r, 2000));
      }
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
  const handlePublish = async (languages: string[], environment: string) => {
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
      const { data, error } = await supabase.functions.invoke("publish-blog", {
        body: {
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
        },
      });

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
          {/* Group management */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">分组管理</CardTitle>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowGroupDialog(true)}>
                  <FolderPlus className="h-3.5 w-3.5" />
                  新建分组
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="选择分组…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="ungrouped">未分组</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {groups.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {groups.map((g) => (
                    <Badge
                      key={g.id}
                      variant={selectedGroup === g.id ? "default" : "outline"}
                      className="cursor-pointer gap-1 text-[10px]"
                      onClick={() => setSelectedGroup(g.id)}
                    >
                      {g.name}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id); }}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upload area */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">上传与转换</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <input ref={mdxInputRef} type="file" accept=".mdx,.md" multiple className="hidden" onChange={handleMdxUpload} />
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => mdxInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" />
                  上传 MDX 文件
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

              {pendingMdxFiles.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">待处理文件（{pendingMdxFiles.length} 个）：</p>
                  <ScrollArea className="max-h-[120px]">
                    {pendingMdxFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/50">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate flex-1">{f.name}</span>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setPendingMdxFiles((prev) => prev.filter((_, j) => j !== i))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}

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
                disabled={processing || pendingMdxFiles.length === 0}
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {processing ? "处理中…" : `批量转换 (${pendingMdxFiles.length} 个文件)`}
              </Button>
            </CardContent>
          </Card>

          {/* Posts list */}
          <Card className="flex-1 min-h-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Blog 列表 ({filteredPosts.length})</CardTitle>
                {selectedPostIds.size > 0 && (
                  <Button size="sm" className="gap-1" onClick={() => { setPublishOpen(true); setPublishReport(null); }}>
                    <Globe className="h-3.5 w-3.5" />
                    发布 ({selectedPostIds.size})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1">
                  {filteredPosts.map((post) => (
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
                        <div className="flex items-center gap-2">
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
                  ))}
                  {filteredPosts.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无 Blog 内容，请上传 MDX 文件进行转换</p>
                  )}
                </div>
              </ScrollArea>
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
                  <TabsTrigger value="preview" className="text-xs">内容预览</TabsTrigger>
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
              </TabsContent>
              <TabsContent value="preview" className="flex-1 m-0 p-4 overflow-auto">
                {selectedPost?.json_data && !selectedPost.json_data.error ? (
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold">{selectedPost.json_data.title || selectedPost.title}</h2>
                    {selectedPost.json_data.meta?.description && (
                      <p className="text-sm text-muted-foreground">{selectedPost.json_data.meta.description}</p>
                    )}
                    {selectedPost.json_data.components?.map((comp: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/30 border">
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline" className="text-[10px]">{comp.type}</Badge>
                        <span className="text-xs text-muted-foreground truncate">{comp.props?.title || comp.id}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {selectedPost ? "JSON 数据无效" : "选择一个 Blog 查看预览"}
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
      />
    </div>
  );
}
