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
  title: "How to Set Up AWS EC2 Instances",
  slug: "/cloud-infrastructure/aws-ec2-setup",
  parent_hub: "/cloud-infrastructure",
  meta_description: "A comprehensive guide to launching and configuring AWS EC2 instances for production workloads.",
  author: "DevOps Team",
  target_keyword: "AWS EC2 setup guide",
  sections: [
    { heading: "Prerequisites", body: "Before you begin, ensure you have an AWS account…" },
    { heading: "Launching an Instance", body: "Navigate to the EC2 dashboard and click Launch Instance…" },
    { heading: "Security Groups", body: "Configure inbound and outbound rules for your instance…" },
  ],
  cta: { text: "Start Your Free Trial", url: "/signup" },
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
        <h1 className="text-2xl font-semibold tracking-tight">Spoke Generator</h1>
        <p className="text-sm text-muted-foreground mt-1">Transform scraped data into structured Spoke JSON.</p>
      </div>

      <div className="flex-1 grid lg:grid-cols-2 gap-4 min-h-0">
        {/* Left: Inputs */}
        <div className="flex flex-col gap-4 overflow-auto">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Scraped Page Data</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Paste raw scraped text content here…"
                value={scrapedData}
                onChange={(e) => setScrapedData(e.target.value)}
                className="min-h-[140px] font-mono text-xs"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Manual Input Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Target Keyword</Label>
                <Input placeholder="e.g. AWS EC2 setup guide" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Author</Label>
                <Input placeholder="e.g. DevOps Team" value={author} onChange={(e) => setAuthor(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Call-to-Action</Label>
                <Input placeholder="e.g. Start Your Free Trial" value={cta} onChange={(e) => setCta(e.target.value)} className="mt-1" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Component Spec</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select defaultValue="spoke-default">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spoke-default">Spoke — Default Schema v1</SelectItem>
                  <SelectItem value="spoke-extended">Spoke — Extended Schema v2</SelectItem>
                  <SelectItem value="spoke-minimal">Spoke — Minimal Schema</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleGenerate} className="w-full gap-2" disabled={loading}>
                <Sparkles className="h-4 w-4" />
                Generate Spoke JSON ✨
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Output */}
        <div className="flex flex-col gap-3 min-h-0">
          <ValidationBar
            status={validation}
            message={validation === "passed" ? "✅ Schema Validation Passed" : validation === "failed" ? "❌ Validation Failed: Missing required field 'title'" : undefined}
          />
          <Card className="flex-1 min-h-0 flex flex-col">
            <Tabs defaultValue="json" className="flex-1 flex flex-col">
              <div className="border-b px-4">
                <TabsList className="bg-transparent h-9">
                  <TabsTrigger value="json" className="text-xs">JSON Output</TabsTrigger>
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
