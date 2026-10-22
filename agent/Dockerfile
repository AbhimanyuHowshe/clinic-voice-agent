# Voice agent image for LiveKit Cloud (`lk agent create` / `lk agent deploy`).
# Secrets are injected by LiveKit Cloud at runtime; none are copied into the image.
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

RUN useradd --create-home --uid 10001 appuser
WORKDIR /home/appuser/app

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY receptionist.py ./
COPY clinic ./clinic
RUN chown -R appuser:appuser /home/appuser/app
USER appuser

# Bake model files (Silero VAD) into the image so cold starts don't download them.
RUN uv run --no-dev python receptionist.py download-files

CMD ["uv", "run", "--no-dev", "python", "receptionist.py", "start"]
