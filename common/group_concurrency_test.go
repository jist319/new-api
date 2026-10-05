package common

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTryAcquireGroupConcurrencySlotEnforcesLimit(t *testing.T) {
	ctx := context.Background()
	key := "test:group-concurrency:enforces-limit"

	releaseA, ok := TryAcquireGroupConcurrencySlot(ctx, key, 2)
	require.True(t, ok)
	releaseB, ok := TryAcquireGroupConcurrencySlot(ctx, key, 2)
	require.True(t, ok)

	// The limit is reached, so a third request must be turned away.
	_, ok = TryAcquireGroupConcurrencySlot(ctx, key, 2)
	assert.False(t, ok)

	// Freeing one slot lets exactly one more request through.
	releaseA()
	releaseC, ok := TryAcquireGroupConcurrencySlot(ctx, key, 2)
	require.True(t, ok)
	_, ok = TryAcquireGroupConcurrencySlot(ctx, key, 2)
	assert.False(t, ok)
	releaseB()
	releaseC()
}

func TestTryAcquireGroupConcurrencySlotReleaseIsIdempotent(t *testing.T) {
	ctx := context.Background()
	key := "test:group-concurrency:idempotent-release"

	release, ok := TryAcquireGroupConcurrencySlot(ctx, key, 1)
	require.True(t, ok)

	// A double release must not hand out a second slot: the counter would drop
	// below zero and every later request would be admitted.
	release()
	release()

	releaseNext, ok := TryAcquireGroupConcurrencySlot(ctx, key, 1)
	require.True(t, ok)
	_, ok = TryAcquireGroupConcurrencySlot(ctx, key, 1)
	assert.False(t, ok)
	releaseNext()
}

func TestTryAcquireGroupConcurrencySlotUnlimitedWhenLimitIsNotPositive(t *testing.T) {
	ctx := context.Background()
	key := "test:group-concurrency:unlimited"

	release, ok := TryAcquireGroupConcurrencySlot(ctx, key, 0)
	require.True(t, ok)
	_, ok = TryAcquireGroupConcurrencySlot(ctx, key, 0)
	assert.True(t, ok)
	release()
}

func TestTryAcquireGroupConcurrencySlotScopesByKey(t *testing.T) {
	ctx := context.Background()

	releaseUserA, ok := TryAcquireGroupConcurrencySlot(ctx, "test:group-concurrency:scoped-a", 1)
	require.True(t, ok)
	defer releaseUserA()

	// A different user in the same group and a user in another group each get
	// their own budget.
	releaseUserB, ok := TryAcquireGroupConcurrencySlot(ctx, "test:group-concurrency:scoped-b", 1)
	assert.True(t, ok)
	releaseOtherGroup, ok := TryAcquireGroupConcurrencySlot(ctx, "test:group-concurrency:scoped-other", 1)
	assert.True(t, ok)
	defer releaseOtherGroup()
	defer releaseUserB()

	// The first key stays saturated.
	_, ok = TryAcquireGroupConcurrencySlot(ctx, "test:group-concurrency:scoped-a", 1)
	assert.False(t, ok)
}

func TestTryAcquireGroupConcurrencySlotNeverOverAdmits(t *testing.T) {
	ctx := context.Background()
	const limit = 4
	key := "test:group-concurrency:contended"

	attempts := limit * 8
	releases := make([]func(), attempts)
	granted := 0
	var mutex sync.Mutex

	var wg sync.WaitGroup
	for range attempts {
		wg.Go(func() {
			release, ok := TryAcquireGroupConcurrencySlot(ctx, key, limit)
			if !ok {
				return
			}
			mutex.Lock()
			defer mutex.Unlock()
			releases[granted] = release
			granted++
		})
	}
	wg.Wait()

	assert.Equal(t, limit, granted, "contended acquisitions must not exceed the limit")

	// Hand the slots back so repeated runs start from an empty key.
	for _, release := range releases {
		if release != nil {
			release()
		}
	}
}
