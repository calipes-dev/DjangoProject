# User/admin.py
from django.contrib import admin
from django.utils.html import format_html
from .models import User, Class, Enrollment, Problem, ProblemTestCase, Submission, ChatHistory
from django.contrib.admin import AdminSite
from django.db.models import Count, Sum, Avg
from django.utils.timezone import now
from datetime import timedelta

class PauliCodeAdminSite(AdminSite):
    site_header = "PauliCode Administration"
    site_title = "PauliCode Admin Portal"
    index_title = "Welcome to PauliCode Admin Dashboard"
    
    def index(self, request, extra_context=None):
        from .models import User, Class, Problem, Submission
        
        extra_context = extra_context or {}
        week_ago = now() - timedelta(days=7)
        
        # User statistics
        extra_context['total_users'] = User.objects.count()
        extra_context['total_teachers'] = User.objects.filter(user_type='Teacher').count()
        extra_context['total_students'] = User.objects.filter(user_type='Student').count()
        extra_context['recent_users'] = User.objects.filter(date_joined__gte=week_ago).count()
        
        # Class statistics
        extra_context['total_classes'] = Class.objects.count()
        extra_context['programming_classes'] = Class.objects.filter(class_type='programming').count()
        extra_context['cybersecurity_classes'] = Class.objects.filter(class_type='cybersecurity').count()
        
        # Problem statistics
        extra_context['total_problems'] = Problem.objects.count()
        extra_context['total_assignments'] = Problem.objects.filter(problem_type='Assignment').count()
        extra_context['total_quizzes'] = Problem.objects.filter(problem_type='Quiz').count()
        
        # Submission statistics
        extra_context['total_submissions'] = Submission.objects.count()
        extra_context['recent_submissions'] = Submission.objects.filter(submitted_at__gte=week_ago).count()
        extra_context['avg_score'] = Submission.objects.aggregate(avg=Avg('score'))['avg'] or 0
        
        # Top performers
        extra_context['top_students'] = (
            Submission.objects
            .values('student_id__school_id', 'student_id__first_name', 'student_id__last_name')
            .annotate(total_score=Sum('score'))
            .order_by('-total_score')[:5]
        )
        
        # Most active classes
        extra_context['active_classes'] = (
            Submission.objects
            .values('problem_id__class_id__title')
            .annotate(submission_count=Count('submission_id'))
            .order_by('-submission_count')[:5]
        )
        
        # Recent activity
        extra_context['recent_activity'] = (
            Submission.objects
            .select_related('student_id', 'problem_id')
            .order_by('-submitted_at')[:10]
        )
        
        return super().index(request, extra_context)

# Use custom admin site
admin.site = PauliCodeAdminSite()


@admin.action(description='Export selected users to CSV')
def export_users_to_csv(modeladmin, request, queryset):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="users.csv"'
    
    writer = csv.writer(response)
    writer.writerow(['School ID', 'First Name', 'Last Name', 'User Type', 'Date Joined'])
    
    for user in queryset:
        writer.writerow([
            user.school_id,
            user.first_name,
            user.last_name,
            user.user_type,
            user.date_joined.strftime('%Y-%m-%d %H:%M:%S')
        ])
    
    return response

@admin.action(description='Mark submissions as graded')
def mark_as_graded(modeladmin, request, queryset):
    queryset.update(status='Graded')
    modeladmin.message_user(request, f"{queryset.count()} submissions marked as graded.")
    
@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('school_id', 'first_name', 'last_name', 'user_type', 'image_preview', 'date_joined')
    list_filter = ('user_type', 'date_joined')
    search_fields = ('school_id', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    readonly_fields = ('date_joined', 'image_preview')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('school_id', 'first_name', 'last_name', 'user_type')
        }),
        ('Authentication', {
            'fields': ('password',),
            'description': 'Password is stored as a hashed value for security.'
        }),
        ('Profile', {
            'fields': ('user_image', 'image_preview')
        }),
        ('Metadata', {
            'fields': ('date_joined',),
            'classes': ('collapse',)
        }),
    )
    
    def image_preview(self, obj):
        """Display user profile image in admin"""
        if obj.user_image:
            return format_html(
                '<img src="{}" width="50" height="50" style="border-radius: 50%; object-fit: cover;" />',
                obj.user_image.url
            )
        return "No Image"
    image_preview.short_description = 'Profile Picture'


