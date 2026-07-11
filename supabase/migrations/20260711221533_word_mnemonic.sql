-- Onda 3.3 (Prof. didático/Linguista): mnemônico gerado por IA por palavra.
-- Guardado no card pra não gerar de novo (custo de IA) toda vez que o aluno
-- abre o mesmo card — o botão "me dá um truque" só chama a IA se ainda não
-- existir um mnemônico salvo.
ALTER TABLE public.words ADD COLUMN IF NOT EXISTS mnemonic text;
