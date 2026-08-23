"use client";


import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, Clock, Flag, Trash2, Edit2, List, Grid3x3, Check, Circle } from "lucide-react";
import { useToast } from "@/components/Toast";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import { Modal } from "@/components/Modal";
import {
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  type CalendarEvent,
} from "@/lib/api";

const eventTypeConfig = {
  event: { label: "事件", color: "bg-blue-100 text-blue-700 border-blue-200", icon: CalendarIcon },
  todo: { label: "待办", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Clock },
  note: { label: "备注", color: "bg-gray-100 text-gray-700 border-gray-200", icon: Edit2 },
};

const priorityConfig = {
  none: { label: "无", color: "text-gray-400", icon: Circle },
  low: { label: "低", color: "text-green-600", icon: Flag },
  medium: { label: "中", color: "text-orange-600", icon: Flag },
  high: { label: "高", color: "text-red-600", icon: Flag },
};

const statusConfig = {
  pending: { label: "待处理", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  completed: { label: "已完成", color: "bg-green-50 text-green-700 border-green-200" },
  cancelled: { label: "已取消", color: "bg-gray-50 text-gray-600 border-gray-200" },
};

type ViewMode = "calendar" | "list";

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]); // 日历视图的事件（按月）
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]); // 列表视图的所有事件
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const { pushNotification } = useToast();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 日历视图：按月加载
  useEffect(() => {
    if (viewMode === "calendar") {
      fetchCalendarEvents();
    }
  }, [year, month, viewMode]);

  // 列表视图：加载所有事件
  useEffect(() => {
    if (viewMode === "list") {
      fetchAllEvents();
    }
  }, [viewMode]);

  const fetchCalendarEvents = async () => {
    try {
      setLoading(true);
      const startDate = new Date(year, month, 1).toISOString().split("T")[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];
      const events = await listCalendarEvents({ startDate, endDate });
      setCalendarEvents(events);
    } catch (err) {
      console.error("Failed to fetch calendar events:", err);
      pushNotification({
        style: "error",
        title: "加载失败",
        description: "无法加载日历数据",
      });
      setCalendarEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllEvents = async () => {
    try {
      setLoading(true);
      const events = await listCalendarEvents();
      setAllEvents(events);
    } catch (err) {
      console.error("Failed to fetch all events:", err);
      pushNotification({
        style: "error",
        title: "加载失败",
        description: "无法加载事件列表",
      });
      setAllEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setShowEventModal(true);
  };

  const handleDeleteEvent = async (id: number) => {
    // 乐观更新：同时更新两个视图的数据
    setCalendarEvents((prev) => prev.filter((e) => e.id !== id));
    setAllEvents((prev) => prev.filter((e) => e.id !== id));
    
    try {
      await deleteCalendarEvent(id);
      pushNotification({ style: "success", title: "删除成功" });
    } catch {
      pushNotification({ style: "error", title: "删除失败" });
      // 失败时重新加载两个视图的数据
      fetchCalendarEvents();
      fetchAllEvents();
    }
  };

  const handleToggleStatus = async (event: CalendarEvent) => {
    const newStatus: "pending" | "completed" = event.status === "completed" ? "pending" : "completed";
    
    // 乐观更新：同时更新两个视图的数据
    const updateFn = (prev: CalendarEvent[]): CalendarEvent[] =>
      prev.map((e) => (e.id === event.id ? { ...e, status: newStatus } : e));
    
    setCalendarEvents(updateFn);
    setAllEvents(updateFn);
    
    try {
      await updateCalendarEvent(event.id, { ...event, status: newStatus });
    } catch {
      pushNotification({ style: "error", title: "更新失败" });
      // 失败时重新加载两个视图的数据
      fetchCalendarEvents();
      fetchAllEvents();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingOverlay />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                  viewMode === "calendar" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
                日历
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                  viewMode === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <List className="w-4 h-4" />
                列表
              </button>
            </div>
          </div>
          <button
            onClick={handleAddEvent}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建事件
          </button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <CalendarView
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          events={calendarEvents}
          onDateClick={setSelectedDate}
          onEditEvent={handleEditEvent}
        />
      ) : (
        <ListView
          events={allEvents}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterType={filterType}
          setFilterType={setFilterType}
          onEditEvent={handleEditEvent}
          onDeleteEvent={handleDeleteEvent}
          onToggleStatus={handleToggleStatus}
        />
      )}

      {selectedDate && viewMode === "calendar" && (
        <EventSidebar
          date={selectedDate}
          events={calendarEvents.filter((e) => e.date.split('T')[0] === selectedDate)}
          onClose={() => setSelectedDate(null)}
          onEdit={handleEditEvent}
          onDelete={handleDeleteEvent}
          onAdd={handleAddEvent}
        />
      )}

      {showEventModal && (
        <EventModal
          event={editingEvent}
          defaultDate={selectedDate || undefined}
          onClose={() => {
            setShowEventModal(false);
            setEditingEvent(null);
          }}
          onSave={(eventDate) => {
            setShowEventModal(false);
            setEditingEvent(null);
            
            // 检查事件日期是否在当前月份
            const eventDateObj = new Date(eventDate);
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth();
            const eventYear = eventDateObj.getFullYear();
            const eventMonth = eventDateObj.getMonth();
            
            // 如果在日历视图且事件不在当前月份，自动跳转到事件所在月份
            if (viewMode === "calendar" && (eventYear !== currentYear || eventMonth !== currentMonth)) {
              setCurrentDate(new Date(eventYear, eventMonth, 1));
              pushNotification({
                style: "info",
                title: "已跳转到事件所在月份",
                description: `${eventYear}年${eventMonth + 1}月`,
              });
            }
            
            // 刷新两个视图的数据以保持同步
            fetchCalendarEvents();
            fetchAllEvents();
          }}
        />
      )}
    </div>
  );
}


function CalendarView({
  currentDate,
  setCurrentDate,
  events,
  onDateClick,
  onEditEvent,
}: {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  events: CalendarEvent[];
  onDateClick: (date: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const firstDayOfMonth = useMemo(() => new Date(year, month, 1).getDay(), [year, month]);
  const monthName = currentDate.toLocaleDateString("zh-CN", { year: "numeric", month: "long" });

  const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const getDateKey = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const getEventsForDate = (day: number) => {
    const dateKey = getDateKey(day);
    return events.filter((e) => {
      // 处理可能的日期格式差异
      const eventDate = e.date.split('T')[0]; // 移除可能的时间部分
      return eventDate === dateKey;
    });
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  const totalCells = Math.ceil((daysInMonth + firstDayOfMonth) / 7) * 7;

  const renderCalendar = () => {
    const cells = [];
    
    for (let i = 0; i < 7; i++) {
      cells.push(
        <div key={`header-${i}`} className="text-center text-xs font-semibold text-gray-600 py-3 bg-gray-50">
          {weekDays[i]}
        </div>
      );
    }

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstDayOfMonth + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cells.push(<div key={i} className="min-h-[100px] bg-gray-50/50" />);
      } else {
        const dayEvents = getEventsForDate(dayNum);
        const today = isToday(dayNum);
        const dateKey = getDateKey(dayNum);

        cells.push(
          <div
            key={i}
            onClick={() => onDateClick(dateKey)}
            className={`min-h-[120px] border border-gray-200 p-2 cursor-pointer transition-all hover:bg-blue-50 hover:shadow-sm relative group ${
              today ? "bg-blue-50 ring-2 ring-blue-400 ring-inset" : "bg-white"
            }`}
          >
            <div className={`text-sm font-medium mb-2 ${today ? "text-blue-600" : "text-gray-700"}`}>
              {dayNum}
            </div>
            <div className="space-y-1">
              {dayEvents.slice(0, 2).map((event) => {
                const typeConfig = eventTypeConfig[event.event_type];
                const TypeIcon = typeConfig.icon;
                return (
                  <div
                    key={event.id}
                    className={`relative text-xs px-2 py-1 rounded ${typeConfig.color} hover:opacity-90 transition-opacity group/event`}
                  >
                    <div className="flex items-center gap-1 pr-6">
                      <TypeIcon className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate flex-1">{event.title}</span>
                    </div>
                    {/* 编辑按钮 - hover 显示 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditEvent(event);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 bg-white rounded shadow-sm opacity-0 group-hover/event:opacity-100 transition-opacity hover:bg-gray-100"
                      title="编辑事件"
                    >
                      <Edit2 className="w-3 h-3 text-gray-600" />
                    </button>
                  </div>
                );
              })}
              {dayEvents.length > 2 && (
                <div className="text-xs text-gray-500 px-2 py-0.5">+{dayEvents.length - 2} 更多</div>
              )}
            </div>
          </div>
        );
      }
    }
    return cells;
  };

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">{monthName}</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrevMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 rounded-lg transition-colors"
            >
              今天
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-7">
              {renderCalendar()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


function ListView({
  events,
  filterStatus,
  setFilterStatus,
  filterType,
  setFilterType,
  onEditEvent,
  onDeleteEvent,
  onToggleStatus,
}: {
  events: CalendarEvent[];
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filterType: string;
  setFilterType: (type: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: number) => void;
  onToggleStatus: (event: CalendarEvent) => void;
}) {
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const statusMatch = filterStatus === "all" || e.status === filterStatus;
      const typeMatch = filterType === "all" || e.event_type === filterType;
      return statusMatch && typeMatch;
    });
  }, [events, filterStatus, filterType]);

  const groupedEvents = useMemo(() => {
    const groups: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach((event) => {
      // 确保日期格式一致，移除可能的时间部分
      const date = event.date.split('T')[0];
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(event);
    });
    // 按日期倒序排列（最新的在最上面）
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredEvents]);

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">状态:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="all">全部</option>
              <option value="pending">待处理</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">类型:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="all">全部</option>
              <option value="event">事件</option>
              <option value="todo">待办</option>
              <option value="note">备注</option>
            </select>
          </div>
          <div className="ml-auto text-sm text-gray-500">
            共 {filteredEvents.length} 项
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          {groupedEvents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无事件</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedEvents.map(([date, dateEvents]) => {
                // 确保日期格式正确
                const dateObj = new Date(date.includes('T') ? date : date + "T00:00:00");
                const dateStr = dateObj.toLocaleDateString("zh-CN", {
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                });

                return (
                  <div key={date} className="space-y-2">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-sm font-semibold text-gray-700">{dateStr}</h3>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <div className="space-y-1">
                      {dateEvents.map((event) => (
                        <EventRow
                          key={event.id}
                          event={event}
                          onEdit={onEditEvent}
                          onDelete={onDeleteEvent}
                          onToggleStatus={onToggleStatus}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function EventRow({
  event,
  onEdit,
  onDelete,
  onToggleStatus,
}: {
  event: CalendarEvent;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: number) => void;
  onToggleStatus: (event: CalendarEvent) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const typeConfig = eventTypeConfig[event.event_type];
  const TypeIcon = typeConfig.icon;
  const priority = priorityConfig[event.priority];
  const PriorityIcon = priority.icon;
  const status = statusConfig[event.status];

  return (
    <div
      className="group relative bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
      onClick={() => onEdit(event)}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus(event);
          }}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            event.status === "completed"
              ? "bg-green-500 border-green-500"
              : "border-gray-300 hover:border-green-500"
          }`}
        >
          {event.status === "completed" && <Check className="w-3 h-3 text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <TypeIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <h4
              className={`text-sm font-medium truncate ${
                event.status === "completed" ? "text-gray-400 line-through" : "text-gray-900"
              }`}
            >
              {event.title}
            </h4>
          </div>

          {event.description && (
            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{event.description}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${status.color}`}>
              {status.label}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${typeConfig.color}`}>
              {typeConfig.label}
            </span>
            {event.priority !== "none" && (
              <span className={`text-xs flex items-center gap-1 ${priority.color}`}>
                <PriorityIcon className="w-3 h-3" />
                {priority.label}
              </span>
            )}
            {!event.all_day && event.start_time && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {event.start_time}
                {event.end_time && ` - ${event.end_time}`}
              </span>
            )}
          </div>
        </div>

        {showActions && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(event);
              }}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            >
              <Edit2 className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(event.id);
              }}
              className="p-1.5 hover:bg-red-100 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


function EventSidebar({
  date,
  events,
  onClose,
  onEdit,
  onDelete,
  onAdd,
}: {
  date: string;
  events: CalendarEvent[];
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
}) {
  const dateObj = new Date(date.includes('T') ? date : date + "T00:00:00");
  const dateStr = dateObj.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">{dateStr}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {events.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无事件</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const typeConfig = eventTypeConfig[event.event_type];
                const TypeIcon = typeConfig.icon;
                const priority = priorityConfig[event.priority];
                const status = statusConfig[event.status];

                return (
                  <div
                    key={event.id}
                    className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <TypeIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <h3 className="font-medium text-gray-800 truncate">{event.title}</h3>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEdit(event)}
                          className="p-1 hover:bg-white rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => onDelete(event.id)}
                          className="p-1 hover:bg-red-100 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>

                    {event.description && (
                      <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${typeConfig.color}`}>
                        {typeConfig.label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${status.color}`}>
                        {status.label}
                      </span>
                      {event.priority !== "none" && (
                        <span className={`text-xs flex items-center gap-1 ${priority.color}`}>
                          <Flag className="w-3 h-3" />
                          {priority.label}
                        </span>
                      )}
                      {!event.all_day && event.start_time && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {event.start_time}
                          {event.end_time && ` - ${event.end_time}`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onAdd}
            className="w-full py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            添加事件
          </button>
        </div>
      </div>
    </>
  );
}


function EventModal({
  event,
  defaultDate,
  onClose,
  onSave,
}: {
  event: CalendarEvent | null;
  defaultDate?: string;
  onClose: () => void;
  onSave: (eventDate: string) => void;
}) {
  const { pushNotification } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    date: event?.date || defaultDate || new Date().toISOString().split("T")[0],
    title: event?.title || "",
    description: event?.description || "",
    event_type: event?.event_type || "event" as "event" | "todo" | "note",
    status: event?.status || "pending" as "pending" | "completed" | "cancelled",
    priority: event?.priority || "none" as "none" | "low" | "medium" | "high",
    all_day: event?.all_day ?? true,
    start_time: event?.start_time || "",
    end_time: event?.end_time || "",
    color: event?.color || "",
  });

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.date) {
      pushNotification({ style: "error", title: "请填写标题和日期" });
      return;
    }

    setSubmitting(true);
    try {
      if (event) {
        await updateCalendarEvent(event.id, formData);
      } else {
        await createCalendarEvent(formData);
      }

      pushNotification({
        style: "success",
        title: event ? "更新成功" : "创建成功",
      });
      onSave(formData.date); // 传递事件日期
    } catch {
      pushNotification({
        style: "error",
        title: event ? "更新失败" : "创建失败",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={event ? "编辑事件" : "新建事件"}
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {submitting ? "保存中..." : "保存"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">标题 *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="事件标题"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">日期 *</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
          <div className="flex gap-2">
            {(["event", "todo", "note"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFormData({ ...formData, event_type: type })}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  formData.event_type === type
                    ? "border-accent bg-accent text-white"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                {eventTypeConfig[type].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
          <div className="flex gap-2">
            {(["pending", "completed", "cancelled"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFormData({ ...formData, status })}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  formData.status === status
                    ? "border-accent bg-accent text-white"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                {statusConfig[status].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">优先级</label>
          <div className="flex gap-2">
            {(["none", "low", "medium", "high"] as const).map((priority) => (
              <button
                key={priority}
                onClick={() => setFormData({ ...formData, priority })}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  formData.priority === priority
                    ? "border-accent bg-accent text-white"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                {priorityConfig[priority].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.all_day}
              onChange={(e) => setFormData({ ...formData, all_day: e.target.checked })}
              className="w-4 h-4 text-accent rounded focus:ring-accent"
            />
            <span className="text-sm text-gray-700">全天事件</span>
          </label>
        </div>

        {!formData.all_day && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="添加描述..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
      </div>
    </Modal>
  );
}
