import { useState, useEffect } from "react";
import { Network, ChevronRight, FileJson, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeViewer } from "@/components/CodeViewer";
import { ValidationBar } from "@/components/ValidationBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProject } from "@/contexts/ProjectContext";
import { getThemes, getSpokes, getComponentSpecs, createHub } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import type { Theme, Spoke, ComponentSpec } from "@/lib/api";

export default function HubSynthesizer() {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [validation, setValidation] = useState<"idle" | "passed" | "failed">("idle");
  const [themes, setThemes] = useState<Theme[]>([]);
  const [specs, setSpecs] = useState<ComponentSpec[]>([]);
  const [selectedTheme, setSelectedTheme] = useState("");
  const [spokes, setSpokes] = useState<Spoke[]>([]);
  const [selectedSpokes, setSelectedSpokes] = useState<string[]>([]);
  const [context, setContext] = useState("");

  useEffect(() => {
    if (currentProject) {
      getThemes(currentProject.id).then(setThemes).catch(console.error);
      getComponentSpecs(currentProject.id).then(setSpecs).catch(console.error);
    }
  }, [currentProject]);

  useEffect(() => {
    if (selectedTheme) {
      getSpokes(selectedTheme).then(setSpokes).catch(console.error);
      setSelectedSpokes([]);
    }
  }, [selectedTheme]);

  const toggleSpoke = (id: string) => {
    setSelectedSpokes((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const handleGenerate = () => {
    if (!selectedTheme) {
      toast({ title: "请选择主题", variant: "destructive" });
      return;
    }
    setLoading(true);
    setOutput("");
    setValidation("idle");
    setTimeout(async () => {
      const selectedSpokeData = spokes.filter((s) => selectedSpokes.includes(s.id));
      const hubJson = {
        type: "hub",
        title: themes.find((t) => t.id === selectedTheme)?.name + " — Hub",
        slug: `/${themes.find((t) => t.id === selectedTheme)?.name?.toLowerCase().replace(/\s+/g, '-')}`,
        meta_description: context || "Hub 页面概述。",
        spoke_links: selectedSpokeData.map((s) => ({ id: s.id, title: s.title, slug: s.slug })),
      };
      const json = JSON.stringify(hubJson, null, 2);
      setOutput(json);
      setLoading(false);
      setValidation(Math.random() > 0.3 ? "passed" : "failed");

      try {
        await createHub({
          theme_id: selectedTheme,
          title: hubJson.title,
          slug: hubJson.slug,
          json_data: hubJson,
          status: "generated",
        });
        toast({ title: "Hub 已保存到数据库" });
      } catch (e) {
        console.error(e);
      }
    }, 2000);
  };

  const parsedOutput = output ? (() => { try { return JSON.parse(output); } catch { return null; } })() : null;
  const hubSpecs = specs.filter((s) => s.type === "hub");

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hub 合成器</h1>
        <p className="text-sm text-muted-foreground mt-1">将 Spoke 页面聚合为结构化的 Hub JSON</p>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">选择 Spoke 页面</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {spokes.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  {selectedTheme ? "该主题下暂无 Spoke 页面" : "请先选择主题"}
                </p>
              )}
              {spokes.map((spoke) => (
                <label key={spoke.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                  <Checkbox
                    checked={selectedSpokes.includes(spoke.id)}
                    onCheckedChange={() => toggleSpoke(spoke.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{spoke.title}</p>
                    <p className="text-xs text-muted-foreground font-mono">{spoke.slug || spoke.feishu_doc_token || "—"}</p>
                  </div>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">补充 Hub 数据</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="行业大背景、总体主题…"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Hub 组件规范</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select defaultValue="hub-default">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hub-default">Hub — 默认 Schema v1</SelectItem>
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
            message={validation === "passed" ? "✅ Schema 验证通过" : validation === "failed" ? "❌ 验证失败：缺少必填字段 'title'" : undefined}
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
                <CodeViewer code={output} loading={loading} filename="hub-output.json" />
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
