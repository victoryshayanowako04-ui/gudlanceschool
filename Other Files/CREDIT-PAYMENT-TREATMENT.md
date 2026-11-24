# How Credit-Backed Payments Are Treated

## The Scenario
A student has an **overpayment/credit balance** (money already received that exceeds their bills). A new charge is created and "paid" using that existing credit.

---

## The Transaction Flow

### Step 1: Detect Overpayment
When a new charge is created (e.g., event/trip billing):
```javascript
let creditAvailable = currentBalance < 0 ? Math.abs(currentBalance) : 0;
// If student owes -$100 (overpaid), creditAvailable = $100
```

### Step 2: Offer to Apply Credit
The system asks the staff: *"Do you want to apply this credit?"*
- If YES: `creditApplied = Min(creditAvailable, totalBill)`
- If NO: Student is just billed, balance worsens

### Step 3: Create Special Ledger Entries
**Three ledger entries are created:**

| Entry | Type | Amount | Purpose | Flag |
|-------|------|--------|---------|------|
| 1 | charge | $50 | New bill | - |
| 2 | charge | $50 | Reversal | - |
| 3 | payment | $50 | Credit application | `is_credit_backed: true` |

The reversal (#2) cancels part of the charge (#1), so net bill change = $0

### Step 4: Mark as Credit-Backed
```javascript
is_credit_backed: true  // 🎯 CRITICAL RECONCILIATION EXCLUSION FLAG
```

---

## How It Affects Cash Metrics

### ✅ NET CASH IS NOT AFFECTED
**In Vault Statistics:**
```javascript
if (isCreditBacked) return;  // Skip this payment entirely
// Line 17181 in app.js
```

**In Reconciliation Drawer:**
```javascript
if (pay.is_credit_backed === true || method.includes('advance credit')) return;
// Line 17596 in app.js
```

### ✅ WHY?
The payment doesn't represent NEW cash coming in. It's **moving existing credit** from one pot to another:
- Before: Student has $100 credit + $50 charge = $50 net credit
- After: Student has $0 credit + $0 charge = $0 net credit
- **No cash entered/left the system**

### Cash Box Impact

| Box | Affected? | Why |
|-----|-----------|-----|
| **Tuition Cash** | ❌ NO | No real tuition payment made |
| **Shop Cash** | ❌ NO | No real shop payment made |
| **Event Cash** | ❌ NO | No real event payment made |
| **Total Cash In** | ❌ NO | No cash actually received |
| **Cash Expenses** | ❌ NO | No cash leaving |
| **Net Cash** | ❌ NO | Credit-backed excluded |
| **Reconciliation Drawer** | ❌ NO | Credit-backed excluded |

### Student Balance Impact

| Item | Change |
|------|--------|
| **Student's Outstanding Debt** | ✅ YES (decreases) |
| **Student's Balance Owing** | ✅ YES (reduced by credit applied) |
| **System Cash Balance** | ❌ NO |
| **Vault Totals** | ❌ NO (for cash metrics) |

---

## Contrast: Regular Payment vs Credit-Backed

### Scenario 1: Regular Payment (Student pays $50 cash)
```javascript
student.ledger.push({
    type: 'payment',
    amount: 50,
    method: 'Cash'
    // NO is_credit_backed flag
});
```
**Result:**
- ✅ $50 added to tuition.cash (or appropriate category)
- ✅ $50 added to totalCashIn
- ✅ $50 increases net cash
- ✅ Counts in reconciliation drawer

### Scenario 2: Credit-Backed Payment ($50 existing credit applied to new bill)
```javascript
student.ledger.push({
    type: 'payment',
    amount: 50,
    method: 'Advance Credit',
    is_credit_backed: true  // ← THE DIFFERENCE
});
```
**Result:**
- ❌ NOT added to tuition.cash
- ❌ NOT added to totalCashIn
- ❌ Does NOT affect net cash
- ❌ Excluded from reconciliation drawer

---

## Why This Matters

### For Financial Reporting
Without the `is_credit_backed` flag:
- **Wrong:** Net cash shows $500 when only $400 new cash was actually received
- **Right:** Net cash shows $400 (credit movements excluded)

### For Cash Reconciliation
When doing physical cash count:
- **Expected in drawer:** Net Cash (excludes credit-backed)
- **Physical count:** What's actually there
- **Variance:** Difference should be accounted for

---

## Code References

**Event Billing with Credit Application:**
- Lines 3373-3475 in app.js
- Creates the `is_credit_backed: true` entries

**Vault Exclusion:**
- Line 17143-17181 in app.js
- Checks `isCreditBacked` before counting revenue

**Reconciliation Exclusion:**
- Line 17596 in app.js
- Explicitly returns (skips) if `is_credit_backed === true`

**Payment Processing:**
- Lines 3700-4150 in app.js
- Creates payment vs overpayment entries (NOT marked credit-backed by default)

---

## Summary Table

| Scenario | Cash Impact | Balance Impact | In Vault Stats | In Reconciliation |
|----------|------------|-----------------|-----------------|-------------------|
| Payment from NEW cash | ✅ YES | ✅ YES | ✅ YES | ✅ YES |
| Payment from student overpayment credit | ❌ NO | ✅ YES | ❌ NO | ❌ NO |
| Overpayment on a payment | ✅ YES | ✅ YES | ✅ YES | ✅ YES |
| Discount/Waiver | ❌ NO | ✅ YES | ❌ NO | ❌ NO |
