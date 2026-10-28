create table public.availability (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 day date not null,
 status text not null check (status in ('yes','maybe','no')),
 starts_at time not null default '19:00',
 ends_at time not null default '23:00',
 note text not null default '' check(length(note)<=300),
 check(ends_at>starts_at),
 unique(campaign_id,user_id,day)
);
alter table public.availability enable row level security;
revoke all on public.availability from anon, authenticated;
grant select on public.availability to authenticated;
create policy member_read on public.availability for select to authenticated using(public.is_member(campaign_id));
alter publication supabase_realtime add table public.availability;

alter function public.command(uuid,text,jsonb,uuid) rename to command_core;
revoke all on function public.command_core(uuid,text,jsonb,uuid) from public,anon,authenticated;
create function public.command(p_campaign uuid,p_action text,p_data jsonb,p_request uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d date;
begin
 if p_action not in ('availability_save','availability_delete') then
  return public.command_core(p_campaign,p_action,p_data,p_request);
 end if;
 if auth.uid() is null or not public.is_member(p_campaign) then raise exception 'Accesso negato'; end if;
 perform 1 from campaigns where id=p_campaign for update;
 if exists(select 1 from command_receipts where campaign_id=p_campaign and user_id=auth.uid() and id=p_request) then return '{}'::jsonb; end if;
 d := (p_data->>'day')::date;
 if d is null then raise exception 'Scegli una data'; end if;
 if p_action='availability_delete' then
  delete from availability where campaign_id=p_campaign and user_id=auth.uid() and day=d;
 else
  insert into availability(campaign_id,user_id,day,status,starts_at,ends_at,note)
  values(p_campaign,auth.uid(),d,p_data->>'status',(p_data->>'starts_at')::time,(p_data->>'ends_at')::time,coalesce(p_data->>'note',''))
  on conflict(campaign_id,user_id,day) do update set status=excluded.status,starts_at=excluded.starts_at,ends_at=excluded.ends_at,note=excluded.note;
 end if;
 insert into command_receipts(campaign_id,user_id,id,result) values(p_campaign,auth.uid(),p_request,'{}');
 return '{}'::jsonb;
end $$;
revoke all on function public.command(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.command(uuid,text,jsonb,uuid) to authenticated;

