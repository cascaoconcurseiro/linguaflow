-- #443: imagem opcional por unidade de curso (palavras de vocabulário).
-- Expand-only: colunas novas e opcionais; nada é removido. Rollback = deixar de
-- ler as colunas no cliente (os dados podem ficar).

ALTER TABLE public.course_units
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_credit text,
  ADD COLUMN IF NOT EXISTS image_license text;

ALTER TABLE public.course_units
  DROP CONSTRAINT IF EXISTS course_units_image_url_https;
ALTER TABLE public.course_units
  ADD CONSTRAINT course_units_image_url_https
  CHECK (image_url IS NULL OR image_url ~ '^https://');

COMMENT ON COLUMN public.course_units.image_url IS 'Ilustração da palavra (https). Escolhida na geração do conteúdo, nunca buscada em tempo de estudo.';
COMMENT ON COLUMN public.course_units.image_credit IS 'Autor/fonte da imagem, exibido junto dela.';
COMMENT ON COLUMN public.course_units.image_license IS 'Licença SPDX da imagem (ex.: Apache-2.0).';
