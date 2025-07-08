// Carrega as variáveis de ambiente do arquivo .env
require("dotenv").config();

// Carrega as classes Telegraf e message
const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");
// Importa o Axios para fazer requisições HTTP para os agentes de IA
const axios = require("axios");

// URL do seu Agente de Instruções (certifique-se de que a porta corresponde à que você definiu)
// Por padrão, o Agente de Instruções roda na porta 3000 e tem o endpoint /ia
const INSTRUCTIONS_AGENT_URL =
  process.env.INSTRUCTIONS_AGENT_URL || "http://localhost:3000/ia";

// URL do seu Agente Google Tasks (certifique-se de que a porta corresponde à que você definiu)
// Por padrão, o Agente Google Tasks roda na porta 3002 e o endpoint para adicionar tarefa é /add_task
const GOOGLE_TASKS_AGENT_URL =
  process.env.GOOGLE_TASKS_AGENT_URL || "http://localhost:3002"; // URL base do agente

// Nome da lista de tarefas específica para hortoterapia
const HORTOTERAPIA_TASKLIST_NAME = "Hortoterapia";

// Cria uma nova instância do bot do Telegram usando o token do .env
const bot = new Telegraf(process.env.BOT_TOKEN);

// --- Funções Auxiliares ---

/**
 * Função para encontrar ou criar a lista de tarefas "Hortoterapia"
 * e retornar seu ID.
 * @param {object} ctx - O objeto de contexto do Telegraf para responder ao usuário.
 * @returns {Promise<string|null>} O ID da lista "Hortoterapia" ou null em caso de erro.
 */
async function getHortoterapiaTasklistId(ctx) {
  try {
    // Faz uma requisição POST para o Agente Google Tasks para encontrar ou criar a lista
    const response = await axios.post(
      `${GOOGLE_TASKS_AGENT_URL}/find_or_create_tasklist`,
      {
        tasklistName: HORTOTERAPIA_TASKLIST_NAME,
      }
    );
    // Retorna o ID da lista obtido na resposta
    return response.data.id;
  } catch (error) {
    console.error("Erro ao obter/criar lista 'Hortoterapia':", error.message);
    // Tratamento de erro para autenticação (se o agente retornar 401)
    if (
      error.response &&
      error.response.status === 401 &&
      error.response.data.includes("Autenticação com Google Tasks necessária")
    ) {
      const authLink = `${GOOGLE_TASKS_AGENT_URL}/authorize`;
      await ctx.reply(
        `Para gerenciar tarefas de hortoterapia, o Agente Google Tasks precisa ser autenticado.\n\n` +
          `Por favor, clique no link abaixo para autorizar o aplicativo:\n` +
          `[Autenticar Google Tasks](${authLink})\n\n` +
          `Após a autenticação, tente novamente.`
      );
    } else if (error.response && error.response.data) {
      // Outros erros retornados pelo agente
      await ctx.reply(
        `Erro: ${error.response.data}. Não foi possível acessar a lista de tarefas de hortoterapia.`
      );
    } else {
      // Erros de conexão ou outros erros desconhecidos
      await ctx.reply(
        "Desculpe, não consegui preparar a lista de tarefas de hortoterapia no momento. Verifique se o Agente Google Tasks está rodando."
      );
    }
    return null; // Retorna null para indicar que o ID não pôde ser obtido
  }
}

// --- Comandos do Bot ---

// Ouve o comando /start
bot.start(async (ctx) => {
  await ctx.reply(
    `Bem-vindo(a), ${ctx.from.first_name}! Eu sou seu orientador virtual de hortoterapia. Envie-me suas dúvidas ou use /help.`
  );
});

// Ouve o comando /help
bot.help(async (ctx) => {
  await ctx.reply(
    "Comandos e funções disponíveis:\n/start - Iniciar a conversa\n/help - Ver esta mensagem de ajuda\n/info - Informações sobre o bot\n/adicionarTarefa [nome da tarefa] - Adiciona uma tarefa à lista 'Hortoterapia' do Google Tasks\n/listarTarefas - Lista as tarefas da sua lista 'Hortoterapia' do Google Tasks\n\nVocê pode me perguntar sobre 'instruções de rega', 'instruções de luz', ou 'como cuidar de uma planta'!"
  );
});

