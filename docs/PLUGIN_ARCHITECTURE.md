# HLStatsNext AMX Mod X Plugin Architecture

## Overview

This document outlines the technical architecture for implementing a AMX Mod X plugin that serves as the primary integration layer between HLStatsNext and game servers. The plugin provides handling both server-to-player event notifications and player-to-server commands for statistics queries, administration, and interactive features. This extends AMX commands with a sophisticated, extensible system supporting messaging, player commands (!rank, !stats), administration tools, and future enhancements.

## Table of Contents

- [Architecture Goals](#architecture-goals)
- [System Integration](#system-integration)
- [Plugin Architecture](#plugin-architecture)
- [Bidirectional Communication](#bidirectional-communication)
- [Message Format & Color System](#message-format--color-system)
- [Command Protocol](#command-protocol)
- [Player Chat Commands](#player-chat-commands)
- [Statistics Integration](#statistics-integration)
- [Development Environment](#development-environment)
- [Build System Integration](#build-system-integration)
- [Extensibility Framework](#extensibility-framework)
- [Security Considerations](#security-considerations)
- [Performance Requirements](#performance-requirements)
- [Database Integration](#database-integration)

## Architecture Goals

### Primary Objectives

1. **Replace Vanilla AMX Commands**: Replace default `amx_say` with custom `hlstatsnext_announce` and add `hlx_psay` for private messaging
2. **Enhanced Visual Experience**: Implement colored text formatting for different message components with server-specific color schemes
3. **Clean Message Format**: Remove server prefixes like `(ALL) [0x1] Public CS 1.6 Clan Server :` from messages
4. **Player Command Processing**: Handle in-game commands like `!rank`, `!stats`, `!top10` with real-time database queries
5. **Bidirectional Communication**: Process both server events and player chat commands seamlessly
6. **Statistics Integration**: Provide real-time player statistics queries and responses via private messaging
7. **Extensible Framework**: Design for future features (bans, kicks, player management, advertisements, web integration)
8. **Seamless Integration**: Integrate with existing HLStatsNext RCON command resolution system
9. **Performance Optimized**: Minimal impact on game server performance with efficient command processing

### Design Principles

- **Modular Architecture**: Separate concerns for messaging, colors, commands, chat processing, and statistics
- **Bidirectional Communication**: Handle both server-to-player events and player-to-server commands
- **Configuration-Driven**: All settings configurable through hlstatsnext.cfg file including color schemes and message formats
- **Real-time Integration**: Seamless communication with HLStatsNext daemon for live statistics
- **Backward Compatibility**: Graceful fallback to vanilla commands when plugin unavailable
- **Zero Dependencies**: Self-contained plugin with no external AMX dependencies (See backward compatibility)
- **Standards Compliant**: Follow AMX Mod X plugin development best practices
- **Performance First**: Efficient chat parsing and minimal overhead on game server

## System Integration

### Current HLStatsNext Flow

```
Game Event → Parser → Event Processor → RCON Service → Command Resolver → Server
```

### Enhanced Bidirectional Flow with Plugin

**Server-to-Player (Event Broadcasting):**

```
Game Event → Parser → Event Processor → RCON Service → Command Resolver → hlx_say Command → Colored Message → All Players
```

**Player-to-Server (Command Processing):**

```
Player Chat (!rank) → Game Logs → HLStatsNext Daemon → Chat Parser → Database Query → hlx_psay Command → hlstatsnext.amxx → Private Message
```

### Integration Points

1. **RCON Command Resolution**: The existing `CommandResolverService` will resolve to `hlx_say` instead of `amx_say`
2. **Private Messaging**: New `hlx_psay` command for targeted player communication (statistics responses)
3. **Chat Command Processing**: HLStatsNext daemon already handles chat parsing for commands like `!rank`
4. **Server Configuration**: Updated existing `servers_config` entries to use plugin commands
5. **Color Configuration**: Color schemes configured via hlstatsnext.cfg file
6. **Message Templates**: Message formats configured via hlstatsnext.cfg file
7. **Statistics Communication**: Daemon processes chat commands and sends responses via `hlx_psay`

## Plugin Architecture

### Core Components

```
hlstatsnext.amxx
├── Core Module (hlstatsnext_core.inc)
│   ├── Plugin Registration
│   ├── Configuration Management
│   └── Error Handling
├── Message Module (hlstatsnext_messages.inc)
│   ├── Message Formatting
│   ├── Color Processing
│   └── Text Parsing
├── Command Module (hlstatsnext_commands.inc)
│   ├── RCON Command Registration (hlstatsnext_announce, hlx_psay)
│   ├── Parameter Validation
│   └── Command Execution
├── Statistics Module (hlstatsnext_stats.inc)
│   ├── Statistics Message Formatting
│   ├── Rank Response Processing
│   └── Private Message Handling
├── Color Module (hlstatsnext_colors.inc)
│   ├── Color Code Management
│   ├── Team Color Mapping
│   └── Custom Color Schemes
└── Utility Module (hlstatsnext_util.inc)
    ├── String Processing
    ├── Player Utilities
    └── Debug Logging
```

### Module Structure

#### Core Module (`hlstatsnext_core.inc`)

```pawn
// Plugin information and registration
#define PLUGIN_NAME "HLStatsNext"
#define PLUGIN_VERSION "1.0.0"
#define PLUGIN_AUTHOR "HLStatsNext Team"

// Configuration constants
#define MAX_MESSAGE_LENGTH 191
#define MAX_COLOR_CODE_LENGTH 4
#define MAX_PLAYERS 32

// Plugin states
enum PluginState {
    STATE_LOADING,
    STATE_ACTIVE,
    STATE_ERROR,
    STATE_DISABLED
}

// Core plugin lifecycle
public plugin_init();
public plugin_cfg();
public plugin_end();
public client_connect(id);
public client_disconnect(id);
```

#### Message Module (`hlstatsnext_messages.inc`)

```pawn
// Message types
enum MessageType {
    MSG_KILL,
    MSG_DEATH,
    MSG_SUICIDE,
    MSG_TEAMKILL,
    MSG_ACTION,
    MSG_CONNECT,
    MSG_DISCONNECT,
    MSG_CUSTOM
}

// Message formatting functions
stock format_hlstatsnext_message(const message[], const killer_name[], const victim_name[], points);
stock apply_color_formatting(const text[], const color_scheme[]);
stock strip_server_prefix(const raw_message[], output[], maxlen);
```

#### Command Module (`hlstatsnext_commands.inc`)

```pawn
// Command registration
public register_hlstatsnext_commands();

// Primary commands
public cmd_hlstatsnext_announce(id, level, cid);
public cmd_hlstatsnext_say(id, level, cid);
public cmd_hlstatsnext_tell(id, level, cid);

// Future extensibility commands
public cmd_hlstatsnext_ban(id, level, cid);
public cmd_hlstatsnext_kick(id, level, cid);
public cmd_hlstatsnext_mute(id, level, cid);
```

#### Color Module (`hlstatsnext_colors.inc`)

```pawn
// Color scheme structure
enum ColorScheme {
    COLOR_TAG[4],        // [HLStatsNext] - Default: Green (^2)
    COLOR_KILLER[4],     // Killer name - Default: Red (^1)
    COLOR_VICTIM[4],     // Victim name - Default: Blue (^4)
    COLOR_POINTS[4],     // Points - Dynamic based on positive/negative
    COLOR_ACTION[4],     // Action text - Default: Cyan (^6)
    COLOR_RESET[4]       // Reset color - Default: White (^0)
}

// Color functions
stock get_color_scheme(ColorScheme scheme);
stock apply_team_colors(const name[], const team[], output[], maxlen);
stock get_dynamic_point_color(points);
```

## Message Format & Color System

### Current Format (with amx_say)

```
(ALL) [0x1] Public CS 1.6 Clan Server : [HLStatsNext]: Gilroy (1091) got -2 points for Dropped The Bomb
```

### New Format (with hlstatsnext_announce)

```
^2[HLStatsNext]^0: ^1Gilroy^0 (1091) got ^1-2^0 points for Dropped The Bomb
```

### Color Code Mapping

| Component       | Color | AMX Code | Description                 |
| --------------- | ----- | -------- | --------------------------- |
| Tag             | Green | `^2`     | [HLStatsNext] prefix        |
| Killer          | Red   | `^1`     | Player who performed action |
| Victim          | Blue  | `^4`     | Target of action            |
| Positive Points | Green | `^2`     | Points gained               |
| Negative Points | Red   | `^1`     | Points lost                 |
| Action          | Cyan  | `^6`     | Action description          |
| Reset           | White | `^0`     | Default text color          |

### Configurable Color Schemes

```pawn
// Default color scheme
new const DefaultColors[ColorScheme] = {
    "^2",  // COLOR_TAG - Green
    "^1",  // COLOR_KILLER - Red
    "^4",  // COLOR_VICTIM - Blue
    "",    // COLOR_POINTS - Dynamic
    "^6",  // COLOR_ACTION - Cyan
    "^0"   // COLOR_RESET - White
}

// Alternative schemes can be defined for different servers
new const AlternativeColors[ColorScheme] = {
    "^3",  // COLOR_TAG - Yellow
    "^1",  // COLOR_KILLER - Red
    "^4",  // COLOR_VICTIM - Blue
    "",    // COLOR_POINTS - Dynamic
    "^2",  // COLOR_ACTION - Green
    "^0"   // COLOR_RESET - White
}
```

## Player Chat Commands

### Chat Command Processing

The HLStatsNext daemon already includes comprehensive chat parsing capabilities. When players type commands like `!rank`, the daemon:

1. **Detects Chat Events**: Monitors game logs for player chat messages
2. **Parses Commands**: Identifies commands starting with `!` or `/`
3. **Processes Requests**: Queries database for player statistics
4. **Sends Response**: Uses RCON to send `hlx_psay` command to plugin
5. **Delivers Message**: Plugin formats and delivers colored private message

### Supported Commands

The plugin will handle responses for these daemon-processed commands:

- **`!rank`**: Player ranking and skill information
- **`!stats`**: Detailed player statistics
- **`!top10`**: Server top 10 players
- **`!session`**: Current session statistics
- **`!hlx`**: Link to web-based statistics
- **`!help`**: Shows available commands

### Example Flow

```
1. Player types: "!rank"
2. HLStatsNext daemon (`apps/daemon`) detects chat command
3. Daemon queries database: SELECT rank, skill FROM players WHERE playerId = X
4. Daemon sends RCON: hlx_psay 5 "You're rank 1 of 1,243 players with a skill of 2,103"
5. Plugin formats message with colors and sends privately to player
```

## Command Protocol

### Primary Commands

#### hlstatsnext_announce

**Purpose**: Public announcements to all players
**Usage**: `hlstatsnext_announce "<message>"`
**Example**: `hlstatsnext_announce "[HLStatsNext]: Match starting in 30 seconds"`

#### hlstatsnext_say

**Purpose**: General messaging (public chat)
**Usage**: `hlstatsnext_say "<message>"`
**Example**: `hlstatsnext_say "Server restart in 5 minutes"`

#### hlstatsnext_tell

**Purpose**: Private messaging to specific players
**Usage**: `hlstatsnext_tell <userid> "<message>"`
**Example**: `hlstatsnext_tell 5 "Welcome to the server!"`

#### hlx_psay

**Purpose**: Private messaging with colored formatting (primary method for statistics responses)
**Usage**: `hlx_psay <userid> "<message>"`
**Example**: `hlx_psay 5 "^2[HLStatsNext]^0: You're rank ^3#1^0 of ^31,243^0 players with a skill of ^22,103^0"`

### Message Processing Pipeline

```pawn
public cmd_hlstatsnext_announce(id, level, cid) {
    // 1. Validate command access
    if (!cmd_access(id, level, cid, 1)) {
        return PLUGIN_HANDLED;
    }

    // 2. Parse message from parameters
    new message[MAX_MESSAGE_LENGTH];
    read_args(message, charsmax(message));
    remove_quotes(message);

    // 3. Process message formatting
    new formatted_message[MAX_MESSAGE_LENGTH];
    format_hlstatsnext_message(message, "", "", 0, formatted_message, charsmax(formatted_message));

    // 4. Apply color formatting
    new colored_message[MAX_MESSAGE_LENGTH];
    apply_color_formatting(formatted_message, colored_message, charsmax(colored_message));

    // 5. Send to all players
    client_print(0, print_chat, colored_message);

    return PLUGIN_HANDLED;
}
```

### Command Registration in HLStatsNext

The HLStatsNext daemon will be configured to use the new plugin commands through the existing server configuration system:

```
-- Existing configuration parameters that will be updated to use hlstatsnext plugin:
-- BroadCastEventsCommandAnnounce: hlstatsnext_announce (public announcements)
-- BroadCastEventsCommand: hlx_psay (event notifications to players)
-- PlayerEventsCommand: hlx_psay (private player messages, including !rank responses)
-- PlayerEventsCommandHint: hlx_psay (optional, for hint-style messages)
-- PlayerEventsCommandOSD: hlx_psay (optional, for on-screen display messages)
-- EnablePublicCommands: Controls whether public commands are allowed

-- Database configuration will be updated manually by administrators
```

## Statistics Integration

### Integration with Existing Systems

The plugin seamlessly integrates with HLStatsNext's existing chat command processing and statistics systems. The daemon already handles:

- **Chat Parsing**: Detecting player commands in game logs
- **Database Queries**: Retrieving player statistics and rankings
- **Command Processing**: Validating and processing player requests

### Plugin Responsibilities

The plugin focuses solely on **output formatting and delivery**:

1. **Command Registration**: Register `hlx_psay` as an RCON command
2. **Message Formatting**: Apply colors and formatting to statistics responses
3. **Private Delivery**: Send formatted messages privately to requesting players
4. **Color Management**: Use server-specific color schemes for consistent branding

### Statistics Message Types

#### Rank Response

```pawn
// Input: hlx_psay 5 "You're rank 1 of 1,243 players with a skill of 2,103"
// Output: ^2[HLStatsNext]^0: You're rank ^3#1^0 of ^31,243^0 players with a skill of ^22,103^0
```

#### Stats Response

```pawn
// Input: hlx_psay 5 "K/D: 2.5 | Accuracy: 75% | Headshots: 25%"
// Output: ^2[HLStatsNext]^0: K/D: ^22.5^0 | Accuracy: ^275%^0 | Headshots: ^625%^0
```

#### Top10 Response

```pawn
// Input: hlx_psay 5 "Top 10: 1. ProGamer (2500) 2. Elite (2400) 3. Skilled (2300)"
// Output: ^2[HLStatsNext]^0: Top 10: ^31. ^1ProGamer^0 (^22500^0) ^32. ^1Elite^0 (^22400^0)...
```

### Configuration Integration

The plugin uses a simple configuration approach:

**Database Configuration (existing parameters):**

```
-- Command mapping (updated manually by administrators):
-- BroadCastEventsCommandAnnounce: hlstatsnext_announce
-- BroadCastEventsCommand: hlx_psay
-- PlayerEventsCommand: hlx_psay
-- EnablePublicCommands: Controls whether public commands are allowed
```

**File Configuration (hlstatsnext.cfg):**

```
-- Color schemes, message formats, and plugin-specific settings
-- Rarely changed, stored in config file for simplicity
```

## Development Environment

### Monorepo Integration

The plugin development will be integrated into the existing monorepo structure:

```
packages/
├── plugins/                            # New plugin package
│   ├── amx/                            # AMX Mod X plugins
│   │   ├── hlstatsnext/                # Main HLStatsNext plugin
│   │   ├── src/                        # Source files
│   │   │   ├── hlstatsnext.sma
│   │   │   ├── include/
│   │   │   │   ├── hlstatsnext_core.inc
│   │   │   │   ├── hlstatsnext_messages.inc
│   │   │   │   ├── hlstatsnext_commands.inc
│   │   │   │   ├── hlstatsnext_colors.inc
│   │   │   │   └── hlstatsnext_util.inc
│   │   │   ├── configs/
│   │   │   │   └── hlstatsnext.cfg
│   │   │   ├── compiled/               # Compiled .amxx files
│   │   │   ├── tests/                  # Plugin tests
│   │   │   ├── docs/                   # Plugin documentation
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   └── common/                     # Shared includes/utilities
│   └── other-plugins/                  # Future plugin directories
```

### Build System

#### Package Configuration (`packages/plugins/amx/hlstatsnext/package.json`)

```json
{
  "name": "@repo/plugins-amx-hlstatsnext",
  "version": "1.0.0",
  "private": true,
  "description": "HLStatsNext AMX Mod X Plugin",
  "scripts": {
    "build": "pnpm run compile",
    "compile": "amxxpc hlstatsnext.sma -o../compiled/hlstatsnext.amxx",
    "clean": "rm -rf compiled/*.amxx",
    "test": "echo 'Plugin tests not yet implemented'",
    "dev": "pnpm run compile && pnpm run deploy:dev",
    "deploy:dev": "cp compiled/hlstatsnext.amxx /path/to/dev/server/addons/amxmodx/plugins/",
    "package": "tar -czf hlstatsnext-plugin.tar.gz compiled/ configs/",
    "lint": "echo 'Pawn linting not configured'"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*"
  },
  "keywords": ["amx", "plugin", "hlstatsnext", "counter-strike"],
  "license": "PROPRIETARY"
}
```

#### Turbo Configuration Updates

```json
// turbo.json additions
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["compiled/**"]
    },
    "compile": {
      "outputs": ["compiled/**"],
      "cache": false
    }
  }
}
```

### Development Tools

#### AMX Mod X Compiler Setup

```bash
# Install AMX Mod X compiler (amxxpc)
# This would be documented in the implementation guide
# Platform-specific installation instructions
```

#### VS Code Integration

```json
// .vscode/settings.json additions
{
  "files.associations": {
    "*.sma": "c",
    "*.inc": "c"
  },
  "editor.tabSize": 4,
  "editor.insertSpaces": false
}
```

## Extensibility Framework

### Plugin Module System

The plugin is designed with a modular architecture to support future extensions:

```pawn
// Module registration system
enum ModuleType {
    MODULE_MESSAGING,
    MODULE_ADMINISTRATION,
    MODULE_STATISTICS,
    MODULE_CUSTOM
}

// Module interface
public register_module(ModuleType type, const name[], const version[]);
public module_init(ModuleType type);
public module_shutdown(ModuleType type);
```

### Future Feature Modules

#### Administration Module

```pawn
// hlstatsnext_admin.inc
public cmd_hlstatsnext_ban(id, level, cid);
public cmd_hlstatsnext_kick(id, level, cid);
public cmd_hlstatsnext_mute(id, level, cid);
public cmd_hlstatsnext_gag(id, level, cid);
```

#### Statistics Module

```pawn
// hlstatsnext_stats.inc
public cmd_hlstatsnext_rank(id, level, cid);
public cmd_hlstatsnext_top10(id, level, cid);
public cmd_hlstatsnext_stats(id, level, cid);
public cmd_hlstatsnext_session(id, level, cid);
```

#### Player Management Module

```pawn
// hlstatsnext_players.inc
public cmd_hlstatsnext_who(id, level, cid);
public cmd_hlstatsnext_teams(id, level, cid);
public cmd_hlstatsnext_switch(id, level, cid);
```

## Security Considerations

### Input Validation

```pawn
// Message sanitization
stock bool:validate_message(const message[]) {
    // Check message length
    if (strlen(message) > MAX_MESSAGE_LENGTH) {
        return false;
    }

    // Check for malicious characters
    if (containi(message, ";") != -1 || containi(message, "|") != -1) {
        return false;
    }

    // Check for command injection
    if (containi(message, "rcon") != -1) {
        return false;
    }

    return true;
}

// Parameter sanitization
stock sanitize_parameter(const input[], output[], maxlen) {
    new len = strlen(input);
    new pos = 0;

    for (new i = 0; i < len && pos < maxlen - 1; i++) {
        if (input[i] != ';' && input[i] != '|' && input[i] != '`') {
            output[pos++] = input[i];
        }
    }
    output[pos] = EOS;
}
```

### Access Control

```pawn
// Permission levels
#define ACCESS_PUBLIC      0
#define ACCESS_PLAYER      ADMIN_ALL
#define ACCESS_MODERATOR   ADMIN_KICK | ADMIN_BAN
#define ACCESS_ADMIN       ADMIN_RCON

// Command access validation
stock bool:validate_command_access(id, required_access) {
    if (required_access == ACCESS_PUBLIC) {
        return true;
    }

    if (!is_user_connected(id)) {
        return false;
    }

    new user_flags = get_user_flags(id);
    return (user_flags & required_access) == required_access;
}
```

## Performance Requirements

### Optimization Guidelines

1. **Memory Management**: Minimize dynamic allocations, use stack variables where possible
2. **String Operations**: Use efficient string manipulation functions
3. **Loop Optimization**: Avoid nested loops in message processing
4. **Caching**: Cache color schemes and configurations

### Performance Benchmarks

- **Message Processing**: < 1ms per message
- **Memory Usage**: < 128KB additional memory
- **Command Execution**: < 0.5ms response time
- **Server Impact**: < 1% CPU usage during peak activity

### Resource Monitoring

```pawn
// Performance monitoring
public monitor_performance() {
    static last_check = 0;
    new current_time = get_systime();

    if (current_time - last_check >= 60) { // Check every minute
        new Float:cpu_usage = get_plugin_cpu_usage();
        new memory_usage = get_plugin_memory_usage();

        log_amx("[HLStatsNext] Performance: CPU: %.2f%%, Memory: %d KB",
                cpu_usage, memory_usage / 1024);

        last_check = current_time;
    }
}
```

## Database Integration

### Configuration Schema

The plugin integrates with the existing HLStatsNext database schema through the server configuration system:

```
-- Database Configuration (existing parameters, updated manually):
-- BroadCastEventsCommandAnnounce: hlstatsnext_announce (public announcements)
-- BroadCastEventsCommand: hlx_psay (event notifications)
-- PlayerEventsCommand: hlx_psay (private player messages)
-- EnablePublicCommands: Controls whether public commands are allowed

-- File Configuration (hlstatsnext.cfg):
-- Color schemes, message formats, debug settings, performance options
-- Simpler approach for settings that rarely change
```

### Configuration Loading

```pawn
// Configuration structure
enum HLStatsNextConfig {
    bool:enabled,
    bool:colors_enabled,
    color_scheme[32],
    tag_color[4],
    killer_color[4],
    victim_color[4],
    action_color[4],
    points_positive_color[4],
    points_negative_color[4],
    reset_color[4],
    bool:debug_mode,
    log_level[16]
}

new g_config[HLStatsNextConfig];

// Load configuration from server
public load_configuration() {
    // Configuration would be loaded via RCON queries or config files
    // This integrates with the existing HLStatsNext configuration system
}
```

## Testing Strategy

### Unit Testing

```pawn
// Test framework for plugin functions
public test_message_formatting() {
    new input[] = "Test message with killer victim +5";
    new expected[] = "^2[HLStatsNext]^0: ^1killer^0 eliminated ^4victim^0 (^2+5^0 points)";
    new result[MAX_MESSAGE_LENGTH];

    format_hlstatsnext_message(input, "killer", "victim", 5, result, charsmax(result));

    if (equal(result, expected)) {
        log_amx("[TEST] Message formatting: PASSED");
    } else {
        log_amx("[TEST] Message formatting: FAILED - Expected: %s, Got: %s", expected, result);
    }
}

public test_color_formatting() {
    // Test color code application
    new input[] = "^2Green^0 ^1Red^0 ^4Blue^0";
    new result[MAX_MESSAGE_LENGTH];

    apply_color_formatting(input, result, charsmax(result));

    // Verify color codes are properly applied
    if (containi(result, "^2") != -1 && containi(result, "^1") != -1 && containi(result, "^4") != -1) {
        log_amx("[TEST] Color formatting: PASSED");
    } else {
        log_amx("[TEST] Color formatting: FAILED");
    }
}
```

### Integration Testing

```pawn
// Integration tests with game server
public test_integration() {
    // Test command registration
    test_command_registration();

    // Test message delivery
    test_message_delivery();

    // Test color display
    test_color_display();

    // Test configuration loading
    test_configuration_loading();
}
```

## Deployment Considerations

### Installation Requirements

1. **AMX Mod X**: Version 1.8.2 or higher
2. **Game Server**: Counter-Strike 1.6, Condition Zero, or other GoldSrc games
3. **HLStatsNext**: Compatible daemon version with updated RCON commands

### Installation Process

1. Copy `hlstatsnext.amxx` to `addons/amxmodx/plugins/`
2. Add `hlstatsnext.amxx` to `plugins.ini`
3. Copy `hlstatsnext.cfg` to `addons/amxmodx/configs/`
4. Update HLStatsNext database configuration
5. Restart game server

### Monitoring and Maintenance

```pawn
// Health check functionality
public health_check() {
    new status[256];
    format(status, charsmax(status),
           "[HLStatsNext] Status: %s | Version: %s | Commands: %d | Messages: %d",
           g_config[enabled] ? "Active" : "Inactive",
           PLUGIN_VERSION,
           get_registered_commands_count(),
           get_messages_processed_count());

    log_amx(status);
    return status;
}
```

This architecture provides a solid foundation for implementing a sophisticated, extensible AMX Mod X plugin that enhances the HLStatsNext messaging system while maintaining compatibility with the existing codebase and providing a framework for future enhancements.
