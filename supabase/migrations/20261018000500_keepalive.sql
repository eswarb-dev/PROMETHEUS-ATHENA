create function public.project_keepalive() returns jsonb language sql volatile security invoker set search_path = '' as $$
  select jsonb_build_object('ok',true,'serverTime',clock_timestamp())
$$;
revoke execute on function public.project_keepalive() from public;
grant execute on function public.project_keepalive() to anon,authenticated;
