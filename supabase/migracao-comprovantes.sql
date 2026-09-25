-- Inscrição com mais de um comprovante (até 4).
-- proof_url continua sendo o principal; proof_paths guarda todos.
alter table public.participants add column if not exists proof_paths text[] not null default '{}';
