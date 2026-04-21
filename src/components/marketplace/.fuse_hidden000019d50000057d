import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fetchServiceById, fetchPackages, createOrder } from "@/services/marketplace/service";
import type { ServiceCatalog, ServicePackage } from "@/services/marketplace/types";
import { ArrowLeft, Loader2, Check, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import StarRating from "./StarRating";
import ReviewsSection from "./ReviewsSection";

interface Props {
  serviceId: string;
  onBack: () => void;
}

export default function ServiceDetailView({ serviceId, onBack }: Props) {
  const { user } = useAuth();
  const [service, setService] = useState<ServiceCatalog | null>(null);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<ServicePackage | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [svc, pkgs] = await Promise.all([
        fetchServiceById(serviceId),
        fetchPackages(serviceId),
      ]);
      setService(svc);
      setPackages(pkgs);
      setLoading(false);
    })();
  }, [serviceId]);

  const handleOrder = async () => {
    if (!selectedPkg || !service || !user) return;
    setOrdering(true);
    try {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + selectedPkg.delivery_days);
      await createOrder({
        seller_id: service.seller_id,
        service_id: service.id,
        package_id: selectedPkg.id,
        price: selectedPkg.price,
        delivery_deadline: deadline.toISOString(),
      });
      toast.success("Order placed successfully!");
      setConfirmOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to place order");
    }
    setOrdering(false);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!service) return <div className="text-center py-16 text-muted-foreground">Service not found.</div>;

  const tierLabel = (tier: string) => ({ basic: "Basic", standard: "Standard", premium: "Premium" }[tier] || tier);

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Back to Browse</Button>

      {/* Header */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          {service.image_url && <img src={service.image_url} alt={service.title} className="w-full rounded-lg h-64 object-cover" />}
          <div>
            <Badge variant="outline">{service.category}</Badge>
            <h1 className="text-2xl font-bold mt-2">{service.title}</h1>
            <p className="text-muted-foreground">{service.headline}</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <StarRating value={Math.round(service.rating_avg)} readonly size="sm" />
              {service.rating_avg.toFixed(1)} ({service.rating_count} reviews)
            </span>
            <span>{service.orders_count} orders</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{service.turnaround_days} day turnaround</span>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{service.description}</p>
          </div>
        </div>

        {/* Packages */}
        <div className="space-y-3">
          <h3 className="font-semibold">Packages</h3>
          {packages.map((pkg) => (
            <Card key={pkg.id} className={`cursor-pointer transition-shadow ${selectedPkg?.id === pkg.id ? "ring-2 ring-primary" : "hover:shadow-md"}`} onClick={() => setSelectedPkg(pkg)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant={pkg.tier === "premium" ? "default" : "outline"} className="capitalize">{tierLabel(pkg.tier)}</Badge>
                  <span className="text-lg font-bold text-primary">${pkg.price}</span>
                </div>
                <div className="font-medium">{pkg.name}</div>
                <p className="text-xs text-muted-foreground">{pkg.description}</p>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{pkg.delivery_days} day delivery</div>
                {pkg.features.length > 0 && (
                  <ul className="text-xs space-y-1">
                    {pkg.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-1"><Check className="w-3 h-3 text-primary" />{f}</li>
                    ))}
                  </ul>
                )}
                <Button className="w-full" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedPkg(pkg); setConfirmOpen(true); }}>
                  Order This Package
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Reviews Section */}
      <ReviewsSection serviceId={serviceId} />

      {/* Order Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Order</DialogTitle></DialogHeader>
          {selectedPkg && (
            <div className="space-y-3 text-sm">
              <div><span className="font-medium">Service:</span> {service.title}</div>
              <div><span className="font-medium">Package:</span> {selectedPkg.name} ({tierLabel(selectedPkg.tier)})</div>
              <div><span className="font-medium">Price:</span> <span className="text-primary font-bold">${selectedPkg.price}</span></div>
              <div><span className="font-medium">Delivery:</span> {selectedPkg.delivery_days} days</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleOrder} disabled={ordering}>
              {ordering ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Place Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
