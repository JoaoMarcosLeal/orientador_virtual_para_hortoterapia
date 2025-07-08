# Orientador Virtual para Hortoterapia

Um sistema de chatbot para orientação em hortoterapia, composto por um bot do Telegram que se comunica com agentes de IA local (Ollama/Gemma3) para fornecer instruções sobre o cultivo de plantas.

## Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 16 ou superior)
- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Telegram Bot Token](https://core.telegram.org/bots#botfather) (para o bot do Telegram)
- [Google Cloud Platform](https://console.cloud.google.com/) (opcional, apenas para funcionalidades do Google Tasks)

## Instalação

1. Clone o repositório:

   ```bash
   git clone https://github.com/JoaoMarcosLeal/orientador_virtual_para_hortoterapia.git
   cd orientador_virtual_para_hortoterapia
   ```

2. Instale as dependências:

   ```bash
   npm install
   ```

3. Configure o ambiente:
   - Copie o arquivo de exemplo de variáveis de ambiente:

     ```bash
     cp .env.example .env
     ```

   - Edite o arquivo `.env` e adicione suas credenciais (BOT_TOKEN do Telegram e outras configurações necessárias)

## Configurando o Ollama (Modelo de IA Local)

O projeto utiliza o Ollama para executar o modelo Gemma3 localmente, permitindo que o bot forneça orientações sem depender de serviços externos de IA.

1. Navegue até a pasta do container Ollama:

   ```bash
   cd ollama-container
   ```

2. Construa e inicie o container:

   ```bash
   docker-compose up -d
   ```

3. Aguarde enquanto o container baixa o modelo Gemma3 e inicia o servidor.
   - O download do modelo pode levar alguns minutos, dependendo da sua conexão com a internet.
   - O modelo ocupa aproximadamente 4-5GB de espaço em disco.

4. Verifique se o serviço está funcionando corretamente:

   ```bash
   curl http://localhost:11434/api/tags
   ```

   Isso deve retornar a lista de modelos disponíveis, incluindo o `gemma3`.

5. Volte para a pasta principal do projeto:

   ```bash
   cd ..
   ```

## Executando o Projeto

Após configurar as variáveis de ambiente e iniciar o container Ollama, você pode iniciar o projeto:

```bash
npm start
```

Isso iniciará o bot do Telegram e os serviços relacionados. O bot agora estará pronto para responder a mensagens no Telegram.

## Variáveis de Ambiente Necessárias

Para que o projeto funcione corretamente, as seguintes variáveis de ambiente devem estar configuradas no arquivo `.env`:

- `BOT_TOKEN`: Token do seu bot do Telegram (obrigatório)
- `INSTRUCTIONS_AGENT_PORT`: Porta para o serviço de instruções (padrão: 3000)
- `INSTRUCTIONS_AGENT_URL`: URL para o serviço de instruções (padrão: http://localhost:3000/ia)
- `OLLAMA_API_URL`: URL da API Ollama (padrão: http://localhost:11434/api/generate)
- `OLLAMA_MODEL`: Nome do modelo Ollama a ser usado (padrão: gemma3)

Para funcionalidades do Google Tasks (opcional):
- `ID_CLIENT`: ID do cliente do Google Cloud
- `SECRET_KEY`: Chave secreta do Google Cloud
- `GOOGLE_REDIRECT_URI`: URI de redirecionamento para autenticação OAuth

## Estrutura do Projeto

- `index.js`: Bot do Telegram e ponto de entrada principal
- `agente_instrucao.js`: Serviço que se comunica com o modelo Ollama para gerar respostas
- `agente_agendador.js`: Serviço que integra com o Google Tasks (opcional)
- `ollama-container/`: Configuração do Docker para o Ollama

## Testes

Para testar a conexão com o Ollama:

```bash
node teste-ollama.js
```
