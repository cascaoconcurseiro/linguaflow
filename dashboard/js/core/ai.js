// dashboard/js/core/ai.js

export async function explainGrammar(sentence) {
  // Pegamos a sessão do Supabase do localStorage
  const sessionStr = localStorage.getItem('lf_supabase_session');
  if (!sessionStr) {
    throw new Error('Supabase session missing. Please login.');
  }
  
  let token;
  try {
    const sessionData = JSON.parse(sessionStr);
    token = sessionData?.session?.access_token;
  } catch (e) {
    throw new Error('Invalid Supabase session.');
  }

  if (!token) {
    throw new Error('Supabase token missing. Please login.');
  }

  const prompt = `Você é um professor de inglês nativo e especialista em linguística.
O aluno está estudando a seguinte frase: "${sentence}"

Sua tarefa:
1. Identifique a estrutura gramatical PRINCIPAL (ex: Present Perfect, Phrasal Verb, Condicional) usada nessa frase.
2. Explique de forma EXTREMAMENTE didática e curta como essa estrutura funciona, usando analogias se necessário.
3. Crie um "Mapa Visual" em texto usando blocos HTML simples (ex: <div style="padding:10px; background:#f0f0f0; border-radius:5px;">...</div>) separando os pedaços da frase e o que cada um significa estruturalmente.

Responda em Português. Formate sua resposta em HTML limpo (pode usar <b>, <ul>, <li>, <div>, <p>). Não use Markdown no retorno, apenas HTML.
Seja direto ao ponto. Não diga "Aqui está a explicação", vá direto para o ensino.`;

  try {
    // Aponta para a Edge Function segura no Supabase
    const response = await fetch('https://qnutoswrufznztoznlql.supabase.co/functions/v1/deepseek-chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      throw new Error('API_ERROR');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
}
