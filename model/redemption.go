package model

import (
	"errors"
	"fmt"
	"sort"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

type Redemption struct {
	Id           int            `json:"id"`
	UserId       int            `json:"user_id"`
	Key          string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status       int            `json:"status" gorm:"default:1"`
	Name         string         `json:"name" gorm:"index"`
	Quota        int            `json:"quota" gorm:"default:100"`
	CreatedTime  int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime int64          `json:"redeemed_time" gorm:"bigint"`
	Count        int            `json:"count" gorm:"-:all"` // only for api request
	UsedUserId   int            `json:"used_user_id"`
	DeletedAt    gorm.DeletedAt `gorm:"index"`
	ExpiredTime  int64          `json:"expired_time" gorm:"bigint"` // 过期时间，0 表示不过期

	// 分组：仅用于管理端归类与筛选，不影响兑换行为
	Group string `json:"group" gorm:"type:varchar(64);default:'';index"`

	// 兑换码类型，见 common.RedemptionType*
	Type string `json:"type" gorm:"type:varchar(16);default:'quota'"`

	// 订阅套餐 ID，仅 Type 为 subscription 时有效
	PlanId int `json:"plan_id" gorm:"default:0"`
}

// NormalizeRedemptionType maps an empty or unknown type onto the quota type so
// codes created before this field existed keep working.
func NormalizeRedemptionType(codeType string) string {
	if codeType == common.RedemptionTypeSubscription {
		return common.RedemptionTypeSubscription
	}
	return common.RedemptionTypeQuota
}

func GetAllRedemptions(startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	// 开始事务
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 获取总数
	err = tx.Model(&Redemption{}).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 获取分页数据
	err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 提交事务
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func SearchRedemptions(keyword string, status string, group string, startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&Redemption{})

	if keyword != "" {
		if id, err := strconv.Atoi(keyword); err == nil {
			query = query.Where("id = ? OR name LIKE ?", id, keyword+"%")
		} else {
			query = query.Where("name LIKE ?", keyword+"%")
		}
	}

	if status != "" {
		now := common.GetTimestamp()
		switch status {
		case "expired":
			query = query.Where(
				"status = ? AND expired_time != 0 AND expired_time < ?",
				common.RedemptionCodeStatusEnabled,
				now,
			)
		case strconv.Itoa(common.RedemptionCodeStatusEnabled):
			query = query.Where(
				"status = ? AND (expired_time = 0 OR expired_time >= ?)",
				common.RedemptionCodeStatusEnabled,
				now,
			)
		case strconv.Itoa(common.RedemptionCodeStatusDisabled):
			query = query.Where("status = ?", common.RedemptionCodeStatusDisabled)
		case strconv.Itoa(common.RedemptionCodeStatusUsed):
			query = query.Where("status = ?", common.RedemptionCodeStatusUsed)
		}
	}

	if group != "" {
		query = query.Where(commonGroupCol+" = ?", group)
	}

	// Get total count
	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// Get paginated data
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

// GetRedemptionGroups returns the distinct non-empty groups across all codes,
// used to populate the admin group filter.
func GetRedemptionGroups() ([]string, error) {
	var groups []string
	err := DB.Model(&Redemption{}).
		Where(commonGroupCol+" <> ''").
		Distinct(commonGroupCol).
		Pluck(commonGroupCol, &groups).Error
	if err != nil {
		return nil, err
	}
	sort.Strings(groups)
	return groups, nil
}

func GetRedemptionById(id int) (*Redemption, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	var err error = nil
	err = DB.First(&redemption, "id = ?", id).Error
	return &redemption, err
}

// RedeemResult describes what a successful redemption granted.
type RedeemResult struct {
	Type      string `json:"type"`
	Quota     int    `json:"quota"`
	PlanId    int    `json:"plan_id"`
	PlanTitle string `json:"plan_title"`
}

func Redeem(key string, userId int) (*RedeemResult, error) {
	if key == "" {
		return nil, errors.New("未提供兑换码")
	}
	if userId == 0 {
		return nil, errors.New("无效的 user id")
	}
	redemption := &Redemption{}
	result := &RedeemResult{}

	keyCol := "`key`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		keyCol = `"key"`
	}
	common.RandomSleep()
	groupChanged := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		err := lockForUpdate(tx).Where(keyCol+" = ?", key).First(redemption).Error
		if err != nil {
			return errors.New("无效的兑换码")
		}
		if redemption.Status != common.RedemptionCodeStatusEnabled {
			return errors.New("该兑换码已被使用")
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
			return errors.New("该兑换码已过期")
		}
		// Compare-and-swap on status: only the transaction that flips
		// enabled -> used may grant the reward, so a concurrent redeem of the
		// same code loses here even without a row lock (e.g. on SQLite).
		swap := tx.Model(&Redemption{}).
			Where("id = ? AND status = ?", redemption.Id, common.RedemptionCodeStatusEnabled).
			Updates(map[string]any{
				"redeemed_time": common.GetTimestamp(),
				"status":        common.RedemptionCodeStatusUsed,
				"used_user_id":  userId,
			})
		if swap.Error != nil {
			return swap.Error
		}
		if swap.RowsAffected == 0 {
			return errors.New("该兑换码已被使用")
		}

		if NormalizeRedemptionType(redemption.Type) == common.RedemptionTypeSubscription {
			plan, err := getSubscriptionPlanByIdTx(tx, redemption.PlanId)
			if err != nil {
				return errors.New("订阅套餐不存在")
			}
			if !plan.Enabled {
				return errors.New("订阅套餐已停用")
			}
			if plan.AllowRedemptionCode != nil && !*plan.AllowRedemptionCode {
				return errors.New("该套餐不允许使用兑换码兑换")
			}
			sub, err := CreateUserSubscriptionFromPlanTx(tx, userId, plan, "redemption")
			if err != nil {
				return err
			}
			groupChanged = sub.PrevUserGroup != ""
			result.Type = common.RedemptionTypeSubscription
			result.PlanId = plan.Id
			result.PlanTitle = plan.Title
			return nil
		}

		result.Type = common.RedemptionTypeQuota
		result.Quota = redemption.Quota
		return creditTopUpQuota(tx, userId, redemption.Quota, nil)
	})
	if err != nil {
		common.SysError("redemption failed: " + err.Error())
		return nil, ErrRedeemFailed
	}
	if result.Type == common.RedemptionTypeSubscription {
		if groupChanged {
			refreshSubscriptionUserGroupCache(userId, "redemption subscription creation")
		}
		RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码订阅套餐 %s，兑换码ID %d", result.PlanTitle, redemption.Id))
		return result, nil
	}
	syncCreditUserQuotaCache(userId, redemption.Quota, "redemption")
	RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码充值 %s，兑换码ID %d", logger.LogQuota(redemption.Quota), redemption.Id))
	return result, nil
}

