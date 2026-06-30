-- Add landingPageViews to MetricSnapshot (for Testing Lab sync-metrics)
ALTER TABLE "metric_snapshots" ADD COLUMN IF NOT EXISTS "landing_page_views" INTEGER;
