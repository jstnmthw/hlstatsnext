# HLStats Daemon v2 - AI Execution Prompt

## **CRITICAL: READ THIS ENTIRE PROMPT BEFORE TAKING ANY ACTION**

You are tasked with implementing the HLStats Daemon v2 following the MIGRATION_PLAN.md. This is a complex, multi-phase project that requires careful execution and constant validation.

---

## **Core Directives**

### **1. Execution Principles**

- **ALWAYS** check the current state before proceeding
- **NEVER** skip validation steps
- **PAUSE** for user input at designated checkpoints
- **MAINTAIN** a progress log in `apps/daemon-v2/docs/MIGRATION_PROGRESS.md`
- **TEST** each component before moving to the next
- **DOCUMENT** all decisions and deviations

### **2. Rate Limiting & Safety**

- **MAX 5 file operations per execution block**
- **WAIT for user confirmation** after major changes
- **CHECK file existence** before any operation
- **BACKUP critical files** before modification
- **VALIDATE syntax** after each file creation

### **3. Error Handling**

```markdown
IF error occurs:

1. STOP current operation
2. LOG error details
3. SUGGEST fix options
4. WAIT for user decision
5. RETRY with modifications
```

---

## **Execution Workflow**

### **STEP 0: Initial Setup & Validation**

1. **Check Prerequisites**

   ```bash
   # Verify environment
   node --version  # Should be 20+
   pnpm --version  # Should be 8+
   docker --version
   ```

2. **Create Progress Tracker**

   ```markdown
   # apps/daemon/docs/MIGRATION_PROGRESS.md

   - [ ] Phase 1: Foundation
     - [ ] Turbo structure setup (already in place)
     - [ ] Core services scaffolding
     - [ ] Database schema updates (schema already available in @repo/database)
     - [ ] UDP server implementation
     - [ ] Unit test framework
   ```

**CHECKPOINT**: Ask user: "Prerequisites verified and backup created. Proceed with Phase 1? (y/n)"

---

### **PHASE 1: Foundation (Execute in Order)**

#### **1.1 Create Directory Structure**

```bash
# Create daemon-v2 structure
mkdir -p apps/daemon-v2/{src,tests,scripts,config}
mkdir -p apps/daemon-v2/src/{services,types,utils,monitoring}
mkdir -p apps/daemon-v2/src/services/{gateway,ingress,processor,rcon,statistics}
```

**VALIDATE**: Check directories exist with `ls -la apps/daemon-v2/`

#### **1.2 Initialize Package.json**

Create `apps/daemon-v2/package.json`:

```json
{
  "name": "daemon",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@repo/database": "workspace:*",
    "fastify": "^4.25.0",
    "bullmq": "^5.1.0",
    "ioredis": "^5.3.0",
    "zod": "^3.22.0",
    "winston": "^3.11.0"
  }
}
```

**ACTION**: Run `pnpm install` in daemon-v2 directory

#### **1.3 TypeScript Configuration**

Create `apps/daemon-v2/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**CHECKPOINT**: "Basic structure created. Run tests? (y/n)"

#### **1.4 Core Service Implementation**

For each service, follow this pattern:

1. **Create service file**
2. **Add type definitions**
3. **Implement basic functionality**
4. **Add unit tests**
5. **Validate implementation**

**RATE LIMIT**: After creating 5 files, pause and ask: "Files created. Review before continuing? (y/n)"

---

### **PHASE 2: Core Processing**

**PRE-FLIGHT CHECK**:

```markdown
Before starting Phase 2:

- [ ] All Phase 1 tests passing
- [ ] Docker services running
- [ ] Database accessible
- [ ] Redis connected
```

#### **2.1 Event Processing Pipeline**

**SEQUENTIAL EXECUTION**:

1. Create event types
2. Implement queue manager
3. Build event processors
4. Add error handling
5. Write integration tests

**ERROR RECOVERY**:

```typescript
// If queue connection fails
try {
  await queue.connect();
} catch (error) {
  console.error("Queue connection failed:", error);
}
```

---

### **PHASE 3: Advanced Features**

**FEATURE IMPLEMENTATION ORDER**:

1. RCON Service (critical path)
2. Statistics Service
3. Admin Interface (Integrated in a Next.js SSR app in `apps/web`)
4. Real-time features
5. Performance optimizations

**USER INTERACTION POINTS**:

- After RCON implementation: "Test RCON with game server? (y/n)"
- After statistics: "Run performance benchmarks? (y/n)"
- Before optimization: "Current performance metrics acceptable? (y/n)"

---

### **PHASE 4: Production Deployment**

**CRITICAL VALIDATIONS**:

```bash
# Security scan
pnpm audit
# Load test
pnpm run test:load
# Integration test
pnpm run test:integration
```

**DEPLOYMENT CHECKLIST**:

- [ ] All tests passing (>90% coverage)
- [ ] No security vulnerabilities
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Monitoring configured

---

## **Progress Tracking**

### **Progress Report Format**

```markdown
## Progress Report - [DATE]

### Completed

- ✅ Task 1: Description (time taken)
- ✅ Task 2: Description (issues: none)

### In Progress

- 🔄 Task 3: Description (blocked by: X)

### Upcoming

- ⏳ Task 4: Description (estimated: Y hours)

### Issues & Resolutions

- Issue: Database timeout
  - Resolution: Increased connection pool
  - Impact: None
```

---

## **Error Recovery Procedures**

### **Connection Failures**

```typescript
const MAX_RETRIES = 3;
let retries = 0;

while (retries < MAX_RETRIES) {
  try {
    await connectToService();
    break;
  } catch (error) {
    retries++;
    console.log(`Retry ${retries}/${MAX_RETRIES}`);

    if (retries === MAX_RETRIES) {
      // Log or throw error then stop.
    }

    await sleep(1000 * retries); // Exponential backoff
  }
}
```

### **File System Errors**

```typescript
function safeFileOperation(operation: () => Promise<void>) {
  try {
    // Check disk space
    const stats = await checkDiskSpace();
    if (stats.free < 100 * 1024 * 1024) {
      // 100MB
      throw new Error("Insufficient disk space");
    }

    // Perform operation
    await operation();
  } catch (error) {
    // Log or throw error
  }
}
```

---

## **Auto-Recovery Mechanisms**

### **Service Health Monitoring**

Utilize Docker healthchecks.

---

## **Success Criteria**

Migration is complete when:

- [ ] All phases completed
- [ ] All tests passing
- [ ] Performance targets met
- [ ] No critical issues logged
- [ ] User acceptance confirmed
- [ ] Documentation updated
- [ ] Old daemon safely archived

---

**REMEMBER**:

- Take breaks between phases
- Document every decision
- Test thoroughly
- Ask for help when uncertain
- Celebrate small wins! 🎉
