from django.shortcuts import render, redirect, get_object_or_404
from .models import User, Class, Problem, Enrollment, ProblemTestCase, Submission, ChatHistory
from django.contrib import messages
from datetime import datetime, timedelta
from django.core.cache import cache
from django.http import JsonResponse, StreamingHttpResponse, HttpResponse
import json, requests, subprocess, tempfile, os, shutil
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.urls import reverse
from django.db.models import Q, Sum, Max, F, Exists, OuterRef
from django.core.serializers.json import DjangoJSONEncoder
from django.utils.html import escape
from django.db import IntegrityError
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
import logging
from google import genai
import re, time


# ---------------- LOGIN & DASHBOARD ---------------- #

def index(request):
    school_id = request.session.get('school_id')
    if school_id:
        user_type = request.session.get('user_type')
        if user_type == 'Teacher':
            return redirect('dashboard')
        else:
            return redirect('StudentDashboard')
    return render(request, 'User/index.html', {'currentpage': 'index'})



def login_view(request):
    if request.method == 'POST':
        school_id = request.POST.get('school_id', '').strip()
        password = request.POST.get('password', '').strip()

        try:
            user = User.objects.get(school_id=school_id, password=password)
            
            # Store user data in session
            request.session['school_id'] = user.school_id
            request.session['first_name'] = user.first_name
            request.session['last_name'] = user.last_name
            request.session['user_image'] = user.user_image.url if user.user_image else None
            request.session['user_type'] = user.user_type

            messages.success(request, f"Welcome back, {user.first_name}!")

            # Redirect based on user type
            if user.user_type == 'Teacher':
                return redirect('dashboard')  # make sure 'dashboard' exists in urls.py
            else:
                return redirect('StudentDashboard')  

        except User.DoesNotExist:
            messages.error(request, "Invalid School ID or Password.")
            return redirect('index')

    # Render login page
    return render(request, 'User/index.html')


#-------------TEACHER DASHBOARD----------------------#
def dashboard(request):
    school_id = request.session.get('school_id')

    if not school_id:
        messages.warning(request, "Please log in first.")
        return redirect('index')

    user = User.objects.filter(school_id=school_id).first()

    # ✅ Annotate each class with whether it has any submissions (available scores)
    classes = (
        Class.objects
        .filter(teacher=user)
        .annotate(
            has_scores=Exists(
                Submission.objects.filter(problem_id__class_id=OuterRef('pk'))
            )
        )
        .order_by('-has_scores', '-class_id')  # ✅ Classes with scores first
    )

    # ✅ Find the top scorer for each class created by this teacher
    top_scorers = []
    for c in classes:
        top_submission = (
            Submission.objects
            .filter(problem_id__class_id=c)
            .values(
                'student_id__first_name',
                'student_id__last_name',
                'student_id__school_id'
            )
            .annotate(total_score=Sum('score'))
            .order_by('-total_score')
            .first()
        )
        top_scorers.append({
            'class': c,
            'top_scorer': top_submission
        })

    # ✅ Leaderboard: All students ranked by total score (across all teacher’s classes)
    leaderboard = (
        Submission.objects
        .filter(problem_id__class_id__teacher=user)
        .values('student_id__first_name', 'student_id__last_name', 'student_id__school_id')
        .annotate(total_score=Sum('score'))
        .order_by('-total_score')[:10]
    )

    # ✅ Compute rank for all students under this teacher (based on total score)
    all_scores = (
        Submission.objects
        .filter(problem_id__class_id__teacher=user)
        .values('student_id')
        .annotate(total_score=Sum('score'))
        .order_by('-total_score')
    )

    rank = None  # Teachers don’t have rank, but structure preserved for consistency

    return render(request, 'User/dashboard.html', {
        'currentpage': 'dashboard',
        'user': user,
        'classes': classes,
        'leaderboard': leaderboard,
        'rank': rank,
        'top_scorers': top_scorers,
    })


    

def logout_view(request):
    request.session.flush()  # Clears all session data
    messages.success(request, "You have been logged out successfully.")
    return redirect('index')


# ---------------- SIGNUP ---------------- #

def signup(request):
    if request.method == 'POST':
        first_name = request.POST.get('first_name', '').strip()
        last_name = request.POST.get('last_name', '').strip()
        school_id = request.POST.get('school_id', '').strip()
        user_type = request.POST.get('user_type', '').strip()
        password = request.POST.get('password', '').strip()
        confirm_password = request.POST.get('confirm_password', '').strip()
        user_image = request.FILES.get('user_image')  # handle uploaded file

        context = {
            'first_name': first_name,
            'last_name': last_name,
            'school_id': school_id,
            'user_type': user_type,
        }

        # ✅ Validate inputs
        if not all([first_name, last_name, school_id, user_type, password, confirm_password]):
            messages.error(request, "Please fill in all fields.")
            return render(request, 'User/sign-up.html', context)

        if password != confirm_password:
            messages.error(request, "Passwords do not match.")
            return render(request, 'User/sign-up.html', context)

        if User.objects.filter(school_id=school_id).exists():
            messages.error(request, "School ID already exists.")
            return render(request, 'User/sign-up.html', context)

        # ✅ Create new user
        user = User.objects.create(
            school_id=school_id,
            first_name=first_name,
            last_name=last_name,
            password=password,
            user_type=user_type.capitalize(),
            user_image=user_image if user_image else 'profile_pic/default.png'
        )

        messages.success(request, "Account created successfully! Please log in.")
        return redirect('index')  # ✅ Redirect to index.html (login page)

    return render(request, 'User/sign-up.html', {'currentpage': 'sign-up'})



# ---------------- CLASS MANAGEMENT ---------------- #

def create_class(request):
    if request.method == "POST":
        class_code = request.POST.get("class_code")
        title = request.POST.get("title")
        description = request.POST.get("description")
        upload_icon = request.FILES.get("upload_icon")

        teacher = User.objects.get(school_id=request.session.get("school_id"))

        # Prevent duplicate class codes
        if Class.objects.filter(class_code=class_code).exists():
            messages.error(request, "Class code already exists.")
            # Redirect back to the same page (MyClasses or dashboard)
            previous_page = request.META.get('HTTP_REFERER', '')
            if 'MyClasses' in previous_page:
                return redirect('MyClasses')
            return redirect('dashboard')

        # Create the class
        Class.objects.create(
            class_code=class_code,
            title=title,
            description=description,
            upload_icon=upload_icon,
            teacher=teacher
        )
        messages.success(request, "Class created successfully!")

        # Redirect to the same page where the request came from
        previous_page = request.META.get('HTTP_REFERER', '')
        if 'MyClasses' in previous_page:
            return redirect('MyClasses')
        return redirect('dashboard')

    return redirect('dashboard')

