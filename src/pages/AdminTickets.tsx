'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Search,
  Filter,
  Zap,
  ChevronDown,
  AlertCircle
} from 'lucide-react';

interface SupportTicket {
  id: string;
  ticket_number: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

type SortField = 'created_at' | 'severity' | 'status';

export default function AdminTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [triageLoading, setTriageLoading] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    status: '',
    severity: '',
    search: ''
  });

  const [sortBy, setSortBy] = useState<SortField>('created_at');

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (error === null) {
      fetchTickets();
    }
  }, [filters, sortBy]);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in');
        return;
      }

      // Check if user is admin
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || profileData?.role !== 'admin') {
        setError('Access denied. Admin privileges required.');
        return;
      }

      setError(null);
    } catch (err) {
      console.error('Error checking admin access:', err);
      setError('Failed to verify admin access');
    }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('support_tickets')
        .select('*');

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.severity) {
        query = query.eq('severity', filters.severity);
      }

      if (filters.search) {
        query = query.or(
          `ticket_number.ilike.%${filters.search}%,title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
        );
      }

      // Apply sorting
      const ascending = sortBy === 'status';
      const orderColumn = sortBy === 'severity' ? 'severity' : 'created_at';
      query = query.order(orderColumn, { ascending });

      const { data: ticketsData, error: ticketsError } = await query;

      if (ticketsError) throw ticketsError;
      setTickets(ticketsData || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      const { error: updateError } = await supabase
        .from('support_tickets')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      // Update local state
      setTickets(prev =>
        prev.map(t => (t.id === ticketId ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      console.error('Error updating ticket:', err);
      alert(err instanceof Error ? err.message : 'Failed to update ticket');
    }
  };

  const handleAITriage = async (ticketId: string) => {
    try {
      setTriageLoading(ticketId);

      // Get the ticket data
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) return;

      // Call the support-service Edge Function
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/support-service`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
          },
          body: JSON.stringify({
            action: 'triage',
            ticketId,
            category: ticket.category,
            severity: ticket.severity,
            title: ticket.title,
            description: ticket.description,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to run AI triage');
      }

      const result = await response.json();

      // Update ticket with triage result
      const { error: updateError } = await supabase
        .from('support_tickets')
        .update({
          triage_result: result.triage_result,
          suggested_priority: result.suggested_priority,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      // Refresh tickets
      await fetchTickets();
      alert(`AI Triage complete: ${result.triage_result}`);
    } catch (err) {
      console.error('Error running AI triage:', err);
      alert(err instanceof Error ? err.message : 'Failed to run AI triage');
    } finally {
      setTriageLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-900/30 text-blue-300 border-blue-700';
      case 'in_progress':
        return 'bg-yellow-900/30 text-yellow-300 border-yellow-700';
      case 'resolved':
        return 'bg-green-900/30 text-green-300 border-green-700';
      case 'closed':
        return 'bg-gray-700 text-gray-300 border-gray-600';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-900/30 text-red-300 border-red-700';
      case 'high':
        return 'bg-orange-900/30 text-orange-300 border-orange-700';
      case 'medium':
        return 'bg-yellow-900/30 text-yellow-300 border-yellow-700';
      case 'low':
        return 'bg-green-900/30 text-green-300 border-green-700';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  const getSeveritySortOrder = (severity: string): number => {
    const order: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    return order[severity] ?? 4;
  };

  const displayTickets =
    sortBy === 'severity'
      ? [...tickets].sort((a, b) =>
          getSeveritySortOrder(a.severity) - getSeveritySortOrder(b.severity)
        )
      : tickets;

  if (error && error.includes('Access denied')) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Card className="bg-gray-800 border-gray-700 max-w-md w-full mx-4 p-8">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-gray-400 mb-6">{error}</p>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => window.location.href = '/'}
            >
              Back to Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Support Tickets</h1>
          <p className="text-gray-400">Manage and triage customer support requests</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Filters */}
        <Card className="bg-gray-800 border-gray-700 mb-8 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={e =>
                    setFilters(prev => ({ ...prev, search: e.target.value }))
                  }
                  placeholder="Search tickets..."
                  className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={e =>
                  setFilters(prev => ({ ...prev, status: e.target.value }))
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Severity Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Severity
              </label>
              <select
                value={filters.severity}
                onChange={e =>
                  setFilters(prev => ({ ...prev, severity: e.target.value }))
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortField)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="created_at">Newest First</option>
                <option value="severity">By Severity</option>
                <option value="status">By Status</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Tickets List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
          </div>
        ) : displayTickets.length === 0 ? (
          <Card className="bg-gray-800 border-gray-700 p-12 text-center">
            <p className="text-gray-400">No tickets found</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {displayTickets.map(ticket => (
              <div key={ticket.id}>
                <Card
                  className="bg-gray-800 border-gray-700 hover:border-teal-500/50 transition-colors cursor-pointer"
                  onClick={() =>
                    setExpandedTicket(
                      expandedTicket === ticket.id ? null : ticket.id
                    )
                  }
                >
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Ticket Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <p className="text-sm text-gray-400 mb-1">
                              {ticket.ticket_number}
                            </p>
                            <h3 className="text-lg font-semibold text-white truncate">
                              {ticket.title}
                            </h3>
                          </div>
                          <ChevronDown
                            className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                              expandedTicket === ticket.id ? 'rotate-180' : ''
                            }`}
                          />
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge
                            variant="outline"
                            className={`border ${getStatusColor(ticket.status)}`}
                          >
                            {ticket.status}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`border ${getSeverityColor(ticket.severity)}`}
                          >
                            {ticket.severity}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-gray-600 text-gray-300"
                          >
                            {ticket.category}
                          </Badge>
                        </div>

                        {/* Timestamp */}
                        <p className="text.xs text-gray-500">
                          Created {new Date(ticket.created_at).toLocaleString()}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
                          onClick={e => {
                            e.stopPropagation();
                            handleAITriage(ticket.id);
                          }}
                          disabled={triageLoading === ticket.id}
                        >
                          {triageLoading === ticket.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Zap className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedTicket === ticket.id && (
                      <div className="mt-6 pt-6 border-t border-gray-700">
                        <p className="text-gray-300 mb-6">{ticket.description}</p>

                        {/* Status Update Buttons */}
                        <div className="flex gap-2">
                          {['open', 'in_progress', 'resolved', 'closed'].map(
                            status => (
                              <Button
                                key={status}
                                size="sm"
                                variant={
                                  ticket.status === status ? 'default' : 'outline'
                                }
                                className={
                                  ticket.status === status
                                    ? 'bg-teal-600 hover:bg-teal-700 text-white'
                                    : 'border-gray-600 text-gray-300 hover:bg-gray-700'
                                }
                                onClick={e => {
                                  e.stopPropagation();
                                  updateTicketStatus(ticket.id, status);
                                }}
                              >
                                {status.replace('_', ' ')}
                              </Button>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-4 gap-4 mt-8">
            <Card className="bg-gray-800 border-gray-700 p-6">
              <p className="text-gray-400 text-sm mb-2">Total Tickets</p>
              <p className="text-3xl font-bold text-white">{tickets.length}</p>
            </Card>
            <Card className="bg-gray-800 border-gray-700 p-6">
              <p className="text-gray-400 text-sm mb-2">Open</p>
              <p className="text-3xl font-bold text-blue-400">
                {tickets.filter(t => t.status === 'open').length}
              </p>
            </Card>
            <Card className="bg-gray-800 border-gray-700 p-6">
              <p className="text-gray-400 text-sm mb-2">In Progress</p>
              <p className="text-3xl font-bold text-yellow-400">
                {tickets.filter(t => t.status === 'in_progress').length}
              </p>
            </Card>
            <Card className="bg-gray-800 border-gray-700 p-6">
              <p className="text-gray-400 text-sm mb-2">Critical</p>
              <p className="text-3xl font-bold text-red-400">
                {tickets.filter(t => t.severity === 'critical').length}
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
