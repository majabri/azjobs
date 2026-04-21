import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { fetchPublishedServices, fetchPackages } from "@/services/marketplace/service";
import type { ServiceCatalog, ServicePackage } from "@/services/marketplace/types";
import { SERVICE_CATEGORIES } from "@/services/marketplace/types";
import { Search, Star, Loader2 } from "lucide-react";
import ServiceDetailView from "./ServiceDetailView";

export default function ServiceBrowser() {
  const [services, setServices] = useState<ServiceCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("recent");
  const [priceRange, setPriceRange] = useState([0, 1000]);
  const [minRating, setMinRating] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchPublishedServices();
        setServices(data);
      } catch { /* */ }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const list = services.filter((s) => {
      if (search && !s.title.toLowerCase().includes(search.toLowerCase()) && !s.headline.toLowerCase().includes(search.toLowerCase())) return false;
      if (category !== "all" && s.category !== category) return false;
      if (s.rating_avg < minRating) return false;
      return true;
    });
    switch (sort) {
      case "rating": list.sort((a, b) => b.rating_avg - a.rating_avg); break;
      case "price_low": list.sort((a, b) => a.orders_count - b.orders_count); break;
      case "price_high": list.sort((a, b) => b.orders_count - a.orders_count); break;
      default: list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return list;
  }, [services, search, category, sort, minRating]);

  if (selectedId) {
    return <ServiceDetailView serviceId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Browse Services</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search services..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {SERVICE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(minRating)} onValueChange={(v) => setMinRating(Number(v))}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Min Rating" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any Rating</SelectItem>
            <SelectItem value="3">3+ Stars</SelectItem>
            <SelectItem value="4">4+ Stars</SelectItem>
            <SelectItem value="4.5">4.5+ Stars</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="rating">Best Rated</SelectItem>
            <SelectItem value="price_low">Lowest Price</SelectItem>
            <SelectItem value="price_high">Highest Price</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No services found matching your criteria.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((svc) => (
            <Card key={svc.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedId(svc.id)}>
              {svc.image_url ? (
                <img src={svc.image_url} alt={svc.title} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-muted flex items-center justify-center text-muted-foreground text-sm">No image</div>
              )}
              <CardContent className="p-4 space-y-2">
                <Badge variant="outline" className="text-xs">{svc.category}</Badge>
                <h3 className="font-semibold line-clamp-1">{svc.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{svc.headline}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                    {svc.rating_avg.toFixed(1)} ({svc.rating_count})
                  </span>
                  <span className="font-semibold text-primary">{svc.orders_count} orders</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
