-- P0.2b contract: executar somente depois que o cliente com RPCs estreitas
-- estiver publicado e validado. RLS filtra linhas; grants definem quais
-- operações chegam à tabela. Ambos são necessários.

REVOKE ALL ON TABLE public.cards, public.review_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.cards, public.review_log TO authenticated;

-- Remove qualquer policy herdada (inclusive FOR ALL) antes de reconstruir o
-- contrato somente-leitura. O loop também cobre nomes divergentes no remoto.
DO $$
DECLARE policy_row record;
BEGIN
  FOR policy_row IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('cards', 'review_log')
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  END LOOP;
END
$$;

CREATE POLICY "Users read own cards"
  ON public.cards
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users read own review history"
  ON public.review_log
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

COMMENT ON POLICY "Users read own cards" ON public.cards IS
  'P0.2b: clientes leem cards próprios; toda escrita usa RPCs estreitas.';
COMMENT ON POLICY "Users read own review history" ON public.review_log IS
  'P0.2b: histórico próprio é somente leitura para clientes.';
