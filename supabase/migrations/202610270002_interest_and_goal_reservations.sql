-- Accept v1 snapshots while clients migrate them to v2 (interest history and savings reservation fields).
alter table public.scuttle_user_data
  drop constraint if exists scuttle_user_data_data_check;

alter table public.scuttle_user_data
  add constraint scuttle_user_data_data_check
  check (jsonb_typeof(data) = 'object' and data->>'version' in ('1', '2'));

create or replace function public.save_scuttle_data(p_data jsonb, p_expected_revision integer)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  current_revision integer;
begin
  if owner_id is null then
    raise exception 'Sign in before saving Scuttle data.' using errcode = '28000';
  end if;
  if jsonb_typeof(p_data) <> 'object' or p_data->>'version' not in ('1', '2') then
    raise exception 'Unsupported Scuttle data format.' using errcode = '22023';
  end if;

  select revision into current_revision
  from public.scuttle_user_data
  where user_id = owner_id
  for update;

  if not found then
    if p_expected_revision <> 0 then
      raise exception 'Scuttle data changed on another device. Reload before saving.' using errcode = '40001';
    end if;
    insert into public.scuttle_user_data (user_id, data, revision)
    values (owner_id, p_data, 1);
    return 1;
  end if;

  if current_revision <> p_expected_revision then
    raise exception 'Scuttle data changed on another device. Reload before saving.' using errcode = '40001';
  end if;

  update public.scuttle_user_data
  set data = p_data, revision = current_revision + 1, updated_at = now()
  where user_id = owner_id;
  return current_revision + 1;
end;
$$;

revoke all on function public.save_scuttle_data(jsonb, integer) from public, anon;
grant execute on function public.save_scuttle_data(jsonb, integer) to authenticated;
