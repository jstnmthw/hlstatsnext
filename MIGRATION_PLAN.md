# HLStatsX Next.js 15 Development Plan

This document outlines the complete development strategy for building a modern HLStatsX replacement using Next.js 15, GraphQL, and Prisma ORM in a fresh Turbo Repo. The approach prioritizes essential data first, followed by admin features, extended functionality, and finally polishing for optimal user experience.

## Core Principles

### 1. Clean Architecture from Day One

- **Turbo Repo monorepo** - Shared packages and applications for maximum code reuse
- **TypeScript-first development** - Strict typing throughout the entire stack
- **Server Components by default** - Leverage Next.js 15 SSR capabilities
- **GraphQL API layer** - Flexible, efficient data querying

### 2. Database-First Development

- **Prisma as single source of truth** - Database schema drives TypeScript types
- **Automated type generation** - Zero manual type definitions for database entities
- **Modern database design** - Clean schema optimized for performance
- **Migration-ready architecture** - Easy data import from legacy system

### 3. Essential-First Approach

- **Core functionality prioritized** - Get basic features working first
- **Admin tools second** - Management interface for configuration
- **Extended features third** - Advanced statistics and visualizations
- **Polish last** - Performance optimization and UX refinements

---

## Architecture Overview

### Technology Stack

- **Monorepo**: Turbo Repo for package management and build optimization
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **API**: GraphQL Yoga + TypeScript + Prisma ORM
- **Database**: MySQL with modern schema design
- **Daemon**: Existing pearl service for real-time game server monitoring
- **Validation**: Zod for runtime type safety
- **Testing**: Vitest + Playwright + React Testing Library

### Turbo Repo Structure

```
hlstatsx-next/
├── apps/
│   ├── web/              # Next.js 15 frontend application
│   ├── api/              # GraphQL API server
│   └── daemon/           # Game server monitoring daemon
├── packages/
│   ├── ui/               # Shared React components
│   ├── config/           # Shared configuration and constants
│   └── database/         # Prisma schema and utilities
├── tools/
│   ├── eslint-config/    # Shared ESLint configuration
│   └── typescript-config/ # Shared TypeScript configuration
└── docs/                 # Documentation and API specs
```

---

## Phase 1: Foundation & Core Infrastructure (Week 1-2)

### Step 1.1: Turbo Repo Setup and Configuration

**Deliverable**: Working Turbo Repo with all applications and packages
**Review Point**: All apps build successfully and communicate

**Actions**:

- Initialize Turbo Repo with proper workspace configuration
- Set up shared TypeScript and ESLint configurations
- Configure package dependencies and build optimization
- Set up development scripts and hot-reload across apps
- Configure environment variable management

**Technical Requirements**:

```json
// turbo.json
{
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**Review Criteria**:

- [ ] All packages build without errors
- [ ] Hot-reload working across applications
- [ ] Shared configurations properly applied
- [ ] Environment variables properly managed
- [ ] Turbo build optimization functional

### Step 1.2: Legacy Database Analysis and Schema Discovery

**Deliverable**: Complete analysis of existing HLStatsX database structure and data mapping requirements
**Review Point**: Legacy data structure fully documented with mapping strategy defined

**Actions**:

- **REQUEST LEGACY DATABASE ACCESS**: Obtain read-only access to existing HLStatsX MySQL database
- Analyze existing table structure, relationships, and data types
- Document all tables, columns, indexes, and foreign key relationships
- Identify data transformation requirements and potential data quality issues
- Map legacy field names to modern naming conventions
- Document any custom data or business logic embedded in the current system

**Required Information from Legacy System**:

```sql
-- Database schema export needed
SHOW CREATE DATABASE hlstatsxce;
SHOW TABLES;
DESCRIBE hlstats_Players;
DESCRIBE hlstats_Events;
DESCRIBE hlstats_Servers;
-- ... (for all major tables)

