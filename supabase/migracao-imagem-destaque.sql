-- Imagem própria do popup de destaque (antes ele reaproveitava a da Home).
-- Rodar uma vez no SQL Editor do Supabase; não apaga nada.
alter table public.giveaways add column if not exists featured_image_url text;
