import { useState, useEffect } from "react";
import { Upload, FileText, Save, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useProject } from "@/contexts/ProjectContext";
import { getThemes, getComponentSpecs, getComponentSpecsByTheme, upsertComponentSpecByTheme, deleteComponentSpec } from "@/lib/api";
import type { ComponentSpec, Theme } from "@/lib/api";

const SAMPLE_HUB_JSON = `{
  "type": "hub",
  "title": "云基础设施指南",
  "slug": "/cloud-infrastructure",
  "meta_description": "...",
  "hero": { "heading": "...", "subheading": "..." },
  "spoke_links": []
}`;

const SAMPLE_SPOKE_JSON = `{
  "type": "spoke",
  "title": "AWS EC2 部署指南",
  "slug": "/cloud-infrastructure/aws-ec2",
  "parent_hub": "/cloud-infrastructure",
  "sections": [],
  "cta": { "text": "立即开始", "url": "#" }
}`;

export default function ComponentSpecs() {
  const { currentProject } = useProject();
  const [files, setFiles] = useState<string[]>([]);
  const [hubJson, setHubJson] = useState(SAMPLE_HUB_JSON);
  const [spokeJson, setSpokeJson] = useState(SAMPLE_SPOKE_JSON);
  const [dragOver, setDragOver] = useState(false);
  const [savedSpecs, setSavedSpecs] = useState<ComponentSpec[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState("");

  useEffect(() => {
    if (currentProject) {
      getThemes(currentProject.id).then(setThemes).catch(console.error);
      getComponentSpecs(currentProject.id).then(setSavedSpecs).catch(console.error);
    }
  }, [currentProject]);

  // Load specs when theme changes
  useEffect(() => {
    if (currentProject && selectedTheme) {
      getComponentSpecsByTheme(currentProject.id, selectedTheme).then((specs: any[]) => {
        const hubSpec = specs.find((s: any) => s.type === "hub");
        const spokeSpec = specs.find((s: any) => s.type === "spoke");
        if (hubSpec?.json_schema) {
          setHubJson(typeof hubSpec.json_schema === "string" ? hubSpec.json_schema : JSON.stringify(hubSpec.json_schema, null, 2));
        } else {
          setHubJson(SAMPLE_HUB_JSON);
        }
        if (spokeSpec?.json_schema) {
          setSpokeJson(typeof spokeSpec.json_schema === "string" ? spokeSpec.json_schema : JSON.stringify(spokeSpec.json_schema, null, 2));
        } else {
          setSpokeJson(SAMPLE_SPOKE_JSON);
        }
      }).catch(console.error);
    } else {
      setHubJson(SAMPLE_HUB_JSON);
      setSpokeJson(SAMPLE_SPOKE_JSON);
    }
  }, [selectedTheme, currentProject]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const newFiles = Array.from(e.dataTransfer.files).map((f) => f.name);
    setFiles((prev) => [...prev, ...newFiles]);
    toast({ title: "文件已上传", description: `已添加 ${newFiles.length} 个文件` });
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    toast({ title: "文件已移除" });
  };

  const handleDeleteSpec = async (id: string) => {
    try {
      await deleteComponentSpec(id);
      setSavedSpecs((prev) => prev.filter((s) => s.id !== id));
      toast({ title: "规范已删除" });
    } catch (e) {
      console.error(e);
      toast({ title: "删除失败", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!currentProject) {
      toast({ title: "请先选择项目", variant: "destructive" });
      return;
    }
    if (!selectedTheme) {
      toast({ title: "请先选择主题", variant: "destructive" });
      return;
    }
    try {
      let hubParsed, spokeParsed;
      try { hubParsed = JSON.parse(hubJson); } catch { hubParsed = hubJson; }
      try { spokeParsed = JSON.parse(spokeJson); } catch { spokeParsed = spokeJson; }

      const themeName = themes.find((t) => t.id === selectedTheme)?.name || "未知主题";
      await upsertComponentSpecByTheme({
        project_id: currentProject.id,
        theme_id: selectedTheme,
        name: `${themeName} - Hub Schema`,
        type: "hub",
        json_schema: hubParsed,
      });
      await upsertComponentSpecByTheme({
        project_id: currentProject.id,
        theme_id: selectedTheme,
        name: `${themeName} - Spoke Schema`,
        type: "spoke",
        json_schema: spokeParsed,
      });
      toast({ title: "规范已保存", description: `已为主题「${themeName}」保存组件规范。` });
      getComponentSpecs(currentProject.id).then(setSavedSpecs);
    } catch (e) {
      console.error(e);
      toast({ title: "保存失败", variant: "destructive" });
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">组件规范</h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理约束文档并定义各主题下 Hub 和 Spoke 组件的 JSON 模式。
          {currentProject && <span className="text-primary ml-1">当前项目: {currentProject.name}</span>}
        </p>
      </div>

      {/* Theme selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">选择主题</CardTitle>
          <CardDescription>不同主题可配置不同的初始 JSON 模板</CardDescription>
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

      {savedSpecs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">已保存的规范</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {savedSpecs.map((s) => (
                <Badge key={s.id} variant="secondary" className="gap-1.5 text-xs group">
                  {s.type === "hub" ? "🔗" : "📄"} {s.name}
                  <button
                    onClick={() => handleDeleteSpec(s.id)}
                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="删除规范"
                  >
                    <X className="h-3 w-3 text-destructive" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">约束文档</CardTitle>
          <CardDescription>上传 PDF 或 Markdown 规范文件（通用文档管理入口）</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => {
              setFiles((prev) => [...prev, `spec-doc-${prev.length + 1}.pdf`]);
              toast({ title: "文件已添加（模拟）" });
            }}
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
            }`}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">将 PDF/Markdown 文件拖放到此处，或点击浏览</p>
            <p className="text-xs text-muted-foreground/60 mt-1">支持 .pdf、.md、.mdx 格式</p>
          </div>
          {files.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <Badge key={i} variant="secondary" className="gap-1.5 font-mono text-xs group">
                  <FileText className="h-3 w-3" />
                  {f}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveFile(i); }}
                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="移除文件"
                  >
                    <X className="h-3 w-3 text-destructive" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hub JSON 示例</CardTitle>
            <CardDescription>{selectedTheme ? `主题: ${themes.find(t => t.id === selectedTheme)?.name}` : "请先选择主题"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea value={hubJson} onChange={(e) => setHubJson(e.target.value)} className="font-mono text-xs min-h-[200px] bg-code text-code-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spoke JSON 示例</CardTitle>
            <CardDescription>{selectedTheme ? `主题: ${themes.find(t => t.id === selectedTheme)?.name}` : "请先选择主题"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea value={spokeJson} onChange={(e) => setSpokeJson(e.target.value)} className="font-mono text-xs min-h-[200px] bg-code text-code-foreground" />
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave} className="gap-2" disabled={!selectedTheme}>
        <Save className="h-4 w-4" />
        保存规范
      </Button>
      </div>
    </div>
  );
}
