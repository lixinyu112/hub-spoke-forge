import { useEffect, useState } from "react";
import { History, RefreshCw, CheckCircle2, XCircle, Globe, ChevronDown, ChevronRight, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PublishLogRow {
  id: string;
  project_id: string;
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

interface ProjectRow {
  id: string;
  name: string;
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

export default function PublishLogs() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<PublishLogRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [filterProject, setFilterProject] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const [{ data: logsData }, { data: projData }] = await Promise.all([
      supabase
        .from("publish_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("projects").select("id,name").order("name"),
    ]);
    if (logsData) {
      setLogs(
        logsData.map((d: any) => ({
          ...d,
          languages: Array.isArray(d.languages) ? d.languages : [],
          details: Array.isArray(d.details) ? d.details : [],
        })),
      );
    }
    if (projData) setProjects(projData as ProjectRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const filteredLogs = filterProject === "all" ? logs : logs.filter((l) => l.project_id === filterProject);

  const totalRuns = filteredLogs.length;
  const totalItems = filteredLogs.reduce((acc, l) => acc + (l.item_count || 0), 0);
  const totalTasks = filteredLogs.reduce((acc, l) => acc + (l.total || 0), 0);
  const totalSuccess = filteredLogs.reduce((acc, l) => acc + (l.success || 0), 0);
  const totalFailed = filteredLogs.reduce((acc, l) => acc + (l.failed || 0), 0);

  return (
    <div className="container max-w-6xl mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <History className="h-5 w-5" />
            发布日志
          </h1>
          <p className="text-sm text-muted-foreground mt-1">查看所有项目的发布操作记录</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="筛选项目" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部项目</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        <Card>
          <CardContent className="p-3">
            <p className="text-muted-foreground">发布次数</p>
            <p className="text-lg font-semibold mt-0.5">{totalRuns}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-muted-foreground">累计内容项</p>
            <p className="text-lg font-semibold mt-0.5">{totalItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-muted-foreground">累计任务</p>
            <p className="text-lg font-semibold mt-0.5">{totalTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-muted-foreground">成功</p>
            <p className="text-lg font-semibold mt-0.5 text-success">{totalSuccess}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-muted-foreground">失败</p>
            <p className={`text-lg font-semibold mt-0.5 ${totalFailed > 0 ? "text-destructive" : ""}`}>{totalFailed}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">记录列表</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading && filteredLogs.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">暂无发布记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => {
                const isExpanded = expanded.has(log.id);
                const failedDetails = log.details.filter((d) => !d.success);
                const projName = projectMap.get(log.project_id) || "—";
                return (
                  <div key={log.id} className="rounded-md border bg-card">
                    <button
                      type="button"
                      onClick={() => toggle(log.id)}
                      className="w-full flex items-start gap-2.5 p-3 text-left hover:bg-muted/40 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">{formatDate(log.created_at)}</span>
                          <Badge variant="outline" className="text-[10px] h-5 gap-1">
                            <FolderKanban className="h-2.5 w-2.5" />
                            {projName}
                          </Badge>
                          {log.theme_name && (
                            <Badge variant="outline" className="text-[10px] h-5">
                              {log.theme_name}
                            </Badge>
                          )}
                          {!log.translate_enabled && (
                            <Badge variant="secondary" className="text-[10px] h-5">
                              未翻译
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            耗时 {formatDuration(log.duration_ms)}
                          </span>
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
                            <CheckCircle2 className="h-3 w-3 text-success" />
                            <span className="text-success">{log.success}</span>
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
                                <p className="text-[11px] font-medium text-destructive">
                                  失败明细 ({failedDetails.length})
                                </p>
                                {failedDetails.map((d, i) => (
                                  <div
                                    key={i}
                                    className="flex items-start gap-2 p-1.5 rounded bg-destructive/5 text-[11px]"
                                  >
                                    <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium truncate">{d.item_title}</p>
                                      <p className="text-muted-foreground">
                                        语言: <span className="font-mono">{d.language}</span>
                                      </p>
                                      {d.error && (
                                        <p className="text-destructive/80 break-all mt-0.5">{d.error}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <details className="text-[11px]">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-1">
                                完整明细 ({log.details.length})
                              </summary>
                              <div className="space-y-0.5 mt-1 max-h-60 overflow-auto">
                                {log.details.map((d, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/40"
                                  >
                                    {d.success ? (
                                      <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
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
        </CardContent>
      </Card>
    </div>
  );
}
