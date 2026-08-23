package store

import (
	"fmt"
	"log"

	"processDelphicData/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() error {
	cfg := config.GetDatabase()

	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=disable TimeZone=Asia/Shanghai",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Name,
	)

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("Database connected successfully")
	return nil
}

func Migrate() error {
	if DB == nil {
		return fmt.Errorf("database not initialized")
	}

	err := DB.AutoMigrate(
		&FundFlow{},
		&Exhibition{},
		&ExhibitionAttachment{},
		&Dashboard{},
		&Product{},
		&SKU{},
		&Inventory{},
		&InventoryLock{},
		&Order{},
		&CalendarEvent{},
		&File{},
		&AuditLog{},
	)
	if err != nil {
		return fmt.Errorf("failed to migrate: %w", err)
	}

	log.Println("Database migrated successfully")

	if err := migrateLegacyData(); err != nil {
		return fmt.Errorf("failed to migrate legacy data: %w", err)
	}

	return nil
}

// migrateLegacyData migrates old Product.Image bytea and Exhibition.CoverImage/Attachments
// to the new files-based storage. No-op after first run (columns already dropped).
func migrateLegacyData() error {
	// Migrate Product.Image bytea → files table
	if DB.Migrator().HasColumn(&Product{}, "image") {
		log.Println("Migrating legacy Product.Image data...")
		var products []struct {
			ID    string `gorm:"column:id"`
			Image []byte `gorm:"column:image"`
		}
		if err := DB.Table("products").Where("image IS NOT NULL AND image != ''").Find(&products).Error; err != nil {
			return fmt.Errorf("failed to query legacy product images: %w", err)
		}
		for _, p := range products {
			f := File{Data: p.Image, Ext: ".jpg", MimeType: "image/jpeg"}
			if err := DB.Create(&f).Error; err != nil {
				return fmt.Errorf("failed to create file for product %s: %w", p.ID, err)
			}
			if err := DB.Table("products").Where("id = ?", p.ID).Update("cover_file_id", f.ID).Error; err != nil {
				return fmt.Errorf("failed to update product %s: %w", p.ID, err)
			}
		}
		if err := DB.Migrator().DropColumn(&Product{}, "image"); err != nil {
			return fmt.Errorf("drop product.image column: %w", err)
		}
		log.Printf("Migrated %d product images to files table", len(products))
	}

	// Drop legacy Exhibition columns (files no longer on disk)
	if DB.Migrator().HasColumn(&Exhibition{}, "cover_image") {
		log.Println("Dropping legacy Exhibition.CoverImage/Attachments columns...")
		if err := DB.Migrator().DropColumn(&Exhibition{}, "cover_image"); err != nil {
			return fmt.Errorf("drop exhibition.cover_image column: %w", err)
		}
		if err := DB.Migrator().DropColumn(&Exhibition{}, "attachments"); err != nil {
			return fmt.Errorf("drop exhibition.attachments column: %w", err)
		}
	}

	return nil
}

func CloseDB() error {
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
