package setting

import (
	"fmt"
	"math"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// maxRateLimitDurationSeconds is the largest window the count cap is computed
// against (24h). Token-bucket capacity is count*duration; this keeps that
// product inside int64 when the window is at most a day.
const maxRateLimitDurationSeconds = 24 * 60 * 60

// maxModelRequestRateLimitCount is math.MaxInt64 / maxRateLimitDurationSeconds.
// It is the largest count that cannot overflow int64(count)*duration for a
// window of at most 24 hours.
const maxModelRequestRateLimitCount int64 = math.MaxInt64 / maxRateLimitDurationSeconds

var ModelRequestRateLimitEnabled = false
var ModelRequestRateLimitDurationMinutes = 1
var ModelRequestRateLimitCount = 0
var ModelRequestRateLimitSuccessCount = 1000
var ModelRequestRateLimitGroup = map[string][2]int{}
var ModelRequestRateLimitMutex sync.RWMutex

func ModelRequestRateLimitGroup2JSONString() string {
	ModelRequestRateLimitMutex.RLock()
	defer ModelRequestRateLimitMutex.RUnlock()

	jsonBytes, err := common.Marshal(ModelRequestRateLimitGroup)
	if err != nil {
		common.SysLog("error marshalling model ratio: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateModelRequestRateLimitGroupByJSONString(jsonStr string) error {
	ModelRequestRateLimitMutex.RLock()
	defer ModelRequestRateLimitMutex.RUnlock()

	ModelRequestRateLimitGroup = make(map[string][2]int)
	return common.Unmarshal([]byte(jsonStr), &ModelRequestRateLimitGroup)
}

func GetGroupRateLimit(group string) (totalCount, successCount int, found bool) {
	ModelRequestRateLimitMutex.RLock()
	defer ModelRequestRateLimitMutex.RUnlock()

	if ModelRequestRateLimitGroup == nil {
		return 0, 0, false
	}

	limits, found := ModelRequestRateLimitGroup[group]
	if !found {
		return 0, 0, false
	}
	return limits[0], limits[1], true
}

// maxGroupConcurrencyLimit bounds a single group's per-user concurrency so an
// operator cannot admit an unbounded number of simultaneous requests.
const maxGroupConcurrencyLimit = 100000

// GroupConcurrencyLimit caps how many requests one user may have in flight at
// once while using a group. Groups absent from the map are unlimited, which is
// also what an entry of 0 means.
var GroupConcurrencyLimit = map[string]int{}
var GroupConcurrencyLimitMutex sync.RWMutex

// GroupConcurrencyQueueTimeoutSeconds is how long a request waits for a free
// slot before it is rejected with 429. 0 rejects immediately instead of queueing.
var GroupConcurrencyQueueTimeoutSeconds = 30

func GroupConcurrencyLimit2JSONString() string {
	GroupConcurrencyLimitMutex.RLock()
	defer GroupConcurrencyLimitMutex.RUnlock()

	jsonBytes, err := common.Marshal(GroupConcurrencyLimit)
	if err != nil {
		common.SysLog("error marshalling group concurrency limit: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateGroupConcurrencyLimitByJSONString(jsonStr string) error {
	GroupConcurrencyLimitMutex.Lock()
	defer GroupConcurrencyLimitMutex.Unlock()

	limits := make(map[string]int)
	if err := common.Unmarshal([]byte(jsonStr), &limits); err != nil {
		return err
	}
	GroupConcurrencyLimit = limits
	return nil
}

// GetGroupConcurrencyLimit returns the per-user concurrency cap for a group.
// A missing group or a non-positive limit means unlimited.
func GetGroupConcurrencyLimit(group string) int {
	GroupConcurrencyLimitMutex.RLock()
	defer GroupConcurrencyLimitMutex.RUnlock()

	limit := GroupConcurrencyLimit[group]
	if limit < 0 {
		return 0
	}
	return limit
}

func CheckGroupConcurrencyLimit(jsonStr string) error {
	limits := make(map[string]int)
	if err := common.Unmarshal([]byte(jsonStr), &limits); err != nil {
		return err
	}
	for group, limit := range limits {
		if limit < 0 {
			return fmt.Errorf("group %s has a negative concurrency limit: %d", group, limit)
		}
		if limit > maxGroupConcurrencyLimit {
			return fmt.Errorf("group %s concurrency limit %d exceeds max %d", group, limit, maxGroupConcurrencyLimit)
		}
	}
	return nil
}

func CheckModelRequestRateLimitGroup(jsonStr string) error {
	checkModelRequestRateLimitGroup := make(map[string][2]int)
	err := common.Unmarshal([]byte(jsonStr), &checkModelRequestRateLimitGroup)
	if err != nil {
		return err
	}
	for group, limits := range checkModelRequestRateLimitGroup {
		if limits[0] < 0 || limits[1] < 1 {
			return fmt.Errorf("group %s has negative rate limit values: [%d, %d]", group, limits[0], limits[1])
		}
		if int64(limits[0]) > maxModelRequestRateLimitCount || int64(limits[1]) > maxModelRequestRateLimitCount {
			return fmt.Errorf("group %s [%d, %d] exceeds max rate limit %d", group, limits[0], limits[1], maxModelRequestRateLimitCount)
		}
	}

	return nil
}
