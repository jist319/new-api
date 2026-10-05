package middleware

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

const (
	// groupConcurrencyPollInterval is how often a queued request re-checks
	// whether a slot has freed up.
	groupConcurrencyPollInterval = 200 * time.Millisecond

	// groupConcurrencyTaskRefreshInterval throttles the unfinished-task query
	// while a request waits: the in-flight counter is cheap to re-read, the task
	// count is a database query.
	groupConcurrencyTaskRefreshInterval = time.Second
)

func groupConcurrencyKey(group string, userId int) string {
	return "groupConcurrency:" + group + ":" + strconv.Itoa(userId)
}

// taskOccupancy reads how many of the user's tasks are still running in this
// group. It is throttled across a single wait so queueing does not hammer the
// database, and fails open on error so a database hiccup never blocks traffic.
func taskOccupancy(userId int, group string, lastReadAt *time.Time, cached *int) int {
	lastRead := *lastReadAt
	if !lastRead.IsZero() && time.Since(lastRead) < groupConcurrencyTaskRefreshInterval {
		return *cached
	}
	count, err := model.CountUnfinishedTasksByUserGroup(userId, group)
	if err != nil {
		common.SysError("failed to count unfinished tasks for group concurrency, treating as none: " + err.Error())
		count = 0
	}
	*cached = count
	*lastReadAt = time.Now()
	return count
}

// acquireGroupConcurrencySlot reserves a slot for the request, waiting up to
// waitTimeout for one to free up. Unfinished tasks count against the same
// budget, so the slot the guard hands out is only the part of the group limit
// that running tasks have not already taken.
func acquireGroupConcurrencySlot(ctx context.Context, key string, limit int, userId int, group string, waitTimeout time.Duration) (func(), bool) {
	deadline := time.Now().Add(waitTimeout)
	var taskLoadReadAt time.Time
	pendingTasks := 0

	for {
		requestLimit := limit - taskOccupancy(userId, group, &taskLoadReadAt, &pendingTasks)
		if requestLimit > 0 {
			release, ok := common.TryAcquireGroupConcurrencySlot(ctx, key, requestLimit)
			if ok {
				return release, true
			}
		}
		if waitTimeout <= 0 || !time.Now().Before(deadline) {
			return nil, false
		}
		select {
		case <-ctx.Done():
			return nil, false
		case <-time.After(groupConcurrencyPollInterval):
		}
	}
}

// GroupConcurrencyLimit caps how many requests a user may have in flight at once
// while using a group, and queues a request that arrives over the limit until a
// slot frees up or the configured wait elapses.
func GroupConcurrencyLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		group := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
		limit := setting.GetGroupConcurrencyLimit(group)
		if limit <= 0 {
			c.Next()
			return
		}
		userId := c.GetInt("id")
		if userId <= 0 {
			c.Next()
			return
		}

		waitTimeout := time.Duration(setting.GroupConcurrencyQueueTimeoutSeconds) * time.Second
		release, ok := acquireGroupConcurrencySlot(
			c.Request.Context(),
			groupConcurrencyKey(group, userId),
			limit,
			userId,
			group,
			waitTimeout,
		)
		if !ok {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests,
				i18n.T(c, i18n.MsgGroupConcurrencyLimitExceeded, map[string]any{
					"Group": group,
					"Limit": limit,
				}))
			return
		}
		// Held for the whole request, including a streaming response, and released
		// on every exit path.
		defer release()
		c.Next()
	}
}
