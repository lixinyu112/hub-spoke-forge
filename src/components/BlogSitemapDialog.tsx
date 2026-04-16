import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { BlogGroup, BlogPost } from "@/lib/blogApi";

const ALL_LANGUAGES = ["zh", "en", "es", "ko", "ru", "pt", "ja", "de", "fr", "it", "ar", "hi"];

interface BlogSitemapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: BlogGroup[];
  posts: BlogPost[];
  selectedGroupId?: string;
}

export function BlogSitemapDialog({ open, onOpenChange, groups, posts, selectedGroupId }: BlogSitemapDialogProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [urlPattern, setUrlPattern] = useState("/{lang}/blog/{slug}");
  const [languages, setLanguages] = useState<string[]>(["zh", "en", "es", "ko", "ru", "pt", "ja"]);
  const [changefreq, setChangefreq] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [langInput, setLangInput] = useState("");
  const [targetGroupId, setTargetGroupId] = useState<string>(selectedGroupId || "all");

  useEffect(() => {
    if (selectedGroupId && selectedGroupId !== "all" && selectedGroupId !== "ungrouped") {
      setTargetGroupId(selectedGroupId);
    }
  }, [selectedGroupId, open]);

  const addLanguage = (lang: string) => {
    const trimmed = lang.trim().toLowerCase();
    if (!trimmed || languages.includes(trimmed)) return;
    setLanguages([...languages, trimmed]);
    setLangInput("");
  };

  const removeLanguage = (lang: string) => {
    setLanguages(languages.filter((l) => l !== lang));
  };

  const groupMap = Object.fromEntries(groups.map((g) => [g.id, g]));

  const filteredPosts = posts.filter((p) => {
    if (targetGroupId === "all") return true;
    return p.group_id === targetGroupId;
  }).filter((p) => p.status !== "error" && p.json_data && !p.json_data?.error);

  const buildUrl = (pattern: string, lang: string, groupName: string, slug: string) => {
    return pattern
      .replace("{lang}", lang)
      .replace("{group}", groupName)
      .replace("{slug}", slug);
  };

  const generateXml = () => {
    const urls: string[] = [];

    for (const lang of languages) {
      for (const post of filteredPosts) {
        const groupName = post.group_id ? (groupMap[post.group_id]?.name || "ungrouped") : "ungrouped";
        const data: any = post.json_data || {};
        const slug = data.slug || post.slug || post.title;
        const loc = `${baseUrl}${buildUrl(urlPattern, lang, groupName, slug)}`;
        const lastmod = new Date(post.updated_at).toISOString().split("T")[0];
        let urlEntry = `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>`;
        if (changefreq) urlEntry += `\n    <changefreq>${changefreq}</changefreq>`;
        if (priority) urlEntry += `\n    <priority>${priority}</priority>`;
        urlEntry += `\n  </url>`;
        urls.push(urlEntry);
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
  };

  const urlCount = filteredPosts.length * languages.length;

  const handleDownload = () => {
    if (!baseUrl) {
      toast({ title: "请先填写 Base URL", variant: "destructive" });
      return;
    }
    const xml = generateXml();
    const groupName = targetGroupId === "all" ? "all" : (groupMap[targetGroupId]?.name || "blog");
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sitemap-blog-${groupName}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `已下载 sitemap-blog-${groupName}.xml` });
  };

  const CHANGEFREQ_OPTIONS = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Blog Sitemap 配置</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Target group */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">目标分组</Label>
            <Select value={targetGroupId} onValueChange={setTargetGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="选择分组…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分组</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Base URL</Label>
            <Input
              placeholder="https://www.example.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">站点根域名，不含末尾斜杠</p>
          </div>

          {/* URL pattern */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Blog URL 模板</Label>
            <Input
              value={urlPattern}
              onChange={(e) => setUrlPattern(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              可用变量：{"{lang}"}, {"{slug}"}, {"{group}"} — 示例：/{"{lang}"}/blog/{"{slug}"}
            </p>
          </div>

          {/* Languages */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">语言列表</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {languages.map((lang) => (
                <Badge key={lang} variant="secondary" className="gap-1 text-xs">
                  {lang}
                  <button onClick={() => removeLanguage(lang)} className="ml-0.5 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Select onValueChange={(v) => addLanguage(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="添加语言..." />
                </SelectTrigger>
                <SelectContent>
                  {ALL_LANGUAGES.filter((l) => !languages.includes(l)).map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="自定义语言码"
                value={langInput}
                onChange={(e) => setLangInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLanguage(langInput)}
                className="w-[140px]"
              />
            </div>
          </div>

          {/* changefreq */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">changefreq（可选）</Label>
            <Select value={changefreq || "_none"} onValueChange={(v) => setChangefreq(v === "_none" ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="不设置" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">不设置</SelectItem>
                {CHANGEFREQ_OPTIONS.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* priority */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">priority（可选）</Label>
            <Input
              placeholder="例如：0.8"
              value={priority || ""}
              onChange={(e) => setPriority(e.target.value || null)}
            />
          </div>

          {/* Preview count */}
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              将生成 <span className="font-medium text-foreground">{urlCount}</span> 条 URL 记录
              （{filteredPosts.length} 篇 Blog × {languages.length} 语言）
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleDownload} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            下载 XML
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function escapeXml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
