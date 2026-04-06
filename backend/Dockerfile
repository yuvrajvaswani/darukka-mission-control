FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

COPY . .
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8000

# Render sets PORT env var; fall back to 8000
CMD ["sh", "-c", "alembic upgrade head && gunicorn app.main:app --worker-class uvicorn.workers.UvicornWorker --workers 1 --bind 0.0.0.0:${PORT:-8000} --timeout 120 --access-logfile - --error-logfile -"]
