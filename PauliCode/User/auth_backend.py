# User/auth_backend.py
# Create this new file in your User app directory

from django.contrib.auth.backends import BaseBackend
from django.contrib.auth.hashers import check_password
from .models import User


class SchoolIDBackend(BaseBackend):
    """
    Custom authentication backend that uses school_id instead of username
    """
    
    def authenticate(self, request, school_id=None, password=None, **kwargs):
        """
        Authenticate user with school_id and password
        """
        if school_id is None or password is None:
            return None
        
        try:
            user = User.objects.get(school_id=school_id)
            
            # Check if password is hashed or plain text
            if user.password.startswith('pbkdf2_') or user.password.startswith('bcrypt') or user.password.startswith('argon2'):
                # Password is hashed
                password_valid = check_password(password, user.password)
            else:
                # Password is plain text (legacy)
                password_valid = (password == user.password)
                
                # Auto-migrate to hashed password
                if password_valid:
                    from django.contrib.auth.hashers import make_password
                    user.password = make_password(password)
                    user.save()
            
            if password_valid:
                return user
            
        except User.DoesNotExist:
            return None
        
        return None
    
    def get_user(self, user_id):
        """
        Get user by their school_id (used as primary identifier)
        """
        try:
            return User.objects.get(school_id=user_id)
        except User.DoesNotExist:
            return None


class SessionAuthBackend(BaseBackend):
    """
    Backend that authenticates based on session data
    This allows @login_required to work with your existing session system
    """
    
    def authenticate(self, request, **kwargs):
        # This backend doesn't handle initial authentication
        return None
    
    def get_user(self, user_id):
        """
        Get user from session
        user_id here is the school_id stored in session
        """
        try:
            return User.objects.get(school_id=user_id)
        except User.DoesNotExist:
            return None