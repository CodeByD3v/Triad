# ── Stage 1: dependency install ──────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build deps separately so they're cached
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# ── Stage 2: runtime image ────────────────────────────────────────────────────
FROM python:3.11-slim

# Non-root user for security
RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code (serviceAccountKey.json excluded via .dockerignore)
COPY . .

# Switch to non-root
RUN chown -R appuser:appuser /app
USER appuser

# Cloud Run uses PORT env var; fall back to 8080
ENV PORT=8080
EXPOSE 8080

# Health check so Cloud Run knows the container is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/health')"

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
