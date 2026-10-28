-- Convert the previous D&D metric units (1.5 m = 5 ft).
update public.characters set movement_speed=round(movement_speed*10.0/3)::int,version=version+1;
alter table public.characters alter column movement_speed set default 30;
create table public.monsters (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100),
 public_name text not null default 'Creatura sconosciuta' check(length(trim(public_name)) between 1 and 100),
 max_hp int not null check(max_hp>0), armor_class int not null check(armor_class>=0),
 notes text not null default '' check(length(notes)<=10000), version int not null default 0
);
alter table public.monsters enable row level security;
revoke all on public.monsters from public,anon,authenticated;
grant select on public.monsters to authenticated;
create policy dm_read on public.monsters for select to authenticated using(public.is_dm(campaign_id));
alter publication supabase_realtime add table public.monsters;

-- Update the existing rest branch without changing its receipt/authorization handling.
do $$ declare definition text; begin
 definition := pg_get_functiondef('public.command_core(uuid,text,jsonb,uuid)'::regprocedure);
 definition := replace(definition, 'real_name,current_hp,max_hp,armor_class) values', 'real_name,current_hp,max_hp,armor_class,notes) values');
 definition := replace(definition, '(p_data->>''armor_class'')::int); end if;', '(p_data->>''armor_class'')::int,coalesce(p_data->>''notes'','''')); end if;');
 definition := replace(definition, 'when ''session_start'' then',
 ' if p_data->>''type''=''long'' then update characters set current_hp=max_hp,version=version+1 where id=target and campaign_id=p_campaign; end if;
 when ''session_start'' then');
 execute definition;
end $$;

alter function public.command(uuid,text,jsonb,uuid) rename to command_calendar;
revoke all on function public.command_calendar(uuid,text,jsonb,uuid) from public,anon,authenticated;
create function public.command(p_campaign uuid,p_action text,p_data jsonb,p_request uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.monsters; result jsonb; portrait text;
begin
 if auth.uid() is null or not public.is_member(p_campaign) then raise exception 'Accesso negato'; end if;
 perform 1 from campaigns where id=p_campaign for update;
 select r.result into result from command_receipts r where r.id=p_request and r.user_id=auth.uid() and r.campaign_id=p_campaign;
 if found then return result; end if;
 if p_action='record_save' and p_data->>'kind' in ('npc','location','note') then p_data:=p_data || '{"status":"active"}'::jsonb; end if;
 if p_action='character_save' then
  portrait:=coalesce(p_data->>'portrait_url','');
  if length(portrait)>180000 or (portrait<>'' and portrait !~ '^https://' and portrait !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$') then raise exception 'Foto non valida o troppo grande'; end if;
 end if;
 if p_action in ('monster_save','monster_delete','monster_add') then
  if not public.is_dm(p_campaign) then raise exception 'Solo il Dungeon Master'; end if;
  if p_action='monster_save' then
   if nullif(p_data->>'id','') is null then
    insert into monsters(campaign_id,name,public_name,max_hp,armor_class,notes) values(p_campaign,p_data->>'name',p_data->>'public_name',(p_data->>'max_hp')::int,(p_data->>'armor_class')::int,coalesce(p_data->>'notes',''));
   else
    update monsters set name=p_data->>'name',public_name=p_data->>'public_name',max_hp=(p_data->>'max_hp')::int,armor_class=(p_data->>'armor_class')::int,notes=coalesce(p_data->>'notes',''),version=version+1 where id=(p_data->>'id')::uuid and campaign_id=p_campaign and version=(p_data->>'version')::int;
    if not found then raise exception 'Mostro aggiornato o non disponibile. Riprova.'; end if;
   end if;
  elsif p_action='monster_delete' then
   delete from monsters where id=(p_data->>'id')::uuid and campaign_id=p_campaign;
  else
   select * into m from monsters where id=(p_data->>'monster_id')::uuid and campaign_id=p_campaign;
   if not found then raise exception 'Mostro non disponibile'; end if;
   result:=public.command_calendar(p_campaign,'combatant_add',jsonb_build_object('id',p_data->>'id','name',m.public_name,'real_name',m.name,'max_hp',m.max_hp,'armor_class',m.armor_class,'initiative',coalesce(p_data->>'initiative','0'),'notes',m.notes),p_request);
   return result;
  end if;
  insert into command_receipts(id,campaign_id,user_id,result) values(p_request,p_campaign,auth.uid(),'{}');
  return '{}'::jsonb;
 end if;
 return public.command_calendar(p_campaign,p_action,p_data,p_request);
end $$;
revoke all on function public.command(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.command(uuid,text,jsonb,uuid) to authenticated;
