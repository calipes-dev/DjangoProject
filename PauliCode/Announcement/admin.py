# Announcement/admin.py
from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Count
from django.contrib import messages
from django.http import HttpResponse
import csv

from .models import (
    Announcement, AnnouncementFile, AnnouncementLink,
    AnnouncementReaction, AnnouncementComment, 
    AnnouncementPin, AnnouncementReport
)


# ============================================
# INLINE ADMINS (for related models)
# ============================================
class AnnouncementFileInline(admin.TabularInline):
    model = AnnouncementFile
    extra = 1
    fields = ('file', 'file_name', 'file_size', 'uploaded_at')
    readonly_fields = ('file_size', 'uploaded_at')


class AnnouncementLinkInline(admin.TabularInline):
    model = AnnouncementLink
    extra = 1
    fields = ('url', 'title', 'added_at')
    readonly_fields = ('added_at',)


# ============================================
# ADMIN ACTIONS
# ============================================
@admin.action(description='📌 Pin selected announcements')
def pin_announcements(modeladmin, request, queryset):
    updated = queryset.update(is_pinned=True)
    modeladmin.message_user(request, f"📌 {updated} announcements pinned.", messages.SUCCESS)


@admin.action(description='📍 Unpin selected announcements')
def unpin_announcements(modeladmin, request, queryset):
    updated = queryset.update(is_pinned=False)
    modeladmin.message_user(request, f"📍 {updated} announcements unpinned.", messages.SUCCESS)


@admin.action(description='📥 Export announcements to CSV')
def export_announcements_csv(modeladmin, request, queryset):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="announcements_export.csv"'
    
    writer = csv.writer(response)
    writer.writerow(['ID', 'Title', 'Teacher', 'Class', 'Pinned', 'Reactions', 'Comments', 'Created At'])
    
    for announcement in queryset:
        writer.writerow([
            announcement.announcement_id,
            announcement.title,
            announcement.teacher.get_full_name(),
            announcement.class_id.title if announcement.class_id else 'N/A',
            'Yes' if announcement.is_pinned else 'No',
            announcement.total_reactions,
            announcement.total_comments,
            announcement.created_at.strftime('%Y-%m-%d %H:%M:%S')
        ])
    
    return response


@admin.action(description='🗑️ Delete announcements and all related data')
def delete_with_all_data(modeladmin, request, queryset):
    count = queryset.count()
    queryset.delete()
    modeladmin.message_user(request, f"🗑️ {count} announcements deleted with all related data.", messages.SUCCESS)


