'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Filter, Clock, DollarSign, Star } from 'lucide-react';

interface GigProject {
  id: string;
  title: string;
  description: string;
  category_id: string;
  budget_min: number;
  budget_max: number;
  timeline: string;
  status: string;
  skills_required: string[];
  created_at: string;
  category?: { name: string };
}

interface GigCategory {
  id: string;
  name: string;
  icon: string;
  project_count?: number;
}

export default function GigMarketplace() {
  const [projects, setProjects] = useState<GigProject[]>([]);
  const [categories, setCategories] = useState<GigCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    category: '',
    budget_min: '',
    budget_max: '',
    timeline: '',
    search: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('gig_categories')
        .select('*')
        .order('name');

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch projects
      await fetchProjects();
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load marketplace');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      let query = supabase
        .from('gig_projects')
        .select(`
          id,
          title,
          description,
          category_id,
          budget_min,
          budget_max,
          timeline,
          status,
          skills_required,
          created_at,
          gig_categories(name)
        `)
        .eq('status', 'open');

      // Apply filters
      if (filters.category) {
        query = query.eq('category_id', filters.category);
      }

      if (filters.budget_min) {
        query = query.gte('budget_min', parseInt(filters.budget_min));
      }

      if (filters.budget_max) {
        query = query.lte('budget_max', parseInt(filters.budget_max));
      }

      if (filters.timeline) {
        query = query.eq('timeline', filters.timeline);
      }

      if (filters.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
        );
      }

      const { data: projectsData, error: projectsError } = await query
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      const formattedProjects = (projectsData || []).map(proj => ({
        ...proj,
        category: proj.gig_categories
      })) as GigProject[];

      setProjects(formattedProjects);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    fetchProjects();
  };

  const handleResetFilters = () => {
    setFilters({
      category: '',
      budget_min: '',
      budget_max: '',
      timeline: '',
      search: ''
    });
  };

  const formatBudget = (min: number, max: number) => {
    const format = (n: number) => `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return `${format(min)} - ${format(max)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading gigs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-2">Gig Marketplace</h1>
          <p className="text-muted-foreground">
            Browse and apply for thousands of projects and opportunities
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <Card className="bg-card border-border sticky top-4">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Filter className="w-5 h-5 text-primary" />
                  Filters
                </h3>

                {/* Search */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      name="search"
                      value={filters.search}
                      onChange={handleFilterChange}
                      placeholder="Search projects..."
                      className="w-full pl-10 pr-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Category */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Category
                  </label>
                  <select
                    name="category"
                    value={filters.category}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Budget Range */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Budget (USD)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="number"
                      name="budget_min"
                      value={filters.budget_min}
                      onChange={handleFilterChange}
                      placeholder="Min"
                      className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                      type="number"
                      name="budget_max"
                      value={filters.budget_max}
                      onChange={handleFilterChange}
                      placeholder="Max"
                      className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Timeline */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Timeline
                  </label>
                  <select
                    name="timeline"
                    value={filters.timeline}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Any Timeline</option>
                    <option value="immediate">Immediate ({'<'} 1 week)</option>
                    <option value="short">Short (1-2 weeks)</option>
                    <option value="medium">Medium (1-3 months)</option>
                    <option value="long">Long ({'>'} 3 months)</option>
                  </select>
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={handleApplyFilters}
                    className="flex-1 bg-primary hover:bg-primary/90 text-foreground"
                  >
                    Apply
                  </Button>
                  <Button
                    onClick={handleResetFilters}
                    variant="outline"
                    className="flex-1 border-border text-muted-foreground hover:bg-muted"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Projects Grid */}
          <div className="lg:col-span-3">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-foreground">
                {projects.length} Projects Available
              </h2>
            </div>

            {projects.length === 0 ? (
              <Card className="bg-card border-border p-12 text-center">
                <p className="text-muted-foreground mb-4">
                  No projects found matching your filters
                </p>
                <Button
                  variant="outline"
                  className="border-border text-muted-foreground hover:bg-muted"
                  onClick={handleResetFilters}
                >
                  Clear Filters
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {projects.map(project => (
                  <Card
                    key={project.id}
                    className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-foreground mb-2">
                            {project.title}
                          </h3>
                          {project.category && (
                            <Badge
                              variant="outline"
                              className="border-primary bg-primary/30 text-primary/80 mb-3"
                            >
                              {project.category.name}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {formatBudget(project.budget_min, project.budget_max)}
                          </div>
                          <div className="text-xs text-muted-foreground">Budget</div>
                        </div>
                      </div>

                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                        {project.description}
                      </p>

                      {/* Skills Tags */}
                      <div className="mb-4">
                        <div className="flex flex-wrap gap-2">
                          {project.skills_required?.slice(0, 4).map((skill, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="bg-muted text-muted-foreground/70 border-border"
                            >
                              {skill}
                            </Badge>
                          ))}
                          {project.skills_required?.length > 4 && (
                            <Badge
                              variant="secondary"
                              className="bg-muted text-muted-foreground/70 border-border"
                            >
                              +{project.skills_required.length - 4}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="flex justify-between items-center">
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {project.timeline}
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            {project.status}
                          </div>
                        </div>
                        <Button
                          className="bg-primary hover:bg-primary/90 text-foreground"
                          onClick={() => window.location.href = `/gig/${project.id}`}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
