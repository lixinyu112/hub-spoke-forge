import { CheckCircle2, XCircle, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface ValidationBarProps {
  status: "idle" | "passed" | "failed";
  message?: string;
}

export function ValidationBar({ status, message }: ValidationBarProps) {
  if (status === "idle") return null;

  const passed = status === "passed";

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-mono border ${
        passed
          ? "bg-success/10 border-success/30 text-success"
          : "bg-destructive/10 border-destructive/30 text-destructive"
      }`}
    >
      <div className="flex items-center gap-2">
        {passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
        <span>{message || (passed ? "Schema Validation Passed" : "Validation Failed")}</span>
      </div>
      {!passed && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 text-destructive hover:text-destructive"
          onClick={() => toast({ title: "Auto-Fix initiated", description: "AI is correcting the schema issues…" })}
        >
          <Wand2 className="h-3 w-3" />
          Auto-Fix via AI
        </Button>
      )}
    </div>
  );
}
