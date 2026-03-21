import { ChevronRight, ChevronDown, Network, FileJson, Layers, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export interface TreeSpoke {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  json_data: any;
  feishu_doc_title: string | null;
}

export interface TreeHub {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  json_data: any;
  spokes: TreeSpoke[];
}

export interface TreeTheme {
  id: string;
  name: string;
  description: string | null;
  hubs: TreeHub[];
  unlinkedSpokes: TreeSpoke[];
}

interface ContentTreeProps {
  tree: TreeTheme[];
  loading: boolean;
  expandedThemes: Set<string>;
  expandedHubs: Set<string>;
  selectedItems: Set<string>;
  onToggleTheme: (id: string) => void;
  onToggleHub: (id: string) => void;
  onSelectNode: (node: { type: "theme" | "hub" | "spoke"; data: any }) => void;
  onToggleItem: (id: string, type: "hub" | "spoke") => void;
}

export function ContentTree({
  tree, loading, expandedThemes, expandedHubs, selectedItems,
  onToggleTheme, onToggleHub, onSelectNode, onToggleItem,
}: ContentTreeProps) {
  if (tree.length === 0 && !loading) {
    return (
      <div className="text-center py-8">
        <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">暂无内容</p>
        <p className="text-xs text-muted-foreground/60">点击「新建主题」开始</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {tree.map((theme) => (
        <div key={theme.id}>
          <button
            onClick={() => { onToggleTheme(theme.id); onSelectNode({ type: "theme", data: theme }); }}
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
              {theme.hubs.map((hub) => (
                <div key={hub.id}>
                  <div className="flex items-center gap-1">
                    <Checkbox
                      checked={selectedItems.has(`hub:${hub.id}`)}
                      onCheckedChange={() => onToggleItem(hub.id, "hub")}
                      className="h-3.5 w-3.5"
                    />
                    <button
                      onClick={() => { onToggleHub(hub.id); onSelectNode({ type: "hub", data: hub }); }}
                      className="flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors"
                    >
                      {expandedHubs.has(hub.id) ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                      <Network className="h-3.5 w-3.5 text-orange-500" />
                      <span className="truncate">{hub.title}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{hub.spokes.length}S</Badge>
                    </button>
                  </div>
                  {expandedHubs.has(hub.id) && (
                    <div className="ml-5 space-y-0.5">
                      {hub.spokes.map((spoke) => (
                        <div key={spoke.id} className="flex items-center gap-1">
                          <Checkbox
                            checked={selectedItems.has(`spoke:${spoke.id}`)}
                            onCheckedChange={() => onToggleItem(spoke.id, "spoke")}
                            className="h-3.5 w-3.5"
                          />
                          <button
                            onClick={() => onSelectNode({ type: "spoke", data: spoke })}
                            className="flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded-md text-xs hover:bg-muted/50 transition-colors"
                          >
                            <FileJson className="h-3 w-3 text-primary" />
                            <span className="truncate">{spoke.title}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {theme.unlinkedSpokes.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">未关联 Hub</div>
                  {theme.unlinkedSpokes.map((spoke) => (
                    <div key={spoke.id} className="flex items-center gap-1 ml-2">
                      <Checkbox
                        checked={selectedItems.has(`spoke:${spoke.id}`)}
                        onCheckedChange={() => onToggleItem(spoke.id, "spoke")}
                        className="h-3.5 w-3.5"
                      />
                      <button
                        onClick={() => onSelectNode({ type: "spoke", data: spoke })}
                        className="flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded-md text-xs hover:bg-muted/50 transition-colors"
                      >
                        <FileJson className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate">{spoke.title}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
