
-- ============================================================================
-- FILE: migrations/004_views.sql
-- ============================================================================

-- View for user statistics
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
    u.id,
    u.email,
    u.role,
    u.created_at,
    u.last_login,
    COUNT(DISTINCT w.id) as wallet_count,
    COUNT(DISTINCT a.id) as address_count,
    COUNT(DISTINCT t.id) as transaction_count,
    COALESCE(SUM(t.amount), 0) as total_volume
FROM users u
LEFT JOIN wallets w ON u.id = w.user_id
LEFT JOIN addresses a ON w.id = a.wallet_id
LEFT JOIN transactions t ON a.address = t.from_address AND t.status = 'confirmed'
GROUP BY u.id, u.email, u.role, u.created_at, u.last_login;

-- View for daily transaction stats
CREATE OR REPLACE VIEW daily_transaction_stats AS
SELECT 
    DATE(created_at) as date,
    chain,
    COUNT(*) as transaction_count,
    SUM(amount) as total_volume,
    AVG(amount) as avg_amount,
    COUNT(DISTINCT from_address) as unique_senders,
    COUNT(DISTINCT to_address) as unique_receivers
FROM transactions
WHERE status = 'confirmed'
GROUP BY DATE(created_at), chain
ORDER BY date DESC, chain;

-- View for suspicious activity summary
CREATE OR REPLACE VIEW suspicious_activity_summary AS
SELECT 
    u.email,
    sa.activity_type,
    COUNT(*) as occurrence_count,
    MAX(sa.created_at) as last_occurrence,
    sa.severity
FROM suspicious_activities sa
JOIN users u ON sa.user_id = u.id
WHERE sa.reviewed = false
GROUP BY u.email, sa.activity_type, sa.severity
ORDER BY occurrence_count DESC;
