# Supabase Setup Guide for AgriTrust

## Overview

This guide will help you set up Supabase as the database backend for the AgriTrust application, replacing the PostgreSQL setup with a managed cloud database solution.

## Prerequisites

- Supabase account (free tier available)
- Node.js 18+
- Supabase CLI (optional but recommended)

## 1. Create Supabase Project

### Step 1: Sign up for Supabase

1. Go to [supabase.com](https://supabase.com)
2. Sign up for a free account
3. Create a new project
4. Choose a project name: `agritrust-marketplace`
5. Set a strong database password
6. Select a region close to your users

### Step 2: Get Project Credentials

After project creation, go to **Settings > API** and copy:

- **Project URL**: `https://your-project-id.supabase.co`
- **Publishable Key**: `sb_publishable_...` (new Supabase key format)
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (optional, keep secret!)

## 2. Environment Configuration

Update your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_your_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Existing configuration...
NEXT_PUBLIC_PRIVY_APP_ID=cmj0bubth0av8ic0d76i7sm1q
PINATA_JWT=your_pinata_jwt_here

# Blockchain Configuration
PRIVATE_KEY=your_wallet_private_key_here
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_infura_key
ETHERSCAN_API_KEY=your_etherscan_api_key

# Contract Addresses (after deployment)
NEXT_PUBLIC_AGRITRUST_CONTRACT=
NEXT_PUBLIC_AGRITRUST_TOKEN_CONTRACT=
NEXT_PUBLIC_AGRITRUST_ESCROW_CONTRACT=
NEXT_PUBLIC_CHAIN_ID=11155111
```

## 3. Database Schema Setup

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and run the SQL script
5. Verify tables are created in the **Table Editor**

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Run migrations
supabase db push
```

## 4. Install Dependencies

```bash
npm install @supabase/supabase-js
npm install ethers viem wagmi @wagmi/core @wagmi/connectors
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
```

## 5. Verify Setup

### Test Database Connection

Create a test file `test-supabase.js`:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://your-project-id.supabase.co'
const supabaseKey = 'your-anon-key'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (error) throw error
    console.log('✅ Supabase connection successful!')
    console.log('Sample data:', data)
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
  }
}

testConnection()
```

Run the test:
```bash
node test-supabase.js
```

## 6. Row Level Security (RLS) Configuration

The migration script automatically sets up RLS policies, but you can customize them:

### Key Security Features:

1. **User Data Protection**: Users can only access their own data
2. **Public Crop Listings**: Anyone can view active crops
3. **Farmer Permissions**: Farmers can only manage their own crops
4. **Buyer Permissions**: Buyers can only access their bids and orders
5. **Service Role**: Backend operations use service role key

### Custom Policies (if needed):

```sql
-- Example: Allow farmers to view all bids on their auctions
CREATE POLICY "Farmers can view bids on their auctions" ON bids
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auctions a
            JOIN crops c ON c.id = a.crop_id
            JOIN users u ON u.id = c.farmer_id
            WHERE a.id = bids.auction_id 
            AND u.wallet_address = auth.uid()::text
        )
    );
```

## 7. Real-time Subscriptions (Optional)

Enable real-time updates for auctions and bids:

```typescript
// In your React component
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/database'

