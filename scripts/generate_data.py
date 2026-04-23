import pandas as pd
import numpy as np
import random
import re

# Set seeds for reproducibility
random.seed(42)
np.random.seed(42)

# Course Data
COURSES = {
    "67272": {"name": "Application Design and Development", "credits": 12},
    "15150": {"name": "Principles of Functional Programming", "credits": 12},
    "05318": {"name": "Human-AI Interaction", "credits": 9},
    "70452": {"name": "Organizational Behavior", "credits": 9},
    "84389": {"name": "Terrorism and Insurgency", "credits": 9}
}

TYPES = [
    "assignment_due", "quiz_exam", "grade_posted", "announcement_urgent",
    "announcement_info", "discussion", "group_collab", "event_optional"
]

WEIGHTS = [0.30, 0.10, 0.10, 0.04, 0.25, 0.12, 0.07, 0.02]

URGENT_KW = ["due", "tonight", "urgent", "reminder", "missing", "overdue", "important", "final", "deadline", "past due", "late", "by midnight", "due today", "due tomorrow", "closes"]
TIME_PHRASES = ["tonight", "today", "by midnight", "this week", "tomorrow", "friday", "sunday"]

TEMPLATES = {
    "assignment_due": [
        "Homework {n} due tonight", "Phase {n} Final Submission",
        "Lab {n} closes at midnight", "Project {n}: Peer Review Due",
        "Assignment {n} part 2", "Submit Lab {n} before class"
    ],
    "quiz_exam": [
        "Quiz {n} opens tonight", "Midterm 1 logistics",
        "Final Exam — Room Assignment", "Weekly Quiz {n} Reminder",
        "Exam {n} preparation guide"
    ],
    "grade_posted": [
        "Homework {n} has been graded", "Phase {n} Autograder results posted",
        "Quiz {n} score released", "Exam {n} feedback available"
    ],
    "announcement_urgent": [
        "Change to OH hours this week", "Class cancelled Thursday",
        "Important: Final presentation order", "Urgent: Zoom link changed"
    ],
    "announcement_info": [
        "Slide Link — Add to Google Sheet", "Office hours reminder",
        "New reading material posted", "Syllabus update"
    ],
    "discussion": [
        "Week {n} Reflection due Friday", "Discussion: Reply to 2 classmates",
        "New thread: Assignment {n} questions"
    ],
    "group_collab": [
        "[Team] Group contract due", "Peer review assigned",
        "Group presentation slot confirmed", "Teammate feedback needed"
    ],
    "event_optional": [
        "Career fair on campus", "Optional workshop: Python Basics",
        "Guest lecture: Tech Ethics", "Free pizza at study session"
    ]
}

def generate_data(n=1000):
    rows = []
    for _ in range(n):
        notif_type = random.choices(TYPES, weights=WEIGHTS)[0]
        course_code = random.choice(list(COURSES.keys()))
        course_info = COURSES[course_code]
        
        n_val = random.randint(1, 5)
        title = random.choice(TEMPLATES[notif_type]).format(n=n_val)
        
        # Features
        has_deadline = 1 if notif_type in ["assignment_due", "quiz_exam", "discussion"] or random.random() < 0.2 else 0
        
        is_graded = 1 if notif_type in ["assignment_due", "quiz_exam", "grade_posted"] else 0
        requires_submission = 1 if notif_type in ["assignment_due", "quiz_exam", "discussion"] else 0
        teacher_posted = 1 if notif_type != "discussion" else random.randint(0, 1)
        
        estimated_time_hours = 0.0
        if notif_type == "assignment_due": estimated_time_hours = random.uniform(2, 8)
        elif notif_type == "quiz_exam": estimated_time_hours = random.uniform(1, 4)
        elif notif_type == "discussion": estimated_time_hours = random.uniform(0.5, 2)
        elif notif_type == "group_collab": estimated_time_hours = random.uniform(1, 3)
        
        title_has_urgent_kw = 1 if any(kw in title.lower() for kw in URGENT_KW) else 0
        has_time_reference = 1 if any(tp in title.lower() for tp in TIME_PHRASES) else 0
        
        # Priority labeling logic
        priority = 0
        # Priority 3 (critical)
        if (has_deadline and title_has_urgent_kw and has_time_reference) or \
           (notif_type == "quiz_exam" and title_has_urgent_kw):
            priority = 3
        # Priority 2 (high)
        elif (has_deadline and title_has_urgent_kw) or \
             (notif_type == "quiz_exam" and has_time_reference) or \
             (title_has_urgent_kw and has_deadline):
            priority = 2
        # Priority 1 (moderate)
        elif (has_deadline) or \
             (notif_type == "grade_posted") or \
             (notif_type == "discussion"):
            priority = 1
        # Priority 0: handled by default
        
        # Add noise to 1 and 2
        if priority in [1, 2]:
            if random.random() < 0.05:
                priority = max(0, min(3, priority + random.choice([-1, 1])))

        rows.append({
            "title": title,
            "course_name": course_code,
            "notification_type": notif_type,
            "has_deadline": int(has_deadline),
            "is_graded": int(is_graded),
            "requires_submission": int(requires_submission),
            "teacher_posted": int(teacher_posted),
            "estimated_time_hours": round(estimated_time_hours, 1),
            "title_has_urgent_kw": int(title_has_urgent_kw),
            "has_time_reference": int(has_time_reference),
            "course_credits": int(course_info["credits"]),
            "priority": priority,
            "urgent_label": 1 if priority >= 2 else 0
        })
        
    df = pd.DataFrame(rows)
    df.to_csv("scripts/notifications_dataset.csv", index=False)
    print(f"Generated {n} rows to scripts/notifications_dataset.csv")
    print(df['priority'].value_counts(normalize=True))

if __name__ == "__main__":
    generate_data()
