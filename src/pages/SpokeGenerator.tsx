import { useState, useEffect } from "react";
import { Sparkles, FileText, Search, Loader2, ChevronDown, ChevronRight } from "lucide-react";
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
import { getThemes, getComponentSpecs, createSpoke } from "@/lib/api";
import { fetchFeishuDocs, fetchFeishuDocContent } from "@/lib/feishu";
import { generateJson, saveJsonRecord } from "@/lib/generate";
import { toast } from "@/hooks/use-toast";
import type { Theme, ComponentSpec } from "@/lib/api";
import { PromptConfigButton } from "@/components/PromptConfigButton";

interface FeishuDoc {
  token: string;
  name: string;
  type: string;
  url?: string;
}

const MOCK_FEISHU_DOCS: FeishuDoc[] = [
  { token: "doxcnXYZ001", name: "AWS EC2 部署最佳实践", type: "docx" },
  { token: "doxcnXYZ002", name: "Kubernetes 入门教程", type: "docx" },
  { token: "doxcnXYZ003", name: "Docker 容器化指南", type: "docx" },
  { token: "doxcnXYZ004", name: "CI/CD 流水线配置", type: "docx" },
  { token: "doxcnXYZ005", name: "微服务架构设计", type: "docx" },
  { token: "doxcnXYZ006", name: "数据库性能优化", type: "docx" },
  { token: "doxcnXYZ007", name: "API 网关方案对比", type: "docx" },
];


