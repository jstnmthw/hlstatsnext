# HLStatsNext AMX Mod X Plugin Implementation Guide

## Getting Started

This guide provides step-by-step instructions for implementing the HLStatsNext AMX Mod X plugin based on the technical architecture outlined in [`PLUGIN_ARCHITECTURE.md`](./PLUGIN_ARCHITECTURE.md). Follow this guide to set up the development environment, create the plugin structure, and integrate it with your existing HLStatsNext system.

## Prerequisites

### System Requirements

- **Node.js**: Version 24.0.0 or higher (as required by the monorepo)
- **pnpm**: Version 10.x (project package manager)
- **AMX Mod X**: Version 1.8.2 or higher
- **AMX Mod X Compiler**: `amxxpc` for compiling `.sma` files to `.amxx`
- **Game Server**: Counter-Strike 1.6, Condition Zero, or compatible GoldSrc game
- **HLStatsNext**: Working installation with RCON functionality

### Knowledge Requirements

- Basic understanding of AMX Mod X plugin development
- Familiarity with Pawn scripting language
- Understanding of the HLStatsNext codebase structure
- Knowledge of Counter-Strike game mechanics and RCON commands

## Step 1: Set Up Development Environment

### 1.1 Install AMX Mod X Development Tools

```bash
# Download AMX Mod X Developer Package
# Visit: https://www.amxmodx.org/downloads-new.php
# Download "AMX Mod X 1.8.2 - Developer Package"

# Extract to a development directory
mkdir -p ~/amxmodx-dev
cd ~/amxmodx-dev
# Extract the downloaded package here

# Add amxxpc to your PATH (Linux/macOS)
export PATH=$PATH:~/amxmodx-dev/addons/amxmodx/scripting
echo 'export PATH=$PATH:~/amxmodx-dev/addons/amxmodx/scripting' >> ~/.bashrc

# For Windows, add the scripting directory to your system PATH
```

### 1.2 Verify AMX Mod X Compiler Installation

```bash
# Test the compiler
amxxpc --version
# Should output: AMX Mod X Compiler 1.8.2-manual
```

### 1.3 Set Up Monorepo Plugin Structure

```bash
# Navigate to your HLStatsNext project root
cd /path/to/hlstatsnext.com

# Create the plugin package structure
mkdir -p packages/plugins/amx/src/include
mkdir -p packages/plugins/amx/compiled
mkdir -p packages/plugins/amx/configs
mkdir -p packages/plugins/amx/tests
mkdir -p packages/plugins/amx/docs
mkdir -p packages/plugins/amx/common/include
```

## Step 2: Create Package Configuration

### 2.1 Create Package.json

Create `packages/plugins/amx/package.json`:

```json
{
  "name": "@repo/plugins-amx",
  "version": "1.0.0",
  "private": true,
  "description": "HLStatsNext AMX Mod X Plugin for enhanced game server messaging",
  "main": "compiled/hlstatsnext.amxx",
  "scripts": {
    "build": "pnpm run compile",
    "compile": "pnpm run compile:plugin",
    "compile:plugin": "amxxpc src/hlstatsnext.sma -iinclude -iaddons/amxmodx/scripting/include -o=compiled/hlstatsnext.amxx",
    "clean": "rm -rf compiled/*.amxx",
    "test": "echo 'Plugin tests not yet implemented'",
    "dev": "pnpm run compile && pnpm run deploy:dev",
    "package": "pnpm run compile && tar -czf hlstatsnext-plugin-v$npm_package_version.tar.gz compiled/ configs/ docs/",
    "lint": "echo 'Pawn linting not configured - consider using manual code review'",
    "validate": "pnpm run compile && echo 'Plugin compiled successfully'"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*"
  },
  "files": ["compiled/", "configs/", "docs/", "README.md"],
  "keywords": [
    "amx",
    "amxmodx",
    "plugin",
    "hlstatsnext",
    "counter-strike",
    "goldsrc",
    "game-server"
  ],
  "license": "PROPRIETARY",
  "engines": {
    "node": ">=24.0.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/hlstatsnext.com",
    "directory": "packages/plugins/amx/hlstatsnext"
  }
}
```

### 2.2 Update Root Package.json

Add the plugin package to the root `package.json` workspaces:

```json
{
  "pnpm": {
    "peerDependencyRules": {
      "allowedVersions": {
        "@prisma/client": "6.16.2",
        "prisma": "6.16.2"
      }
    },
    "overrides": {
      "@repo/plugins-amx-hlstatsnext": "workspace:*"
    }
  }
}
```

### 2.3 Update Turbo Configuration