def MyClasses(request):
    school_id = request.session.get('school_id')
    if not school_id:
        messages.warning(request, "Please log in first.")
        return redirect('index')

    teacher = User.objects.filter(school_id=school_id).first()
    classes = Class.objects.filter(teacher=teacher).order_by('-class_id')  # use class_id

    return render(request, 'User/MyClasses.html', {
        'currentpage': 'MyClasses',
        'user': teacher,
        'classes': classes,
    })



def delete_class(request, class_id):
    """Deletes a class created by the teacher and redirects to the appropriate page."""
    school_id = request.session.get('school_id')
    if not school_id:
        messages.warning(request, "Please log in first.")
        return redirect('index')

    # Get class belonging to the teacher
    class_obj = get_object_or_404(Class, pk=class_id, teacher__school_id=school_id)
    class_obj.delete()
    messages.success(request, 'Class deleted successfully!')

    # Redirect based on where the request came from
    referer = request.META.get('HTTP_REFERER', '')
    if 'report' in referer.lower():
        return redirect('report')
    else:
        return redirect('MyClasses')


# ---------------- CLASS DETAILS PAGE ---------------- #

def classDetails(request, class_id):
    # Check if user is logged in
    school_id = request.session.get('school_id')
    if not school_id:
        messages.warning(request, "Please log in first.")
        return redirect('index')

    # Get teacher info
    teacher = get_object_or_404(User, school_id=school_id)

    # Get the class object
    class_obj = get_object_or_404(Class, class_id=class_id, teacher=teacher)

    # Base query for problems
    problems = Problem.objects.filter(class_id=class_obj).order_by('-problem_id')

    # ---- SEARCH AND FILTER FOR PROBLEMS ----
    query = request.GET.get('q', '').strip()
    filter_type = request.GET.get('filter', '').strip()

    # Toggle filter (Assignment / Quiz)
    last_filter = request.session.get('last_filter', '')
    if filter_type == last_filter:
        filter_type = ''
        request.session['last_filter'] = ''
    else:
        request.session['last_filter'] = filter_type

    # Apply search/filter for problems
    if query:
        problems = problems.filter(problem_title__icontains=query)
    if filter_type == 'Assignment':
        problems = problems.filter(problem_type='Assignment')
    elif filter_type == 'Quiz':
        problems = problems.filter(problem_type='Quiz')
    if not query and not filter_type:
        problems = Problem.objects.filter(class_id=class_obj).order_by('-problem_id')

    # ---- STUDENT SEARCH ----
    student_query = request.GET.get('student_search', '').strip()

    students = (
        Enrollment.objects.filter(class_id=class_obj)
        .select_related('student_id')
        .order_by('student_id__first_name')
    )

    # Filter students if search term entered
    if student_query:
        students = students.filter(
            student_id__first_name__icontains=student_query
        ) | students.filter(
            student_id__last_name__icontains=student_query
        )

    return render(request, 'User/classDetails.html', {
        'currentpage': 'MyClasses',
        'nav': 'classDetails',
        'user': teacher,
        'class': class_obj,
        'problems': problems,
        'students': students,
        'query': query,
        'filter_type': filter_type,
        'student_query': student_query,
    })




    # ---- ADD PROBLEM------------

def add_problem(request, class_id):
    # Ensure user is logged in
    school_id = request.session.get('school_id')
    if not school_id:
        messages.warning(request, "Please log in first.")
        return redirect('index')

    teacher = get_object_or_404(User, school_id=school_id)
    class_obj = get_object_or_404(Class, class_id=class_id, teacher=teacher)

    if request.method == "POST":
        title = request.POST.get("problem_title", "").strip()
        description = request.POST.get("problem_description", "").strip()
        problem_type = request.POST.get("problem_type", "").strip()
        total_score = request.POST.get("total_score", "").strip()
        time_limit = request.POST.get("time_limit", "").strip()
        due_date = request.POST.get("due_date", "").strip()

        # Test cases
        inputs = [
            request.POST.get(f"input{i}", "").strip() for i in range(1, 4)
        ]
        outputs = [
            request.POST.get(f"output{i}", "").strip() for i in range(1, 4)
        ]

        # Validation
        if not all([title, description, problem_type, total_score, time_limit, due_date]):
            messages.error(request, "Please fill in all fields.")
            return redirect('classDetails', class_id=class_id)

        try:
            total_score = int(total_score)
            time_limit = int(time_limit)
            due_date = datetime.fromisoformat(due_date)
        except ValueError:
            messages.error(request, "Invalid input values.")
            return redirect('classDetails', class_id=class_id)

        # Create Problem
        problem = Problem.objects.create(
            class_id=class_obj,
            teacher_id=teacher,
            problem_title=title,
            problem_description=description,
            problem_type=problem_type,
            total_score=total_score,
            time_limit=time_limit,
            due_date=due_date,
        )

        # Add test cases
        for i in range(3):
            if inputs[i] or outputs[i]:
                ProblemTestCase.objects.create(
                    problem_id=problem,
                    input_data=inputs[i],
                    expected_output=outputs[i]
                )

        messages.success(request, f"Problem '{title}' created successfully!")
        return redirect('classDetails', class_id=class_id)

    return redirect('classDetails', class_id=class_id)

#--------------------------Problem Details---------------------------------#

                #Works for both Students and Teachers

def get_problem_details(request, problem_id):
    """Return problem details as JSON (used in both Teacher and Student modals)."""
    problem = get_object_or_404(Problem, pk=problem_id)
    test_cases = ProblemTestCase.objects.filter(problem_id=problem)

    # Default value
    answered = False

    # Check if the logged-in user is a student and has submitted this problem
    school_id = request.session.get('school_id')
    if school_id:
        user = User.objects.filter(school_id=school_id).first()
        if user and user.user_type == "Student":
            answered = Submission.objects.filter(problem_id=problem, student_id=user).exists()

    # Prepare data
    data = {
        "problem_id": problem.problem_id,
        "title": problem.problem_title,
        "description": problem.problem_description,
        "type": problem.problem_type,
        "score": problem.total_score,
        "time_limit": problem.time_limit,
        "due_date": problem.due_date.strftime("%Y-%m-%d %H:%M"),
        "answered": answered,  # ✅ Student-specific info only if applicable
        "test_cases": [
            {"input": tc.input_data, "output": tc.expected_output} for tc in test_cases
        ]
    }

    return JsonResponse(data)


