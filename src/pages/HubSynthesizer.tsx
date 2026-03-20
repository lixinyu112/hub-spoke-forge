import { useState } from "react";
import { Network, ChevronRight, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeViewer } from "@/components/CodeViewer";
import { ValidationBar } from "@/components/ValidationBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SPOKES = [
  { id: "1", title: "AWS EC2 Setup Guide", slug: "/cloud-infrastructure/aws-ec2" },
  { id: "2", title: "AWS S3 Storage Basics", slug: "/cloud-infrastructure/aws-s3" },
  { id: "3", title: "AWS Lambda Functions", slug: "/cloud-infrastructure/aws-lambda" },
  { id: "4", title: "Docker Containerization", slug: "/cloud-infrastructure/docker" },
  { id: "5", title: "Kubernetes Orchestration", slug: "/cloud-infrastructure/kubernetes" },
];

const MOCK_HUB = (selectedSlugs: string[]) => JSON.stringify({
  type: "hub",
  title: "Cloud Infrastructure Guide",
  slug: "/cloud-infrastructure",
  meta_description: "Your complete guide to modern cloud infrastructure, covering AWS, Docker, and Kubernetes.",
  hero: { heading: "Master Cloud Infrastructure", subheading: "From EC2 to Kubernetes — everything you need." },
  spoke_links: selectedSlugs.map((s) => ({
    slug: s,
    title: SPOKES.find((sp) => sp.slug === s)?.title || s,
  })),
  supplementary_context: "Enterprise-grade cloud infrastructure patterns.",
}, null, 2);

export default function HubSynthesizer() {
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [validation, setValidation] = useState<"idle" | "passed" | "failed">("idle");
  const [selected, setSelected] = useState<string[]>([]);
  const [context, setContext] = useState("");

  const toggleSpoke = (slug: string) => {
    setSelected((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]);
  };

  const handleGenerate = () => {
    setLoading(true);
    setOutput("");
    setValidation("idle");
    setTimeout(() => {
      setOutput(MOCK_HUB(selected));
      setLoading(false);
      setValidation(Math.random() > 0.3 ? "passed" : "failed");
    }, 2500);
  };

  const parsedOutput = output ? JSON.parse(output) : null;

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hub Synthesizer</h1>
        <p className="text-sm text-muted-foreground mt-1">Aggregate Spoke pages into a structured Hub JSON.</p>
      </div>

      <div className="flex-1 grid lg:grid-cols-2 gap-4 min-h-0">
        {/* Left */}
        <div className="flex flex-col gap-4 overflow-auto">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Select Spoke Pages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {SPOKES.map((spoke) => (
                <label key={spoke.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                  <Checkbox
                    checked={selected.includes(spoke.slug)}
                    onCheckedChange={() => toggleSpoke(spoke.slug)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{spoke.title}</p>
                    <p className="text-xs text-muted-foreground font-mono">{spoke.slug}</p>
                  </div>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Supplementary Hub Data</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Broad industry context, overarching theme…"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Hub Component Spec</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select defaultValue="hub-default">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hub-default">Hub — Default Schema v1</SelectItem>
                  <SelectItem value="hub-extended">Hub — Extended Schema v2</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleGenerate} className="w-full gap-2" disabled={loading}>
                <Network className="h-4 w-4" />
                Synthesize Hub JSON ✨
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right */}
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
                  <TabsTrigger value="tree" className="text-xs">Tree View</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="json" className="flex-1 m-0">
                <CodeViewer code={output} loading={loading} filename="hub-output.json" />
              </TabsContent>
              <TabsContent value="tree" className="flex-1 m-0 p-4 overflow-auto">
                {parsedOutput ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
                      <Network className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">{parsedOutput.title}</span>
                      <span className="text-xs text-muted-foreground font-mono ml-auto">{parsedOutput.slug}</span>
                    </div>
                    <div className="ml-4 space-y-1">
                      {parsedOutput.spoke_links?.map((link: { slug: string; title: string }, i: number) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 border border-transparent hover:border-border transition-colors">
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <FileJson className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{link.title}</span>
                          <span className="text-xs text-muted-foreground font-mono ml-auto">{link.slug}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Generate Hub JSON to see the tree view</p>
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
