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
const PORT = process.env.GOOGLE_TASKS_AGENT_PORT || 3002;

// Cria uma instância do aplicativo Express
const app = express();

// Middleware para analisar corpos de requisição JSON
app.use(express.json());

// --- Configurações OAuth 2.0 ---
// Obtém o ID do Cliente e o Segredo do Cliente das variáveis de ambiente
const CLIENT_ID = process.env.ID_CLIENT;
const SECRET_KEY = process.env.SECRET_KEY;
// URI de redirecionamento autorizado no seu projeto do Google Cloud Console.
// ESTE DEVE CORRESPONDER EXATAMENTE ao que você configurou lá.
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/oauth2callback`;

// Cria uma nova instância do cliente OAuth 2.0
const oAuth2Client = new OAuth2Client(CLIENT_ID, SECRET_KEY, REDIRECT_URI);

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

/**
 * Endpoint POST para adicionar uma tarefa ao Google Tasks.
 * Requer autenticação prévia.
 * Recebe um corpo JSON com { "taskName": "Nome da Tarefa", "tasklistId": "ID da Lista (opcional)" }.
 */
app.post("/add_task", async (req, res) => {
  const { taskName, tasklistId } = req.body; // Agora recebe tasklistId opcionalmente

  if (!taskName) {
    return res.status(400).send("Erro: 'taskName' é um parâmetro obrigatório.");
  }

  // Define o ID da lista de tarefas a ser usada.
  // Se tasklistId for fornecido, usa-o. Caso contrário, usa o ID da sua lista "As minhas tarefas".
  const targetTasklistId = tasklistId;

  try {
    // Cria uma instância do serviço Google Tasks API
    const tasks = google.tasks({ version: "v1", auth: oAuth2Client });

    // Insere a nova tarefa na lista de tarefas especificada
    const result = await tasks.tasks.insert({
      tasklist: targetTasklistId, // Usa o ID da lista de tarefas, ou o padrão
      requestBody: {
        title: taskName, // O título da tarefa
      },
    });

    console.log(
      `Tarefa adicionada: ${result.data.title} (ID: ${result.data.id}) na lista ${targetTasklistId}`
    );
    res
      .status(200)
      .send(
        `Tarefa "${result.data.title}" adicionada com sucesso ao Google Tasks na lista "${targetTasklistId}"!`
      );
  } catch (error) {
    console.error("Erro ao adicionar tarefa ao Google Tasks:", error.message);
    // Melhorar a mensagem de erro para o cliente
    if (error.code === 404 || error.message.includes("Invalid task list ID")) {
      res
        .status(400)
        .send(
          "Erro ao adicionar tarefa: ID da lista de tarefas inválido ou inacessível. Verifique suas listas no Google Tasks."
        );
    } else if (error.code === 401 || error.code === 403) {
      res
        .status(401)
        .send(
          "Erro de autenticação/permissão ao adicionar tarefa. Por favor, reautorize o aplicativo."
        );
    } else {
      res
        .status(500)
        .send(`Erro interno ao adicionar tarefa: ${error.message}`);
    }
  }
});

/**
 * Endpoint GET para listar as listas de tarefas do Google Tasks do usuário autenticado.
 * Requer autenticação prévia.
 */
app.get("/list_tasklists", async (req, res) => {
  try {
    const tasks = google.tasks({ version: "v1", auth: oAuth2Client });
    const result = await tasks.tasklists.list();
    const tasklists = result.data.items;

    if (!tasklists || tasklists.length === 0) {
      return res
        .status(200)
        .send(
          "Nenhuma lista de tarefas encontrada no Google Tasks para esta conta."
        );
    }

    const formattedLists = tasklists.map((list) => ({
      id: list.id,
      title: list.title,
    }));

    console.log("Listas de tarefas encontradas:", formattedLists);
    res.status(200).json(formattedLists); // Retorna um JSON com as listas
  } catch (error) {
    console.error(
      "Erro ao listar listas de tarefas do Google Tasks:",
      error.message
    );
    if (error.code === 401 || error.code === 403) {
      res
        .status(401)
        .send(
          "Erro de autenticação/permissão ao listar listas de tarefas. Por favor, reautorize o aplicativo."
        );
    } else {
      res
        .status(500)
        .send(`Erro interno ao listar listas de tarefas: ${error.message}`);
    }
  }
});

/**
 * Endpoint GET para listar as tarefas de uma lista específica do Google Tasks.
 * Requer autenticação prévia.
 * @param {string} tasklistId - O ID da lista de tarefas.
 */
app.get("/list_tasks/:tasklistId", async (req, res) => {
  const { tasklistId } = req.params; // Captura o ID da lista de tarefas da URL

  if (!tasklistId) {
    return res
      .status(400)
      .send("Erro: 'tasklistId' é um parâmetro obrigatório na URL.");
  }

  try {
    const tasks = google.tasks({ version: "v1", auth: oAuth2Client });
    // Chama a API para listar as tarefas dentro da tasklistId fornecida
    const result = await tasks.tasks.list({
      tasklist: tasklistId,
      showCompleted: false, // Opcional: para não mostrar tarefas completadas
      showHidden: false, // Opcional: para não mostrar tarefas ocultas
    });
    const items = result.data.items;

    if (!items || items.length === 0) {
      return res
        .status(200)
        .send(`Nenhuma tarefa encontrada na lista com ID '${tasklistId}'.`);
    }

    const formattedTasks = items.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      due: task.due, // Data de vencimento, se houver
    }));

    console.log(`Tarefas encontradas na lista ${tasklistId}:`, formattedTasks);
    res.status(200).json(formattedTasks); // Retorna um JSON com as tarefas
  } catch (error) {
    console.error(
      `Erro ao listar tarefas da lista '${tasklistId}' do Google Tasks:`,
      error.message
    );
    if (error.code === 404) {
      res
        .status(404)
        .send(`Erro: Lista de tarefas com ID '${tasklistId}' não encontrada.`);
    } else if (error.code === 401 || error.code === 403) {
      res
        .status(401)
        .send(
          "Erro de autenticação/permissão ao listar tarefas. Por favor, reautorize o aplicativo."
        );
    } else {
      res.status(500).send(`Erro interno ao listar tarefas: ${error.message}`);
    }
  }
});

/**
 * Endpoint POST para encontrar uma lista de tarefas pelo nome ou criá-la se não existir.
 * Requer autenticação prévia.
 * Recebe um corpo JSON com { "tasklistName": "Nome da Lista" }.
 * Retorna o ID da lista de tarefas.
 */
app.post("/find_or_create_tasklist", async (req, res) => {
  const { tasklistName } = req.body;

  if (!tasklistName) {
    return res
      .status(400)
      .send("Erro: 'tasklistName' é um parâmetro obrigatório.");
  }

  try {
    const tasks = google.tasks({ version: "v1", auth: oAuth2Client });

    // 1. Tentar encontrar a lista existente
    const listResult = await tasks.tasklists.list();
    const existingList = listResult.data.items
      ? listResult.data.items.find((list) => list.title === tasklistName)
      : null;

    if (existingList) {
      console.log(
        `Lista '${tasklistName}' encontrada com ID: ${existingList.id}`
      );
      return res
        .status(200)
        .json({
          id: existingList.id,
          title: existingList.title,
          created: false,
        });
    }

    // 2. Se não encontrou, criar a nova lista
    const newListResult = await tasks.tasklists.insert({
      requestBody: {
        title: tasklistName,
      },
    });

    console.log(
      `Lista '${tasklistName}' criada com ID: ${newListResult.data.id}`
    );
    res
      .status(201)
      .json({
        id: newListResult.data.id,
        title: newListResult.data.title,
        created: true,
      });
  } catch (error) {
    console.error(
      `Erro ao encontrar ou criar lista de tarefas '${tasklistName}':`,
      error.message
    );
    if (error.code === 401 || error.code === 403) {
      res
        .status(401)
        .send(
          "Erro de autenticação/permissão ao encontrar ou criar lista. Por favor, reautorize o aplicativo."
        );
    } else {
      res
        .status(500)
        .send(`Erro interno ao encontrar ou criar lista: ${error.message}`);
    }
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

  // --- LOGS DE DEPURAÇÃO MOVIDOS PARA CÁ ---
  // Agora as variáveis CLIENT_ID, SECRET_KEY e REDIRECT_URI já foram processadas
  console.log("--- DEBUG CREDENCIAIS ---");
  console.log(
    "CLIENT_ID carregado:",
    CLIENT_ID ? CLIENT_ID.substring(0, 10) + "..." : "NÃO CARREGADO"
  );
  console.log(
    "SECRET_KEY carregado:",
    SECRET_KEY ? SECRET_KEY.substring(0, 5) + "..." : "NÃO CARREGADO"
  );
  console.log("REDIRECT_URI usado:", REDIRECT_URI);
  console.log("--- FIM DEBUG CREDENCIAIS ---");
});