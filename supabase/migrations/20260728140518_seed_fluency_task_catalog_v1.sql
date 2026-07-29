revoke all on table private.fluency_task_catalog from public, anon, authenticated;
revoke all on table private.fluency_task_catalog from service_role;

with seed as (
  select *
  from jsonb_to_recordset($catalog$
[
  {
    "task_key":"a1.listening.immediate_need.v1","catalog_version":"2026.07.1","level":"A1","ceiling_level":"A1","skill":"listening","family":"immediate_need",
    "public_material":{"instruction":"Ouça uma mensagem curta uma vez e escolha por que a pessoa está falando.","objective":"Identificar uma necessidade imediata explícita.","audience":"Ouvinte de uma mensagem cotidiana.","duration_seconds":{"min":15,"max":35},"options":["Ela precisa de água.","Ela quer comprar um livro.","Ela perdeu o ônibus.","Ela está procurando um hotel."]},
    "answer_key":{"transcript":"Excuse me. I am very thirsty. Can I have a glass of water, please?","correct_answer":0,"required_points":["necessidade de água"]},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","global_meaning"],"dimensions":["task_completion","global_meaning","explicit_detail","independence"]}
  },
  {
    "task_key":"a1.listening.simple_direction.v1","catalog_version":"2026.07.1","level":"A1","ceiling_level":"A1","skill":"listening","family":"simple_direction",
    "public_material":{"instruction":"Ouça a instrução curta e escolha o destino indicado.","objective":"Reconhecer um destino e uma direção simples.","audience":"Pessoa pedindo orientação em um prédio.","duration_seconds":{"min":15,"max":35},"options":["A sala fica à esquerda.","A sala fica no segundo andar.","A sala fica ao lado da saída.","A sala fica atrás do café."]},
    "answer_key":{"transcript":"Go up the stairs to the second floor. Room twelve is in front of you.","correct_answer":1,"required_points":["segundo andar"]},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","global_meaning"],"dimensions":["task_completion","global_meaning","explicit_detail","independence"]}
  },
  {
    "task_key":"a1.speaking_spontaneous.self_introduction.v1","catalog_version":"2026.07.1","level":"A1","ceiling_level":"A1","skill":"speaking_spontaneous","family":"self_introduction",
    "public_material":{"instruction":"Fale sem ler um texto pronto. Diga quem você é e duas informações simples sobre sua vida.","objective":"Apresentar-se com informações pessoais básicas.","audience":"Novo colega de turma.","duration_seconds":{"min":30,"max":45}},
    "answer_key":{"required_moves":["dizer nome ou forma de tratamento","dar duas informações pessoais diferentes"],"disallowed_shortcuts":["ler resposta preparada"]},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","comprehensibility"],"dimensions":["task_completion","comprehensibility","functional_fluency","linguistic_control","coherence"]}
  },
  {
    "task_key":"a1.speaking_spontaneous.immediate_need.v1","catalog_version":"2026.07.1","level":"A1","ceiling_level":"A1","skill":"speaking_spontaneous","family":"immediate_need",
    "public_material":{"instruction":"Você está em um café e recebeu o pedido errado. Explique o problema e peça o item correto.","objective":"Expressar um problema imediato e fazer um pedido simples.","audience":"Atendente de um café.","duration_seconds":{"min":30,"max":45}},
    "answer_key":{"required_moves":["identificar o item errado","pedir claramente a troca ou o item correto"],"disallowed_shortcuts":["repetir uma frase-modelo"]},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","comprehensibility"],"dimensions":["task_completion","comprehensibility","functional_fluency","linguistic_control","coherence"]}
  },
  {
    "task_key":"a1.writing.personal_note.v1","catalog_version":"2026.07.1","level":"A1","ceiling_level":"A1","skill":"writing","family":"personal_note",
    "public_material":{"instruction":"Escreva um bilhete curto dizendo quem você é, onde está e a que horas volta.","objective":"Transmitir três informações pessoais concretas.","audience":"Pessoa que mora com você.","word_count":{"min":25,"max":40}},
    "answer_key":{"required_moves":["identificar-se","informar local","informar horário de retorno"],"genre":"bilhete pessoal"},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","coherence"],"dimensions":["task_completion","coherence","lexical_range","linguistic_control","register"]}
  },
  {
    "task_key":"a1.writing.simple_request.v1","catalog_version":"2026.07.1","level":"A1","ceiling_level":"A1","skill":"writing","family":"simple_request",
    "public_material":{"instruction":"Escreva uma mensagem curta pedindo para um colega trazer um objeto amanhã. Diga qual objeto e por que você precisa dele.","objective":"Fazer um pedido simples com item, momento e motivo.","audience":"Colega conhecido.","word_count":{"min":25,"max":40}},
    "answer_key":{"required_moves":["pedir um objeto específico","mencionar amanhã","dar um motivo simples"],"genre":"mensagem curta"},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","coherence"],"dimensions":["task_completion","coherence","lexical_range","linguistic_control","register"]}
  },
  {
    "task_key":"a1.interaction.basic_purchase.v1","catalog_version":"2026.07.1","level":"A1","ceiling_level":"A1","skill":"interaction","family":"basic_purchase",
    "public_material":{"instruction":"Converse com o atendente para comprar uma bebida. Pergunte o preço e confirme a quantidade antes de encerrar.","objective":"Concluir uma compra básica obtendo duas informações.","audience":"Atendente de uma pequena loja.","turns":{"min":3,"max":4}},
    "answer_key":{"required_moves":["pedir uma bebida","perguntar o preço","confirmar quantidade"],"partner_support":{"rephrases_allowed":2}},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","responsiveness"],"dimensions":["task_completion","responsiveness","turn_management","repair","comprehensibility"]}
  },
  {
    "task_key":"a1.interaction.personal_information.v1","catalog_version":"2026.07.1","level":"A1","ceiling_level":"A1","skill":"interaction","family":"personal_information",
    "public_material":{"instruction":"Responda às perguntas de uma recepcionista e faça uma pergunta sobre o horário de abertura.","objective":"Trocar informações pessoais básicas e obter um horário.","audience":"Recepcionista de um centro comunitário.","turns":{"min":3,"max":4}},
    "answer_key":{"required_moves":["responder informação pessoal solicitada","perguntar horário de abertura"],"partner_support":{"rephrases_allowed":2}},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","responsiveness"],"dimensions":["task_completion","responsiveness","turn_management","repair","comprehensibility"]}
  },

  {
    "task_key":"a2.listening.public_announcement.v1","catalog_version":"2026.07.1","level":"A2","ceiling_level":"A2","skill":"listening","family":"public_announcement",
    "public_material":{"instruction":"Ouça o anúncio e escolha o que os passageiros devem fazer.","objective":"Compreender a ação principal de um anúncio público curto.","audience":"Passageiro em uma estação.","duration_seconds":{"min":45,"max":75},"options":["Esperar na plataforma três.","Ir para a plataforma cinco.","Comprar outro bilhete.","Sair da estação."]},
    "answer_key":{"transcript":"Attention, please. The train to Bristol will not leave from platform three today. Passengers should go to platform five. The departure time is still ten forty.","correct_answer":1,"required_points":["mudança para plataforma cinco","horário não mudou"]},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","global_meaning"],"dimensions":["task_completion","global_meaning","explicit_detail","independence"]}
  },
  {
    "task_key":"a2.listening.routine_message.v1","catalog_version":"2026.07.1","level":"A2","ceiling_level":"A2","skill":"listening","family":"routine_message",
    "public_material":{"instruction":"Ouça a mensagem de voz e escolha por que o encontro mudou.","objective":"Identificar motivo e mudança em uma mensagem cotidiana.","audience":"Destinatário de uma mensagem de voz.","duration_seconds":{"min":45,"max":75},"options":["O café está fechado.","A pessoa precisa trabalhar até mais tarde.","O ônibus foi cancelado.","A pessoa esqueceu o endereço."]},
    "answer_key":{"transcript":"Hi, Ana. I cannot meet you at six because my manager asked me to stay at work until seven. Can we meet at the same café at seven thirty instead? Please call me if that is too late.","correct_answer":1,"required_points":["trabalho até sete","novo horário sete e meia"]},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","global_meaning"],"dimensions":["task_completion","global_meaning","explicit_detail","independence"]}
  },
  {
    "task_key":"a2.speaking_spontaneous.past_experience.v1","catalog_version":"2026.07.1","level":"A2","ceiling_level":"A2","skill":"speaking_spontaneous","family":"past_experience",
    "public_material":{"instruction":"Conte sobre uma ocasião em que você chegou atrasado. Explique onde ia, o que aconteceu e como terminou.","objective":"Relatar uma experiência passada em sequência simples.","audience":"Amigo interessado na história.","duration_seconds":{"min":45,"max":60}},
    "answer_key":{"required_moves":["situar o destino","explicar causa do atraso","contar o desfecho"],"disallowed_shortcuts":["ler resposta preparada"]},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","comprehensibility"],"dimensions":["task_completion","comprehensibility","functional_fluency","linguistic_control","coherence"]}
  },
  {
    "task_key":"a2.speaking_spontaneous.simple_comparison.v1","catalog_version":"2026.07.1","level":"A2","ceiling_level":"A2","skill":"speaking_spontaneous","family":"simple_comparison",
    "public_material":{"instruction":"Compare fazer compras pela internet e em uma loja. Diga uma vantagem de cada opção e qual você prefere.","objective":"Fazer comparação simples e declarar preferência.","audience":"Colega planejando uma compra.","duration_seconds":{"min":45,"max":60}},
    "answer_key":{"required_moves":["vantagem da compra online","vantagem da loja física","preferência pessoal"],"disallowed_shortcuts":["repetir uma frase-modelo"]},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","comprehensibility"],"dimensions":["task_completion","comprehensibility","functional_fluency","linguistic_control","coherence"]}
  },
  {
    "task_key":"a2.writing.informal_message.v1","catalog_version":"2026.07.1","level":"A2","ceiling_level":"A2","skill":"writing","family":"informal_message",
    "public_material":{"instruction":"Escreva para um amigo cancelando um encontro. Explique o motivo, peça desculpas e proponha outro dia.","objective":"Reorganizar um compromisso por mensagem.","audience":"Amigo próximo.","word_count":{"min":50,"max":80}},
    "answer_key":{"required_moves":["cancelar claramente","explicar motivo","pedir desculpas","propor nova data"],"genre":"mensagem informal"},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","coherence"],"dimensions":["task_completion","coherence","lexical_range","linguistic_control","register"]}
  },
  {
    "task_key":"a2.writing.short_account.v1","catalog_version":"2026.07.1","level":"A2","ceiling_level":"A2","skill":"writing","family":"short_account",
    "public_material":{"instruction":"Escreva sobre um passeio recente. Diga onde foi, com quem, duas coisas que fez e como se sentiu.","objective":"Produzir um relato curto em ordem compreensível.","audience":"Colegas de uma comunidade de viagens.","word_count":{"min":50,"max":80}},
    "answer_key":{"required_moves":["informar local e companhia","descrever duas ações","expressar sentimento"],"genre":"relato curto"},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","coherence"],"dimensions":["task_completion","coherence","lexical_range","linguistic_control","register"]}
  },
  {
    "task_key":"a2.interaction.change_booking.v1","catalog_version":"2026.07.1","level":"A2","ceiling_level":"A2","skill":"interaction","family":"change_booking",
    "public_material":{"instruction":"Você tem uma reserva para sexta, mas não pode ir. Peça outra data, responda sobre disponibilidade e confirme a mudança.","objective":"Alterar uma reserva em uma troca previsível.","audience":"Funcionário de um restaurante.","turns":{"min":4,"max":5}},
    "answer_key":{"required_moves":["informar reserva atual","pedir outra data","responder disponibilidade","confirmar mudança"],"partner_support":{"rephrases_allowed":1}},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","responsiveness"],"dimensions":["task_completion","responsiveness","turn_management","repair","comprehensibility"]}
  },
  {
    "task_key":"a2.interaction.service_request.v1","catalog_version":"2026.07.1","level":"A2","ceiling_level":"A2","skill":"interaction","family":"service_request",
    "public_material":{"instruction":"O wi-fi do hotel não funciona. Explique o problema, responda a uma pergunta técnica simples e combine uma solução.","objective":"Resolver um problema cotidiano de serviço.","audience":"Recepcionista de hotel.","turns":{"min":4,"max":5}},
    "answer_key":{"required_moves":["descrever falha do wi-fi","responder pergunta do atendente","aceitar ou negociar solução"],"partner_support":{"rephrases_allowed":1}},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","responsiveness"],"dimensions":["task_completion","responsiveness","turn_management","repair","comprehensibility"]}
  },

  {
    "task_key":"b1.listening.clear_narrative.v1","catalog_version":"2026.07.1","level":"B1","ceiling_level":"B1","skill":"listening","family":"clear_narrative",
    "public_material":{"instruction":"Ouça o relato e escolha por que a decisão final foi diferente do plano inicial.","objective":"Compreender sequência, causa e desfecho de uma narrativa clara.","audience":"Ouvinte de um relato pessoal.","duration_seconds":{"min":90,"max":120},"options":["O clima tornou o passeio inseguro.","O grupo perdeu os ingressos.","A atração estava fechada.","Uma pessoa decidiu trabalhar."]},
    "answer_key":{"transcript":"We had planned to hike to the waterfall on Saturday morning. The forecast looked fine when we left home, but dark clouds appeared as we reached the park. A ranger warned us that heavy rain could make the narrow path dangerous. We were disappointed, yet we decided not to take the risk. Instead, we visited a small museum nearby and saved the hike for another weekend.","correct_answer":0,"required_points":["alerta de chuva forte","trilha perigosa","plano substituído"]},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","global_meaning"],"dimensions":["task_completion","global_meaning","explicit_detail","inference","independence"]}
  },
  {
    "task_key":"b1.listening.familiar_explanation.v1","catalog_version":"2026.07.1","level":"B1","ceiling_level":"B1","skill":"listening","family":"familiar_explanation",
    "public_material":{"instruction":"Ouça a explicação e escolha qual mudança é recomendada primeiro.","objective":"Identificar recomendação principal e justificativa.","audience":"Pessoa ouvindo uma orientação prática.","duration_seconds":{"min":90,"max":120},"options":["Comprar equipamentos caros.","Dormir menos durante a semana.","Começar com sessões curtas e regulares.","Treinar apenas aos fins de semana."]},
    "answer_key":{"transcript":"People often give up exercise because they begin with a plan that is too demanding. Instead of trying to train for an hour every day, start with twenty minutes three times a week. Choose an activity you can do near home and put it in your calendar. Once the routine feels normal, you can slowly add more time. Regular short sessions are more useful at the beginning than one exhausting workout at the weekend.","correct_answer":2,"required_points":["sessões curtas","regularidade","aumento gradual"]},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","global_meaning"],"dimensions":["task_completion","global_meaning","explicit_detail","inference","independence"]}
  },
  {
    "task_key":"b1.speaking_spontaneous.experience_narrative.v1","catalog_version":"2026.07.1","level":"B1","ceiling_level":"B1","skill":"speaking_spontaneous","family":"experience_narrative",
    "public_material":{"instruction":"Conte sobre um problema inesperado durante uma viagem ou evento. Explique o plano, o problema, sua reação e o resultado.","objective":"Narrar uma experiência conectando acontecimentos e reação pessoal.","audience":"Grupo de colegas trocando experiências.","duration_seconds":{"min":75,"max":90}},
    "answer_key":{"required_moves":["apresentar plano inicial","explicar problema inesperado","descrever reação","informar resultado"],"disallowed_shortcuts":["ler resposta preparada"]},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","comprehensibility"],"dimensions":["task_completion","comprehensibility","functional_fluency","linguistic_control","coherence"]}
  },
  {
    "task_key":"b1.speaking_spontaneous.supported_opinion.v1","catalog_version":"2026.07.1","level":"B1","ceiling_level":"B1","skill":"speaking_spontaneous","family":"supported_opinion",
    "public_material":{"instruction":"Uma empresa quer ter um dia por semana sem reuniões. Diga se concorda e apresente pelo menos duas razões e uma possível dificuldade.","objective":"Expressar e sustentar opinião sobre tema familiar.","audience":"Colegas em uma reunião de equipe.","duration_seconds":{"min":75,"max":90}},
    "answer_key":{"required_moves":["declarar posição","dar duas razões","reconhecer uma dificuldade"],"disallowed_shortcuts":["usar resposta-modelo"]},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","comprehensibility"],"dimensions":["task_completion","comprehensibility","functional_fluency","linguistic_control","coherence"]}
  },
  {
    "task_key":"b1.writing.connected_account.v1","catalog_version":"2026.07.1","level":"B1","ceiling_level":"B1","skill":"writing","family":"connected_account",
    "public_material":{"instruction":"Escreva para um blog comunitário sobre uma habilidade que você aprendeu. Explique por que começou, como praticou, uma dificuldade e o resultado.","objective":"Produzir relato conectado com desenvolvimento e reflexão.","audience":"Leitores de um blog comunitário.","word_count":{"min":100,"max":140}},
    "answer_key":{"required_moves":["explicar motivação","descrever processo","apresentar dificuldade","avaliar resultado"],"genre":"relato para blog"},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","coherence"],"dimensions":["task_completion","coherence","lexical_range","linguistic_control","register"]}
  },
  {
    "task_key":"b1.writing.reasoned_message.v1","catalog_version":"2026.07.1","level":"B1","ceiling_level":"B1","skill":"writing","family":"reasoned_message",
    "public_material":{"instruction":"Escreva ao coordenador do seu curso propondo uma mudança de horário. Explique o problema atual, dê duas razões e sugira uma solução.","objective":"Fazer proposta clara e justificada em registro adequado.","audience":"Coordenador de curso.","word_count":{"min":100,"max":140}},
    "answer_key":{"required_moves":["descrever problema","dar duas razões","propor solução viável"],"genre":"mensagem semiformal"},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","coherence"],"dimensions":["task_completion","coherence","lexical_range","linguistic_control","register"]}
  },
  {
    "task_key":"b1.interaction.solve_complication.v1","catalog_version":"2026.07.1","level":"B1","ceiling_level":"B1","skill":"interaction","family":"solve_complication",
    "public_material":{"instruction":"Seu quarto de hotel não corresponde à reserva e não há outro igual disponível. Explique o problema, avalie duas alternativas e combine uma solução.","objective":"Negociar solução para complicação em situação familiar.","audience":"Gerente de hotel.","turns":{"min":5,"max":6}},
    "answer_key":{"required_moves":["comparar reserva e quarto recebido","reagir a duas alternativas","pedir ajuste razoável","confirmar acordo"],"partner_support":{"rephrases_allowed":1}},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","responsiveness"],"dimensions":["task_completion","responsiveness","turn_management","repair","comprehensibility"]}
  },
  {
    "task_key":"b1.interaction.clarify_misunderstanding.v1","catalog_version":"2026.07.1","level":"B1","ceiling_level":"B1","skill":"interaction","family":"clarify_misunderstanding",
    "public_material":{"instruction":"Um colega entendeu que você entregaria todo o relatório hoje, mas você combinou apenas a primeira parte. Esclareça, reaja à objeção e negocie um novo plano.","objective":"Reparar mal-entendido e chegar a um acordo prático.","audience":"Colega de trabalho.","turns":{"min":5,"max":6}},
    "answer_key":{"required_moves":["identificar mal-entendido","reformular o combinado","responder à objeção","negociar prazo"],"partner_support":{"rephrases_allowed":1}},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","responsiveness"],"dimensions":["task_completion","responsiveness","turn_management","repair","comprehensibility"]}
  },

  {
    "task_key":"b2.listening.structured_argument.v1","catalog_version":"2026.07.1","level":"B2","ceiling_level":"B2","skill":"listening","family":"structured_argument",
    "public_material":{"instruction":"Ouça o argumento e escolha a posição central do falante.","objective":"Compreender tese, concessão e conclusão em argumento desenvolvido.","audience":"Ouvinte de um comentário profissional.","duration_seconds":{"min":120,"max":180},"options":["O trabalho híbrido deve ser abolido.","Toda equipe deve usar exatamente o mesmo modelo.","O trabalho híbrido funciona melhor com regras claras e flexíveis.","A produtividade depende apenas do local de trabalho."]},
    "answer_key":{"transcript":"The debate about hybrid work is often framed as a choice between complete freedom and a full return to the office. That misses the real issue. Employees benefit from flexibility, but teams also need predictable moments for collaboration. A rigid rule applied to every department ignores the fact that different kinds of work have different needs. Companies should therefore establish a small number of shared principles, such as core collaboration days, while allowing each team to decide how to apply them. This approach is not perfect, but it balances autonomy with coordination better than either extreme.","correct_answer":2,"required_points":["rejeição dos extremos","princípios compartilhados","aplicação flexível por equipe"]},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","global_meaning"],"dimensions":["task_completion","global_meaning","explicit_detail","inference","stance","independence"]}
  },
  {
    "task_key":"b2.listening.viewpoint_contrast.v1","catalog_version":"2026.07.1","level":"B2","ceiling_level":"B2","skill":"listening","family":"viewpoint_contrast",
    "public_material":{"instruction":"Ouça a comparação de propostas e escolha por que o falante prefere a segunda.","objective":"Distinguir pontos de vista, ressalvas e preferência implícita.","audience":"Participante de uma discussão pública.","duration_seconds":{"min":120,"max":180},"options":["Ela custa menos imediatamente.","Ela elimina todos os carros do centro.","Ela combina efeito duradouro com apoio a quem precisa mudar hábitos.","Ela depende apenas de campanhas educativas."]},
    "answer_key":{"transcript":"The first proposal, a temporary ban on cars in the city centre, would certainly produce visible results during the trial. However, traffic would probably return as soon as the ban ended, and people without reliable public transport would have few alternatives. The second proposal takes longer because it combines new bus routes, safer cycling infrastructure and gradually higher parking fees. Critics say it lacks the drama of an immediate ban. Even so, I prefer it because it changes the conditions that shape daily choices while giving residents time and practical support to adapt.","correct_answer":2,"required_points":["mudança das condições","apoio prático","efeito duradouro"]},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","global_meaning"],"dimensions":["task_completion","global_meaning","explicit_detail","inference","stance","independence"]}
  },
  {
    "task_key":"b2.speaking_spontaneous.compare_tradeoffs.v1","catalog_version":"2026.07.1","level":"B2","ceiling_level":"B2","skill":"speaking_spontaneous","family":"compare_tradeoffs",
    "public_material":{"instruction":"Uma cidade pode investir primeiro em transporte público ou em moradia acessível. Compare impactos, reconheça uma desvantagem de cada opção e recomende uma prioridade.","objective":"Comparar alternativas complexas e justificar uma recomendação.","audience":"Conselho comunitário.","duration_seconds":{"min":105,"max":135}},
    "answer_key":{"required_moves":["explicar impacto de ambas as opções","reconhecer uma desvantagem de cada","definir prioridade","justificar recomendação"],"disallowed_shortcuts":["ler resposta preparada"]},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","comprehensibility"],"dimensions":["task_completion","comprehensibility","functional_fluency","linguistic_control","coherence"]}
  },
  {
    "task_key":"b2.speaking_spontaneous.defend_position.v1","catalog_version":"2026.07.1","level":"B2","ceiling_level":"B2","skill":"speaking_spontaneous","family":"defend_position",
    "public_material":{"instruction":"Defenda ou rejeite a proposta de limitar notificações de trabalho fora do expediente. Apresente argumentos, considere um contraponto e proponha uma exceção razoável.","objective":"Sustentar posição e responder antecipadamente a objeção.","audience":"Liderança e funcionários de uma empresa.","duration_seconds":{"min":105,"max":135}},
    "answer_key":{"required_moves":["declarar posição","desenvolver argumentos","considerar contraponto","propor exceção"],"disallowed_shortcuts":["usar resposta-modelo"]},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","comprehensibility"],"dimensions":["task_completion","comprehensibility","functional_fluency","linguistic_control","coherence"]}
  },
  {
    "task_key":"b2.writing.formal_argument.v1","catalog_version":"2026.07.1","level":"B2","ceiling_level":"B2","skill":"writing","family":"formal_argument",
    "public_material":{"instruction":"Escreva ao conselho municipal sobre uma proposta de cobrar pelo estacionamento no centro. Apresente sua posição, avalie benefícios e riscos e recomende salvaguardas.","objective":"Construir argumento equilibrado com recomendação concreta.","audience":"Conselho municipal.","word_count":{"min":180,"max":220}},
    "answer_key":{"required_moves":["declarar posição","avaliar benefícios","avaliar riscos","recomendar salvaguardas"],"genre":"carta formal de opinião"},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","coherence"],"dimensions":["task_completion","coherence","lexical_range","linguistic_control","register"]}
  },
  {
    "task_key":"b2.writing.audience_adaptation.v1","catalog_version":"2026.07.1","level":"B2","ceiling_level":"B2","skill":"writing","family":"audience_adaptation",
    "public_material":{"instruction":"Escreva um comunicado aos funcionários explicando uma nova política de compartilhamento de mesas. Reconheça preocupações, explique razões e dê orientações práticas.","objective":"Adaptar explicação e tom a um público profissional afetado por mudança.","audience":"Funcionários de uma empresa.","word_count":{"min":180,"max":220}},
    "answer_key":{"required_moves":["explicar mudança","justificar decisão","reconhecer preocupações","dar orientações práticas"],"genre":"comunicado interno"},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","coherence"],"dimensions":["task_completion","coherence","lexical_range","linguistic_control","register"]}
  },
  {
    "task_key":"b2.interaction.negotiate_outcome.v1","catalog_version":"2026.07.1","level":"B2","ceiling_level":"B2","skill":"interaction","family":"negotiate_outcome",
    "public_material":{"instruction":"Um fornecedor atrasará uma entrega essencial. Descubra as restrições, rejeite uma solução insuficiente, proponha alternativas e feche um acordo verificável.","objective":"Negociar resultado sob restrições e confirmar responsabilidades.","audience":"Representante de fornecedor.","turns":{"min":6,"max":8}},
    "answer_key":{"required_moves":["investigar restrições","avaliar proposta recebida","rejeitar com justificativa","propor alternativa","confirmar responsabilidades e prazo"],"partner_support":{"rephrases_allowed":0}},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","responsiveness"],"dimensions":["task_completion","responsiveness","turn_management","repair","comprehensibility","pragmatic_control"]}
  },
  {
    "task_key":"b2.interaction.manage_disagreement.v1","catalog_version":"2026.07.1","level":"B2","ceiling_level":"B2","skill":"interaction","family":"manage_disagreement",
    "public_material":{"instruction":"Um colega quer lançar um produto sem novo teste de acessibilidade para cumprir o prazo. Discorde, responda à pressão por velocidade e negocie um plano que proteja usuários e calendário.","objective":"Gerenciar desacordo profissional e construir solução de compromisso.","audience":"Colega responsável pelo lançamento.","turns":{"min":6,"max":8}},
    "answer_key":{"required_moves":["expressar desacordo adequado","explicar risco aos usuários","responder ao argumento de prazo","propor plano de compromisso","confirmar próximos passos"],"partner_support":{"rephrases_allowed":0}},
    "rubric":{"version":"fluency-rubric-v1","critical_dimensions":["task_completion","responsiveness"],"dimensions":["task_completion","responsiveness","turn_management","repair","comprehensibility","pragmatic_control"]}
  }
]
  $catalog$::jsonb
  ) as task(
    task_key text,
    catalog_version text,
    level text,
    ceiling_level text,
    skill text,
    family text,
    public_material jsonb,
    answer_key jsonb,
    rubric jsonb
  )
)
insert into private.fluency_task_catalog (
  task_key,
  catalog_version,
  task_type,
  skill,
  target_level,
  target_descriptor,
  task_family,
  prompt_version,
  public_material,
  answer_key,
  rubric,
  active
)
select
  task_key,
  catalog_version,
  case skill
    when 'listening' then 'unseen_listening'
    when 'speaking_spontaneous' then 'spontaneous_speaking'
    when 'writing' then 'writing'
    when 'interaction' then 'interaction'
  end,
  skill,
  level,
  public_material ->> 'objective',
  family,
  concat('seed-', catalog_version),
  public_material,
  answer_key,
  rubric,
  true
from seed
on conflict (task_key, catalog_version) do update
set
  task_type = excluded.task_type,
  skill = excluded.skill,
  target_level = excluded.target_level,
  target_descriptor = excluded.target_descriptor,
  task_family = excluded.task_family,
  prompt_version = excluded.prompt_version,
  public_material = excluded.public_material,
  answer_key = excluded.answer_key,
  rubric = excluded.rubric,
  active = excluded.active;
