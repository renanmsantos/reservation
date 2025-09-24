insert into supabase_functions.schedules (name, cron, function_name)
values (
  'daily-utilization-summary',
  '0 10 * * *', -- 10:00 UTC daily
  'daily-summary'
)
on conflict (name) do update
set cron = excluded.cron,
    function_name = excluded.function_name,
    enabled = true;
