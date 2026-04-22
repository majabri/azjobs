"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  MessageSquare,
} from "lucide-react";
import { logger } from "@/lib/logger";

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
}

type ToastType = "success" | "error" | null;

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState<"submit" | "tickets">("submit");
  const [loading, setLoading] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: ToastType; message: string }>({
    type: null,
    message: "",
  });

  const [formData, setFormData] = useState({
    category: "bug",
    severity: "medium",
    title: "",
    description: "",
    stepsToReproduce: "",
    environment: "",
  });

  useEffect(() => {
    if (activeTab === "tickets") {
      fetchTickets();
    }
  }, [activeTab]);

  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast({ type: null, message: "" }), 4000);
  };

  const fetchTickets = async () => {
    try {
      setTicketsLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Please sign in to view your tickets");
        return;
      }

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (ticketsError) throw ticketsError;
      setTickets((ticketsData as unknown as SupportTicket[]) || []);
    } catch (err) {
      logger.error("Error fetching tickets:", err);
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setTicketsLoading(false);
    }
  };

  const generateTicketNumber = (): string => {
    const num = Math.floor(Math.random() * 10000);
    return `iCOS-${String(num).padStart(4, "0")}`;
  };

  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!formData.title.trim()) {
      showToast("error", "Title is required");
      return;
    }
    if (!formData.description.trim()) {
      showToast("error", "Description is required");
      return;
    }

    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        showToast("error", "Please sign in to submit a support ticket");
        return;
      }

      const ticketNumber = generateTicketNumber();

      const { error: insertError } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user.id,
          ticket_number: ticketNumber,
          title: formData.title.trim(),
          description: formData.description.trim(),
          email: user.email || null,
          status: "open",
        } as any);

      if (insertError) throw insertError;

      showToast("success", `Ticket ${ticketNumber} submitted successfully!`);

      // Reset form
      setFormData({
        category: "bug",
        severity: "medium",
        title: "",
        description: "",
        stepsToReproduce: "",
        environment: "",
      });

      // Switch to tickets tab
      setTimeout(() => {
        setActiveTab("tickets");
      }, 2000);
    } catch (err) {
      logger.error("Error submitting ticket:", err);
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to submit ticket",
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "in_progress":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30";
      case "resolved":
        return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30";
      case "closed":
        return "bg-muted text-muted-foreground border-border";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
      case "high":
        return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30";
      case "medium":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30";
      case "low":
        return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Support & Help Center
          </h1>
          <p className="text-muted-foreground">
            Submit bug reports, feature requests, and general support tickets
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-border">
          <button
            onClick={() => setActiveTab("submit")}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === "submit"
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            Submit Ticket
          </button>
          <button
            onClick={() => setActiveTab("tickets")}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === "tickets"
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            My Tickets
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Submit Tab */}
        {activeTab === "submit" && (
          <Card className="bg-card border-border">
            <div className="p-8">
              <h2 className="text-2xl font-bold text-foreground mb-6">
                Create Support Ticket
              </h2>

              {toast.type && (
                <div
                  className={`mb-6 p-4 rounded-lg flex items-center gap-3 border ${
                    toast.type === "success"
                      ? "bg-green-900/30 border-green-700 text-green-300"
                      : "bg-red-900/30 border-red-700 text-red-300"
                  }`}
                >
                  {toast.type === "success" ? (
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  )}
                  <span className="flex-1">{toast.message}</span>
                  <button
                    onClick={() => setToast({ type: null, message: "" })}
                    className="text-current hover:opacity-75"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Category *
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="bug">Bug Report</option>
                      <option value="feature">Feature Request</option>
                      <option value="account">Account Issue</option>
                      <option value="payment">Payment/Billing</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Severity */}
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Severity *
                    </label>
                    <select
                      name="severity"
                      value={formData.severity}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleFormChange}
                    placeholder="Brief summary of your issue"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Description *
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleFormChange}
                    placeholder="Provide detailed information about your issue"
                    rows={5}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Steps to Reproduce */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Steps to Reproduce (for bugs)
                  </label>
                  <textarea
                    name="stepsToReproduce"
                    value={formData.stepsToReproduce}
                    onChange={handleFormChange}
                    placeholder="1. Step one&#10;2. Step two&#10;3. Step three"
                    rows={3}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Environment */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Environment / Browser Info
                  </label>
                  <input
                    type="text"
                    name="environment"
                    value={formData.environment}
                    onChange={handleFormChange}
                    placeholder="e.g., Chrome 120 on macOS 14.2"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 text-foreground py-2 font-medium"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Ticket"
                  )}
                </Button>
              </form>
            </div>
          </Card>
        )}

        {/* Tickets Tab */}
        {activeTab === "tickets" && (
          <div>
            {ticketsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <Card className="bg-card border-border p-12 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  You haven't submitted any tickets yet
                </p>
                <Button
                  className="bg-primary hover:bg-primary/90 text-foreground"
                  onClick={() => setActiveTab("submit")}
                >
                  Create Your First Ticket
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    className="bg-card border-border p-6 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {ticket.ticket_number}
                        </p>
                        <h3 className="text-lg font-semibold text-foreground">
                          {ticket.title}
                        </h3>
                      </div>
                      <div className="flex gap-2">
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
                      </div>
                    </div>

                    <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                      {ticket.description}
                    </p>

                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>Category: {ticket.category}</span>
                      <span>
                        Created{" "}
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
