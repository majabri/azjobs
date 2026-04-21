import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { createService, upsertPackages } from "@/services/marketplace/service";
import { SERVICE_CATEGORIES, TURNAROUND_OPTIONS } from "@/services/marketplace/types";
import type { ServicePackage } from "@/services/marketplace/types";
import { Loader2, Check, ArrowRight, ArrowLeft, Upload, Star } from "lucide-react";

interface PackageForm {
  tier: "basic" | "standard" | "premium";
  name: string;
  description: string;
  price: string;
  delivery_days: string;
  features: string;
}

const defaultPackages: PackageForm[] = [
  { tier: "basic", name: "Basic", description: "", price: "", delivery_days: "3", features: "" },
  { tier: "standard", name: "Standard", description: "", price: "", delivery_days: "5", features: "" },
  { tier: "premium", name: "Premium", description: "", price: "", delivery_days: "7", features: "" },
];

interface Props {
  onDone: () => void;
}

export default function ServiceCreateWizard({ onDone }: Props) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Resume Writing");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [turnaround, setTurnaround] = useState("7");

  // Step 2
  const [imageUrl, setImageUrl] = useState("");

  // Step 3
  const [packages, setPackages] = useState<PackageForm[]>(defaultPackages);

  const updatePkg = (idx: number, field: keyof PackageForm, val: string) => {
    setPackages((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: val } : p)));
  };

  const canNext = () => {
    if (step === 1) return title.trim() && headline.trim() && description.trim();
    if (step === 2) return true;
    if (step === 3) return packages.every((p) => p.name && p.price && Number(p.price) > 0);
    return true;
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      const svc = await createService({
        title,
        category,
        headline,
        description,
        image_url: imageUrl || null,
        turnaround_days: Number(turnaround),
        status: "published",
      });
      const pkgRows: Partial<ServicePackage>[] = packages.map((p) => ({
        tier: p.tier,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        delivery_days: Number(p.delivery_days),
        features: p.features.split("\n").filter(Boolean),
      }));
      await upsertPackages(svc.id, pkgRows);
      toast.success("Service published!");
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Failed to publish");
    } finally {
      setSaving(false);
    }
  };

  const priceRange = () => {
    const prices = packages.map((p) => Number(p.price) || 0).filter(Boolean);
    if (!prices.length) return "—";
    return `$${Math.min(...prices)} – $${Math.max(...prices)}`;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create a Service</h2>
          <span className="text-sm text-muted-foreground">Step {step} of 4</span>
        </div>
        <Progress value={step * 25} className="h-2" />
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Service Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Professional Resume Writing" />
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Headline</label>
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Short tagline for your service" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="Describe what you offer..." />
            </div>
            <div>
              <label className="text-sm font-medium">Turnaround Time</label>
              <Select value={turnaround} onValueChange={setTurnaround}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TURNAROUND_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={String(t.value)}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Image */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Service Image</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Image URL (optional)</label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
            </div>
            {imageUrl && (
              <div className="rounded-lg overflow-hidden border aspect-video bg-muted">
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
            {!imageUrl && (
              <div className="rounded-lg border-2 border-dashed flex items-center justify-center aspect-video bg-muted/50">
                <div className="text-center text-muted-foreground">
                  <Upload className="mx-auto h-8 w-8 mb-2" />
                  <p className="text-sm">Enter an image URL above</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Packages */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="font-semibold">Define Your Packages</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {packages.map((pkg, i) => (
              <Card key={pkg.tier}>
                <CardHeader className="pb-3">
                  <Badge variant={i === 1 ? "default" : "secondary"} className="w-fit capitalize">{pkg.tier}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input placeholder="Package Name" value={pkg.name} onChange={(e) => updatePkg(i, "name", e.target.value)} />
                  <Input placeholder="Description" value={pkg.description} onChange={(e) => updatePkg(i, "description", e.target.value)} />
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Price ($)" value={pkg.price} onChange={(e) => updatePkg(i, "price", e.target.value)} />
                    <Input type="number" placeholder="Days" value={pkg.delivery_days} onChange={(e) => updatePkg(i, "delivery_days", e.target.value)} />
                  </div>
                  <Textarea placeholder="Features (one per line)" value={pkg.features} onChange={(e) => updatePkg(i, "features", e.target.value)} rows={3} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <Card>
          <CardHeader><CardTitle>Review & Publish</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm">
              <div><span className="font-medium">Title:</span> {title}</div>
              <div><span className="font-medium">Category:</span> {category}</div>
              <div><span className="font-medium">Headline:</span> {headline}</div>
              <div><span className="font-medium">Turnaround:</span> {turnaround} days</div>
              <div><span className="font-medium">Price Range:</span> {priceRange()}</div>
            </div>
            <div>
              <span className="font-medium text-sm">Description:</span>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{description}</p>
            </div>
            <div>
              <span className="font-medium text-sm">Packages:</span>
              <div className="grid gap-2 mt-2 md:grid-cols-3">
                {packages.map((p) => (
                  <div key={p.tier} className="border rounded-md p-3 text-sm">
                    <div className="font-medium">{p.name} <Badge variant="outline" className="ml-1 capitalize text-xs">{p.tier}</Badge></div>
                    <div className="text-primary font-semibold">${p.price}</div>
                    <div className="text-muted-foreground">{p.delivery_days} day delivery</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : onDone()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {step > 1 ? "Back" : "Cancel"}
        </Button>
        {step < 4 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
            Next <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handlePublish} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
            Publish Service
          </Button>
        )}
      </div>
    </div>
  );
}
