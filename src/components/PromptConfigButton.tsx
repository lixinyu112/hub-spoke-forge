import { useState, useEffect } from "react";
import { Settings2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";

interface PromptConfigButtonProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm?: (value: string) => void;
  placeholder?: string;
}

export function PromptConfigButton({ value, onChange, onConfirm, placeholder }: PromptConfigButtonProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(value);
    setDirty(false);
  }, [value]);

  const handleDraftChange = (v: string) => {
    setDraft(v);
    setDirty(v !== value);
  };

  const handleConfirm = () => {
    onChange(draft);
    onConfirm?.(draft);
    setDirty(false);
    toast({ title: "Prompt 已更新", description: "后续生成将使用此 System Prompt" });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground/50 hover:text-muted-foreground"
          title="配置 Prompt"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Prompt 配置</p>
          <Textarea
            placeholder={placeholder || "输入用于 AI 生成的 system prompt…"}
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            className="min-h-[120px] text-xs font-mono"
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">确认后将作为 System Prompt 使用</p>
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={!dirty}
              onClick={handleConfirm}
            >
              <Check className="h-3 w-3" />
              确认保存
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
