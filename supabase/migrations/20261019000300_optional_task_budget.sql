-- Explicit optional tasks do not consume the required daily budget.
create or replace function public.get_today_snapshot(p_date date default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare context jsonb:=public.get_user_learning_context(); day date; result jsonb; required_minutes integer;
begin
  day:=coalesce(p_date,(now() at time zone (context->'studyPreferences'->>'timezone'))::date);
  result:=public.get_today_snapshot_before_preferences(day);
  select coalesce(sum(estimated_minutes),0)::integer into required_minutes from public.daily_tasks where user_id=auth.uid() and scheduled_for=day and not is_optional;
  return result || jsonb_build_object('timezone',context->'studyPreferences'->>'timezone','learningContext',context,'dailyBudgetMinutes',(context->'plannerPolicy'->>'dailyBudgetMinutes')::integer,'overBudgetMinutes',greatest(0,required_minutes-(context->'plannerPolicy'->>'dailyBudgetMinutes')::integer),
    'tasks',coalesce((select jsonb_agg(item || jsonb_build_object('optional',optional_task or item->>'estimatedMinutes' is null or total_minutes>(context->'plannerPolicy'->>'dailyBudgetMinutes')::integer) order by position)
      from (select item,position,optional_task,sum(case when optional_task then 0 else coalesce((item->>'estimatedMinutes')::integer,0) end) over(order by position) total_minutes
        from (select value item,ordinality position,coalesce(d.is_optional,false) optional_task
          from jsonb_array_elements(result->'tasks') with ordinality left join public.daily_tasks d on d.id=(value->>'id')::uuid) flags) items),'[]'));
end $$;
