import { useState, useEffect, useRef } from "react";
import { Sparkles, FileText, Search, Loader2, Pencil, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeViewer } from "@/components/CodeViewer";
import { ValidationBar } from "@/components/ValidationBar";
import { useProject } from "@/contexts/ProjectContext";
import { getThemes, getComponentSpecs, getComponentSpecsByTheme, createSpoke, updateSpoke, upsertSpoke, getDocuments, createDocument, updateDocument } from "@/lib/api";
import { fetchFeishuDocs, fetchFeishuDocContent, extractFirstCode } from "@/lib/feishu";
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
  modifiedTime?: string;
  lastGeneratedAt?: string;
  isNew?: boolean;
}

interface BatchResult {
  doc: FeishuDoc;
  generatedJson: any;
  code: string;
  feishuContent: string;
  promptUsed: string;
  title: string;
  confirmed: boolean;
  discarded: boolean;
  error?: string;
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
  const [selectedSpec, setSelectedSpec] = useState("spoke-default");

  // Feishu docs
  const [feishuDocs, setFeishuDocs] = useState<FeishuDoc[]>([]);
  const [feishuSearch, setFeishuSearch] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingDoc, setSyncingDoc] = useState<string | null>(null);

  // Single mode state
  const [pendingSave, setPendingSave] = useState<{
    generatedJson: any;
    feishuContent: string;
    promptUsed: string;
    title: string;
    firstDoc: FeishuDoc | undefined;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Batch mode state
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [activeBatchTab, setActiveBatchTab] = useState("0");
  const [batchProgress, setBatchProgress] = useState<{ total: number; done: number } | null>(null);

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentProject) {
      getThemes(currentProject.id).then(setThemes).catch(console.error);
      getComponentSpecs(currentProject.id).then(setSpecs).catch(console.error);
      loadPromptConfig(currentProject.id, "spoke").then((saved) => {
        if (saved) setPrompt(saved);
      });
    }
  }, [currentProject]);

  useEffect(() => {
    if (selectedTheme) {
      setFeishuDocs([]);
      setSelectedDocs([]);
      setMode("single");
      setBatchResults([]);
      handleLoadDocuments();
      // Auto-load component spec for this theme
      if (currentProject) {
        getComponentSpecsByTheme(currentProject.id, selectedTheme).then((themeSpecs: any[]) => {
          const spokeSpec = themeSpecs.find((s: any) => s.type === "spoke");
          setSelectedSpec(spokeSpec ? spokeSpec.id : "spoke-default");
        }).catch(() => setSelectedSpec("spoke-default"));
      }
    }
  }, [selectedTheme]);

  const handleSavePrompt = (val: string) => {
    if (currentProject) savePromptConfig(currentProject.id, "spoke", val);
  };

  const handleLoadDocuments = async () => {
    if (!currentProject || !selectedTheme) return;
    const themeObj = themes.find((t) => t.id === selectedTheme);
    const folderToken = themeObj?.feishu_doc_token;
    if (!folderToken) {
      setFeishuDocs([]);
      toast({ title: "当前主题未关联飞书文件夹", variant: "destructive" });
      return;
    }
    setLoadingDocs(true);
    try {
      const res = await fetchFeishuDocs(feishuSearch || undefined, folderToken);
      let docs: FeishuDoc[] = [];
      if (res?.data?.files) {
        docs = res.data.files.map((f: any) => ({
          token: f.token, name: f.name, type: f.type, url: f.url,
          modifiedTime: f.modified_time ? new Date(Number(f.modified_time) * 1000).toISOString() : undefined,
        }));
      } else if (res?.data?.docs_entities) {
        docs = res.data.docs_entities.map((d: any) => ({
          token: d.docs_token, name: d.title, type: d.docs_type, url: d.url,
          modifiedTime: d.edit_time ? new Date(Number(d.edit_time) * 1000).toISOString() : undefined,
        }));
      }

      try {
        const [dbDocs, spokesRes] = await Promise.all([
          getDocuments(currentProject.id),
          import("@/integrations/supabase/client").then(m =>
            m.supabase.from("spokes").select("feishu_doc_token, updated_at").eq("theme_id", selectedTheme)
          ),
        ]);
        const dbMap = new Map(dbDocs.map((d: any) => [d.token, d.content]));
        const spokeMap = new Map(
          (spokesRes.data || []).map((s: any) => [s.feishu_doc_token, s.updated_at])
        );
        docs = docs.map((d) => ({
          ...d,
          manualContent: (dbMap.get(d.token) as string) || undefined,
          lastGeneratedAt: (spokeMap.get(d.token) as string) || undefined,
        }));
      } catch (e) {
        console.warn("DB 文档/Spoke 加载失败:", e);
      }

      setFeishuDocs(docs);
    } catch (e) {
      console.error("Failed to load documents:", e);
      toast({ title: "文档加载失败", variant: "destructive" });
    } finally {
      setLoadingDocs(false);
    }
  };

  // Batch content sync (all selected docs or all docs)
  const handleSyncContent = async () => {
    if (!currentProject || feishuDocs.length === 0) return;
    const docsToSync = selectedDocs.length > 0
      ? feishuDocs.filter(d => selectedDocs.includes(d.token))
      : feishuDocs;
    if (docsToSync.length === 0) return;

    setSyncing(true);
    let syncCount = 0;
    let failCount = 0;
    const updated = [...feishuDocs];

    for (const doc of docsToSync) {
      const idx = updated.findIndex(d => d.token === doc.token);
      try {
        const result = await extractFirstCode(doc.token);
        const codeContent = result.found && result.code_content ? result.code_content : undefined;

        if (codeContent) {
          const dbDocs = await getDocuments(currentProject.id);
          const exists = dbDocs.some((d: any) => d.token === doc.token);
          if (exists) {
            await updateDocument(currentProject.id, doc.token, { name: doc.name, content: codeContent });
          } else {
            await createDocument({
              project_id: currentProject.id, token: doc.token,
              name: doc.name, type: doc.type || "docx", content: codeContent,
            });
          }
          if (idx >= 0) updated[idx] = { ...doc, manualContent: codeContent };
          syncCount++;
        }
      } catch (e) {
        console.warn(`文档 ${doc.name} 代码提取失败:`, e);
        failCount++;
      }
    }

    setFeishuDocs(updated);
    setSyncing(false);
    if (syncCount > 0) {
      toast({ title: `已同步 ${syncCount} 个文档${failCount > 0 ? `，${failCount} 个失败` : ""}` });
    } else if (failCount > 0) {
      toast({ title: `同步失败（${failCount} 个），请检查飞书应用权限`, variant: "destructive" });
    } else {
      toast({ title: "未找到包含代码块的文档" });
    }
  };

  // Single doc sync
  const handleSyncSingle = async (doc: FeishuDoc) => {
    if (!currentProject) return;
    setSyncingDoc(doc.token);
    try {
      const result = await extractFirstCode(doc.token);
      const codeContent = result.found && result.code_content ? result.code_content : undefined;
      if (codeContent) {
        const dbDocs = await getDocuments(currentProject.id);
        const exists = dbDocs.some((d: any) => d.token === doc.token);
        if (exists) {
          await updateDocument(currentProject.id, doc.token, { name: doc.name, content: codeContent });
        } else {
          await createDocument({
            project_id: currentProject.id, token: doc.token,
            name: doc.name, type: doc.type || "docx", content: codeContent,
          });
        }
        setFeishuDocs(prev => prev.map(d => d.token === doc.token ? { ...d, manualContent: codeContent } : d));
        toast({ title: `${doc.name} 同步成功` });
      } else {
        toast({ title: "未找到代码块内容", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: `同步失败: ${e.message}`, variant: "destructive" });
    } finally {
      setSyncingDoc(null);
    }
  };

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      setScrapedData((prev) => prev ? `${prev}\n\n---\n\n${content}` : content);
      toast({ title: `已加载文件: ${file.name}` });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const toggleDoc = (token: string) => {
    setSelectedDocs((prev) => {
      const next = prev.includes(token) ? prev.filter((t) => t !== token) : [...prev, token];
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
        token: data.token, name: data.name, type: "manual",
        content: data.content || undefined,
      });
      setFeishuDocs((prev) => [{ token: data.token, name: data.name, type: "manual", manualContent: data.content || undefined, isNew: true }, ...prev]);
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
        prev.map((d) => d.token === data.token ? { ...d, name: data.name, manualContent: data.content || undefined } : d)
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

      let existingJsonContext = "";
      if (firstDoc?.token) {
        try {
          const { data: existingSpoke } = await import("@/integrations/supabase/client").then(m =>
            m.supabase.from("spokes").select("json_data").eq("theme_id", selectedTheme).eq("feishu_doc_token", firstDoc.token).maybeSingle()
          );
          if (existingSpoke?.json_data) {
            existingJsonContext = `\n\n【已有 Spoke JSON（请在此基础上修改内容，保留结构）】\n${JSON.stringify(existingSpoke.json_data, null, 2)}`;
          }
        } catch (e) {
          console.warn("查找已有 Spoke JSON 失败:", e);
        }
      }

      const contextParts = [scrapedData, existingJsonContext].filter(Boolean).join("\n");

      const result = await generateJson({
        type: "spoke",
        feishu_content: feishuContent,
        custom_prompt: prompt || undefined,
        context: contextParts || undefined,
      });

      const generatedJson = result.generated_json;
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
      await upsertSpoke(selectedTheme, pendingSave.firstDoc?.token || null, {
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

  // Batch generate: generate all but DON'T save - store results for review
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
    setBatchResults([]);
    setBatchProgress({ total: selectedDocs.length, done: 0 });
    setOutput("");
    setValidation("idle");

    const results: BatchResult[] = [];
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

        let existingJsonContext = "";
        if (doc?.token) {
          try {
            const { supabase } = await import("@/integrations/supabase/client");
            const { data: existingSpoke } = await supabase.from("spokes").select("json_data").eq("theme_id", selectedTheme).eq("feishu_doc_token", doc.token).maybeSingle();
            if (existingSpoke?.json_data) {
              existingJsonContext = `\n\n【已有 Spoke JSON（请在此基础上修改内容，保留结构）】\n${JSON.stringify(existingSpoke.json_data, null, 2)}`;
            }
          } catch (e) {
            console.warn("查找已有 Spoke JSON 失败:", e);
          }
        }

        const contextParts = [scrapedData, existingJsonContext].filter(Boolean).join("\n");

        const result = await generateJson({
          type: "spoke",
          feishu_content: feishuContent,
          custom_prompt: prompt || undefined,
          context: contextParts || undefined,
        });
        const generatedJson = result.generated_json;
        const themeName = themes.find((t) => t.id === selectedTheme)?.name;
        if (generatedJson && typeof generatedJson === "object" && themeName) {
          (generatedJson as any).hubSlug = themeName;
        }
        const title = generatedJson?.title || docTitle;
        const code = JSON.stringify(generatedJson, null, 2);

        results.push({
          doc: doc || { token: selectedDocs[i], name: docTitle, type: "unknown" },
          generatedJson, code, feishuContent,
          promptUsed: result.prompt_used || prompt,
          title, confirmed: false, discarded: false,
        });
      } catch (e: any) {
        results.push({
          doc: doc || { token: selectedDocs[i], name: docTitle, type: "unknown" },
          generatedJson: null,
          code: JSON.stringify({ error: e.message }, null, 2),
          feishuContent: "", promptUsed: prompt,
          title: docTitle, confirmed: false, discarded: false,
          error: e.message,
        });
      }
      setBatchProgress({ total: selectedDocs.length, done: i + 1 });
    }

    setBatchResults(results);
    setActiveBatchTab("0");
    setLoading(false);
    setBatchProgress(null);
    toast({ title: "批量生成完成，请逐个检查后确认保存" });
  };

  // Confirm a single batch result
  const handleConfirmBatchItem = async (index: number, editedCode: string) => {
    const r = batchResults[index];
    if (!r || r.confirmed || r.discarded) return;
    try {
      const editedJson = JSON.parse(editedCode);
      await saveJsonRecord({
        type: "spoke",
        feishu_content: r.feishuContent,
        prompt_content: r.promptUsed,
        generated_json: editedJson,
      });
      await upsertSpoke(selectedTheme, r.doc.token || null, {
        title: editedJson?.title || r.title,
        json_data: editedJson,
        feishu_doc_token: r.doc.token || null,
        feishu_doc_title: r.doc.name || null,
        status: "generated",
      });
      setBatchResults(prev => prev.map((item, i) =>
        i === index ? { ...item, confirmed: true, code: editedCode } : item
      ));
      toast({ title: `${r.title} 已确认保存` });
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" });
    }
  };

  // Discard a single batch result
  const handleDiscardBatchItem = (index: number) => {
    setBatchResults(prev => prev.map((item, i) =>
      i === index ? { ...item, discarded: true } : item
    ));
    toast({ title: "已放弃该生成结果" });
  };

  const filteredDocs = feishuDocs.filter((d) =>
    !feishuSearch || d.name.toLowerCase().includes(feishuSearch.toLowerCase())
  );

  const spokeSpecs = specs.filter((s) => s.type === "spoke");

  const batchConfirmedCount = batchResults.filter(r => r.confirmed).length;
  const batchDiscardedCount = batchResults.filter(r => r.discarded).length;

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
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    onClick={() => {
                      if (selectedDocs.length === filteredDocs.length && filteredDocs.length > 0) {
                        setSelectedDocs([]);
                        setMode("single");
                      } else {
                        setSelectedDocs(filteredDocs.map((d) => d.token));
                        if (filteredDocs.length > 1) setMode("batch");
                      }
                    }}
                  >
                    {selectedDocs.length === filteredDocs.length && filteredDocs.length > 0 ? "取消全选" : "全选"}
                  </Button>
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
                <Button variant="outline" size="sm" onClick={handleSyncContent} disabled={syncing || feishuDocs.length === 0} className="h-9 text-xs gap-1">
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  内容同步
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
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {doc.modifiedTime && (
                          <span title="飞书最后修改">📝 {new Date(doc.modifiedTime).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                        )}
                        {doc.lastGeneratedAt && (
                          <span title="JSON 最后生成" className="text-primary/70">⚡ {new Date(doc.lastGeneratedAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                        )}
                        {!doc.modifiedTime && !doc.lastGeneratedAt && (
                          <span className="font-mono">{doc.token}</span>
                        )}
                      </div>
                    </div>
                    {/* Per-doc sync button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSyncSingle(doc); }}
                      title="同步此文档"
                      disabled={syncingDoc === doc.token}
                    >
                      {syncingDoc === doc.token ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    </Button>
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">文档内容</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                placeholder={mode === "batch" ? "文档内容将应用于所有选中文档的生成…" : "补充的原始文本内容、行业背景、关键词等…"}
                value={scrapedData}
                onChange={(e) => setScrapedData(e.target.value)}
                className="min-h-[100px] font-mono text-xs"
              />
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.csv,.json,.mdx"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" />
                  上传文档
                </Button>
                <span className="text-[10px] text-muted-foreground">支持 .txt, .md, .csv, .json 格式</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">组件规范</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedSpec} onValueChange={setSelectedSpec}>
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
            {/* Batch: show progress during generation */}
            {mode === "batch" && batchProgress && loading ? (
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
                <div className="flex items-center gap-2 text-xs p-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  正在生成中…
                </div>
              </div>
            ) : mode === "batch" && batchResults.length > 0 ? (
              /* Batch: show tabs for review after generation */
              <div className="flex-1 flex flex-col min-h-0">
                <div className="border-b px-2 py-1 flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">
                    ✅ {batchConfirmedCount} 已确认 / ❌ {batchDiscardedCount} 已放弃 / 共 {batchResults.length}
                  </span>
                </div>
                <Tabs value={activeBatchTab} onValueChange={setActiveBatchTab} className="flex-1 flex flex-col min-h-0">
                  <div className="border-b px-2 overflow-x-auto shrink-0">
                    <TabsList className="bg-transparent h-9 w-max">
                      {batchResults.map((r, i) => (
                        <TabsTrigger key={i} value={String(i)} className="text-[10px] gap-1 max-w-[120px]">
                          {r.confirmed ? "✅" : r.discarded ? "❌" : r.error ? "⚠️" : "⏳"}
                          <span className="truncate">{r.doc.name.length > 12 ? r.doc.name.slice(0, 12) + "…" : r.doc.name}</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                  {batchResults.map((r, i) => (
                    <TabsContent key={i} value={String(i)} className="flex-1 m-0 min-h-0">
                      <CodeViewer
                        code={r.code}
                        filename={`${r.title}.json`}
                        editable={!r.confirmed && !r.discarded && !r.error}
                        onConfirm={(editedCode) => handleConfirmBatchItem(i, editedCode)}
                        onDiscard={() => handleDiscardBatchItem(i)}
                        confirmed={r.confirmed}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            ) : (
              /* Single mode */
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
