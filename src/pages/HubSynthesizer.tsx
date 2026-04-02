import { useState, useEffect, useMemo, useRef } from "react";
import { Network, ChevronRight, FileJson, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeViewer } from "@/components/CodeViewer";
import { ValidationBar } from "@/components/ValidationBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useProject } from "@/contexts/ProjectContext";
import { getThemes, getSpokes, getComponentSpecs, getComponentSpecsByTheme, createHub, updateHub, findHubByTheme } from "@/lib/api";
import { generateJson, saveJsonRecord } from "@/lib/generate";
import { toast } from "@/hooks/use-toast";
import type { Theme, Spoke, ComponentSpec } from "@/lib/api";
import { PromptConfigButton } from "@/components/PromptConfigButton";
import { loadPromptConfig, savePromptConfig } from "@/lib/promptConfig";

export default function HubSynthesizer() {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [validation, setValidation] = useState<"idle" | "passed" | "failed">("idle");
  const [themes, setThemes] = useState<Theme[]>([]);
  const [specs, setSpecs] = useState<ComponentSpec[]>([]);
  const [selectedTheme, setSelectedTheme] = useState("");
  const [spokes, setSpokes] = useState<Spoke[]>([]);
  const [context, setContext] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedSpec, setSelectedSpec] = useState("hub-default");
  const [pendingSave, setPendingSave] = useState<{
    generatedJson: any;
    spokeContent: string;
    promptUsed: string;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const [uploadedJsonTemplate, setUploadedJsonTemplate] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedOutput = useMemo(() => {
    try { return output ? JSON.parse(output) : null; } catch { return null; }
  }, [output]);

  useEffect(() => {
    if (currentProject) {
      getThemes(currentProject.id).then(setThemes).catch(console.error);
      getComponentSpecs(currentProject.id).then(setSpecs).catch(console.error);
      loadPromptConfig(currentProject.id, "hub").then((saved) => {
        if (saved) setPrompt(saved);
      });
    }
  }, [currentProject]);

  const handleSavePrompt = (val: string) => {
    if (currentProject) savePromptConfig(currentProject.id, "hub", val);
  };

  useEffect(() => {
    if (selectedTheme) {
      getSpokes(selectedTheme).then(setSpokes).catch(console.error);
      if (currentProject) {
        getComponentSpecsByTheme(currentProject.id, selectedTheme).then((themeSpecs: any[]) => {
          const hubSpec = themeSpecs.find((s: any) => s.type === "hub");
          setSelectedSpec(hubSpec ? hubSpec.id : "hub-default");
        }).catch(() => setSelectedSpec("hub-default"));
      }
    }
  }, [selectedTheme, currentProject]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (file.name.endsWith(".json")) {
          setUploadedJsonTemplate(text);
          toast({ title: `已加载 JSON 模板: ${file.name}` });
        } else {
          setUploadedFiles((prev) => [...prev, { name: file.name, content: text }]);
          toast({ title: `已加载文件: ${file.name}` });
        }
      };
      reader.readAsText(file);
    });
    e.target.value = "";
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeJsonTemplate = () => {
    setUploadedJsonTemplate(null);
    toast({ title: "已移除 JSON 模板" });
  };

  const handleGenerate = async () => {
    if (!selectedTheme) {
      toast({ title: "请选择主题", variant: "destructive" });
      return;
    }
    setLoading(true);
    setOutput("");
    setValidation("idle");

    try {
      const spokeContent = JSON.stringify(
        spokes.map((s) => ({
          title: s.title,
          slug: s.slug,
          json_data: s.json_data,
        })),
        null,
        2
      );

      // Build combined context: 补充内容 + uploaded file contents
      const contextParts: string[] = [];
      if (context.trim()) contextParts.push(context.trim());
      for (const f of uploadedFiles) {
        contextParts.push(`--- 上传文件: ${f.name} ---\n${f.content}`);
      }

      // Build custom prompt with JSON template priority
      let finalPrompt = prompt || "";
      if (uploadedJsonTemplate) {
        finalPrompt += `\n\n【重要】用户提供了 JSON 模板，必须严格按照以下 JSON 结构和字段格式生成，仅替换内容：\n${uploadedJsonTemplate}`;
      }

      const result = await generateJson({
        type: "hub",
        feishu_content: spokeContent,
        custom_prompt: finalPrompt || undefined,
        context: contextParts.length > 0 ? contextParts.join("\n\n") : undefined,
      });

      const generatedJson = result.generated_json;
      const json = JSON.stringify(generatedJson, null, 2);
      setOutput(json);
      setValidation(generatedJson && typeof generatedJson === "object" ? "passed" : "failed");

      setPendingSave({
        generatedJson,
        spokeContent,
        promptUsed: result.prompt_used || prompt,
      });
      setConfirmed(false);
      toast({ title: "Hub JSON 已生成，请检查后确认保存" });
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
        type: "hub",
        feishu_content: pendingSave.spokeContent,
        prompt_content: pendingSave.promptUsed,
        generated_json: editedJson,
      });

      const existingHub = await findHubByTheme(selectedTheme);
      const hubPayload = {
        title: editedJson?.title || themes.find((t) => t.id === selectedTheme)?.name + " — Hub",
        slug: editedJson?.slug || null,
        json_data: editedJson,
        status: "generated",
      };

      if (existingHub) {
        await updateHub(existingHub.id, hubPayload);
        toast({ title: "Hub 已更新保存（覆盖已有记录）" });
      } else {
        await createHub({ ...hubPayload, theme_id: selectedTheme });
        toast({ title: "Hub 已新建保存" });
      }

      setOutput(editedCode);
      setConfirmed(true);
      setPendingSave(null);
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

  const hubSpecs = specs.filter((s) => s.type === "hub");

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Hub 合成器</h1>
          <PromptConfigButton value={prompt} onChange={setPrompt} onConfirm={handleSavePrompt} placeholder="输入 Hub 合成的 system prompt…" />
        </div>
        <p className="text-sm text-muted-foreground mt-1">将 Spoke 页面聚合为结构化的 Hub JSON（默认引用主题下所有 Spoke 页面）</p>
      </div>

      <div className="flex-1 grid lg:grid-cols-2 gap-4 min-h-0">
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
                </SelectContent>
              </Select>
              {selectedTheme && spokes.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-muted-foreground">已引用 Spoke 页面（{spokes.length} 个）：</p>
                  <div className="flex flex-wrap gap-1">
                    {spokes.map((s) => (
                      <Badge key={s.id} variant="outline" className="text-[10px]">{s.title}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {selectedTheme && spokes.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">该主题下暂无 Spoke 页面</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">补充内容</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="行业大背景、总体主题、额外补充信息…"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="min-h-[100px]"
              />
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.json,.csv"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  上传文档
                </Button>
                <p className="text-xs text-muted-foreground mt-1">支持 .txt / .md / .json / .csv，JSON 文件将作为格式模板</p>
              </div>
              {uploadedJsonTemplate && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
                  <FileJson className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">JSON 模板已加载</span>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-auto" onClick={removeJsonTemplate}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {uploadedFiles.length > 0 && (
                <div className="space-y-1">
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/50">
                      <span className="truncate flex-1">{f.name}</span>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeUploadedFile(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Hub 组件规范</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedSpec} onValueChange={setSelectedSpec}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hub-default">Tripo_Schema (内置默认)</SelectItem>
                  {hubSpecs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleGenerate} className="w-full gap-2" disabled={loading}>
                <Network className="h-4 w-4" />
                合成 Hub JSON ✨
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3 min-h-0">
          <ValidationBar
            status={validation}
            message={validation === "passed" ? "✅ Schema 验证通过" : validation === "failed" ? "❌ 验证失败：返回内容不是有效的 JSON 对象" : undefined}
          />
          <Card className="flex-1 min-h-0 flex flex-col">
            <Tabs defaultValue="json" className="flex-1 flex flex-col">
              <div className="border-b px-4">
                <TabsList className="bg-transparent h-9">
                  <TabsTrigger value="json" className="text-xs">JSON 输出</TabsTrigger>
                  <TabsTrigger value="tree" className="text-xs">树形视图</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="json" className="flex-1 m-0">
                <CodeViewer code={output} loading={loading} filename="hub-output.json" editable={!!pendingSave} onConfirm={handleConfirmSave} onDiscard={handleDiscardSave} confirmed={confirmed} />
              </TabsContent>
              <TabsContent value="tree" className="flex-1 m-0 p-4 overflow-auto">
                {parsedOutput ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
                      <Network className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">{parsedOutput.title}</span>
                      <span className="text-xs text-muted-foreground font-mono ml-auto">{parsedOutput.slug}</span>
                    </div>
                    <div className="ml-4 space-y-1">
                      {parsedOutput.spoke_links?.map((link: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 border border-transparent hover:border-border transition-colors">
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <FileJson className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{link.title}</span>
                          <span className="text-xs text-muted-foreground font-mono ml-auto">{link.slug || "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">生成 Hub JSON 后可查看树形视图</p>
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
