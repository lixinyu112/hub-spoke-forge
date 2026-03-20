import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Network, FileJson, Layers, Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useProject } from "@/contexts/ProjectContext";
import { getProjectTree, createTheme } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface TreeTheme {
  id: string;
  name: string;
  description: string | null;
  hubs: {
    id: string;
    title: string;
    slug: string | null;
    status: string;
    json_data: any;
    spokes: { id: string; title: string; slug: string | null; status: string; json_data: any; feishu_doc_title: string | null }[];
  }[];
  unlinkedSpokes: { id: string; title: string; slug: string | null; status: string; json_data: any; feishu_doc_title: string | null }[];
}

export default function ContentBrowser() {
  const { currentProject } = useProject();
  const [tree, setTree] = useState<TreeTheme[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  const [expandedHubs, setExpandedHubs] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<{ type: "theme" | "hub" | "spoke"; data: any } | null>(null);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");
  const [newThemeDesc, setNewThemeDesc] = useState("");

  const loadTree = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const data = await getProjectTree(currentProject.id);
      setTree(data);
      // Auto-expand all themes
      setExpandedThemes(new Set(data.map((t) => t.id)));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadTree(); }, [currentProject]);

  const toggleTheme = (id: string) => {
    setExpandedThemes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleHub = (id: string) => {
    setExpandedHubs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreateTheme = async () => {
    if (!currentProject || !newThemeName.trim()) return;
    try {
      await createTheme(currentProject.id, newThemeName.trim(), newThemeDesc.trim() || undefined);
      setNewThemeName("");
      setNewThemeDesc("");
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
          <p className="text-sm text-muted-foreground mt-1">按 主题 → Hub → Spoke 层级查看所有生成的内容</p>
        </div>
        <Button size="sm" onClick={() => setThemeDialogOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          新建主题
        </Button>
      </div>

      <div className="flex-1 grid lg:grid-cols-[340px_1fr] gap-4 min-h-0">
        {/* Left: Tree */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" />
              目录树
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-2">
            {tree.length === 0 && !loading && (
              <div className="text-center py-8">
                <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">暂无内容</p>
                <p className="text-xs text-muted-foreground/60">点击「新建主题」开始</p>
              </div>
            )}
            <div className="space-y-0.5">
              {tree.map((theme) => (
                <div key={theme.id}>
                  {/* Theme node */}
                  <button
                    onClick={() => { toggleTheme(theme.id); setSelectedNode({ type: "theme", data: theme }); }}
                    className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors"
                  >
                    {expandedThemes.has(theme.id) ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium truncate">{theme.name}</span>
                    <Badge variant="secondary" className="text-[10px] ml-auto shrink-0">
                      {theme.hubs.length}H / {theme.hubs.reduce((a, h) => a + h.spokes.length, 0) + theme.unlinkedSpokes.length}S
                    </Badge>
                  </button>

                  {expandedThemes.has(theme.id) && (
                    <div className="ml-4">
                      {/* Hubs */}
                      {theme.hubs.map((hub) => (
                        <div key={hub.id}>
                          <button
                            onClick={() => { toggleHub(hub.id); setSelectedNode({ type: "hub", data: hub }); }}
                            className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors"
                          >
                            {expandedHubs.has(hub.id) ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                            <Network className="h-3.5 w-3.5 text-warning" />
                            <span className="truncate">{hub.title}</span>
                            <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{hub.spokes.length}S</Badge>
                          </button>
                          {expandedHubs.has(hub.id) && (
                            <div className="ml-5 space-y-0.5">
                              {hub.spokes.map((spoke) => (
                                <button
                                  key={spoke.id}
                                  onClick={() => setSelectedNode({ type: "spoke", data: spoke })}
                                  className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-xs hover:bg-muted/50 transition-colors"
                                >
                                  <FileJson className="h-3 w-3 text-blue-500" />
                                  <span className="truncate">{spoke.title}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Unlinked spokes */}
                      {theme.unlinkedSpokes.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">未关联 Hub</div>
                          {theme.unlinkedSpokes.map((spoke) => (
                            <button
                              key={spoke.id}
                              onClick={() => setSelectedNode({ type: "spoke", data: spoke })}
                              className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-xs hover:bg-muted/50 transition-colors ml-2"
                            >
                              <FileJson className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate">{spoke.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right: Detail */}
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
                <div>
                  <p className="text-xs text-muted-foreground">名称</p>
                  <p className="text-sm font-medium">{selectedNode.data.name}</p>
                </div>
                {selectedNode.data.description && (
                  <div>
                    <p className="text-xs text-muted-foreground">描述</p>
                    <p className="text-sm">{selectedNode.data.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">统计</p>
                  <p className="text-sm">
                    {selectedNode.data.hubs?.length || 0} 个 Hub，
                    {(selectedNode.data.hubs?.reduce((a: number, h: any) => a + h.spokes.length, 0) || 0) + (selectedNode.data.unlinkedSpokes?.length || 0)} 个 Spoke
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">标题</p>
                    <p className="text-sm font-medium">{selectedNode.data.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">状态</p>
                    <Badge variant={selectedNode.data.status === "generated" ? "default" : "secondary"} className="text-xs">
                      {selectedNode.data.status}
                    </Badge>
                  </div>
                  {selectedNode.data.slug && (
                    <div>
                      <p className="text-xs text-muted-foreground">Slug</p>
                      <p className="text-xs font-mono">{selectedNode.data.slug}</p>
                    </div>
                  )}
                  {selectedNode.data.feishu_doc_title && (
                    <div>
                      <p className="text-xs text-muted-foreground">飞书文档</p>
                      <p className="text-xs">{selectedNode.data.feishu_doc_title}</p>
                    </div>
                  )}
                </div>
                {selectedNode.data.json_data && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">JSON 数据</p>
                    <div className="bg-code rounded-md border overflow-auto max-h-[400px]">
                      <pre className="p-3 text-xs font-mono text-code-foreground whitespace-pre-wrap">
                        {JSON.stringify(selectedNode.data.json_data, null, 2)}
                      </pre>
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
          <DialogHeader>
            <DialogTitle>新建主题</DialogTitle>
          </DialogHeader>
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
    </div>
  );
}
