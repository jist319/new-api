package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// seedSubscriptionWithTotal creates a user with one active subscription whose
// plan grants totalAmount quota units (0 = no quota, -1 = unlimited).
func seedSubscriptionWithTotal(t *testing.T, totalAmount int64) (userId int, subId int) {
	t.Helper()
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionPreConsumeRecord{}))

	user := &User{Username: "no-quota-user", Password: "password", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(user).Error)

	plan := &SubscriptionPlan{
		Title:         "no-quota-plan",
		Enabled:       true,
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   totalAmount,
	}
	require.NoError(t, DB.Create(plan).Error)
	InvalidateSubscriptionPlanCache(plan.Id)

	now := common.GetTimestamp()
	sub := &UserSubscription{
		UserId:      user.Id,
		PlanId:      plan.Id,
		AmountTotal: totalAmount,
		StartTime:   now,
		EndTime:     now + 30*24*3600,
		Status:      "active",
		Source:      "order",
	}
	require.NoError(t, DB.Create(sub).Error)
	return user.Id, sub.Id
}

// A zero total means the plan grants nothing: the request must fall through
// rather than consume quota, so the wallet fallback can take over.
func TestPreConsumeSkipsSubscriptionWithNoQuota(t *testing.T) {
	userId, subId := seedSubscriptionWithTotal(t, 0)

	_, err := PreConsumeUserSubscription("req-no-quota", userId, "test-model", 0, 100)
	require.Error(t, err)

	sub := getSubscriptionResetSub(t, subId)
	assert.Zero(t, sub.AmountUsed, "a no-quota subscription must not be charged")

	var records int64
	require.NoError(t, DB.Model(&SubscriptionPreConsumeRecord{}).
		Where("user_id = ?", userId).Count(&records).Error)
	assert.Zero(t, records, "no pre-consume record may be written for a skipped subscription")
}

// A negative total means unlimited; the no-quota sentinel must not swallow it.
func TestPreConsumeStillUsesUnlimitedPlan(t *testing.T) {
	userId, subId := seedSubscriptionWithTotal(t, -1)

	_, err := PreConsumeUserSubscription("req-unlimited", userId, "test-model", 0, 100)
	require.NoError(t, err)

	sub := getSubscriptionResetSub(t, subId)
	assert.Equal(t, int64(100), sub.AmountUsed)
}
