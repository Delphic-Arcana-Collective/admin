package store

import (
	"time"

	"gorm.io/gorm"
)

type CalendarEvent struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Date        string    `gorm:"type:date;not null;index" json:"date"`
	Title       string    `gorm:"type:varchar(255)" json:"title"`
	Description string    `gorm:"type:text" json:"description"`
	EventType   string    `gorm:"type:varchar(50);default:'event'" json:"event_type"` // event, todo, note
	Status      string    `gorm:"type:varchar(20);default:'pending'" json:"status"`   // pending, completed, cancelled
	Priority    string    `gorm:"type:varchar(20);default:'none'" json:"priority"`    // none, low, medium, high
	AllDay      bool      `gorm:"default:true" json:"all_day"`
	StartTime   string    `gorm:"type:varchar(10)" json:"start_time"` // HH:MM format
	EndTime     string    `gorm:"type:varchar(10)" json:"end_time"`   // HH:MM format
	Color       string    `gorm:"type:varchar(20)" json:"color"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (CalendarEvent) TableName() string {
	return "calendar_events"
}

type CalendarEventQuery struct {
	StartDate string `form:"start_date"`
	EndDate   string `form:"end_date"`
	EventType string `form:"event_type"`
	Status    string `form:"status"`
}

func (q CalendarEventQuery) BuildQuery(db *gorm.DB) *gorm.DB {
	if q.StartDate != "" {
		db = db.Where("date >= ?", q.StartDate)
	}
	if q.EndDate != "" {
		db = db.Where("date <= ?", q.EndDate)
	}
	if q.EventType != "" {
		db = db.Where("event_type = ?", q.EventType)
	}
	if q.Status != "" {
		db = db.Where("status = ?", q.Status)
	}
	return db
}

func GetAllCalendarEvents(query CalendarEventQuery) ([]CalendarEvent, error) {
	var events []CalendarEvent
	db := query.BuildQuery(DB).Order("date ASC, start_time ASC")
	err := db.Find(&events).Error
	return events, err
}

func GetCalendarEventByID(id uint) (*CalendarEvent, error) {
	var event CalendarEvent
	err := DB.First(&event, id).Error
	if err != nil {
		return nil, err
	}
	return &event, nil
}

func GetCalendarEventsByDate(date string) ([]CalendarEvent, error) {
	var events []CalendarEvent
	err := DB.Where("date = ?", date).Order("start_time ASC").Find(&events).Error
	return events, err
}

func CreateCalendarEvent(event *CalendarEvent) error {
	return DB.Create(event).Error
}

func UpdateCalendarEvent(event *CalendarEvent) error {
	return DB.Save(event).Error
}

func DeleteCalendarEvent(id uint) error {
	return DB.Delete(&CalendarEvent{}, id).Error
}

func GetCalendarEventStats() (map[string]interface{}, error) {
	var total int64
	var statusCounts map[string]int64
	var typeCounts map[string]int64

	DB.Model(&CalendarEvent{}).Count(&total)

	statusCounts = make(map[string]int64)
	rows, err := DB.Model(&CalendarEvent{}).Select("status, COUNT(*)").Group("status").Rows()
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	for rows.Next() {
		var status string
		var count int64
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		statusCounts[status] = count
	}

	typeCounts = make(map[string]int64)
	rows, err = DB.Model(&CalendarEvent{}).Select("event_type, COUNT(*)").Group("event_type").Rows()
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	for rows.Next() {
		var eventType string
		var count int64
		if err := rows.Scan(&eventType, &count); err != nil {
			return nil, err
		}
		typeCounts[eventType] = count
	}

	return map[string]interface{}{
		"total":         total,
		"status_counts": statusCounts,
		"type_counts":   typeCounts,
	}, nil
}
