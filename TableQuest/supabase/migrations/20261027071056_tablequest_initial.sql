-- TableQuest MVP. All application writes go through authorized transactional RPCs.
create extension if not exists pgcrypto with schema extensions;
create table public.profiles (id uuid primary key references auth.users on delete cascade, display_name text not null check(length(display_name) between 1 and 80), avatar text not null default 'shield');
create table public.campaigns (id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 120), description text not null default '', owner_id uuid not null references auth.users, created_at timestamptz not null default now());
create table public.campaign_members (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns on delete cascade, user_id uuid not null references auth.users on delete cascade, role text not null check(role in ('dm','player')), joined_at timestamptz not null default now(), unique(campaign_id,user_id));
create table public.campaign_invites (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns on delete cascade, token_hash text unique not null, expires_at timestamptz not null default now()+interval '7 days', revoked_at timestamptz, created_at timestamptz not null default now());
create table public.characters (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns on delete cascade, user_id uuid not null references auth.users, name text not null check(length(name) between 1 and 100), species text not null default '', classes text not null default '', level int not null default 1 check(level between 1 and 20), max_hp int not null default 10 check(max_hp>0), current_hp int not null default 10 check(current_hp>=0 and current_hp<=max_hp), temporary_hp int not null default 0 check(temporary_hp>=0), armor_class int not null default 10 check(armor_class>=0), initiative_modifier int not null default 0, movement_speed int not null default 9 check(movement_speed>=0), notes text not null default '', portrait_url text not null default '', concentration text not null default '', conditions jsonb not null default '[]' check(jsonb_typeof(conditions)='array'), version int not null default 0, unique(campaign_id,user_id));
create table public.character_resources (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns on delete cascade, character_id uuid not null references public.characters on delete cascade, name text not null check(length(name) between 1 and 100), maximum_uses int not null check(maximum_uses>=0), remaining_uses int not null check(remaining_uses between 0 and maximum_uses), recovery_type text not null check(recovery_type in ('manual','short','long')), version int not null default 0);
create table public.sessions (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns on delete cascade, session_number int not null, title text not null check(length(title)>0), status text not null default 'active' check(status in ('active','completed')), started_at timestamptz not null default now(), ended_at timestamptz, summary text not null default '', unique(campaign_id,session_number));
create unique index one_active_session on public.sessions(campaign_id) where status='active';
create table public.encounters (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns on delete cascade, session_id uuid not null references public.sessions, name text not null, status text not null default 'preparing' check(status in ('preparing','active','completed')), current_round int not null default 1 check(current_round>0), current_turn int not null default 0 check(current_turn>=0), version int not null default 0, created_at timestamptz not null default now());
create unique index one_active_encounter on public.encounters(campaign_id) where status<>'completed';
create table public.combatants (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns on delete cascade, encounter_id uuid not null references public.encounters on delete cascade, character_id uuid references public.characters on delete set null, name text not null, initiative int not null default 0, turn_order int not null default 0, public_hp text not null default '', public_conditions text not null default '', unique(encounter_id,character_id));
-- No private statistics are ever stored in the public combatants row.
create table public.combatant_secrets (id uuid primary key references public.combatants on delete cascade, campaign_id uuid not null references public.campaigns on delete cascade, real_name text not null, current_hp int not null check(current_hp>=0), max_hp int not null check(max_hp>0 and current_hp<=max_hp), armor_class int not null check(armor_class>=0), notes text not null default '', conditions text not null default '');
create table public.records (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns on delete cascade, author_id uuid not null references auth.users, kind text not null check(kind in ('journal','quest','npc','location','note','announcement')), title text not null check(length(title) between 1 and 200), content text not null default '', status text not null default 'active' check(status in ('active','completed','failed','on_hold')), visibility text not null check(visibility in ('shared','dm','personal')), location text not null default '', created_at timestamptz not null default now(), version int not null default 0);
create table public.private_messages (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns on delete cascade, sender_id uuid not null references auth.users, recipient_id uuid not null references auth.users, content text not null check(length(content) between 1 and 10000), is_read boolean not null default false, created_at timestamptz not null default now());
create table public.inventory_items (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns on delete cascade, character_id uuid references public.characters, name text not null check(length(name) between 1 and 120), description text not null default '', quantity int not null check(quantity>=0), item_type text not null default 'Oggetto', weight numeric check(weight>=0), value numeric check(value>=0), version int not null default 0);
create table public.inventory_transactions (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns on delete cascade, item_name text not null, actor_id uuid not null references auth.users, quantity int not null, from_owner uuid, to_owner uuid, description text not null, created_at timestamptz not null default now());
create table public.currency (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns on delete cascade, denomination text not null check(denomination in ('CP','SP','EP','GP','PP')), amount int not null default 0 check(amount>=0), unique(campaign_id,denomination));
create table public.command_receipts (id uuid primary key, campaign_id uuid not null references public.campaigns on delete cascade, user_id uuid not null references auth.users, result jsonb, created_at timestamptz not null default now());

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin
 insert into profiles(id,display_name) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'Avventuriero'),80));
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.is_member(c uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select exists(select 1 from campaign_members where campaign_id=c and user_id=auth.uid()) $$;
create function public.is_dm(c uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select exists(select 1 from campaigns where id=c and owner_id=auth.uid()) $$;
create function public.can_character(c uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select exists(select 1 from characters where id=c and is_member(campaign_id) and (user_id=auth.uid() or is_dm(campaign_id))) $$;

do $$ declare t text; begin
 foreach t in array array['profiles','campaigns','campaign_members','campaign_invites','characters','character_resources','sessions','encounters','combatants','combatant_secrets','records','private_messages','inventory_items','inventory_transactions','currency','command_receipts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['campaign_members','sessions','encounters','combatants','inventory_items','inventory_transactions','currency'] loop
 execute format('create policy member_read on public.%I for select to authenticated using (public.is_member(campaign_id))',t);
 end loop;
 foreach t in array array['campaign_invites','combatant_secrets'] loop
 execute format('create policy dm_read on public.%I for select to authenticated using (public.is_dm(campaign_id))',t);
 end loop;
 foreach t in array array['campaign_members','campaign_invites','characters','character_resources','sessions','encounters','combatants','combatant_secrets','records','private_messages','inventory_items','inventory_transactions','currency','command_receipts'] loop
 execute format('create index on public.%I(campaign_id)',t);
 end loop;
end $$;
create policy profile_read on public.profiles for select to authenticated using (id=auth.uid() or exists(select 1 from campaign_members m where m.user_id=profiles.id and is_member(m.campaign_id)));
create policy campaign_read on public.campaigns for select to authenticated using (is_member(id));
create policy character_read on public.characters for select to authenticated using (is_member(campaign_id) and (user_id=auth.uid() or is_dm(campaign_id)));
create policy resource_read on public.character_resources for select to authenticated using (can_character(character_id));
create policy record_read on public.records for select to authenticated using (is_member(campaign_id) and (visibility='shared' or (visibility='dm' and is_dm(campaign_id)) or (visibility='personal' and author_id=auth.uid())));
create policy message_read on public.private_messages for select to authenticated using (is_member(campaign_id) and (sender_id=auth.uid() or recipient_id=auth.uid()));
create policy receipt_read on public.command_receipts for select to authenticated using(user_id=auth.uid() and is_member(campaign_id));
create index on public.private_messages(recipient_id,created_at);
create index on public.combatants(encounter_id,turn_order);

create function public.save_profile(p_name text,p_avatar text default 'shield') returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_avatar not in ('shield','sword','sparkles','moon','flame','leaf') then raise exception 'Invalid avatar'; end if;
 insert into profiles values(auth.uid(),trim(p_name),p_avatar) on conflict(id) do update set display_name=excluded.display_name,avatar=excluded.avatar;
end $$;
create function public.create_campaign(p_name text,p_description text default '') returns uuid language plpgsql security definer set search_path=public,pg_temp as $$ declare c uuid; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into campaigns(name,description,owner_id) values(trim(p_name),p_description,auth.uid()) returning id into c;
 insert into campaign_members(campaign_id,user_id,role) values(c,auth.uid(),'dm');
 insert into currency(campaign_id,denomination) select c,unnest(array['CP','SP','EP','GP','PP']); return c;
end $$;
create function public.join_campaign(p_token text) returns uuid language plpgsql security definer set search_path=public,extensions,pg_temp as $$ declare c uuid; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select campaign_id into c from campaign_invites where token_hash=encode(digest(upper(trim(p_token)),'sha256'),'hex') and revoked_at is null and expires_at>now() for update;
 if c is null then raise exception 'Invito non valido, revocato o scaduto'; end if;
 insert into campaign_members(campaign_id,user_id,role) values(c,auth.uid(),'player') on conflict(campaign_id,user_id) do nothing; return c;
end $$;

create function public.command(p_campaign uuid,p_action text,p_data jsonb,p_request uuid) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare dm boolean; target uuid; ch characters; enc encounters; itm inventory_items; rec records; res character_resources; n int; pos int; token text; result jsonb:='{}'; previous jsonb; owner uuid; new_id uuid; delta int;
begin
 -- A campaign lock serializes all mutations; receipts make network retries idempotent.
 perform 1 from campaigns where id=p_campaign for update;
 if not is_member(p_campaign) then raise exception 'Accesso negato'; end if;
 select r.result into previous from command_receipts r where id=p_request and user_id=auth.uid() and campaign_id=p_campaign;
 if found then return previous; end if;
 dm:=is_dm(p_campaign); target:=nullif(p_data->>'id','')::uuid;
 if p_action in ('invite','revoke_invite','remove_member','session_start','session_end','session_summary','encounter_create','combatant_add','combatant_remove','combatant_order','enemy_update','encounter_start','turn','encounter_end','message_send') and not dm then raise exception 'Solo il Dungeon Master'; end if;
 case p_action
 when 'invite' then
  token:=upper(encode(gen_random_bytes(12),'hex'));
  insert into campaign_invites(campaign_id,token_hash) values(p_campaign,encode(digest(token,'sha256'),'hex'));
  result:=jsonb_build_object('token',token);
 when 'revoke_invite' then update campaign_invites set revoked_at=now() where campaign_id=p_campaign and (target is null or id=target);
 when 'remove_member' then
  if target=(select owner_id from campaigns where id=p_campaign) then raise exception 'Cannot remove DM'; end if;
  update campaign_invites set revoked_at=now() where campaign_id=p_campaign;
  delete from campaign_members where campaign_id=p_campaign and user_id=target;
 when 'character_save' then
  select * into ch from characters where campaign_id=p_campaign and user_id=auth.uid();
  if found then
   if ch.version is distinct from (p_data->>'version')::int then raise exception 'Dati aggiornati da un altro dispositivo. Riprova.'; end if;
   update characters set name=trim(p_data->>'name'),species=p_data->>'species',classes=p_data->>'classes',level=(p_data->>'level')::int,max_hp=(p_data->>'max_hp')::int,current_hp=least(current_hp,(p_data->>'max_hp')::int),armor_class=(p_data->>'armor_class')::int,initiative_modifier=(p_data->>'initiative_modifier')::int,movement_speed=(p_data->>'movement_speed')::int,notes=p_data->>'notes',portrait_url=coalesce(p_data->>'portrait_url',''),version=version+1 where id=ch.id;
  else insert into characters(campaign_id,user_id,name,species,classes,level,max_hp,current_hp,armor_class,initiative_modifier,movement_speed,notes,portrait_url) values(p_campaign,auth.uid(),trim(p_data->>'name'),p_data->>'species',p_data->>'classes',(p_data->>'level')::int,(p_data->>'max_hp')::int,(p_data->>'max_hp')::int,(p_data->>'armor_class')::int,(p_data->>'initiative_modifier')::int,(p_data->>'movement_speed')::int,p_data->>'notes',coalesce(p_data->>'portrait_url','')); end if;
 when 'character_state' then
  select * into ch from characters where id=target and campaign_id=p_campaign;
  if ch.id is null or not can_character(ch.id) then raise exception 'Accesso negato'; end if;
  if ch.version is distinct from (p_data->>'version')::int then raise exception 'Dati aggiornati da un altro dispositivo. Riprova.'; end if;
  update characters set current_hp=coalesce((p_data->>'current_hp')::int,current_hp),temporary_hp=coalesce((p_data->>'temporary_hp')::int,temporary_hp),conditions=coalesce(p_data->'conditions',conditions),concentration=coalesce(p_data->>'concentration',concentration),version=version+1 where id=target;
 when 'resource_add' then
  if not exists(select 1 from characters where id=target and campaign_id=p_campaign and can_character(id)) then raise exception 'Accesso negato'; end if;
  insert into character_resources(campaign_id,character_id,name,maximum_uses,remaining_uses,recovery_type) values(p_campaign,target,p_data->>'name',(p_data->>'maximum_uses')::int,(p_data->>'maximum_uses')::int,p_data->>'recovery_type');
 when 'resource_use' then
  select * into res from character_resources where id=target and campaign_id=p_campaign;
  if res.id is null or not can_character(res.character_id) then raise exception 'Accesso negato'; end if;
  if res.version is distinct from (p_data->>'version')::int then raise exception 'Risorsa aggiornata. Riprova.'; end if;
  update character_resources set remaining_uses=(p_data->>'remaining_uses')::int,version=version+1 where id=target;
 when 'resource_delete' then delete from character_resources where id=target and campaign_id=p_campaign and can_character(character_id);
 when 'rest' then
  if not exists(select 1 from characters where id=target and campaign_id=p_campaign and can_character(id)) then raise exception 'Accesso negato'; end if;
  update character_resources set remaining_uses=maximum_uses,version=version+1 where character_id=target and (recovery_type=p_data->>'type' or (p_data->>'type'='long' and recovery_type='short'));
 when 'session_start' then
  insert into sessions(campaign_id,session_number,title) select p_campaign,coalesce(max(session_number),0)+1,p_data->>'title' from sessions where campaign_id=p_campaign;
 when 'session_end' then
  update sessions set status='completed',ended_at=now() where campaign_id=p_campaign and status='active';
  update encounters set status='completed',version=version+1 where campaign_id=p_campaign and status<>'completed';
 when 'session_summary' then update sessions set summary=p_data->>'summary' where id=target and campaign_id=p_campaign;
 when 'encounter_create' then
  select id into new_id from sessions where campaign_id=p_campaign and status='active';
  if new_id is null then raise exception 'Avvia prima una sessione'; end if;
  insert into encounters(campaign_id,session_id,name) values(p_campaign,new_id,p_data->>'name');
 when 'combatant_add' then
  select * into enc from encounters where id=target and campaign_id=p_campaign and status<>'completed';
  if enc.id is null then raise exception 'Scontro non disponibile'; end if;
  if nullif(p_data->>'character_id','') is not null then
   select * into ch from characters where id=(p_data->>'character_id')::uuid and campaign_id=p_campaign;
   if ch.id is null then raise exception 'Personaggio non valido'; end if;
  end if;
  insert into combatants(campaign_id,encounter_id,character_id,name,initiative,turn_order) values(p_campaign,enc.id,ch.id,coalesce(ch.name,p_data->>'name'),coalesce((p_data->>'initiative')::int,0),coalesce((select max(turn_order)+1 from combatants where encounter_id=enc.id),0)) returning id into new_id;
  if ch.id is null then insert into combatant_secrets(id,campaign_id,real_name,current_hp,max_hp,armor_class) values(new_id,p_campaign,coalesce(p_data->>'real_name',p_data->>'name'),(p_data->>'max_hp')::int,(p_data->>'max_hp')::int,(p_data->>'armor_class')::int); end if;
  update encounters set version=version+1 where id=enc.id;
 when 'initiative' then
  select e.* into enc from encounters e join combatants b on b.encounter_id=e.id where b.id=target and b.campaign_id=p_campaign;
  if enc.status<>'preparing' then raise exception 'Iniziativa disponibile durante la preparazione'; end if;
  if not dm and not exists(select 1 from combatants b join characters c on c.id=b.character_id where b.id=target and c.user_id=auth.uid() and b.campaign_id=p_campaign) then raise exception 'Accesso negato'; end if;
  update combatants set initiative=(p_data->>'initiative')::int where id=target and campaign_id=p_campaign;
  update encounters set version=version+1 where id=enc.id;
 when 'combatant_order' then
  select * into enc from encounters where id=target and campaign_id=p_campaign and status='preparing';
  if enc.id is null then raise exception 'Ordine modificabile prima dello scontro'; end if;
  if enc.version is distinct from (p_data->>'version')::int then raise exception 'Ordine aggiornato. Riprova.'; end if;
  update combatants set turn_order=(p_data->>'order')::int where id=(p_data->>'combatant_id')::uuid and encounter_id=target;
  update encounters set version=version+1 where id=target;
 when 'combatant_remove' then
  select e.* into enc from encounters e join combatants b on b.encounter_id=e.id where b.id=target and b.campaign_id=p_campaign and e.status<>'completed';
  if enc.id is null then raise exception 'Scontro non disponibile'; end if;
  select count(*) into pos from combatants b where b.encounter_id=enc.id and (b.turn_order,b.id)<(select turn_order,id from combatants where id=target);
  delete from combatants where id=target and campaign_id=p_campaign;
  select count(*) into n from combatants where encounter_id=enc.id;
  update encounters set current_turn=case when n=0 then 0 when pos<current_turn then current_turn-1 when current_turn>=n then 0 else current_turn end,current_round=current_round+case when n>0 and pos=current_turn and current_turn>=n then 1 else 0 end,status=case when n=0 then 'preparing' else status end,version=version+1 where id=enc.id;
 when 'enemy_update' then
  update combatant_secrets set current_hp=(p_data->>'current_hp')::int,conditions=p_data->>'conditions',notes=p_data->>'notes' where id=target and campaign_id=p_campaign;
  update combatants set name=p_data->>'name',public_hp=p_data->>'public_hp',public_conditions=p_data->>'public_conditions' where id=target and campaign_id=p_campaign and character_id is null;
 when 'encounter_start' then
  select * into enc from encounters where id=target and campaign_id=p_campaign and status='preparing';
  if enc.id is null or not exists(select 1 from combatants where encounter_id=target) then raise exception 'Aggiungi almeno un partecipante'; end if;
  if enc.version is distinct from (p_data->>'version')::int then raise exception 'Iniziativa aggiornata. Riprova.'; end if;
  with ranked as (select id,row_number() over(order by initiative desc,turn_order,id)-1 as rank from combatants where encounter_id=target) update combatants b set turn_order=r.rank from ranked r where b.id=r.id;
  update encounters set status='active',current_round=1,current_turn=0,version=version+1 where id=target;
 when 'turn' then
  select * into enc from encounters where id=target and campaign_id=p_campaign and status='active';
  if enc.id is null or enc.version is distinct from (p_data->>'version')::int then raise exception 'Turno già aggiornato. Riprova.'; end if;
  delta:=(p_data->>'direction')::int;
  if delta not in (-1,1) or delta is null then raise exception 'Invalid direction'; end if;
  select count(*) into n from combatants where encounter_id=target;
  pos:=greatest(0,(enc.current_round-1)*n+enc.current_turn+delta);
  update encounters set current_round=pos/n+1,current_turn=pos%n,version=version+1 where id=target;
 when 'encounter_end' then update encounters set status='completed',version=version+1 where id=target and campaign_id=p_campaign;
 when 'message_send' then
  for owner in select value::uuid from jsonb_array_elements_text(p_data->'recipients') loop
   if not exists(select 1 from campaign_members where campaign_id=p_campaign and user_id=owner) then raise exception 'Destinatario non valido'; end if;
   insert into private_messages(campaign_id,sender_id,recipient_id,content) values(p_campaign,auth.uid(),owner,p_data->>'content');
  end loop;
 when 'message_read' then update private_messages set is_read=true where id=target and campaign_id=p_campaign and recipient_id=auth.uid();
 when 'record_save' then
  if p_data->>'kind' not in ('journal','note') and not dm then raise exception 'Solo il Dungeon Master'; end if;
  if p_data->>'visibility'='dm' and not dm then raise exception 'Solo il Dungeon Master'; end if;
  if target is null then insert into records(campaign_id,author_id,kind,title,content,status,visibility,location) values(p_campaign,auth.uid(),p_data->>'kind',p_data->>'title',p_data->>'content',coalesce(p_data->>'status','active'),p_data->>'visibility',coalesce(p_data->>'location',''));
  else
   select * into rec from records where id=target and campaign_id=p_campaign;
   if rec.id is null or (rec.author_id<>auth.uid() and (not dm or rec.visibility='personal')) then raise exception 'Accesso negato'; end if;
   if rec.kind<>p_data->>'kind' or rec.version is distinct from (p_data->>'version')::int then raise exception 'Contenuto aggiornato. Riprova.'; end if;
   update records set title=p_data->>'title',content=p_data->>'content',status=p_data->>'status',visibility=p_data->>'visibility',location=p_data->>'location',version=version+1 where id=target;
  end if;
 when 'record_delete' then delete from records where id=target and campaign_id=p_campaign and (author_id=auth.uid() or (dm and visibility<>'personal'));
 when 'item_add' then
  owner:=nullif(p_data->>'character_id','')::uuid;
  if owner is not null and not exists(select 1 from characters where id=owner and campaign_id=p_campaign and can_character(id)) then raise exception 'Accesso negato'; end if;
  insert into inventory_items(campaign_id,character_id,name,description,quantity,item_type,weight,value) values(p_campaign,owner,p_data->>'name',p_data->>'description',(p_data->>'quantity')::int,p_data->>'item_type',nullif(p_data->>'weight','')::numeric,nullif(p_data->>'value','')::numeric);
  insert into inventory_transactions(campaign_id,item_name,actor_id,quantity,to_owner,description) values(p_campaign,p_data->>'name',auth.uid(),(p_data->>'quantity')::int,owner,'Aggiunta');
 when 'item_quantity' then
  select * into itm from inventory_items where id=target and campaign_id=p_campaign;
  if itm.id is null or (itm.character_id is not null and not can_character(itm.character_id)) then raise exception 'Accesso negato'; end if;
  if itm.version is distinct from (p_data->>'version')::int then raise exception 'Inventario aggiornato. Riprova.'; end if;
  insert into inventory_transactions(campaign_id,item_name,actor_id,quantity,from_owner,description) values(p_campaign,itm.name,auth.uid(),(p_data->>'quantity')::int-itm.quantity,itm.character_id,'Quantità');
  update inventory_items set quantity=(p_data->>'quantity')::int,version=version+1 where id=target;
 when 'item_delete' then
  select * into itm from inventory_items where id=target and campaign_id=p_campaign;
  if itm.id is null or (itm.character_id is not null and not can_character(itm.character_id)) then raise exception 'Accesso negato'; end if;
  if itm.version is distinct from (p_data->>'version')::int then raise exception 'Inventario aggiornato. Riprova.'; end if;
  insert into inventory_transactions(campaign_id,item_name,actor_id,quantity,from_owner,description) values(p_campaign,itm.name,auth.uid(),-itm.quantity,itm.character_id,'Rimozione');
  delete from inventory_items where id=target;
 when 'item_transfer' then
  select * into itm from inventory_items where id=target and campaign_id=p_campaign;
  if itm.id is null or (itm.character_id is not null and not can_character(itm.character_id)) then raise exception 'Accesso negato'; end if;
  if itm.version is distinct from (p_data->>'version')::int then raise exception 'Inventario aggiornato. Riprova.'; end if;
  n:=(p_data->>'quantity')::int; owner:=nullif(p_data->>'character_id','')::uuid;
  if n is null or n<=0 or n>itm.quantity or owner is not distinct from itm.character_id then raise exception 'Trasferimento non valido'; end if;
  if owner is not null and not exists(select 1 from characters where id=owner and campaign_id=p_campaign) then raise exception 'Destinatario non valido'; end if;
  update inventory_items set quantity=quantity-n,version=version+1 where id=target;
  insert into inventory_items(campaign_id,character_id,name,description,quantity,item_type,weight,value) values(p_campaign,owner,itm.name,itm.description,n,itm.item_type,itm.weight,itm.value);
  insert into inventory_transactions(campaign_id,item_name,actor_id,quantity,from_owner,to_owner,description) values(p_campaign,itm.name,auth.uid(),n,itm.character_id,owner,'Trasferimento');
 when 'currency' then
  delta:=(p_data->>'delta')::int;
  update currency set amount=amount+delta where campaign_id=p_campaign and denomination=p_data->>'denomination';
  if not found then raise exception 'Valuta non valida'; end if;
  insert into inventory_transactions(campaign_id,item_name,actor_id,quantity,description) values(p_campaign,p_data->>'denomination',auth.uid(),delta,'Valuta');
 else raise exception 'Operazione non valida';
 end case;
 insert into command_receipts(id,campaign_id,user_id,result) values(p_request,p_campaign,auth.uid(),result);
 return result;
end $$;

-- Explicit RPC permissions; no anonymous execution or direct writes.
revoke execute on all functions in schema public from public,anon;
grant execute on function public.is_member(uuid),public.is_dm(uuid),public.can_character(uuid),public.save_profile(text,text),public.create_campaign(text,text),public.join_campaign(text),public.command(uuid,text,jsonb,uuid) to authenticated;
-- Realtime delivers only rows authorized by the subscriber's SELECT policy.
do $$ declare t text; begin
 foreach t in array array['campaign_members','characters','character_resources','sessions','encounters','combatants','combatant_secrets','records','private_messages','inventory_items','inventory_transactions','currency'] loop
 execute format('alter publication supabase_realtime add table public.%I',t);
 end loop;
end $$;

