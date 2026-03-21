import { useState, useEffect, useCallback } from "react";
import { Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Layers } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { getProjectTree, createTheme, createPublicationsBatch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { ContentTree, type TreeTheme } from "@/components/ContentTree";
import { PublishDialog } from "@/components/PublishDialog";

export default function ContentBrowser() {
  const { currentProject } = useProject();
  const [tree, setTree] = useState<TreeTheme[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  const [expandedHubs, setExpandedHubs] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<{ type: "theme" | "hub" | "spoke"; data: any } | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");
  const [newThemeDesc, setNewThemeDesc] = useState("");

  const loadTree = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const data = await getProjectTree(currentProject.id);
      setTree(data);
      setExpandedThemes(new Set(data.map((t) => t.id)));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [currentProject]);

  useEffect(() => { loadTree(); }, [loadTree]);

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

  // Resolve selected items to their data
  const getSelectedData = () => {
    const items: { type: "hub" | "spoke"; id: string; title: string; json_data: any }[] = [];
    for (const key of selectedItems) {
      const [type, id] = key.split(":");
      for (const theme of tree) {
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
      toast({ title: `已发布 ${items.length} 项内容 × ${languages.length} 种语言` });
      setSelectedItems(new Set());
      setPublishDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast({ title: "发布失败", variant: "destructive" });
    }
    setPublishing(false);
  };

  const handleCreateTheme = async () => {
    if (!currentProject || !newThemeName.trim()) return;
    try {
      await createTheme(currentProject.id, newThemeName.trim(), newThemeDesc.trim() || undefined);
      setNewThemeName(""); setNewThemeDesc("");
      setThemeDialogOpen(false);
      toast({ title: "主题已创建" });
      loadTree();
    } catch (e) {
      console.error(e);
      toast({ title: "创建失败", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">内容浏览</h1>
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

      <div className="flex-1 grid lg:grid-cols-[340px_1fr] gap-4 min-h-0">
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" />
              目录树
              {selectedItems.size > 0 && (
                <Badge variant="default" className="text-[10px] ml-auto">{selectedItems.size} 已选</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-2">
            <ContentTree
              tree={tree}
              loading={loading}
              expandedThemes={expandedThemes}
              expandedHubs={expandedHubs}
              selectedItems={selectedItems}
              onToggleTheme={toggleTheme}
              onToggleHub={toggleHub}
              onSelectNode={setSelectedNode}
              onToggleItem={toggleItem}
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-base">
              {selectedNode
                ? `${selectedNode.type === "theme" ? "主题" : selectedNode.type === "hub" ? "Hub" : "Spoke"}: ${selectedNode.data.name || selectedNode.data.title}`
                : "详情"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {!selectedNode ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">点击左侧树形目录中的节点查看详情</p>
              </div>
            ) : selectedNode.type === "theme" ? (
              <div className="space-y-3">
                <div><p className="text-xs text-muted-foreground">名称</p><p className="text-sm font-medium">{selectedNode.data.name}</p></div>
                {selectedNode.data.description && <div><p className="text-xs text-muted-foreground">描述</p><p className="text-sm">{selectedNode.data.description}</p></div>}
                <div>
                  <p className="text-xs text-muted-foreground">统计</p>
                  <p className="text-sm">{selectedNode.data.hubs?.length || 0} 个 Hub，{(selectedNode.data.hubs?.reduce((a: number, h: any) => a + h.spokes.length, 0) || 0) + (selectedNode.data.unlinkedSpokes?.length || 0)} 个 Spoke</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">标题</p><p className="text-sm font-medium">{selectedNode.data.title}</p></div>
                  <div>
                    <p className="text-xs text-muted-foreground">状态</p>
                    <Badge variant={selectedNode.data.status === "generated" ? "default" : "secondary"} className="text-xs">{selectedNode.data.status}</Badge>
                  </div>
                  {selectedNode.data.slug && <div><p className="text-xs text-muted-foreground">Slug</p><p className="text-xs font-mono">{selectedNode.data.slug}</p></div>}
                  {selectedNode.data.feishu_doc_title && <div><p className="text-xs text-muted-foreground">飞书文档</p><p className="text-xs">{selectedNode.data.feishu_doc_title}</p></div>}
                </div>
                {selectedNode.data.json_data && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">JSON 数据</p>
                    <div className="bg-muted rounded-md border overflow-auto max-h-[400px]">
                      <pre className="p-3 text-xs font-mono whitespace-pre-wrap">{JSON.stringify(selectedNode.data.json_data, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Theme Dialog */}
      <Dialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>新建主题</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="主题名称" value={newThemeName} onChange={(e) => setNewThemeName(e.target.value)} />
            <Input placeholder="描述（可选）" value={newThemeDesc} onChange={(e) => setNewThemeDesc(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setThemeDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateTheme} disabled={!newThemeName.trim()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
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