// validateRedemptionQuota enforces the quota rules for the code's type. A
// quota code must carry a positive, in-range wallet quota; a subscription
// code carries no quota of its own and must name a plan instead.
func (redemption *Redemption) validateRedemptionQuota() error {
	if NormalizeRedemptionType(redemption.Type) == common.RedemptionTypeSubscription {
		if redemption.PlanId <= 0 {
			return errors.New("subscription redemption must bind a plan")
		}
		redemption.Quota = 0
		return nil
	}
	if redemption.Quota <= 0 {
		return errors.New("redemption quota must be positive")
	}
	return common.ValidateWalletQuota(redemption.Quota)
}

func (redemption *Redemption) Insert() error {
	if err := redemption.validateRedemptionQuota(); err != nil {
		return err
	}
	redemption.Type = NormalizeRedemptionType(redemption.Type)
	return DB.Create(redemption).Error
}

func (redemption *Redemption) SelectUpdate() error {
	// This can update zero values
	return DB.Model(redemption).Select("redeemed_time", "status").Updates(redemption).Error
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (redemption *Redemption) Update() error {
	if err := redemption.validateRedemptionQuota(); err != nil {
		return err
	}
	var err error
	err = DB.Model(redemption).Select("name", "status", "quota", "redeemed_time", "expired_time", "group", "plan_id").Updates(redemption).Error
	return err
}

func (redemption *Redemption) Delete() error {
	var err error
	err = DB.Delete(redemption).Error
	return err
}

func DeleteRedemptionById(id int) (err error) {
	if id == 0 {
		return errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	err = DB.Where(redemption).First(&redemption).Error
	if err != nil {
		return err
	}
	return redemption.Delete()
}

func DeleteInvalidRedemptions() (int64, error) {
	now := common.GetTimestamp()
	result := DB.Where("status IN ? OR (status = ? AND expired_time != 0 AND expired_time < ?)", []int{common.RedemptionCodeStatusUsed, common.RedemptionCodeStatusDisabled}, common.RedemptionCodeStatusEnabled, now).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}

// BatchDeleteRedemptions soft-deletes the selected codes in one statement.
func BatchDeleteRedemptions(ids []int) (int64, error) {
	if len(ids) == 0 || len(ids) > 1000 {
		return 0, errors.New("select between 1 and 1000 redemption codes")
	}
	for _, id := range ids {
		if id <= 0 {
			return 0, errors.New("redemption IDs must be positive")
		}
	}
	result := DB.Where("id IN ?", ids).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}
