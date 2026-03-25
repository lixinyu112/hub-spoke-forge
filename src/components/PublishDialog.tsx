import { useState } from "react";
import { Globe, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  details: { item_id: string; item_title: string; language: string; success: boolean; error?: string }[];
}

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  publishing: boolean;
  onPublish: (languages: string[]) => void;
  report?: PublishReportData | null;
}

export function PublishDialog({ open, onOpenChange, selectedCount, publishing, onPublish, report }: PublishDialogProps) {
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set(["zh"]));

  const toggleLang = (code: string) => {
    setSelectedLangs((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const handlePublish = () => {
    if (selectedLangs.size === 0) return;
    onPublish(Array.from(selectedLangs));
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
                <Label className="text-sm font-medium mb-2 block">失败明细</Label>
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
              </div>
            )}

            {report.failed === 0 && (
              <div className="text-center py-4">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">所有内容发布成功！</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>关闭</Button>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>取消</Button>
          <Button onClick={handlePublish} disabled={selectedLangs.size === 0 || publishing}>
            {publishing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            发布 ({selectedLangs.size} 语言)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
