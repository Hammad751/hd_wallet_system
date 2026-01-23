
-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_status_created 
    ON transactions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_from_status 
    ON transactions(from_address, status);

CREATE INDEX IF NOT EXISTS idx_addresses_wallet_chain_index 
    ON addresses(wallet_id, chain, address_index);

-- Partial indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_pending 
    ON transactions(created_at DESC) 
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_suspicious_unreviewed 
    ON suspicious_activities(created_at DESC) 
    WHERE reviewed = false;

CREATE INDEX IF NOT EXISTS idx_transfer_approvals_pending 
    ON transfer_approvals(created_at DESC) 
    WHERE status = 'pending';

-- Full-text search on audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_details_gin 
    ON audit_logs USING gin(details);

-- Analyze tables for better query planning
ANALYZE users;
ANALYZE wallets;
ANALYZE addresses;
ANALYZE transactions;
ANALYZE login_attempts;
ANALYZE suspicious_activities;