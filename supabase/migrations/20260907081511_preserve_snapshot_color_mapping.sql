-- Preserve the existing JavaScript getNicknameColor palette exactly. JavaScript
-- converts only the left-shift operand/result to signed 32-bit; its subsequent
-- subtraction and addition remain Number arithmetic without a final int32 cast.
create or replace function world_private.trace_color_index(color_key uuid)
returns integer
language plpgsql
immutable strict
security invoker
set search_path = ''
as $$
declare
  value bigint := 0;
  shifted bigint;
  source text := color_key::text;
  position integer;
begin
  for position in 1..pg_catalog.length(source) loop
    shifted := (value << 5) & 4294967295;
    if shifted >= 2147483648 then shifted := shifted - 4294967296; end if;
    value := pg_catalog.ascii(pg_catalog.substr(source, position, 1)) + shifted - value;
  end loop;
  return (pg_catalog.abs(value) % 10)::integer;
end;
$$;
revoke all on function world_private.trace_color_index(uuid) from public, anon, authenticated;
