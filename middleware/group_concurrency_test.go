package middleware

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupGroupConcurrencyTestDB(t *testing.T) {
	t.Helper()
	require.NoError(t, i18n.Init())
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	// A shared in-memory database only exists on one connection.
	sqlDB.SetMaxOpenConns(1)

	previousDB := model.DB
	model.DB = db
	require.NoError(t, db.AutoMigrate(&model.Task{}))
	t.Cleanup(func() { model.DB = previousDB })
}

// newGroupConcurrencyEngine builds an engine with the group already resolved, so
// the middleware sees the same context a real relay request would.
func newGroupConcurrencyEngine(group string, userId int, handler gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUsingGroup, group)
		c.Set("id", userId)
	})
	engine.GET("/hold", GroupConcurrencyLimit(), handler)
	return engine
}

func setGroupConcurrencyLimit(t *testing.T, limits string, queueSeconds int) {
	t.Helper()
	require.NoError(t, setting.UpdateGroupConcurrencyLimitByJSONString(limits))
	previousTimeout := setting.GroupConcurrencyQueueTimeoutSeconds
	setting.GroupConcurrencyQueueTimeoutSeconds = queueSeconds
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateGroupConcurrencyLimitByJSONString(`{}`))
		setting.GroupConcurrencyQueueTimeoutSeconds = previousTimeout
	})
}

func TestGroupConcurrencyLimitRejectsAndFreesTheSlot(t *testing.T) {
	setupGroupConcurrencyTestDB(t)
	setGroupConcurrencyLimit(t, `{"default": 1}`, 0)

	var blockOnce sync.Once
	entered := make(chan struct{})
	release := make(chan struct{})
	engine := newGroupConcurrencyEngine("default", 1, func(c *gin.Context) {
		blockOnce.Do(func() {
			close(entered)
			<-release
		})
		c.Status(http.StatusOK)
	})

	firstDone := make(chan struct{})
	first := httptest.NewRecorder()
	go func() {
		defer close(firstDone)
		engine.ServeHTTP(first, httptest.NewRequest(http.MethodGet, "/hold", nil))
	}()
	<-entered

	// The group limit is 1 and the first request still holds it.
	second := httptest.NewRecorder()
	engine.ServeHTTP(second, httptest.NewRequest(http.MethodGet, "/hold", nil))
	assert.Equal(t, http.StatusTooManyRequests, second.Code)

	close(release)
	<-firstDone
	assert.Equal(t, http.StatusOK, first.Code)

	// The slot must be handed back once the request finishes.
	third := httptest.NewRecorder()
	engine.ServeHTTP(third, httptest.NewRequest(http.MethodGet, "/hold", nil))
	assert.Equal(t, http.StatusOK, third.Code)
}

func TestGroupConcurrencyLimitCountsUnfinishedTasks(t *testing.T) {
	setupGroupConcurrencyTestDB(t)
	setGroupConcurrencyLimit(t, `{"default": 1}`, 0)

	// A task that has not finished already occupies the only slot for this user.
	require.NoError(t, model.DB.Create(&model.Task{
		UserId:   1,
		Group:    "default",
		Status:   model.TaskStatusInProgress,
		TaskID:   "task-in-flight",
		Platform: constant.TaskPlatform("test"),
	}).Error)

	engine := newGroupConcurrencyEngine("default", 1, func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/hold", nil))
	assert.Equal(t, http.StatusTooManyRequests, recorder.Code)

	// Once the task reaches a terminal status the slot opens up again, and a task
	// belonging to another group never counted in the first place.
	require.NoError(t, model.DB.Model(&model.Task{}).
		Where("task_id = ?", "task-in-flight").
		Update("status", model.TaskStatusSuccess).Error)
	recorder = httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/hold", nil))
	assert.Equal(t, http.StatusOK, recorder.Code)
}

func TestGroupConcurrencyLimitLeavesUnlistedGroupsAlone(t *testing.T) {
	setupGroupConcurrencyTestDB(t)
	setGroupConcurrencyLimit(t, `{"default": 1}`, 0)

	engine := newGroupConcurrencyEngine("vip", 1, func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	for range 3 {
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/hold", nil))
		assert.Equal(t, http.StatusOK, recorder.Code)
	}
}
