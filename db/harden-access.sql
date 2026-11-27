-- App tables are accessed by the authenticated server through PostgreSQL only.
-- Run only in the dedicated Reach Insight database, after schema.sql, as owner.
-- Do not grant this owner connection string to a browser. Supabase Auth is unchanged.
DO $$
DECLARE
  app_table text;
  api_role text;
BEGIN
  FOREACH app_table IN ARRAY ARRAY[
    'projects','target_posts','jobs','job_tasks','engagements','sns_users',
    'user_posts','user_analyses','job_user_analyses','aggregates','provider_runs',
    'raw_payloads','categories','settings','discovery_jobs',
    'discovery_candidates','discovery_charges','validation_reports',
    'live_budget_months','live_analyses','live_operations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', app_table);
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT FROM pg_roles WHERE rolname=api_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', app_table, api_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;
