# rate_limiter.py
"""
Rate Limiting Module for Django Applications
Provides decorators and utilities for rate limiting views and API endpoints
"""

from django.core.cache import cache
from django.http import JsonResponse, HttpResponse
from functools import wraps
import time
import hashlib
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """Main rate limiting class with various strategies"""
    
    @staticmethod
    def get_client_ip(request):
        """Extract client IP from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', 'unknown')
        return ip
    
    @staticmethod
    def get_user_identifier(request):
        """Get unique identifier for user (IP or user ID if authenticated)"""
        if request.user.is_authenticated:
            return f"user_{request.user.school_id}"
        return f"ip_{RateLimiter.get_client_ip(request)}"
    
    @staticmethod
    def is_rate_limited(request, key_prefix, max_requests, time_window):
        """
        Check if request should be rate limited
        
        Args:
            request: Django request object
            key_prefix: Unique identifier for the rate limit (e.g., 'login', 'api')
            max_requests: Maximum number of requests allowed
            time_window: Time window in seconds
        
        Returns:
            tuple: (is_limited: bool, remaining: int, reset_time: int)
        """
        identifier = RateLimiter.get_user_identifier(request)
        cache_key = f"rate_limit:{key_prefix}:{identifier}"
        
        current_time = time.time()
        current = cache.get(cache_key, None)
        
        if current is None:
            # First request
            cache.set(cache_key, {
                'count': 1,
                'start_time': current_time
            }, time_window)
            return False, max_requests - 1, int(current_time + time_window)
        
        # Check if time window has expired
        if current_time - current['start_time'] > time_window:
            # Reset counter
            cache.set(cache_key, {
                'count': 1,
                'start_time': current_time
            }, time_window)
            return False, max_requests - 1, int(current_time + time_window)
        
        # Check if limit exceeded
        if current['count'] >= max_requests:
            reset_time = int(current['start_time'] + time_window)
            wait_time = reset_time - int(current_time)
            return True, 0, reset_time
        
        # Increment counter
        current['count'] += 1
        cache.set(cache_key, current, time_window)
        
        remaining = max_requests - current['count']
        reset_time = int(current['start_time'] + time_window)
        
        return False, remaining, reset_time


def rate_limit(key_prefix, max_requests=5, time_window=60, block_duration=None):
    """
    Decorator for rate limiting views
    
    Args:
        key_prefix: Unique identifier for this rate limit
        max_requests: Maximum requests allowed
        time_window: Time window in seconds
        block_duration: How long to block after limit (None = same as time_window)
    
    Usage:
        @rate_limit('login', max_requests=5, time_window=60)
        def login_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            is_limited, remaining, reset_time = RateLimiter.is_rate_limited(
                request, key_prefix, max_requests, time_window
            )
            
            if is_limited:
                wait_time = reset_time - int(time.time())
                
                # Check if it's an AJAX/API request
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or \
                   request.content_type == 'application/json':
                    return JsonResponse({
                        'success': False,
                        'error': 'Rate limit exceeded',
                        'message': f'Too many requests. Please wait {wait_time} seconds.',
                        'retry_after': wait_time,
                        'reset_time': reset_time
                    }, status=429)
                else:
                    # For regular requests
                    return HttpResponse(
                        f'<h1>429 - Too Many Requests</h1>'
                        f'<p>Please wait {wait_time} seconds before trying again.</p>',
                        status=429
                    )
            
            # Add rate limit info to response headers
            response = view_func(request, *args, **kwargs)
            
            # Add rate limit headers
            if hasattr(response, '__setitem__'):
                response['X-RateLimit-Limit'] = str(max_requests)
                response['X-RateLimit-Remaining'] = str(remaining)
                response['X-RateLimit-Reset'] = str(reset_time)
            
            return response
        return wrapper
    return decorator


def rate_limit_api(key_prefix, max_requests=10, time_window=60):
    """
    Specialized decorator for API endpoints (always returns JSON)
    
    Usage:
        @rate_limit_api('api_endpoint', max_requests=10, time_window=60)
        def api_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            is_limited, remaining, reset_time = RateLimiter.is_rate_limited(
                request, key_prefix, max_requests, time_window
            )
            
            if is_limited:
                wait_time = reset_time - int(time.time())
                return JsonResponse({
                    'success': False,
                    'error': 'rate_limit_exceeded',
                    'message': f'Too many requests. Limit: {max_requests} per {time_window}s',
                    'retry_after': wait_time,
                    'reset_at': reset_time
                }, status=429)
            
            response = view_func(request, *args, **kwargs)
            
            # Add rate limit headers to JSON responses
            if isinstance(response, JsonResponse):
                response['X-RateLimit-Limit'] = str(max_requests)
                response['X-RateLimit-Remaining'] = str(remaining)
                response['X-RateLimit-Reset'] = str(reset_time)
            
            return response
        return wrapper
    return decorator


class FailedAttemptTracker:
    """Track failed attempts (e.g., failed logins) with progressive blocking"""
    
    @staticmethod
    def record_failure(identifier, key_prefix='failed_attempt', duration=3600):
        """
        Record a failed attempt
        
        Args:
            identifier: User identifier (IP or username)
            key_prefix: Prefix for cache key
            duration: How long to remember the failure (seconds)
        
        Returns:
            int: Number of failed attempts
        """
        cache_key = f"{key_prefix}:{identifier}"
        attempts = cache.get(cache_key, 0) + 1
        cache.set(cache_key, attempts, duration)
        
        logger.warning(f"Failed attempt recorded for {identifier}: {attempts} attempts")
        return attempts
    
    @staticmethod
    def clear_failures(identifier, key_prefix='failed_attempt'):
        """Clear failed attempts for an identifier"""
        cache_key = f"{key_prefix}:{identifier}"
        cache.delete(cache_key)
    
    @staticmethod
    def get_failures(identifier, key_prefix='failed_attempt'):
        """Get number of failed attempts"""
        cache_key = f"{key_prefix}:{identifier}"
        return cache.get(cache_key, 0)
    
    @staticmethod
    def is_blocked(identifier, key_prefix='failed_attempt', threshold=5):
        """Check if identifier is blocked due to too many failures"""
        attempts = FailedAttemptTracker.get_failures(identifier, key_prefix)
        return attempts >= threshold


def track_failed_attempts(key_prefix='failed_login', threshold=5, block_duration=1800):
    """
    Decorator to track failed attempts and block after threshold
    
    Args:
        key_prefix: Prefix for tracking
        threshold: Number of failures before blocking
        block_duration: How long to block (seconds)
    
    Usage:
        @track_failed_attempts('login', threshold=5, block_duration=1800)
        def login_view(request):
            # If authentication fails, raise Exception or return None
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            identifier = RateLimiter.get_user_identifier(request)
            
            # Check if already blocked
            if FailedAttemptTracker.is_blocked(identifier, key_prefix, threshold):
                failures = FailedAttemptTracker.get_failures(identifier, key_prefix)
                
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse({
                        'success': False,
                        'error': 'account_locked',
                        'message': f'Too many failed attempts. Try again later.',
                        'attempts': failures,
                        'threshold': threshold
                    }, status=403)
                else:
                    return HttpResponse(
                        f'<h1>Account Temporarily Locked</h1>'
                        f'<p>Too many failed attempts. Please try again later.</p>',
                        status=403
                    )
            
            # Execute the view
            response = view_func(request, *args, **kwargs)
            
            return response
        return wrapper
    return decorator