#----------------------Problem Deletion------------------------------------#

def delete_problem(request, problem_id):
    problem = get_object_or_404(Problem, pk=problem_id)
    class_id = problem.class_id.class_id
    problem.delete()
    messages.success(request, "Problem deleted successfully.")
    return redirect('classDetails', class_id=class_id)

#----------------------Edit Problem-----------------------------------------#
def edit_problem(request, problem_id):
    problem = get_object_or_404(Problem, pk=problem_id)
    class_id = problem.class_id.class_id

    if request.method == "POST":
        title = request.POST.get("problem_title", "").strip()
        description = request.POST.get("problem_description", "").strip()
        problem_type = request.POST.get("problem_type", "").strip()
        total_score = request.POST.get("total_score", "").strip()
        time_limit = request.POST.get("time_limit", "").strip()
        due_date = request.POST.get("due_date", "").strip()

        try:
            problem.problem_title = title
            problem.problem_description = description
            problem.problem_type = problem_type
            problem.total_score = int(total_score)
            problem.time_limit = int(time_limit)
            problem.due_date = datetime.fromisoformat(due_date)
            problem.save()

            # Update only this problem's test cases
            ProblemTestCase.objects.filter(problem_id=problem.problem_id).delete()
            for i in range(3):
                input_data = request.POST.get(f"input{i+1}", "").strip()
                output_data = request.POST.get(f"output{i+1}", "").strip()
                if input_data or output_data:
                    ProblemTestCase.objects.create(
                        problem_id=problem,
                        input_data=input_data,
                        expected_output=output_data
                    )

            messages.success(request, f"Problem '{problem.problem_title}' updated successfully!")
        except Exception as e:
            messages.error(request, f"Update failed: {e}")

    return redirect('classDetails', class_id=class_id)


# ---------- REPORT DASHBOARD ----------  
def report(request):
    if not request.session.get('school_id'):
        messages.warning(request, "Please log in first.")
        return redirect('index')

    user = User.objects.get(school_id=request.session['school_id'])
    search_query = request.GET.get('search', '').strip()

    # ✅ Base classes depending on user type
    if user.user_type.lower() == 'teacher':
        classes = Class.objects.filter(teacher=user).order_by('class_id')
    else:
        classes = Class.objects.filter(enrollment__student_id=user).distinct().order_by('class_id')

    # ✅ Apply search filtering to classes
    if search_query:
        classes = classes.filter(
            Q(title__icontains=search_query) |
            Q(class_code__icontains=search_query)
        )

    # ✅ Problems and submissions related to the shown classes
    problems = Problem.objects.filter(class_id__in=classes).select_related('class_id').order_by('problem_id')

    submissions = Submission.objects.select_related(
        'student_id', 'problem_id', 'problem_id__class_id'
    ).filter(problem_id__in=problems).exclude(submission_id__isnull=True)

    # ✅ Students enrolled in these classes
    students = User.objects.filter(
        user_type__iexact='student',
        enrollment__class_id__in=classes
    ).distinct().order_by('school_id')

    # ✅ Summary counts
    total_students = students.count()
    total_submissions = submissions.count()
    pending_reviews = submissions.filter(score__isnull=True).count()

    context = {
        'user': user,
        'classes': classes,
        'problems': problems,
        'students': students,
        'submissions': submissions,
        'total_students': total_students,
        'total_submissions': total_submissions,
        'pending_reviews': pending_reviews,
        'currentpage': 'report',
        'search_query': search_query,
    }
    return render(request, 'User/report.html', context)


# ---------- Unenroll STUDENT ----------
def delete_student(request, school_id, class_id):
    student = get_object_or_404(User, school_id=school_id, user_type__iexact='student')
    class_obj = get_object_or_404(Class, class_id=class_id)

    # Delete only the enrollment, not the user
    enrollment = Enrollment.objects.filter(student_id=student, class_id=class_obj).first()
    if enrollment:
        enrollment.delete()
        messages.success(request, f'{student.first_name} has been unenrolled from {class_obj.title}.')
    else:
        messages.warning(request, 'Student was not enrolled in this class.')

    return redirect('report')





# ---------------- REVIEW SUBMISSION ---------------- #
def review_submission(request, submission_id):
    submission = get_object_or_404(Submission, submission_id=submission_id)

    if request.method == 'POST':
        new_status = request.POST.get('status')
        feedback = request.POST.get('feedback')
        submission.status = new_status
        submission.feedback = feedback
        submission.save()
        messages.success(request, '✅ Submission review updated successfully!')
        return redirect('report')

    return render(request, 'review_submission.html', {'submission': submission})


# ---------- DELETE SUBMISSION ----------
def delete_submission(request, submission_id):
    submission = get_object_or_404(Submission, submission_id=submission_id)
    submission.delete()
    messages.success(request, 'Student submission deleted successfully!')
    return redirect('report')

#----------VIEW STUDENT CODE---------------
def view_submission_code(request, submission_id):
    submission = get_object_or_404(Submission, pk=submission_id)
    code = submission.code or ""

    # HTML-safe rendering of code
    html_content = f"""
    <html>
      <head>
        <title>View Code - {escape(submission.student_id.first_name)} {escape(submission.student_id.last_name)}</title>
        <style>
          body {{
            background-color: #0f172a;
            color: #e2e8f0;
            font-family: 'Fira Code', monospace;
            padding: 20px;
          }}
          pre {{
            background: #1e293b;
            padding: 15px;
            border-radius: 8px;
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.4;
          }}
          h2 {{
            color: #38bdf8;
          }}
        </style>
      </head>
      <body>
        <h2>{escape(submission.problem_id.problem_title)}</h2>
        <pre>{escape(code)}</pre>
      </body>
    </html>
    """

    # Important: specify content_type as text/html
    return HttpResponse(html_content, content_type="text/html")




#---------------Student Part-------------------------#

