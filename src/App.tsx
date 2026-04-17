import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, CheckCircle, Clock, Trash2, Plus, Send } from 'lucide-react';

// Types
interface Notification {
  notification_id?: number;
  title: string;
  notification_type: string;
  has_deadline?: number;
  days_until_deadline: number;
  is_graded: number;
  estimated_time_hours: number;
  requires_submission: number;
  teacher_posted: number;
  title_has_urgent_keyword: number;
  has_time_reference: number;
  urgent?: number;
  confidence?: number;
  reasons?: string[];
}

const API_URL = 'http://127.0.0.1:5000';

const NOTIFICATION_TYPES_WITH_DEADLINE = new Set(['assignment_due', 'quiz_due']);

function typeHasDeadline(notificationType: string): boolean {
  return NOTIFICATION_TYPES_WITH_DEADLINE.has(notificationType);
}

function notificationSubtitle(notif: Notification): string {
  const typeLabel = notif.notification_type.replace(/_/g, ' ');
  if (!typeHasDeadline(notif.notification_type)) {
    return typeLabel;
  }
  const d = notif.days_until_deadline;
  return `${typeLabel} · Due in ${d} day${d === 1 ? '' : 's'}`;
}

const DEMO_NOTIFICATIONS: Notification[] = [
  {
    notification_id: 1,
    title: "Homework 4 due tonight",
    notification_type: "assignment_due",
    has_deadline: 1,
    days_until_deadline: 0,
    is_graded: 1,
    estimated_time_hours: 3.5,
    requires_submission: 1,
    teacher_posted: 1,
    title_has_urgent_keyword: 1,
    has_time_reference: 1
  },
  {
    notification_id: 2,
    title: "Important: Quiz 2 due tonight",
    notification_type: "quiz_due",
    has_deadline: 1,
    days_until_deadline: 0,
    is_graded: 1,
    estimated_time_hours: 1.0,
    requires_submission: 1,
    teacher_posted: 1,
    title_has_urgent_keyword: 1,
    has_time_reference: 1
  },
  {
    notification_id: 3,
    title: "Updated syllabus posted",
    notification_type: "announcement",
    has_deadline: 0,
    days_until_deadline: 0,
    is_graded: 0,
    estimated_time_hours: 0.2,
    requires_submission: 0,
    teacher_posted: 1,
    title_has_urgent_keyword: 0,
    has_time_reference: 0
  },
  {
    notification_id: 4,
    title: "Your grade for Homework 3 has been posted",
    notification_type: "grade_posted",
    has_deadline: 0,
    days_until_deadline: 0,
    is_graded: 1,
    estimated_time_hours: 0.1,
    requires_submission: 0,
    teacher_posted: 1,
    title_has_urgent_keyword: 0,
    has_time_reference: 0
  },
  {
    notification_id: 5,
    title: "Study session this weekend",
    notification_type: "event",
    has_deadline: 0,
    days_until_deadline: 0,
    is_graded: 0,
    estimated_time_hours: 2.0,
    requires_submission: 0,
    teacher_posted: 0,
    title_has_urgent_keyword: 0,
    has_time_reference: 1
  },
  {
    notification_id: 6,
    title: "Reminder: Lab 3 due in 3 days",
    notification_type: "assignment_due",
    has_deadline: 1,
    days_until_deadline: 3,
    is_graded: 1,
    estimated_time_hours: 4.0,
    requires_submission: 1,
    teacher_posted: 1,
    title_has_urgent_keyword: 1,
    has_time_reference: 0
  },
  {
    notification_id: 7,
    title: "Quiz 3 opens tomorrow",
    notification_type: "quiz_due",
    has_deadline: 1,
    days_until_deadline: 1,
    is_graded: 1,
    estimated_time_hours: 1.0,
    requires_submission: 1,
    teacher_posted: 1,
    title_has_urgent_keyword: 0,
    has_time_reference: 1
  },
  {
    notification_id: 8,
    title: "Office hours reminder",
    notification_type: "announcement",
    days_until_deadline: 1,
    is_graded: 0,
    estimated_time_hours: 0.5,
    requires_submission: 0,
    teacher_posted: 1,
    title_has_urgent_keyword: 1,
    has_time_reference: 0
  }
];