// Ouve o comando /info
bot.command("info", async (ctx) => {
  await ctx.reply(
    "*Orientador Virtual de Hortoterapia*\n\n" +
      "Sou um assistente especializado em hortoterapia, powered by IA.\n\n" +
      "Como me usar:\n" +
      "• Faça perguntas sobre plantas e cuidados\n" +
      "• Use /help para ver todos os comandos\n\n" +
      "Desenvolvido para ajudar no seu bem-estar através das plantas!",
    { parse_mode: "Markdown" }
  );
});

/**
 * Ouve o comando /adicionarTarefa.
 * Extrai o nome da tarefa e a envia para o Agente Google Tasks, na lista "Hortoterapia".
 */
bot.command("adicionarTarefa", async (ctx) => {
  const taskName = ctx.message.text.substring("/adicionarTarefa".length).trim();

  if (!taskName) {
    return await ctx.reply(
      "Por favor, forneça o nome da tarefa. Ex: /adicionarTarefa Comprar adubo"
    );
  }

  // A PRIMEIRA COISA: Obter o ID da lista "Hortoterapia" (encontra ou cria)
  const hortoterapiaTasklistId = await getHortoterapiaTasklistId(ctx);
  if (!hortoterapiaTasklistId) {
    return; // A função auxiliar já tratou o erro e notificou o usuário
  }

  await ctx.reply(
    `Adicionando "${taskName}" à lista '${HORTOTERAPIA_TASKLIST_NAME}'...`
  );
  try {
    // Faz uma requisição POST para o Agente Google Tasks, passando o ID da lista
    const response = await axios.post(`${GOOGLE_TASKS_AGENT_URL}/add_task`, {
      taskName: taskName,
      tasklistId: hortoterapiaTasklistId, // Passa o ID da lista "Hortoterapia"
    });
    await ctx.reply(response.data); // Envia a resposta do agente de volta ao usuário
  } catch (error) {
    console.error(
      "Erro ao chamar o Agente Google Tasks para adicionar tarefa:",
      error.message
    );
    // O tratamento de autenticação já foi feito em getHortoterapiaTasklistId.
    // Aqui, tratamos outros erros que o agente possa retornar.
    if (error.response && error.response.data) {
      await ctx.reply(`Erro ao adicionar tarefa: ${error.response.data}.`);
    } else {
      await ctx.reply(
        "Desculpe, não consegui adicionar a tarefa no momento. Verifique se o Agente Google Tasks está rodando e acessível."
      );
    }
  }
});

/**
 * Ouve o comando /listarTarefas.
 * Lista as tarefas da lista "Hortoterapia" do Google Tasks.
 */
