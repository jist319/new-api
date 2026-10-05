package common

import (
	"context"
	"strconv"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
)

// Group concurrency slots
//
// A user may hold at most N requests in flight while using a group; N comes from
// the group's GroupConcurrencyLimit. A slot is held for the whole request,
// including the lifetime of a streaming response, and is released on every exit
// path so a failed or aborted request never keeps a slot.
//
// With Redis the slots live in a sorted set per (group, user): members are
// request tokens scored by acquisition time. Expired members are dropped on the
// next acquisition, so a process that dies mid-request leaves a slot behind for
// at most groupConcurrencySlotTTL instead of forever. Without Redis this falls
// back to an in-process counter.
//
// Task occupancy is not tracked here: the middleware subtracts the caller's
// unfinished tasks from the group limit before calling in, so the atomic check
// below still covers the whole budget.

const (
	// groupConcurrencySlotTTL bounds how long a slot abandoned by a crashed
	// process stays occupied. It must exceed the longest plausible streaming
	// response; shorter values would free a live request's slot early.
	groupConcurrencySlotTTL = time.Hour
)

// groupConcurrencyAcquireScript admits at most `limit` concurrent holders of a
// key. It is one atomic step so two requests can never both take the last slot.
// KEYS[1]=key ARGV[1]=nowMs ARGV[2]=staleBeforeMs ARGV[3]=limit ARGV[4]=member ARGV[5]=ttlSeconds
var groupConcurrencyAcquireScript = redis.NewScript(`
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[2])
local held = redis.call('ZCARD', KEYS[1])
if held >= tonumber(ARGV[3]) then
  return 0
end
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
redis.call('EXPIRE', KEYS[1], ARGV[5])
return 1
`)

type groupConcurrencyGuard struct {
	mutex  sync.Mutex
	counts map[string]int
}

var inMemoryGroupConcurrency = &groupConcurrencyGuard{
	counts: make(map[string]int),
}

// tryAcquireRedisSlot atomically takes a slot in Redis.
func tryAcquireRedisSlot(ctx context.Context, rdb *redis.Client, key string, limit int) (string, bool, error) {
	member := strconv.FormatInt(time.Now().UnixNano(), 10) + "-" + GetRandomString(8)
	nowMs := time.Now().UnixMilli()
	staleBeforeMs := nowMs - groupConcurrencySlotTTL.Milliseconds()
	result, err := groupConcurrencyAcquireScript.Run(ctx, rdb, []string{key},
		nowMs, staleBeforeMs, limit, member, int(groupConcurrencySlotTTL.Seconds()),
	).Int()
	if err != nil {
		return "", false, err
	}
	if result == 0 {
		return "", false, nil
	}
	return member, true, nil
}

func (g *groupConcurrencyGuard) tryAcquireMemorySlot(key string, limit int) (func(), bool) {
	g.mutex.Lock()
	defer g.mutex.Unlock()
	if g.counts[key] >= limit {
		return nil, false
	}
	g.counts[key]++
	return func() {
		g.mutex.Lock()
		defer g.mutex.Unlock()
		g.counts[key]--
		if g.counts[key] <= 0 {
			delete(g.counts, key)
		}
	}, true
}

// releasedOnce wraps a release so it runs at most once, however many exit paths
// reach it.
func releasedOnce(release func()) func() {
	var once sync.Once
	return func() {
		once.Do(release)
	}
}

// TryAcquireGroupConcurrencySlot takes one slot for key if fewer than limit are
// already held. The returned release function is idempotent and must be called
// when the request finishes. ok is false when the limit is currently reached.
func TryAcquireGroupConcurrencySlot(ctx context.Context, key string, limit int) (func(), bool) {
	if limit <= 0 {
		// A non-positive limit means the group is unlimited.
		return func() {}, true
	}
	if RedisEnabled && RDB != nil {
		member, ok, err := tryAcquireRedisSlot(ctx, RDB, key, limit)
		if err != nil {
			// Never block traffic because the slot store is unreachable; failing
			// open keeps the gateway usable and records the anomaly.
			SysError("failed to acquire group concurrency slot, allowing request: " + err.Error())
			return func() {}, true
		}
		if !ok {
			return nil, false
		}
		return releasedOnce(func() {
			// The request is already serving its client; use a detached context so
			// a client disconnect still frees the slot.
			if err := RDB.ZRem(context.Background(), key, member).Err(); err != nil {
				SysError("failed to release group concurrency slot: " + err.Error())
			}
		}), true
	}
	return inMemoryGroupConcurrency.tryAcquireMemorySlot(key, limit)
}
