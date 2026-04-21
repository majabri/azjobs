import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import StarRating from "./StarRating";
import { createReview } from "@/services/marketplace/service";

interface Props {
  serviceId: string;
  orderId?: string;
  onSubmitted: () => void;
}

export default function ReviewForm({ serviceId, orderId, onSubmitted }: Props) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const titleError = title.trim().length > 0 && title.trim().length < 5 ? "Title must be at least 5 characters" : "";
  const bodyError = body.trim().length > 0 && body.trim().length < 20 ? "Review must be at least 20 characters" : "";
  const canSubmit = rating > 0 && title.trim().length >= 5 && body.trim().length >= 20;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createReview({
        service_id: serviceId,
        order_id: orderId,
        rating,
        title: title.trim(),
        comment: body.trim(),
      });
      toast.success("Review submitted!");
      setRating(0);
      setTitle("");
      setBody("");
      onSubmitted();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit review");
    }
    setSubmitting(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Write a Review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Rating</label>
          <StarRating value={rating} onChange={setRating} size="lg" showLabel />
          {rating === 0 && <p className="text-xs text-muted-foreground mt-1">Select a rating</p>}
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summarize your experience" maxLength={100} />
          {titleError && <p className="text-xs text-destructive mt-1">{titleError}</p>}
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Review</label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share details of your experience (min 20 characters)..." rows={4} maxLength={2000} />
          {bodyError && <p className="text-xs text-destructive mt-1">{bodyError}</p>}
          <p className="text-xs text-muted-foreground mt-1">{body.length}/2000</p>
        </div>
        <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          Submit Review
        </Button>
      </CardContent>
    </Card>
  );
}
