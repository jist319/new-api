package model

import (
	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// GetDBTimestamp returns a UNIX timestamp from database time.
// Falls back to application time on error.
func GetDBTimestamp() int64 {
	return dbTimestamp(DB)
}

// dbTimestamp reads database time through the given handle. Callers that already
// hold a transaction must pass it in: on a deployment where the pool is capped
// to a single connection (SQLite), querying the global handle from inside an
// open transaction would wait forever for a connection the transaction owns.
func dbTimestamp(db *gorm.DB) int64 {
	if db == nil {
		return common.GetTimestamp()
	}
	var ts int64
	var err error
	switch {
	case common.UsingMainDatabase(common.DatabaseTypePostgreSQL):
		err = db.Raw("SELECT EXTRACT(EPOCH FROM NOW())::bigint").Scan(&ts).Error
	case common.UsingMainDatabase(common.DatabaseTypeSQLite):
		err = db.Raw("SELECT strftime('%s','now')").Scan(&ts).Error
	default:
		err = db.Raw("SELECT UNIX_TIMESTAMP()").Scan(&ts).Error
	}
	if err != nil || ts <= 0 {
		return common.GetTimestamp()
	}
	return ts
}
