insert into public.locations (name, kind, is_leftovers_primary)
values
('LOS URQUIZA 17', 'production', false),
('SANTA FELICIANA 10', 'hybrid', true)
on conflict (name) do update
set kind = excluded.kind,
    is_leftovers_primary = excluded.is_leftovers_primary;

insert into public.production_teams (name, location_id)
select t.name, l.id
from (values
  ('Panadería'),
  ('Laminado'),
  ('Pastelería'),
  ('Cocina'),
  ('Sala')
) as t(name)
left join public.locations l on l.name = 'LOS URQUIZA 17'
on conflict (name) do nothing;

insert into public.products (name, family, unit, is_weekend_special, is_christmas_special)
values
('Hogaza masa madre', 'Panadería', 'unit', false, false),
('Barra integral', 'Panadería', 'unit', false, false),
('Croissant mantequilla', 'Laminado', 'unit', false, false),
('Napolitana chocolate', 'Laminado', 'unit', true, false),
('Panettone', 'Navidad', 'unit', false, true),
('Roscón con nata', 'Navidad', 'unit', false, true),
('Roscón sin nata', 'Navidad', 'unit', false, true),
('Mini roscón', 'Navidad', 'unit', false, true),
('Pandoro', 'Navidad', 'unit', false, true)
on conflict (name) do nothing;
