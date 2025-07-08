FROM ollama/ollama:latest

# Definir a porta de exposição
EXPOSE 11434

# Criar diretório para volumes do Ollama
RUN mkdir -p /root/.ollama

# Script de inicialização que baixa o modelo e inicia o servidor
WORKDIR /app
COPY start-ollama.sh /app/start-ollama.sh
RUN chmod +x /app/start-ollama.sh

# Comando para executar na inicialização do container
CMD ["sh", "/app/start-ollama.sh"]
