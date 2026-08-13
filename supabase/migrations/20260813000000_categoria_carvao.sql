-- Categoria própria para o carvão.
--
-- A saída de carvão cresceu e os 8 produtos estavam sem categoria nenhuma, o
-- que jogava todos eles na seção "Outros" da loja e do catálogo e deixava o
-- painel sem filtro próprio na hora de montar o pedido.
--
-- O carvão entra logo depois dos galões, que são o carro-chefe, e empurra
-- refrigerantes, sucos e acessórios uma posição para baixo. Essa ordem vale
-- para as seções da loja, para as abas do catálogo e para os botões de filtro
-- do painel, que leem todos o mesmo sort_order.
--
-- Idempotente: rodar de novo não duplica a categoria nem remarca produto que
-- já tenha categoria.

INSERT INTO public.product_categories (name, slug, sort_order)
VALUES ('Carvão', 'carvao', 4)
ON CONFLICT (slug) DO UPDATE SET sort_order = EXCLUDED.sort_order;

UPDATE public.product_categories SET sort_order = 5 WHERE slug = 'refrigerantes';
UPDATE public.product_categories SET sort_order = 6 WHERE slug = 'sucos';
UPDATE public.product_categories SET sort_order = 7 WHERE slug = 'acessorios';

UPDATE public.products
SET category_id = (SELECT id FROM public.product_categories WHERE slug = 'carvao')
WHERE category_id IS NULL
  AND lower(name) LIKE '%carv%';
