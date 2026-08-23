package store

import (
	"time"

	"gorm.io/gorm"
)

type Exhibition struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	Region        string     `gorm:"type:varchar(100);not null" json:"region"`
	Name          string     `gorm:"type:varchar(255);not null" json:"name"`
	StartDate     *time.Time `gorm:"type:date" json:"start_date"`
	EndDate       *time.Time `gorm:"type:date" json:"end_date"`
	Location      string     `gorm:"type:varchar(255)" json:"location"`
	Type          string     `gorm:"type:varchar(50)" json:"type"`
	BoothFee      string     `gorm:"type:varchar(50)" json:"booth_fee"`
	Contact       string     `gorm:"type:varchar(100)" json:"contact"`
	Remark        string     `gorm:"type:text" json:"remark"`
	Status        string     `gorm:"type:varchar(20);not null;default:'待商榷'" json:"status"`
	CoverImageID  *uint      `json:"cover_image_id"`
	CoverImage    *File      `gorm:"foreignKey:CoverImageID;constraint:OnDelete:SET NULL" json:"cover_image,omitempty"`
	Description   string     `gorm:"type:text" json:"description"`
	Link          string     `gorm:"type:varchar(500)" json:"link"`
	Attachments   []ExhibitionAttachment `gorm:"foreignKey:ExhibitionID;constraint:OnDelete:CASCADE" json:"attachments,omitempty"`
	CreatedAt     time.Time  `gorm:"autoCreateTime" json:"created_at"`
}

func (Exhibition) TableName() string {
	return "exhibition"
}

type ExhibitionAttachment struct {
	ID            uint   `gorm:"primaryKey" json:"id"`
	ExhibitionID  uint   `gorm:"not null;index" json:"exhibition_id"`
	FileID        uint   `gorm:"not null" json:"file_id"`
	File          File   `gorm:"foreignKey:FileID;constraint:OnDelete:CASCADE" json:"file"`
}

func (ExhibitionAttachment) TableName() string {
	return "exhibition_attachments"
}

type ExhibitionQuery struct {
	Region string `form:"region"`
	Status string `form:"status"`
}

func (q ExhibitionQuery) BuildQuery(db *gorm.DB) *gorm.DB {
	if q.Region != "" {
		db = db.Where("region = ?", q.Region)
	}
	if q.Status != "" {
		db = db.Where("status = ?", q.Status)
	}
	return db
}

func GetAllExhibitions(query ExhibitionQuery) ([]Exhibition, error) {
	var exhibitions []Exhibition
	db := query.BuildQuery(DB).
		Preload("CoverImage").
		Preload("Attachments.File").
		Order("COALESCE(start_date, '1970-01-01') DESC, created_at DESC")
	err := db.Find(&exhibitions).Error
	return exhibitions, err
}

func GetExhibitionByID(id uint) (*Exhibition, error) {
	var exhibition Exhibition
	err := DB.
		Preload("CoverImage").
		Preload("Attachments.File").
		First(&exhibition, id).Error
	if err != nil {
		return nil, err
	}
	return &exhibition, nil
}

func CreateExhibition(exhibition *Exhibition) error {
	return DB.Create(exhibition).Error
}

func UpdateExhibition(exhibition *Exhibition) error {
	return DB.Save(exhibition).Error
}

func ReplaceExhibitionAttachments(exhibitionID uint, fileIDs []uint) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("exhibition_id = ?", exhibitionID).
			Delete(&ExhibitionAttachment{}).Error; err != nil {
			return err
		}
		if len(fileIDs) == 0 {
			return nil
		}
		records := make([]ExhibitionAttachment, len(fileIDs))
		for i, fid := range fileIDs {
			records[i] = ExhibitionAttachment{ExhibitionID: exhibitionID, FileID: fid}
		}
		return tx.Create(records).Error
	})
}

func DeleteExhibition(id uint) error {
	return DB.Delete(&Exhibition{}, id).Error
}

func GetExhibitionStats() (map[string]interface{}, error) {
	var total int64
	var statusCounts map[string]int64

	DB.Model(&Exhibition{}).Count(&total)

	statusCounts = make(map[string]int64)
	rows, err := DB.Model(&Exhibition{}).Select("status, COUNT(*)").Group("status").Rows()
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

	regionCounts := make(map[string]int64)
	rows, err = DB.Model(&Exhibition{}).Select("region, COUNT(*)").Group("region").Rows()
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	for rows.Next() {
		var region string
		var count int64
		if err := rows.Scan(&region, &count); err != nil {
			return nil, err
		}
		regionCounts[region] = count
	}

	return map[string]interface{}{
		"total":         total,
		"status_counts": statusCounts,
		"region_counts": regionCounts,
	}, nil
}