-- Sample data analysis needed
SELECT COUNT(*) FROM hlstats_Players;
SELECT * FROM hlstats_Players LIMIT 10;
SELECT DISTINCT game FROM hlstats_Players;
-- ... (sample queries to understand data patterns)
```

**Legacy Data Mapping Strategy**:

- **Player Data**: Map `hlstats_Players` → `Player` model with modern field names
- **Game Statistics**: Transform `hlstats_Events` → normalized `PlayerStats` and `GameEvents`
- **Server Information**: Convert `hlstats_Servers` → `Server` model with enhanced monitoring data
- **Weapon Statistics**: Analyze weapon-specific tables and create unified `WeaponStats` model
- **Clan/Team Data**: Map clan tables to modern `Clan` and `ClanMember` relationships

**Data Quality Assessment**:

- Identify duplicate records and data inconsistencies
- Document data validation rules from legacy system
- Analyze data volume and performance implications
- Plan for data cleanup during import process

**Review Criteria**:

- [ ] Complete database schema documented
- [ ] Data mapping strategy defined for all major entities
- [ ] Sample data analysis completed
- [ ] Data quality issues identified and documented
- [ ] Import strategy estimated for timeline and complexity
- [ ] Modern schema requirements clarified based on legacy analysis

### Step 1.3: Database Design and Prisma Setup

**Deliverable**: Modern database schema with automated type generation
**Review Point**: Database schema optimized for performance and scalability

**Actions**:

- Design clean, normalized database schema based on legacy analysis
- Set up Prisma in `packages/database` with multi-app access
- Configure automated type generation for all applications
- Create seed data for development and testing
- Document schema design decisions and relationships
- Plan migration scripts based on legacy data mapping

**Modern Schema Design Principles**:

- **Consistent naming**: camelCase fields, singular table names
- **Proper relationships**: Foreign keys with cascade rules
- **Performance indexes**: Strategic indexing for common queries
- **Extensible structure**: Easy to add new game types and statistics
- **Legacy compatibility**: Import-friendly structure for data migration

**Example Schema Structure** (based on legacy analysis):

```prisma
model Player {
  id          String   @id @default(cuid())
  steamId     String   @unique
  name        String
  skill       Float    @default(1000)
  gameId      String
  game        Game     @relation(fields: [gameId], references: [id])
  statistics  PlayerStat[]
  // Legacy mapping: hlstats_Players.playerId → id, lastName → name, etc.
  legacyId    Int?     @unique // Preserve original ID for import reference
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model GameEvent {
  id          String   @id @default(cuid())
  playerId    String
  player      Player   @relation(fields: [playerId], references: [id])
  eventType   String
  weaponId    String?
  // Legacy mapping: hlstats_Events → GameEvent with normalized structure
  legacyEventId Int?   @unique
  timestamp   DateTime
}
```

**Review Criteria**:

- [ ] Schema follows modern design principles
- [ ] All relationships properly defined
- [ ] Indexes optimized for common queries
- [ ] TypeScript types auto-generated
- [ ] Seed data creates realistic test environment
- [ ] Legacy data import compatibility confirmed

### Step 1.4: GraphQL API Foundation

**Deliverable**: Working GraphQL API with basic queries and real-time capabilities
**Review Point**: API serves data efficiently with proper error handling

**Actions**:

- Set up GraphQL Yoga server in `apps/api`
- Implement basic schema for core entities (Players, Games, Servers)
- Configure Prisma Client integration
- Add subscription support for real-time updates
- Implement authentication and authorization framework

**API Design Principles**:

- **Efficient queries**: Minimize N+1 problems with proper Prisma includes
- **Type safety**: Full TypeScript integration
- **Real-time support**: GraphQL subscriptions for live updates
- **Error handling**: Consistent error responses with proper codes

**Review Criteria**:

- [ ] GraphQL Playground accessible and functional
- [ ] Basic queries return correct data
- [ ] Subscriptions working for real-time updates
- [ ] Error handling comprehensive
- [ ] Performance acceptable (<100ms for basic queries)

---

## Phase 2: Essential Data and Core Features (Week 3-5)

### Step 2.1: Game Server Monitoring Daemon

**Deliverable**: Node.js daemon that monitors game servers and updates database
**Review Point**: Daemon reliably collects and stores game data

**Actions**:

- Create `apps/daemon` for game server monitoring
- Implement server query protocols (Steam A2S, SourceRCON)
- Set up real-time player tracking and statistics collection
- Configure database updates and conflict resolution
- Add health monitoring and error recovery

**Daemon Features**:

- **Multi-server support**: Monitor multiple game servers simultaneously
- **Real-time updates**: Live player counts and server status
- **Statistics collection**: Player kills, deaths, scores, and custom events
- **Fault tolerance**: Automatic recovery from connection failures
- **Performance monitoring**: Track daemon health and performance

**Review Criteria**:

- [ ] Daemon connects to game servers successfully
- [ ] Player statistics collected accurately
- [ ] Database updates happen reliably
- [ ] Error recovery working properly
- [ ] Performance monitoring functional

### Step 2.2: Core Web Interface (Next.js App)

**Deliverable**: Essential web pages with Server-Side Rendering
**Review Point**: Basic functionality accessible and performant

**Actions**:

- Set up Next.js 15 app in `apps/web` with App Router
- Create shared UI components in `packages/ui`
- Implement core pages: Home, Player Rankings, Server Status
- Add responsive design with Tailwind CSS
- Configure Apollo Client for GraphQL integration

**Essential Pages**:

- **Home Dashboard**: Overview of active servers and top players
- **Player Rankings**: Sortable, filterable player leaderboards
- **Server Status**: Real-time server information and player lists
- **Player Profiles**: Individual player statistics and history

**SSR Implementation**:

```typescript
// Server Component for player rankings
export default async function PlayersPage() {
  const players = await getTopPlayers(); // Server-side GraphQL call
  return <PlayerRankings players={players} />;
}
```

**Review Criteria**:

- [ ] All core pages render correctly
- [ ] SSR working properly
- [ ] Mobile responsive design
- [ ] GraphQL integration functional
- [ ] Performance acceptable (<2s initial load)

### Step 2.3: Data Import and Legacy Migration Tools

**Deliverable**: Tools to import data from existing HLStatsX installation
**Review Point**: Legacy data successfully imported and verified

**Actions**:

- Create data import scripts for legacy MySQL database
- Map legacy schema to new modern schema
- Implement data validation and transformation logic
- Add progress tracking and error reporting
- Create verification tools to ensure data integrity

**Import Strategy**:

- **Incremental import**: Support for importing subsets of data
- **Data transformation**: Convert legacy format to modern schema
- **Conflict resolution**: Handle duplicate or inconsistent data
- **Validation**: Verify imported data integrity
- **Rollback capability**: Ability to undo imports if needed

**Review Criteria**:

- [ ] Legacy data imports successfully
- [ ] Data transformation accurate
- [ ] No data loss during import
- [ ] Performance acceptable for large datasets
- [ ] Verification tools confirm data integrity

---

## Phase 3: Administration Interface (Week 6-7)

### Step 3.1: Authentication and Authorization System

**Deliverable**: Secure admin authentication with role-based access
**Review Point**: Admin security properly implemented

**Actions**:

- Implement JWT-based authentication
- Create role-based permission system (Super Admin, Admin, Moderator)
- Add secure login/logout functionality
- Implement session management and token refresh
- Add audit logging for admin actions

**Security Features**:

- **Multi-factor authentication**: Optional 2FA for admin accounts
- **Session security**: Secure token storage and rotation
- **Role-based access**: Granular permissions for different admin levels
- **Audit trail**: Log all administrative actions
- **Rate limiting**: Prevent brute force attacks

**Review Criteria**:

- [ ] Authentication working securely
- [ ] Role-based permissions enforced
- [ ] Session management robust
- [ ] Audit logging functional
- [ ] Security testing passed

### Step 3.2: Game and Server Management

**Deliverable**: Admin interface for managing games and servers
**Review Point**: Admins can configure all game settings

**Actions**:

- Create admin dashboard for game configuration
- Implement server management (add, edit, remove servers)
- Add game mod configuration and weapon settings
- Create player management tools (bans, rank adjustments)
- Implement system settings and configuration options

**Admin Features**:

- **Server Configuration**: Add/remove servers, set monitoring intervals
- **Game Settings**: Configure game modes, maps, and scoring rules
- **Player Management**: Search, edit, ban/unban players
- **Statistics Control**: Reset stats, adjust rankings manually
- **System Monitoring**: View daemon status and system health

**Review Criteria**:

- [ ] All admin functions working correctly
- [ ] Changes reflected immediately in live system
- [ ] Proper validation and error handling
- [ ] Responsive admin interface
- [ ] Comprehensive logging of admin actions

### Step 3.3: Analytics and Reporting Dashboard

**Deliverable**: Admin analytics dashboard with key metrics
**Review Point**: Admins can monitor system performance and usage

**Actions**:

- Create analytics dashboard with key performance indicators
- Implement server performance monitoring
- Add player activity and engagement metrics
- Create automated reporting system
- Add data export capabilities

**Analytics Features**:

- **Real-time Metrics**: Active players, server status, system health
- **Historical Trends**: Player growth, server usage patterns
- **Performance Monitoring**: API response times, database performance
- **Usage Analytics**: Popular features, user engagement
- **Custom Reports**: Exportable data for further analysis

**Review Criteria**:

- [ ] Analytics data accurate and up-to-date
- [ ] Dashboard responsive and informative
- [ ] Export functionality working
- [ ] Performance metrics helpful
- [ ] Historical data properly tracked

---

## Phase 4: Extended Features and Functionality (Week 8-10)

### Step 4.1: Advanced Player Statistics and Rankings

**Deliverable**: Comprehensive player statistics with advanced metrics
**Review Point**: Statistics match or exceed legacy system capabilities

**Actions**:

- Implement advanced ranking algorithms (skill rating, ELO)
- Create detailed player performance analytics
- Add weapon statistics and accuracy tracking
- Implement achievement and badge system
- Create player comparison tools

**Advanced Statistics**:

- **Skill Rating System**: Dynamic rating based on performance vs opponents
- **Weapon Analytics**: Detailed weapon usage and accuracy statistics
- **Performance Trends**: Historical performance tracking and analysis
- **Achievement System**: Unlockable badges and milestones
- **Comparative Analysis**: Player vs player comparisons

**Review Criteria**:

- [ ] All statistics calculated accurately
- [ ] Performance acceptable for complex queries
- [ ] Achievement system working correctly
- [ ] Comparison tools functional
- [ ] Data visualization clear and helpful

### Step 4.2: Clan and Team Management

**Deliverable**: Clan system with team statistics and management
**Review Point**: Clan functionality fully operational

**Actions**:

- Implement clan creation and management system
- Add clan member roles and permissions
- Create clan statistics and rankings
- Implement clan wars and team competitions
- Add clan recruitment and application system

**Clan Features**:

- **Clan Management**: Create, edit, disband clans with proper permissions
- **Member Hierarchy**: Leader, officer, member roles with different permissions
- **Clan Statistics**: Aggregate statistics for clan performance
- **Competitive Features**: Clan wars, tournaments, and challenges
- **Social Features**: Clan forums, announcements, and recruitment

**Review Criteria**:

- [ ] Clan creation and management working
- [ ] Member permissions properly enforced
- [ ] Clan statistics accurate
- [ ] Competitive features functional
- [ ] Social features enhance user engagement

### Step 4.3: Interactive Charts and Visualizations

**Deliverable**: Rich data visualizations and interactive charts
**Review Point**: Charts provide valuable insights and are performant

**Actions**:

- Implement interactive charts using Chart.js or D3.js
- Create performance trend visualizations
- Add server population and activity charts
- Implement heatmaps for map-based statistics
- Create exportable and shareable chart features

**Visualization Features**:

- **Performance Trends**: Player skill progression over time
- **Server Analytics**: Population trends and peak times
- **Map Statistics**: Heatmaps showing popular areas and strategies
- **Comparative Charts**: Multiple players or servers comparison
- **Interactive Features**: Zoom, filter, and drill-down capabilities

**Review Criteria**:

- [ ] Charts render quickly and smoothly
- [ ] Data accurately represented
- [ ] Interactive features responsive
- [ ] Export functionality working
- [ ] Charts provide actionable insights

---

## Phase 5: Polish and Optimization (Week 11-12)

### Step 5.1: Performance Optimization

**Deliverable**: Optimized application with excellent performance metrics
**Review Point**: Performance benchmarks met or exceeded

**Actions**:

- Optimize database queries and implement caching strategies
- Add CDN integration for static assets
- Implement code splitting and lazy loading
- Optimize bundle sizes and reduce load times
- Add performance monitoring and alerting

**Performance Targets**:

- **Page Load Time**: <1.5s initial, <300ms subsequent
- **API Response Time**: <50ms average
- **Database Queries**: 95% under 25ms
- **Bundle Size**: <500KB initial JavaScript
- **Lighthouse Score**: 95+ for Performance, Accessibility, SEO

**Review Criteria**:

- [ ] Performance targets met
- [ ] Caching strategies effective
- [ ] Bundle optimization successful
- [ ] Monitoring system functional
- [ ] User experience smooth and responsive

### Step 5.2: User Experience Enhancements

**Deliverable**: Polished UI/UX with accessibility and mobile optimization
**Review Point**: User experience exceptional across all devices

**Actions**:

- Conduct UX audit and implement improvements
- Add accessibility features (ARIA labels, keyboard navigation)
- Optimize mobile experience and touch interactions
- Implement progressive web app features
- Add user customization options (themes, layout preferences)

**UX Features**:

- **Accessibility**: WCAG 2.1 AA compliance
- **Mobile Optimization**: Touch-friendly interface and responsive design
- **PWA Features**: Offline capabilities and app-like experience
- **Customization**: User preferences for themes and layout
- **Micro-interactions**: Smooth animations and feedback

**Review Criteria**:

- [ ] Accessibility standards met
- [ ] Mobile experience excellent
- [ ] PWA features functional
- [ ] Customization options working
- [ ] User feedback positive

### Step 5.3: Security Hardening and Production Readiness

**Deliverable**: Production-ready application with comprehensive security
**Review Point**: Security audit passed, ready for deployment

**Actions**:

- Conduct comprehensive security audit
- Implement rate limiting and DDoS protection
- Add input validation and sanitization
- Set up monitoring and alerting systems
- Create deployment and backup procedures

**Security Features**:

- **Input Validation**: Comprehensive validation at all entry points
- **Rate Limiting**: API and authentication rate limiting
- **Security Headers**: Proper HTTP security headers
- **Monitoring**: Real-time security monitoring and alerting
- **Backup Systems**: Automated backups and disaster recovery

**Review Criteria**:

- [ ] Security audit passed
- [ ] Rate limiting effective
- [ ] Monitoring systems operational
- [ ] Backup procedures tested
- [ ] Deployment process documented

---

### Quality Assurance:

- **TypeScript Strict Mode**: Zero type errors allowed
- **Test Coverage**: 90%+ coverage for critical paths
- **Performance Testing**: Regular performance benchmarking
- **Security Scanning**: Automated vulnerability detection
- **Code Quality**: ESLint and Prettier enforcement

---

## Success Metrics

### Technical Metrics:

- **Build Performance**: Turbo builds complete in <60 seconds
- **Type Safety**: 100% TypeScript coverage across all packages
- **API Performance**: <50ms average response time
- **Frontend Performance**: Lighthouse scores 95+
- **Code Quality**: ESLint score 95+, zero critical issues

### User Experience Metrics:

- **Page Load Speed**: <1.5s initial load, <300ms navigation
- **Mobile Performance**: Excellent on all device sizes
- **Accessibility**: WCAG 2.1 AA compliance
- **User Satisfaction**: Positive feedback on usability
- **Feature Completeness**: All essential features working

### Business Metrics:

- **Development Velocity**: Faster feature development than legacy
- **Maintenance Overhead**: Reduced time spent on bug fixes
- **Scalability**: System handles increased load gracefully
- **Code Reusability**: High reuse across packages
- **Developer Experience**: Improved development workflow

---

## Risk Mitigation

### Technical Risks:

- **Package Dependencies**: Pin versions, regular security updates
- **Performance Issues**: Continuous monitoring and optimization
- **Data Integrity**: Comprehensive validation and testing
- **Type Safety**: Automated type checking in CI/CD

### Mitigation Strategies:

- **Comprehensive Testing**: Unit, integration, and E2E test coverage
- **Performance Monitoring**: Real-time performance tracking
- **Code Reviews**: Mandatory peer review for all changes
- **Documentation**: Thorough documentation for all systems
- **Rollback Procedures**: Quick rollback capabilities for issues

---

## Next Steps

1. **Initialize Turbo Repo**: Set up the monorepo structure
2. **Begin Phase 1**: Foundation and core infrastructure
3. **Set up development environment**: All team members ready to contribute
4. **Establish review process**: Regular milestones and quality gates
5. **Create detailed implementation tickets**: Break down each phase into actionable tasks