@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ('class_code', 'title', 'teacher', 'icon_preview', 'created_at')
    list_filter = ('teacher', 'created_at')
    search_fields = ('class_code', 'title', 'teacher__first_name', 'teacher__last_name')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'icon_preview')
    
    fieldsets = (
        ('Class Information', {
            'fields': ('class_code', 'title', 'description', 'teacher')
        }),
        ('Visual', {
            'fields': ('upload_icon', 'icon_preview')
        }),
        ('Metadata', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    def icon_preview(self, obj):
        """Display class icon in admin"""
        if obj.upload_icon:
            return format_html(
                '<img src="{}" width="50" height="50" style="border-radius: 8px; object-fit: cover;" />',
                obj.upload_icon.url
            )
        return "No Icon"
    icon_preview.short_description = 'Class Icon'


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('enrollment_id', 'student_name', 'class_name', 'enrolled_at')
    list_filter = ('enrolled_at', 'class_id')
    search_fields = ('student_id__first_name', 'student_id__last_name', 'class_id__title')
    ordering = ('-enrolled_at',)
    readonly_fields = ('enrolled_at',)
    
    def student_name(self, obj):
        return obj.student_id.get_full_name()
    student_name.short_description = 'Student'
    
    def class_name(self, obj):
        return obj.class_id.title
    class_name.short_description = 'Class'


@admin.register(Problem)
class ProblemAdmin(admin.ModelAdmin):
    list_display = ('problem_title', 'problem_type', 'class_name', 'teacher_name', 'total_score', 'due_date', 'created_at')
    list_filter = ('problem_type', 'created_at', 'due_date')
    search_fields = ('problem_title', 'class_id__title', 'teacher_id__first_name')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)
    
    fieldsets = (
        ('Problem Details', {
            'fields': ('problem_title', 'problem_description', 'problem_type')
        }),
        ('Assignment', {
            'fields': ('class_id', 'teacher_id')
        }),
        ('Grading', {
            'fields': ('total_score', 'time_limit', 'due_date')
        }),
        ('Metadata', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    def class_name(self, obj):
        return obj.class_id.title
    class_name.short_description = 'Class'
    
    def teacher_name(self, obj):
        return obj.teacher_id.get_full_name()
    teacher_name.short_description = 'Teacher'


@admin.register(ProblemTestCase)
class ProblemTestCaseAdmin(admin.ModelAdmin):
    list_display = ('test_case_id', 'problem_title', 'input_preview', 'output_preview', 'created_at')
    list_filter = ('created_at', 'problem_id')
    search_fields = ('problem_id__problem_title',)
    ordering = ('problem_id', 'test_case_id')
    readonly_fields = ('created_at',)
    
    def problem_title(self, obj):
        return obj.problem_id.problem_title
    problem_title.short_description = 'Problem'
    
    def input_preview(self, obj):
        if obj.input_data:
            preview = obj.input_data[:50]
            return preview + '...' if len(obj.input_data) > 50 else preview
        return "No Input"
    input_preview.short_description = 'Input'
    
    def output_preview(self, obj):
        if obj.expected_output:
            preview = obj.expected_output[:50]
            return preview + '...' if len(obj.expected_output) > 50 else preview
        return "No Output"
    output_preview.short_description = 'Expected Output'


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ('submission_id', 'student_name', 'problem_title', 'score', 'status', 'submitted_at')
    list_filter = ('status', 'submitted_at', 'problem_id__problem_type')
    search_fields = ('student_id__first_name', 'student_id__last_name', 'problem_id__problem_title')
    ordering = ('-submitted_at',)
    readonly_fields = ('submitted_at', 'code_preview')
    
    fieldsets = (
        ('Submission Info', {
            'fields': ('problem_id', 'student_id', 'submitted_at')
        }),
        ('Code', {
            'fields': ('code_preview',)
        }),
        ('Grading', {
            'fields': ('score', 'status', 'feedback')
        }),
    )
    
    def student_name(self, obj):
        return obj.student_id.get_full_name()
    student_name.short_description = 'Student'
    
    def problem_title(self, obj):
        return obj.problem_id.problem_title
    problem_title.short_description = 'Problem'
    
    def code_preview(self, obj):
        """Display code in a readable format"""
        if obj.code:
            return format_html(
                '<pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; max-height: 300px; overflow-y: auto;">{}</pre>',
                obj.code[:500] + ('...' if len(obj.code) > 500 else '')
            )
        return "No Code"
    code_preview.short_description = 'Code Preview'


@admin.register(ChatHistory)
class ChatHistoryAdmin(admin.ModelAdmin):
    list_display = ('chat_id', 'user_name', 'sender', 'message_preview', 'timestamp')
    list_filter = ('sender', 'timestamp')
    search_fields = ('school_id__first_name', 'school_id__last_name', 'message')
    ordering = ('-timestamp',)
    readonly_fields = ('timestamp',)
    
    def user_name(self, obj):
        return obj.school_id.get_full_name()
    user_name.short_description = 'User'
    
    def message_preview(self, obj):
        preview = obj.message[:100]
        return preview + '...' if len(obj.message) > 100 else preview
    message_preview.short_description = 'Message'