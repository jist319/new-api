package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// seedSubscriptionForUser creates one user with an active subscription whose plan
// grants totalAmount quota units (0 = no quota, -1 = unlimited) and which applies
// to group ("" = every group). It leaves the rest of the fixture alone so a test
// can seed several users.
func seedSubscriptionForUser(t *testing.T, username string, totalAmount int64, group string) (userId int, subId int) {
	t.Helper()

	user := &User{
		Username: username,
		Password: "password",
		Status:   common.UserStatusEnabled,
		Group:    "default",
		AffCode:  "aff-" + username,
	}
	require.NoError(t, DB.Create(user).Error)

	plan := &SubscriptionPlan{
		Title:         "plan-" + username,
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
		Group:       group,
	}
	require.NoError(t, DB.Create(sub).Error)
	return user.Id, sub.Id
}

// seedSubscriptionFixture starts from an empty set of tables and creates a single
// user with one subscription.
func seedSubscriptionFixture(t *testing.T, totalAmount int64, group string) (userId int, subId int) {
	t.Helper()
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionPreConsumeRecord{}))
	return seedSubscriptionForUser(t, "no-quota-user", totalAmount, group)
}

// A zero total means the plan grants nothing: the request must fall through
// rather than consume quota, so the wallet fallback can take over.
func TestPreConsumeSkipsSubscriptionWithNoQuota(t *testing.T) {
	userId, subId := seedSubscriptionFixture(t, 0, "")

	_, err := PreConsumeUserSubscription("req-no-quota", userId, "default", "test-model", 0, 100)
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
	userId, subId := seedSubscriptionFixture(t, -1, "")

	_, err := PreConsumeUserSubscription("req-unlimited", userId, "default", "test-model", 0, 100)
	require.NoError(t, err)

	sub := getSubscriptionResetSub(t, subId)
	assert.Equal(t, int64(100), sub.AmountUsed)
}

// A subscription is bound to the group its plan upgrades to, so it pays only for
// requests that actually use that group.
func TestPreConsumeOnlyUsesSubscriptionBoundToTheRequestGroup(t *testing.T) {
	userId, subId := seedSubscriptionFixture(t, -1, "concurrency-1")

	_, err := PreConsumeUserSubscription("req-other-group", userId, "default", "test-model", 0, 100)
	require.Error(t, err, "a subscription bound to another group must not pay")
	assert.Zero(t, getSubscriptionResetSub(t, subId).AmountUsed)

	_, err = PreConsumeUserSubscription("req-own-group", userId, "concurrency-1", "test-model", 0, 100)
	require.NoError(t, err)
	assert.Equal(t, int64(100), getSubscriptionResetSub(t, subId).AmountUsed)
}

// Subscriptions created before the group field existed carry an empty group and
// keep applying everywhere, so existing deployments see no behaviour change.
func TestPreConsumeUnboundSubscriptionAppliesToEveryGroup(t *testing.T) {
	userId, subId := seedSubscriptionFixture(t, -1, "")

	for _, group := range []string{"default", "vip", "concurrency-1"} {
		_, err := PreConsumeUserSubscription("req-"+group, userId, group, "test-model", 0, 10)
		require.NoError(t, err, "an unbound subscription must pay in group %s", group)
	}
	assert.Equal(t, int64(30), getSubscriptionResetSub(t, subId).AmountUsed)
}

// The group condition must stay inside the caller's own filters. Without that it
// would be joined with OR at the top level and match every other user's unbound
// subscription.
func TestPreConsumeNeverPicksAnotherUsersUnboundSubscription(t *testing.T) {
	_, otherSubId := seedSubscriptionFixture(t, -1, "")
	otherUserId, _ := seedSubscriptionForUser(t, "second-user", -1, "concurrency-1")

	_, err := PreConsumeUserSubscription("req-cross-user", otherUserId, "default", "test-model", 0, 100)
	require.Error(t, err, "another user's unbound subscription must not pay")
	assert.Zero(t, getSubscriptionResetSub(t, otherSubId).AmountUsed)
}

// The cheap existence check and the wallet-fallback gate must agree with the
// pre-consume query about which subscriptions apply.
func TestActiveSubscriptionHelpersRespectTheRequestGroup(t *testing.T) {
	userId, _ := seedSubscriptionFixture(t, -1, "concurrency-1")

	hasSub, err := HasActiveUserSubscription(userId, "concurrency-1")
	require.NoError(t, err)
	assert.True(t, hasSub)

	hasSub, err = HasActiveUserSubscription(userId, "default")
	require.NoError(t, err)
	assert.False(t, hasSub, "another group's subscription must not count as active here")

	// An unbound subscription counts in every group.
	require.NoError(t, DB.Model(&UserSubscription{}).
		Where("user_id = ?", userId).Update("group", "").Error)
	for _, group := range []string{"default", "vip", "concurrency-1"} {
		hasSub, err = HasActiveUserSubscription(userId, group)
		require.NoError(t, err)
		assert.True(t, hasSub, "an unbound subscription counts in group %s", group)
	}
}

func TestWalletOverflowGateOnlyConsidersSubscriptionsForTheRequestGroup(t *testing.T) {
	userId, _ := seedSubscriptionFixture(t, -1, "concurrency-1")
	require.NoError(t, DB.Model(&UserSubscription{}).
		Where("user_id = ?", userId).Update("allow_wallet_overflow", false).Error)

	allowed, err := UserActiveSubscriptionsAllowWalletOverflow(userId, "concurrency-1")
	require.NoError(t, err)
	assert.False(t, allowed, "the subscription blocks overflow in its own group")

	// A strict subscription in one group must not block another group the user
	// reaches with a different token.
	allowed, err = UserActiveSubscriptionsAllowWalletOverflow(userId, "default")
	require.NoError(t, err)
	assert.True(t, allowed, "a subscription bound elsewhere must not block this group")
}

// Buying a plan snapshots its upgrade group onto the subscription.
func TestSubscriptionSnapshotsPlanUpgradeGroup(t *testing.T) {
	truncateTables(t)

	user := &User{Username: "snapshot-user", Password: "password", Status: common.UserStatusEnabled, Group: "default"}
	require.NoError(t, DB.Create(user).Error)

	plan := &SubscriptionPlan{
		Title:         "concurrency-plan",
		Enabled:       true,
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   -1,
		UpgradeGroup:  "concurrency-1",
	}
	require.NoError(t, DB.Create(plan).Error)
	InvalidateSubscriptionPlanCache(plan.Id)

	var sub *UserSubscription
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		created, err := CreateUserSubscriptionFromPlanTx(tx, user.Id, plan, "admin")
		sub = created
		return err
	}))
	require.NotNil(t, sub)
	assert.Equal(t, "concurrency-1", sub.Group)
}

// A plan that does not switch groups yields an unbound subscription.
func TestSubscriptionFromPlanWithoutUpgradeGroupIsUnbound(t *testing.T) {
	truncateTables(t)

	user := &User{Username: "unbound-user", Password: "password", Status: common.UserStatusEnabled, Group: "default"}
	require.NoError(t, DB.Create(user).Error)

	plan := &SubscriptionPlan{
		Title:         "plain-plan",
		Enabled:       true,
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   -1,
	}
	require.NoError(t, DB.Create(plan).Error)
	InvalidateSubscriptionPlanCache(plan.Id)

	var sub *UserSubscription
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		created, err := CreateUserSubscriptionFromPlanTx(tx, user.Id, plan, "admin")
		sub = created
		return err
	}))
	require.NotNil(t, sub)
	assert.Empty(t, sub.Group)
}
