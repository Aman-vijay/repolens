# Troubleshooting Guide

## Common Issues and Solutions

### Database Connection Issues

#### "DATABASE_URL environment variable is not set"

**Problem**: The API fails to start with this error.

**Solution**:
1. Ensure `.env` file exists in `apps/api/` with `DATABASE_URL`
2. Verify the format: `postgresql+asyncpg://user:pass@host:5432/dbname`
3. For local dev, ensure Neon credentials are correct
4. Check network connectivity to Neon

#### "Connection refused" errors

**Problem**: Cannot connect to PostgreSQL.

**Solution**:
- Verify SSL requirements: Neon requires `ssl=require`
- Check if IP is whitelisted in Neon dashboard
- Try connecting with `psql` directly to verify credentials

### Redis/Queue Issues

#### "Cannot connect to Redis"

**Problem**: Worker fails to start or jobs are not being processed.

**Solution**:
1. Verify `REDIS_URL` is correctly set
2. Check Upstash dashboard for quota limits
3. Ensure Redis URL format is correct: `redis://user:pass@host:6379`
4. For local development, you can use a local Redis instance

#### Jobs stuck in pending

**Problem**: Background jobs remain in pending status.

**Solution**:
- Check worker is running: `make worker`
- Review ARQ logs for errors
- Verify Redis connection is working
- Check job class is registered in `workers/worker.py`

### Authentication Issues

#### "Invalid session" errors

**Problem**: Clerk authentication fails.

**Solution**:
1. Verify `CLERK_SECRET_KEY` is correct
2. Check that `CLERK_WEBHOOK_SECRET` is configured
3. Ensure frontend URL is in Clerk's authorized parties
4. Check Clerk dashboard for any API outages

#### "Superadmin access required" on admin routes

**Problem**: Cannot access admin endpoints.

**Solution**:
- Set `SUPERADMIN_CLERK_USER_ID` to your Clerk user ID
- Find your Clerk user ID in the Clerk dashboard
- Only users with `is_superuser=true` can access admin routes

### CORS Issues

#### "Blocked by CORS policy"

**Problem**: Frontend API calls fail with CORS errors.

**Solution**:
1. Verify `FRONTEND_URL` in backend settings matches frontend URL exactly
2. Check that frontend URL uses the correct protocol (http vs https)
3. Ensure CORS middleware allows your frontend origin

### OpenAI API Issues

#### "OPENAI_API_KEY not configured"

**Problem**: Chat or analysis features fail.

**Solution**:
1. Set `OPENAI_API_KEY` in environment
2. Verify key is valid in OpenAI dashboard
3. Check API quota/limits

#### Slow response times

**Problem**: Chat or analysis takes very long.

**Solution**:
- First token latency is expected to be 500-1500ms
- Full completion may take 3-10 seconds
- Check OpenAI status page for outages
- Consider rate limits on your plan

### Frontend Issues

#### Page doesn't load

**Problem**: Next.js app shows errors or blank page.

**Solution**:
1. Run `pnpm dev` for better error messages
2. Clear browser cache and hard reload
3. Check browser console for specific errors
4. Verify environment variables are set

#### "Failed to fetch projects"

**Problem**: Project list doesn't load.

**Solution**:
- Verify API server is running on port 8000
- Check API logs for authentication errors
- Ensure Clerk is properly configured
- Check network tab for failed requests

### Migration Issues

#### "Migration failed"

**Problem**: Database migration errors.

**Solution**:
1. Check migration file syntax
2. Review the specific error message
3. For new migrations: `make db-revision msg="fix"`
4. Verify database connection is working
5. Check for conflicting migrations

### Development Server Issues

#### Port already in use

**Problem**: Cannot start dev server.

**Solution**:
```bash
# Find and kill the process using the port
# Windows
netstat -ano | findstr :8000
taskkill /PID <pid> /F

# macOS/Linux
lsof -i :8000
kill -9 <pid>
```

#### Hot reload not working

**Problem**: Changes not reflected in browser.

**Solution**:
1. Restart the dev server
2. Clear Next.js cache: `rm -rf .next`
3. Check file system permissions

## Getting Help

If you continue to experience issues:

1. Check the [Architecture Guide](architecture.md) for system context
2. Review [ADRs](adr/) for historical decisions
3. Search existing GitHub issues
4. Create a new issue with:
   - Environment details
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs or screenshots
