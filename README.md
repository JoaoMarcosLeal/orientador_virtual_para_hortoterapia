# Orientador Virtual para Hortoterapia

Um sistema de chatbot para orientação em hortoterapia, composto por um bot do Telegram integrado a agentes locais de IA (Ollama/Gemma3), que fornece instruções sobre cultivo de plantas e gerenciamento de tarefas terapêuticas. O sistema utiliza uma arquitetura modular com serviços locais para garantir privacidade e autonomia.

## Propósito e Relevância

O projeto visa resolver problemas identificados em grandes centros urbanos, onde pessoas com mobilidade reduzida ou necessidades especiais encontram dificuldades de acesso a locais apropriados para praticar hortoterapia. Conforme destacado pela reportagem da CNN ["Gardening becomes healing with horticultural therapy"](https://edition.cnn.com/2018/08/03/health/sw-horticultural-therapy/index.html?utm_source=chatgpt.com), é essencial oferecer informações e orientações acessíveis por meio de plataformas digitais como o Telegram.

Projetos como o ["Hortoterapia: cuidando do corpo e da alma"](https://g1.globo.com/pe/petrolina-regiao/noticia/2019/02/02/projeto-do-if-sertao-pe-utiliza-a-horticultura-como-terapia-ocupacional.ghtml) do IF Sertão-PE demonstram como a horticultura é efetiva na terapia ocupacional, beneficiando a saúde mental e física. Da mesma forma, iniciativas da [APAE de Lavras](https://ufla.br/noticias/extensao/15183-projeto-de-extensao-utiliza-a-hortoterapia-como-ferramenta-de-inclusao-social-de-assistidos-da-associacao-de-pais-e-amigos-dos-excepcionais-apae-de-lavras) e estudos voltados para idosos comprovam benefícios como redução de ansiedade, melhoria da concentração e satisfação geral com a vida.

## Pré-requisitos

* [Node.js](https://nodejs.org/) (v16+)
* [Docker](https://www.docker.com/get-started) e [Docker Compose](https://docs.docker.com/compose/install/)
* [Telegram Bot Token](https://core.telegram.org/bots#botfather)
* [Google Cloud Platform](https://console.cloud.google.com/) (opcional, para Google Tasks)

## Instalação e Configuração

1. **Clone o repositório:**

   ```bash
   git clone https://github.com/JoaoMarcosLeal/orientador_virtual_para_hortoterapia.git
   cd orientador_virtual_para_hortoterapia
   ```

2. **Instale as dependências:**

   ```bash
   npm install
   ```

3. **Configuração das variáveis de ambiente:**

   ```bash
   cp .env.example .env
   ```

   * Edite o arquivo `.env`, incluindo `BOT_TOKEN` e demais credenciais necessárias.

## Configurando o Ollama (IA Local com Gemma3)

1. Navegue até o diretório do container:

   ```bash
   cd ollama-container
   ```

2. Construa e inicie o container:

   ```bash
   docker-compose up -d
   ```

3. Verifique se o serviço está disponível:

   ```bash
   curl http://localhost:11434/api/tags
   ```

   Deve listar o modelo `gemma3`.

4. Retorne ao diretório principal:

   ```bash
   cd ..
   ```

## Executando o Projeto

Após configurar o ambiente e o container Ollama:

* **Inicie o bot:**

  ```bash
  npm start
  ```

* **Execute o agente agendador (opcional):**

  ```bash
  node agente_agendador
  ```

## Estrutura Arquitetural

### Arquitetura Central (Microserviços)

* **Bot Telegram (`index.js`):** Interface com o usuário via Telegram.
* **Agente de Instrução (`agente_instrucao.js`):** Gera respostas via IA local.
* **Agente Agendador (`agente_agendador.js`):** Gerencia tarefas via Google Tasks com autenticação OAuth2.
* **Ollama/Gemma3:** IA local para geração textual.
* **Google Tasks API:** Serviço externo de agendamento.

### Fluxo de Comunicação Seguro

```
Usuário Telegram
   |
   v
[Bot Telegram] --HTTPS + JWT--> [Agente de Instrução] --HTTPS--> [Ollama (Gemma3)]
   |
   v
[Agente Agendador] --HTTPS + OAuth2--> [Google Tasks API]
   |
   v
[Banco Seguro para tokens]
```

## Medidas de Segurança Implementadas

* Armazenamento seguro de tokens OAuth2 em banco dedicado.
* Autenticação interna usando JWT/API Key.
* Comunicação HTTPS em todos os serviços.
* Validação e sanitização rigorosas de entradas.
* Rate limiting e restrições CORS.
* Logs protegidos contra exposição de dados sensíveis.

## Funcionalidades Principais

* Orientações de cultivo de plantas por IA local.
* Comunicação via Telegram com interface amigável.
* Gerenciamento eficiente de tarefas terapêuticas (Google Tasks).
* Arquitetura robusta, modular e segura.