bot.command("listarTarefas", async (ctx) => {
  await ctx.reply(
    `Buscando tarefas da sua lista '${HORTOTERAPIA_TASKLIST_NAME}'...`
  );

  // A PRIMEIRA COISA: Obter o ID da lista "Hortoterapia" (encontra ou cria)
  const hortoterapiaTasklistId = await getHortoterapiaTasklistId(ctx);
  if (!hortoterapiaTasklistId) {
    return; // A função auxiliar já tratou o erro e notificou o usuário
  }

  try {
    // Faz uma requisição GET para o Agente Google Tasks, passando o ID da lista
    const response = await axios.get(
      `${GOOGLE_TASKS_AGENT_URL}/list_tasks/${hortoterapiaTasklistId}`
    );
    const tasks = response.data; // A resposta é um array de tarefas

    // Verifica o tipo da resposta para formatar corretamente
    if (
      typeof tasks === "string" &&
      tasks.includes("Nenhuma tarefa encontrada")
    ) {
      await ctx.reply(tasks); // Mensagem de que não há tarefas (se o agente retornar uma string)
    } else if (Array.isArray(tasks) && tasks.length > 0) {
      let replyMessage = `*Tarefas na sua lista '${HORTOTERAPIA_TASKLIST_NAME}':*\n\n`;
      tasks.forEach((task) => {
        replyMessage += `• ${task.title} (Status: ${task.status}`;
        if (task.due) {
          replyMessage += `, Vencimento: ${new Date(
            task.due
          ).toLocaleDateString("pt-BR")}`;
        }
        replyMessage += `)\n`;
      });
      await ctx.reply(replyMessage, { parse_mode: "Markdown" });
    } else {
      // Caso o array esteja vazio ou a resposta não seja a esperada
      await ctx.reply(
        `Nenhuma tarefa encontrada na lista '${HORTOTERAPIA_TASKLIST_NAME}'.`
      );
    }
  } catch (error) {
    console.error(
      "Erro ao chamar o Agente Google Tasks para listar tarefas:",
      error.message
    );
    // O tratamento de autenticação já foi feito em getHortoterapiaTasklistId.
    // Aqui, tratamos outros erros que o agente possa retornar.
    if (error.response && error.response.data) {
      await ctx.reply(`Erro ao listar tarefas: ${error.response.data}.`);
    } else {
      await ctx.reply(
        "Desculpe, não consegui listar as tarefas no momento. Verifique se o Agente Google Tasks está rodando e acessível."
      );
    }
  }
});

/**
 * Ouve o comando /criarRotina.
 * Solicita 5 tarefas de hortoterapia ao Agente de Instruções e as adiciona ao Google Tasks.
 */
bot.command("criarRotina", async (ctx) => {
  await ctx.reply(
    "Gerando sua rotina diária de hortoterapia... Isso pode levar um momento."
  );

  // 1. Obter o ID da lista "Hortoterapia" (encontra ou cria)
  const hortoterapiaTasklistId = await getHortoterapiaTasklistId(ctx);
  if (!hortoterapiaTasklistId) {
    return; // A função auxiliar já tratou o erro e notificou o usuário
  }

  try {
    // 2. Solicitar 5 tarefas de hortoterapia ao Agente de Instruções (LLM)
    const promptParaIA =
      "Gere uma lista de 5 tarefas diárias concisas e práticas para hortoterapia. Formate como uma lista numerada, por exemplo:\n1. Regar as plantas.\n2. Verificar pragas.\n...";

    const iaResponse = await axios.post(INSTRUCTIONS_AGENT_URL, {
      text: promptParaIA,
    });
    const rotinaTexto = iaResponse.data;
    console.log("Rotina de IA recebida:\n", rotinaTexto);

    // 3. Parsear a resposta para extrair as tarefas
    // Assume que a IA retorna uma lista numerada ou com bullet points
    const tasksRaw = rotinaTexto
      .split("\n")
      .filter((line) => line.trim().length > 0);
    const tasksToAddTask = [];

    tasksRaw.forEach((line) => {
      // Remove números e pontos (ex: "1. ", "2. ") ou bullet points ("- ", "* ")
      const cleanedTask = line.replace(/^\s*\d+\.\s*|^[\*\-]\s*/, "").trim();
      if (cleanedTask.length > 0) {
        tasksToAddTask.push(cleanedTask);
      }
    });

    // Limita a um máximo de 5 tarefas, caso a IA gere mais
    const finalTasks = tasksToAddTask.slice(0, 5);

    if (finalTasks.length === 0) {
      await ctx.reply(
        "Não consegui gerar tarefas válidas a partir da rotina da IA. Tente novamente."
      );
      return;
    }

    await ctx.reply(
      `Gerando ${finalTasks.length} tarefas para sua rotina. Adicionando ao Google Tasks...`
    );
    let addedTasksCount = 0;
    let failedTasks = [];

    // 4. Adicionar cada tarefa ao Google Tasks
    for (const taskName of finalTasks) {
      try {
        await axios.post(`${GOOGLE_TASKS_AGENT_URL}/add_task`, {
          taskName: taskName,
          tasklistId: hortoterapiaTasklistId,
        });
        addedTasksCount++;
        console.log(`Tarefa "${taskName}" adicionada com sucesso.`);
      } catch (addTaskError) {
        console.error(
          `Falha ao adicionar tarefa "${taskName}":`,
          addTaskError.message
        );
        failedTasks.push(taskName);
      }
    }

    if (addedTasksCount > 0) {
      let successMessage = `Sua rotina diária de hortoterapia foi criada com sucesso! ${addedTasksCount} tarefa(s) adicionada(s) à lista '${HORTOTERAPIA_TASKLIST_NAME}'.`;
      if (failedTasks.length > 0) {
        successMessage += `\n\n*Atenção:* Não foi possível adicionar as seguintes tarefas: ${failedTasks.join(
          ", "
        )}.`;
      }
      await ctx.reply(successMessage, { parse_mode: "Markdown" });
    } else {
      await ctx.reply(
        "Não foi possível adicionar nenhuma tarefa à sua rotina. Verifique os logs para mais detalhes."
      );
    }
  } catch (error) {
    console.error("Erro ao criar rotina:", error.message);
    // Tratamento de erro para autenticação do Google Tasks já é feito por getHortoterapiaTasklistId
    // Tratamento de erro para o Agente de Instruções
    if (error.response && error.response.data) {
      await ctx.reply(
        `Erro ao gerar rotina: ${error.response.data}. Verifique se o Agente de Instruções está rodando.`
      );
    } else {
      await ctx.reply(
        "Desculpe, não consegui criar sua rotina no momento. Verifique se o Agente de Instruções e o Agente Google Tasks estão rodando e acessíveis."
      );
    }
  }
});

