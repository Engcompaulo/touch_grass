# Dockerfile do frontend — Board Game Scoreboard (R9.1)
#
# O frontend é estático (HTML + CSS + JavaScript vanilla, módulos ES).
# Usamos o nginx:alpine, uma imagem enxuta que serve arquivos estáticos
# por HTTP sem necessidade de build, bundler ou runtime Node.
FROM nginx:alpine

# Remove o conteúdo padrão do nginx para servir apenas a nossa aplicação.
RUN rm -rf /usr/share/nginx/html/*

# Copia todo o conteúdo de src/ (index.html, css/ e js/) para o diretório
# que o nginx serve por padrão. O nginx:alpine já define os tipos MIME
# corretos para .html, .css e .js, então os módulos ES carregam sem ajustes.
COPY src/ /usr/share/nginx/html/

# Expõe a porta HTTP padrão do nginx. No docker-compose ela é publicada
# no host como 8080:80 (ver docker-compose.yml).
EXPOSE 80

# Inicia o nginx em primeiro plano para que o container permaneça ativo.
CMD ["nginx", "-g", "daemon off;"]
