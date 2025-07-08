# Gunicorn configuration for production
import multiprocessing
import os

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', 5000)}"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 300
keepalive = 2
max_requests = 1000
max_requests_jitter = 50

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Security
limit_request_line = 0
limit_request_fields = 100
limit_request_field_size = 8190

# Process naming
proc_name = "fitfind-app"

# Preload application
preload_app = True

# Restart workers after this many requests
max_requests = 1000

# Restart workers after this many seconds
max_requests_jitter = 100

# Graceful timeout
graceful_timeout = 30

# Enable stats
statsd_host = os.getenv('STATSD_HOST', None)