/**
 * Ouve por qualquer mensagem de texto enviada ao bot que não seja um comando.
 * Encaminha a solicitação para o Agente de Instruções se for relevante.
 */
bot.on(message("text"), async (ctx) => {
  const textoRecebido = ctx.message.text; // Armazena o texto da mensagem
  const chatId = ctx.chat.id; // ID do chat para o qual responder

  console.log(
    `Mensagem de texto recebida de ${ctx.from.first_name} (${chatId}): "${textoRecebido}"`
  );

  // Verifica se a mensagem é um comando (começa com /)
  if (textoRecebido.startsWith("/")) {
    return; // Não processa comandos aqui, eles são tratados pelos handlers específicos
  }

  // Se chegou até aqui, é uma mensagem normal que deve ser enviada para a IA de instruções
  if (textoRecebido && textoRecebido.trim().length > 0) {
    await ctx.reply(
      "Sua solicitação de instrução foi enviada para o orientador. Aguarde a resposta da IA..."
    );
    try {
      // Faz uma requisição POST para o Agente de Instruções
      const response = await axios.post(INSTRUCTIONS_AGENT_URL, {
        text: textoRecebido, // Envia o texto da mensagem do usuário como prompt para a IA
      });
      // Envia a resposta do Agente de Instruções de volta para o usuário no Telegram
      await ctx.reply(`Instrução do Orientador: ${response.data}`);
    } catch (error) {
      console.error("Erro ao chamar o Agente de Instruções:", error.message);
      // Mensagem de erro para o usuário caso o agente não responda ou ocorra um problema
      await ctx.reply(
        "Desculpe, não consegui obter as instruções no momento. Por favor, tente novamente mais tarde ou verifique se o Agente de Instruções está rodando."
      );
    }
  } else {
    // Resposta padrão se a mensagem estiver vazia
    await ctx.reply(
      "Recebi sua mensagem! Envie-me uma pergunta sobre hortoterapia para que eu possa ajudá-lo. Use /help para ver os comandos disponíveis."
    );
  }
});

// --- Inicialização do Bot ---

// Inicia o bot
bot.launch();

// Garante o fechamento suave do bot em caso de interrupção (Ctrl+C)
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

console.log("Bot do Telegram rodando....");
