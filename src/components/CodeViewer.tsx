import { useState } from "react";
import { Check, Copy, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface CodeViewerProps {
  code: string;
  loading?: boolean;
  filename?: string;
}

export function CodeViewer({ code, loading, filename = "output.json" }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Downloaded ${filename}` });
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 bg-code rounded-md border p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-mono">Generating JSON via AI…</p>
        <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary/60 rounded-full animate-shimmer w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-end gap-1 p-2 border-b">
        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs gap-1.5">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy JSON"}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDownload} className="h-7 text-xs gap-1.5">
          <Download className="h-3 w-3" />
          Download
        </Button>
      </div>
      <div className="flex-1 overflow-auto bg-code rounded-b-md">
        <pre className="p-4 text-xs font-mono text-code-foreground leading-relaxed whitespace-pre-wrap break-all">
          {code || '// Generated JSON will appear here'}
        </pre>
      </div>
    </div>
  );
}
