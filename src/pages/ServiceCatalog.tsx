'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Star, Heart, ShoppingCart, User } from 'lucide-react';

interface ServiceTier {
  id: string;
  tier_name: string;
  description: string;
  price: number;
  delivery_days: number;
  features: string[];
}

interface ServiceListing {
  id: string;
  title: string;
  description: string;
  category_id: string;
  seller_id: string;
  rating: number;
  review_count: number;
  image_url: string;
  tiers: ServiceTier[];
  category?: { name: string };
  seller?: { display_name: string; avatar_url: string };
}

interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
}

export default function ServiceCatalog() {
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchData intentionally excluded; mount-only load
  }, []);

  useEffect(() => {
    if (categories.length > 0) {
      fetchServices();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- categories.length and fetchServices intentionally excluded
  }, [selectedCategory, sortBy]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('service_categories')
        .select('*')
        .order('name');

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch services
      await fetchServices();
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      let query = supabase
        .from('service_listings')
        .select(`
          id,
          title,
          description,
          category_id,
          seller_id,
          rating,
          review_count,
          image_url,
          service_categories(name),
          user_profiles(display_name, avatar_url),
          service_tiers(*)
        `);

      if (selectedCategory) {
        query = query.eq('category_id', selectedCategory);
      }

      // Apply sorting
      if (sortBy === 'newest') {
        query = query.order('created_at', { ascending: false });
      } else if (sortBy === 'rating') {
        query = query.order('rating', { ascending: false });
      } else if (sortBy === 'price_low') {
        query = query.order('min_price', { ascending: true });
      }

      const { data: servicesData, error: servicesError } = await query;

      if (servicesError) throw servicesError;

      const formattedServices = (servicesData || []).map(svc => ({
        ...svc,
        category: svc.service_categories,
        seller: svc.user_profiles,
        tiers: svc.service_tiers?.sort((a, b) => a.price - b.price) || []
      })) as ServiceListing[];

      setServices(formattedServices);
    } catch (err) {
      console.error('Error fetching services:', err);
      setError(err instanceof Error ? err.message : 'Failed to load services');
    }
  };

  const toggleFavorite = (serviceId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(serviceId)) {
        newFavorites.delete(serviceId);
      } else {
        newFavorites.add(serviceId);
      }
      return newFavorites;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-2">Service Catalog</h1>
          <p className="text-muted-foreground">
            Explore professional services from verified experts
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Category Filter */}
        <div className="mb-8 overflow-x-auto pb-4">
          <div className="flex gap-2 min-w-min">
            <Button
              variant={selectedCategory === '' ? 'default' : 'outline'}
              className={
                selectedCategory === ''
                  ? 'bg-primary hover:bg-primary/90 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-card'
              }
              onClick={() => setSelectedCategory('')}
            >
              All Services
            </Button>
            {categories.map(cat => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                className={
                  selectedCategory === cat.id
                    ? 'bg-primary hover:bg-primary/90 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-card'
                }
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Sort Options */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-foreground">
            {services.length} Services Available
          </h2>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-4 py-2 bg-card border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="newest">Newest</option>
            <option value="rating">Highest Rated</option>
            <option value="price_low">Price: Low to High</option>
          </select>
        </div>

        {/* Services Grid */}
        {services.length === 0 ? (
          <Card className="bg-card border-border p-12 text-center">
            <p className="text-muted-foreground">No services found in this category</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map(service => (
              <Card
                key={service.id}
                className="bg-card border-border overflow-hidden hover:border-primary/50 transition-all"
              >
                {/* Service Image */}
                <div className="relative h-48 bg-muted overflow-hidden">
                  {service.image_url && (
                    <img
                      src={service.image_url}
                      alt={service.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <button
                    onClick={() => toggleFavorite(service.id)}
                    className="absolute top-2 right-2 p-2 bg-gray-900/75 rounded-full hover:bg-background transition-colors"
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        favorites.has(service.id)
                          ? 'fill-red-500 text-red-500'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4">
                  {/* Seller Info */}
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                    {service.seller?.avatar_url && (
                      <img
                        src={service.seller.avatar_url}
                        alt={service.seller.display_name}
                        className="w-8 h-8 rounded-full bg-muted"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground truncate">
                        {service.seller?.display_name || 'Anonymous'}
                      </p>
                    </div>
                  </div>

                  {/* Title & Category */}
                  <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-2">
                    {service.title}
                  </h3>
                  {service.category && (
                    <Badge
                      variant="outline"
                      className="border-primary bg-primary/30 text-primary mb-3"
                    >
                      {service.category.name}
                    </Badge>
                  )}

                  {/* Rating */}
                  <div className="flex items-center gap-1 mb-4">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(service.rating)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground ml-2">
                      {service.rating.toFixed(1)} ({service.review_count})
                    </span>
                  </div>

                  {/* Tiers */}
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">STARTING FROM</p>
                    {service.tiers && service.tiers.length > 0 ? (
                      <div className="space-y-2">
                        {service.tiers.map(tier => (
                          <div
                            key={tier.id}
                            className="p-3 bg-gray-700/50 rounded border border-border hover:border-primary/50 cursor-pointer transition-colors"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-semibold text-foreground">
                                  {tier.tier_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {tier.delivery_days} day{tier.delivery_days !== 1 ? 's' : ''} delivery
                                </p>
                              </div>
                              <p className="text-lg font-bold text-primary">
                                ${tier.price}
                              </p>
                            </div>
                            {tier.features && tier.features.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {tier.features.slice(0, 2).map((feature, idx) => (
                                  <div key={idx}>â¢ {feature}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Contact for pricing</p>
                    )}
                  </div>

                  {/* Action Button */}
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-foreground"
                    onClick={() => window.location.href = `/service/${service.id}`}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    View & Order
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
