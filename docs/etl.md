# ETL ERP -> sales_daily

## Fuente actual
- ERP/TPV con histórico fiable desde 2021.
- Pipeline Python existente que genera `sales_tidy.csv` con separador `;`.
- Excluir establecimientos no válidos: `SIN USO - PIZZA PRONTO` y `nan`.

## Carga recomendada
1. Ingesta cruda a `sales_raw` (`source_file`, `row_data`).
2. Transformación a `sales_daily`:
   - mapear `location_name` -> `location_id` cuando exista en `locations`
   - mapear `product_name` -> `product_id` cuando exista en `products`
   - conservar nombre aunque no haya id (compatibilidad histórica)
3. Upsert por clave de negocio (índice único `ux_sales_daily_dedup`).

## Semántica leftovers
- `discarded_qty`: lo tirado (dato histórico existente)
- `saved_qty`: lo guardado para mañana (nuevo dato en app)
- Captura principal en `SANTA FELICIANA 10`.
