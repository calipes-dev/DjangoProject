# Announcement/models.py
from django.db import models
from User.models import User, Class
from django.utils import timezone


class Announcement(models.Model):
    """Teacher announcement posts"""
    announcement_id = models.AutoField(primary_key=True)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='announcements')
    class_id = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='announcements', null=True, blank=True)
    
    # Content
    title = models.CharField(max_length=200)
    content = models.TextField()
    
    # Single attachments
    image = models.ImageField(upload_to='announcements/images/', null=True, blank=True)
    video = models.FileField(upload_to='announcements/videos/', null=True, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    is_pinned = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-is_pinned', '-created_at']
    
    def __str__(self):
        return f"{self.title} by {self.teacher.first_name}"
    
    @property
    def total_reactions(self):
        return self.reactions.count()
    
    @property
    def total_comments(self):
        return self.comments.count()


# NEW: Separate model for multiple files
class AnnouncementFile(models.Model):
    """Multiple file attachments for announcements"""
    file_id = models.AutoField(primary_key=True)
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='files')
    file = models.FileField(upload_to='announcements/files/')
    file_name = models.CharField(max_length=255)
    file_size = models.IntegerField(default=0)  # Size in bytes
    uploaded_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        ordering = ['uploaded_at']
    
    def __str__(self):
        return f"{self.file_name} - {self.announcement.title}"
    
    def get_file_size_display(self):
        """Convert bytes to human readable format"""
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"


# NEW: Separate model for multiple links
class AnnouncementLink(models.Model):
    """Multiple link attachments for announcements"""
    link_id = models.AutoField(primary_key=True)
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='links')
    url = models.URLField(max_length=500)
    title = models.CharField(max_length=200, blank=True)  # Optional custom title
    added_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        ordering = ['added_at']
    
    def __str__(self):
        return f"{self.title or self.url} - {self.announcement.title}"


class AnnouncementReaction(models.Model):
    """Student reactions to announcements"""
    REACTION_CHOICES = [
        ('like', '👍'),
        ('love', '❤️'),
        ('celebrate', '🎉'),
        ('insightful', '💡'),
        ('curious', '🤔'),
    ]
    
    reaction_id = models.AutoField(primary_key=True)
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='announcement_reactions')
    reaction_type = models.CharField(max_length=20, choices=REACTION_CHOICES)
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        unique_together = ('announcement', 'user')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.first_name} reacted {self.reaction_type} to {self.announcement.title}"


class AnnouncementComment(models.Model):
    """Student comments on announcements"""
    comment_id = models.AutoField(primary_key=True)
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='announcement_comments')
    content = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['created_at']
    
    def __str__(self):
        return f"Comment by {self.user.first_name} on {self.announcement.title}"


class AnnouncementPin(models.Model):
    """Track which announcements students have pinned"""
    pin_id = models.AutoField(primary_key=True)
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='pins')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pinned_announcements')
    pinned_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        unique_together = ('announcement', 'user')
        ordering = ['-pinned_at']
    
    def __str__(self):
        return f"{self.user.first_name} pinned {self.announcement.title}"


class AnnouncementReport(models.Model):
    """Student reports on announcements"""
    report_id = models.AutoField(primary_key=True)
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='reports')
    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='announcement_reports')
    reason = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('reviewed', 'Reviewed'),
            ('dismissed', 'Dismissed'),
            ('action_taken', 'Action Taken')
        ],
        default='pending'
    )
    reported_at = models.DateTimeField(default=timezone.now)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    admin_notes = models.TextField(blank=True, null=True)
    
    class Meta:
        db_table = 'announcement_report'
        ordering = ['-reported_at']
        unique_together = ('announcement', 'reporter')
    
    def __str__(self):
        return f"Report by {self.reporter.first_name} on {self.announcement.title}"