import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Save, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getSitemapConfig, upsertSitemapConfig, type SitemapConfig } from "@/lib/api";

const CHANGEFREQ_OPTIONS = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"];
const ALL_LANGUAGES = ["zh", "en", "es", "ko", "ru", "pt", "ja", "de", "fr", "it", "ar", "hi"];

interface SitemapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  theme: { id: string; name: string; hubs: any[]; unlinkedSpokes: any[] };
}

export function SitemapDialog({ open, onOpenChange, projectId, theme }: SitemapDialogProps) {
  const [config, setConfig] = useState<Partial<SitemapConfig>>({
    base_url: "",
    url_pattern_hub: "/{lang}/{theme}",
    url_pattern_spoke: "/{lang}/{theme}/{slug}",
    languages: ["zh", "en", "es", "ko", "ru", "pt", "ja"],
    changefreq: null,
    priority: null,
    include_hub: true,
  });
  const [saving, setSaving] = useState(false);
  const [langInput, setLangInput] = useState("");

  useEffect(() => {
    if (open && projectId) {
      getSitemapConfig(projectId).then((saved) => {
        if (saved) {
          setConfig({
            base_url: saved.base_url || "",
            url_pattern_hub: saved.url_pattern_hub || "/{lang}/{theme}",
            url_pattern_spoke: saved.url_pattern_spoke || "/{lang}/{theme}/{slug}",
            languages: (saved.languages as string[]) || ["zh", "en"],
            changefreq: saved.changefreq || null,
            priority: saved.priority || null,
            include_hub: saved.include_hub ?? true,
          });
        }
      });
    }
  }, [open, projectId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertSitemapConfig(projectId, {
        base_url: config.base_url || "",
        url_pattern_hub: config.url_pattern_hub || "/{lang}/{theme}",
        url_pattern_spoke: config.url_pattern_spoke || "/{lang}/{theme}/{slug}",
        languages: config.languages || [],
        changefreq: config.changefreq || null,
        priority: config.priority || null,
        include_hub: config.include_hub ?? true,
      });
      toast({ title: "Sitemap 配置已保存" });
    } catch (e) {
      console.error(e);
      toast({ title: "保存失败", variant: "destructive" });
    }
    setSaving(false);
  };

  const addLanguage = (lang: string) => {
    const trimmed = lang.trim().toLowerCase();
    if (!trimmed) return;
    const langs = config.languages || [];
    if (!langs.includes(trimmed)) {
      setConfig({ ...config, languages: [...langs, trimmed] });
    }
    setLangInput("");
  };

  const removeLanguage = (lang: string) => {
    setConfig({ ...config, languages: (config.languages || []).filter((l) => l !== lang) });
  };

  const buildUrl = (pattern: string, lang: string, slug?: string) => {
    return pattern
      .replace("{lang}", lang)
      .replace("{theme}", theme.name)
      .replace("{slug}", slug || "");
  };

  const generateXml = () => {
    const languages = config.languages || [];
    const urls: string[] = [];

    for (const lang of languages) {
      // Hub URLs
      if (config.include_hub && theme.hubs.length > 0) {
        const hub = theme.hubs[0];
        const loc = `${config.base_url}${buildUrl(config.url_pattern_hub || "", lang)}`;
        const lastmod = hub.published_at ? new Date(hub.published_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
        let urlEntry = `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>`;
        if (config.changefreq) urlEntry += `\n    <changefreq>${config.changefreq}</changefreq>`;
        if (config.priority) urlEntry += `\n    <priority>${config.priority}</priority>`;
        urlEntry += `\n  </url>`;
        urls.push(urlEntry);
      }

      // Spoke URLs
      const allSpokes = [
        ...(theme.hubs.flatMap((h: any) => h.spokes) || []),
        ...(theme.unlinkedSpokes || []),
      ];
      for (const spoke of allSpokes) {
        const slug = spoke.slug || spoke.title;
        const loc = `${config.base_url}${buildUrl(config.url_pattern_spoke || "", lang, slug)}`;
        const lastmod = spoke.published_at ? new Date(spoke.published_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
        let urlEntry = `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>`;
        if (config.changefreq) urlEntry += `\n    <changefreq>${config.changefreq}</changefreq>`;
        if (config.priority) urlEntry += `\n    <priority>${config.priority}</priority>`;
        urlEntry += `\n  </url>`;
        urls.push(urlEntry);
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
  };

  const handleDownload = () => {
    if (!config.base_url) {
      toast({ title: "请先填写 Base URL", variant: "destructive" });
      return;
    }
    const xml = generateXml();
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sitemap-${theme.name}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `已下载 sitemap-${theme.name}.xml` });
  };

  // Count URLs that will be generated
  const urlCount = (() => {
    const langs = (config.languages || []).length;
    const spokeCount = (theme.hubs.flatMap((h: any) => h.spokes).length) + (theme.unlinkedSpokes?.length || 0);
    const hubCount = config.include_hub && theme.hubs.length > 0 ? 1 : 0;
    return (hubCount + spokeCount) * langs;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sitemap 配置 — {theme.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* base_url */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Base URL</Label>
            <Input
              placeholder="https://www.example.com"
              value={config.base_url || ""}
              onChange={(e) => setConfig({ ...config, base_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">站点根域名，不含末尾斜杠</p>
          </div>

          {/* URL patterns */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Hub URL 模板</Label>
            <Input
              value={config.url_pattern_hub || ""}
              onChange={(e) => setConfig({ ...config, url_pattern_hub: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              可用变量：{"{lang}"}, {"{theme}"} — 示例：/{"{lang}"}/{"{theme}"}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Spoke URL 模板</Label>
            <Input
              value={config.url_pattern_spoke || ""}
              onChange={(e) => setConfig({ ...config, url_pattern_spoke: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              可用变量：{"{lang}"}, {"{theme}"}, {"{slug}"} — 示例：/{"{lang}"}/{"{theme}"}/{"{slug}"}
            </p>
          </div>

          {/* Languages */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">语言列表</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(config.languages || []).map((lang) => (
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
                  {ALL_LANGUAGES.filter((l) => !(config.languages || []).includes(l)).map((l) => (
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
            <Select value={config.changefreq || "_none"} onValueChange={(v) => setConfig({ ...config, changefreq: v === "_none" ? null : v })}>
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
              value={config.priority || ""}
              onChange={(e) => setConfig({ ...config, priority: e.target.value || null })}
            />
          </div>

          {/* include_hub */}
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">包含 Hub 页面</Label>
            <Switch
              checked={config.include_hub ?? true}
              onCheckedChange={(v) => setConfig({ ...config, include_hub: v })}
            />
          </div>

          {/* Preview count */}
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              将生成 <span className="font-medium text-foreground">{urlCount}</span> 条 URL 记录
              （{config.include_hub && theme.hubs.length > 0 ? "1 Hub + " : ""}{(theme.hubs.flatMap((h: any) => h.spokes).length) + (theme.unlinkedSpokes?.length || 0)} Spokes × {(config.languages || []).length} 语言）
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            保存配置
          </Button>
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
