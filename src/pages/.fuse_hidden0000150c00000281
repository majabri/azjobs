'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, Edit2, BarChart3 } from 'lucide-react';
import { logger } from '@/lib/logger';

interface JobPosting {
  id: string;
  title: string;
  description: string;
  location: string;
  salary_min: number;
  salary_max: number;
  job_type: string;
  status: 'active' | 'paused' | 'closed';
  created_at: string;
  application_count?: number;
}

interface EmployerProfile {
  id: string;
  company_name: string;
  company_logo_url: string;
  description: string;
  website: string;
  total_jobs_posted: number;
}

export default function EmployerDashboard() {
  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEmployerData();
  }, []);

  const fetchEmployerData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to view your dashboard');
        return;
      }

      // Fetch employer profile
      const { data: profileData, error: profileError } = await supabase
        .from('employer_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch job postings with application count
      const { data: jobsData, error: jobsError } = await supabase
        .from('job_postings')
        .select(`
          id,
          title,
          description,
          location,
          salary_min,
          salary_max,
          job_type,
          status,
          created_at,
          job_applications(count)
        `)
        .eq('employer_id', user.id)
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

      const formattedJobs = (jobsData || []).map(job => ({
        ...job,
        application_count: job.job_applications?.[0]?.count || 0
      })) as JobPosting[];

      setJobPostings(formattedJobs);
    } catch (err) {
      logger.error('Error fetching employer data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30';
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30';
      case 'closed':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatSalary = (min: number, max: number) => {
    const format = (n: number) => `$${(n / 1000).toFixed(0)}k`;
    return `${format(min)} - ${format(max)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Profile Section */}
        {profile && (
          <Card className="mb-8 bg-card border-border">
            <div className="p-6">
              <div className="flex items-start gap-6">
                {profile.company_logo_url && (
                  <img
                    src={profile.company_logo_url}
                    alt={profile.company_name}
                    className="w-24 h-24 rounded-lg bg-muted object-cover"
                  />
                )}
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    {profile.company_name}
                  </h1>
                  <p className="text-muted-foreground mb-4">{profile.description}</p>
                  <div className="flex gap-4">
                    {profile.website && (
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                      >
                        Visit Website
                      </a>
                    )}
                    <span className="text-muted-foreground">
                      {profile.total_jobs_posted} jobs posted
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10"
                >
                  Edit Profile
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-card border-border p-6">
            <div className="text-muted-foreground text-sm mb-2">Active Postings</div>
            <div className="text-3xl font-bold text-foreground">
              {jobPostings.filter(j => j.status === 'active').length}
            </div>
          </Card>
          <Card className="bg-card border-border p-6">
            <div className="text-muted-foreground text-sm mb-2">Total Applications</div>
            <div className="text-3xl font-bold text-foreground">
              {jobPostings.reduce((sum, j) => sum + (j.application_count || 0), 0)}
            </div>
          </Card>
          <Card className="bg-card border-border p-6">
            <div className="text-muted-foreground text-sm mb-2">Total Postings</div>
            <div className="text-3xl font-bold text-foreground">
              {jobPostings.length}
            </div>
          </Card>
        </div>

        {/* Job Postings Section */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-foreground">Your Job Postings</h2>
            <Button
              className="bg-primary hover:bg-primary/90 text-foreground"
              onClick={() => window.location.href = '/post-job'}
            >
              Post New Job
            </Button>
          </div>

          {jobPostings.length === 0 ? (
            <Card className="bg-card border-border p-12 text-center">
              <p className="text-muted-foreground mb-4">You haven't posted any jobs yet</p>
              <Button
                className="bg-primary hover:bg-primary/90 text-foreground"
                onClick={() => window.location.href = '/post-job'}
              >
                Create Your First Job Posting
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {jobPostings.map(job => (
                <Card
                  key={job.id}
                  className="bg-card border-border hover:border-primary/50 transition-colors"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">
                          {job.title}
                        </h3>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge
                            variant="outline"
                            className={`border ${getStatusColor(job.status)}`}
                          >
                            {job.status}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-border text-muted-foreground"
                          >
                            {job.job_type}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-border text-muted-foreground"
                          >
                            {job.location}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary mb-1">
                          {job.application_count || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">applications</div>
                      </div>
                    </div>

                    <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                      {job.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {formatSalary(job.salary_min, job.salary_max)}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <BarChart3 className="w-4 h-4 mr-2" />
                          Analytics
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
