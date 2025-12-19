from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from django.db.models import Q, Count, Exists, OuterRef
from User.models import User, Class, Enrollment
from .models import (Announcement, AnnouncementReaction, AnnouncementComment, 
                     AnnouncementPin, AnnouncementReport, AnnouncementFile, AnnouncementLink)
import json


@login_required(login_url='index')
def announcement_board(request):
    """Main announcement board - shows all announcements from enrolled classes"""
    user = request.user
    
    # Get classes based on user type
    if user.user_type == 'Teacher':
        user_classes = Class.objects.filter(teacher=user).order_by('title')
        announcements = Announcement.objects.filter(
            Q(class_id__in=user_classes) | Q(teacher=user) | Q(class_id__isnull=True, teacher=user)
        ).select_related('teacher', 'class_id').prefetch_related(
            'reactions', 'comments', 'pins', 'files', 'links'
        ).distinct()
        
    else:  # Student
        user_classes = Class.objects.filter(
            enrollments__student_id=user
        ).distinct().order_by('title')
        
        enrolled_class_ids = user_classes.values_list('class_id', flat=True)
        teacher_ids = user_classes.values_list('teacher_id', flat=True).distinct()
        
        announcements = Announcement.objects.filter(
            Q(class_id__in=enrolled_class_ids) | 
            Q(class_id__isnull=True, teacher_id__in=teacher_ids)
        ).select_related('teacher', 'class_id').prefetch_related(
            'reactions', 'comments', 'pins', 'files', 'links'
        ).distinct()
    
    # Filter by class if selected
    selected_class_id = request.GET.get('class_id', 'all')
    
    if selected_class_id != 'all':
        try:
            class_id_int = int(selected_class_id)
            
            if user.user_type == 'Teacher':
                announcements = announcements.filter(class_id__class_id=class_id_int)
            else:
                if user_classes.filter(class_id=class_id_int).exists():
                    announcements = announcements.filter(class_id__class_id=class_id_int)
                else:
                    announcements = announcements.none()
                    
        except (ValueError, Class.DoesNotExist):
            pass
    
    # Add user-specific data to each announcement
    for announcement in announcements:
        announcement.user_reaction = announcement.reactions.filter(user=user).first()
        announcement.is_pinned_by_user = announcement.pins.filter(user=user).exists()
    
    announcements = announcements.order_by('-is_pinned', '-created_at')
    
    context = {
        'user': user,
        'announcements': announcements,
        'user_classes': user_classes,
        'selected_class_id': selected_class_id,
        'currentpage': 'announcement',
        'sidebar': 'teacher' if user.user_type == 'Teacher' else 'student'
    }
    
    return render(request, 'Universal/announcement_board.html', context)


@login_required(login_url='index')
def create_announcement(request):
    """Create a new announcement (Teachers only)"""
    if request.user.user_type != 'Teacher':
        messages.error(request, "Only teachers can create announcements.")
        return redirect('announcement:board')
    
    if request.method == 'POST':
        title = request.POST.get('title', '').strip()
        content = request.POST.get('content', '').strip()
        class_id = request.POST.get('class_id', '').strip()
        
        # Get single attachments
        image = request.FILES.get('image')
        video = request.FILES.get('video')
        
        # Validation
        if not title or not content:
            messages.error(request, "Title and content are required.")
            return redirect('announcement:board')
        
        # Get class if specified
        class_obj = None
        if class_id and class_id != 'all':
            try:
                class_obj = Class.objects.get(class_id=class_id, teacher=request.user)
            except Class.DoesNotExist:
                messages.error(request, "Invalid class selected.")
                return redirect('announcement:board')
        
        # Create announcement
        announcement = Announcement.objects.create(
            teacher=request.user,
            class_id=class_obj,
            title=title,
            content=content,
            image=image,
            video=video
        )
        
        # Handle multiple files
        files = request.FILES.getlist('files')
        for file in files:
            AnnouncementFile.objects.create(
                announcement=announcement,
                file=file,
                file_name=file.name,
                file_size=file.size
            )
        
        # Handle multiple links
        links_data = request.POST.get('links_json', '[]')
        try:
            links = json.loads(links_data)
            for link_item in links:
                if link_item.get('url'):
                    AnnouncementLink.objects.create(
                        announcement=announcement,
                        url=link_item['url'],
                        title=link_item.get('title', '')
                    )
        except json.JSONDecodeError:
            pass
        
        messages.success(request, "Announcement posted successfully!")
        return redirect('announcement:board')
    
    return redirect('announcement:board')


