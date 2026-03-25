import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Send, Filter, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { getProjectTree, createTheme, updateTheme, createPublicationsBatch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { ContentTree, type TreeTheme } from "@/components/ContentTree";
import { PublishDialog } from "@/components/PublishDialog";
import { CodeViewer } from "@/components/CodeViewer";
import { PromptConfigButton } from "@/components/PromptConfigButton";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { loadPromptConfig, savePromptConfig } from "@/lib/promptConfig";

const THEME_NAME_REGEX = /^[a-z0-9][a-z0-9\-]*$/;

export default function ContentBrowser() {
  const { currentProject } = useProject();
  const [allThemes, setAllThemes] = useState<TreeTheme[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<string>("");
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  const [expandedHubs, setExpandedHubs] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<{ type: "theme" | "hub" | "spoke"; data: any } | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");
  const [newThemeDesc, setNewThemeDesc] = useState("");
  const [newThemeFeishuToken, setNewThemeFeishuToken] = useState("");
  const [themeNameError, setThemeNameError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [editThemeDialogOpen, setEditThemeDialogOpen] = useState(false);
  const [editThemeName, setEditThemeName] = useState("");
  const [editThemeDesc, setEditThemeDesc] = useState("");
  const [editThemeFeishuToken, setEditThemeFeishuToken] = useState("");
  const [editThemeNameError, setEditThemeNameError] = useState("");

  // Load saved prompt
  useEffect(() => {
    if (currentProject) {
      loadPromptConfig(currentProject.id, "translate").then((saved) => {
        if (saved) setPrompt(saved);
      });
    }
  }, [currentProject]);

  const handleSavePrompt = (val: string) => {
    if (currentProject) savePromptConfig(currentProject.id, "translate", val);
  };

  const loadTree = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const data = await getProjectTree(currentProject.id);
      setAllThemes(data);
      if (!selectedThemeId && data.length > 0) {
        setSelectedThemeId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [currentProject]);

  useEffect(() => { loadTree(); }, [loadTree]);

  // Filter tree to show only the selected theme
  const filteredTree = useMemo(() => {
    if (!selectedThemeId) return [];
    const theme = allThemes.find((t) => t.id === selectedThemeId);
    return theme ? [theme] : [];
  }, [allThemes, selectedThemeId]);

  // Expand the selected theme automatically
  useEffect(() => {
    if (selectedThemeId) {
      setExpandedThemes(new Set([selectedThemeId]));
      setSelectedNode(null);
      setSelectedItems(new Set());
    }
  }, [selectedThemeId]);

  const toggleTheme = (id: string) => {
    setExpandedThemes((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleHub = (id: string) => {
    setExpandedHubs((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleItem = (id: string, type: "hub" | "spoke") => {
    const key = `${type}:${id}`;
    setSelectedItems((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  const getSelectedData = () => {
    const items: { type: "hub" | "spoke"; id: string; title: string; json_data: any }[] = [];
    for (const key of selectedItems) {
      const [type, id] = key.split(":");
      for (const theme of filteredTree) {
        if (type === "hub") {
          const hub = theme.hubs.find((h) => h.id === id);
          if (hub) items.push({ type: "hub", id: hub.id, title: hub.title, json_data: hub.json_data });
        } else {
          const spoke = [...theme.hubs.flatMap((h) => h.spokes), ...theme.unlinkedSpokes].find((s) => s.id === id);
          if (spoke) items.push({ type: "spoke", id: spoke.id, title: spoke.title, json_data: spoke.json_data });
        }
      }
    }
    return items;
  };

  const handlePublish = async (languages: string[]) => {
    if (!currentProject) return;
    setPublishing(true);
    try {
      const items = getSelectedData();

      // 1. 存储到数据库
      const pubs = items.flatMap((item) =>
        languages.map((lang) => ({
          project_id: currentProject.id,
          source_type: item.type,
          source_id: item.id,
          title: item.title,
          language: lang,
          json_data: item.json_data,
          status: "published" as const,
        }))
      );
      await createPublicationsBatch(pubs);

      // 2. 调用外部 API 推送
      try {
        const { data: extResult, error: extError } = await supabase.functions.invoke("publish-external", {
          body: {
            items: items.map((item) => ({
              id: item.id,
              type: item.type,
              title: item.title,
              json_data: item.json_data,
            })),
            languages,
          },
        });
        if (extError) {
          console.error("外部 API 推送失败:", extError);
          toast({ title: `已保存到数据库，但外部推送失败: ${extError.message}`, variant: "destructive" });
        } else if (extResult?.failed > 0) {
          toast({ title: `已发布 ${items.length} 项 × ${languages.length} 语言，外部推送部分失败 (${extResult.failed}/${extResult.total})`, variant: "destructive" });
        } else {
          toast({ title: `已发布 ${items.length} 项内容 × ${languages.length} 种语言（含外部推送）` });
        }
      } catch (extErr) {
        console.error("外部 API 调用异常:", extErr);
        toast({ title: "已保存到数据库，但外部推送异常", variant: "destructive" });
      }

      setSelectedItems(new Set());
      setPublishDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast({ title: "发布失败", variant: "destructive" });
    }
    setPublishing(false);
  };

  const validateThemeName = (name: string) => {
    if (!name) { setThemeNameError(""); return false; }
    if (!THEME_NAME_REGEX.test(name)) {
      setThemeNameError("仅允许英文小写字母、数字与中划线（-），且以字母或数字开头");
      return false;
    }
    setThemeNameError("");
    return true;
  };

  const handleThemeNameChange = (val: string) => {
    setNewThemeName(val);
    validateThemeName(val);
  };

  const handleCreateTheme = async () => {
    if (!currentProject || !newThemeName.trim()) return;
    if (!validateThemeName(newThemeName.trim())) return;
    try {
      const created = await createTheme(currentProject.id, newThemeName.trim(), newThemeDesc.trim() || undefined, newThemeFeishuToken.trim() || undefined);
      setNewThemeName(""); setNewThemeDesc(""); setNewThemeFeishuToken(""); setThemeNameError("");
      setThemeDialogOpen(false);
      toast({ title: "主题已创建" });
      await loadTree();
      setSelectedThemeId(created.id);
    } catch (e) {
      console.error(e);
      toast({ title: "创建失败", variant: "destructive" });
    }
  };

  const openEditThemeDialog = () => {
    if (!selectedNode || selectedNode.type !== "theme") return;
    const t = selectedNode.data;
    setEditThemeName(t.name || "");
    setEditThemeDesc(t.description || "");
    setEditThemeFeishuToken(t.feishu_doc_token || "");
    setEditThemeNameError("");
    setEditThemeDialogOpen(true);
  };

  const handleEditThemeNameChange = (val: string) => {
    setEditThemeName(val);
    if (val && !THEME_NAME_REGEX.test(val)) {
      setEditThemeNameError("仅允许英文小写字母、数字与中划线（-），且以字母或数字开头");
    } else {
      setEditThemeNameError("");
    }
  };

  const handleUpdateTheme = async () => {
    if (!selectedNode || selectedNode.type !== "theme") return;
    if (!editThemeName.trim() || editThemeNameError) return;
    try {
      await updateTheme(selectedNode.data.id, {
        name: editThemeName.trim(),
        description: editThemeDesc.trim() || undefined,
        feishu_doc_token: editThemeFeishuToken.trim() || undefined,
      });
      setEditThemeDialogOpen(false);
      toast({ title: "主题已更新" });
      await loadTree();
      // Update selectedNode with new data
      setSelectedNode({ type: "theme", data: { ...selectedNode.data, name: editThemeName.trim(), description: editThemeDesc.trim(), feishu_doc_token: editThemeFeishuToken.trim() } });
    } catch (e) {
      console.error(e);
      toast({ title: "更新失败", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">内容浏览</h1>
            <PromptConfigButton value={prompt} onChange={setPrompt} onConfirm={handleSavePrompt} placeholder="输入用于内容处理的 system prompt…" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">按 主题 → Hub → Spoke 层级查看并发布内容</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedItems.size > 0 && (
            <Button size="sm" onClick={() => setPublishDialogOpen(true)} className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              发布 ({selectedItems.size})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setThemeDialogOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            新建主题
          </Button>
        </div>
      </div>

      {/* Theme filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={selectedThemeId} onValueChange={setSelectedThemeId}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="选择主题..." />
          </SelectTrigger>
          <SelectContent>
            {allThemes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
                <span className="text-muted-foreground ml-2 text-xs">
                  ({t.hubs.length}H / {t.hubs.reduce((a, h) => a + h.spokes.length, 0) + t.unlinkedSpokes.length}S)
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resizable panels */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="rounded-lg border">
          <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b shrink-0">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  目录树
                  {selectedItems.size > 0 && (
                    <Badge variant="default" className="text-[10px] ml-auto">{selectedItems.size} 已选</Badge>
                  )}
                </h3>
              </div>
              <div className="flex-1 overflow-auto p-2">
                <ContentTree
                  tree={filteredTree}
                  loading={loading}
                  expandedThemes={expandedThemes}
                  expandedHubs={expandedHubs}
                  selectedItems={selectedItems}
                  onToggleTheme={toggleTheme}
                  onToggleHub={toggleHub}
                  onSelectNode={setSelectedNode}
                  onToggleItem={toggleItem}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={65}>
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b shrink-0">
                <h3 className="text-sm font-medium">
                  {selectedNode
                    ? `${selectedNode.type === "theme" ? "主题" : selectedNode.type === "hub" ? "Hub" : "Spoke"}: ${selectedNode.data.name || selectedNode.data.title}`
                    : "详情"}
                </h3>
              </div>
              <div className="flex-1 overflow-auto">
                {!selectedNode ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-sm">点击左侧树形目录中的节点查看详情</p>
                  </div>
                ) : selectedNode.type === "theme" ? (
                  <div className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">主题信息</p>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={openEditThemeDialog}>
                        <Pencil className="h-3 w-3" />
                        修改
                      </Button>
                    </div>
                    <div><p className="text-xs text-muted-foreground">名称</p><p className="text-sm font-medium">{selectedNode.data.name}</p></div>
                    <div><p className="text-xs text-muted-foreground">飞书文档 ID</p><p className="text-sm font-mono">{selectedNode.data.feishu_doc_token || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">描述</p><p className="text-sm">{selectedNode.data.description || "—"}</p></div>
                    <div>
                      <p className="text-xs text-muted-foreground">统计</p>
                      <p className="text-sm">{selectedNode.data.hubs?.length || 0} 个 Hub，{(selectedNode.data.hubs?.reduce((a: number, h: any) => a + h.spokes.length, 0) || 0) + (selectedNode.data.unlinkedSpokes?.length || 0)} 个 Spoke</p>
                    </div>
                  </div>
                ) : (
                  <CodeViewer
                    code={selectedNode.data.json_data ? JSON.stringify(selectedNode.data.json_data, null, 2) : "// 暂无 JSON 数据"}
                    filename={`${selectedNode.data.slug || selectedNode.data.title}.json`}
                  />
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Create Theme Dialog */}
      <Dialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>新建主题</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Input
                placeholder="主题名称（英文小写字母、数字与中划线）"
                value={newThemeName}
                onChange={(e) => handleThemeNameChange(e.target.value)}
                className={themeNameError ? "border-destructive" : ""}
              />
              {themeNameError && <p className="text-xs text-destructive mt-1">{themeNameError}</p>}
              <p className="text-xs text-muted-foreground mt-1">例如：digital-marketing、seo-guide2</p>
            </div>
            <Input placeholder="飞书文档 ID（可选）" value={newThemeFeishuToken} onChange={(e) => setNewThemeFeishuToken(e.target.value)} />
            <Input placeholder="描述（可选）" value={newThemeDesc} onChange={(e) => setNewThemeDesc(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setThemeDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateTheme} disabled={!newThemeName.trim() || !!themeNameError}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Theme Dialog */}
      <Dialog open={editThemeDialogOpen} onOpenChange={setEditThemeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>修改主题</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Input
                placeholder="主题名称（英文小写字母、数字与中划线）"
                value={editThemeName}
                onChange={(e) => handleEditThemeNameChange(e.target.value)}
                className={editThemeNameError ? "border-destructive" : ""}
              />
              {editThemeNameError && <p className="text-xs text-destructive mt-1">{editThemeNameError}</p>}
              <p className="text-xs text-muted-foreground mt-1">例如：digital-marketing、seo-guide2</p>
            </div>
            <Input placeholder="飞书文档 ID（可选）" value={editThemeFeishuToken} onChange={(e) => setEditThemeFeishuToken(e.target.value)} />
            <Input placeholder="描述（可选）" value={editThemeDesc} onChange={(e) => setEditThemeDesc(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditThemeDialogOpen(false)}>取消</Button>
            <Button onClick={handleUpdateTheme} disabled={!editThemeName.trim() || !!editThemeNameError}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PublishDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        selectedCount={selectedItems.size}
        publishing={publishing}
        onPublish={handlePublish}
      />
    </div>
  );
}
