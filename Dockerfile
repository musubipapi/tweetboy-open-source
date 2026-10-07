FROM python:3.12-slim
WORKDIR /app
COPY server.py ./
COPY public ./public
ENV BIND_HOST=0.0.0.0
CMD ["python3", "server.py"]
