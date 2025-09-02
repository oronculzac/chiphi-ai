# Production Deployment Guide

This guide covers deploying ChiPhi AI to production with proper configuration, monitoring, and security.

## Prerequisites

- Node.js 18 or higher
- Docker and Docker Compose (for containerized deployment)
- SSL certificates for HTTPS
- Supabase production project
- OpenAI API key
- Email service (Mailgun or Resend) configured

## Environment Configuration

### 1. Create Production Environment File

Copy the example environment file and configure it:

```bash
cp .env.production.example .env.production
```

Fill in all required values in `.env.production`:

```bash
# Required production values
NODE_ENV=production
NEXTAUTH_SECRET=your-secure-32-char-secret
NEXTAUTH_URL=https://your-domain.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
EMAIL_DOMAIN=your-domain.com
MAILGUN_WEBHOOK_SIGNING_KEY=your-mailgun-key
```

### 2. Validate Configuration

Run the configuration validator:

```bash
npm run validate:production
```

## Deployment Methods

### Method 1: Direct Node.js Deployment

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Start with production script:**
   ```bash
   npm run start:production
   ```

### Method 2: Docker Deployment

1. **Build production image:**
   ```bash
   docker build -f Dockerfile.production -t chiphi-ai:latest .
   ```

2. **Run with Docker Compose:**
   ```bash
   docker-compose -f docker-compose.production.yml up -d
   ```

### Method 3: Platform Deployment (Vercel/Railway/etc.)

1. **Set environment variables** in your platform dashboard
2. **Configure build settings:**
   - Build Command: `npm run build`
   - Start Command: `npm run start:production`
   - Node.js Version: 18.x

## Database Setup

### 1. Supabase Production Configuration

1. Create a new Supabase project for production
2. Run migrations:
   ```bash
   supabase db push --project-ref your-project-ref
   ```
3. Configure Row Level Security (RLS) policies
4. Set up database connection pooling in Supabase dashboard

### 2. Database Optimization

The application includes automatic database optimizations:

- Connection pooling with configurable limits
- Query performance monitoring
- Slow query detection and logging
- Health checks for database connectivity

## Monitoring and Health Checks

### Health Check Endpoints

- **Health Check:** `GET /api/health` - Comprehensive system health
- **Readiness Check:** `GET /api/ready` - Application readiness
- **Simple Check:** `HEAD /api/health` - Quick health status

### Health Check Response Example

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 45
    },
    "memory": {
      "status": "healthy",
      "usage": {
        "used": 134217728,
        "total": 268435456,
        "percentage": 50.0
      }
    },
    "connections": {
      "status": "healthy",
      "active": 5,
      "max": 20,
      "percentage": 25.0
    }
  },
  "uptime": 3600000
}
```

### Monitoring Integration

Configure monitoring tools to check these endpoints:

- **Uptime monitoring:** Check `/api/health` every 30 seconds
- **Load balancer health:** Use `/api/ready` for readiness probes
- **Kubernetes:** Use both endpoints for liveness and readiness probes

## Logging Configuration

### Structured Logging

Production logging is configured with:

- **Format:** JSON for machine parsing
- **Level:** INFO (configurable via `LOG_LEVEL`)
- **Correlation IDs:** Track requests across services
- **Performance metrics:** Automatic slow query detection

### Log Output Example

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "info",
  "message": "Email processing completed successfully",
  "correlationId": "req-123-456",
  "userId": "user-789",
  "orgId": "org-abc",
  "component": "email-processor",
  "metadata": {
    "messageId": "msg-123",
    "transactionId": "txn-456",
    "processingTimeMs": 2500
  }
}
```

### Log Aggregation

For production, consider integrating with:

- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Splunk**
- **DataDog**
- **New Relic**
- **CloudWatch** (AWS)

## Security Configuration

### SSL/TLS Setup

1. **Obtain SSL certificates** (Let's Encrypt, CloudFlare, etc.)
2. **Configure HTTPS** in your reverse proxy (Nginx example provided)
3. **Set security headers** (included in Nginx config)

### Rate Limiting

Production rate limits are configured:

- **API endpoints:** 100 requests per IP per 15 minutes
- **Webhook endpoints:** 5 requests per IP per second
- **Per-organization limits:** 500 requests per hour

### Security Headers

The following security headers are automatically set:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: [restrictive policy]`
- `Strict-Transport-Security: max-age=31536000`

## Performance Optimization

### Database Performance

- **Connection pooling:** Max 20 connections per instance
- **Query monitoring:** Automatic slow query detection (>1000ms)
- **Indexing:** Optimized indexes for common queries
- **Caching:** Merchant mapping cache for frequent lookups

### Application Performance

- **Memory management:** 2GB heap limit
- **Compression:** Gzip enabled for all text content
- **Static file caching:** 1-year cache for immutable assets
- **CDN integration:** Use CDN for static assets

### Monitoring Metrics

Track these key metrics:

- **Response time:** API endpoint latency
- **Throughput:** Requests per second
- **Error rate:** 4xx/5xx response percentage
- **Database performance:** Query execution time
- **Memory usage:** Heap utilization
- **Email processing:** Processing time per email

## Backup and Recovery

### Database Backups

Supabase provides automatic backups, but also consider:

1. **Daily exports** of critical data
2. **Point-in-time recovery** configuration
3. **Cross-region backup** replication

### Application Backups

- **Configuration files:** Store in version control
- **Environment variables:** Secure backup of production secrets
- **SSL certificates:** Backup and renewal automation

## Troubleshooting

### Common Issues

1. **Health check failures:**
   ```bash
   # Check application logs
   docker logs chiphi-ai-production
   
   # Test health endpoint directly
   curl -f http://localhost:3000/api/health
   ```

2. **Database connection issues:**
   ```bash
   # Check database connectivity
   npm run health:check
   
   # Verify environment variables
   npm run validate:production
   ```

3. **Email processing failures:**
   - Check webhook endpoint accessibility
   - Verify HMAC signature configuration
   - Review email processing logs

### Log Analysis

Use structured logging to debug issues:

```bash
# Filter by correlation ID
grep "req-123-456" /app/logs/application.log

# Find slow queries
grep "slowQuery" /app/logs/application.log

# Check error patterns
grep "level\":\"error\"" /app/logs/application.log
```

## Scaling Considerations

### Horizontal Scaling

- **Load balancer:** Distribute traffic across multiple instances
- **Session storage:** Use Redis for shared session state
- **Database:** Configure read replicas for query scaling

### Vertical Scaling

- **Memory:** Increase heap size via `NODE_OPTIONS`
- **CPU:** Scale container CPU limits
- **Database:** Upgrade Supabase plan for more connections

### Auto-scaling

Configure auto-scaling based on:

- **CPU utilization:** Scale at 70% CPU usage
- **Memory usage:** Scale at 80% memory usage
- **Response time:** Scale when latency > 2 seconds
- **Queue depth:** Scale when email processing queue grows

## Maintenance

### Regular Tasks

1. **Update dependencies:** Monthly security updates
2. **Certificate renewal:** Automated SSL certificate renewal
3. **Log rotation:** Prevent disk space issues
4. **Performance review:** Monthly performance analysis
5. **Backup verification:** Test backup restoration procedures

### Monitoring Alerts

Set up alerts for:

- **Health check failures:** Immediate alert
- **High error rate:** >5% error rate for 5 minutes
- **Slow response time:** >2 second average for 5 minutes
- **Database issues:** Connection failures or slow queries
- **Memory usage:** >90% memory utilization
- **Disk space:** <10% free disk space

This production deployment configuration ensures ChiPhi AI runs reliably, securely, and performantly in production environments.