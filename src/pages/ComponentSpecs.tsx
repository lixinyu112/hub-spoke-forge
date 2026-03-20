import { useState } from "react";
import { Upload, FileText, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const SAMPLE_HUB_JSON = `{
  "type": "hub",
  "title": "Cloud Infrastructure Guide",
  "slug": "/cloud-infrastructure",
  "meta_description": "...",
  "hero": { "heading": "...", "subheading": "..." },
  "spoke_links": []
}`;

const SAMPLE_SPOKE_JSON = `{
  "type": "spoke",
  "title": "AWS EC2 Setup Guide",
  "slug": "/cloud-infrastructure/aws-ec2",
  "parent_hub": "/cloud-infrastructure",
  "sections": [],
  "cta": { "text": "Get Started", "url": "#" }
}`;

export default function ComponentSpecs() {
  const [files, setFiles] = useState<string[]>([]);
  const [hubJson, setHubJson] = useState(SAMPLE_HUB_JSON);
  const [spokeJson, setSpokeJson] = useState(SAMPLE_SPOKE_JSON);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const newFiles = Array.from(e.dataTransfer.files).map((f) => f.name);
    setFiles((prev) => [...prev, ...newFiles]);
    toast({ title: "Files uploaded", description: `${newFiles.length} file(s) added` });
  };

  const handleSave = () => {
    toast({ title: "Specifications saved", description: "Component specs updated successfully." });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Component Specs</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload constraint documents and define JSON schemas for Hub & Spoke components.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Constraint Documents</CardTitle>
          <CardDescription>Upload PDF or Markdown specification files</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => {
              setFiles((prev) => [...prev, `spec-doc-${prev.length + 1}.pdf`]);
              toast({ title: "File added (mocked)" });
            }}
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
            }`}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Drag & drop PDF/Markdown files here, or click to browse</p>
            <p className="text-xs text-muted-foreground/60 mt-1">.pdf, .md, .mdx supported</p>
          </div>

          {files.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <Badge key={i} variant="secondary" className="gap-1.5 font-mono text-xs">
                  <FileText className="h-3 w-3" />
                  {f}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hub JSON Example</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={hubJson}
              onChange={(e) => setHubJson(e.target.value)}
              className="font-mono text-xs min-h-[200px] bg-code text-code-foreground"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spoke JSON Example</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={spokeJson}
              onChange={(e) => setSpokeJson(e.target.value)}
              className="font-mono text-xs min-h-[200px] bg-code text-code-foreground"
            />
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave} className="gap-2">
        <Save className="h-4 w-4" />
        Save Specifications
      </Button>
    </div>
  );
}
