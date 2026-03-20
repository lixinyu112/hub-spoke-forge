import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeViewer } from "@/components/CodeViewer";
import { ValidationBar } from "@/components/ValidationBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MOCK_OUTPUT = JSON.stringify({
  type: "spoke",
  title: "如何部署 AWS EC2 实例",
  slug: "/cloud-infrastructure/aws-ec2-setup",
  parent_hub: "/cloud-infrastructure",
  meta_description: "关于启动和配置 AWS EC2 实例用于生产工作负载的全面指南。",
  author: "DevOps 团队",
  target_keyword: "AWS EC2 部署指南",
  sections: [
    { heading: "前置条件", body: "在开始之前，请确保您拥有 AWS 账户…" },
    { heading: "启动实例", body: "导航至 EC2 控制台并点击启动实例…" },
    { heading: "安全组", body: "为您的实例配置入站和出站规则…" },
  ],
  cta: { text: "开始免费试用", url: "/signup" },
  internal_links: ["/cloud-infrastructure/aws-s3", "/cloud-infrastructure/aws-lambda"],
}, null, 2);

export default function SpokeGenerator() {
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [validation, setValidation] = useState<"idle" | "passed" | "failed">("idle");
  const [scrapedData, setScrapedData] = useState("");
  const [keyword, setKeyword] = useState("");
  const [author, setAuthor] = useState("");
  const [cta, setCta] = useState("");

  const handleGenerate = () => {
    setLoading(true);
    setOutput("");
    setValidation("idle");
    setTimeout(() => {
      setOutput(MOCK_OUTPUT);
      setLoading(false);
      setValidation(Math.random() > 0.3 ? "passed" : "failed");
    }, 2500);
  };

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Spoke 生成器</h1>
        <p className="text-sm text-muted-foreground mt-1">将抓取的数据转换为结构化的 Spoke JSON。</p>
      </div>

      <div className="flex-1 grid lg:grid-cols-2 gap-4 min-h-0">
        {/* 左侧：输入 */}
        <div className="flex flex-col gap-4 overflow-auto">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">抓取的页面数据</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="在此粘贴原始抓取的文本内容…"
                value={scrapedData}
                onChange={(e) => setScrapedData(e.target.value)}
                className="min-h-[140px] font-mono text-xs"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">手动输入数据</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">目标关键词</Label>
                <Input placeholder="例如：AWS EC2 部署指南" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">作者</Label>
                <Input placeholder="例如：DevOps 团队" value={author} onChange={(e) => setAuthor(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">行动号召</Label>
                <Input placeholder="例如：开始免费试用" value={cta} onChange={(e) => setCta(e.target.value)} className="mt-1" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">组件规范</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select defaultValue="spoke-default">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spoke-default">Spoke — 默认 Schema v1</SelectItem>
                  <SelectItem value="spoke-extended">Spoke — 扩展 Schema v2</SelectItem>
                  <SelectItem value="spoke-minimal">Spoke — 精简 Schema</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleGenerate} className="w-full gap-2" disabled={loading}>
                <Sparkles className="h-4 w-4" />
                生成 Spoke JSON ✨
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：输出 */}
        <div className="flex flex-col gap-3 min-h-0">
          <ValidationBar
            status={validation}
            message={validation === "passed" ? "✅ Schema 验证通过" : validation === "failed" ? "❌ 验证失败：缺少必填字段 'title'" : undefined}
          />
          <Card className="flex-1 min-h-0 flex flex-col">
            <Tabs defaultValue="json" className="flex-1 flex flex-col">
              <div className="border-b px-4">
                <TabsList className="bg-transparent h-9">
                  <TabsTrigger value="json" className="text-xs">JSON 输出</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="json" className="flex-1 m-0">
                <CodeViewer code={output} loading={loading} filename="spoke-output.json" />
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
