// Importa o módulo Express para criar o servidor web
const express = require("express");
// Importa o Axios (não diretamente usado para Google API, mas útil para outros HTTP se necessário)
const axios = require("axios");
// Importa as bibliotecas do Google para interagir com as APIs
const { google } = require("googleapis");
// Importa a classe OAuth2Client para autenticação OAuth 2.0
const { OAuth2Client } = require("google-auth-library");
// Carrega as variáveis de ambiente do arquivo .env
require("dotenv").config();

// Define a porta em que o servidor irá escutar.
// Tenta usar a variável de ambiente GOOGLE_TASKS_AGENT_PORT, caso contrário, usa 3002.
const PORT = 3002;

// Cria uma instância do aplicativo Express
const app = express();

// Middleware para analisar corpos de requisição JSON
app.use(express.json());

// --- Configurações OAuth 2.0 ---
// Obtém o ID do Cliente e o Segredo do Cliente das variáveis de ambiente
const CLIENT_ID = process.env.ID_CLIENT;
const CLIENT_SECRET = process.env.SECRET_KEY;
// URI de redirecionamento autorizado no seu projeto do Google Cloud Console.
// ESTE DEVE CORRESPONDER EXATAMENTE ao que você configurou lá.
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/oauth2callback`;

// Cria uma nova instância do cliente OAuth 2.0
const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Variável para armazenar os tokens de acesso e atualização do Google.
// ATENÇÃO: Em um ambiente de produção, esses tokens DEVERIAM ser persistidos
// em um banco de dados seguro, e não apenas em memória.
let googleTokens = null;

// --- Rotas de Autenticação OAuth 2.0 ---

/**
 * Endpoint para iniciar o fluxo de autenticação OAuth 2.0.
 * O usuário será redirecionado para a página de consentimento do Google.
 */
app.get("/authorize", (req, res) => {
  // Gera a URL de autorização.
  // 'offline' para obter um refresh_token (necessário para obter novos access_tokens sem reautenticar).
  // O 'scope' define as permissões que seu aplicativo solicita (acesso total ao Google Tasks).
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/tasks"],
  });
  console.log("Redirecionando para autorização Google:", authUrl);
  res.redirect(authUrl); // Redireciona o navegador do usuário
});

/**
 * Endpoint de callback para o OAuth 2.0.
 * O Google redireciona o usuário para cá após a autorização, com um código.
 */
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code; // O código de autorização fornecido pelo Google

  if (!code) {
    console.error("Erro: Código de autorização não recebido.");
    return res.status(400).send("Erro: Código de autorização não recebido.");
  }

  try {
    // Troca o código de autorização por tokens de acesso e atualização
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens); // Define as credenciais no cliente OAuth
    googleTokens = tokens; // Armazena os tokens (em memória, para este exemplo)

    console.log(
      "Autenticação com Google Tasks bem-sucedida! Tokens recebidos."
    );
    // Em produção, aqui você salvaria 'tokens.refresh_token' em um DB seguro.
    res
      .status(200)
      .send(
        "Autenticação com Google Tasks bem-sucedida! Você pode fechar esta página e usar o bot."
      );
  } catch (error) {
    console.error("Erro ao obter tokens do Google:", error.message);
    res
      .status(500)
      .send(
        "Erro na autenticação com Google Tasks. Verifique os logs do servidor."
      );
  }
});

// Middleware para verificar autenticação antes de acessar endpoints de tarefas
app.use(async (req, res, next) => {
  // Se a rota for de autorização ou callback, pule a verificação
  if (req.path === "/authorize" || req.path === "/oauth2callback") {
    return next();
  }

  // Se não houver tokens, ou se o access_token estiver expirado e não houver refresh_token,
  // o usuário precisa reautenticar.
  if (
    !googleTokens ||
    (!oAuth2Client.credentials.access_token &&
      !oAuth2Client.credentials.refresh_token)
  ) {
    return res
      .status(401)
      .send(
        "Erro: Autenticação com Google Tasks necessária. Por favor, acesse /authorize para iniciar a autenticação."
      );
  }

  // Tenta refrescar o token se ele estiver expirado
  if (oAuth2Client.isTokenExpired && oAuth2Client.credentials.refresh_token) {
    try {
      const { credentials } = await oAuth2Client.refreshAccessToken();
      oAuth2Client.setCredentials(credentials);
      googleTokens = credentials; // Atualiza os tokens em memória
      console.log("Access token do Google Tasks atualizado.");
    } catch (refreshError) {
      console.error(
        "Erro ao refrescar o token do Google Tasks:",
        refreshError.message
      );
      return res
        .status(401)
        .send(
          "Erro: Falha ao refrescar o token. Por favor, reautentique o aplicativo em /authorize."
        );
    }
  } else if (
    !oAuth2Client.credentials.access_token &&
    oAuth2Client.credentials.refresh_token
  ) {
    // Se não há access_token mas há refresh_token (primeira inicialização ou reinício do servidor)
    try {
      const { credentials } = await oAuth2Client.refreshAccessToken();
      oAuth2Client.setCredentials(credentials);
      googleTokens = credentials;
      console.log("Access token do Google Tasks obtido via refresh token.");
    } catch (initialRefreshError) {
      console.error(
        "Erro ao obter access token inicial com refresh token:",
        initialRefreshError.message
      );
      return res
        .status(401)
        .send(
          "Erro: Falha ao obter token inicial. Por favor, reautentique o aplicativo em /authorize."
        );
    }
  }

  next(); // Continua para a próxima rota
});

// --- Endpoint para Adicionar Tarefa ---

/**
 * Endpoint POST para adicionar uma tarefa ao Google Tasks.
 * Requer autenticação prévia.
 * Recebe um corpo JSON com { "taskName": "Nome da Tarefa" }.
 */
app.post("/add_task", async (req, res) => {
  const { taskName } = req.body;

  if (!taskName) {
    return res.status(400).send("Erro: 'taskName' é um parâmetro obrigatório.");
  }

  try {
    // Cria uma instância do serviço Google Tasks API
    const tasks = google.tasks({ version: "v1", auth: oAuth2Client });

    // Insere a nova tarefa na lista de tarefas padrão do usuário ('@me')
    const result = await tasks.tasks.insert({
      tasklist: "@me", // '@me' refere-se à lista de tarefas padrão do usuário autenticado
      requestBody: {
        title: taskName, // O título da tarefa
      },
    });

    console.log(
      `Tarefa adicionada: ${result.data.title} (ID: ${result.data.id})`
    );
    res
      .status(200)
      .send(
        `Tarefa "${result.data.title}" adicionada com sucesso ao Google Tasks!`
      );
  } catch (error) {
    console.error("Erro ao adicionar tarefa ao Google Tasks:", error.message);
    res
      .status(500)
      .send(
        `Erro ao adicionar tarefa: ${error.message}. Verifique a autenticação e permissões.`
      );
  }
});

// --- Inicialização do Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor do Agente Google Tasks rodando na porta ${PORT}`);
  console.log(
    `Para autorizar o aplicativo com o Google Tasks, acesse: http://localhost:${PORT}/authorize`
  );
  console.log(
    `Certifique-se de que '${REDIRECT_URI}' está configurado como um URI de redirecionamento autorizado no Google Cloud Console.`
  );
});
