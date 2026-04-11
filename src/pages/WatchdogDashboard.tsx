'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';

interface WatchdogProbe {
  id: string;
  name: string;
  endpoint: string;
  expected_status: number;
  interval_seconds: number;
  is_active: boolean;
}

interface WatchdogResult {
  id: string;
  probe_id: string;
  status_code: number;
  response_time_ms: number;
  is_healthy: boolean;
  error_message: string | null;
  checked_at: string;
  probe?: WatchdogProbe;
}

interface WatchdogIncident {
  id: string;
  probe_id: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  probe?: WatchdogProbe;
}

export default function WatchdogDashboard() {
  const [probes, setProbes] = useState<WatchdogProbe[]>([]);
  const [results, setResults] = useState<WatchdogResult[]>([]);
  const [incidents, setIncidents] = useState<WatchdogIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uptime, setUptime] = useState(99.9);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (error === null) {
      fetchDashboardData();
      // Refresh every 30 seconds
      const interval = setInterval(fetchDashboardData, 30000);
      return () => clearInterval(interval);
    }
  }, [timeRange]);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in');
        return;
      }

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

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate time range
      const now = new Date();
      const hoursAgo = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
      const startTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

      // Fetch probes
      const { data: probesData, error: probesError } = await supabase
        .from('watchdog_probes')
        .select('*')
        .eq('is_active', true);

      if (probesError) throw probesError;
      setProbes(probesData || []);

      // Fetch recent results
      const { data: resultsData, error: resultsError } = await supabase
        .from('watchdog_results')
        .select(`
          *,
          watchdog_probes(*)
        `)
        .gte('checked_at', startTime.toISOString())
        .order('checked_at', { ascending: false })
        .limit(500);

      if (resultsError) throw resultsError;

      const formattedResults = (resultsData || []).map(r => ({
        ...r,
        probe: r.watchdog_probes
      })) as WatchdogResult[];

      setResults(formattedResults);

      // Calculate uptime
      if (formattedResults.length > 0) {
        const healthyCount = formattedResults.filter(r => r.is_healthy).length;
        const calculatedUptime = (healthyCount / formattedResults.length) * 100;
        setUptime(Math.min(100, Math.max(0, calculatedUptime)));
      }

      // Fetch incidents
      const { data: incidentsData, error: incidentsError } = await supabase
        .from('watchdog_incidents')
        .select(`
          *,
          watchdog_probes(*)
        `)
        .gte('created_at', startTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (incidentsError) throw incidentsError;

      const formattedIncidents = (incidentsData || []).map(i => ({
        ...i,
        probe: i.watchdog_probes
      })) as WatchdogIncident[];

      setIncidents(formattedIncidents);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (isHealthy: boolean) => {
    return isHealthy ? (
      <CheckCircle className="w-5 h-5 text-green-400" />
    ) : (
      <AlertCircle className="w-5 h-5 text-red-400" />
    );
  };

  const getStatusBadge = (isHealthy: boolean) => {
    return isHealthy ? (
      <Badge className="bg-green-900/30 text-green-300 border-green-700 border">
        Healthy
      </Badge>
    ) : (
      <Badge className="bg-red-900/30 text-red-300 border-red-700 border">
        Unhealthy
      </Badge>
    );
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
        return 'bg-blue-900/30 text-blue-300 border-blue-700';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  const getUptimeColor = () => {
    if (uptime >= 99.5) return 'text-green-400';
    if (uptime >= 99) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (error && error.includes('Access denied')) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Card className="bg-gray-800 border-gray-700 max-w-md w-full mx-4 p-8">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-gray-400">{error}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">System Health</h1>
            <p className="text-gray-400">Monitor platform health and service status</p>
          </div>
          <div className="flex gap-2">
            {['24h', '7d', '30d'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {/* Uptime */}
              <Card className="bg-gray-800 border-gray-700 p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-sm font-medium text-gray-400">SLO Uptime</h3>
                  <TrendingUp className="w-5 h-5 text-teal-400" />
                </div>
                <div className={`text-3xl font-bold ${getUptimeColor()}`}>
                  {uptime.toFixed(2)}%
                </div>
                <p className="text-xs text-gray-500 mt-2">Last {timeRange}</p>
              </Card>

              {/* Active Probes */}
              <Card className="bg-gray-800 border-gray-700 p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-sm font-medium text-gray-400">
                    Active Probes
                  </h3>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-3xl font-bold text-white">{probes.length}</div>
                <p className="text-xs text-gray-500 mt-2">Monitoring endpoints</p>
              </Card>

              {/* Healthy Probes */}
              <Card className="bg-gray-800 border-gray-700 p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-sm font-medium text-gray-400">Healthy</h3>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-3xl font-bold text-green-400">
                  {results.filter(r => r.is_healthy).length}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {probes.length > 0
                    ? `${(
                        (results.filter(r => r.is_healthy).length /
                          results.length) *
                        100
                      ).toFixed(0)}% of checks`
                    : 'No data'}
                </p>
              </Card>

              {/* Active Incidents */}
              <Card className="bg-gray-800 border-gray-700 p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-sm font-medium text-gray-400">
                    Active Incidents
                  </h3>
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div className="text-3xl font-bold text-red-400">
                  {incidents.filter(i => i.status === 'open').length}
                </div>
                <p className="text-xs text-gray-500 mt-2">Unresolved</p>
              </Card>
            </div>

            {/* Recent Checks */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Probes Status */}
              <div className="lg:col-span-2">
                <h2 className="text-xl font-bold text-white mb-4">
                  Probe Status (Last 24h)
                </h2>
                <Card className="bg-gray-800 border-gray-700">
                  <div className="divide-y divide-gray-700">
                    {results.length === 0 ? (
                      <div className="p-6 text-center text-gray-400">
                        No data available
                      </div>
                    ) : (
                      results.slice(0, 20).map(result => (
                        <div
                          key={result.id}
                          className="p-4 hover:bg-gray-700/30 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {getStatusIcon(result.is_healthy)}
                              <div className="min-w-0">
                                <p className="font-medium text-white truncate">
                                  {result.probe?.name || 'Unknown Probe'}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {result.probe?.endpoint}
                                </p>
                              </div>
                            </div>
                            {getStatusBadge(result.is_healthy)}
                          </div>
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>
                              Status: {result.status_code} | Response:{' '}
                              {result.response_time_ms}ms
                            </span>
                            <span>
                              {new Date(result.checked_at).toLocaleTimeString()}
                            </span>
                          </div>
                          {result.error_message && (
                            <p className="text-xs text-red-400 mt-1">
                              {result.error_message}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>

              {/* Incidents Timeline */}
              <div>
                <h2 className="text-xl font-bold text-white mb-4">
                  Incident Timeline
                </h2>
                <Card className="bg-gray-800 border-gray-700">
                  {incidents.length === 0 ? (
                    <div className="p-6 text-center text-gray-400">
                      No incidents
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-700">
                      {incidents.slice(0, 10).map(incident => (
                        <div key={incident.id} className="p-4 hover:bg-gray-700/30">
                          <div className="flex gap-3 mb-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-orange-400" />
                            <div className="min-w-0">
                              <p className="font-medium text-white text-sm truncate">
                                {incident.title}
                              </p>
                              <Badge
                                variant="outline"
                                className={`border ${getSeverityColor(
                                  incident.severity
                                )} mt-1`}
                              >
                                {incident.severity}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 ml-7">
                            {new Date(incident.created_at).toLocaleTimeString()}
                          </p>
                          {!incident.resolved_at && (
                            <p className="text-xs text-red-400 ml-7 mt-1">
                              Still ongoing
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
