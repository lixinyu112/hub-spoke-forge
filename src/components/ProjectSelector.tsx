import { useState } from "react";
import { Plus, Check, ChevronsUpDown, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useProject } from "@/contexts/ProjectContext";
import { cn } from "@/lib/utils";

export function ProjectSelector() {
  const { projects, currentProject, setCurrentProject, createProject } = useProject();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createProject(newName.trim(), newDesc.trim() || undefined);
    setNewName("");
    setNewDesc("");
    setDialogOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between gap-2 h-9 text-xs">
            <div className="flex items-center gap-2 truncate">
              <FolderKanban className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{currentProject?.name || "选择项目"}</span>
            </div>
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => { setCurrentProject(p); setOpen(false); }}
              className={cn(
                "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors",
                currentProject?.id === p.id && "bg-muted"
              )}
            >
              {currentProject?.id === p.id && <Check className="h-3 w-3 text-primary" />}
              <span className={cn(currentProject?.id !== p.id && "ml-5")}>{p.name}</span>
            </button>
          ))}
          <div className="border-t mt-1 pt-1">
            <button
              onClick={() => { setOpen(false); setDialogOpen(true); }}
              className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-xs hover:bg-muted/50 text-muted-foreground"
            >
              <Plus className="h-3 w-3" />
              新建项目
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="项目名称" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="项目描述（可选）" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
