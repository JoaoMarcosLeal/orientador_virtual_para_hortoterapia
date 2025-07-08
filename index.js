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

// --- Lógica de Resposta e Comunicação com Agente de Instruções ---

/**
 * Ouve por qualquer mensagem de texto enviada ao bot.
 * Encaminha a solicitação para o Agente de Instruções se for relevante.
 */
bot.on(message("text"), async (ctx) => {
  const textoRecebido = ctx.message.text; // Armazena o texto da mensagem
  const chatId = ctx.chat.id; // ID do chat para o qual responder

  console.log(
    `Mensagem de texto recebida de ${ctx.from.first_name} (${chatId}): "${textoRecebido}"`
  );

  // Verifica se a mensagem contém palavras-chave para acionar o Agente de Instruções
  // Você pode refinar essas palavras-chave conforme a necessidade do seu projeto.
  if (textoRecebido) {
    // Adicionei "cuidar" como exemplo

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
    // Resposta padrão se nenhuma condição for atendida
    await ctx.reply(
      "Recebi sua mensagem! Ainda estou aprendendo sobre isso, mas logo serei um ótimo orientador de hortoterapia. Tente perguntar sobre 'instruções de rega' ou 'como cuidar de uma planta'."
    );
  }
});

// Ouve o comando /start
bot.start(async (ctx) => {
  await ctx.reply(
    `Bem-vindo(a), ${ctx.from.first_name}! Eu sou seu orientador virtual de hortoterapia. Envie-me suas dúvidas ou use /ajuda.`
  );
});

// Ouve o comando /ajuda
bot.help(async (ctx) => {
  await ctx.reply(
    "Comandos e funções disponíveis:\n/start - Iniciar a conversa\n/help ou /ajuda - Ver esta mensagem de ajuda\n\nVocê pode me perguntar sobre 'instruções de rega', 'instruções de luz', ou 'como cuidar de uma planta'!"
  );
});

// --- Inicialização do Bot ---

// Inicia o bot
bot.launch();

// Garante o fechamento suave do bot em caso de interrupção (Ctrl+C)
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

console.log("Bot do Telegram rodando....");