#---------------Student Dashboard--------------------#
def StudentDashboard(request):
    school_id = request.session.get('school_id')

    if not school_id:
        messages.warning(request, "Please log in first.")
        return redirect('index')

    student = User.objects.filter(school_id=school_id).first()

    # Get all classes the student is enrolled in
    enrolled_classes = (
        Class.objects.filter(enrollment__student_id=student)
        .order_by('-class_id')
        .distinct()
    )

    # ✅ Find the top scorer for each class
    top_scorers = []
    for c in enrolled_classes:
        top_submission = (
            Submission.objects
            .filter(problem_id__class_id=c)
            .values(
                'student_id__first_name',
                'student_id__last_name',
                'student_id__school_id'
            )
            .annotate(total_score=Sum('score'))
            .order_by('-total_score')
            .first()
        )
        top_scorers.append({
            'class': c,
            'top_scorer': top_submission
        })

    # ✅ Leaderboard: All students ranked by total score (overall)
    leaderboard = (
        Submission.objects
        .values('student_id__first_name', 'student_id__last_name', 'student_id__school_id')
        .annotate(total_score=Sum('score'))
        .order_by('-total_score')[:10]
    )

    # ✅ Compute student's own rank
    all_scores = (
        Submission.objects
        .values('student_id')
        .annotate(total_score=Sum('score'))
        .order_by('-total_score')
    )
    rank = next((i + 1 for i, s in enumerate(all_scores) if s['student_id'] == student.school_id), None)

    return render(request, 'Students/StudentDashboard.html', {
        'currentpage': 'StudentDashboard',
        'user': student,
        'classes': enrolled_classes,
        'leaderboard': leaderboard,
        'rank': rank,
        'top_scorers': top_scorers,
    })



#---------------Student Enrolled Classes----------------#
def StudentClass(request):
    school_id = request.session.get('school_id')
    if not school_id:
        messages.warning(request, "Please log in first.")
        return redirect('index')

    student = User.objects.filter(school_id=school_id).first()

    # Get classes the student is enrolled in
    enrolled_classes = Class.objects.filter(
        enrollment__student_id=student
    ).order_by('-class_id').distinct()

    return render(request, 'Students/StudentClass.html', {
        'currentpage': 'StudentClass',
        'user': student,
        'classes': enrolled_classes,
    })

# ---------------- JOIN CLASS (STUDENT) ---------------- #
def join_class(request):
    if request.method == "POST":
        school_id = request.session.get('school_id')
        if not school_id:
            messages.warning(request, "Please log in first.")
            return redirect('index')

        student = User.objects.get(school_id=school_id)
        class_code = request.POST.get('class_code', '').strip()

        if not class_code:
            messages.error(request, "Please enter a class code.")
            return redirect('StudentClass')

        try:
            class_obj = Class.objects.get(class_code=class_code)
        except Class.DoesNotExist:
            messages.error(request, "Class not found. Please check the code.")
            return redirect('StudentClass')

        # Check if already enrolled
        if Enrollment.objects.filter(class_id=class_obj, student_id=student).exists():
            messages.warning(request, f"You are already enrolled in {class_obj.title}.")
            return redirect('StudentClass')

        # Create enrollment
        Enrollment.objects.create(class_id=class_obj, student_id=student)
        messages.success(request, f"Successfully joined {class_obj.title}!")
        return redirect('StudentClass')

    # If GET request, just redirect
    return redirect('StudentClass')

#---------------STUDENT CLASS DETAILS PAGE---------------------#

def student_class_details(request, class_id):
    # Make sure the student is logged in
    school_id = request.session.get('school_id')
    if not school_id:
        messages.warning(request, "Please log in first.")
        return redirect('index')

    # Get student and class instance
    enrollment = get_object_or_404(Enrollment, student_id__school_id=school_id, class_id=class_id)
    student = enrollment.student_id
    class_instance = get_object_or_404(Class, pk=class_id)

    # Search and filter handling
    query = request.GET.get('q', '').strip()
    filter_type = request.GET.get('filter', '').strip()

    problems = Problem.objects.filter(class_id=class_instance).order_by('-problem_id')
    if query:
        problems = problems.filter(problem_title__icontains=query)
    if filter_type:
        problems = problems.filter(problem_type=filter_type)

    # Prepare problems + submission info
    problem_data = []
    for p in problems:
        submission = Submission.objects.filter(
            student_id=student,
            problem_id=p
            
        ).order_by('-submission_id').first()

        half_score = p.total_score / 2

        problem_data.append({
            'problem': p,
            'score': submission.score if submission else None,
            'answered': submission is not None,
            'half_score': half_score, 
        })

    context = {
        'user': student,                     # ✅ Added this for StudentSidebar
        'class': class_instance,
        'problems': problem_data,
        'query': query,
        'filter_type': filter_type,
        'currentpage': 'StudentClass',       # ✅ Keeps sidebar highlighting correct
        'nav' : 'student_class_details'
    }

    return render(request, 'Students/student_class_details.html', context)

#------------------Unenroll Function--------------------#
def unenroll_class(request, class_id):
    school_id = request.session.get('school_id')
    if not school_id:
        messages.warning(request, "Please log in first.")
        return redirect('index')

    student = get_object_or_404(User, school_id=school_id)
    enrollment = Enrollment.objects.filter(class_id=class_id, student_id=student).first()
    if enrollment:
        enrollment.delete()
        messages.success(request, "You have unenrolled from the class.")
    else:
        messages.error(request, "You are not enrolled in this class.")

    return redirect('StudentClass')

# External code runner API
PISTON_URL = "https://emkc.org/api/v2/piston/execute"

# ---------------- PLAYGROUND PAGE ---------------- #
def playground(request, problem_id):
    """Renders the coding playground for a student"""
    school_id = request.session.get('school_id')
    if not school_id:
        messages.warning(request, "Please log in first.")
        return redirect('index')

    student = get_object_or_404(User, school_id=school_id)
    problem = get_object_or_404(Problem, pk=problem_id)

    # 🚫 Prevent already-submitted students from re-accessing
    existing_submission = Submission.objects.filter(problem_id=problem, student_id=student).first()
    if existing_submission:
        messages.warning(request, "You already submitted this problem.")
        return redirect('student_class_details', problem.class_id.class_id)

    # ✅ Clear sessionStorage flag on fresh access (allows retake if teacher deleted submission)
    # This will be rendered in the template
    context = {
        'user': student,
        'problem': problem,
        'nav': 'StudentPlayground',
        'clear_session_flag': True,  # Signal to clear sessionStorage
    }

    return render(request, 'Students/StudentPlayGround.html', context)


# ---------------- SUBMIT CODE (UNIFIED) ---------------- #
import logging

logger = logging.getLogger(__name__)

