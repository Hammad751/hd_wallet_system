
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to log audit trail
CREATE OR REPLACE FUNCTION log_sensitive_operation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            user_id,
            action,
            resource_type,
            resource_id,
            details
        ) VALUES (
            NEW.user_id,
            TG_OP,
            TG_TABLE_NAME,
            NEW.id::TEXT,
            row_to_json(NEW)
        );
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (
            user_id,
            action,
            resource_type,
            resource_id,
            details
        ) VALUES (
            NEW.user_id,
            TG_OP,
            TG_TABLE_NAME,
            NEW.id::TEXT,
            jsonb_build_object(
                'old', row_to_json(OLD),
                'new', row_to_json(NEW)
            )
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add audit triggers
CREATE TRIGGER audit_wallets 
    AFTER INSERT OR UPDATE ON wallets 
    FOR EACH ROW 
    EXECUTE FUNCTION log_sensitive_operation();

CREATE TRIGGER audit_transactions 
    AFTER INSERT OR UPDATE ON transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION log_sensitive_operation();

-- Function to clean old sessions
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW();
    DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ language 'plpgsql';

-- Create scheduled job to clean expired data (requires pg_cron extension)
-- If pg_cron is not available, run this manually or via cron job
-- SELECT cron.schedule('clean-sessions', '0 * * * *', 'SELECT clean_expired_sessions()');