package main

import (
	"fmt"
	"log"
	"math/rand"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// User represents a user in the leaderboard
type User struct {
	Username string `json:"username"`
	Rating   int    `json:"rating"`
	Rank     int    `json:"rank"`
}

// LeaderboardManager manages the leaderboard with efficient ranking
type LeaderboardManager struct {
	users         map[string]*User
	sortedUsers   []*User
	mu            sync.RWMutex
	needsRerank   bool
	rankCache     map[int]int
	usernameLower map[string]string
}

// NewLeaderboardManager creates a new leaderboard manager
func NewLeaderboardManager() *LeaderboardManager {
	return &LeaderboardManager{
		users:         make(map[string]*User),
		sortedUsers:   make([]*User, 0),
		needsRerank:   false,
		rankCache:     make(map[int]int),
		usernameLower: make(map[string]string),
	}
}

// AddUser adds a new user to the leaderboard
func (lm *LeaderboardManager) AddUser(username string, rating int) {
	lm.mu.Lock()
	defer lm.mu.Unlock()

	if rating < 100 {
		rating = 100
	}
	if rating > 5000 {
		rating = 5000
	}

	user := &User{
		Username: username,
		Rating:   rating,
		Rank:     0,
	}

	lm.users[username] = user
	lm.usernameLower[strings.ToLower(username)] = username
	lm.sortedUsers = append(lm.sortedUsers, user)
	lm.needsRerank = true
}

// UpdateRating updates a user's rating
func (lm *LeaderboardManager) UpdateRating(username string, newRating int) bool {
	lm.mu.Lock()
	defer lm.mu.Unlock()

	user, exists := lm.users[username]
	if !exists {
		return false
	}

	if newRating < 100 {
		newRating = 100
	}
	if newRating > 5000 {
		newRating = 5000
	}

	user.Rating = newRating
	lm.needsRerank = true
	return true
}

// recalculateRanks recalculates ranks for all users
func (lm *LeaderboardManager) recalculateRanks() {
	if !lm.needsRerank {
		return
	}

	// Sort users by rating (descending), then by username
	sort.Slice(lm.sortedUsers, func(i, j int) bool {
		if lm.sortedUsers[i].Rating == lm.sortedUsers[j].Rating {
			return lm.sortedUsers[i].Username < lm.sortedUsers[j].Username
		}
		return lm.sortedUsers[i].Rating > lm.sortedUsers[j].Rating
	})

	// Clear rank cache
	lm.rankCache = make(map[int]int)

	// Assign ranks (handle ties)
	currentRank := 1
	for i, user := range lm.sortedUsers {
		if i > 0 && lm.sortedUsers[i-1].Rating != user.Rating {
			currentRank = i + 1
		}
		user.Rank = currentRank

		if _, exists := lm.rankCache[user.Rating]; !exists {
			lm.rankCache[user.Rating] = currentRank
		}
	}

	lm.needsRerank = false
}

// GetLeaderboard returns paginated leaderboard
func (lm *LeaderboardManager) GetLeaderboard(page, pageSize int) []User {
	lm.mu.Lock()
	lm.recalculateRanks()
	lm.mu.Unlock()

	lm.mu.RLock()
	defer lm.mu.RUnlock()

	start := (page - 1) * pageSize
	end := start + pageSize

	if start >= len(lm.sortedUsers) {
		return []User{}
	}

	if end > len(lm.sortedUsers) {
		end = len(lm.sortedUsers)
	}

	result := make([]User, end-start)
	for i := start; i < end; i++ {
		result[i-start] = *lm.sortedUsers[i]
	}

	return result
}

// SearchUser searches for users by username (case-insensitive)
func (lm *LeaderboardManager) SearchUser(searchTerm string) []User {
	lm.mu.Lock()
	lm.recalculateRanks()
	lm.mu.Unlock()

	lm.mu.RLock()
	defer lm.mu.RUnlock()

	searchLower := strings.ToLower(searchTerm)
	results := make([]User, 0)

	for _, user := range lm.sortedUsers {
		if strings.Contains(strings.ToLower(user.Username), searchLower) {
			results = append(results, *user)
		}
	}

	return results
}

// GetTotalUsers returns total number of users
func (lm *LeaderboardManager) GetTotalUsers() int {
	lm.mu.RLock()
	defer lm.mu.RUnlock()
	return len(lm.users)
}

// SeedUsers generates initial users
func (lm *LeaderboardManager) SeedUsers(count int) {
	firstNames := []string{
		"rahul", "priya", "amit", "sneha", "vikram", "anjali", "rohan", "pooja",
		"arjun", "neha", "karan", "divya", "raj", "shreya", "aditya", "kavya",
		"siddharth", "riya", "varun", "meera", "akash", "tanvi", "dev", "ishita",
		"aman", "nisha", "harsh", "ananya", "kunal", "sanya",
	}

	lastNames := []string{
		"kumar", "sharma", "patel", "singh", "verma", "gupta", "reddy", "mehta",
		"joshi", "nair", "burman", "mathur", "kapoor", "mishra", "iyer", "desai",
		"bhat", "menon", "rao", "krishnan", "agarwal", "malhotra", "chopra", "sinha",
		"pandey", "chauhan", "ghosh", "banerjee", "saxena", "trivedi",
	}

	rand.Seed(time.Now().UnixNano())

	fmt.Println("Starting to seed users...")
	
	for i := 0; i < count; i++ {
		firstName := firstNames[rand.Intn(len(firstNames))]
		lastName := lastNames[rand.Intn(len(lastNames))]
		username := fmt.Sprintf("%s_%s%d", firstName, lastName, i)
		rating := rand.Intn(4901) + 100 // 100 to 5000

		lm.AddUser(username, rating)

		if (i+1)%1000 == 0 {
			fmt.Printf("Seeded %d users...\n", i+1)
		}
	}

	log.Printf("✅ Successfully seeded %d users!", count)
}

// SimulateScoreUpdates continuously updates random user scores
func (lm *LeaderboardManager) SimulateScoreUpdates(updatesPerSecond int) {
	ticker := time.NewTicker(time.Second / time.Duration(updatesPerSecond))
	go func() {
		updateCount := 0
		for range ticker.C {
			lm.mu.RLock()
			if len(lm.sortedUsers) == 0 {
				lm.mu.RUnlock()
				continue
			}
			randomUser := lm.sortedUsers[rand.Intn(len(lm.sortedUsers))]
			username := randomUser.Username
			lm.mu.RUnlock()

			// Random rating change between -50 and +50
			change := rand.Intn(101) - 50
			lm.mu.RLock()
			user := lm.users[username]
			currentRating := user.Rating
			lm.mu.RUnlock()

			newRating := currentRating + change
			lm.UpdateRating(username, newRating)

			updateCount++
			if updateCount%100 == 0 {
				log.Printf("📊 Processed %d score updates...", updateCount)
			}
		}
	}()
}

var leaderboard *LeaderboardManager

func main() {
	fmt.Println("🏆 ========================================")
	fmt.Println("🏆  SCALABLE LEADERBOARD SYSTEM - BACKEND")
	fmt.Println("🏆 ========================================")
	fmt.Println()

	// Initialize leaderboard
	leaderboard = NewLeaderboardManager()

	// Seed with 10,000 users
	log.Println("📦 Seeding database with users...")
	leaderboard.SeedUsers(1000)
	fmt.Println()

	// Start simulating score updates (10 updates per second)
	log.Println("🔄 Starting real-time score update simulation...")
	log.Println("   → 10 score updates per second")
	leaderboard.SimulateScoreUpdates(10)
	fmt.Println()

	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	// CORS configuration
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"*"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept"}
	router.Use(cors.New(config))

	// API Routes
	router.GET("/api/leaderboard", getLeaderboard)
	router.GET("/api/search", searchUsers)
	router.GET("/api/stats", getStats)

	// Health check
	router.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "running",
			"message": "Leaderboard API is live!",
			"users":   leaderboard.GetTotalUsers(),
		})
	})

	// Start server
	fmt.Println("🚀 ========================================")
	fmt.Println("🚀  SERVER STARTED SUCCESSFULLY!")
	fmt.Println("🚀 ========================================")
	fmt.Println()
	fmt.Println("📍 Server running on: http://localhost:8080")
	fmt.Println()
	fmt.Println("📌 Available Endpoints:")
	fmt.Println("   GET  /api/leaderboard?page=1&pageSize=50")
	fmt.Println("   GET  /api/search?q=username")
	fmt.Println("   GET  /api/stats")
	fmt.Println()
	fmt.Println("💡 Press Ctrl+C to stop the server")
	fmt.Println()

	if err := router.Run(":8080"); err != nil {
		log.Fatal("❌ Failed to start server:", err)
	}
}

// Handler: Get paginated leaderboard
func getLeaderboard(c *gin.Context) {
	page := 1
	pageSize := 50

	if p := c.Query("page"); p != "" {
		fmt.Sscanf(p, "%d", &page)
	}
	if ps := c.Query("pageSize"); ps != "" {
		fmt.Sscanf(ps, "%d", &pageSize)
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}

	users := leaderboard.GetLeaderboard(page, pageSize)

	c.JSON(200, gin.H{
		"users":      users,
		"page":       page,
		"pageSize":   pageSize,
		"totalUsers": leaderboard.GetTotalUsers(),
	})
}

// Handler: Search users
func searchUsers(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(400, gin.H{"error": "query parameter 'q' is required"})
		return
	}

	results := leaderboard.SearchUser(query)

	c.JSON(200, gin.H{
		"results": results,
		"count":   len(results),
	})
}

// Handler: Get stats
func getStats(c *gin.Context) {
	c.JSON(200, gin.H{
		"totalUsers": leaderboard.GetTotalUsers(),
		"status":     "healthy",
	})
}