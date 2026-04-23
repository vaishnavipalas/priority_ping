import pandas as pd
import numpy as np
import random
import re

# Set seed for reproducibility
random.seed(42)
np.random.seed(42)

# Templates for titles
templates = {
    "assignment_due": [
        "Homework {n} due tonight",
        "Assignment {n} submission closing soon",
        "Reminder: Lab {n} due in {d} days",
        "Final Project {n} deadline approaching",
        "Submit Assignment {n} by midnight"
    ],
    "quiz_due": [
        "Quiz {n} opens tomorrow",
        "Important: Quiz {n} due tonight",
        "Reminder: Weekly Quiz {n} due in {d} days",
        "Quiz {n} closing soon",
        "Take Quiz {n} now"
    ],
    "announcement": [
        "Updated syllabus posted",
        "Class cancelled this Friday",
        "Office hours reminder",
        "Important announcement regarding exam",
        "New reading material available"
    ],
    "event": [
        "Study session this weekend",
        "Club meeting on Friday",
        "Career fair on campus",
        "Guest lecture: AI in Education",
        "Workshop: Time Management"
    ],
    "grade_posted": [
        "Your grade for Homework {n} has been posted",
        "Midterm grades are now available",
        "Quiz {n} grade released",
        "Feedback available for Assignment {n}",
        "Final grades have been uploaded"
    ]
}

urgent_keywords = ["due", "tonight", "urgent", "reminder", "missing", "overdue", "important"]
time_phrases = ["tonight", "today", "by midnight", "this week", "in 1 hour"]

def generate_notification(idx):
    notif_type = random.choice(list(templates.keys()))
    n = random.randint(1, 10)
    d = random.randint(0, 14)
    
    title_template = random.choice(templates[notif_type])
    title = title_template.format(n=n, d=d)
    
    # Programmatic features from title
    title_lower = title.lower()
    title_has_urgent_keyword = 1 if any(kw in title_lower for kw in urgent_keywords) else 0
    has_time_reference = 1 if any(tp in title_lower for tp in time_phrases) else 0
    
    # Feature correlations
    if notif_type in ["assignment_due", "quiz_due"]:
        is_graded = 1 if random.random() < 0.9 else 0
        requires_submission = 1 if random.random() < 0.9 else 0
        teacher_posted = 1 if random.random() < 0.8 else 0
        estimated_time_hours = round(random.uniform(1.0, 5.0), 1)
    elif notif_type in ["announcement", "event"]:
        is_graded = 1 if random.random() < 0.1 else 0
        requires_submission = 1 if random.random() < 0.1 else 0
        teacher_posted = 1 if random.random() < 0.4 else 0
        estimated_time_hours = round(random.uniform(0.0, 1.0), 1)
    else: # grade_posted
        is_graded = 1 # grades affect grades
        requires_submission = 0
        teacher_posted = 1 if random.random() < 0.9 else 0
        estimated_time_hours = round(random.uniform(0.0, 0.5), 1)

    # Labeling logic
    urgent = 0
    if d <= 1 and is_graded == 1:
        urgent = 1
    elif notif_type == "quiz_due" and d <= 2:
        urgent = 1
    elif requires_submission == 1 and d <= 2 and estimated_time_hours >= 2:
        urgent = 1
    elif title_has_urgent_keyword == 1 and is_graded == 1 and d <= 3:
        urgent = 1
        
    # Add noise (8% flip)
    if random.random() < 0.08:
        urgent = 1 - urgent
        
    return {
        "notification_id": 101 + idx,
        "title": title,
        "notification_type": notif_type,
        "days_until_deadline": d,
        "is_graded": is_graded,
        "estimated_time_hours": estimated_time_hours,
        "requires_submission": requires_submission,
        "title_has_urgent_keyword": title_has_urgent_keyword,
        "has_time_reference": has_time_reference,
        "teacher_posted": teacher_posted,
        "urgent_label": urgent
    }

data = [generate_notification(i) for i in range(1000)]
df = pd.DataFrame(data)
df.to_csv("notifications.csv", index=False)

print("Dataset generated: notifications.csv")
print(df["urgent_label"].value_counts())
