import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchReviews } from "@/services/marketplace/service";
import type { ServiceReview } from "@/services/marketplace/types";
import RatingSummary from "./RatingSummary";
import ReviewCard from "./ReviewCard";
import ReviewForm from "./ReviewForm";

interface ReviewWithMeta extends ServiceReview {
  helpful_count: number;
  user_voted: boolean;
  user_reported: boolean;
  reviewer_name?: string;
}

interface Props {
  serviceId: string;
  orderId?: string;
}

export default function ReviewsSection({ serviceId, orderId }: Props) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewWithMeta[]>([]);
  const [allReviews, setAllReviews] = useState<ServiceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rawReviews = await fetchReviews(serviceId);
      setAllReviews(rawReviews);

      // Enrich with helpful counts, user vote status, report status, and reviewer names
      const enriched: ReviewWithMeta[] = await Promise.all(
        rawReviews.map(async (r) => {
          // Helpful count
          const { count } = await supabase
            .from("helpful_votes" as any)
            .select("*", { count: "exact", head: true })
            .eq("review_id", r.id);

          // User voted?
          let userVoted = false;
          if (user) {
            const { data } = await supabase
              .from("helpful_votes" as any)
              .select("id")
              .eq("review_id", r.id)
              .eq("voter_id", user.id)
              .maybeSingle();
            userVoted = !!data;
          }

          // User reported?
          let userReported = false;
          if (user) {
            const { data } = await supabase
              .from("review_reports" as any)
              .select("id")
              .eq("review_id", r.id)
              .eq("reporter_id", user.id)
              .maybeSingle();
            userReported = !!data;
          }

          // Reviewer name
          let reviewerName = "Anonymous";
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", r.reviewer_id)
            .maybeSingle();
          if (profile?.full_name) reviewerName = profile.full_name;

          return {
            ...r,
            helpful_count: count || 0,
            user_voted: userVoted,
            user_reported: userReported,
            reviewer_name: reviewerName,
          };
        })
      );

      setReviews(enriched);
    } catch {
      /* handled */
    }
    setLoading(false);
  }, [serviceId, user]);

  useEffect(() => { load(); }, [load]);

  const displayedReviews = showAll ? reviews : reviews.slice(0, 5);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <RatingSummary reviews={allReviews} />

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Reviews ({allReviews.length})</h3>
        {user && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "Write a Review"}
          </Button>
        )}
      </div>

      {showForm && (
        <ReviewForm serviceId={serviceId} orderId={orderId} onSubmitted={() => { setShowForm(false); load(); }} />
      )}

      {displayedReviews.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="space-y-3">
          {displayedReviews.map((r) => (
            <ReviewCard key={r.id} review={r} onVoteChanged={load} />
          ))}
        </div>
      )}

      {reviews.length > 5 && !showAll && (
        <Button variant="ghost" className="w-full" onClick={() => setShowAll(true)}>
          Show all {reviews.length} reviews
        </Button>
      )}
    </div>
  );
}
