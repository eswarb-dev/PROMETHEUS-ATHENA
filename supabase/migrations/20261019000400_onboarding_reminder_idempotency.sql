create or replace function public.complete_onboarding(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; notifications jsonb:=p_payload->'notifications'; channel text; already_completed boolean;
begin
  select onboarding_completed into already_completed from public.profiles where id=auth.uid() for update;
  result:=public.complete_onboarding_directions(p_payload);
  -- Replaying profile completion must preserve subsequent Settings changes.
  if not coalesce(already_completed,false) then
    channel:=coalesce(notifications->>'reminderChannel',case when (notifications->>'email')::boolean and (notifications->>'whatsapp')::boolean then 'both' when (notifications->>'email')::boolean then 'email' when (notifications->>'whatsapp')::boolean then 'whatsapp' else 'none' end);
    perform public.save_notification_preferences(jsonb_build_object('reminderChannel',channel,'whatsappNumber',notifications->>'whatsappNumber','studyReminders',channel<>'none','weeklyReport',false,'timezone',coalesce(notifications->>'timezone','Asia/Kolkata')));
  end if;
  return result;
end $$;
