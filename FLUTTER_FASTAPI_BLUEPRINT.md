# Subscription Manager Integration Blueprint
## Flutter + FastAPI Stack Analysis

---

## 1. Database Schema (PostgreSQL Recommended)

### New Tables Required

#### `subscriptions` — Core tracking table
```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Discovery source
    source VARCHAR(20) CHECK (source IN ('auto_discovered', 'manual', 'imported')),
    
    -- Service details
    service_name VARCHAR(255) NOT NULL,
    service_logo_url TEXT,
    service_category VARCHAR(50), -- streaming, saas, utility, etc.
    
    -- Plan details
    plan_name VARCHAR(255),
    plan_id VARCHAR(100), -- external plan identifier
    
    -- Billing
    amount DECIMAL(15, 6) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    billing_interval VARCHAR(20) CHECK (billing_interval IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
    interval_count INTEGER DEFAULT 1, -- every N months
    
    -- Lifecycle
    status VARCHAR(20) CHECK (status IN ('active', 'paused', 'canceled', 'trial', 'expired', 'pending')) DEFAULT 'active',
    
    -- Dates
    started_at TIMESTAMP WITH TIME ZONE,
    next_renewal_at TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    
    -- Payment method
    payment_method_type VARCHAR(50), -- credit_card, crypto_wallet, etc.
    payment_method_last4 VARCHAR(4),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_next_renewal ON subscriptions(next_renewal_at);
CREATE INDEX idx_subscriptions_gin_metadata ON subscriptions USING GIN (metadata);
```

#### `subscription_payments` — Immutable transaction history
```sql
CREATE TABLE subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    
    -- Transaction details
    amount DECIMAL(15, 6) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    transaction_hash VARCHAR(255), -- for blockchain integrations
    external_transaction_id VARCHAR(255), -- Stripe/PayPal/etc ID
    
    -- Status
    status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'disputed')) DEFAULT 'pending',
    
    -- Integrity
    merkle_root VARCHAR(64), -- for tamper-proof ledgering
    previous_payment_hash VARCHAR(64), -- chain hash for immutability
    
    -- Metadata
    raw_payload JSONB, -- original payment provider response
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_subscription ON subscription_payments(subscription_id);
CREATE INDEX idx_payments_created ON subscription_payments(created_at);
```

#### `subscription_reminders` — Smart reminder system
```sql
CREATE TABLE subscription_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    
    reminder_type VARCHAR(50) CHECK (reminder_type IN ('renewal_7d', 'renewal_1d', 'trial_ending', 'price_change', 'payment_failed')),
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Delivery tracking
    channel VARCHAR(20) CHECK (channel IN ('push', 'email', 'sms', 'in_app')),
    status VARCHAR(20) CHECK (status IN ('scheduled', 'sent', 'dismissed', 'snoozed')) DEFAULT 'scheduled',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reminders_scheduled ON subscription_reminders(scheduled_at, status);
```

#### `price_history` — Price creep detection
```sql
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    old_amount DECIMAL(15, 6) NOT NULL,
    new_amount DECIMAL(15, 6) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    detected_by VARCHAR(20) CHECK (detected_by IN ('auto_scan', 'user_report', 'import')) DEFAULT 'auto_scan'
);
```

#### `fraud_flags` — Active defense
```sql
CREATE TABLE fraud_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES subscription_payments(id) ON DELETE SET NULL,
    
    flag_type VARCHAR(50) CHECK (flag_type IN ('duplicate_charge', 'suspicious_amount', 'rapid_cancellation', 'geo_anomaly', 'velocity_exceeded')),
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- ML/anomaly scores
    confidence_score DECIMAL(5, 4), -- 0.0000 to 1.0000
    model_version VARCHAR(20),
    
    -- Resolution
    status VARCHAR(20) CHECK (status IN ('open', 'investigating', 'false_positive', 'confirmed_fraud', 'resolved')) DEFAULT 'open',
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 2. FastAPI Route Structure

### Core Endpoints

```python
# subscriptions.py router

