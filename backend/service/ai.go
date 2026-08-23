package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"

	"processDelphicData/config"
	"processDelphicData/store"

	"github.com/google/generative-ai-go/genai"
	"github.com/openai/openai-go"
	openaiopt "github.com/openai/openai-go/option"
	"github.com/openai/openai-go/shared"
	gapiopt "google.golang.org/api/option"
)

// ExtractedExhibition is the JSON structure returned by AI extraction.
type ExtractedExhibition struct {
	Name        string `json:"name"`
	Region      string `json:"region"`
	Location    string `json:"location"`
	Type        string `json:"type"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
	BoothFee    string `json:"booth_fee"`
	Contact     string `json:"contact"`
	Description string `json:"description"`
	Link        string `json:"link"`
	Remark      string `json:"remark"`
	Status      string `json:"status"`
}

const extractionPrompt = `You are an assistant that extracts exhibition/activity information from images of posters or advertisements.
Extract the following information in JSON format. Use Chinese language for all text fields.
If a field cannot be determined, use an empty string.
Do not think or reason. Just output the JSON directly.

Fields:
- name (string, required): The exhibition/activity name
- region (string): The region/city
- location (string): The venue/location
- type (string): The type (e.g. 国际展会, 交流会, 博览会, etc.)
- start_date (string, format YYYY-MM-DD): Start date
- end_date (string, format YYYY-MM-DD): End date
- booth_fee (string): Booth fee information
- contact (string): Contact info
- description (string): Detailed description
- link (string): External URL
- remark (string): Additional remarks
- status (string): One of: 关切, 待商榷, 不考虑, 计划前往

Return ONLY valid JSON, no markdown formatting or additional text.`

// ExtractExhibitionFromImage reads a file from the store and sends it to the AI
// provider configured in backend/config.yaml.
func ExtractExhibitionFromImage(fileID uint) (*ExtractedExhibition, error) {
	file, err := readFileByID(fileID)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	cfg := config.GetAi()
	provider := cfg.DefaultProvider
	if provider == "" {
		provider = "openai"
	}

	switch provider {
	case "openai":
		return callOpenAI(file.Data, file.MimeType, cfg.OpenAIEndpoint, cfg.OpenAIKey, cfg.OpenAIModel)
	case "google":
		return callGoogleGenAI(file.Data, file.MimeType, cfg.GoogleKey, cfg.GoogleModel)
	default:
		return nil, fmt.Errorf("unsupported AI provider: %s (supported: openai, google)", provider)
	}
}

func readFileByID(id uint) (*store.File, error) {
	var f store.File
	if err := store.DB.First(&f, id).Error; err != nil {
		return nil, err
	}
	return &f, nil
}

func callOpenAI(imageData []byte, mimeType, endpoint, apiKey, model string) (*ExtractedExhibition, error) {
	if apiKey == "" {
		return nil, errors.New("OpenAI API key is not configured")
	}

	var clientOpts []openaiopt.RequestOption
	clientOpts = append(clientOpts, openaiopt.WithAPIKey(apiKey))
	if endpoint != "" {
		ep := strings.TrimRight(endpoint, "/")
		if !strings.HasSuffix(ep, "/v1") {
			ep += "/v1"
		}
		clientOpts = append(clientOpts, openaiopt.WithBaseURL(ep+"/"))
	}

	client := openai.NewClient(clientOpts...)

	base64Data := base64.StdEncoding.EncodeToString(imageData)
	dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)

	chatResp, err := client.Chat.Completions.New(context.Background(), openai.ChatCompletionNewParams{
		Model:       shared.ChatModel(model),
		MaxTokens:   openai.Int(int64(4096)),
		Temperature: openai.Float(0.2),
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.UserMessage([]openai.ChatCompletionContentPartUnionParam{
				openai.TextContentPart(extractionPrompt),
				openai.ImageContentPart(openai.ChatCompletionContentPartImageImageURLParam{
					URL:    dataURL,
					Detail: "auto",
				}),
			}),
		},
		ResponseFormat: openai.ChatCompletionNewParamsResponseFormatUnion{
			OfJSONObject: openai.Ptr(shared.NewResponseFormatJSONObjectParam()),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("OpenAI API call failed: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		return nil, errors.New("OpenAI returned no choices")
	}

	content := chatResp.Choices[0].Message.Content
	if content == "" {
		raw := chatResp.Choices[0].RawJSON()
		var rawResp struct {
			Message struct {
				Content *string `json:"content"`
			} `json:"message"`
		}
		if err := json.Unmarshal([]byte(raw), &rawResp); err == nil && rawResp.Message.Content != nil {
			content = *rawResp.Message.Content
		}
	}
	log.Printf("[AI] OpenAI raw response: %s", truncate(content, 500))
	return parseAIResponse(content)
}

func callGoogleGenAI(imageData []byte, mimeType, apiKey, model string) (*ExtractedExhibition, error) {
	if apiKey == "" {
		return nil, errors.New("google API key is not configured")
	}

	genaiClient, err := genai.NewClient(context.Background(), gapiopt.WithAPIKey(apiKey))
	if err != nil {
		return nil, fmt.Errorf("failed to create GenAI client: %w", err)
	}
	defer func() { _ = genaiClient.Close() }()

	gm := genaiClient.GenerativeModel(model)
	gm.SetTemperature(0.2)
	gm.SetMaxOutputTokens(4096)

	mimeParts := strings.Split(mimeType, "/")
	imgFormat := mimeParts[len(mimeParts)-1]
	if imgFormat == "jpeg" {
		imgFormat = "jpg"
	}

	resp, err := gm.GenerateContent(
		context.Background(),
		genai.Text(extractionPrompt),
		genai.ImageData(imgFormat, imageData),
	)
	if err != nil {
		return nil, fmt.Errorf("google GenAI API call failed: %w", err)
	}

	if len(resp.Candidates) == 0 || resp.Candidates[0].Content == nil {
		return nil, errors.New("google GenAI returned no candidates")
	}

	var content strings.Builder
	for _, part := range resp.Candidates[0].Content.Parts {
		if text, ok := part.(genai.Text); ok {
			content.WriteString(string(text))
		}
	}

	if content.Len() == 0 {
		return nil, errors.New("google GenAI returned no text content")
	}

	text := content.String()
	log.Printf("[AI] Google GenAI raw response: %s", truncate(text, 500))
	return parseAIResponse(text)
}

func parseAIResponse(content string) (*ExtractedExhibition, error) {
	content = strings.TrimSpace(content)

	if strings.HasPrefix(content, "```") {
		start := strings.Index(content, "{")
		end := strings.LastIndex(content, "}")
		if start >= 0 && end > start {
			content = content[start : end+1]
		}
	}

	content = strings.TrimSpace(content)
	content = fixInvalidJSONEscapes(content)

	var result ExtractedExhibition
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		start := strings.Index(content, "{")
		end := strings.LastIndex(content, "}")
		if start >= 0 && end > start {
			inner := content[start : end+1]
			if err2 := json.Unmarshal([]byte(inner), &result); err2 != nil {
				return nil, fmt.Errorf("failed to parse AI response as JSON (%s): %w", truncate(content, 300), err2)
			}
			return &result, nil
		}
		return nil, fmt.Errorf("failed to parse AI response as JSON: %w (raw: %s)", err, truncate(content, 300))
	}

	return &result, nil
}

func fixInvalidJSONEscapes(s string) string {
	var result strings.Builder
	result.Grow(len(s))
	bytes := []byte(s)
	for i := 0; i < len(bytes); i++ {
		if bytes[i] == '\\' && i+1 < len(bytes) {
			next := bytes[i+1]
			switch next {
			case '"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u':
				result.WriteByte('\\')
				result.WriteByte(next)
				i++
			default:
				result.WriteByte(next)
				i++
			}
		} else {
			result.WriteByte(bytes[i])
		}
	}
	return result.String()
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
