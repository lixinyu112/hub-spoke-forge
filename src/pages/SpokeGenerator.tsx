import { useState, useEffect } from "react";
import { Sparkles, FileText, Search, Loader2, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeViewer } from "@/components/CodeViewer";
import { ValidationBar } from "@/components/ValidationBar";
import { useProject } from "@/contexts/ProjectContext";
import { getThemes, getComponentSpecs, createSpoke, getDocuments, createDocument, updateDocument } from "@/lib/api";
import { fetchFeishuDocs, fetchFeishuDocContent, extractAgent3Code } from "@/lib/feishu";
import { generateJson, saveJsonRecord } from "@/lib/generate";
import { loadPromptConfig, savePromptConfig } from "@/lib/promptConfig";
import { toast } from "@/hooks/use-toast";
import type { Theme, ComponentSpec } from "@/lib/api";
import { PromptConfigButton } from "@/components/PromptConfigButton";
import { DocFormDialog } from "@/components/DocFormDialog";

interface FeishuDoc {
  token: string;
  name: string;
  type: string;
  url?: string;
  manualContent?: string;
}

export default function SpokeGenerator() {
  const { currentProject } = useProject();
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [validation, setValidation] = useState<"idle" | "passed" | "failed">("idle");
  const [themes, setThemes] = useState<Theme[]>([]);
  const [specs, setSpecs] = useState<ComponentSpec[]>([]);
  const [selectedTheme, setSelectedTheme] = useState("");
  const [scrapedData, setScrapedData] = useState("");
  const [prompt, setPrompt] = useState("");

  // Feishu docs
  const [feishuDocs, setFeishuDocs] = useState<FeishuDoc[]>([]);
  const [feishuSearch, setFeishuSearch] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ total: number; done: number; results: { title: string; success: boolean }[] } | null>(null);
  const [pendingSave, setPendingSave] = useState<{
    generatedJson: any;
    feishuContent: string;
    promptUsed: string;
    title: string;
    firstDoc: FeishuDoc | undefined;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (currentProject) {
      getThemes(currentProject.id).then(setThemes).catch(console.error);
      getComponentSpecs(currentProject.id).then(setSpecs).catch(console.error);
      loadPromptConfig(currentProject.id, "spoke").then((saved) => {
        if (saved) setPrompt(saved);
      });
      // Load documents from DB
      handleLoadDocuments();
    }
  }, [currentProject]);

  useEffect(() => {
    handleLoadDocuments()
  }, [selectedTheme])

  const handleSavePrompt = (val: string) => {
    if (currentProject) savePromptConfig(currentProject.id, "spoke", val);
  };

  const [syncing, setSyncing] = useState(false);

  const handleLoadDocuments = async () => {
    if (!currentProject) return;
    setLoadingDocs(true);
    try {
      // Load DB-persisted documents
      const dbDocs = await getDocuments(currentProject.id);
      const mapped: FeishuDoc[] = dbDocs.map((d: any) => ({
        token: d.token,
        name: d.name,
        type: d.type,
        manualContent: d.content || undefined,
      }));

      // Load feishu API docs based on selected theme's folder token
      let apiDocs: FeishuDoc[] = [];
      try {
        const themeObj = themes.find((t) => t.id === selectedTheme);
        const folderToken = themeObj?.feishu_doc_token || undefined;
        const res = await fetchFeishuDocs(feishuSearch || undefined, folderToken);
        console.log('feiShuDocs=====', res);
        if (res?.data?.files) {
          apiDocs = res.data.files.map((f: any) => ({ token: f.token, name: f.name, type: f.type, url: f.url }));
        } else if (res?.data?.docs_entities) {
          apiDocs = res.data.docs_entities.map((d: any) => ({ token: d.docs_token, name: d.title, type: d.docs_type, url: d.url }));
        }
      } catch (e) {
        console.warn("飞书 API 文档加载失败:", e);
      }

      // Merge API docs into mapped list (avoid duplicates)
      const existingTokens = new Set(mapped.map((d) => d.token));
      for (const ad of apiDocs) {
        if (!existingTokens.has(ad.token)) {
          mapped.push(ad);
        }
      }

      setFeishuDocs(mapped);
    } catch (e) {
      console.error("Failed to load documents:", e);
      toast({ title: "文档加载失败", variant: "destructive" });
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleSyncAgent3 = async () => {
    if (!currentProject || feishuDocs.length === 0) return;
    setSyncing(true);
    let syncCount = 0;
    let failCount = 0;
    const updated = [...feishuDocs];

    for (let i = 0; i < updated.length; i++) {
      const doc = updated[i];
      try {
        const result = await extractAgent3Code(doc.token);
        const codeContent = result.agent3_found && result.code_blocks.length > 0
          ? result.code_blocks.join("\n\n---\n\n")
          : undefined;

        if (codeContent) {
          // Check if doc exists in DB
          const dbDocs = await getDocuments(currentProject.id);
          const exists = dbDocs.some((d: any) => d.token === doc.token);

          if (exists) {
            await updateDocument(currentProject.id, doc.token, { name: doc.name, content: codeContent });
          } else {
            await createDocument({
              project_id: currentProject.id,
              token: doc.token,
              name: doc.name,
              type: doc.type || "docx",
              content: codeContent,
            });
          }
          updated[i] = { ...doc, manualContent: codeContent };
          syncCount++;
        }
      } catch (e) {
        console.warn(`文档 ${doc.name} Agent3 代码提取失败:`, e);
        failCount++;
      }
    }

    setFeishuDocs(updated);
    setSyncing(false);
    if (syncCount > 0) {
      toast({ title: `已同步 ${syncCount} 个文档的 Agent3 代码块${failCount > 0 ? `，${failCount} 个失败` : ""}` });
    } else if (failCount > 0) {
      toast({ title: `Agent3 代码提取失败（${failCount} 个），请检查飞书应用是否已开通 docx:document:readonly 权限`, variant: "destructive" });
    } else {
      toast({ title: "未找到包含 Agent3 的文档" });
    }
  };

  const toggleDoc = (token: string) => {
    setSelectedDocs((prev) => {
      const next = prev.includes(token) ? prev.filter((t) => t !== token) : [...prev, token];
      // Auto-switch to batch mode when multiple docs selected
      if (next.length > 1) setMode("batch");
      else if (next.length <= 1) setMode("single");
      return next;
    });
  };

  const handleCreateDoc = async (data: { token: string; name: string; content: string }) => {
    if (!data.name || !data.token) {
      toast({ title: "请填写文档名称和文档 ID", variant: "destructive" });
      return;
    }
    if (!currentProject) return;
    if (feishuDocs.some((d) => d.token === data.token)) {
      toast({ title: "文档 ID 已存在", variant: "destructive" });
      return;
    }
    try {
      await createDocument({
        project_id: currentProject.id,
        token: data.token,
        name: data.name,
        type: "manual",
        content: data.content || undefined,
      });
      setFeishuDocs((prev) => [{ token: data.token, name: data.name, type: "manual", manualContent: data.content || undefined }, ...prev]);
      setSelectedDocs((prev) => [...prev, data.token]);
      toast({ title: "文档已创建并选中" });
    } catch (e: any) {
      toast({ title: "创建文档失败", description: e.message, variant: "destructive" });
    }
  };

  const handleEditDoc = async (data: { token: string; name: string; content: string }) => {
    if (!currentProject) return;
    try {
      await updateDocument(currentProject.id, data.token, { name: data.name, content: data.content || undefined });
      setFeishuDocs((prev) =>
        prev.map((d) =>
          d.token === data.token
            ? { ...d, name: data.name, manualContent: data.content || undefined }
            : d
        )
      );
      toast({ title: "文档已更新" });
    } catch (e: any) {
      toast({ title: "更新文档失败", description: e.message, variant: "destructive" });
    }
  };

  const handleGenerateSingle = async () => {
    if (!selectedTheme) {
      toast({ title: "请选择主题", variant: "destructive" });
      return;
    }
    if (selectedDocs.length === 0) {
      toast({ title: "请选择至少一个飞书文档", variant: "destructive" });
      return;
    }
    setLoading(true);
    setOutput("");
    setValidation("idle");

    // Collect all selected doc contents
    const contentParts: string[] = [];
    for (const token of selectedDocs) {
      const doc = feishuDocs.find((d) => d.token === token);
      if (!doc) continue;
      if (doc.type === "manual" && doc.manualContent) {
        contentParts.push(`【${doc.name}】\n${doc.manualContent}`);
      } else {
        try {
          const docRes = await fetchFeishuDocContent(doc.token, doc.type);
          const content = docRes?.data?.content || JSON.stringify(docRes?.data) || doc.name;
          contentParts.push(`【${doc.name}】\n${content}`);
        } catch (e) {
          console.warn("飞书文档内容获取失败，使用文档标题:", e);
          contentParts.push(`【${doc.name}】`);
        }
      }
    }

    try {
      const feishuContent = contentParts.join("\n\n---\n\n");
      const firstDoc = feishuDocs.find((d) => d.token === selectedDocs[0]);

      const result = await generateJson({
        type: "spoke",
        feishu_content: feishuContent,
        custom_prompt: prompt || undefined,
        context: scrapedData || undefined,
      });

      const generatedJson = result.generated_json;
      // 强制 hubSlug 与主题名称一致
      const themeName = themes.find((t) => t.id === selectedTheme)?.name;
      if (generatedJson && typeof generatedJson === "object" && themeName) {
        (generatedJson as any).hubSlug = themeName;
      }
      const json = JSON.stringify(generatedJson, null, 2);
      setOutput(json);
      setValidation(generatedJson && typeof generatedJson === "object" ? "passed" : "failed");

      const title = generatedJson?.title || firstDoc?.name || "未命名 Spoke";
      setPendingSave({
        generatedJson,
        feishuContent,
        promptUsed: result.prompt_used || prompt,
        title,
        firstDoc,
      });
      setConfirmed(false);
      toast({ title: "Spoke JSON 已生成，请检查后确认保存" });
    } catch (e: any) {
      console.error(e);
      setValidation("failed");
      setOutput(JSON.stringify({ error: e.message }, null, 2));
      toast({ title: "生成失败", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSave = async (editedCode: string) => {
    if (!pendingSave) return;
    try {
      const editedJson = JSON.parse(editedCode);
      await saveJsonRecord({
        type: "spoke",
        feishu_content: pendingSave.feishuContent,
        prompt_content: pendingSave.promptUsed,
        generated_json: editedJson,
      });
      await createSpoke({
        theme_id: selectedTheme,
        title: editedJson?.title || pendingSave.title,
        json_data: editedJson,
        feishu_doc_token: pendingSave.firstDoc?.token || null,
        feishu_doc_title: pendingSave.firstDoc?.name || null,
        status: "generated",
      });
      setOutput(editedCode);
      setConfirmed(true);
      setPendingSave(null);
      toast({ title: "Spoke 已确认保存" });
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" });
    }
  };

  const handleDiscardSave = () => {
    setOutput("");
    setPendingSave(null);
    setConfirmed(false);
    setValidation("idle");
    toast({ title: "已放弃生成结果" });
  };

  const handleGenerateBatch = async () => {
    if (!selectedTheme) {
      toast({ title: "请选择主题", variant: "destructive" });
      return;
    }
    if (selectedDocs.length === 0) {
      toast({ title: "请选择至少一个飞书文档", variant: "destructive" });
      return;
    }
    setLoading(true);
    setBatchProgress({ total: selectedDocs.length, done: 0, results: [] });
    setOutput("");
    setValidation("idle");

    const results: { title: string; success: boolean }[] = [];
    for (let i = 0; i < selectedDocs.length; i++) {
      const doc = feishuDocs.find((d) => d.token === selectedDocs[i]);
      const docTitle = doc?.name || `Spoke ${i + 1}`;
      try {
        let feishuContent = docTitle;
        if (doc?.type === "manual" && doc.manualContent) {
          feishuContent = doc.manualContent;
        } else if (doc) {
          try {
            const docRes = await fetchFeishuDocContent(doc.token, doc.type);
            feishuContent = docRes?.data?.content || JSON.stringify(docRes?.data) || docTitle;
          } catch { /* fallback to title */ }
        }

        const result = await generateJson({
          type: "spoke",
          feishu_content: feishuContent,
          custom_prompt: prompt || undefined,
          context: scrapedData || undefined,
        });
        const generatedJson = result.generated_json;
        // 强制 hubSlug 与主题名称一致
        const themeName = themes.find((t) => t.id === selectedTheme)?.name;
        if (generatedJson && typeof generatedJson === "object" && themeName) {
          (generatedJson as any).hubSlug = themeName;
        }
        const title = generatedJson?.title || docTitle;

        await saveJsonRecord({
          type: "spoke",
          feishu_content: feishuContent,
          prompt_content: result.prompt_used || prompt,
          generated_json: generatedJson,
        });

        await createSpoke({
          theme_id: selectedTheme,
          title,
          json_data: generatedJson,
          feishu_doc_token: doc?.token || null,
          feishu_doc_title: doc?.name || null,
          status: "generated",
        });
        results.push({ title, success: true });
      } catch {
        results.push({ title: docTitle, success: false });
      }
      setBatchProgress({ total: selectedDocs.length, done: i + 1, results: [...results] });
    }
    setLoading(false);
    toast({ title: "批量生成完成", description: `成功 ${results.filter((r) => r.success).length}/${results.length}` });
  };

  const filteredDocs = feishuDocs.filter((d) =>
    !feishuSearch || d.name.toLowerCase().includes(feishuSearch.toLowerCase())
  );

  const spokeSpecs = specs.filter((s) => s.type === "spoke");

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">Spoke 生成器</h1>
            <PromptConfigButton value={prompt} onChange={setPrompt} onConfirm={handleSavePrompt} placeholder="输入 Spoke 生成的 system prompt…" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">从飞书文档生成结构化 Spoke JSON</p>
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "batch")}>
          <TabsList>
            <TabsTrigger value="single" className="text-xs">单个生成</TabsTrigger>
            <TabsTrigger value="batch" className="text-xs">批量生成</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 grid lg:grid-cols-2 gap-4 min-h-0">
        {/* Left */}
        <div className="flex flex-col gap-4 overflow-auto">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">选择主题</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                <SelectTrigger>
                  <SelectValue placeholder="选择主题…" />
                </SelectTrigger>
                <SelectContent>
                  {themes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                  {themes.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">暂无主题，请先在「内容浏览」中创建</div>
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                文档列表
                <Badge variant="secondary" className="text-[10px]">{selectedDocs.length} 已选</Badge>
                <div className="ml-auto">
                  <DocFormDialog mode="create" onSubmit={handleCreateDoc} />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="搜索文档…"
                    value={feishuSearch}
                    onChange={(e) => setFeishuSearch(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleLoadDocuments} disabled={loadingDocs} className="h-9 text-xs">
                  {loadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "刷新"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleSyncAgent3} disabled={syncing || feishuDocs.length === 0} className="h-9 text-xs gap-1">
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  同步 Agent3
                </Button>
              </div>
              <div className="max-h-[240px] overflow-auto space-y-1">
                {filteredDocs.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">暂无文档，点击右上角「+」手动创建或刷新获取飞书文档</p>
                )}
                {filteredDocs.map((doc) => (
                  <label
                    key={doc.token}
                    className="group flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedDocs.includes(doc.token)}
                      onCheckedChange={() => toggleDoc(doc.token)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{doc.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{doc.token}</p>
                    </div>
                    <DocFormDialog
                      mode="edit"
                      initialData={{ token: doc.token, name: doc.name, content: doc.manualContent || "" }}
                      onSubmit={handleEditDoc}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      }
                    />
                    <Badge variant="outline" className="text-[10px] shrink-0">{doc.type}</Badge>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {mode === "single" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">补充内容</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="补充的原始文本内容、行业背景、关键词等…"
                  value={scrapedData}
                  onChange={(e) => setScrapedData(e.target.value)}
                  className="min-h-[100px] font-mono text-xs"
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">组件规范</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select defaultValue="spoke-default">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spoke-default">Tripo_Schema (内置默认)</SelectItem>
                  {spokeSpecs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={mode === "single" ? handleGenerateSingle : handleGenerateBatch}
                className="w-full gap-2"
                disabled={loading}
              >
                <Sparkles className="h-4 w-4" />
                {mode === "single" ? "生成 Spoke JSON ✨" : `批量生成 ${selectedDocs.length} 个 Spoke ✨`}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right */}
        <div className="flex flex-col gap-3 min-h-0">
          <ValidationBar
            status={validation}
            message={validation === "passed" ? "✅ Schema 验证通过" : validation === "failed" ? "❌ 验证失败：返回内容不是有效的 JSON 对象" : undefined}
          />
          <Card className="flex-1 min-h-0 flex flex-col">
            {mode === "batch" && batchProgress ? (
              <div className="p-4 space-y-3 overflow-auto">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{batchProgress.done}/{batchProgress.total}</span>
                </div>
                <div className="space-y-1">
                  {batchProgress.results.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/30">
                      <span className={r.success ? "text-success" : "text-destructive"}>{r.success ? "✅" : "❌"}</span>
                      <span className="truncate">{r.title}</span>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex items-center gap-2 text-xs p-2 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      处理中…
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Tabs defaultValue="json" className="flex-1 flex flex-col">
                <div className="border-b px-4">
                  <TabsList className="bg-transparent h-9">
                    <TabsTrigger value="json" className="text-xs">JSON 输出</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="json" className="flex-1 m-0">
                  <CodeViewer code={output} loading={loading} filename="spoke-output.json" editable={!!pendingSave} onConfirm={handleConfirmSave} onDiscard={handleDiscardSave} confirmed={confirmed} />
                </TabsContent>
              </Tabs>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
