-- 0014 · Orden de sobrantes según las plantillas Excel del cliente (sep 2026)
-- Las secciones (leftovers_family) y el orden dentro de cada una (leftovers_order)
-- siguen la hoja más reciente de LEFT OVERS SANTA FELICIANA + filas extra de NAVE.
-- Los productos de obrador sin leftovers_order aparecen al final de su sección.

alter table public.products add column if not exists leftovers_order integer;

-- Productos que aparecen en los Excel y no existían en el catálogo
insert into public.products (name, family, is_active, is_obrador, is_custom, leftovers_family, display_order)
select v.name, v.family, true, true, false, v.lf, 50
from (values
  ('Galette de temporada', 'dulce', 'Pasteles'),
  ('Tarta de temporada', 'dulce', 'Tartas'),
  ('Kouign Amann albaricoque', 'bolleria', 'Pasteles'),
  ('Tropézienne', 'dulce', null)
) as v(name, family, lf)
where not exists (select 1 from public.products p where p.name = v.name);

-- Todo lo que se registra en los Excel debe ser visible en sobrantes
update public.products p set is_obrador = true, is_active = true
where p.id = (select p2.id from public.products p2 where p2.name = p.name
              order by p2.is_obrador desc, p2.is_active desc, p2.created_at limit 1)
  and p.name in ('Avena miel', 'BRIOCHE HAMBURGUESA', 'Barra', 'Bocata de Salami', 'Bocata de mortadella', 'Bostock', 'Brioche croissant', 'Brioche maitake setas', 'Brioche tonka', 'CANELA ROLL', 'CARACOLA DE CHOCOLATE', 'CENTENO', 'CHALLAH', 'Caracola de pistacho', 'Cardamom bun', 'Cesta vainilla', 'Chausson aux pommes', 'Cookie', 'Cookie avellana', 'Cookie banana', 'Cookie choco', 'Cookie pistacho', 'Coquito', 'Cr. avellana gianduja', 'Croissant', 'Croissant almendra', 'Croissant jamón', 'Croissant pistacho', 'Danish albaricoque', 'Danish limón', 'Danish patata', 'Danish pera y gorgonzola', 'Danish setas', 'Espelta simple', 'FOCACCIA ESPECIAL', 'FOCACCIA SIMPLE', 'Flan Parisien', 'Focaccia kalamata', 'Focaccia patata', 'Focaccia pepperoni', 'Focaccia sobrasada ricotta', 'Focaccia tomate', 'Galette cereza / ciruela', 'Galette de temporada', 'Galette de tomate', 'Kalamata', 'Kouign Amann', 'Kouign Amann albaricoque', 'Mimolette', 'Molde blanco', 'Molde integral', 'NAPOLEÓN', 'Nanterre', 'PAIN SUISSE', 'PANCITO', 'PASAS Y NUECES', 'Pain au chocolat', 'Pain suisse Caffé', 'Quiche', 'SEMI INTEGRAL', 'Semillas hogaza', 'Sobrasada', 'TRIGO BLANCO', 'Tarta de limón', 'Tarta de temporada', 'Tropézienne', 'parisien', 'ricotta bun');

update public.products set leftovers_order = null where leftovers_order is not null;

update public.products p set leftovers_family = v.lf, leftovers_order = v.pos
from (values
  ('Barra', 'Pan', 1),
  ('PANCITO', 'Pan', 2),
  ('TRIGO BLANCO', 'Pan', 3),
  ('Molde blanco', 'Pan', 4),
  ('SEMI INTEGRAL', 'Pan', 5),
  ('Molde integral', 'Pan', 6),
  ('Semillas hogaza', 'Pan', 7),
  ('Avena miel', 'Pan', 8),
  ('CENTENO', 'Pan', 9),
  ('PASAS Y NUECES', 'Pan', 10),
  ('Kalamata', 'Pan', 11),
  ('Brioche croissant', 'Pan', 12),
  ('Nanterre', 'Pan', 13),
  ('Espelta simple', 'Pan', 14),
  ('Croissant', 'Pasteles', 15),
  ('Pain au chocolat', 'Pasteles', 16),
  ('Croissant almendra', 'Pasteles', 17),
  ('Cr. avellana gianduja', 'Pasteles', 18),
  ('Croissant pistacho', 'Pasteles', 19),
  ('Caracola de pistacho', 'Pasteles', 20),
  ('CARACOLA DE CHOCOLATE', 'Pasteles', 21),
  ('PAIN SUISSE', 'Pasteles', 22),
  ('Pain suisse Caffé', 'Pasteles', 23),
  ('CANELA ROLL', 'Pasteles', 24),
  ('Cesta vainilla', 'Pasteles', 25),
  ('Galette cereza / ciruela', 'Pasteles', 26),
  ('Galette de temporada', 'Pasteles', 27),
  ('Danish limón', 'Pasteles', 28),
  ('Danish albaricoque', 'Pasteles', 29),
  ('Kouign Amann', 'Pasteles', 30),
  ('Bostock', 'Pasteles', 31),
  ('Flan Parisien', 'Pasteles', 32),
  ('ricotta bun', 'Pasteles', 33),
  ('Cardamom bun', 'Pasteles', 34),
  ('Cookie', 'Pasteles', 35),
  ('Coquito', 'Pasteles', 36),
  ('Croissant jamón', 'Salados', 37),
  ('Mimolette', 'Salados', 38),
  ('Galette de tomate', 'Salados', 39),
  ('Danish patata', 'Salados', 40),
  ('Danish setas', 'Salados', 41),
  ('Focaccia patata', 'Salados', 42),
  ('FOCACCIA SIMPLE', 'Salados', 43),
  ('Focaccia pepperoni', 'Salados', 44),
  ('Focaccia tomate', 'Salados', 45),
  ('Focaccia kalamata', 'Salados', 46),
  ('Bocata de Salami', 'Salados', 47),
  ('Bocata de mortadella', 'Salados', 48),
  ('parisien', 'Salados', 49),
  ('Brioche tonka', 'Salados', 50),
  ('BRIOCHE HAMBURGUESA', 'Salados', 51),
  ('Sobrasada', 'Salados', 52),
  ('Brioche maitake setas', 'Salados', 53),
  ('Danish pera y gorgonzola', 'Salados', 54),
  ('NAPOLEÓN', 'Tartas', 55),
  ('Tarta de limón', 'Tartas', 56),
  ('Tarta de temporada', 'Tartas', 57),
  ('Quiche', 'Quiche', 58)
) as v(name, lf, pos)
where p.name = v.name and p.is_obrador;

do $$
declare n integer;
begin
  select count(*) into n from public.products where leftovers_order is not null;
  if n <> 58 then raise exception 'leftovers_order: esperados 58, asignados %', n; end if;
end $$;
