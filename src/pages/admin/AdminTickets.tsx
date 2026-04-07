import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LifeBuoy } from "lucide-react";

export default function AdminTickets() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Support Tickets</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5" />
            Ticket Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Support ticket management is coming soon. This page will allow you
            to view, respond to, and manage user support requests.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