@login_required(login_url='index')
@csrf_exempt
def toggle_reaction(request, announcement_id):
    """Toggle reaction on an announcement"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=400)
    
    try:
        data = json.loads(request.body)
        reaction_type = data.get('reaction_type')
        
        announcement = get_object_or_404(Announcement, announcement_id=announcement_id)
        
        # Check if user already reacted
        existing_reaction = AnnouncementReaction.objects.filter(
            announcement=announcement,
            user=request.user
        ).first()
        
        if existing_reaction:
            if existing_reaction.reaction_type == reaction_type:
                # Remove reaction if same type
                existing_reaction.delete()
                return JsonResponse({
                    'success': True,
                    'action': 'removed',
                    'total_reactions': announcement.total_reactions
                })
            else:
                # Update reaction type
                existing_reaction.reaction_type = reaction_type
                existing_reaction.save()
                return JsonResponse({
                    'success': True,
                    'action': 'updated',
                    'reaction_type': reaction_type,
                    'total_reactions': announcement.total_reactions
                })
        else:
            # Create new reaction
            AnnouncementReaction.objects.create(
                announcement=announcement,
                user=request.user,
                reaction_type=reaction_type
            )
            return JsonResponse({
                'success': True,
                'action': 'added',
                'reaction_type': reaction_type,
                'total_reactions': announcement.total_reactions
            })
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required(login_url='index')
@csrf_exempt
def add_comment(request, announcement_id):
    """Add a comment to an announcement"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=400)
    
    try:
        data = json.loads(request.body)
        content = data.get('content', '').strip()
        
        if not content:
            return JsonResponse({'error': 'Comment cannot be empty'}, status=400)
        
        announcement = get_object_or_404(Announcement, announcement_id=announcement_id)
        
        comment = AnnouncementComment.objects.create(
            announcement=announcement,
            user=request.user,
            content=content
        )
        
        return JsonResponse({
            'success': True,
            'comment': {
                'comment_id': comment.comment_id,
                'content': comment.content,
                'user_name': f"{comment.user.first_name} {comment.user.last_name}",
                'user_image': comment.user.user_image.url if comment.user.user_image else None,
                'created_at': comment.created_at.strftime('%Y-%m-%d %H:%M'),
                'is_owner': comment.user == request.user
            },
            'total_comments': announcement.total_comments
        })
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required(login_url='index')
@csrf_exempt
def delete_comment(request, comment_id):
    """Delete a comment (owner only)"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=400)
    
    try:
        comment = get_object_or_404(AnnouncementComment, comment_id=comment_id)
        
        if comment.user != request.user:
            return JsonResponse({'error': 'Permission denied'}, status=403)
        
        announcement_id = comment.announcement.announcement_id
        comment.delete()
        
        announcement = Announcement.objects.get(announcement_id=announcement_id)
        
        return JsonResponse({
            'success': True,
            'total_comments': announcement.total_comments
        })
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required(login_url='index')
@csrf_exempt
def toggle_pin(request, announcement_id):
    """Toggle pin status for a student"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=400)
    
    try:
        announcement = get_object_or_404(Announcement, announcement_id=announcement_id)
        
        existing_pin = AnnouncementPin.objects.filter(
            announcement=announcement,
            user=request.user
        ).first()
        
        if existing_pin:
            existing_pin.delete()
            return JsonResponse({
                'success': True,
                'action': 'unpinned',
                'is_pinned': False
            })
        else:
            AnnouncementPin.objects.create(
                announcement=announcement,
                user=request.user
            )
            return JsonResponse({
                'success': True,
                'action': 'pinned',
                'is_pinned': True
            })
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required(login_url='index')
@csrf_exempt
def delete_announcement(request, announcement_id):
    """Delete an announcement (teacher only) - also deletes all related files"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=400)
    
    try:
        announcement = get_object_or_404(Announcement, announcement_id=announcement_id)
        
        if announcement.teacher != request.user:
            return JsonResponse({'error': 'Permission denied'}, status=403)
        
        # Get all associated files before deletion
        associated_files = announcement.files.all()
        file_count = associated_files.count()
        
        # Delete associated files from storage and database (cascade handles DB deletion)
        for file_obj in associated_files:
            if file_obj.file:
                # Delete the file from storage
                if file_obj.file.storage.exists(file_obj.file.name):
                    file_obj.file.delete(save=False)
        
        # Delete the announcement (cascade will delete related AnnouncementFile, AnnouncementLink, etc.)
        announcement.delete()
        
        return JsonResponse({
            'success': True, 
            'message': f'Announcement deleted successfully with {file_count} attached files'
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)


@login_required(login_url='index')
def get_announcement_details(request, announcement_id):
    """Get full announcement details with comments and reactions"""
    try:
        announcement = get_object_or_404(
            Announcement.objects.select_related('teacher', 'class_id')
            .prefetch_related('comments__user', 'reactions__user', 'files', 'links'),
            announcement_id=announcement_id
        )
        
        comments = [{
            'comment_id': comment.comment_id,
            'content': comment.content,
            'user_name': f"{comment.user.first_name} {comment.user.last_name}",
            'user_image': comment.user.user_image.url if comment.user.user_image else None,
            'created_at': comment.created_at.strftime('%Y-%m-%d %H:%M'),
            'is_owner': comment.user == request.user
        } for comment in announcement.comments.all()]
        
        # Group reactions by type
        reactions_by_type = {}
        for reaction in announcement.reactions.select_related('user').all():
            if reaction.reaction_type not in reactions_by_type:
                reactions_by_type[reaction.reaction_type] = []
            
            user_image_url = None
            if reaction.user.user_image:
                if hasattr(reaction.user.user_image, 'url'):
                    user_image_url = reaction.user.user_image.url
            
            reactions_by_type[reaction.reaction_type].append({
                'user_name': f"{reaction.user.first_name} {reaction.user.last_name}",
                'user_image': user_image_url
            })
        
        # Get files
        files = [{
            'file_id': f.file_id,
            'file_url': f.file.url,
            'file_name': f.file_name,
            'file_size': f.get_file_size_display()
        } for f in announcement.files.all()]
        
        # Get links
        links = [{
            'link_id': link.link_id,
            'url': link.url,
            'title': link.title
        } for link in announcement.links.all()]
        
        user_reaction = announcement.reactions.filter(user=request.user).first()
        
        # Get image and video URLs
        image_url = None
        video_url = None
        
        if announcement.image:
            image_url = announcement.image.url if hasattr(announcement.image, 'url') else str(announcement.image)
        
        if announcement.video:
            video_url = announcement.video.url if hasattr(announcement.video, 'url') else str(announcement.video)
        
        data = {
            'announcement_id': announcement.announcement_id,
            'title': announcement.title,
            'content': announcement.content,
            'teacher_name': f"{announcement.teacher.first_name} {announcement.teacher.last_name}",
            'teacher_image': announcement.teacher.user_image.url if announcement.teacher.user_image else None,
            'class_name': announcement.class_id.title if announcement.class_id else 'General',
            'class_id': announcement.class_id.class_id if announcement.class_id else None,
            'created_at': announcement.created_at.strftime('%Y-%m-%d %H:%M'),
            'image': image_url,
            'video': video_url,
            'files': files,
            'links': links,
            'comments': comments,
            'total_reactions': announcement.total_reactions,
            'reactions_by_type': reactions_by_type,
            'user_reaction': user_reaction.reaction_type if user_reaction else None,
            'is_owner': announcement.teacher == request.user,
            'is_pinned': announcement.pins.filter(user=request.user).exists()
        }
        
        return JsonResponse(data)
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required(login_url='index')
@csrf_exempt
def report_announcement(request, announcement_id):
    """Report an announcement (students only)"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=400)
    
    try:
        data = json.loads(request.body)
        reason = data.get('reason', '').strip()
        
        if not reason:
            return JsonResponse({'error': 'Reason is required'}, status=400)
        
        announcement = get_object_or_404(Announcement, announcement_id=announcement_id)
        
        # TODO: Store report in database or send email to admin
        # For now, just log it
        print(f"Report: User {request.user.school_id} reported announcement {announcement_id}: {reason}")
        
        return JsonResponse({'success': True, 'message': 'Report submitted'})
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required(login_url='index')
@csrf_exempt
def toggle_teacher_pin(request, announcement_id):
    """Toggle pin to top (teacher only)"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=400)
    
    try:
        announcement = get_object_or_404(Announcement, announcement_id=announcement_id)
        
        if announcement.teacher != request.user:
            return JsonResponse({'error': 'Permission denied'}, status=403)
        
        announcement.is_pinned = not announcement.is_pinned
        announcement.save()
        
        return JsonResponse({
            'success': True,
            'is_pinned': announcement.is_pinned
        })
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
    

@login_required(login_url='index')
def edit_announcement(request, announcement_id):
    """Edit an announcement (Teachers only)"""
    if request.user.user_type != 'Teacher':
        messages.error(request, "Only teachers can edit announcements.")
        return redirect('announcement:board')
    
    announcement = get_object_or_404(Announcement, announcement_id=announcement_id)
    
    if announcement.teacher != request.user:
        messages.error(request, "You don't have permission to edit this announcement.")
        return redirect('announcement:board')
    
    if request.method == 'POST':
        title = request.POST.get('title', '').strip()
        content = request.POST.get('content', '').strip()
        class_id = request.POST.get('class_id', '').strip()
        
        if not title or not content:
            messages.error(request, "Title and content are required.")
            return redirect('announcement:board')
        
        # Get class if specified
        class_obj = None
        if class_id and class_id != 'all':
            try:
                class_obj = Class.objects.get(class_id=class_id, teacher=request.user)
            except Class.DoesNotExist:
                messages.error(request, "Invalid class selected.")
                return redirect('announcement:board')
        
        # Update announcement
        announcement.title = title
        announcement.content = content
        announcement.class_id = class_obj
        
        # Handle single file uploads
        if 'image' in request.FILES:
            announcement.image = request.FILES['image']
        if 'video' in request.FILES:
            announcement.video = request.FILES['video']
        
        announcement.save()
        
        # Handle multiple files (append new ones)
        files = request.FILES.getlist('files')
        for file in files:
            AnnouncementFile.objects.create(
                announcement=announcement,
                file=file,
                file_name=file.name,
                file_size=file.size
            )
        
        # Handle links update
        links_data = request.POST.get('links_json', '[]')
        try:
            links = json.loads(links_data)
            # Delete existing links and recreate
            announcement.links.all().delete()
            for link_item in links:
                if link_item.get('url'):
                    AnnouncementLink.objects.create(
                        announcement=announcement,
                        url=link_item['url'],
                        title=link_item.get('title', '')
                    )
        except json.JSONDecodeError:
            pass
        
        messages.success(request, "Announcement updated successfully!")
        return redirect('announcement:board')
    
    return redirect('announcement:board')


@login_required(login_url='index')
@csrf_exempt
def report_announcement(request, announcement_id):
    """Report an announcement (students only)"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=400)
    
    try:
        data = json.loads(request.body)
        reason = data.get('reason', '').strip()
        
        if not reason:
            return JsonResponse({'error': 'Reason is required'}, status=400)
        
        announcement = get_object_or_404(Announcement, announcement_id=announcement_id)
        
        # Check if already reported by this user
        if AnnouncementReport.objects.filter(
            announcement=announcement,
            reporter=request.user
        ).exists():
            return JsonResponse({
                'error': 'You have already reported this announcement.'
            }, status=400)
        
        # Create report
        AnnouncementReport.objects.create(
            announcement=announcement,
            reporter=request.user,
            reason=reason
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Report submitted successfully. We will review it shortly.'
        })
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
    

@login_required(login_url='index')
@csrf_exempt
def delete_file(request, file_id):
    """Delete a specific file attachment"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=400)
    
    try:
        file = get_object_or_404(AnnouncementFile, file_id=file_id)
        
        if file.announcement.teacher != request.user:
            return JsonResponse({'error': 'Permission denied'}, status=403)
        
        file.delete()
        
        return JsonResponse({'success': True})
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)