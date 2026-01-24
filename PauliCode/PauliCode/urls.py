from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from django.conf import settings


urlpatterns = [
   path('secret-paulicode-admin-panel-2026/', admin.site.urls),
   path('', include('User.urls')),
   path('announcements/', include('Announcement.urls')), 
  
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)