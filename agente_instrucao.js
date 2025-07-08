// Importa o módulo Express para criar o servidor web
const express = require("express");
// Importa o Axios para fazer requisições HTTP (usado aqui para interagir com o Ollama/Gemma3)
const axios = require("axios");
// Carrega as variáveis de ambiente do arquivo .env
require("dotenv").config();

// Define a porta em que o servidor irá escutar.
// Tenta usar a variável de ambiente INSTRUCTIONS_AGENT_PORT, caso contrário, usa 3000.
const PORT = 3000;

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
    // O Ollama deve estar rodando localmente na porta 11434.
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "gemma3", // <-- ESPECIFICA O MODELO GEMMA3
      prompt: final_text, // <-- ENVIA O TEXTO DO USUÁRIO COMO PROMPT
      stream: false, // Define para não receber a resposta em stream (recebe tudo de uma vez)
    });

    // Extrai a resposta gerada pela IA do Ollama
    const respData = response.data.response.toString();
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
    // Em caso de erro, envia uma mensagem de erro ao cliente
    res
      .status(500)
      .send(
        "Erro ao gerar instrução com a IA (Ollama). Verifique se o Ollama está rodando e o modelo 'gemma3' está disponível."
      );
  }
});

// Inicia o servidor e o faz escutar na porta definida
app.listen(PORT, () => {
  console.log(`Servidor do Agente de Instruções rodando na porta ${PORT}`);
  console.log(
    `Este agente se comunica com a API Ollama em http://localhost:11434`
  );
});
