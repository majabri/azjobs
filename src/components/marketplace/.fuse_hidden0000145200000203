import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Clock, PlayCircle, Package } from "lucide-react";
import { fetchMyOrders } from "@/services/marketplace/service";
import type { CatalogOrder } from "@/services/marketplace/types";
import { logger } from '@/lib/logger';

const statusSteps = ["pending", "accepted", "in_progress", "completed"];
const statusIcons: Record<string, typeof Clock> = {
  pending: Clock,
  accepted: CheckCircle2,
  in_progress: PlayCircle,
  completed: Package,
};

export default function BuyerOrdersDashboard() {
  const [orders, setOrders] = useState<CatalogOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setOrders(await fetchMyOrders("buyer")); } catch (e) { logger.error("Failed to load orders:", e); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Orders</h1>
      {orders.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No orders yet. Browse services to get started!</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const stepIdx = statusSteps.indexOf(order.status);
            return (
              <Card key={order.id}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-semibold">Order #{order.id.slice(0, 8)}</div>
                      <div className="text-sm text-muted-foreground">${order.price} · Placed {new Date(order.created_at).toLocaleDateString()}</div>
                    </div>
                    <Badge variant={order.status === "completed" ? "default" : "secondary"}>{order.status.replace("_", " ")}</Badge>
                  </div>
                  {/* Timeline */}
                  <div className="flex items-center gap-0">
                    {statusSteps.map((s, i) => {
                      const Icon = statusIcons[s];
                      const active = i <= stepIdx;
                      return (
                        <div key={s} className="flex items-center flex-1">
                          <div className={`flex flex-col items-center ${active ? "text-primary" : "text-muted-foreground"}`}>
                            <Icon className="w-5 h-5" />
                            <span className="text-[10px] mt-1 capitalize">{s.replace("_", " ")}</span>
                          </div>
                          {i < statusSteps.length - 1 && (
                            <div className={`flex-1 h-0.5 mx-1 ${i < stepIdx ? "bg-primary" : "bg-border"}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {order.delivery_deadline && (
                    <div className="text-xs text-muted-foreground">Delivery by {new Date(order.delivery_deadline).toLocaleDateString()}</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
