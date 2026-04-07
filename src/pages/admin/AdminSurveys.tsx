import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default function AdminSurveys() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Customer Surveys</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Survey Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Customer survey management is coming soon. This page will allow you
            to create, distribute, and analyze customer satisfaction surveys.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
