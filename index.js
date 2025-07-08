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

// Cria uma nova instância do bot do Telegram usando o token do .env
const bot = new Telegraf(process.env.BOT_TOKEN);

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
    "Comandos e funções disponíveis:\n/start - Iniciar a conversa\n/help - Ver esta mensagem de ajuda\n/info - Informações sobre o bot\n/adicionarTarefa [nome da tarefa] - Adiciona uma tarefa ao Google Tasks\n\nVocê pode me perguntar sobre 'instruções de rega', 'instruções de luz', ou 'como cuidar de uma planta'!"
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
 * Extrai o nome da tarefa e a envia para o Agente Google Tasks.
 */
bot.command("adicionarTarefa", async (ctx) => {
  // Extrai o texto da mensagem após o comando /adicionarTarefa
  const taskName = ctx.message.text.substring("/adicionarTarefa".length).trim();

  // Verifica se o nome da tarefa foi fornecido
  if (!taskName) {
    return await ctx.reply(
      "Por favor, forneça o nome da tarefa. Ex: /adicionarTarefa Comprar adubo"
    );
  }

  await ctx.reply(`Adicionando "${taskName}" ao Google Tasks...`);
  try {
    // Faz uma requisição POST para o Agente Google Tasks
    // O endpoint para adicionar tarefa é /add_task
    const response = await axios.post(`${GOOGLE_TASKS_AGENT_URL}/add_task`, {
      taskName: taskName, // Envia o nome da tarefa no corpo da requisição JSON
    });
    // Envia a resposta do Agente Google Tasks de volta para o usuário
    await ctx.reply(response.data);
  } catch (error) {
    console.error("Erro ao chamar o Agente Google Tasks:", error.message);

    // Tratamento para autenticação
    if (
      error.response &&
      error.response.status === 401 &&
      error.response.data.includes("Autenticação com Google Tasks necessária")
    ) {
      const authLink = `${GOOGLE_TASKS_AGENT_URL}/authorize`;
      await ctx.reply(
        `Não consegui adicionar a tarefa. Parece que o Agente Google Tasks não está autenticado com sua conta Google.\n\n` +
          `Por favor, clique no link abaixo para autorizar o aplicativo:\n` +
          `[Autenticar Google Tasks](${authLink})\n\n` +
          `Após a autenticação, tente novamente.`
      );
    } else if (error.response && error.response.data) {
      await ctx.reply(
        `Erro ao adicionar tarefa: ${error.response.data}. Por favor, verifique se o Agente Google Tasks está rodando.`
      );
    } else {
      await ctx.reply(
        "Desculpe, não consegui adicionar a tarefa no momento. Verifique se o Agente Google Tasks está rodando e acessível."
      );
    }
  }
});

/**
 * Ouve o comando /listarTarefas.
 * Extrai o ID da lista e solicita as tarefas ao Agente Google Tasks.
 */
bot.command("listarTarefas", async (ctx) => {
  // Extrai o ID da lista de tarefas da mensagem
  const tasklistId = ctx.message.text.substring("/listarTarefas".length).trim();

  // Verifica se o ID da lista foi fornecido
  if (!tasklistId) {
    return await ctx.reply(
      "Por favor, forneça o ID da lista de tarefas. Ex: /listarTarefas MDU5NzU1MDQyNzgwNjAyNjE2NjU6MDow"
    );
  }

  await ctx.reply(`Buscando tarefas da lista "${tasklistId}"...`);
  try {
    // Faz uma requisição GET para o Agente Google Tasks
    // O endpoint para listar tarefas é /list_tasks/:tasklistId
    const response = await axios.get(
      `${GOOGLE_TASKS_AGENT_URL}/list_tasks/${tasklistId}`
    );
    const tasks = response.data; // A resposta é um array de tarefas

    if (
      typeof tasks === "string" &&
      tasks.includes("Nenhuma tarefa encontrada")
    ) {
      await ctx.reply(tasks); // Mensagem de que não há tarefas
    } else if (Array.isArray(tasks) && tasks.length > 0) {
      let replyMessage = `*Tarefas na lista '${tasklistId}':*\n\n`;
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
      await ctx.reply(
        `Nenhuma tarefa encontrada na lista com ID '${tasklistId}'.`
      );
    }
  } catch (error) {
    console.error(
      "Erro ao chamar o Agente Google Tasks para listar tarefas:",
      error.message
    );

    // Tratamento de erro para autenticação
    if (
      error.response &&
      error.response.status === 401 &&
      error.response.data.includes("Autenticação com Google Tasks necessária")
    ) {
      const authLink = `${GOOGLE_TASKS_AGENT_URL}/authorize`;
      await ctx.reply(
        `Não consegui listar as tarefas. Parece que o Agente Google Tasks não está autenticado com sua conta Google.\n\n` +
          `Por favor, clique no link abaixo para autorizar o aplicativo:\n` +
          `[Autenticar Google Tasks](${authLink})\n\n` +
          `Após a autenticação, tente novamente.`
      );
    } else if (error.response && error.response.data) {
      await ctx.reply(
        `Erro ao listar tarefas: ${error.response.data}. Por favor, verifique se o Agente Google Tasks está rodando.`
      );
    } else {
      await ctx.reply(
        "Desculpe, não consegui listar as tarefas no momento. Verifique se o Agente Google Tasks está rodando e acessível."
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