@csrf_exempt  # We'll handle CSRF manually for sendBeacon
def submit_problem(request, problem_id):
    """
    Handles BOTH manual and auto-submit with proper duplicate prevention
    """
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request method."}, status=400)

    # Log the request for debugging
    logger.info(f"Submission attempt for problem {problem_id}")
    logger.info(f"Content-Type: {request.headers.get('Content-Type', 'Not set')}")
    
    school_id = request.session.get("school_id")
    if not school_id:
        logger.warning("No school_id in session")
        return JsonResponse({
            "error": "Please log in first.",
            "redirect_url": reverse("index")
        }, status=401)

    student = get_object_or_404(User, school_id=school_id)
    problem = get_object_or_404(Problem, pk=problem_id)

    # ✅ CRITICAL: Check for existing submission FIRST
    existing_submission = Submission.objects.filter(
        problem_id=problem, 
        student_id=student
    ).first()
    
    if existing_submission:
        logger.info(f"Duplicate submission blocked for student {school_id}")
        return JsonResponse({
            "success": False,
            "error": "You have already submitted this problem.",
            "score": existing_submission.score,
            "already_submitted": True,
            "redirect_url": reverse("student_class_details", args=[problem.class_id.class_id])
        }, status=400)

    # Parse request body
    try:
        # Handle both regular JSON and sendBeacon blob
        content_type = request.headers.get('Content-Type', '')
        body_content = request.body.decode('utf-8')
        logger.info(f"Request body preview: {body_content[:200]}")
        
        data = json.loads(body_content)
            
        code = (data.get("code") or "").strip()
        language = (data.get("language") or "python").lower()
        is_auto_submit = data.get("auto_submit", False)
        reason = data.get("reason", "Manual submission")
        
        logger.info(f"Parsed - Auto-submit: {is_auto_submit}, Reason: {reason}, Code length: {len(code)}")
        
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        logger.error(f"JSON decode error: {str(e)}")
        return JsonResponse({
            "error": f"Invalid data format: {str(e)}",
            "redirect_url": reverse("student_class_details", args=[problem.class_id.class_id])
        }, status=400)

    # Validate code
    if not code:
        # For auto-submit with empty code, still create submission with 0 score
        if is_auto_submit:
            Submission.objects.create(
                problem_id=problem,
                student_id=student,
                code="// Auto-submitted with no code",
                score=0,
                submitted_at=timezone.now()
            )
            return JsonResponse({
                "success": True,
                "message": f"Auto-submitted ({reason}): No code provided",
                "score": 0,
                "passed": 0,
                "total": 0,
                "result_summary": "No code was submitted.",
                "redirect_url": reverse("student_class_details", args=[problem.class_id.class_id])
            })
        else:
            return JsonResponse({
                "error": "Code cannot be empty.",
                "redirect_url": reverse("student_class_details", args=[problem.class_id.class_id])
            }, status=400)

    # Get test cases
    test_cases = ProblemTestCase.objects.filter(problem_id=problem)
    if not test_cases.exists():
        return JsonResponse({
            "error": "No test cases found for this problem.",
            "redirect_url": reverse("student_class_details", args=[problem.class_id.class_id])
        }, status=404)

    # Execute test cases
    passed = 0
    total = test_cases.count()
    result_lines = []

    # Map language to Piston format
    lang_map = {
        "python": "python3",
        "python3": "python3",
        "c": "c",
        "cpp": "cpp",
        "java": "java",
    }
    piston_lang = lang_map.get(language, "python3")

    for i, tc in enumerate(test_cases, start=1):
        payload = {
            "language": piston_lang,
            "version": "*",
            "files": [{"name": "main", "content": code}],
            "stdin": tc.input_data or "",
        }
        try:
            response = requests.post(
                "https://emkc.org/api/v2/piston/execute", 
                json=payload, 
                timeout=10
            )
            result = response.json()
            
            run_data = result.get("run", {})
            output = (run_data.get("output", "") or "").strip()
            expected = (tc.expected_output or "").strip()

            if output == expected:
                passed += 1
                result_lines.append(f"✅ Test {i}: Passed")
            else:
                result_lines.append(f"❌ Test {i}: Failed")
                
        except requests.RequestException as e:
            result_lines.append(f"❌ Test {i}: Error (Execution failed)")

    # Calculate score
    score = int((passed / total) * problem.total_score) if total > 0 else 0
    result_summary = "\n".join(result_lines)

    # ✅ Create submission (with double-check to prevent race conditions)
    try:
        submission, created = Submission.objects.get_or_create(
            problem_id=problem,
            student_id=student,
            defaults={
                'code': code,
                'score': score,
                'submitted_at': timezone.now()
            }
        )
        
        if not created:
            # Submission already exists (race condition)
            return JsonResponse({
                "success": False,
                "error": "Submission already exists (detected race condition)",
                "score": submission.score,
                "already_submitted": True,
                "redirect_url": reverse("student_class_details", args=[problem.class_id.class_id])
            }, status=400)
            
    except Exception as e:
        return JsonResponse({
            "error": f"Database error: {str(e)}",
            "redirect_url": reverse("student_class_details", args=[problem.class_id.class_id])
        }, status=500)

    # Success response
    submit_type = "Auto-submitted" if is_auto_submit else "Submitted"
    return JsonResponse({
        "success": True,
        "message": f"{submit_type} successfully. Score: {score}/{problem.total_score}",
        "score": score,
        "passed": passed,
        "total": total,
        "result_summary": result_summary,
        "redirect_url": reverse("student_class_details", args=[problem.class_id.class_id])
    })