class BurstLimiter:
    """
    Implements token bucket algorithm for burst handling
    Allows short bursts while maintaining average rate
    """
    
    @staticmethod
    def check_and_consume(identifier, key_prefix, tokens_per_window=10, 
                         refill_rate=1, window=60):
        """
        Check if request is allowed under token bucket algorithm
        
        Args:
            identifier: User identifier
            key_prefix: Prefix for cache key
            tokens_per_window: Maximum tokens (burst capacity)
            refill_rate: Tokens added per second
            window: Time window for tracking
        
        Returns:
            tuple: (allowed: bool, tokens_remaining: int)
        """
        cache_key = f"burst_limit:{key_prefix}:{identifier}"
        current_time = time.time()
        
        bucket = cache.get(cache_key)
        
        if bucket is None:
            # Initialize bucket
            bucket = {
                'tokens': tokens_per_window - 1,
                'last_update': current_time
            }
            cache.set(cache_key, bucket, window)
            return True, bucket['tokens']
        
        # Calculate tokens to add based on time passed
        time_passed = current_time - bucket['last_update']
        new_tokens = time_passed * refill_rate
        
        # Update bucket
        bucket['tokens'] = min(tokens_per_window, bucket['tokens'] + new_tokens)
        bucket['last_update'] = current_time
        
        # Check if request is allowed
        if bucket['tokens'] >= 1:
            bucket['tokens'] -= 1
            cache.set(cache_key, bucket, window)
            return True, int(bucket['tokens'])
        else:
            cache.set(cache_key, bucket, window)
            return False, 0


def burst_limit(key_prefix, burst_size=10, refill_rate=1):
    """
    Decorator for burst limiting (token bucket algorithm)
    
    Args:
        key_prefix: Unique identifier
        burst_size: Maximum burst capacity
        refill_rate: Tokens refilled per second
    
    Usage:
        @burst_limit('api_call', burst_size=10, refill_rate=1)
        def api_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            identifier = RateLimiter.get_user_identifier(request)
            
            allowed, remaining = BurstLimiter.check_and_consume(
                identifier, key_prefix, burst_size, refill_rate
            )
            
            if not allowed:
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse({
                        'success': False,
                        'error': 'rate_limit_exceeded',
                        'message': 'Too many requests. Please slow down.',
                        'tokens_remaining': remaining
                    }, status=429)
                else:
                    return HttpResponse(
                        '<h1>429 - Too Many Requests</h1>'
                        '<p>Please slow down your requests.</p>',
                        status=429
                    )
            
            response = view_func(request, *args, **kwargs)
            
            # Add headers
            if hasattr(response, '__setitem__'):
                response['X-RateLimit-Remaining'] = str(remaining)
            
            return response
        return wrapper
    return decorator


# Utility functions for manual rate limiting in views
def check_rate_limit(request, key_prefix, max_requests, time_window):
    """Manual rate limit check for use in views"""
    return RateLimiter.is_rate_limited(request, key_prefix, max_requests, time_window)


def record_failed_login(identifier):
    """Convenience function for recording failed login"""
    return FailedAttemptTracker.record_failure(identifier, 'failed_login', 1800)


def clear_failed_login(identifier):
    """Convenience function for clearing failed login attempts"""
    FailedAttemptTracker.clear_failures(identifier, 'failed_login')


def get_failed_login_count(identifier):
    """Get failed login attempt count"""
    return FailedAttemptTracker.get_failures(identifier, 'failed_login')


# Export commonly used functions
__all__ = [
    'rate_limit',
    'rate_limit_api',
    'track_failed_attempts',
    'burst_limit',
    'RateLimiter',
    'FailedAttemptTracker',
    'BurstLimiter',
    'check_rate_limit',
    'record_failed_login',
    'clear_failed_login',
    'get_failed_login_count',
]