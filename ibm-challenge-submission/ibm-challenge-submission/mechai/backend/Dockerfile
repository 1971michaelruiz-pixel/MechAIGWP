# ── Build stage ────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

# Install Poetry
RUN pip install --no-cache-dir poetry==1.8.3

# Copy dependency manifests first for layer caching
COPY pyproject.toml poetry.lock* ./

# Export dependencies to a plain requirements.txt (no dev dependencies)
RUN poetry export --without dev --without-hashes -f requirements.txt -o requirements.txt

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Non-root user for the process
RUN addgroup --system mechai && adduser --system --ingroup mechai mechai

# Install compiled deps from the builder stage
COPY --from=builder /app/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./

# Switch to non-root user
USER mechai

# Expose the API port
EXPOSE 8000

# Healthcheck — matches the /health route
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()"

# Run migrations then start the server.
# In Kubernetes / Cloud Run you can override CMD and run migrations as a separate
# init container using: alembic upgrade head
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2"]