# ---------------- RUN & CHECK CODE (Testing only) ---------------- #
@csrf_exempt
def run_playground_code(request):
    """For testing code without submitting"""
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request method."}, status=400)

    tmp_dir = None
    try:
        data = json.loads(request.body)
        code = data.get("code", "")
        language = (data.get("language", "python") or "python").lower()
        check_mode = data.get("check_mode", False)
        problem_id = data.get("problem_id")
        stdin_data = data.get("stdin", "")

        if not code.strip():
            return JsonResponse({"error": "Code cannot be empty."}, status=400)

        problem = get_object_or_404(Problem, pk=problem_id)
        tmp_dir = tempfile.mkdtemp(prefix="code_run_")

        extensions = {"python": "main.py", "c": "main.c", "cpp": "main.cpp", "java": "Main.java"}
        source_path = os.path.join(tmp_dir, extensions.get(language, "main.py"))

        with open(source_path, "w", encoding="utf-8") as f:
            f.write(code)

        # ✅ Test case checking mode
        if check_mode:
            testcases = list(ProblemTestCase.objects.filter(problem_id=problem))
            total_cases = len(testcases)
            results = []
            passed_count = 0

            for i, tc in enumerate(testcases, start=1):
                expected = (tc.expected_output or "").strip()
                raw_input = (tc.input_data or "").strip()

                exec_res = execute_source(language, source_path, stdin_data=raw_input + "\n")

                if exec_res.get("error"):
                    results.append(f"❌ Test {i}: {exec_res['error']}")
                    continue

                output = (exec_res.get("stdout") or "").strip()

                # ✅ Hidden test case logic
                is_hidden = (
                    (total_cases == 1) or
                    (total_cases == 2 and i == 2) or
                    (total_cases == 3 and i == 3)
                )

                if is_hidden:
                    if output == expected:
                        results.append(f"✅ Test {i}: Passed (Hidden Case)")
                        passed_count += 1
                    else:
                        results.append(f"❌ Test {i}: Failed (Hidden Case)")
                else:
                    if output == expected:
                        results.append(f"✅ Test {i}: Passed")
                        passed_count += 1
                    else:
                        results.append(
                            f"❌ Test {i}: Failed\nInput: {raw_input}\nExpected: {expected}\nGot: {output}"
                        )

            return JsonResponse({
                "result_summary": "\n".join(results),
                "total_score": passed_count * 10,
            })

        # Manual Run Mode
        exec_res = execute_source(language, source_path, stdin_data=stdin_data + "\n")
        return JsonResponse({
            "output": exec_res.get("stdout", "No output."),
            "stderr": exec_res.get("stderr", ""),
            "compile_error": exec_res.get("compile_error", ""),
            "error": exec_res.get("error", "")
        })

    except Exception as e:
        return JsonResponse({"error": f"Server error: {str(e)}"}, status=500)
    finally:
        if tmp_dir and os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir, ignore_errors=True)


# Helper function remains the same
def execute_source(language, source_path, stdin_data="", timeout_sec=5):
    """Executes code safely via Piston API and always returns JSON-safe output."""
    PISTON_URL = "https://emkc.org/api/v2/piston/execute"

    with open(source_path, "r", encoding="utf-8") as f:
        code = f.read()

    lang_map = {
        "python": "python3",
        "python3": "python3",
        "c": "c",
        "cpp": "cpp",
        "java": "java",
    }
    lang = lang_map.get(language.lower(), "python3")

    payload = {
        "language": lang,
        "version": "*",
        "files": [{"name": "main", "content": code}],
        "stdin": stdin_data or "",
    }

    try:
        res = requests.post(PISTON_URL, json=payload, timeout=timeout_sec + 2)

        if "application/json" not in res.headers.get("Content-Type", ""):
            return {
                "stdout": "",
                "stderr": "",
                "compile_error": "",
                "error": f"⚠️ Non-JSON from Piston ({res.status_code}): {res.text[:200]}"
            }

        data = res.json()

        if res.status_code != 200:
            return {
                "stdout": "",
                "stderr": "",
                "compile_error": "",
                "error": f"⚠️ Piston API error {res.status_code}: {data}"
            }

        run_data = data.get("run", {})
        compile_data = data.get("compile", {})

        return {
            "stdout": run_data.get("stdout", ""),
            "stderr": run_data.get("stderr", ""),
            "compile_error": compile_data.get("stderr", ""),
            "error": "",
        }

    except requests.Timeout:
        return {"stdout": "", "stderr": "", "compile_error": "", "error": "⏱️ Timed out."}
    except requests.RequestException as e:
        return {"stdout": "", "stderr": "", "compile_error": "", "error": f"🌐 Request error: {e}"}
    except Exception as e:
        return {"stdout": "", "stderr": "", "compile_error": "", "error": f"⚠️ Unexpected: {e}"}

#----------------------Universal Playground--------------------------#

# ---------------- CODE TESTING PLAYGROUND (NO SECURITY) ---------------- #
def code_testing_playground(request):
    school_id = request.session.get('school_id')
    if not school_id:
        messages.warning(request, "Please log in first.")
        return redirect('index')

    user = get_object_or_404(User, school_id=school_id)

    # ✅ Different template or logic based on user type
    context = {
        'user': user,
        'nav': 'Playground',
        'currentpage': 'Playground',
    }

    # If you want to render the same HTML but load the correct sidebar dynamically:
    if user.user_type.lower() == 'teacher':
        return render(request, 'Universal/Playground.html', {**context, 'sidebar': 'teacher'})
    else:
        return render(request, 'Universal/Playground.html', {**context, 'sidebar': 'student'})



