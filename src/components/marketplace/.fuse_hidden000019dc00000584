import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { fetchMyServices, deleteService, fetchMyOrders, updateOrderStatus } from "@/services/marketplace/service";
import type { ServiceCatalog, CatalogOrder } from "@/services/marketplace/types";
import { Plus, Star, ShoppingCart, Edit, Trash2, Eye, Loader2, Package } from "lucide-react";
import ServiceCreateWizard from "./ServiceCreateWizard";

export default function TalentServicesDashboard() {
  const [tab, setTab] = useState("services");
  const [services, setServices] = useState<ServiceCatalog[]>([]);
  const [orders, setOrders] = useState<CatalogOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([fetchMyServices(), fetchMyOrders("seller")]);
      setServices(s);
      setOrders(o);
    } catch { /* handled */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteService(id);
      toast.success("Service deleted");
      load();
    } catch { toast.error("Failed to delete"); }
  };

  const handleStatusUpdate = async (orderId: string, status: string) => {
    try {
      await updateOrderStatus(orderId, status);
      toast.success(`Order ${status}`);
      load();
    } catch { toast.error("Failed to update"); }
  };

  if (creating) return <ServiceCreateWizard onDone={() => { setCreating(false); load(); }} />;

  const statusColor = (s: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary", accepted: "default", in_progress: "default", completed: "outline", draft: "secondary",
    };
    return map[s] || "secondary";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Services</h1>
        <Button onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1" /> Create Service</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="services"><Package className="w-4 h-4 mr-1" /> Services</TabsTrigger>
          <TabsTrigger value="orders"><ShoppingCart className="w-4 h-4 mr-1" /> Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : services.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No services yet. Create your first service!</CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((svc) => (
                <Card key={svc.id} className="overflow-hidden">
                  {svc.image_url && <img src={svc.image_url} alt={svc.title} className="w-full h-32 object-cover" />}
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold line-clamp-1">{svc.title}</h3>
                      <Badge variant={svc.status === "published" ? "default" : "secondary"}>{svc.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{svc.headline}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-primary text-primary" />{svc.rating_avg.toFixed(1)}</span>
                      <span>{svc.orders_count} orders</span>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline"><Edit className="w-3 h-3" /></Button>
                      <Button size="sm" variant="outline"><Eye className="w-3 h-3" /></Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(svc.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : orders.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No orders yet.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="font-medium">Order #{order.id.slice(0, 8)}</div>
                      <div className="text-sm text-muted-foreground">${order.price} · {new Date(order.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusColor(order.status)}>{order.status}</Badge>
                      {order.status === "pending" && (
                        <Button size="sm" onClick={() => handleStatusUpdate(order.id, "accepted")}>Accept</Button>
                      )}
                      {order.status === "accepted" && (
                        <Button size="sm" onClick={() => handleStatusUpdate(order.id, "in_progress")}>Start Work</Button>
                      )}
                      {order.status === "in_progress" && (
                        <Button size="sm" onClick={() => handleStatusUpdate(order.id, "completed")}>Mark Complete</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