# ── DISCOVERY ──
POST   /api/v1/subscriptions/discover          # Auto-scan emails/bank statements
POST   /api/v1/subscriptions/import            # Bulk import from CSV/bank export

# ── CRUD ──
GET    /api/v1/subscriptions                    # List with filters (status, upcoming, etc.)
POST   /api/v1/subscriptions                    # Create manual subscription
GET    /api/v1/subscriptions/{id}             # Get single subscription details
PATCH  /api/v1/subscriptions/{id}              # Update (amount, plan, status)
DELETE /api/v1/subscriptions/{id}              # Soft delete / cancel

# ── LIFECYCLE ──
POST   /api/v1/subscriptions/{id}/pause        # Pause subscription
POST   /api/v1/subscriptions/{id}/resume       # Resume subscription
POST   /api/v1/subscriptions/{id}/cancel       # One-click cancel (with provider mapping)
POST   /api/v1/subscriptions/{id}/renew         # Manual renewal trigger

# ── PAYMENTS ──
GET    /api/v1/subscriptions/{id}/payments     # Immutable payment history
POST   /api/v1/subscriptions/{id}/payments     # Record a payment (webhook from provider)
GET    /api/v1/payments/verify/{hash}          # Verify transaction integrity (Merkle proof)

# ── REMINDERS ──
GET    /api/v1/reminders                       # Upcoming reminders for user
POST   /api/v1/reminders/{id}/dismiss          # Dismiss reminder
POST   /api/v1/reminders/{id}/snooze           # Snooze (custom duration)
GET    /api/v1/reminders/settings              # Get reminder preferences
PUT    /api/v1/reminders/settings              # Update preferences (channels, timing)

# ── ANALYTICS ──
GET    /api/v1/analytics/dashboard             # Monthly/annual run-rate
GET    /api/v1/analytics/price-creep           # Price change detection report
GET    /api/v1/analytics/spending-trends       # Time-series spending data
GET    /api/v1/analytics/category-breakdown    # Spending by category

# ── FRAUD/SECURITY ──
GET    /api/v1/security/flags                  # List fraud flags
POST   /api/v1/security/flags/{id}/resolve    # Resolve flag (false positive etc.)
GET    /api/v1/security/ledger-verify           # Verify full ledger integrity
```

### Key JSON Payloads

**Create subscription:**
```json
{
  "service_name": "Netflix",
  "plan_name": "Premium",
  "amount": 19.99,
  "currency": "USD",
  "billing_interval": "monthly",
  "payment_method_type": "credit_card",
  "started_at": "2026-01-15T00:00:00Z",
  "metadata": {
    "provider": "stripe",
    "customer_id": "cus_xxx"
  }
}
```

**Record payment:**
```json
{
  "amount": 19.99,
  "currency": "USD",
  "external_transaction_id": "pi_xxx",
  "status": "completed",
  "raw_payload": { /* full Stripe webhook payload */ }
}
```

---

## 3. Flutter State Management Strategy

### Recommended Architecture

```
lib/
├── data/
│   ├── models/           # Data classes (Subscription, Payment, etc.)
│   ├── repositories/     # API calls to FastAPI
│   └── local/            # Hive/SQLite for offline cache
├── domain/
│   ├── entities/         # Business logic entities
│   ├── usecases/         # Interactors (GetSubscriptions, RecordPayment, etc.)
│   └── services/
│       ├── reminder_service.dart      # Background reminder processing
│       └── sync_service.dart          # Offline sync queue
├── presentation/
│   ├── blocs/            # BLoC pattern for UI state
│   │   ├── subscription_bloc.dart
│   │   ├── payment_bloc.dart
│   │   └── reminder_bloc.dart
│   └── screens/
└── core/
    └── notifications/    # Local + push notification manager
```

### State Management: BLoC + RxDart

```dart
// subscription_bloc.dart
class SubscriptionBloc extends Bloc<SubscriptionEvent, SubscriptionState> {
  final SubscriptionRepository _repo;
  final ReminderService _reminders;
  
  SubscriptionBloc(this._repo, this._reminders) : super(SubscriptionInitial()) {
    on<LoadSubscriptions>(_onLoad);
    on<CreateSubscription>(_onCreate);
    on<CancelSubscription>(_onCancel);
    on<PaymentReceived>(_onPayment); // From webhook/polling
  }
  
