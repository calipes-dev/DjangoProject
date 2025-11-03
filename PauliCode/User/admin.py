from django.contrib import admin
from .models import User, ChatHistory

class UserAdmin(admin.ModelAdmin):
    list_display = ('school_id', 'first_name', 'last_name', 'user_type', 'image_tag')
    search_fields = ('school_id', 'first_name', 'last_name')
    list_filter = ('user_type',)
    ordering = ('school_id',)

admin.site.register(User, UserAdmin)

# Register ChatHistory model
@admin.register(ChatHistory)
class ChatHistoryAdmin(admin.ModelAdmin):
    list_display = ('school_id', 'sender', 'message_preview', 'timestamp')
    list_filter = ('sender', 'timestamp')
    search_fields = ('school_id__school_id', 'school_id__first_name', 'message')
    readonly_fields = ('timestamp',)
    
    def message_preview(self, obj):
        return obj.message[:50] + "..." if len(obj.message) > 50 else obj.message
    message_preview.short_description = "Message"