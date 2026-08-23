package store

import "time"

type File struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Data      []byte    `gorm:"type:bytea;not null" json:"data"`
	Ext       string    `gorm:"type:varchar(10)" json:"ext"`
	MimeType  string    `gorm:"type:varchar(50)" json:"mime_type"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (File) TableName() string {
	return "files"
}
