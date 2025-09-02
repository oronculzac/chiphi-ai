# Demo User Setup for ChiPhi AI

## Demo User Credentials

**Email:** `demo@chiphi.ai`  
**Password:** `demo123!`  
**User ID:** `da020c2c-9a65-4f21-b1ad-403810c539b4`

## Demo User Data

The demo user has been set up with:

- **Organization:** "Demo User" (Owner role)
- **Inbox Alias:** `receipts-4bcc92a5@chiphi.ai`
- **Sample Transactions:** 4 transactions totaling $118.67

### Sample Transaction Data

1. **Starbucks** - $5.75 (Coffee Shops)
   - Grande Latte purchase
   - Confidence: 95%

2. **Amazon** - $29.99 (Online Shopping)
   - Wireless headphones
   - Confidence: 88%

3. **Uber** - $15.50 (Transportation/Rideshare)
   - Trip to downtown
   - Confidence: 92%

4. **Whole Foods Market** - $67.43 (Groceries/Supermarket)
   - Weekly grocery shopping
   - Confidence: 95%

## Testing Sign-in

### Option 1: Password Authentication (Recommended)
Visit `http://localhost:3002/` and use the **Password** tab:
- Email: `demo@chiphi.ai`
- Password: `demo123!`

### Option 2: Magic Link Authentication
Visit `http://localhost:3002/` and use the **Magic Link** tab:
- Email: `demo@chiphi.ai`
- Check your email for the magic link (if email is configured)

### Option 3: Direct Database Authentication
The user exists in the `auth.users` table and can be used for testing RLS policies and user-specific functionality.

## Verification

To verify the demo user setup, you can run:

```sql
-- Check user profile
SELECT * FROM users WHERE email = 'demo@chiphi.ai';

-- Check organization membership
SELECT u.email, o.name, om.role 
FROM users u 
JOIN org_members om ON u.id = om.user_id 
JOIN orgs o ON om.org_id = o.id 
WHERE u.email = 'demo@chiphi.ai';

-- Check transactions
SELECT t.date, t.merchant, t.amount, t.category 
FROM transactions t 
JOIN orgs o ON t.org_id = o.id 
JOIN org_members om ON o.id = om.org_id 
JOIN users u ON om.user_id = u.id 
WHERE u.email = 'demo@chiphi.ai' 
ORDER BY t.date DESC;
```

## Next Steps

1. **Set up authentication method** - Configure your preferred auth method (email/password, magic link, OAuth, etc.)
2. **Test sign-in flow** - Verify the user can authenticate and access their data
3. **Test RLS policies** - Ensure the user can only see their own organization's data
4. **Test application features** - Verify dashboard, transaction viewing, etc. work correctly

## Security Notes

- This is a demo user for testing purposes only
- In production, ensure proper password policies and security measures
- The demo data includes realistic transaction examples for UI testing
- All data is properly isolated by organization through RLS policies