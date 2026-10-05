package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCheckGroupConcurrencyLimitRejectsOutOfRangeValues(t *testing.T) {
	require.NoError(t, CheckGroupConcurrencyLimit(`{"default": 3, "vip": 0}`))
	require.NoError(t, CheckGroupConcurrencyLimit(`{}`))

	// A negative limit would make GetGroupConcurrencyLimit report "unlimited",
	// silently removing the cap the operator asked for.
	assert.Error(t, CheckGroupConcurrencyLimit(`{"vip": -1}`))
	assert.Error(t, CheckGroupConcurrencyLimit(`{"vip": 100001}`))
	assert.Error(t, CheckGroupConcurrencyLimit(`not json`))
}

func TestGetGroupConcurrencyLimitTreatsMissingGroupAsUnlimited(t *testing.T) {
	require.NoError(t, UpdateGroupConcurrencyLimitByJSONString(`{"vip": 2}`))
	t.Cleanup(func() {
		require.NoError(t, UpdateGroupConcurrencyLimitByJSONString(`{}`))
	})

	assert.Equal(t, 2, GetGroupConcurrencyLimit("vip"))
	assert.Equal(t, 0, GetGroupConcurrencyLimit("default"))
}
