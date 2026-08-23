package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Database DatabaseConfig `yaml:"database"`
	Server   ServerConfig   `yaml:"server"`
	Ai       AiConfig       `yaml:"ai"`
}

type DatabaseConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	Name     string `yaml:"name"`
}

type ServerConfig struct {
	Port      int    `yaml:"port"`
	StaticDir string `yaml:"static_dir"`
}

type AiConfig struct {
	DefaultProvider string `yaml:"default_provider"`

	OpenAIEndpoint string `yaml:"openai_endpoint"`
	OpenAIKey      string `yaml:"openai_key"`
	OpenAIModel    string `yaml:"openai_model"`

	GoogleEndpoint string `yaml:"google_endpoint"`
	GoogleKey      string `yaml:"google_key"`
	GoogleModel    string `yaml:"google_model"`
}

var cfg Config

func Load(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read config file: %w", err)
	}

	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return fmt.Errorf("failed to parse config file: %w", err)
	}

	if v := os.Getenv("STATIC_DIR"); v != "" {
		cfg.Server.StaticDir = v
	}

	// Fill in defaults
	if cfg.Ai.DefaultProvider == "" {
		cfg.Ai.DefaultProvider = "openai"
	}
	if cfg.Ai.OpenAIEndpoint == "" {
		cfg.Ai.OpenAIEndpoint = "https://api.openai.com/v1"
	}
	if cfg.Ai.OpenAIModel == "" {
		cfg.Ai.OpenAIModel = "gpt-4o"
	}
	if cfg.Ai.GoogleEndpoint == "" {
		cfg.Ai.GoogleEndpoint = "https://generativelanguage.googleapis.com/v1beta"
	}
	if cfg.Ai.GoogleModel == "" {
		cfg.Ai.GoogleModel = "gemini-2.0-flash-exp"
	}

	return nil
}

func Get() Config {
	return cfg
}

func GetDatabase() DatabaseConfig {
	return cfg.Database
}

func GetServer() ServerConfig {
	return cfg.Server
}

func GetAi() AiConfig {
	return cfg.Ai
}