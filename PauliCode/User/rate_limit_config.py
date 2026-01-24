# rate_limit_config.py
"""
Centralized configuration for rate limiting
Import this in your settings.py or views.py
"""

# ============================================================================
# CACHE SETTINGS FOR RATE LIMITING (MOVED TO TOP FOR IMPORTS)
# ============================================================================

# Recommended cache configuration for production
RATE_LIMIT_CACHE_CONFIG = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        },
        'KEY_PREFIX': 'rate_limit',
        'TIMEOUT': 3600,  # 1 hour default
    }
}

# For development (in-memory cache)
RATE_LIMIT_CACHE_CONFIG_DEV = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'rate-limit-cache',
    }
}

# ============================================================================
# RATE LIMIT CONFIGURATIONS
# ============================================================================

RATE_LIMITS = {
    # Authentication endpoints
    'login': {
        'max_requests': 10,
        'time_window': 60,  # 1 minute
        'block_duration': 300,  # 5 minutes after exceeding
    },
    
    'signup': {
        'max_requests': 3,
        'time_window': 300,  # 5 minutes
    },
    
    'verify_code': {
        'max_requests': 10,
        'time_window': 60,  # 1 minute
    },
    
    'resend_code': {
        'max_requests': 3,
        'time_window': 300,  # 5 minutes
    },
    
    # Code execution
    'run_code': {
        'burst_size': 10,
        'refill_rate': 0.5,  # 30 per minute
    },
    
    'submit_problem': {
        'max_requests': 10,
        'time_window': 300,  # 5 minutes
    },
    
    # AI endpoints
    'ai_chat': {
        'max_requests': 15,
        'time_window': 60,  # 1 minute
    },
    
    # File operations
    'upload_resource': {
        'max_requests': 10,
        'time_window': 3600,  # 1 hour
    },
    
    # Class management
    'create_class': {
        'max_requests': 5,
        'time_window': 300,  # 5 minutes
    },
    
    'join_class': {
        'max_requests': 5,
        'time_window': 60,  # 1 minute
    },
    
    # Cybersecurity
    'submit_cybersec_answer': {
        'max_requests': 20,
        'time_window': 300,  # 5 minutes
    },
    
    # API endpoints
    'api_general': {
        'max_requests': 60,
        'time_window': 60,  # 60 per minute
    },
}

# ============================================================================
# FAILED ATTEMPT CONFIGURATIONS
# ============================================================================

FAILED_ATTEMPT_SETTINGS = {
    'login': {
        'threshold': 5,  # Block after 5 failures
        'duration': 1800,  # Remember for 30 minutes
        'progressive': True,  # Enable progressive delays
    },
    
    'verify_code': {
        'threshold': 10,
        'duration': 900,  # 15 minutes
    },
}

# ============================================================================
# PROGRESSIVE BLOCKING RULES
# ============================================================================

PROGRESSIVE_BLOCKING = {
    'login': [
        {'attempts': 3, 'delay': 0},      # No delay for first 3 attempts
        {'attempts': 5, 'delay': 60},     # 1 minute delay after 5 attempts
        {'attempts': 8, 'delay': 300},    # 5 minutes delay after 8 attempts
        {'attempts': 10, 'delay': 1800},  # 30 minutes delay after 10 attempts
    ]
}

# ============================================================================
# USER TYPE SPECIFIC LIMITS (Optional)
# ============================================================================

USER_TYPE_MULTIPLIERS = {
    'Teacher': {
        'ai_chat': 2.0,  # Teachers get 2x the limit
        'run_code': 1.5,
        'submit_problem': 1.5,
    },
    'Student': {
        'ai_chat': 1.0,
        'run_code': 1.0,
        'submit_problem': 1.0,
    },
}

# ============================================================================
# WHITELIST/BLACKLIST (Optional)
# ============================================================================

# IPs that bypass rate limiting (e.g., your office IP)
RATE_LIMIT_WHITELIST = [
    # '192.168.1.100',
    # '10.0.0.1',
]

# IPs that are permanently blocked
RATE_LIMIT_BLACKLIST = [
    # '123.456.789.0',
]

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_rate_limit_for_endpoint(endpoint):
    """Get rate limit configuration for an endpoint"""
    return RATE_LIMITS.get(endpoint, {
        'max_requests': 10,
        'time_window': 60
    })


def get_user_type_limit(endpoint, user_type):
    """Calculate rate limit based on user type"""
    base_limit = RATE_LIMITS.get(endpoint, {})
    multiplier = USER_TYPE_MULTIPLIERS.get(user_type, {}).get(endpoint, 1.0)
    
    if 'max_requests' in base_limit:
        return {
            'max_requests': int(base_limit['max_requests'] * multiplier),
            'time_window': base_limit['time_window']
        }
    return base_limit


def is_ip_whitelisted(ip):
    """Check if IP is whitelisted"""
    return ip in RATE_LIMIT_WHITELIST


def is_ip_blacklisted(ip):
    """Check if IP is blacklisted"""
    return ip in RATE_LIMIT_BLACKLIST


# ============================================================================
# USAGE IN SETTINGS.PY
# ============================================================================

"""
Add to your settings.py:

from User.rate_limit_config import RATE_LIMIT_CACHE_CONFIG_DEV, RATE_LIMIT_CACHE_CONFIG

# For development
CACHES = RATE_LIMIT_CACHE_CONFIG_DEV

# For production
# CACHES = RATE_LIMIT_CACHE_CONFIG

# Optional: Import rate limit settings
from User.rate_limit_config import RATE_LIMITS
"""

# ============================================================================
# USAGE IN VIEWS.PY
# ============================================================================

"""
Import and use configurations:

from .rate_limit_config import RATE_LIMITS, get_rate_limit_for_endpoint
from .rate_limiter import rate_limit, rate_limit_api

# Use configured limits
config = RATE_LIMITS['login']
@rate_limit('login', max_requests=config['max_requests'], time_window=config['time_window'])
def login_view(request):
    ...

# Or dynamically
@rate_limit('login', **get_rate_limit_for_endpoint('login'))
def login_view(request):
    ...
"""