Add plugin build configuration to `turbo.json`:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "compiled/**"]
    },
    "compile": {
      "outputs": ["compiled/**"],
      "cache": false,
      "persistent": false
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

## Step 3: Implement Core Plugin Files

### 3.1 Create Main Plugin File

Create `packages/plugins/amx/hlstatsnext/src/hlstatsnext.sma`:

```pawn
/*
 * HLStatsNext AMX Mod X Plugin
 *
 * Enhanced messaging system for HLStatsNext game statistics
 * Replaces vanilla amx_say with colored, formatted messages
 *
 * Author: HLStatsNext Team
 * Version: 1.0.0
 *
 * This plugin provides:
 * - Colored message formatting
 * - Clean message display (removes server prefixes)
 * - Extensible command system
 * - Integration with HLStatsNext daemon
 */

#include <amxmodx>
#include <amxmisc>

// Include our custom modules
#include "include/hlstatsnext_core.inc"
#include "include/hlstatsnext_colors.inc"
#include "include/hlstatsnext_messages.inc"
#include "include/hlstatsnext_commands.inc"
#include "include/hlstatsnext_util.inc"

// Plugin information
#define PLUGIN_NAME "HLStatsNext"
#define PLUGIN_VERSION "1.0.0"
#define PLUGIN_AUTHOR "HLStatsNext Team"

// Plugin lifecycle
public plugin_init() {
    // Register plugin
    register_plugin(PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_AUTHOR);

    // Initialize core systems
    hlstatsnext_core_init();
    hlstatsnext_colors_init();
    hlstatsnext_messages_init();
    hlstatsnext_commands_init();

    // Register our commands
    register_hlstatsnext_commands();

    // Log plugin initialization
    log_amx("[%s] Plugin initialized successfully (v%s)", PLUGIN_NAME, PLUGIN_VERSION);

    return PLUGIN_CONTINUE;
}

public plugin_cfg() {
    // Load configuration after server config is loaded
    hlstatsnext_load_config();

    return PLUGIN_CONTINUE;
}

public plugin_end() {
    // Cleanup
    hlstatsnext_cleanup();
    log_amx("[%s] Plugin terminated", PLUGIN_NAME);
}

// Client connection events
public client_connect(id) {
    hlstatsnext_client_connect(id);
}

public client_disconnect(id) {
    hlstatsnext_client_disconnect(id);
}
```

### 3.2 Create Core Include File

Create `packages/plugins/amx/hlstatsnext/src/include/hlstatsnext_core.inc`:

```pawn
/*
 * HLStatsNext Core Module
 *
 * Core functionality and plugin lifecycle management
 */

#if defined _hlstatsnext_core_included
    #endinput
#endif
#define _hlstatsnext_core_included

// Core constants
#define HLSTATSNEXT_MAX_MESSAGE_LENGTH 191
#define HLSTATSNEXT_MAX_PLAYERS 32
#define HLSTATSNEXT_CONFIG_FILE "hlstatsnext.cfg"

// Plugin state
enum HLStatsNextState {
    STATE_LOADING,
    STATE_ACTIVE,
    STATE_ERROR,
    STATE_DISABLED
}

// Global state variables
new HLStatsNextState:g_plugin_state = STATE_LOADING;
new bool:g_plugin_enabled = true;
new bool:g_debug_mode = false;
new g_server_id = 0;

// Core initialization
stock hlstatsnext_core_init() {
    g_plugin_state = STATE_LOADING;

    // Set default values
    g_plugin_enabled = true;
    g_debug_mode = false;

    log_amx("[HLStatsNext] Core initialized");
}

// Configuration loading
stock hlstatsnext_load_config() {
    new config_file[128];
    get_configsdir(config_file, charsmax(config_file));
    format(config_file, charsmax(config_file), "%s/%s", config_file, HLSTATSNEXT_CONFIG_FILE);

    if (file_exists(config_file)) {
        // Load configuration from file
        load_config_file(config_file);
        log_amx("[HLStatsNext] Configuration loaded from %s", config_file);
    } else {
        log_amx("[HLStatsNext] Configuration file not found, using defaults");
    }

    g_plugin_state = g_plugin_enabled ? STATE_ACTIVE : STATE_DISABLED;
}

// Configuration file parser
stock load_config_file(const config_file[]) {
    new file = fopen(config_file, "rt");
    if (!file) {
        return;
    }

    new line[256], key[64], value[192];

    while (fgets(file, line, charsmax(line))) {
        trim(line);

        // Skip comments and empty lines
        if (line[0] == '/' && line[1] == '/' || line[0] == '#' || line[0] == EOS) {
            continue;
        }

        // Parse key=value pairs
        if (parse(line, key, charsmax(key), value, charsmax(value)) == 2) {
            process_config_option(key, value);
        }
    }

    fclose(file);
}

// Process individual configuration options
stock process_config_option(const key[], const value[]) {
    if (equal(key, "hlstatsnext_enabled")) {
        g_plugin_enabled = bool:str_to_num(value);
    } else if (equal(key, "hlstatsnext_debug")) {
        g_debug_mode = bool:str_to_num(value);
    } else if (equal(key, "hlstatsnext_server_id")) {
        g_server_id = str_to_num(value);
    }
    // Add more configuration options as needed
}

// Client event handlers
stock hlstatsnext_client_connect(id) {
    if (g_debug_mode) {
        new name[32];
        get_user_name(id, name, charsmax(name));
        log_amx("[HLStatsNext] Client connected: %s (ID: %d)", name, id);
    }
}

stock hlstatsnext_client_disconnect(id) {
    if (g_debug_mode) {
        new name[32];
        get_user_name(id, name, charsmax(name));
        log_amx("[HLStatsNext] Client disconnected: %s (ID: %d)", name, id);
    }
}

// Cleanup function
stock hlstatsnext_cleanup() {
    g_plugin_state = STATE_DISABLED;
    log_amx("[HLStatsNext] Core cleanup completed");
}

// Utility functions
stock bool:is_plugin_active() {
    return g_plugin_state == STATE_ACTIVE;
}

stock bool:is_debug_enabled() {
    return g_debug_mode;
}

stock get_server_id() {
    return g_server_id;
}
```

### 3.3 Create Color Management Include

Create `packages/plugins/amx/hlstatsnext/src/include/hlstatsnext_colors.inc`:

```pawn
/*
 * HLStatsNext Color Module
 *
 * Handles color formatting and schemes for messages
 */

#if defined _hlstatsnext_colors_included
    #endinput
#endif
#define _hlstatsnext_colors_included

// Color scheme structure
enum ColorScheme {
    COLOR_TAG[4],        // [HLStatsNext] tag color
    COLOR_KILLER[4],     // Killer name color
    COLOR_VICTIM[4],     // Victim name color
    COLOR_POINTS_POS[4], // Positive points color
    COLOR_POINTS_NEG[4], // Negative points color
    COLOR_ACTION[4],     // Action text color
    COLOR_RESET[4]       // Reset/default color
}

// Default color scheme (green tag, red killer, blue victim)
new const g_default_colors[ColorScheme] = {
    "^2",  // Green for [HLStatsNext]
    "^1",  // Red for killer
    "^4",  // Blue for victim
    "^2",  // Green for positive points
    "^1",  // Red for negative points
    "^6",  // Cyan for actions
    "^0"   // White/default for reset
};

// Current active color scheme
new g_current_colors[ColorScheme];
new bool:g_colors_enabled = true;

// Color initialization
stock hlstatsnext_colors_init() {
    // Copy default colors to current scheme
    copy_color_scheme(g_default_colors, g_current_colors);
    g_colors_enabled = true;

    log_amx("[HLStatsNext] Color system initialized");
}

// Copy color scheme
stock copy_color_scheme(const source[ColorScheme], dest[ColorScheme]) {
    copy(dest[COLOR_TAG], charsmax(dest[COLOR_TAG]), source[COLOR_TAG]);
    copy(dest[COLOR_KILLER], charsmax(dest[COLOR_KILLER]), source[COLOR_KILLER]);
    copy(dest[COLOR_VICTIM], charsmax(dest[COLOR_VICTIM]), source[COLOR_VICTIM]);
    copy(dest[COLOR_POINTS_POS], charsmax(dest[COLOR_POINTS_POS]), source[COLOR_POINTS_POS]);
    copy(dest[COLOR_POINTS_NEG], charsmax(dest[COLOR_POINTS_NEG]), source[COLOR_POINTS_NEG]);
    copy(dest[COLOR_ACTION], charsmax(dest[COLOR_ACTION]), source[COLOR_ACTION]);
    copy(dest[COLOR_RESET], charsmax(dest[COLOR_RESET]), source[COLOR_RESET]);
}

// Format colored text components
stock format_colored_tag(output[], maxlen) {
    if (g_colors_enabled) {
        format(output, maxlen, "%s[HLStatsNext]%s",
               g_current_colors[COLOR_TAG],
               g_current_colors[COLOR_RESET]);
    } else {
        copy(output, maxlen, "[HLStatsNext]");
    }
}

stock format_colored_player(const name[], output[], maxlen, bool:is_killer = false) {
    if (g_colors_enabled) {
        new color[] = is_killer ? g_current_colors[COLOR_KILLER] : g_current_colors[COLOR_VICTIM];
        format(output, maxlen, "%s%s%s", color, name, g_current_colors[COLOR_RESET]);
    } else {
        copy(output, maxlen, name);
    }
}

stock format_colored_points(points, output[], maxlen) {
    new points_text[16];
    if (points > 0) {
        format(points_text, charsmax(points_text), "+%d", points);
    } else {
        format(points_text, charsmax(points_text), "%d", points);
    }

    if (g_colors_enabled) {
        new color[] = points > 0 ? g_current_colors[COLOR_POINTS_POS] : g_current_colors[COLOR_POINTS_NEG];
        format(output, maxlen, "%s%s%s", color, points_text, g_current_colors[COLOR_RESET]);
    } else {
        copy(output, maxlen, points_text);
    }
}

stock format_colored_action(const action[], output[], maxlen) {
    if (g_colors_enabled) {
        format(output, maxlen, "%s%s%s",
               g_current_colors[COLOR_ACTION],
               action,
               g_current_colors[COLOR_RESET]);
    } else {
        copy(output, maxlen, action);
    }
}

// Team-specific color formatting
stock get_team_color(CsTeams:team, output[], maxlen) {
    switch (team) {
        case CS_TEAM_T: {
            copy(output, maxlen, "^1"); // Red for terrorists
        }
        case CS_TEAM_CT: {
            copy(output, maxlen, "^4"); // Blue for counter-terrorists
        }
        case CS_TEAM_SPECTATOR: {
            copy(output, maxlen, "^8"); // Gray for spectators
        }
        default: {
            copy(output, maxlen, "^0"); // Default/white
        }
    }
}

// Configuration functions
stock set_colors_enabled(bool:enabled) {
    g_colors_enabled = enabled;
}

stock bool:are_colors_enabled() {
    return g_colors_enabled;
}

// Load color scheme from configuration file
stock load_color_scheme(const scheme_name[]) {
    // Load color scheme from hlstatsnext.cfg
    if (equal(scheme_name, "alternative")) {
        copy_color_scheme(g_alternative_colors, g_current_colors);
    } else {
        copy_color_scheme(g_default_colors, g_current_colors);
    }

    log_amx("[HLStatsNext] Color scheme loaded: %s", scheme_name);
}
```

### 3.4 Create Message Formatting Include

Create `packages/plugins/amx/hlstatsnext/src/include/hlstatsnext_messages.inc`:

```pawn
/*
 * HLStatsNext Message Module
 *
 * Handles message formatting and processing
 */

#if defined _hlstatsnext_messages_included
    #endinput
#endif
#define _hlstatsnext_messages_included

// Message type enumeration
enum MessageType {
    MSG_KILL,
    MSG_SUICIDE,
    MSG_TEAMKILL,
    MSG_ACTION,
    MSG_CONNECT,
    MSG_DISCONNECT,
    MSG_GENERAL
}

// Message formatting data structure
enum MessageData {
    MessageType:msg_type,
    killer_name[32],
    victim_name[32],
    action_text[64],
    points,
    bool:has_points
}

// Message module initialization
stock hlstatsnext_messages_init() {
    log_amx("[HLStatsNext] Message system initialized");
}

// Main message formatting function
stock format_hlstatsnext_message(const raw_message[], output[], maxlen) {
    new MessageData:data;

    // Parse the raw message to extract components
    parse_message_data(raw_message, data);

    // Format the message based on type
    switch (data[msg_type]) {
        case MSG_KILL: {
            format_kill_message(data, output, maxlen);
        }
        case MSG_SUICIDE: {
            format_suicide_message(data, output, maxlen);
        }
        case MSG_TEAMKILL: {
            format_teamkill_message(data, output, maxlen);
        }
        case MSG_ACTION: {
            format_action_message(data, output, maxlen);
        }
        case MSG_CONNECT: {
            format_connect_message(data, output, maxlen);
        }
        case MSG_DISCONNECT: {
            format_disconnect_message(data, output, maxlen);
        }
        default: {
            format_general_message(raw_message, output, maxlen);
        }
    }
}

// Parse message data from raw input
stock parse_message_data(const raw_message[], MessageData:data) {
    // Initialize data
    data[msg_type] = MSG_GENERAL;
    data[killer_name][0] = EOS;
    data[victim_name][0] = EOS;
    data[action_text][0] = EOS;
    data[points] = 0;
    data[has_points] = false;

    // Simple parsing logic - this would be enhanced based on actual message formats
    if (containi(raw_message, "killed") != -1) {
        data[msg_type] = MSG_KILL;
        parse_kill_data(raw_message, data);
    } else if (containi(raw_message, "suicide") != -1) {
        data[msg_type] = MSG_SUICIDE;
        parse_suicide_data(raw_message, data);
    } else if (containi(raw_message, "points") != -1) {
        data[msg_type] = MSG_ACTION;
        parse_action_data(raw_message, data);
    }
    // Add more parsing logic as needed
}

// Parse kill event data
stock parse_kill_data(const raw_message[], MessageData:data) {
    // Extract killer and victim names, points
    // This is a simplified implementation
    new temp[128];
    copy(temp, charsmax(temp), raw_message);

    // Parse points if present
    new pos = containi(temp, "points");
    if (pos != -1) {
        data[has_points] = true;
        // Extract points value
        sscanf(temp[pos..], "points for %s", data[action_text]);
    }
}

// Parse suicide event data
stock parse_suicide_data(const raw_message[], MessageData:data) {
    // Extract player name and penalty
    // Simplified implementation
    data[has_points] = true;
    data[points] = -2; // Default suicide penalty
}

// Parse action event data
stock parse_action_data(const raw_message[], MessageData:data) {
    // Extract action and points
    new pos = containi(raw_message, "got");
    if (pos != -1) {
        sscanf(raw_message[pos..], "got %d points for %s", data[points], data[action_text]);
        data[has_points] = true;
    }
}

// Format kill message
stock format_kill_message(const MessageData:data, output[], maxlen) {
    new tag[32], killer[48], victim[48], points_str[16];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[killer_name], killer, charsmax(killer), true);
    format_colored_player(data[victim_name], victim, charsmax(victim), false);

    if (data[has_points]) {
        format_colored_points(data[points], points_str, charsmax(points_str));
        format(output, maxlen, "%s: %s eliminated %s (%s points)", tag, killer, victim, points_str);
    } else {
        format(output, maxlen, "%s: %s eliminated %s", tag, killer, victim);
    }
}

// Format suicide message
stock format_suicide_message(const MessageData:data, output[], maxlen) {
    new tag[32], player[48], points_str[16];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[killer_name], player, charsmax(player), true);
    format_colored_points(data[points], points_str, charsmax(points_str));

    format(output, maxlen, "%s: %s committed suicide (%s points)", tag, player, points_str);
}

// Format teamkill message
stock format_teamkill_message(const MessageData:data, output[], maxlen) {
    new tag[32], killer[48], victim[48], points_str[16];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[killer_name], killer, charsmax(killer), true);
    format_colored_player(data[victim_name], victim, charsmax(victim), false);
    format_colored_points(data[points], points_str, charsmax(points_str));

    format(output, maxlen, "%s: %s team-killed %s (%s points)", tag, killer, victim, points_str);
}

// Format action message
stock format_action_message(const MessageData:data, output[], maxlen) {
    new tag[32], player[48], points_str[16], action[80];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[killer_name], player, charsmax(player));
    format_colored_points(data[points], points_str, charsmax(points_str));
    format_colored_action(data[action_text], action, charsmax(action));

    format(output, maxlen, "%s: %s got %s points for %s", tag, player, points_str, action);
}

// Format connection message
stock format_connect_message(const MessageData:data, output[], maxlen) {
    new tag[32], player[48];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[killer_name], player, charsmax(player));

    format(output, maxlen, "%s: %s connected to the server", tag, player);
}

// Format disconnection message
stock format_disconnect_message(const MessageData:data, output[], maxlen) {
    new tag[32], player[48];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[killer_name], player, charsmax(player));

    format(output, maxlen, "%s: %s disconnected from the server", tag, player);
}

// Format general message
stock format_general_message(const raw_message[], output[], maxlen) {
    new tag[32];
    format_colored_tag(tag, charsmax(tag));

    // Strip any server prefixes from the raw message
    new clean_message[256];
    strip_server_prefix(raw_message, clean_message, charsmax(clean_message));

    format(output, maxlen, "%s: %s", tag, clean_message);
}

// Strip server prefix from message
stock strip_server_prefix(const raw_message[], output[], maxlen) {
    new pos = containi(raw_message, "[HLStatsNext]");
    if (pos != -1) {
        // Find the start of the actual message after the tag
        new start = pos + 13; // Length of "[HLStatsNext]"
        while (raw_message[start] == ':' || raw_message[start] == ' ') {
            start++;
        }
        copy(output, maxlen, raw_message[start]);
    } else {
        // Look for common server prefixes and remove them
        new stripped[256];
        copy(stripped, charsmax(stripped), raw_message);

        // Remove "(ALL)" prefix
        pos = containi(stripped, "(ALL)");
        if (pos == 0) {
            new start = 5;
            while (stripped[start] == ' ') start++;
            copy(stripped, charsmax(stripped), stripped[start]);
        }

        // Remove server name prefixes like "[0x1] Server Name :"
        pos = containi(stripped, "] ");
        if (pos != -1 && stripped[0] == '[') {
            new start = pos + 2;
            pos = containi(stripped[start], " : ");
            if (pos != -1) {
                start = start + pos + 3;
                copy(stripped, charsmax(stripped), stripped[start]);
            }
        }

        copy(output, maxlen, stripped);
    }
}

// Format statistics message for hlx_psay command
stock format_statistics_message(const raw_message[], output[], maxlen) {
    new tag[32];
    format_colored_tag(tag, charsmax(tag));

    // Check if message contains rank information
    if (containi(raw_message, "rank") != -1 && containi(raw_message, "of") != -1 && containi(raw_message, "players") != -1) {
        format_rank_message(raw_message, tag, output, maxlen);
    }
    // Check if message contains statistics information
    else if (containi(raw_message, "K/D") != -1 || containi(raw_message, "Accuracy") != -1) {
        format_stats_message(raw_message, tag, output, maxlen);
    }
    // Check if message contains top10 information
    else if (containi(raw_message, "Top 10") != -1) {
        format_top10_message(raw_message, tag, output, maxlen);
    }
    // Default formatting for other statistics messages
    else {
        format(output, maxlen, "%s: %s", tag, raw_message);
    }
}

// Format rank response message
stock format_rank_message(const raw_message[], const tag[], output[], maxlen) {
    // Parse: "You're rank 1 of 1,243 players with a skill of 2,103"
    new rank_str[16], total_str[16], skill_str[16];

    // Extract rank number
    new pos = containi(raw_message, "rank ");
    if (pos != -1) {
        sscanf(raw_message[pos + 5], "%s", rank_str);
        remove_quotes(rank_str);
    }

    // Extract total players
    pos = containi(raw_message, " of ");
    if (pos != -1) {
        sscanf(raw_message[pos + 4], "%s", total_str);
        // Remove "players" from the end
        new comma_pos = contain(total_str, ",");
        if (comma_pos != -1) {
            total_str[comma_pos] = EOS;
        }
    }

    // Extract skill
    pos = containi(raw_message, "skill of ");
    if (pos != -1) {
        sscanf(raw_message[pos + 9], "%s", skill_str);
        remove_quotes(skill_str);
    }

    // Format with colors: rank (yellow), total (yellow), skill (green)
    format(output, maxlen, "%s: You're rank ^3#%s^0 of ^3%s^0 players with a skill of ^2%s^0",
           tag, rank_str, total_str, skill_str);
}

// Format stats response message
stock format_stats_message(const raw_message[], const tag[], output[], maxlen) {
    // Parse: "K/D: 2.5 | Accuracy: 75% | Headshots: 25%"
    new formatted[256];
    copy(formatted, charsmax(formatted), raw_message);

    // Color numerical values in green
    replace_all(formatted, charsmax(formatted), ":", ": ^2");
    replace_all(formatted, charsmax(formatted), " |", "^0 |");
    replace_all(formatted, charsmax(formatted), "%", "%^0");

    format(output, maxlen, "%s: %s", tag, formatted);
}

// Format top10 response message
stock format_top10_message(const raw_message[], const tag[], output[], maxlen) {
    // Parse: "Top 10: 1. ProGamer (2500) 2. Elite (2400) ..."
    new formatted[256];
    copy(formatted, charsmax(formatted), raw_message);

    // Color rank numbers in yellow and player names in red
    replace_all(formatted, charsmax(formatted), "1. ", "^31. ^1");
    replace_all(formatted, charsmax(formatted), "2. ", "^32. ^1");
    replace_all(formatted, charsmax(formatted), "3. ", "^33. ^1");
    replace_all(formatted, charsmax(formatted), ") ", ")^0 ");

    format(output, maxlen, "%s: %s", tag, formatted);
}
```

### 3.5 Create Command Handler Include

Create `packages/plugins/amx/hlstatsnext/src/include/hlstatsnext_commands.inc`:

```pawn
/*
 * HLStatsNext Commands Module
 *
 * Handles command registration and execution
 */

#if defined _hlstatsnext_commands_included
    #endinput
#endif
#define _hlstatsnext_commands_included

// Command access levels
#define ACCESS_PUBLIC 0
#define ACCESS_PLAYER ADMIN_ALL
#define ACCESS_MODERATOR (ADMIN_KICK | ADMIN_BAN)
#define ACCESS_ADMIN ADMIN_RCON

// Commands initialization
stock hlstatsnext_commands_init() {
    log_amx("[HLStatsNext] Commands system initialized");
}

// Register all HLStatsNext commands
stock register_hlstatsnext_commands() {
    // Main messaging commands
    register_concmd("hlstatsnext_announce", "cmd_hlstatsnext_announce", ACCESS_ADMIN,
                    "hlstatsnext_announce <message> - Send announcement to all players");

    register_concmd("hlstatsnext_say", "cmd_hlstatsnext_say", ACCESS_MODERATOR,
                    "hlstatsnext_say <message> - Send public message");

    register_concmd("hlstatsnext_tell", "cmd_hlstatsnext_tell", ACCESS_MODERATOR,
                    "hlstatsnext_tell <userid> <message> - Send private message to player");

    register_concmd("hlx_psay", "cmd_hlx_psay", ACCESS_ADMIN,
                    "hlx_psay <userid> <message> - Send private colored message (for statistics)");

    // Utility commands
    register_concmd("hlstatsnext_status", "cmd_hlstatsnext_status", ACCESS_ADMIN,
                    "hlstatsnext_status - Show plugin status");

    register_concmd("hlstatsnext_reload", "cmd_hlstatsnext_reload", ACCESS_ADMIN,
                    "hlstatsnext_reload - Reload plugin configuration");

    // Future extensibility commands (commented out for initial implementation)
    /*
    register_concmd("hlstatsnext_ban", "cmd_hlstatsnext_ban", ACCESS_ADMIN,
                    "hlstatsnext_ban <userid> <time> <reason> - Ban player");

    register_concmd("hlstatsnext_kick", "cmd_hlstatsnext_kick", ACCESS_MODERATOR,
                    "hlstatsnext_kick <userid> <reason> - Kick player");
    */

    log_amx("[HLStatsNext] Commands registered successfully");
}

// Command: hlstatsnext_announce
public cmd_hlstatsnext_announce(id, level, cid) {
    if (!cmd_access(id, level, cid, 1)) {
        return PLUGIN_HANDLED;
    }

    if (!is_plugin_active()) {
        console_print(id, "[HLStatsNext] Plugin is not active");
        return PLUGIN_HANDLED;
    }

    new message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    read_args(message, charsmax(message));
    remove_quotes(message);

    if (strlen(message) == 0) {
        console_print(id, "Usage: hlstatsnext_announce <message>");
        return PLUGIN_HANDLED;
    }

    // Validate message
    if (!validate_message(message)) {
        console_print(id, "[HLStatsNext] Invalid message content");
        return PLUGIN_HANDLED;
    }

    // Format and send message
    new formatted_message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    format_hlstatsnext_message(message, formatted_message, charsmax(formatted_message));

    // Send to all players
    client_print(0, print_chat, formatted_message);

    // Log the command execution
    new admin_name[32];
    get_user_name(id, admin_name, charsmax(admin_name));
    log_amx("[HLStatsNext] %s used hlstatsnext_announce: %s", admin_name, message);

    return PLUGIN_HANDLED;
}

// Command: hlstatsnext_say
public cmd_hlstatsnext_say(id, level, cid) {
    if (!cmd_access(id, level, cid, 1)) {
        return PLUGIN_HANDLED;
    }

    if (!is_plugin_active()) {
        console_print(id, "[HLStatsNext] Plugin is not active");
        return PLUGIN_HANDLED;
    }

    new message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    read_args(message, charsmax(message));
    remove_quotes(message);

    if (strlen(message) == 0) {
        console_print(id, "Usage: hlstatsnext_say <message>");
        return PLUGIN_HANDLED;
    }

    if (!validate_message(message)) {
        console_print(id, "[HLStatsNext] Invalid message content");
        return PLUGIN_HANDLED;
    }

    // Format and send message
    new formatted_message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    format_hlstatsnext_message(message, formatted_message, charsmax(formatted_message));

    client_print(0, print_chat, formatted_message);

    // Log the command execution
    new admin_name[32];
    get_user_name(id, admin_name, charsmax(admin_name));
    log_amx("[HLStatsNext] %s used hlstatsnext_say: %s", admin_name, message);

    return PLUGIN_HANDLED;
}

// Command: hlstatsnext_tell
public cmd_hlstatsnext_tell(id, level, cid) {
    if (!cmd_access(id, level, cid, 2)) {
        return PLUGIN_HANDLED;
    }

    if (!is_plugin_active()) {
        console_print(id, "[HLStatsNext] Plugin is not active");
        return PLUGIN_HANDLED;
    }

    new target_str[8], message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    read_argv(1, target_str, charsmax(target_str));
    read_args(message, charsmax(message));
    remove_quotes(message);

    // Remove the target from the message
    new pos = contain(message, target_str);
    if (pos != -1) {
        new start = pos + strlen(target_str);
        while (message[start] == ' ') start++;
        copy(message, charsmax(message), message[start]);
    }

    if (strlen(message) == 0) {
        console_print(id, "Usage: hlstatsnext_tell <userid> <message>");
        return PLUGIN_HANDLED;
    }

    new target = str_to_num(target_str);
    if (!is_user_connected(target)) {
        console_print(id, "[HLStatsNext] Player not found");
        return PLUGIN_HANDLED;
    }

    if (!validate_message(message)) {
        console_print(id, "[HLStatsNext] Invalid message content");
        return PLUGIN_HANDLED;
    }

    // Format and send private message
    new formatted_message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    format_hlstatsnext_message(message, formatted_message, charsmax(formatted_message));

    client_print(target, print_chat, formatted_message);

    // Confirmation to sender
    new target_name[32], admin_name[32];
    get_user_name(target, target_name, charsmax(target_name));
    get_user_name(id, admin_name, charsmax(admin_name));
    console_print(id, "[HLStatsNext] Message sent to %s", target_name);

    log_amx("[HLStatsNext] %s sent private message to %s: %s", admin_name, target_name, message);

    return PLUGIN_HANDLED;
}

// Command: hlstatsnext_status
public cmd_hlstatsnext_status(id, level, cid) {
    if (!cmd_access(id, level, cid, 0)) {
        return PLUGIN_HANDLED;
    }

    console_print(id, "=== HLStatsNext Plugin Status ===");
    console_print(id, "Version: %s", PLUGIN_VERSION);
    console_print(id, "State: %s", is_plugin_active() ? "Active" : "Inactive");
    console_print(id, "Colors: %s", are_colors_enabled() ? "Enabled" : "Disabled");
    console_print(id, "Debug: %s", is_debug_enabled() ? "Enabled" : "Disabled");
    console_print(id, "Server ID: %d", get_server_id());
    console_print(id, "Connected Players: %d", get_playersnum());

    return PLUGIN_HANDLED;
}

// Command: hlstatsnext_reload
public cmd_hlstatsnext_reload(id, level, cid) {
    if (!cmd_access(id, level, cid, 0)) {
        return PLUGIN_HANDLED;
    }

    // Reload configuration
    hlstatsnext_load_config();

    console_print(id, "[HLStatsNext] Configuration reloaded");
    log_amx("[HLStatsNext] Configuration reloaded by admin");

    return PLUGIN_HANDLED;
}

// Command: hlx_psay
public cmd_hlx_psay(id, level, cid) {
    if (!cmd_access(id, level, cid, 2)) {
        return PLUGIN_HANDLED;
    }

    if (!is_plugin_active()) {
        console_print(id, "[HLStatsNext] Plugin is not active");
        return PLUGIN_HANDLED;
    }

    new target_str[8], message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    read_argv(1, target_str, charsmax(target_str));
    read_args(message, charsmax(message));
    remove_quotes(message);

    // Remove the target from the message
    new pos = contain(message, target_str);
    if (pos != -1) {
        new start = pos + strlen(target_str);
        while (message[start] == ' ') start++;
        copy(message, charsmax(message), message[start]);
    }

    if (strlen(message) == 0) {
        console_print(id, "Usage: hlx_psay <userid> <message>");
        return PLUGIN_HANDLED;
    }

    new target = str_to_num(target_str);
    if (!is_user_connected(target)) {
        console_print(id, "[HLStatsNext] Player not found");
        return PLUGIN_HANDLED;
    }

    if (!validate_message(message)) {
        console_print(id, "[HLStatsNext] Invalid message content");
        return PLUGIN_HANDLED;
    }

    // Format and send private colored message (for statistics responses)
    new formatted_message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    format_statistics_message(message, formatted_message, charsmax(formatted_message));

    client_print(target, print_chat, formatted_message);

    // Log the command execution for statistics tracking
    new target_name[32], admin_name[32];
    get_user_name(target, target_name, charsmax(target_name));
    get_user_name(id, admin_name, charsmax(admin_name));

    log_amx("[HLStatsNext] Statistics message sent to %s: %s", target_name, message);

    return PLUGIN_HANDLED;
}

// Message validation function
stock bool:validate_message(const message[]) {
    // Check message length
    if (strlen(message) > HLSTATSNEXT_MAX_MESSAGE_LENGTH) {
        return false;
    }

    if (strlen(message) == 0) {
        return false;
    }

    // Check for potentially malicious content
    if (containi(message, ";") != -1 ||
        containi(message, "|") != -1 ||
        containi(message, "rcon") != -1 ||
        containi(message, "quit") != -1 ||
        containi(message, "exit") != -1) {
        return false;
    }

    // Check if public commands are enabled (respect server config)
    if (!config_get_bool("EnablePublicCommands", true)) {
        return false;
    }

    return true;
}
```

### 3.6 Create Utility Include

Create `packages/plugins/amx/hlstatsnext/src/include/hlstatsnext_util.inc`:

```pawn
/*
 * HLStatsNext Utility Module
 *
 * Utility functions and helpers
 */

#if defined _hlstatsnext_util_included
    #endinput
#endif
#define _hlstatsnext_util_included

// String utility functions
stock trim(string[]) {
    new len = strlen(string);

    // Trim trailing spaces
    while (len > 0 && string[len - 1] == ' ') {
        string[--len] = EOS;
    }

    // Trim leading spaces
    new start = 0;
    while (string[start] == ' ') {
        start++;
    }

    if (start > 0) {
        new i = 0;
        while (string[start + i] != EOS) {
            string[i] = string[start + i];
            i++;
        }
        string[i] = EOS;
    }
}

// Safe string copy with validation
stock safe_copy(dest[], maxlen, const source[]) {
    new len = strlen(source);
    if (len >= maxlen) {
        len = maxlen - 1;
    }

    for (new i = 0; i < len; i++) {
        dest[i] = source[i];
    }
    dest[len] = EOS;
}

// Debug logging function
stock debug_log(const format[], any:...) {
    if (!is_debug_enabled()) {
        return;
    }

    new message[256];
    vformat(message, charsmax(message), format, 2);
    log_amx("[HLStatsNext DEBUG] %s", message);
}

// Performance monitoring
stock Float:get_performance_time() {
    return get_gametime();
}

stock log_performance(const operation[], Float:start_time) {
    if (!is_debug_enabled()) {
        return;
    }

    new Float:elapsed = get_gametime() - start_time;
    log_amx("[HLStatsNext PERF] %s took %.3f seconds", operation, elapsed);
}

// Player utility functions
stock bool:is_user_valid(id) {
    return (1 <= id <= HLSTATSNEXT_MAX_PLAYERS) && is_user_connected(id);
}

stock get_user_team_name(id, team_name[], maxlen) {
    new CsTeams:team = cs_get_user_team(id);

    switch (team) {
        case CS_TEAM_T: {
            copy(team_name, maxlen, "Terrorist");
        }
        case CS_TEAM_CT: {
            copy(team_name, maxlen, "Counter-Terrorist");
        }
        case CS_TEAM_SPECTATOR: {
            copy(team_name, maxlen, "Spectator");
        }
        default: {
            copy(team_name, maxlen, "Unassigned");
        }
    }
}

// Configuration helper functions
stock bool:config_get_bool(const key[], bool:default_value = false) {
    // This would interface with the configuration system
    // For now, return default
    return default_value;
}

stock config_get_int(const key[], default_value = 0) {
    // This would interface with the configuration system
    // For now, return default
    return default_value;
}

stock config_get_string(const key[], output[], maxlen, const default_value[] = "") {
    // This would interface with the configuration system
    // For now, return default
    copy(output, maxlen, default_value);
}

// Error handling utilities
stock handle_error(const error_msg[]) {
    log_amx("[HLStatsNext ERROR] %s", error_msg);

    // Could also send to error reporting system
    if (is_debug_enabled()) {
        // Print stack trace or additional debug info
        debug_log("Error context: %s", error_msg);
    }
}

// Version comparison utility
stock bool:is_version_compatible(const required_version[], const current_version[]) {
    // Simple version comparison - could be enhanced
    return equal(required_version, current_version);
}
```

## Step 4: Create Configuration Files

### 4.1 Create Plugin Configuration

Create `packages/plugins/amx/hlstatsnext/configs/hlstatsnext.cfg`:

```ini
// HLStatsNext Plugin Configuration
// This file is loaded when the plugin initializes

// Core settings
hlstatsnext_enabled 1                    // Enable/disable the plugin
hlstatsnext_debug 0                      // Enable debug logging
hlstatsnext_server_id 0                  // Server ID (0 = auto-detect)

// Color settings (stored in config file for simplicity)
hlstatsnext_colors_enabled 1             // Enable colored messages
hlstatsnext_color_scheme "default"       // Color scheme name (default, alternative)

// Color codes (AMX Mod X color format)
hlstatsnext_color_tag "^2"              // [HLStatsNext] tag color (green)
hlstatsnext_color_killer "^1"           // Killer name color (red)
hlstatsnext_color_victim "^4"           // Victim name color (blue)
hlstatsnext_color_action "^6"           // Action text color (cyan)
hlstatsnext_color_points_positive "^2"  // Positive points color (green)
hlstatsnext_color_points_negative "^1"  // Negative points color (red)
hlstatsnext_color_reset "^0"            // Reset color (white/default)

// Message settings
hlstatsnext_max_message_length 191      // Maximum message length
hlstatsnext_strip_server_prefix 1       // Remove server name prefixes

// Performance settings
hlstatsnext_performance_monitoring 0    // Enable performance monitoring
hlstatsnext_log_level "info"           // Logging level (debug, info, warning, error)

// Future extensibility settings (disabled by default)
hlstatsnext_admin_commands 0            // Enable admin commands (ban, kick, etc.)
hlstatsnext_stats_commands 0            // Enable stats commands (rank, top10, etc.)
```

### 4.2 Create README Documentation

Create `packages/plugins/amx/hlstatsnext/README.md`:

````markdown
# HLStatsNext AMX Mod X Plugin

A sophisticated messaging plugin for AMX Mod X that enhances the HLStatsNext experience with colored, formatted messages and extensible command functionality.

## Features

- **Colored Messages**: Beautiful, colored message formatting with configurable schemes
- **Clean Display**: Removes server prefixes for cleaner message appearance
- **Extensible Architecture**: Modular design ready for future features
- **Performance Optimized**: Minimal impact on server performance
- **Security Focused**: Input validation and access control
- **HLStatsNext Integration**: Seamless integration with existing system

## Installation

1. **Compile the Plugin**:
   ```bash
   cd packages/plugins/amx/hlstatsnext
   pnpm build
   ```
````

2. **Install on Server**:

   ```bash
   cp compiled/hlstatsnext.amxx /path/to/server/addons/amxmodx/plugins/
   cp configs/hlstatsnext.cfg /path/to/server/addons/amxmodx/configs/
   ```

3. **Add to Plugins List**:
   Add `hlstatsnext.amxx` to `addons/amxmodx/configs/plugins.ini`

4. **Update HLStatsNext Configuration**:
   The HLStatsNext database configuration will be updated manually by administrators to use the new plugin commands:
   - `BroadCastEventsCommandAnnounce` → `hlstatsnext_announce`
   - `BroadCastEventsCommand` → `hlx_psay`
   - `PlayerEventsCommand` → `hlx_psay`
   - `EnablePublicCommands` → Controls whether public commands are allowed

5. **Restart Server**

## Commands

| Command                               | Access Level | Description                                   |
| ------------------------------------- | ------------ | --------------------------------------------- |
| `hlstatsnext_announce <message>`      | ADMIN        | Send announcement to all players              |
| `hlstatsnext_say <message>`           | MODERATOR    | Send public message                           |
| `hlstatsnext_tell <userid> <message>` | MODERATOR    | Send private message                          |
| `hlx_psay <userid> <message>`         | ADMIN        | Send private colored message (for statistics) |
| `hlstatsnext_status`                  | ADMIN        | Show plugin status                            |
| `hlstatsnext_reload`                  | ADMIN        | Reload configuration                          |

### Player Commands (Handled by HLStatsNext Daemon)

The following commands are typed by players in chat and processed by the HLStatsNext daemon, which then responds using `hlx_psay`:

| Command    | Description                         | Response Example                                        |
| ---------- | ----------------------------------- | ------------------------------------------------------- |
| `!rank`    | Show player's rank and skill rating | `You're rank #1 of 1,243 players with a skill of 2,103` |
| `!stats`   | Show detailed player statistics     | `K/D: 2.5 \| Accuracy: 75% \| Headshots: 25%`           |
| `!top10`   | Show top 10 players                 | `Top 10: 1. ProGamer (2500) 2. Elite (2400)...`         |
| `!session` | Show current session statistics     | `Session: 15 kills, 8 deaths, 1.87 K/D ratio`           |

## Configuration

Edit `hlstatsnext.cfg` to customize:

- **Colors**: Customize color scheme and individual color codes (stored in config file)
- **Messages**: Configure message formatting options (stored in config file)
- **Performance**: Adjust performance and logging settings (stored in config file)
- **Commands**: Enable/disable commands via database `EnablePublicCommands` parameter

## Color Codes

The plugin uses AMX Mod X color codes:

- `^0` - Default/White
- `^1` - Red
- `^2` - Green
- `^3` - Yellow
- `^4` - Blue
- `^5` - Cyan
- `^6` - Magenta
- `^7` - White
- `^8` - Gray

## Development

See the [Implementation Guide](../../../docs/PLUGIN_IMPLEMENTATION_PROMPT.md) for detailed development instructions.

## Support

For issues and feature requests, please refer to the main HLStatsNext project documentation.

````

## Step 5: Build and Test

### 5.1 Test Compilation

```bash
# Navigate to plugin directory
cd packages/plugins/amx/hlstatsnext

# Install dependencies
pnpm install

# Compile the plugin
pnpm build

# Verify compilation
ls -la compiled/
# Should show hlstatsnext.amxx
````

### 5.2 Test Installation

```bash
# Set up test server directory (optional)
mkdir -p test-server/addons/amxmodx/plugins
mkdir -p test-server/addons/amxmodx/configs

# Deploy to test server
pnpm run deploy:dev
```

## Step 6: HLStatsNext Integration

### 6.1 Server Configuration Parameters

The plugin will integrate with existing HLStatsNext server configuration parameters:

```
-- Existing parameters that will be utilized:
-- BroadCastEventsCommandAnnounce: hlstatsnext_announce (public announcements)
-- BroadCastEventsCommand: hlx_psay (event notifications to players)
-- PlayerEventsCommand: hlx_psay (private player messages)
-- PlayerEventsCommandHint: hlx_psay (optional hint messages)
-- PlayerEventsCommandOSD: hlx_psay (optional on-screen display)
-- EnablePublicCommands: Controls whether public commands are allowed

-- Database configuration will be updated manually by administrators
```

### 6.2 Test RCON Integration

Test that the HLStatsNext daemon can execute the new commands:

```bash
# From your HLStatsNext daemon, test RCON command execution
# This should now use hlstatsnext_announce instead of amx_say
```

## Step 7: Player Rank Feature Implementation

### 7.1 Rank Command Flow

The `!rank` command follows this complete flow:

1. **Player Input**: Player types `!rank` in chat (public or team)
2. **HLStatsNext Detection**: Daemon monitors game logs and detects the chat command
3. **Database Query**: Daemon queries player statistics and calculates rank
4. **RCON Response**: Daemon sends `hlx_psay <userid> "You're rank 1 of 1,243 players with a skill of 2,103"`
5. **Plugin Processing**: Plugin receives command, formats with colors, and sends privately to player
6. **Player Receives**: `^2[HLStatsNext]^0: You're rank ^3#1^0 of ^31,243^0 players with a skill of ^22,103^0`

### 7.2 HLStatsNext Daemon Integration

The HLStatsNext daemon needs to be configured to:

1. **Parse Chat Commands**: Monitor for commands starting with `!` in game logs
2. **Process Rank Requests**: Query database for player ranking and skill information
3. **Send Response**: Use the configured `PlayerEventsCommandPrivate` (hlx_psay) to respond

### 7.3 Testing the Rank Feature

```bash
# 1. Ensure plugin is loaded and hlx_psay command is registered
# 2. Test the command manually via RCON
rcon hlx_psay 5 "You're rank 1 of 1,243 players with a skill of 2,103"

# 3. In-game, player should see:
# [HLStatsNext]: You're rank #1 of 1,243 players with a skill of 2,103 (with colors)

# 4. Test with a real player
# Player types: !rank
# Should receive colored private message with their actual rank
```

### 7.4 Example Implementation Flow

```
Server Log: "Player<5><STEAM_ID><CT>" say "!rank"
            ↓
HLStatsNext Daemon detects command
            ↓
Database Query: SELECT rank, skill FROM player_rankings WHERE playerId = 5
            ↓
Result: rank=42, skill=1850, totalPlayers=1243
            ↓
RCON Command: hlx_psay 5 "You're rank 42 of 1,243 players with a skill of 1,850"
            ↓
Plugin formats with colors and sends privately to player 5
            ↓
Player sees: ^2[HLStatsNext]^0: You're rank ^3#42^0 of ^31,243^0 players with a skill of ^21,850^0
```

## Step 8: Advanced Configuration

### 8.1 Custom Color Schemes

Create alternative color schemes by modifying the plugin configuration:

```pawn
// Add to hlstatsnext_colors.inc
new const g_alternative_colors[ColorScheme] = {
    "^3",  // Yellow for [HLStatsNext]
    "^1",  // Red for killer (unchanged)
    "^4",  // Blue for victim (unchanged)
    "^2",  // Green for positive points
    "^1",  // Red for negative points
    "^5",  // Magenta for actions
    "^0"   // White/default for reset
};
```

### 7.2 Server-Specific Configuration

Configuration uses a two-tier approach for simplicity:

**Database Configuration (rarely changed, per-server):**

```
-- Command mapping (handled manually by administrators):
-- Server 1: BroadCastEventsCommandAnnounce = 'hlstatsnext_announce'
-- Server 1: EnablePublicCommands = '1'
-- Server 2: EnablePublicCommands = '0'
```

**File Configuration (hlstatsnext.cfg):**

```ini
// Color schemes and visual settings - same across all servers
hlstatsnext_color_scheme "default"
hlstatsnext_colors_enabled 1
hlstatsnext_color_tag "^2"
hlstatsnext_color_killer "^1"
```

## Step 8: Future Extensions

### 8.1 Admin Commands Module

When ready to implement admin features:

```pawn
// Add to hlstatsnext_commands.inc
public cmd_hlstatsnext_ban(id, level, cid) {
    // Implementation for banning players
}

public cmd_hlstatsnext_kick(id, level, cid) {
    // Implementation for kicking players
}
```

### 8.2 Statistics Commands Module

```pawn
// Add to hlstatsnext_commands.inc
public cmd_hlstatsnext_rank(id, level, cid) {
    // Show player ranking
}

public cmd_hlstatsnext_top10(id, level, cid) {
    // Show top 10 players
}
```

## Troubleshooting

### Common Issues

1. **Plugin Won't Compile**:
   - Check AMX Mod X compiler installation
   - Verify include paths
   - Check syntax errors in .sma files

2. **Plugin Loads but Commands Don't Work**:
   - Verify plugin is in plugins.ini
   - Check server logs for errors
   - Ensure proper access levels

3. **Colors Don't Display**:
   - Verify client supports color codes
   - Check if colors are enabled in configuration
   - Test with different color codes

4. **HLStatsNext Integration Issues**:
   - Verify database configuration is updated
   - Check RCON connection
   - Review daemon logs for command execution

### Debug Mode

Enable debug mode for detailed logging:

```ini
hlstatsnext_debug 1
```

This will provide detailed logs about:

- Command execution
- Message formatting
- Configuration loading
- Performance metrics

## Reference

- [AMX Mod X Documentation](https://wiki.alliedmods.net/AMX_Mod_X_Documentation)
- [Pawn Language Guide](https://wiki.alliedmods.net/Pawn_Tutorial)
- [HLStatsNext Architecture](./PLUGIN_ARCHITECTURE.md)

This implementation guide provides a complete foundation for developing and deploying the HLStatsNext AMX Mod X plugin. The modular architecture ensures easy maintenance and extensibility for future features.
