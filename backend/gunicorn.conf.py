"""
Gunicorn production configuration for Darukaa Mission Control backend.

Used by Render's start command:
  gunicorn -c gunicorn.conf.py app.main:app

On Render free tier (0.1 vCPU, 512 MB) 1 worker is correct.
Scale workers up on paid instances: workers = multiprocessing.cpu_count() * 2 + 1
"""

import os

# ── Binding ───────────────────────────────────────────────────────────────────
# Render injects $PORT dynamically. Default 10000 is Render's static default.
bind = f"0.0.0.0:{os.environ.get('PORT', '10000')}"

# ── Workers ───────────────────────────────────────────────────────────────────
# UvicornWorker runs the async FastAPI app properly inside Gunicorn's process model.
worker_class = "uvicorn.workers.UvicornWorker"
workers = int(os.environ.get("WEB_CONCURRENCY", "1"))

# ── Timeouts ──────────────────────────────────────────────────────────────────
# Render free tier can be slow to cold-start — give it room.
timeout = 120
keepalive = 5
graceful_timeout = 30

# ── Performance ───────────────────────────────────────────────────────────────
# Load the app before forking workers — catches import errors early
# and cuts per-worker memory after fork-on-write.
preload_app = True

# ── Logging ───────────────────────────────────────────────────────────────────
# "-" sends logs to stdout/stderr so Render's log drain picks them up.
errorlog = "-"
accesslog = "-"
loglevel = os.environ.get("LOG_LEVEL", "info")
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(D)sµs'