export default function SpokeGenerator() {
  const { currentProject } = useProject();
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [validation, setValidation] = useState<"idle" | "passed" | "failed">("idle");
  const [themes, setThemes] = useState<Theme[]>([]);
  const [specs, setSpecs] = useState<ComponentSpec[]>([]);
  const [selectedTheme, setSelectedTheme] = useState("");
  const [keyword, setKeyword] = useState("");
  const [author, setAuthor] = useState("");
  const [cta, setCta] = useState("");
  const [scrapedData, setScrapedData] = useState("");
  const [prompt, setPrompt] = useState("");

  // Feishu docs
  const [feishuDocs, setFeishuDocs] = useState<FeishuDoc[]>(MOCK_FEISHU_DOCS);
  const [feishuSearch, setFeishuSearch] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ total: number; done: number; results: { title: string; success: boolean }[] } | null>(null);

  useEffect(() => {
    if (currentProject) {
      getThemes(currentProject.id).then(setThemes).catch(console.error);
      getComponentSpecs(currentProject.id).then(setSpecs).catch(console.error);
    }
  }, [currentProject]);

  const handleLoadFeishuDocs = async () => {
    setLoadingDocs(true);
    try {
      const res = await fetchFeishuDocs(feishuSearch || undefined);
      if (res?.data?.files) {
        setFeishuDocs(res.data.files.map((f: any) => ({ token: f.token, name: f.name, type: f.type, url: f.url })));
      } else if (res?.data?.docs_entities) {
        setFeishuDocs(res.data.docs_entities.map((d: any) => ({ token: d.docs_token, name: d.title, type: d.docs_type, url: d.url })));
      }
    } catch (e) {
      console.error("Failed to load feishu docs, using mock data:", e);
      toast({ title: "飞书文档加载失败", description: "使用模拟数据显示。请检查飞书应用权限配置。", variant: "destructive" });
    } finally {
      setLoadingDocs(false);
    }
  };

  const toggleDoc = (token: string) => {
    setSelectedDocs((prev) => prev.includes(token) ? prev.filter((t) => t !== token) : [...prev, token]);
  };

  const handleGenerateSingle = async () => {
    if (!selectedTheme) {
      toast({ title: "请选择主题", variant: "destructive" });
      return;
    }
    const doc = feishuDocs.find((d) => d.token === selectedDocs[0]);
    setLoading(true);
    setOutput("");
    setValidation("idle");

    try {
      // 第一步：获取飞书文档内容
      let feishuContent = scrapedData || "";
      if (doc) {
        try {
          const docRes = await fetchFeishuDocContent(doc.token, doc.type);
          feishuContent = docRes?.data?.content || JSON.stringify(docRes?.data) || doc.name;
        } catch (e) {
          console.warn("飞书文档内容获取失败，使用文档标题:", e);
          feishuContent = doc.name;
        }
      }
      if (!feishuContent && keyword) feishuContent = keyword;

      // 第二步：调用 AI 生成 Spoke JSON
      const result = await generateJson({
        type: "spoke",
        feishu_content: feishuContent,
        custom_prompt: prompt || undefined,
        context: [keyword, author, cta].filter(Boolean).join("；"),
      });

      const generatedJson = result.generated_json;
      const json = JSON.stringify(generatedJson, null, 2);
      setOutput(json);
      setValidation(generatedJson?.title ? "passed" : "failed");

      // 第三步：保存到 json_records 表
      const title = generatedJson?.title || doc?.name || keyword || "未命名 Spoke";
      await saveJsonRecord({
        type: "spoke",
        feishu_content: feishuContent,
        prompt_content: result.prompt_used || prompt,
        generated_json: generatedJson,
      });

      // 同时保存到 spokes 表
      await createSpoke({
        theme_id: selectedTheme,
        title,
        json_data: generatedJson,
        feishu_doc_token: doc?.token || null,
        feishu_doc_title: doc?.name || null,
        status: "generated",
      });
      toast({ title: "Spoke 已生成并保存" });
    } catch (e: any) {
      console.error(e);
      setValidation("failed");
      setOutput(JSON.stringify({ error: e.message }, null, 2));
      toast({ title: "生成失败", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
        // 获取飞书文档内容
        let feishuContent = docTitle;
        if (doc) {
          try {
            const docRes = await fetchFeishuDocContent(doc.token, doc.type);
            feishuContent = docRes?.data?.content || JSON.stringify(docRes?.data) || docTitle;
          } catch { /* fallback to title */ }
        }

        // 调用 AI 生成
        const result = await generateJson({
          type: "spoke",
          feishu_content: feishuContent,
          custom_prompt: prompt || undefined,
        });
        const generatedJson = result.generated_json;
        const title = generatedJson?.title || docTitle;

        // 保存到 json_records
        await saveJsonRecord({
          type: "spoke",
          feishu_content: feishuContent,
          prompt_content: result.prompt_used || prompt,
          generated_json: generatedJson,
        });

        // 保存到 spokes 表
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
            <PromptConfigButton value={prompt} onChange={setPrompt} placeholder="输入 Spoke 生成的 system prompt…" />
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
          {/* Theme selector */}
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

          {/* Feishu docs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                飞书文档
                <Badge variant="secondary" className="text-[10px]">{selectedDocs.length} 已选</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="搜索飞书文档…"
                    value={feishuSearch}
                    onChange={(e) => setFeishuSearch(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleLoadFeishuDocs} disabled={loadingDocs} className="h-9 text-xs">
                  {loadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "刷新"}
                </Button>
              </div>
              <div className="max-h-[240px] overflow-auto space-y-1">
                {filteredDocs.map((doc) => (
                  <label
                    key={doc.token}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedDocs.includes(doc.token)}
                      onCheckedChange={() => toggleDoc(doc.token)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{doc.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{doc.token}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{doc.type}</Badge>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {mode === "single" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">手动输入数据</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">目标关键词</Label>
                  <Input placeholder="例如：AWS EC2 部署指南" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">作者</Label>
                  <Input placeholder="例如：DevOps 团队" value={author} onChange={(e) => setAuthor(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">行动号召</Label>
                  <Input placeholder="例如：开始免费试用" value={cta} onChange={(e) => setCta(e.target.value)} className="mt-1" />
                </div>
                <Textarea
                  placeholder="补充的原始文本内容…"
                  value={scrapedData}
                  onChange={(e) => setScrapedData(e.target.value)}
                  className="min-h-[80px] font-mono text-xs"
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
                  <SelectItem value="spoke-default">Spoke — 默认 Schema v1</SelectItem>
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
            message={validation === "passed" ? "✅ Schema 验证通过" : validation === "failed" ? "❌ 验证失败：缺少必填字段 'title'" : undefined}
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
                  <CodeViewer code={output} loading={loading} filename="spoke-output.json" />
                </TabsContent>
              </Tabs>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
