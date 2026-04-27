import { useState } from "react";
import { Globe, Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";


const LANGUAGES = [
  { code: "zh", label: "简体中文 (Simplified Chinese)" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語 (Japanese)" },
  { code: "ko", label: "한국어 (Korean)" },
  { code: "es", label: "Español (Spanish)" },
  { code: "pt", label: "Português (Portuguese)" },
  { code: "ru", label: "Русский (Russian)" },
] as const;

export interface PublishReportData {
  total: number;
  success: number;
  failed: number;
  details: {
    item_id: string;
    item_title: string;
    language: string;
    success: boolean;
    error?: string;
    endpoints?: PublishEndpointCall[];
  }[];
}

export interface PublishEndpointCall {
  /** 接口标签：translate-blog / publish-blog-cms */
  fn: string;
  /** 实际请求的 URL（edge function 完整 URL） */
  url: string;
  method: "POST" | "GET";
  /** 请求体摘要（截断） */
  request_summary?: string;
  /** HTTP 状态码（成功 200 / 失败 4xx-5xx） */
  status?: number;
  /** 是否成功 */
  ok: boolean;
  /** 响应/错误摘要（截断） */
  response_summary?: string;
  /** 耗时 ms */
  duration_ms?: number;
}

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  publishing: boolean;
  onPublish: (languages: string[], environment: string, translate: boolean) => void;
  report?: PublishReportData | null;
  progress?: { total: number; done: number } | null;
  showEnvironment?: boolean;
  /** Hide language selection and always publish all languages */
  allLanguages?: boolean;
  /** Show translate toggle (default true) */
  showTranslateToggle?: boolean;
  /** Optional handler invoked when user clicks "自动修正并重试" on the failure report. */
  onRetryFailed?: (failedDetails: PublishReportData["details"]) => void | Promise<void>;
}

export function PublishDialog({ open, onOpenChange, selectedCount, publishing, onPublish, report, progress, showEnvironment = false, allLanguages = false, showTranslateToggle = true, onRetryFailed }: PublishDialogProps) {
  const ALL_LANG_CODES = LANGUAGES.map((l) => l.code);
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set(allLanguages ? ALL_LANG_CODES : ["zh"]));
  const [environment, setEnvironment] = useState<string>("staging");
  const [translateEnabled, setTranslateEnabled] = useState<boolean>(true);

  const toggleLang = (code: string) => {
    setSelectedLangs((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const handlePublish = () => {
    if (selectedLangs.size === 0) return;
    onPublish(Array.from(selectedLangs), environment, translateEnabled);
  };

  // Show report view when report is available
  if (report) {
    const failedItems = report.details.filter((d) => !d.success);
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              发布结果报告
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">总计:</span>
                <Badge variant="secondary">{report.total}</Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">{report.success} 成功</span>
              </div>
              {report.failed > 0 && (
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">{report.failed} 失败</span>
                </div>
              )}
            </div>

            {failedItems.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">失败明细</Label>
                  {onRetryFailed && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 gap-1.5"
                      disabled={publishing}
                      onClick={() => onRetryFailed(failedItems)}
                    >
                      {publishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      自动修正并重试 ({failedItems.length})
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-[200px] rounded-md border">
                  <div className="p-2 space-y-1">
                    {failedItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded bg-destructive/5 text-xs">
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{item.item_title}</p>
                          <p className="text-muted-foreground">
                            语言: <span className="font-mono">{item.language}</span>
                          </p>
                          {item.error && <p className="text-destructive/80 break-all mt-0.5">{item.error}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  重试会自动按错误类型选择修正策略（限流冷却 / 跳过翻译兜底 / 串行降速），仅重发以上失败项。
                </p>
              </div>
            )}

            {report.failed === 0 && (
              <div className="text-center py-4">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">所有内容发布成功！</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            {publishing && progress && (
              <div className="w-full sm:w-auto sm:flex-1 space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground shrink-0">{progress.done}/{progress.total}</span>
                </div>
                <p className="text-[11px] text-muted-foreground text-center">正在重试…</p>
              </div>
            )}
            <Button onClick={() => onOpenChange(false)} disabled={publishing}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            发布内容
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">
              已选择 <Badge variant="secondary">{selectedCount}</Badge> 个内容项
            </p>
          </div>
          {showEnvironment && (
          <div>
            <Label className="text-sm font-medium mb-2 block">发布环境</Label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${environment === "staging" ? "border-primary bg-primary/10" : "hover:bg-muted/50"}`}
                onClick={() => setEnvironment("staging")}
              >
                <div className={`h-3 w-3 rounded-full border-2 ${environment === "staging" ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                <div>
                  <span className="text-sm font-medium">Staging</span>
                  <p className="text-[10px] text-muted-foreground">测试环境</p>
                </div>
              </label>
              <label
                className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${environment === "production" ? "border-primary bg-primary/10" : "hover:bg-muted/50"}`}
                onClick={() => setEnvironment("production")}
              >
                <div className={`h-3 w-3 rounded-full border-2 ${environment === "production" ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                <div>
                  <span className="text-sm font-medium">Production</span>
                  <p className="text-[10px] text-muted-foreground">生产环境</p>
                </div>
              </label>
            </div>
          </div>
          )}
          {showTranslateToggle && (
            <div className="flex items-start justify-between gap-3 p-3 rounded-md border">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">启用 AI 翻译</Label>
                <p className="text-xs text-muted-foreground">
                  {translateEnabled
                    ? "将原始 JSON 翻译为目标语言后再发布"
                    : "按当前 JSON 原文直接发布到所选语种（不翻译）"}
                </p>
              </div>
              <Switch checked={translateEnabled} onCheckedChange={setTranslateEnabled} disabled={publishing} />
            </div>
          )}
          {allLanguages ? (
            <div>
              <Label className="text-sm font-medium mb-2 block">发布语言</Label>
              <p className="text-sm text-muted-foreground">将发布至所有 {LANGUAGES.length} 种语言：</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {LANGUAGES.map((lang) => (
                  <Badge key={lang.code} variant="secondary" className="text-xs">{lang.code} — {lang.label.split(" ")[0]}</Badge>
                ))}
              </div>
            </div>
          ) : (
          <div>
            <Label className="text-sm font-medium mb-2 block">选择发布语言</Label>
            <div className="grid grid-cols-1 gap-2">
              {LANGUAGES.map((lang) => (
                <label
                  key={lang.code}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedLangs.has(lang.code)}
                    onCheckedChange={() => toggleLang(lang.code)}
                  />
                  <span className="text-sm font-mono text-muted-foreground w-6">{lang.code}</span>
                  <span className="text-sm">{lang.label}</span>
                </label>
              ))}
            </div>
            {selectedLangs.size === 0 && (
              <p className="text-xs text-destructive mt-2">请至少选择一种语言</p>
            )}
          </div>
          )}
        </div>
        <DialogFooter className="flex-col gap-3 sm:flex-col">
          {publishing && progress && (
            <div className="w-full space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-muted-foreground shrink-0">{progress.done}/{progress.total}</span>
              </div>
              <p className="text-xs text-muted-foreground text-center">正在发布中…</p>
            </div>
          )}
          <div className="flex gap-2 justify-end w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>取消</Button>
            <Button onClick={handlePublish} disabled={selectedLangs.size === 0 || publishing}>
              {publishing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {allLanguages ? `发布全部 ${LANGUAGES.length} 种语言` : `发布 (${selectedLangs.size} 语言)`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
