# Announcement/views.py
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from django.db.models import Q, Count, Exists, OuterRef
from User.models import User, Class, Enrollment
from .models import Announcement, AnnouncementReaction, AnnouncementComment, AnnouncementPin, AnnouncementReport
import json


@login_required(login_url='index')
def announcement_board(request):
    """Main announcement board - shows all announcements from enrolled classes"""
    user = request.user
    
    # Get classes based on user type
    if user.user_type == 'Teacher':
        # Get classes where user is the teacher
        user_classes = Class.objects.filter(teacher=user).order_by('title')
        
        # Get announcements from teacher's classes OR posted by this teacher
        announcements = Announcement.objects.filter(
            Q(class_id__in=user_classes) | Q(teacher=user) | Q(class_id__isnull=True, teacher=user)
        ).select_related('teacher', 'class_id').prefetch_related(
            'reactions', 'comments', 'pins'
        ).distinct()
        
    else:  # Student
        # Get classes where student is enrolled
        user_classes = Class.objects.filter(
            enrollments__student_id=user
        ).distinct().order_by('title')
        
        # Get enrolled class IDs
        enrolled_class_ids = user_classes.values_list('class_id', flat=True)
        
        # Get announcements from:
        # 1. Classes the student is enrolled in
        # 2. Announcements posted to "All Classes" (class_id=NULL) by teachers of enrolled classes
        teacher_ids = user_classes.values_list('teacher_id', flat=True).distinct()
        
        announcements = Announcement.objects.filter(
            Q(class_id__in=enrolled_class_ids) | 
            Q(class_id__isnull=True, teacher_id__in=teacher_ids)
        ).select_related('teacher', 'class_id').prefetch_related(
            'reactions', 'comments', 'pins'
        ).distinct()
    
    # ✅ FIX: Filter by class if selected - ONLY show announcements for selected class
    selected_class_id = request.GET.get('class_id', 'all')
    
    # Convert to int for comparison if not 'all'
    if selected_class_id != 'all':
        try:
            class_id_int = int(selected_class_id)
            
            if user.user_type == 'Teacher':
                # ✅ STRICT FILTER: Only show announcements for THIS specific class
                # Do NOT include "All Classes" announcements when a specific class is selected
                announcements = announcements.filter(class_id__class_id=class_id_int)
                
            else:  # Student
                # Check if student is enrolled in that class
                if user_classes.filter(class_id=class_id_int).exists():
                    # ✅ STRICT FILTER: Only show announcements for THIS specific class
                    announcements = announcements.filter(class_id__class_id=class_id_int)
                else:
                    # Student not enrolled - show no announcements
                    announcements = announcements.none()
                    
        except (ValueError, Class.DoesNotExist):
            # Invalid class_id - show all announcements
            pass
    
    # Add user-specific data to each announcement
    for announcement in announcements:
        announcement.user_reaction = announcement.reactions.filter(user=user).first()
        announcement.is_pinned_by_user = announcement.pins.filter(user=user).exists()
    
    # Order by pinned status and date
    announcements = announcements.order_by('-is_pinned', '-created_at')
    
    context = {
        'user': user,
        'announcements': announcements,
        'user_classes': user_classes,
        'selected_class_id': selected_class_id,  # ✅ Keep as string for template comparison
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
        link = request.POST.get('link', '').strip()
        
        image = request.FILES.get('image')
        video = request.FILES.get('video')
        file = request.FILES.get('file')
        
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
            link=link if link else None,
            image=image,
            video=video,
            file=file
        )
        
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
    """Delete an announcement (teacher only)"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=400)
    
    try:
        announcement = get_object_or_404(Announcement, announcement_id=announcement_id)
        
        if announcement.teacher != request.user:
            return JsonResponse({'error': 'Permission denied'}, status=403)
        
        announcement.delete()
        
        return JsonResponse({'success': True})
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required(login_url='index')
def get_announcement_details(request, announcement_id):
    """Get full announcement details with comments"""
    try:
        announcement = get_object_or_404(
            Announcement.objects.select_related('teacher', 'class_id')
            .prefetch_related('comments__user', 'reactions'),
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
        for reaction in announcement.reactions.all():
            if reaction.reaction_type not in reactions_by_type:
                reactions_by_type[reaction.reaction_type] = []
            reactions_by_type[reaction.reaction_type].append({
                'user_name': f"{reaction.user.first_name} {reaction.user.last_name}"
            })
        
        user_reaction = announcement.reactions.filter(user=request.user).first()
        
        data = {
            'announcement_id': announcement.announcement_id,
            'title': announcement.title,
            'content': announcement.content,
            'teacher_name': f"{announcement.teacher.first_name} {announcement.teacher.last_name}",
            'teacher_image': announcement.teacher.user_image.url if announcement.teacher.user_image else None,
            'class_name': announcement.class_id.title if announcement.class_id else 'General',
            'class_id': announcement.class_id.class_id if announcement.class_id else None,  # FIX: Added class_id
            'created_at': announcement.created_at.strftime('%Y-%m-%d %H:%M'),
            'link': announcement.link,
            'image': announcement.image.url if announcement.image else None,
            'video': announcement.video.url if announcement.video else None,
            'file': announcement.file.url if announcement.file else None,
            'file_name': announcement.file.name.split('/')[-1] if announcement.file else None,
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
    
    # Check ownership
    if announcement.teacher != request.user:
        messages.error(request, "You don't have permission to edit this announcement.")
        return redirect('announcement:board')
    
    if request.method == 'POST':
        title = request.POST.get('title', '').strip()
        content = request.POST.get('content', '').strip()
        class_id = request.POST.get('class_id', '').strip()
        link = request.POST.get('link', '').strip()
        
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
        
        # Update announcement
        announcement.title = title
        announcement.content = content
        announcement.class_id = class_obj
        announcement.link = link if link else None
        
        # Handle file uploads
        if 'image' in request.FILES:
            announcement.image = request.FILES['image']
        if 'video' in request.FILES:
            announcement.video = request.FILES['video']
        if 'file' in request.FILES:
            announcement.file = request.FILES['file']
        
        announcement.save()
        
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