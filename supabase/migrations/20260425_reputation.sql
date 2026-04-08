-- Phase 10: Reputation System - Ratings and Reviews

CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ratee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES catalog_orders(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  categories jsonb DEFAULT '{}',
  is_anonymous boolean NOT NULL DEFAULT false,
  helpful_count integer NOT NULL DEFAULT 0,
  unhelpful_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'flagged', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT not_self_rating CHECK (rater_id != ratee_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_rater_id ON ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_ratings_ratee_id ON ratings(ratee_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rating ON ratings(rating);
CREATE INDEX IF NOT EXISTS idx_ratings_status ON ratings(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_unique_order ON ratings(rater_id, ratee_id, order_id)
  WHERE order_id IS NOT NULL AND status != 'removed';
CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_unique_contract ON ratings(rater_id, ratee_id, contract_id)
  WHERE contract_id IS NOT NULL AND status != 'removed';

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings_anyone_can_view_published" ON ratings
  FOR SELECT USING (status = 'published');
CREATE POLICY "ratings_rater_can_view_own" ON ratings
  FOR SELECT USING (rater_id = auth.uid());
CREATE POLICY "ratings_ratee_can_view_own" ON ratings
  FOR SELECT USING (ratee_id = auth.uid());

CREATE POLICY "ratings_rater_can_create" ON ratings
  FOR INSERT WITH CHECK (
    rater_id = auth.uid()
    AND (
      (order_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM catalog_orders
        WHERE catalog_orders.id = ratings.order_id
        AND catalog_orders.buyer_id = auth.uid()
        AND catalog_orders.status = 'completed'
      ))
      OR
      (contract_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM contracts
        WHERE contracts.id = ratings.contract_id
        AND contracts.employer_id = auth.uid()
        AND contracts.status = 'completed'
      ))
    )
  );

CREATE POLICY "ratings_rater_can_update_own" ON ratings
  FOR UPDATE USING (rater_id = auth.uid() AND status = 'published')
  WITH CHECK (rater_id = auth.uid());

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id uuid NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  body text NOT NULL,
  is_verified_purchase boolean NOT NULL DEFAULT false,
  helpful_count integer NOT NULL DEFAULT 0,
  unhelpful_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'flagged', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT body_not_empty CHECK (length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_reviews_rating_id ON reviews(rating_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_anyone_can_view_published" ON reviews
  FOR SELECT USING (status = 'published');
CREATE POLICY "reviews_reviewer_can_view_own" ON reviews
  FOR SELECT USING (reviewer_id = auth.uid());
CREATE POLICY "reviews_reviewer_can_create" ON reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM ratings WHERE ratings.id = reviews.rating_id AND ratings.rater_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'off_topic', 'misleading', 'other')),
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE review_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_reports_reporter_can_create" ON review_reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "review_reports_reporter_can_view_own" ON review_reports
  FOR SELECT USING (reporter_id = auth.uid());

CREATE OR REPLACE VIEW user_reputation_summary AS
SELECT
  u.id,
  COUNT(DISTINCT r.id) as total_ratings,
  ROUND(AVG(CASE WHEN r.status = 'published' THEN r.rating END)::numeric, 2) as average_rating,
  COUNT(CASE WHEN r.rating = 5 AND r.status = 'published' THEN 1 END) as five_star_count,
  COUNT(CASE WHEN r.rating = 1 AND r.status = 'published' THEN 1 END) as one_star_count,
  MAX(r.created_at) as last_review_date
FROM auth.users u
LEFT JOIN ratings r ON u.id = r.ratee_id
GROUP BY u.id;

CREATE TABLE IF NOT EXISTS helpful_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_helpful boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_helpful_votes_unique ON helpful_votes(review_id, voter_id);
ALTER TABLE helpful_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "helpful_votes_voter_can_create" ON helpful_votes
  FOR INSERT WITH CHECK (voter_id = auth.uid());

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ratings_updated_at ON ratings;
CREATE TRIGGER ratings_updated_at BEFORE UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS reviews_updated_at ON reviews;
CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS review_reports_updated_at ON review_reports;
CREATE TRIGGER review_reports_updated_at BEFORE UPDATE ON review_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION update_review_helpful_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE reviews SET
    helpful_count = (SELECT COUNT(*) FROM helpful_votes WHERE review_id = NEW.review_id AND is_helpful = true),
    unhelpful_count = (SELECT COUNT(*) FROM helpful_votes WHERE review_id = NEW.review_id AND is_helpful = false)
  WHERE id = NEW.review_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_helpful_counts ON helpful_votes;
CREATE TRIGGER update_helpful_counts AFTER INSERT OR DELETE ON helpful_votes
  FOR EACH ROW EXECUTE FUNCTION update_review_helpful_counts();