# ============================================
# ANNOUNCEMENT ADMIN
# ============================================
@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = (
        'announcement_id', 'title_display', 'teacher_display', 
        'class_display', 'pinned_status', 'reactions_count', 
        'comments_count', 'created_at'
    )
    list_filter = ('is_pinned', 'teacher', 'class_id', 'created_at')
    search_fields = ('title', 'content', 'teacher__first_name', 'teacher__last_name', 'class_id__title')
    readonly_fields = ('created_at', 'updated_at', 'total_reactions', 'total_comments')
    ordering = ('-is_pinned', '-created_at')
    list_per_page = 30
    
    actions = [pin_announcements, unpin_announcements, export_announcements_csv, delete_with_all_data]
    
    inlines = [AnnouncementFileInline, AnnouncementLinkInline]
    
    fieldsets = (
        ('📢 Announcement Information', {
            'fields': ('teacher', 'class_id', 'title', 'content', 'is_pinned'),
        }),
        ('📎 Media Attachments', {
            'fields': ('image', 'video'),
            'classes': ('collapse',),
        }),
        ('📊 Statistics', {
            'fields': ('total_reactions', 'total_comments'),
            'classes': ('collapse',),
        }),
        ('📅 Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    
    def title_display(self, obj):
        """Display title with icon"""
        icon = '📌' if obj.is_pinned else '📄'
        return format_html('{} {}', icon, obj.title)
    title_display.short_description = 'Title'
    
    def teacher_display(self, obj):
        """Display teacher name"""
        return obj.teacher.get_full_name()
    teacher_display.short_description = 'Teacher'
    teacher_display.admin_order_field = 'teacher__first_name'
    
    def class_display(self, obj):
        """Display class name"""
        return obj.class_id.title if obj.class_id else 'N/A'
    class_display.short_description = 'Class'
    class_display.admin_order_field = 'class_id__title'
    
    def pinned_status(self, obj):
        """Display pinned status with color"""
        if obj.is_pinned:
            return format_html('<span style="color: #28a745; font-weight: bold;">📌 Pinned</span>')
        return format_html('<span style="color: #6c757d;">○ Normal</span>')
    pinned_status.short_description = 'Status'
    pinned_status.admin_order_field = 'is_pinned'
    
    def reactions_count(self, obj):
        """Display reactions count"""
        count = obj.total_reactions
        if count > 0:
            return format_html('<span style="color: #007bff; font-weight: bold;">❤️ {}</span>', count)
        return '0'
    reactions_count.short_description = 'Reactions'
    
    def comments_count(self, obj):
        """Display comments count"""
        count = obj.total_comments
        if count > 0:
            return format_html('<span style="color: #17a2b8; font-weight: bold;">💬 {}</span>', count)
        return '0'
    comments_count.short_description = 'Comments'


# ============================================
# ANNOUNCEMENT FILE ADMIN
# ============================================
@admin.register(AnnouncementFile)
class AnnouncementFileAdmin(admin.ModelAdmin):
    list_display = ('file_id', 'file_name', 'announcement_title', 'file_size_display', 'uploaded_at')
    list_filter = ('uploaded_at',)
    search_fields = ('file_name', 'announcement__title')
    readonly_fields = ('file_size', 'uploaded_at')
    ordering = ('-uploaded_at',)
    
    def announcement_title(self, obj):
        return obj.announcement.title
    announcement_title.short_description = 'Announcement'
    
    def file_size_display(self, obj):
        return obj.get_file_size_display()
    file_size_display.short_description = 'File Size'


# ============================================
# ANNOUNCEMENT LINK ADMIN
# ============================================
@admin.register(AnnouncementLink)
class AnnouncementLinkAdmin(admin.ModelAdmin):
    list_display = ('link_id', 'title_or_url', 'announcement_title', 'added_at')
    list_filter = ('added_at',)
    search_fields = ('title', 'url', 'announcement__title')
    readonly_fields = ('added_at',)
    ordering = ('-added_at',)
    
    def title_or_url(self, obj):
        return obj.title or obj.url
    title_or_url.short_description = 'Link'
    
    def announcement_title(self, obj):
        return obj.announcement.title
    announcement_title.short_description = 'Announcement'


# ============================================
# ANNOUNCEMENT REACTION ADMIN
# ============================================
@admin.register(AnnouncementReaction)
class AnnouncementReactionAdmin(admin.ModelAdmin):
    list_display = ('reaction_id', 'user_display', 'announcement_title', 'reaction_display', 'created_at')
    list_filter = ('reaction_type', 'created_at')
    search_fields = ('user__first_name', 'user__last_name', 'announcement__title')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
    
    def user_display(self, obj):
        return obj.user.get_full_name()
    user_display.short_description = 'User'
    
    def announcement_title(self, obj):
        return obj.announcement.title
    announcement_title.short_description = 'Announcement'
    
    def reaction_display(self, obj):
        emoji = dict(AnnouncementReaction.REACTION_CHOICES).get(obj.reaction_type, '')
        return format_html('<span style="font-size: 20px;">{} {}</span>', emoji, obj.reaction_type)
    reaction_display.short_description = 'Reaction'


# ============================================
# ANNOUNCEMENT COMMENT ADMIN
# ============================================
@admin.register(AnnouncementComment)
class AnnouncementCommentAdmin(admin.ModelAdmin):
    list_display = ('comment_id', 'user_display', 'announcement_title', 'content_preview', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user__first_name', 'user__last_name', 'announcement__title', 'content')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
    
    def user_display(self, obj):
        return obj.user.get_full_name()
    user_display.short_description = 'User'
    
    def announcement_title(self, obj):
        return obj.announcement.title
    announcement_title.short_description = 'Announcement'
    
    def content_preview(self, obj):
        """Show first 50 characters of comment"""
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Comment'


# ============================================
# ANNOUNCEMENT PIN ADMIN
# ============================================
@admin.register(AnnouncementPin)
class AnnouncementPinAdmin(admin.ModelAdmin):
    list_display = ('pin_id', 'user_display', 'announcement_title', 'pinned_at')
    list_filter = ('pinned_at',)
    search_fields = ('user__first_name', 'user__last_name', 'announcement__title')
    readonly_fields = ('pinned_at',)
    ordering = ('-pinned_at',)
    
    def user_display(self, obj):
        return obj.user.get_full_name()
    user_display.short_description = 'User'
    
    def announcement_title(self, obj):
        return obj.announcement.title
    announcement_title.short_description = 'Announcement'


# ============================================
# ANNOUNCEMENT REPORT ADMIN
# ============================================
@admin.register(AnnouncementReport)
class AnnouncementReportAdmin(admin.ModelAdmin):
    list_display = (
        'report_id', 'reporter_display', 'announcement_title', 
        'status_display', 'reported_at', 'reviewed_at'
    )
    list_filter = ('status', 'reported_at', 'reviewed_at')
    search_fields = ('reporter__first_name', 'reporter__last_name', 'announcement__title', 'reason')
    readonly_fields = ('reported_at',)
    ordering = ('-reported_at',)
    
    fieldsets = (
        ('🚨 Report Information', {
            'fields': ('announcement', 'reporter', 'reason', 'status'),
        }),
        ('👨‍💼 Admin Review', {
            'fields': ('admin_notes', 'reviewed_at'),
            'classes': ('collapse',),
        }),
        ('📅 Timestamps', {
            'fields': ('reported_at',),
            'classes': ('collapse',),
        }),
    )
    
    def reporter_display(self, obj):
        return obj.reporter.get_full_name()
    reporter_display.short_description = 'Reporter'
    
    def announcement_title(self, obj):
        return obj.announcement.title
    announcement_title.short_description = 'Announcement'
    
    def status_display(self, obj):
        """Display status with color"""
        colors = {
            'pending': '#ffc107',
            'reviewed': '#17a2b8',
            'dismissed': '#6c757d',
            'action_taken': '#28a745',
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="color: {}; font-weight: bold;">● {}</span>', 
            color, 
            obj.get_status_display()
        )
    status_display.short_description = 'Status'
    status_display.admin_order_field = 'status'