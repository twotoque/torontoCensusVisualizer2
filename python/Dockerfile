FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y libgdal-dev g++ && rm -rf /var/lib/apt/lists/*
COPY python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY python/ .
COPY data/ /app/data/