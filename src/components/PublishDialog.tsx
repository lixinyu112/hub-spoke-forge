import { useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const LANGUAGES = [
  { code: "zh", label: "简体中文 (Simplified Chinese)" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語 (Japanese)" },
  { code: "ko", label: "한국어 (Korean)" },
  { code: "es", label: "Español (Spanish)" },
  { code: "pt", label: "Português (Portuguese)" },
  { code: "ru", label: "Русский (Russian)" },
] as const;

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  publishing: boolean;
  onPublish: (languages: string[]) => void;
}

export function PublishDialog({ open, onOpenChange, selectedCount, publishing, onPublish }: PublishDialogProps) {
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
