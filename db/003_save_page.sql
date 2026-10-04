-- knock: 편집기 '한 번에 저장' 함수
-- Supabase 대시보드 > knock 프로젝트 > SQL Editor에 이 내용을 전부 붙여넣고 Run
-- (002_보강.sql에도 같은 내용이 들어 있어요. 이미 002를 통째로 실행했다면 다시 할 필요 없음)

-- 편집기 저장을 한 번에 (중간에 실패하면 전부 취소돼서 내용이 날아가지 않는다)
-- security invoker: 호출한 사람 권한(RLS)으로 실행되므로 남의 페이지는 못 고친다
create or replace function public.save_page(p_page_id uuid, p_blocks jsonb, p_removed uuid[], p_page jsonb, p_decor jsonb)
returns void
language plpgsql security invoker set search_path = public, extensions as $$
declare
  b jsonb;
  d jsonb;
  i int := 0;
  vis text := p_page->>'visibility';
begin
  if not public.owns_page(p_page_id) then
    raise exception 'not owner';
  end if;
  if p_removed is not null and array_length(p_removed, 1) > 0 then
    delete from public.blocks where page_id = p_page_id and id = any(p_removed);
  end if;
  for b in select * from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) loop
    insert into public.blocks (id, page_id, type, position, is_visible, data)
    values ((b->>'id')::uuid, p_page_id, b->>'type', i, coalesce((b->>'is_visible')::boolean, true), coalesce(b->'data', '{}'::jsonb))
    on conflict (id) do update
      set type = excluded.type, position = excluded.position, is_visible = excluded.is_visible, data = excluded.data
      where public.blocks.page_id = p_page_id;
    i := i + 1;
  end loop;
  update public.pages set
    template = coalesce(p_page->>'template', template),
    theme = coalesce(p_page->'theme', theme),
    guestbook_mode = coalesce(p_page->>'guestbook_mode', guestbook_mode),
    visibility = case
      when vis is null then visibility
      when vis = 'locked' and lock_pin_hash is null then visibility
      else vis end
  where id = p_page_id;
  delete from public.decor_items where page_id = p_page_id;
  i := 0;
  for d in select * from jsonb_array_elements(coalesce(p_decor, '[]'::jsonb)) loop
    insert into public.decor_items (page_id, item_key, x, y, rotation, scale, z)
    values (p_page_id, d->>'item', (d->>'x')::real, (d->>'y')::real, coalesce((d->>'rotation')::real, 0), coalesce((d->>'scale')::real, 1), i);
    i := i + 1;
  end loop;
end;
$$;
revoke execute on function public.save_page(uuid, jsonb, uuid[], jsonb, jsonb) from public, anon;
grant execute on function public.save_page(uuid, jsonb, uuid[], jsonb, jsonb) to authenticated;
