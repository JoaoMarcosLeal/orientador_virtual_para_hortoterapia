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

// Cria uma nova instância do bot do Telegram usando o token do .env
const bot = new Telegraf(process.env.BOT_TOKEN);

// --- Comandos do Bot (devem vir ANTES do handler geral) ---

// Ouve o comando /start
bot.start(async (ctx) => {
  await ctx.reply(
    `Bem-vindo(a), ${ctx.from.first_name}! Eu sou seu orientador virtual de hortoterapia. Envie-me suas dúvidas ou use /help.`
  );
});

// Ouve o comando /ajuda
bot.help(async (ctx) => {
  await ctx.reply(
    "Comandos e funções disponíveis:\n/start - Iniciar a conversa\n/help - Ver esta mensagem de ajuda\n/info - Informações sobre o bot\n\nVocê pode me perguntar sobre 'instruções de rega', 'instruções de luz', ou 'como cuidar de uma planta'!"
  );
});

bot.command('info', async (ctx) => {
  await ctx.reply(
    "*Orientador Virtual de Hortoterapia*\n\n" +
    "Sou um assistente especializado em hortoterapia, powered by IA.\n\n" +
    "Como me usar:\n" +
    "• Faça perguntas sobre plantas e cuidados\n" +
    "• Use /help para ver todos os comandos\n\n" +
    "Desenvolvido para ajudar no seu bem-estar através das plantas!",
    { parse_mode: 'Markdown' }
  );
});

// --- Lógica de Resposta e Comunicação com Agente de Instruções ---

/**
 * Ouve por qualquer mensagem de texto enviada ao bot.
 * Encaminha a solicitação para o Agente de Instruções se for relevante.
 */
bot.on(message("text"), async (ctx) => {
  const textoRecebido = ctx.message.text; // Armazena o texto da mensagem
  const chatId = ctx.chat.id; // ID do chat para o qual responder
  const userId = ctx.from.id; // ID do usuário

  console.log(
    `Mensagem de texto recebida de ${ctx.from.first_name} (${chatId}): "${textoRecebido}"`
  );

  // Verifica se a mensagem é um comando (começa com /)
  if (textoRecebido.startsWith('/')) {
    return; // Não processa comandos aqui, eles são tratados pelos handlers específicos
  }

  // Se chegou até aqui, é uma mensagem normal que deve ser enviada para a IA
  if (textoRecebido && textoRecebido.trim().length > 0) {
    await ctx.reply(
      "Sua solicitação de instrução foi enviada para o orientador. Aguarde a resposta da IA..."
    );
    try {
      // Faz uma requisição POST para o Agente de Instruções
      // O corpo da requisição é um objeto JSON com a propriedade 'text'
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
      "Recebi sua mensagem! Envie-me uma pergunta sobre hortoterapia para que eu possa ajudá-lo. Use /ajuda para ver os comandos disponíveis."
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
