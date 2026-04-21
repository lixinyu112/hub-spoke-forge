import { useEffect, useState } from "react";
import { History, RefreshCw, CheckCircle2, XCircle, Globe, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface PublishLogRow {
  id: string;
  theme_name: string | null;
  item_count: number;
  languages: string[];
  translate_enabled: boolean;
  total: number;
  success: number;
  failed: number;
  details: { item_id: string; item_title: string; language: string; success: boolean; error?: string }[];
  duration_ms: number | null;
  created_at: string;
}

interface PublishLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
}

function formatDuration(ms: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 100) / 10;
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s - m * 60);
  return `${m}m ${rs}s`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function PublishLogsDialog({ open, onOpenChange, projectId }: PublishLogsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<PublishLogRow[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("publish_logs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) {
      setLogs(
        data.map((d: any) => ({
          ...d,
          languages: Array.isArray(d.languages) ? d.languages : [],
          details: Array.isArray(d.details) ? d.details : [],
        })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      setExpanded(new Set());
      load();
    }
  }, [open, projectId]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const totalRuns = logs.length;
  const totalItems = logs.reduce((acc, l) => acc + (l.item_count || 0), 0);
  const totalTasks = logs.reduce((acc, l) => acc + (l.total || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            发布日志
            <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1.5" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              刷新
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border p-2.5">
            <p className="text-muted-foreground">发布次数</p>
            <p className="text-lg font-semibold mt-0.5">{totalRuns}</p>
          </div>
          <div className="rounded-md border p-2.5">
            <p className="text-muted-foreground">累计内容项</p>
            <p className="text-lg font-semibold mt-0.5">{totalItems}</p>
          </div>
          <div className="rounded-md border p-2.5">
            <p className="text-muted-foreground">累计任务（项 × 语种）</p>
            <p className="text-lg font-semibold mt-0.5">{totalTasks}</p>
          </div>
        </div>

        <ScrollArea className="flex-1 -mx-1 px-1">
          {loading && logs.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">暂无发布记录</p>
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {logs.map((log) => {
                const isExpanded = expanded.has(log.id);
                const failedDetails = log.details.filter((d) => !d.success);
                return (
                  <div key={log.id} className="rounded-md border bg-card">
                    <button
                      type="button"
                      onClick={() => toggle(log.id)}
                      className="w-full flex items-start gap-2.5 p-3 text-left hover:bg-muted/40 transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">{formatDate(log.created_at)}</span>
                          {log.theme_name && (
                            <Badge variant="outline" className="text-[10px] h-5">
                              {log.theme_name}
                            </Badge>
                          )}
                          {!log.translate_enabled && (
                            <Badge variant="secondary" className="text-[10px] h-5">未翻译</Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground ml-auto">耗时 {formatDuration(log.duration_ms)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{log.item_count}</span>
                            <span className="text-muted-foreground">项 ×</span>
                            <span className="font-medium">{log.languages.length}</span>
                            <span className="text-muted-foreground">语种 = {log.total} 任务</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            <span className="text-green-700 dark:text-green-400">{log.success}</span>
                          </span>
                          {log.failed > 0 && (
                            <span className="flex items-center gap-1">
                              <XCircle className="h-3 w-3 text-destructive" />
                              <span className="text-destructive">{log.failed}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {log.languages.map((lang) => (
                            <Badge key={lang} variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                              {lang}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t px-3 py-2 space-y-1.5 bg-muted/20">
                        {log.details.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-1">无明细</p>
                        ) : (
                          <>
                            {failedDetails.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-[11px] font-medium text-destructive">失败明细 ({failedDetails.length})</p>
                                {failedDetails.map((d, i) => (
                                  <div key={i} className="flex items-start gap-2 p-1.5 rounded bg-destructive/5 text-[11px]">
                                    <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium truncate">{d.item_title}</p>
                                      <p className="text-muted-foreground">语言: <span className="font-mono">{d.language}</span></p>
                                      {d.error && <p className="text-destructive/80 break-all mt-0.5">{d.error}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <details className="text-[11px]">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-1">完整明细 ({log.details.length})</summary>
                              <div className="space-y-0.5 mt-1 max-h-60 overflow-auto">
                                {log.details.map((d, i) => (
                                  <div key={i} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/40">
                                    {d.success ? (
                                      <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                                    ) : (
                                      <XCircle className="h-3 w-3 text-destructive shrink-0" />
                                    )}
                                    <span className="font-mono text-muted-foreground w-7">{d.language}</span>
                                    <span className="truncate flex-1">{d.item_title}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
