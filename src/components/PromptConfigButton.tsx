import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface PromptConfigButtonProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function PromptConfigButton({ value, onChange, placeholder }: PromptConfigButtonProps) {
  const [open, setOpen] = useState(false);

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
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[120px] text-xs font-mono"
          />
          <p className="text-[10px] text-muted-foreground">配置后将作为模型的 system prompt 使用</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
