// Importa o módulo Express para criar o servidor web
const express = require("express");
// Importa o Axios para fazer requisições HTTP (usado aqui para interagir com o Ollama/Gemma3)
const axios = require("axios");
// Carrega as variáveis de ambiente do arquivo .env
require("dotenv").config();

// Define a porta em que o servidor irá escutar.
// Tenta usar a variável de ambiente INSTRUCTIONS_AGENT_PORT, caso contrário, usa 3000.
const PORT = process.env.INSTRUCTIONS_AGENT_PORT || 3000;

// Cria uma instância do aplicativo Express
const app = express();

// Middleware para analisar corpos de requisição JSON
// Isso permite que o servidor receba dados JSON enviados em requisições POST
app.use(express.json());

/**
 * Endpoint POST para o Agente de Instruções.
 * Recebe uma requisição com um texto e o envia para um modelo de IA (Gemma3 via Ollama)
 * para gerar uma resposta.
 */
app.post("/ia", async (req, res) => {
  // Extrai o texto do corpo da requisição
  const { text } = req.body;

  // Verifica se o texto foi fornecido
  if (!text) {
    return res.status(400).send("Erro: 'text' é um parâmetro obrigatório.");
  }

  try {
    console.log(`Recebida solicitação de instrução: "${text}"`);
    let final_text =
      "Responda a mensagem como se fosse um agente de hortoterapia:" + text;
    // --- PARTE CRÍTICA: CHAMADA AO OLLAMA ---
    // Faz uma requisição POST para a API de geração de texto do Ollama.
    // O Ollama deve estar rodando localmente na porta 11434, ou em outro endereço conforme configurado.
    const ollamaApiUrl = process.env.OLLAMA_API_URL || "http://localhost:11434/api/generate";
    const ollamaModel = process.env.OLLAMA_MODEL || "gemma3";
    
    console.log(`Enviando solicitação para ${ollamaApiUrl} com modelo ${ollamaModel}`);
    
    const response = await axios.post(ollamaApiUrl, {
      model: ollamaModel, // <-- USA O MODELO ESPECIFICADO NAS VARIÁVEIS DE AMBIENTE
      prompt: final_text, // <-- ENVIA O TEXTO DO USUÁRIO COMO PROMPT
      stream: false, // Define para não receber a resposta em stream (recebe tudo de uma vez)
    }, {
      timeout: 120000 // Aumenta o timeout para 2 minutos, já que modelos grandes podem demorar para responder
    });

    // Loga a estrutura da resposta para debug
    console.log("Estrutura da resposta recebida:", JSON.stringify(response.data, null, 2).substring(0, 500) + "...");
    
    // Extrai a resposta gerada pela IA do Ollama
    const respData = response.data.response ? response.data.response.toString() : "Não foi possível obter uma resposta.";
    console.log(
      `Resposta gerada pela IA (Ollama/Gemma3): "${respData.substring(
        0,
        50
      )}..."`
    ); // Log para depuração

    // Envia a resposta da IA de volta ao cliente (o Bot do Telegram)
    res.send(respData);
  } catch (error) {
    console.error(
      "Erro ao comunicar com a API de geração de IA (Ollama):",
      error.message
    );
    
    // Log detalhado para debug
    if (error.response) {
      // A requisição foi feita e o servidor respondeu com um status de erro
      console.error("Detalhes da resposta de erro:", {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data
      });
    } else if (error.request) {
      // A requisição foi feita mas não recebeu resposta
      console.error("Nenhuma resposta recebida:", error.request);
    }
    
    // Em caso de erro, envia uma mensagem de erro ao cliente
    res
      .status(500)
      .send(
        `Erro ao gerar instrução com a IA (Ollama): ${error.message}. Verifique se o Ollama está rodando e o modelo 'gemma3' está disponível.`
      );
  }
});

// Inicia o servidor e o faz escutar na porta definida
app.listen(PORT, () => {
  console.log(`Servidor do Agente de Instruções rodando na porta ${PORT}`);
  console.log(
    `Este agente se comunica com a API Ollama em ${process.env.OLLAMA_API_URL || "http://localhost:11434/api/generate"} usando o modelo ${process.env.OLLAMA_MODEL || "gemma3"}`
  );
});
