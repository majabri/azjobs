import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Loader2,
  Trash2,
  Send,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useOutreachContacts,
  useAddOutreachContact,
  useUpdateOutreachContact,
  useDeleteOutreachContact,
} from "@/hooks/queries/useOutreachContacts";

const STATUS_OPTIONS = [
  {
    value: "pending",
    label: "Pending",
    icon: Clock,
    color: "text-muted-foreground",
  },
  { value: "sent", label: "Sent", icon: Send, color: "text-accent" },
  {
    value: "replied",
    label: "Replied",
    icon: CheckCircle2,
    color: "text-success",
  },
  {
    value: "no_response",
    label: "No Response",
    icon: X,
    color: "text-destructive",
  },
];

export default function OutreachTracker() {
  const [showAdd, setShowAdd] = useState(false);
  const [newContact, setNewContact] = useState({
    contact_name: "",
    company: "",
    role: "",
    platform: "linkedin",
  });
  const [filter, setFilter] = useState("all");

  const { data: contacts = [], isLoading: loading } = useOutreachContacts();
  const addContactMutation = useAddOutreachContact();
  const updateContactMutation = useUpdateOutreachContact();
  const deleteContactMutation = useDeleteOutreachContact();

  const addContact = async () => {
    if (!newContact.contact_name.trim() || !newContact.company.trim()) {
      toast.error("Name and company required");
      return;
    }
    await addContactMutation.mutateAsync(newContact);
    setNewContact({
      contact_name: "",
      company: "",
      role: "",
      platform: "linkedin",
    });
    setShowAdd(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await updateContactMutation.mutateAsync({
      id,
      updates: {
        response_status: status,
        ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}),
      },
    });
  };

  const deleteContact = async (id: string) => {
    await deleteContactMutation.mutateAsync(id);
  };

  const filtered =
    filter === "all"
      ? contacts
      : contacts.filter((c) => c.response_status === filter);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-primary">
          Outreach Tracker
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Contact
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-4">
        <Badge
          variant={filter === "all" ? "default" : "outline"}
          className="cursor-pointer text-xs"
          onClick={() => setFilter("all")}
        >
          All ({contacts.length})
        </Badge>
        {STATUS_OPTIONS.map((s) => {
          const count = contacts.filter(
            (c) => c.response_status === s.value,
          ).length;
          return (
            <Badge
              key={s.value}
              variant={filter === s.value ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setFilter(s.value)}
            >
              {s.label} ({count})
            </Badge>
          );
        })}
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="grid sm:grid-cols-4 gap-2 mb-4 p-3 rounded-lg bg-muted/30 border border-border">
          <Input
            value={newContact.contact_name}
            onChange={(e) =>
              setNewContact({ ...newContact, contact_name: e.target.value })
            }
            placeholder="Name"
          />
          <Input
            value={newContact.company}
            onChange={(e) =>
              setNewContact({ ...newContact, company: e.target.value })
            }
            placeholder="Company"
          />
          <Input
            value={newContact.role}
            onChange={(e) =>
              setNewContact({ ...newContact, role: e.target.value })
            }
            placeholder="Role"
          />
          <Button
            onClick={addContact}
            size="sm"
            disabled={addContactMutation.isPending}
          >
            {addContactMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Add"
            )}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No outreach contacts yet. Start networking!
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-3 rounded-lg bg-card border border-border hover:border-accent/20 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground text-sm truncate">
                    {c.contact_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    at {c.company}
                  </span>
                  {c.role && (
                    <Badge variant="outline" className="text-[10px]">
                      {c.role}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {c.platform}
                  </Badge>
                  {c.sent_at && (
                    <span className="text-[10px] text-muted-foreground">
                      Sent {new Date(c.sent_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {STATUS_OPTIONS.map((s) => (
                  <Button
                    key={s.value}
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2 ${c.response_status === s.value ? "bg-accent/10" : ""}`}
                    onClick={() => updateStatus(c.id, s.value)}
                  >
                    <s.icon className={`w-3 h-3 ${s.color}`} />
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteContact(c.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
