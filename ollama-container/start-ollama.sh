#!/bin/sh

# Definir modelos a serem baixados (padrão para gemma3 se não for especificado)
MODELS=${OLLAMA_MODELS:-gemma3}

# Baixar os modelos especificados
echo "Baixando modelos: $MODELS..."
for model in $(echo $MODELS | tr "," " "); do
    echo "Baixando modelo $model..."
    ollama pull $model
done

# Iniciar o servidor Ollama
echo "Iniciando servidor Ollama em ${OLLAMA_HOST:-0.0.0.0}:11434..."
exec ollama serve
