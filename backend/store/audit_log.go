package store

import (
	"time"
)

type AuditLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Path      string    `gorm:"type:varchar(500);not null" json:"path"`
	Method    string    `gorm:"type:varchar(10);not null" json:"method"`
	Status    int       `gorm:"not null" json:"status"`
	LatencyMs int64     `gorm:"not null" json:"latency_ms"`
	IP        string    `gorm:"type:varchar(45)" json:"ip"`
	Origin    string    `gorm:"type:varchar(500)" json:"origin"`
	Error     string    `gorm:"type:text" json:"error"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}

func CreateAuditLog(log *AuditLog) error {
	return DB.Create(log).Error
}

type AuditLogQuery struct {
	Page  int `form:"page"`
	Limit int `form:"limit"`
}

func QueryAuditLogs(q AuditLogQuery) ([]AuditLog, int64, error) {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.Limit < 1 || q.Limit > 100 {
		q.Limit = 30
	}
	var total int64
	if err := DB.Model(&AuditLog{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var logs []AuditLog
	offset := (q.Page - 1) * q.Limit
	err := DB.Order("created_at DESC").Offset(offset).Limit(q.Limit).Find(&logs).Error
	return logs, total, err
}
