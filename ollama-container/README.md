# Container Docker para Ollama com Gemma3

Este container Docker fornece uma instância do Ollama executando o modelo Gemma3, configurado para se comunicar na porta 11434.

## Pré-requisitos

- Docker
- Docker Compose

## Como usar

1. Navegue até esta pasta:

```bash
cd ollama-container
```

1. Construa e inicie o container:

```bash
docker-compose up -d
```

1. Aguarde enquanto o container baixa o modelo Gemma3 e inicia o servidor.

1. O servidor Ollama estará acessível em `http://localhost:11434`

## Verificação

Para verificar se o serviço está funcionando corretamente, você pode executar:

```bash
curl http://localhost:11434/api/tags
```

Isso deve retornar a lista de modelos disponíveis, incluindo o `gemma3`.

## Conectando com o Agente de Instruções

O agente de instruções está configurado para se comunicar com a API Ollama através de:
`http://localhost:11434/api/generate`

O container expõe esta porta para que o agente possa se conectar sem problemas.

## Volumes

Este setup usa um volume Docker nomeado (`ollama-data`) para persistir os modelos baixados. Isso significa que você não precisará baixar novamente o modelo ao reiniciar o container.
