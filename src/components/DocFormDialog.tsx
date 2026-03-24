import { useState, useEffect } from "react";
import { FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DocFormData {
  token: string;
  name: string;
  content: string;
}

interface DocFormDialogProps {
  mode: "create" | "edit";
  initialData?: DocFormData;
  onSubmit: (data: DocFormData) => void;
  trigger?: React.ReactNode;
}

export function DocFormDialog({ mode, initialData, onSubmit, trigger }: DocFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (open) {
      setName(initialData?.name || "");
      setToken(initialData?.token || "");
      setContent(initialData?.content || "");
    }
  }, [open, initialData]);

  const handleSubmit = () => {
    onSubmit({ token: token.trim(), name: name.trim(), content: content.trim() });
    setOpen(false);
  };

  const isCreate = mode === "create";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" />
            新增文档
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isCreate ? "新增文档" : "修改文档"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs">文档名称</Label>
            <Input
              placeholder="例如：AWS EC2 部署最佳实践"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">文档 ID</Label>
            <Input
              placeholder="例如：doxcnXYZ001"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1 font-mono"
              disabled={!isCreate}
            />
          </div>
          <div>
            <Label className="text-xs">输入内容</Label>
            <Textarea
              placeholder="在此粘贴文档内容…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 min-h-[160px] font-mono text-xs bg-muted/50 border-muted"
            />
          </div>
          <Button className="w-full gap-2" onClick={handleSubmit} disabled={!name.trim() || !token.trim()}>
            {isCreate ? (
              <>
                <FileText className="h-4 w-4" />
                创建并添加
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4" />
                保存修改
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