function AuctionComponent({ auctionId }) {
  const [bids, setBids] = useState([])

  useEffect(() => {
    // Subscribe to new bids
    const subscription = supabase
      .channel('auction-bids')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids',
          filter: `auction_id=eq.${auctionId}`
        },
        (payload) => {
          setBids(current => [...current, payload.new])
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [auctionId])

  return (
    <div>
      {/* Your auction UI */}
    </div>
  )
}
```

## 8. Backup and Recovery

### Automatic Backups

Supabase automatically backs up your database daily. For additional protection:

1. Go to **Settings > Database**
2. Enable **Point-in-time Recovery** (paid plans)
3. Set up **Database Webhooks** for critical events

### Manual Backup

```bash
# Using Supabase CLI
supabase db dump --file backup.sql

# Restore from backup
supabase db reset --file backup.sql
```

## 9. Performance Optimization

### Indexing Strategy

The migration includes optimized indexes, but monitor query performance:

```sql
-- Check slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Add custom indexes if needed
CREATE INDEX CONCURRENTLY idx_custom_query 
ON crops (status, crop_type, created_at DESC);
```

### Connection Pooling

Supabase includes built-in connection pooling. For high-traffic applications:

1. Use **Transaction Mode** for short queries
2. Use **Session Mode** for complex transactions
3. Monitor connection usage in dashboard

## 10. Monitoring and Analytics

### Built-in Monitoring

1. **Database Health**: Monitor CPU, memory, and disk usage
2. **API Analytics**: Track request volume and response times
3. **Real-time Connections**: Monitor active subscriptions

### Custom Monitoring

```typescript
// Track application metrics
const trackEvent = async (event: string, data: any) => {
  await supabase
    .from('analytics_events')
    .insert({
      event_name: event,
      event_data: data,
      user_id: getCurrentUserId(),
      timestamp: new Date().toISOString()
    })
}

// Usage
trackEvent('crop_registered', { cropId, farmerId })
trackEvent('bid_placed', { auctionId, bidAmount })
```

## 11. Security Best Practices

### API Key Management

1. **Never expose service role key** in frontend code
2. **Rotate keys regularly** in production
3. **Use environment variables** for all sensitive data
4. **Enable API key restrictions** by domain/IP

### Database Security

1. **Enable RLS** on all tables (done in migration)
2. **Validate all inputs** in your application
3. **Use prepared statements** (Supabase handles this)
4. **Regular security audits** of policies

### Authentication Integration

```typescript
// Integrate with Privy authentication
import { usePrivy } from '@privy-io/react-auth'
import { supabase } from '@/lib/database'

function useSupabaseAuth() {
  const { user, authenticated } = usePrivy()

  useEffect(() => {
    if (authenticated && user) {
      // Set Supabase auth context
      supabase.auth.setAuth(user.wallet?.address)
    }
  }, [authenticated, user])
}
```

## 12. Troubleshooting

### Common Issues

1. **Connection Errors**
   - Check project URL and API keys
   - Verify network connectivity
   - Check Supabase service status

2. **RLS Policy Errors**
   - Ensure user is properly authenticated
   - Check policy conditions
   - Use service role for admin operations

3. **Performance Issues**
   - Add appropriate indexes
   - Optimize query patterns
   - Use database functions for complex operations

### Debug Mode

```typescript
// Enable debug logging
const supabase = createClient(url, key, {
  auth: { debug: true },
  db: { schema: 'public' },
  global: { headers: { 'x-my-custom-header': 'my-app-name' } }
})
```

## 13. Migration from PostgreSQL

If migrating from existing PostgreSQL:

1. **Export existing data**:
   ```bash
   pg_dump your_db > backup.sql
   ```

2. **Clean and import**:
   - Remove PostgreSQL-specific syntax
   - Adjust data types if needed
   - Import via Supabase SQL editor

3. **Update application code**:
   - Replace `pg` queries with Supabase client
   - Update connection strings
   - Test all functionality

## 14. Production Deployment

### Pre-deployment Checklist

- [ ] All environment variables configured
- [ ] Database schema deployed
- [ ] RLS policies tested
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Performance tested
- [ ] Security audit completed

### Scaling Considerations

1. **Database Limits**: Monitor row counts and storage
2. **API Limits**: Track requests per minute
3. **Real-time Connections**: Monitor concurrent subscriptions
4. **Upgrade Plan**: Consider Pro plan for production

## Support Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord Community](https://discord.supabase.com)
- [GitHub Issues](https://github.com/supabase/supabase/issues)
- [Status Page](https://status.supabase.com)

---

**Note**: Always test thoroughly in development before deploying to production. Supabase provides excellent tooling, but proper testing ensures a smooth user experience.