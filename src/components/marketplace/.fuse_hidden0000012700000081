import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import StarRating from "./StarRating";
import type { ServiceReview } from "@/services/marketplace/types";

interface Props {
  reviews: ServiceReview[];
}

export default function RatingSummary({ reviews }: Props) {
  if (reviews.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No reviews yet. Be the first to leave a review!
        </CardContent>
      </Card>
    );
  }

  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const dist = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length;
    return { star, count, pct: Math.round((count / reviews.length) * 100) };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ratings Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6 flex-wrap">
          {/* Average */}
          <div className="text-center">
            <div className="text-4xl font-bold">{avg.toFixed(1)}</div>
            <StarRating value={Math.round(avg)} readonly size="sm" />
            <div className="text-xs text-muted-foreground mt-1">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</div>
          </div>

          {/* Distribution */}
          <div className="flex-1 min-w-[200px] space-y-2">
            {dist.map((d) => (
              <div key={d.star} className="flex items-center gap-2 text-sm">
                <span className="w-12 text-right text-muted-foreground">{d.star} star</span>
                <Progress value={d.pct} className="h-2 flex-1" />
                <span className="w-10 text-muted-foreground text-xs">{d.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
