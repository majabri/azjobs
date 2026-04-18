'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { logger } from '@/lib/logger';

interface FormData {
  title: string;
  description: string;
  location: string;
  salary_min: string;
  salary_max: string;
  job_type: string;
  skills_required: string;
  experience_level: string;
  employment_type: string;
  benefits: string;
}

type ToastType = 'success' | 'error' | null;

export default function JobPostingForm() {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    location: '',
    salary_min: '',
    salary_max: '',
    job_type: 'full-time',
    skills_required: '',
    experience_level: 'mid',
    employment_type: 'permanent',
    benefits: ''
  });

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string }>({
    type: null,
    message: ''
  });

  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast({ type: null, message: '' }), 4000);
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.title.trim()) {
      showToast('error', 'Job title is required');
      return;
    }
    if (!formData.description.trim()) {
      showToast('error', 'Job description is required');
      return;
    }
    if (!formData.location.trim()) {
      showToast('error', 'Location is required');
      return;
    }
    if (!formData.salary_min || !formData.salary_max) {
      showToast('error', 'Salary range is required');
      return;
    }

    const salaryMin = parseInt(formData.salary_min);
    const salaryMax = parseInt(formData.salary_max);

    if (salaryMin > salaryMax) {
      showToast('error', 'Minimum salary cannot exceed maximum salary');
      return;
    }

    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast('error', 'Please sign in to post a job');
        return;
      }

      const skillsArray = formData.skills_required
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      // Insert job posting
      const { error: insertError } = await supabase
        .from('job_postings')
        .insert({
          employer_id: user.id,
          title: formData.title.trim(),
          description: formData.description.trim(),
          location: formData.location.trim(),
          salary_min: salaryMin,
          salary_max: salaryMax,
          job_type: formData.job_type,
          skills_required: skillsArray,
          experience_level: formData.experience_level,
          employment_type: formData.employment_type,
          benefits: formData.benefits.trim() || null,
          status: 'active'
        });

      if (insertError) throw insertError;

      showToast('success', 'Job posted successfully!');

      // Reset form
      setFormData({
        title: '',
        description: '',
        location: '',
        salary_min: '',
        salary_max: '',
        job_type: 'full-time',
        skills_required: '',
        experience_level: 'mid',
        employment_type: 'permanent',
        benefits: ''
      });

      // Redirect after 2 seconds
      setTimeout(() => {
        window.location.href = '/employer/dashboard';
      }, 2000);
    } catch (err) {
      logger.error('Error posting job:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to post job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-card border-border">
          <div className="p-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Post a Job</h1>
            <p className="text-muted-foreground mb-8">
              Fill in the details below to create a new job posting
            </p>

            {/* Toast Notifications */}
            {toast.type && (
              <div
                className={`mb-6 p-4 rounded-lg flex items-center gap-3 border ${
                  toast.type === 'success'
                    ? 'bg-green-900/30 border-green-700 text-green-300'
                    : 'bg-red-900/30 border-red-700 text-red-300'
                }`}
              >
                {toast.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                )}
                <span className="flex-1">{toast.message}</span>
                <button
                  onClick={() => setToast({ type: null, message: '' })}
                  className="text-current hover:opacity-75"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Job Title */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Job Title *
                </label>
                <Input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g., Senior React Developer"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Job Description *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe the role, responsibilities, and requirements..."
                  rows={6}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Location *
                </label>
                <Input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g., San Francisco, CA or Remote"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* Salary Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Minimum Salary (USD) *
                  </label>
                  <Input
                    type="number"
                    name="salary_min"
                    value={formData.salary_min}
                    onChange={handleChange}
                    placeholder="e.g., 80000"
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Maximum Salary (USD) *
                  </label>
                  <Input
                    type="number"
                    name="salary_max"
                    value={formData.salary_max}
                    onChange={handleChange}
                    placeholder="e.g., 120000"
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {/* Job Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Job Type
                  </label>
                  <select
                    name="job_type"
                    value={formData.job_type}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="temporary">Temporary</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Experience Level
                  </label>
                  <select
                    name="experience_level"
                    value={formData.experience_level}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="entry">Entry Level</option>
                    <option value="mid">Mid Level</option>
                    <option value="senior">Senior</option>
                    <option value="lead">Lead/Manager</option>
                  </select>
                </div>
              </div>

              {/* Skills Required */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Required Skills (comma-separated)
                </label>
                <Input
                  type="text"
                  name="skills_required"
                  value={formData.skills_required}
                  onChange={handleChange}
                  placeholder="e.g., React, TypeScript, Node.js, PostgreSQL"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* Employment Type */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Employment Type
                </label>
                <select
                  name="employment_type"
                  value={formData.employment_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="permanent">Permanent</option>
                  <option value="temporary">Temporary</option>
                  <option value="contract">Contract</option>
                </select>
              </div>

              {/* Benefits */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Benefits (optional)
                </label>
                <textarea
                  name="benefits"
                  value={formData.benefits}
                  onChange={handleChange}
                  placeholder="e.g., Health insurance, 401k, Remote work, Unlimited PTO"
                  rows={3}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-primary hover:bg-primary/90 text-foreground py-2 font-medium"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    'Post Job'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-border text-muted-foreground hover:bg-muted"
                  onClick={() => window.location.href = '/employer/dashboard'}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
