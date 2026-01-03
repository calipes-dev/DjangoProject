# User/admin.py - Safe Version with All None Checks

from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Count, Sum, Avg, Q
from django.contrib import messages
from django.http import HttpResponse
import csv

from .models import (
    User, Class, Enrollment, Problem, ProblemTestCase, 
    Submission, ChatHistory, ProblemResource, EmailVerification
)


# ============================================
# ADMIN ACTIONS
# ============================================
@admin.action(description='✅ Export selected users to CSV')
def export_users_to_csv(modeladmin, request, queryset):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="users_export.csv"'
    
    writer = csv.writer(response)
    writer.writerow(['School ID', 'First Name', 'Last Name', 'Email', 'School', 'User Type', 'Status', 'Date Joined', 'Last Login'])
    
    for user in queryset:
        writer.writerow([
            user.school_id or 'N/A',
            user.first_name or 'N/A',
            user.last_name or 'N/A',
            user.email or 'N/A',
            user.get_school_display() if user.school else 'N/A',
            user.user_type or 'N/A',
            'Active' if user.is_active else 'Inactive',
            user.date_joined.strftime('%Y-%m-%d %H:%M:%S') if user.date_joined else 'N/A',
            user.last_login.strftime('%Y-%m-%d %H:%M:%S') if user.last_login else 'Never'
        ])
    
    return response


@admin.action(description='✅ Activate selected users')
def activate_users(modeladmin, request, queryset):
    updated = queryset.update(is_active=True)
    modeladmin.message_user(request, f"✅ {updated} users activated successfully.", messages.SUCCESS)


@admin.action(description='❌ Deactivate selected users')
def deactivate_users(modeladmin, request, queryset):
    updated = queryset.update(is_active=False)
    modeladmin.message_user(request, f"❌ {updated} users deactivated successfully.", messages.WARNING)


@admin.action(description='🔒 Reset passwords to default')
def reset_passwords(modeladmin, request, queryset):
    default_password = 'PauliCode2025'
    for user in queryset:
        user.set_password(default_password)
        user.save()
    
    modeladmin.message_user(
        request, 
        f"🔒 {queryset.count()} user passwords reset to '{default_password}'", 
        messages.SUCCESS
    )


@admin.action(description='👨‍🏫 Convert to Teacher')
def convert_to_teacher(modeladmin, request, queryset):
    updated = queryset.update(user_type='Teacher', is_staff=True)
    modeladmin.message_user(request, f"👨‍🏫 {updated} users converted to Teachers.", messages.SUCCESS)


@admin.action(description='👨‍🎓 Convert to Student')
def convert_to_student(modeladmin, request, queryset):
    updated = queryset.update(user_type='Student', is_staff=False, is_superuser=False)
    modeladmin.message_user(request, f"👨‍🎓 {updated} users converted to Students.", messages.SUCCESS)


@admin.action(description='🗑️ Delete with all related data')
def delete_with_cascade(modeladmin, request, queryset):
    count = queryset.count()
    queryset.delete()
    modeladmin.message_user(request, f"🗑️ {count} users and their related data deleted.", messages.SUCCESS)


# ============================================
# USER ADMIN
# ============================================
@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = (
        'school_id', 'first_name', 'last_name', 'email', 
        'user_type', 'is_active', 'date_joined'
    )
    list_filter = (
        'user_type', 'is_active', 'is_staff', 'is_superuser', 
        'school', 'date_joined'
    )
    search_fields = ('school_id', 'first_name', 'last_name', 'email')
    ordering = ('-date_joined',)
    readonly_fields = ('date_joined', 'last_login')
    actions = [
        export_users_to_csv, activate_users, deactivate_users,
        reset_passwords, convert_to_teacher, convert_to_student,
        delete_with_cascade
    ]
    
    list_per_page = 50
    
    fieldsets = (
        ('🔐 Account Information', {
            'fields': ('school_id', 'password', 'is_active'),
        }),
        ('👤 Personal Information', {
            'fields': ('first_name', 'last_name', 'email', 'school'),
        }),
        ('🎓 Academic Information', {
            'fields': ('user_type', 'user_image'),
        }),
        ('🔑 Permissions', {
            'fields': ('is_staff', 'is_superuser', 'groups', 'user_permissions'),
            'classes': ('collapse',),
        }),
        ('📅 Dates', {
            'fields': ('date_joined', 'last_login'),
            'classes': ('collapse',),
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if not change or 'password' in form.changed_data:
            if obj.password and not obj.password.startswith(('pbkdf2_sha256$', 'bcrypt', 'argon2')):
                obj.set_password(obj.password)
        super().save_model(request, obj, form, change)


# ============================================
# CLASS ADMIN
# ============================================
@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ('class_code', 'title', 'class_type', 'teacher', 'created_at')
    list_filter = ('class_type', 'teacher', 'created_at')
    search_fields = ('class_code', 'title', 'teacher__first_name', 'teacher__last_name')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)
    list_per_page = 30


# ============================================
# ENROLLMENT ADMIN
# ============================================
@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('enrollment_id', 'student_id', 'class_id', 'enrolled_at')
    list_filter = ('class_id',)
    search_fields = ('student_id__school_id', 'student_id__first_name', 'class_id__title')


# ============================================
# PROBLEM ADMIN
# ============================================
@admin.register(Problem)
class ProblemAdmin(admin.ModelAdmin):
    list_display = ('problem_title', 'class_id', 'problem_type', 'total_score', 'due_date', 'created_at')
    list_filter = ('problem_type', 'class_id', 'created_at')
    search_fields = ('problem_title', 'class_id__title')
    readonly_fields = ('created_at',)


# ============================================
# PROBLEM TEST CASE ADMIN
# ============================================
@admin.register(ProblemTestCase)
class ProblemTestCaseAdmin(admin.ModelAdmin):
    list_display = ('test_case_id', 'problem_id', 'created_at')
    list_filter = ('problem_id',)
    search_fields = ('problem_id__problem_title',)
    readonly_fields = ('created_at',)


# ============================================
# SUBMISSION ADMIN
# ============================================
@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ('submission_id', 'student_id', 'problem_id', 'score', 'status', 'submitted_at')
    list_filter = ('status', 'problem_id')
    search_fields = ('student_id__school_id', 'student_id__first_name', 'problem_id__problem_title')
    readonly_fields = ('submitted_at',)


# ============================================
# CHAT HISTORY ADMIN
# ============================================
@admin.register(ChatHistory)
class ChatHistoryAdmin(admin.ModelAdmin):
    list_display = ('chat_id', 'school_id', 'sender', 'timestamp')
    list_filter = ('sender',)
    search_fields = ('school_id__school_id', 'school_id__first_name', 'message')
    readonly_fields = ('timestamp',)


# ============================================
# PROBLEM RESOURCE ADMIN
# ============================================
@admin.register(ProblemResource)
class ProblemResourceAdmin(admin.ModelAdmin):
    list_display = ('resource_id', 'title', 'problem', 'file_extension', 'file_size', 'uploaded_at')
    list_filter = ('file_extension',)
    search_fields = ('title', 'problem__problem_title')
    readonly_fields = ('uploaded_at', 'original_filename', 'file_size', 'file_extension')


# ============================================
# EMAIL VERIFICATION ADMIN
# ============================================
@admin.register(EmailVerification)
class EmailVerificationAdmin(admin.ModelAdmin):
    list_display = ('email', 'code', 'first_name', 'last_name', 'is_used', 'created_at', 'expires_at')
    list_filter = ('is_used', 'created_at')
    search_fields = ('email', 'first_name', 'last_name', 'code')
    readonly_fields = ('created_at',)