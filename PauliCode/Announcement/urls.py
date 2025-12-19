# Announcement/urls.py
from django.urls import path
from . import views

app_name = 'announcement'

urlpatterns = [
    path('', views.announcement_board, name='board'),
    path('create/', views.create_announcement, name='create'),
    path('<int:announcement_id>/details/', views.get_announcement_details, name='details'),
    path('<int:announcement_id>/react/', views.toggle_reaction, name='react'),
    path('<int:announcement_id>/comment/', views.add_comment, name='comment'),
    path('comment/<int:comment_id>/delete/', views.delete_comment, name='delete_comment'),
    path('<int:announcement_id>/pin/', views.toggle_pin, name='pin'),
    path('<int:announcement_id>/delete/', views.delete_announcement, name='delete'),
    path('<int:announcement_id>/report/', views.report_announcement, name='report'),
    path('<int:announcement_id>/teacher-pin/', views.toggle_teacher_pin, name='teacher_pin'),
    path('<int:announcement_id>/edit/', views.edit_announcement, name='edit'),
    path('file/<int:file_id>/delete/', views.delete_file, name='delete_file'),
]