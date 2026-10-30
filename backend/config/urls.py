from django.urls import include, path, re_path

from planner.views import spa_index

urlpatterns = [
    path("api/", include("planner.urls")),
    re_path(r"^(?!api/).*$", spa_index),
]