export default function App() {
  const [feed, setFeed] = useState<Notification[]>(DEMO_NOTIFICATIONS);
  const [customResults, setCustomResults] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Notification>({
    title: '',
    notification_type: 'assignment_due',
    has_deadline: 1,
    days_until_deadline: 1,
    is_graded: 1,
    estimated_time_hours: 1.0,
    requires_submission: 1,
    teacher_posted: 1,
    title_has_urgent_keyword: 0,
    has_time_reference: 0
  });

  const getUrgencyTier = (confidence: number | undefined) => {
    if (confidence === undefined) return { label: 'Pending', color: 'gray' };
    if (confidence >= 0.7) return { label: 'Urgent', color: 'red' };
    if (confidence >= 0.4) return { label: 'Review Soon', color: 'yellow' };
    return { label: 'Low Priority', color: 'green' };
  };

  const handlePrioritize = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/predict_batch`, feed);
      setFeed(response.data);
    } catch (error: any) {
      console.error("Error prioritizing feed:", error);
      if (error.response) {
        alert(`Backend Error: ${error.response.data.error || 'Unknown server error'}`);
      } else if (error.request) {
        alert("Cannot reach backend. 1) Ensure 'python3 app.py' is running. 2) Open the app via http://localhost:3000 (not the AI Studio preview) to avoid Mixed Content blocks.");
      } else {
        alert("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const titleLower = formData.title.toLowerCase();
    const urgentKeywords = ["due", "tonight", "urgent", "reminder", "missing", "overdue", "important"];
    const timePhrases = ["tonight", "today", "by midnight", "this week", "in 1 hour"];
    
    const hasDl = typeHasDeadline(formData.notification_type);
    const updatedFormData = {
      ...formData,
      has_deadline: hasDl ? 1 : 0,
      days_until_deadline: hasDl ? formData.days_until_deadline : 0,
      title_has_urgent_keyword: urgentKeywords.some(kw => titleLower.includes(kw)) ? 1 : 0,
      has_time_reference: timePhrases.some(tp => titleLower.includes(tp)) ? 1 : 0
    };

    try {
      const response = await axios.post(`${API_URL}/predict_one`, updatedFormData);
      const result = { ...updatedFormData, ...response.data, notification_id: Date.now() };
      setCustomResults([result, ...customResults]);
      setFormData({
        title: '',
        notification_type: 'assignment_due',
        has_deadline: 1,
        days_until_deadline: 1,
        is_graded: 1,
        estimated_time_hours: 1.0,
        requires_submission: 1,
        teacher_posted: 1,
        title_has_urgent_keyword: 0,
        has_time_reference: 0
      });
    } catch (error: any) {
      console.error("Error predicting notification:", error);
      if (error.response) {
        alert(`Backend Error: ${error.response.data.error || 'Unknown server error'}`);
      } else {
        alert("Cannot reach backend. Ensure 'python3 app.py' is running on port 5000.");
      }
    }
  };

  const dismissNotification = (id: number | undefined, isFeed: boolean) => {
    if (isFeed) {
      setFeed(feed.filter(n => n.notification_id !== id));
    } else {
      setCustomResults(customResults.filter(n => n.notification_id !== id));
    }
  };

  const NotificationCard = ({ notif, isFeed }: { notif: Notification, isFeed: boolean }) => {
    const tier = getUrgencyTier(notif.confidence);
    const borderClass = {
      red: 'border-red-500 bg-red-50',
      yellow: 'border-yellow-500 bg-yellow-50',
      green: 'border-green-500 bg-green-50',
      gray: 'border-gray-200 bg-white'
    }[tier.color];

    const badgeClass = {
      red: 'bg-red-100 text-red-700 border-red-200',
      yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      green: 'bg-green-100 text-green-700 border-green-200',
      gray: 'bg-gray-100 text-gray-700 border-gray-200'
    }[tier.color];

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`p-4 rounded-xl border-2 shadow-sm transition-all ${borderClass} mb-4`}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${badgeClass}`}>
                {tier.label}
              </span>
              {notif.confidence !== undefined && (
                <span className="text-xs text-gray-500 font-medium">
                  {Math.round(notif.confidence * 100)}% confidence
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">{notif.title}</h3>
            <p className="text-sm text-gray-600 mb-3 capitalize">
              {notificationSubtitle(notif)}
            </p>
            
            {notif.reasons && notif.reasons.length > 0 && (
              <ul className="space-y-1">
                {notif.reasons.map((reason, idx) => (
                  <li key={idx} className="text-xs text-gray-600 flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-gray-400" />
                    {reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={() => dismissNotification(notif.notification_id, isFeed)}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center justify-center p-3 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-200"
          >
            <Bell className="text-white" size={32} />
          </motion.div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">PriorityPing</h1>
          <p className="mt-2 text-lg text-gray-600">Smart academic notification triage</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Column: Demo Feed */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Clock className="text-indigo-600" />
                Your Feed
              </h2>
              <button
                onClick={handlePrioritize}
                disabled={loading || feed.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-100 flex items-center gap-2"
              >
                {loading ? 'Processing...' : 'Prioritize My Feed'}
              </button>
            </div>

            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {feed.length > 0 ? (
                  feed.map((notif) => (
                    <div key={notif.notification_id}>
                      <NotificationCard notif={notif} isFeed={true} />
                    </div>
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-gray-200"
                  >
                    <CheckCircle className="mx-auto text-gray-300 mb-2" size={48} />
                    <p className="text-gray-500">All caught up!</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Column: Custom Form & Results */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
              <Plus className="text-indigo-600" />
              Triage New
            </h2>
            
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Notification Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Homework 5 due tonight"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
                    <select
                      value={formData.notification_type}
                      onChange={(e) => {
                        const t = e.target.value;
                        const dl = typeHasDeadline(t);
                        setFormData({
                          ...formData,
                          notification_type: t,
                          has_deadline: dl ? 1 : 0,
                          days_until_deadline: dl ? formData.days_until_deadline : 0
                        });
                      }}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="assignment_due">Assignment Due</option>
                      <option value="quiz_due">Quiz Due</option>
                      <option value="announcement">Announcement</option>
                      <option value="event">Event</option>
                      <option value="grade_posted">Grade Posted</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Days Until Due</label>
                    {typeHasDeadline(formData.notification_type) ? (
                      <input
                        type="number"
                        min="0"
                        max="14"
                        value={formData.days_until_deadline}
                        onChange={(e) =>
                          setFormData({ ...formData, days_until_deadline: parseInt(e.target.value, 10) || 0 })
                        }
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    ) : (
                      <div className="w-full px-4 py-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                        Not applicable for this type
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Est. Hours</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.estimated_time_hours}
                      onChange={(e) => setFormData({ ...formData, estimated_time_hours: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_graded === 1}
                        onChange={(e) => setFormData({ ...formData, is_graded: e.target.checked ? 1 : 0 })}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Is Graded?</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requires_submission === 1}
                      onChange={(e) => setFormData({ ...formData, requires_submission: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Requires Submission?</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.teacher_posted === 1}
                      onChange={(e) => setFormData({ ...formData, teacher_posted: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Teacher Posted?</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                >
                  <Send size={18} />
                  Analyze Urgency
                </button>
              </div>
            </form>

            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {customResults.map((notif) => (
                  <div key={notif.notification_id}>
                    <NotificationCard notif={notif} isFeed={false} />
                  </div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}