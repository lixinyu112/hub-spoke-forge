import { useState, useEffect } from "react";
import { Check, Copy, Download, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CodeViewerProps {
  code: string;
  loading?: boolean;
  filename?: string;
  editable?: boolean;
  onConfirm?: (editedCode: string) => void;
  onDiscard?: () => void;
  confirmed?: boolean;
}

export function CodeViewer({ code, loading, filename = "output.json", editable, onConfirm, onDiscard, confirmed }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const [editedCode, setEditedCode] = useState(code);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setEditedCode(code);
    setIsEditing(false);
  }, [code]);

  const displayCode = isEditing ? editedCode : code;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayCode);
    setCopied(true);
    toast({ title: "已复制到剪贴板" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([displayCode], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `已下载 ${filename}` });
  };

  const handleConfirm = () => {
    // Validate JSON before confirming
    try {
      JSON.parse(editedCode);
    } catch {
      toast({ title: "JSON 格式无效，请检查后再确认", variant: "destructive" });
      return;
    }
    onConfirm?.(editedCode);
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 bg-code rounded-md border p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-mono">AI 正在生成 JSON…</p>
        <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary/60 rounded-full animate-shimmer w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-1 p-2 border-b">
        <div className="flex items-center gap-1">
          {editable && code && !confirmed && (
            <>
              <Button
                variant={isEditing ? "default" : "outline"}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="h-7 text-xs gap-1.5"
              >
                {isEditing ? "预览" : "编辑"}
              </Button>
            </>
          )}
          {confirmed && (
            <span className="text-xs text-success flex items-center gap-1 px-2">
              <Check className="h-3 w-3" /> 已确认保存
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {editable && code && !confirmed && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="default" size="sm" className="h-7 text-xs gap-1.5">
                    <Save className="h-3 w-3" />
                    确认保存
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认保存</AlertDialogTitle>
                    <AlertDialogDescription>
                      确认后 JSON 数据将保存到数据库并在内容浏览中展示。请确保内容已检查无误。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirm}>确认</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-destructive">
                    <X className="h-3 w-3" />
                    放弃
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>放弃生成结果</AlertDialogTitle>
                    <AlertDialogDescription>
                      放弃后生成的 JSON 将不会保存，确定要放弃吗？
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDiscard?.()}>确认放弃</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs gap-1.5">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "已复制" : "复制 JSON"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload} className="h-7 text-xs gap-1.5">
            <Download className="h-3 w-3" />
            下载
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-code rounded-b-md">
        {isEditing ? (
          <textarea
            value={editedCode}
            onChange={(e) => setEditedCode(e.target.value)}
            className="w-full h-full p-4 text-xs font-mono leading-relaxed bg-transparent text-code-foreground resize-none outline-none border-none"
            spellCheck={false}
          />
        ) : (
          <pre className="p-4 text-xs font-mono text-code-foreground leading-relaxed whitespace-pre-wrap break-all">
            {displayCode || '// 生成的 JSON 将在此处显示'}
          </pre>
        )}
      </div>
    </div>
  );
}