  Future<void> _onPayment(PaymentReceived event, Emitter emit) async {
    // Optimistic update for immediate UI feedback
    final current = state as SubscriptionLoaded;
    final updated = current.subscriptions.map((s) => 
      s.id == event.subscriptionId 
        ? s.copyWith(lastPayment: event.payment)
        : s
    ).toList();
    
    emit(SubscriptionLoaded(updated, isSyncing: true));
    
    // Persist to local cache immediately
    await _localCache.savePayment(event.payment);
    
    // Background sync to server
    _syncQueue.add(event);
  }
}
```

### Reminder Processing

```dart
// Background task using workmanager package
@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    final reminders = await ReminderService.checkDueReminders();
    for (final r in reminders) {
      await LocalNotifications.show(
        id: r.id.hashCode,
        title: "${r.subscriptionName} renews ${r.timeUntil}",
        body: "Tap to review or cancel before you're charged",
        payload: r.subscriptionId,
      );
    }
    return true;
  });
}
```

---

## 4. Top 2 Technical Challenges

### Challenge 1: Auto-Discovery Without Plaid/MX Access
**Problem:** Bank statement parsing requires expensive APIs or unreliable screen scraping.

**Bypass Strategy:**
1. **Email-based discovery** (cheaper): Use Gmail/Outlook APIs to scan for subscription keywords ("receipt", "invoice", "renewal")
2. **Manual template library**: Pre-built templates for 500+ common services (Netflix, Spotify, AWS, etc.) that users can one-click add
3. **Smart import wizard**: Support CSV/OFX from banks + regex pattern matching for common statement formats
4. **Deferred auto-discovery**: Partner with Open Banking providers later; launch with manual + email first

### Challenge 2: Immutable Ledger on PostgreSQL
**Problem:** PostgreSQL rows can be updated/deleted — how do you guarantee immutability for fraud detection?

**Bypass Strategy:**
1. **Append-only table design**: `subscription_payments` has NO UPDATE/DELETE — only INSERT
2. **Chain hash**: Each payment stores `SHA256(previous_hash + current_data)` creating a verifiable chain
3. **Cryptographic signing**: Sign each payment with a server HSM key before insertion
4. **Audit trigger**: PostgreSQL trigger prevents any UPDATE/DELETE on payments table (raises exception)
5. **WORM pattern**: Write Once Read Many — application layer enforces this, database layer backs it up with triggers and row-level security

---

## 5. FastAPI Model Example

```python
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, JSON, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    service_name = Column(String(255), nullable=False)
    amount = Column(Numeric(15, 6), nullable=False)
    currency = Column(String(3), default="USD")
    status = Column(String(20), default="active")
    
    next_renewal_at = Column(DateTime(timezone=True))
    
    payments = relationship("SubscriptionPayment", back_populates="subscription", 
                           order_by="desc(SubscriptionPayment.created_at)")
    
    __table_args__ = (
        Index('idx_sub_user_status', 'user_id', 'status'),
    )

class SubscriptionPayment(Base):
    __tablename__ = "subscription_payments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=False)
    
    amount = Column(Numeric(15, 6), nullable=False)
    status = Column(String(20), default="completed")
    
    # Immutability chain
    previous_hash = Column(String(64))
    current_hash = Column(String(64))
    
    subscription = relationship("Subscription", back_populates="payments")
```

---

## Summary

| Feature | Implementation Effort | Priority |
|---------|------------------------|----------|
| Core Tracking (manual) | Low | P0 |
| Lifecycle Management | Medium | P0 |
| Analytics Dashboard | Medium | P1 |
| Immutable Ledger | Medium | P1 |
| Auto-Discovery | High | P2 |
| Fraud Detection (ML) | High | P2 |
| Multi-currency | Low | P1 |
| Smart Reminders | Medium | P0 |

**Recommended MVP scope:** Manual subscription tracking + lifecycle + reminders + basic analytics. Add auto-discovery and ML fraud detection in v2.