# ---------------- RUN CODE IN TESTING PLAYGROUND ---------------- #
@csrf_exempt
def run_test_code(request):
    """
    Execute code in the testing playgrounds
    No test cases, just run the code with user input
    """
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request method."}, status=400)
    
    try:
        data = json.loads(request.body)
        code = data.get("code", "").strip()
        language = (data.get("language", "python") or "python").lower()
        stdin_data = data.get("stdin", "")
        
        if not code:
            return JsonResponse({"error": "Code cannot be empty."}, status=400)
        
        # ✅ BULLETPROOF FIX: For Java, force rename public class to Main
        if language == "java":
            # Split code into lines for processing
            lines = code.split('\n')
            modified_lines = []
            
            for line in lines:
                # Check if this line contains "public class" followed by a word
                if 'public class' in line and '{' in line:
                    # Extract everything before "public class"
                    before = line.split('public class')[0]
                    # Extract everything after the class name
                    after_parts = line.split('public class')[1].split('{', 1)
                    if len(after_parts) == 2:
                        # Force it to be "Main"
                        new_line = before + 'public class Main {' + after_parts[1]
                        modified_lines.append(new_line)
                        print(f"[JAVA FIX] Changed: {line.strip()}")
                        print(f"[JAVA FIX] To:      {new_line.strip()}")
                        continue
                
                # Keep the line as is
                modified_lines.append(line)
            
            code = '\n'.join(modified_lines)
            print("[JAVA FIX] Code transformation complete")
        
        # Map language to Piston format
        lang_config = {
            "python": {"lang": "python", "version": "3.10.0", "file": "main.py"},
            "c": {"lang": "c", "version": "10.2.0", "file": "main.c"},
            "cpp": {"lang": "c++", "version": "10.2.0", "file": "main.cpp"},
            "java": {"lang": "java", "version": "15.0.2", "file": "Main.java"},
        }
        
        config = lang_config.get(language, lang_config["python"])
        
        # Execute code via Piston API
        payload = {
            "language": config["lang"],
            "version": config["version"],
            "files": [{"name": config["file"], "content": code}],
            "stdin": stdin_data,
            "compile_timeout": 10000,
            "run_timeout": 3000,
            "compile_memory_limit": -1,
            "run_memory_limit": -1
        }
        
        print(f"[PISTON] Sending {config['file']} with {len(stdin_data)} bytes of stdin")
        
        response = requests.post(PISTON_URL, json=payload, timeout=15)
        
        if "application/json" not in response.headers.get("Content-Type", ""):
            return JsonResponse({
                "error": f"Non-JSON response from execution service ({response.status_code})"
            }, status=500)
        
        result = response.json()
        
        if response.status_code != 200:
            return JsonResponse({
                "error": f"Execution service error: {result}"
            }, status=500)
        
        run_data = result.get("run", {})
        compile_data = result.get("compile", {})
        
        return JsonResponse({
            "success": True,
            "output": run_data.get("stdout", ""),
            "stderr": run_data.get("stderr", ""),
            "compile_error": compile_data.get("stderr", ""),
            "exit_code": run_data.get("code", 0)
        })
        
    except requests.Timeout:
        return JsonResponse({"error": "Code execution timed out."}, status=408)
    except requests.RequestException as e:
        return JsonResponse({"error": f"Network error: {str(e)}"}, status=500)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON data."}, status=400)
    except Exception as e:
        import traceback
        print(f"[ERROR] {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({"error": f"Server error: {str(e)}"}, status=500)


#---------------------------AI-----------------------------------------# Initialize client
client = genai.Client(api_key="AIzaSyBMDsSEJa4B9VC181QIClqH1TLf_77WwPA")
# API Rate Limits for Gemini 2.5 Flash-Lite
API_LIMITS = {
    'requests_per_minute': 15,      # RPM: 15
    'requests_per_day': 1000,       # RPD: 1000
    'tokens_per_minute': 250000,    # TPM: 250,000
}

def get_total_users():
    """Get total number of registered users"""
    from .models import User
    count = User.objects.count()
    return max(count, 1)  # Minimum 1 to avoid division by zero

def get_per_user_limits():
    """Calculate per-user limits by dividing API limits by total users"""
    total_users = get_total_users()
    
    return {
        'requests_per_minute': max(1, API_LIMITS['requests_per_minute'] // total_users),
        'requests_per_day': max(1, API_LIMITS['requests_per_day'] // total_users),
        'tokens_per_minute': max(1000, API_LIMITS['tokens_per_minute'] // total_users),
        'total_users': total_users,
    }

def check_rate_limit(user_id):
    """
    Check if user has exceeded their allocated rate limits
    Returns: (allowed: bool, message: str, wait_seconds: int)
    """
    now = datetime.now()
    limits = get_per_user_limits()
    
    # Per-minute check
    minute_key = f"ai_rate_limit_minute_{user_id}_{now.strftime('%Y%m%d%H%M')}"
    minute_count = cache.get(minute_key, 0)
    
    if minute_count >= limits['requests_per_minute']:
        wait_seconds = 60 - now.second
        return False, f"Rate limit: {limits['requests_per_minute']} requests/minute (shared among {limits['total_users']} users). Wait {wait_seconds}s.", wait_seconds
    
    # Per-day check
    day_key = f"ai_rate_limit_day_{user_id}_{now.strftime('%Y%m%d')}"
    day_count = cache.get(day_key, 0)
    
    if day_count >= limits['requests_per_day']:
        return False, f"Daily limit reached ({limits['requests_per_day']} requests per user). Try tomorrow.", 0
    
    return True, "OK", 0


def increment_rate_limit(user_id):
    """Increment rate limit counters"""
    now = datetime.now()
    
    # Increment minute counter
    minute_key = f"ai_rate_limit_minute_{user_id}_{now.strftime('%Y%m%d%H%M')}"
    minute_count = cache.get(minute_key, 0)
    cache.set(minute_key, minute_count + 1, 70)  # Expire after 70 seconds
    
    # Increment day counter
    day_key = f"ai_rate_limit_day_{user_id}_{now.strftime('%Y%m%d')}"
    day_count = cache.get(day_key, 0)
    cache.set(day_key, day_count + 1, 86400)  # Expire after 24 hours


def get_user_usage_stats(user_id):
    """Get current usage statistics for user with dynamic limits"""
    now = datetime.now()
    limits = get_per_user_limits()
    
    minute_key = f"ai_rate_limit_minute_{user_id}_{now.strftime('%Y%m%d%H%M')}"
    day_key = f"ai_rate_limit_day_{user_id}_{now.strftime('%Y%m%d')}"
    
    minute_count = cache.get(minute_key, 0)
    day_count = cache.get(day_key, 0)
    
    return {
        'requests_this_minute': minute_count,
        'requests_today': day_count,
        'minute_limit': limits['requests_per_minute'],
        'daily_limit': limits['requests_per_day'],
        'minute_remaining': max(0, limits['requests_per_minute'] - minute_count),
        'daily_remaining': max(0, limits['requests_per_day'] - day_count),
        'total_users': limits['total_users'],
        'tokens_per_minute_limit': limits['tokens_per_minute'],
        # API totals for reference
        'api_limits': {
            'rpm': API_LIMITS['requests_per_minute'],
            'rpd': API_LIMITS['requests_per_day'],
            'tpm': API_LIMITS['tokens_per_minute'],
        }
    }


# Optimized system prompt (same as before)
SYSTEM_PROMPT_OPTIMIZED = """You are Paulibot, an intelligent AI assistant exclusive to the Paulicode platform.

**Your Identity:**
- Name: Paulibot
- Purpose: Personal AI coding assistant for students
- Created by: A Paulinian IT student named 'Bryan Kim Calipes'
- Platform: Paulicode - an educational coding platform
- Expertise: Programming, algorithms, debugging, code explanation, and Computer Science/IT concepts ONLY

**CRITICAL RESTRICTIONS:**

1. **TOPIC FILTERING:**
You MUST ONLY answer questions related to:
✅ Programming (Python, C, C++, Java, JavaScript, etc.)
✅ Computer Science concepts (algorithms, data structures, complexity, etc.)
✅ Software development (debugging, testing, version control, etc.)
✅ Web development (HTML, CSS, frameworks, databases, etc.)
✅ IT concepts (networks, security, systems, DevOps, etc.)

❌ REFUSE to answer questions about:
- General knowledge, trivia, entertainment, news, health, history, or non-technical topics

**Response when asked off-topic:**
"I can only help with programming and computer science topics. Please ask me something about coding! 💻"

2. **RESPONSE LENGTH (CRITICAL - LOW TOKEN LIMIT):**
⚠️ **KEEP ALL RESPONSES CONCISE** - You have limited tokens
- Maximum 200 words per response
- Use short sentences
- Get straight to the point
- For code examples: Keep them minimal (10-15 lines max)
- Avoid lengthy explanations
- No repetition

**Response Guidelines:**
- Be direct and concise
- Use markdown code blocks for code (```language)
- Break complex concepts into digestible parts
- Provide SHORT code examples when helpful
- Always be encouraging but brief

Remember: CONCISE, TECHNICAL, CODING-FOCUSED ONLY!
"""


@csrf_exempt
def ai_chat_stream(request):
    """
    Streams AI responses with dynamic per-user rate limiting
    Uses Gemini 2.5 Flash-Lite: 15 RPM, 250K TPM, 1000 RPD
    Limits are divided equally among all registered users
    """
    from .models import User, ChatHistory
    from google import genai
    
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request"}, status=400)

    school_id = request.session.get('school_id')
    if not school_id:
        return JsonResponse({"error": "Please log in first."}, status=401)

    try:
        user = User.objects.get(school_id=school_id)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)

    # ✅ Check dynamic rate limits
    allowed, message, wait_seconds = check_rate_limit(user.school_id)
    if not allowed:
        return JsonResponse({
            "error": message,
            "rate_limited": True,
            "wait_seconds": wait_seconds
        }, status=429)

    try:
        data = json.loads(request.body)
        user_message = data.get("message", "").strip()
        
        if not user_message:
            return JsonResponse({"error": "Message cannot be empty."}, status=400)

        # Calculate dynamic max message length based on per-user token limit
        limits = get_per_user_limits()
        max_message_length = min(500, limits['tokens_per_minute'] // 500)  # Conservative estimate
        
        if len(user_message) > max_message_length:
            return JsonResponse({
                "error": f"Message too long. Please keep it under {max_message_length} characters."
            }, status=400)

        # ✅ Increment rate limit counter
        increment_rate_limit(user.school_id)

        # Save user's message
        ChatHistory.objects.create(
            school_id=user,
            sender='user',
            message=user_message
        )

        # Get reduced chat history (last 4 messages)
        conversation_history = ChatHistory.objects.filter(
            school_id=user
        ).order_by('-timestamp')[:4]
        
        conversation_history = list(reversed(conversation_history))

        def stream_response():
            ai_response = ""
            try:
                # Calculate max tokens based on per-user TPM allocation
                per_user_limits = get_per_user_limits()
                max_output_tokens = min(800, per_user_limits['tokens_per_minute'] // 20)
                
                # Build minimal prompt
                full_prompt = SYSTEM_PROMPT_OPTIMIZED + "\n\n"
                
                if conversation_history:
                    full_prompt += "Recent context:\n"
                    for msg in conversation_history[-4:]:
                        prefix = "Student" if msg.sender == "user" else "Paulibot"
                        msg_text = msg.message[:150] + "..." if len(msg.message) > 150 else msg.message
                        full_prompt += f"{prefix}: {msg_text}\n"
                    full_prompt += "\n"
                
                full_prompt += f"Student: {user_message}\nPaulibot: (Keep response under 200 words)"

                
                # ✅ Stream using Gemini 2.5 Flash-Lite
                for chunk in client.models.generate_content_stream(
                    model="gemini-2.5-flash-lite",
                    contents=full_prompt,
                    config={
                        "temperature": 0.7,
                        "top_p": 0.95,
                        "top_k": 40,
                        "max_output_tokens": max_output_tokens,
                        "stop_sequences": ["\n\nStudent:", "Student:"],
                    }
                ):
                    if hasattr(chunk, "text") and chunk.text:
                        ai_response += chunk.text
                        yield json.dumps({"ai_message_partial": chunk.text}) + "\n"
                
                # Save AI's complete response
                if ai_response:
                    ChatHistory.objects.create(
                        school_id=user,
                        sender='ai',
                        message=ai_response
                    )
                        
            except Exception as e:
                error_msg = f"Error: {str(e)}"
                yield json.dumps({"ai_message_partial": error_msg}) + "\n"
                
                ChatHistory.objects.create(
                    school_id=user,
                    sender='ai',
                    message=error_msg
                )

        return StreamingHttpResponse(
            stream_response(),
            content_type="text/event-stream"
        )

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def get_usage_stats(request):
    """
    API endpoint to get current user's usage statistics with dynamic limits
    """
    from .models import User
    
    school_id = request.session.get('school_id')
    if not school_id:
        return JsonResponse({"error": "Not logged in"}, status=401)
    
    try:
        user = User.objects.get(school_id=school_id)
        stats = get_user_usage_stats(user.school_id)
        return JsonResponse(stats)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)


def load_chat_history(request):
    """Load user's private chat history from database"""
    from .models import User, ChatHistory
    
    school_id_value = request.session.get('school_id')
    if not school_id_value:
        return JsonResponse({"error": "Please log in first."}, status=401)

    try:
        user = User.objects.get(school_id=school_id_value)
        
        # Get user's chat history (last 30 messages)
        chat_history = ChatHistory.objects.filter(
            school_id=user
        ).order_by('timestamp')[:30]
        
        # Format for frontend
        messages = [
            {
                "sender": msg.sender,
                "text": msg.message,
                "timestamp": msg.timestamp.isoformat()
            }
            for msg in chat_history
        ]
        
        return JsonResponse({"messages": messages})
        
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def clear_chat_history(request):
    """Clear user's private chat history"""
    from .models import User, ChatHistory
    
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request method."}, status=400)
    
    school_id_value = request.session.get('school_id')
    if not school_id_value:
        return JsonResponse({"error": "Please log in first."}, status=401)

    try:
        user = User.objects.get(school_id=school_id_value)
        
        # Delete all chat history for this user
        deleted_count = ChatHistory.objects.filter(school_id=user).delete()[0]
        
        return JsonResponse({
            "success": True,
            "message": f"Deleted {deleted_count} messages."
        })
        
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)