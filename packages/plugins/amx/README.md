# HLStatsNext AMX Mod X Plugin

An event processing plugin for AMX Mod X that handles structured commands from the HLStatsNext daemon. The plugin receives structured event data and handles all presentation formatting, including colors and localization.

## Features

- **Structured Event Processing**: Receives and processes structured commands from the HLStatsNext daemon
- **Complete Presentation Control**: Handles all message formatting, colors, and localization in the plugin
- **Event-Driven Architecture**: Processes kill, suicide, teamkill, action, connect, and disconnect events
- **Colored Messages**: Beautiful, colored message formatting with configurable schemes
- **Player Commands**: Support for `!rank`, `!stats`, `!help`, `!top10` commands
- **HUD Announce System**: Clean HUD messages for server/stats system with typewriter effects
- **Clean Separation**: Daemon handles data, plugin handles presentation
- **Performance Optimized**: Minimal impact on server performance
- **Security Focused**: Input validation and access control

## Installation

1. **Compile the Plugin**:

   ```bash
   cd packages/plugins/amx
   # Ensure AMX Mod X compiler is installed
   amxxpc src/hlstatsnext.sma -iinclude -o=compiled/hlstatsnext.amxx
   ```

2. **Install on Server**:

   ```bash
   cp compiled/hlstatsnext.amxx /path/to/server/addons/amxmodx/plugins/
   cp configs/hlstatsnext.cfg /path/to/server/addons/amxmodx/configs/
   ```

3. **Add to Plugins List**:
   Add `hlstatsnext.amxx` to `addons/amxmodx/configs/plugins.ini`

4. **Update HLStatsNext Configuration**:
   The HLStatsNext database configuration will be updated manually by administrators to use the new structured commands:
   - `BroadCastEventsCommandAnnounce` → `hlx_announce`
   - `BroadCastEventsCommand` → `hlx_event`
   - `PlayerEventsCommand` → `hlx_event`
   - `EnablePublicCommands` → Controls whether public commands are allowed

5. **Restart Server**

## Commands

### Core Structured Commands (Used by HLStatsNext Daemon)

| Command                                     | Description                          |
| ------------------------------------------- | ------------------------------------ |
| `hlx_event <target> <event_type> <data...>` | Process structured event from daemon |
| `hlx_announce <message>`                    | Send announcement to all players     |

### Event Types Supported

- `KILL` - Player kill events with skill adjustments
- `SUICIDE` - Player suicide events with penalties
- `TEAMKILL` - Team kill events with penalties
- `ACTION` - Individual player actions with points
- `TEAM_ACTION` - Team-wide actions
- `CONNECT` - Player connection events
- `DISCONNECT` - Player disconnection events
- `RANK` - Player rank responses
- `STATS` - Player statistics responses
- `MESSAGE` - Generic message delivery

### Administrative Commands

| Command              | Access Level | Description                                |
| -------------------- | ------------ | ------------------------------------------ |
| `hlstatsnext_status` | ADMIN_RCON   | Show plugin status                         |
| `hlstatsnext_reload` | ADMIN_RCON   | Reload configuration                       |
| `hlx_csay`           | ADMIN_RCON   | Send center HUD message to all players     |
| `hlx_tsay`           | ADMIN_RCON   | Send top HUD message to all players        |
| `hlx_typehud`        | ADMIN_RCON   | Send typewriter HUD message to all players |

### HUD Announce Commands

Clean HUD messages for server/stats system without admin name prefix:

| Command                             | Description                       | Example                                    |
| ----------------------------------- | --------------------------------- | ------------------------------------------ |
| `hlx_csay <RRGGBB> <message...>`    | Center HUD message (classic csay) | `hlx_csay FF9900 Welcome to the server!`   |
| `hlx_tsay <RRGGBB> <message...>`    | Top HUD message (tsay position)   | `hlx_tsay 00FF00 Server restarting...`     |
| `hlx_typehud <RRGGBB> <message...>` | Center typewriter HUD message     | `hlx_typehud 0080FF Top fragger: ProGamer` |

**Color Formats Supported:**

- **Hex**: `FF9900` (6 characters, case-insensitive)
- **Decimal**: `255255000` (9 digits: RRRGGGBBB)
- **Fallback**: If color parsing fails, uses `hlmsg_default_color` CVAR

**Usage Examples:**

```
hlx_csay FF0000 Warning: Server maintenance in 5 minutes
hlx_tsay 255255255 Visit our website at example.com
hlx_typehud 00FF80 Welcome to HLStatsNext!
hlx_csay "Message without color uses default"
```

### Player Commands (Handled by HLStatsNext Daemon)

The following commands are typed by players in chat and processed by the HLStatsNext daemon, which then responds using structured `hlx_event` commands:

| Command    | Description                         | Daemon Response                                                                                            |
| ---------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `!rank`    | Show player's rank and skill rating | `hlx_event <userid> RANK <playerId> <rank> <total> <skill>`                                                |
| `!stats`   | Show detailed player statistics     | `hlx_event <userid> STATS <playerId> <rank> <total> <skill> <kills> <deaths> <kdr> <accuracy> <headshots>` |
| `!top10`   | Show top 10 players                 | `hlx_event <userid> MESSAGE "Top 10: 1. ProGamer (2500)..."`                                               |
| `!session` | Show current session statistics     | `hlx_event <userid> MESSAGE "Session: 15 kills, 8 deaths, 1.87 K/D"`                                       |

## Configuration

Edit `configs/hlstatsnext.cfg` to customize:

- **Colors**: Customize color scheme and individual color codes
- **Messages**: Configure message formatting options
- **Performance**: Adjust performance and logging settings
- **Commands**: Enable/disable specific command groups

### HUD Message Configuration

The following CVARs control HUD message appearance:

| CVAR                  | Default | Description                              |
| --------------------- | ------- | ---------------------------------------- |
| `hlmsg_default_color` | 00FF80  | Default color (hex format)               |
| `hlmsg_holdtime`      | 6.0     | How long message stays visible (seconds) |
| `hlmsg_fadein`        | 0.1     | Fade in duration (seconds)               |
| `hlmsg_fadeout`       | 0.2     | Fade out duration (seconds)              |
| `hlmsg_channel`       | -1      | HUD channel (-1 = auto)                  |

**Example CVAR usage:**

```
hlmsg_default_color "FF9900"    // Orange default color
hlmsg_holdtime "8.0"            // Hold for 8 seconds
hlmsg_fadein "0.2"              // Slower fade in
hlmsg_fadeout "0.5"             // Slower fade out
hlmsg_channel "3"               // Use specific channel
```

## Color Codes

The plugin uses color codes with `client_print_color()` for supported games:

- `^1` - Default/White text
- `^3` - Team color (red/blue based on player's team)
- `^4` - Green text

**Important**: The `client_print_color()` function only works with **Counter-Strike 1.6 and Condition Zero**. For other GoldSRC games (Team Fortress Classic, Day of Defeat, Half-Life, etc.), the plugin will fall back to `client_print()` without color support. Only `^1`, `^3`, and `^4` color codes are supported in the compatible games. The plugin's color scheme is designed around these limitations:

- Plugin tag "HLStatsNext" uses `^4` (green)
- Brackets and colons use `^1` (default)
- Killer names use `^3` (team color)
- Victim names and positive points use `^4` (green)
- Action event player names use default color (no coloring)

## Plugin Architecture

The plugin follows a modular architecture with separate include files for different functionality:

- **hlstatsnext_core.inc**: Core functionality, lifecycle management, and configurable constants
- **hlstatsnext_events.inc**: Event type definitions and data structures
- **hlstatsnext_parser.inc**: Structured command parsing logic using `read_argv()`
- **hlstatsnext_formatter.inc**: Message formatting and color presentation with CS 1.6 compatibility
- **hlstatsnext_commands.inc**: Command registration and event processors
- **hlstatsnext_colors.inc**: Color scheme management and formatting functions
- **hlstatsnext_util.inc**: Utility functions and helpers
- **hlstatsnext_hud.inc**: HUD message system with color parsing and display functions
- **hlstatsnext_messages.inc**: Basic message processing (simplified after refactor)

### Structured Command Processing Flow

1. **Daemon** sends structured command via RCON: `hlx_event 0 KILL 5 "Player1" 1500 12 "Player2" 1450 15 ak47 0`
2. **Parser** uses `read_argv()` to extract event type and data fields (proper quote handling)
3. **Event Processor** processes the specific event type in dedicated function
4. **Formatter** applies colors (if supported by the game) and creates presentation message
5. **Output** displays formatted message using `client_print_color()` for CS 1.6/CZ or `client_print()` for other GoldSRC games

### Key Technical Improvements

- **Quote Handling**: Uses `read_argv()` instead of string manipulation to properly handle quoted arguments
- **Memory Safety**: All buffer operations use `sizeof() - 1` instead of magic numbers
- **Compiler Compatibility**: Character-by-character comparison avoids `std::bad_alloc` errors with `equal()`
- **Message Length**: All messages optimized to stay under 192-byte limit for proper display

## Development

### Prerequisites

- AMX Mod X 1.9.0 or higher
- AMX Mod X Compiler (amxxpc)
- Node.js 24.0.0 or higher (for package management)
- pnpm 10.17.0 (monorepo package manager)

### Building from Source

```bash
# Install dependencies
pnpm install

# Compile the plugin (requires amxxpc in PATH)
pnpm run compile:local

# Package for distribution
pnpm run package
```

### Adding New Features

To add new features:

1. Add new event types to `hlstatsnext_events.inc`
2. Update parser in `hlstatsnext_parser.inc` to handle new command structure
3. Add formatting logic in `hlstatsnext_formatter.inc`
4. Add new commands to `hlstatsnext_commands.inc` if needed
5. For HUD features, extend `hlstatsnext_hud.inc` with new display functions
6. Update daemon's `StructuredCommandBuilder` to send new event types
7. Update configuration file if needed

## Integration with HLStatsNext

### How It Works

1. **Player Action**: Player performs action or types command
2. **Game Server**: Logs event to console
3. **HLStatsNext Daemon**: Monitors logs and processes events
4. **Structured Command**: Daemon sends structured command via RCON
5. **Plugin Processing**: Plugin parses structured data and formats message
6. **Player Sees**: Colored, formatted message in chat

### Example Flow: Kill Event

```
Player "ProPlayer" kills "Noob" with AK47 headshot
            ↓
Server logs: "ProPlayer<5><STEAM_ID><CT>" killed "Noob<12><STEAM_ID><TERRORIST>" with "ak47"
            ↓
HLStatsNext processes kill event and calculates skill changes
            ↓
RCON: hlx_event 0 KILL 5 "ProPlayer" 1500 12 "Noob" 1450 15 ak47 1
            ↓
Plugin parses: target=0, killer=5, victim=12, skill changes, weapon, headshot=true
            ↓
Plugin formats with colors and displays to all players
            ↓
Players see: [HLX] ProPlayer [+15] killed Noob [-15] with ak47 (headshot)
```

### Example Flow: Rank Command

```
Player types: !rank
            ↓
Server logs: "Player<5><STEAM_ID><CT>" say "!rank"
            ↓
HLStatsNext detects command and queries database
            ↓
RCON: hlx_event 5 RANK 5 42 1243 1850
            ↓
Plugin parses: target=5, playerId=5, rank=42, total=1243, skill=1850
            ↓
Plugin formats with colors
            ↓
Player sees: [HLX] You're rank #42 of 1,243 players with a skill of 1,850
```

## Troubleshooting

### Plugin Won't Compile

- Ensure AMX Mod X compiler is installed
- Check that all include files are present
- Verify syntax in .sma files

### Structured Commands Don't Work

- Check plugin is listed in plugins.ini
- Verify daemon is sending `hlx_event` commands instead of old message commands
- Check database configuration uses correct command strings
- Review server console for parsing errors

### Colors Not Displaying

- Verify you're running Counter-Strike 1.6 or Condition Zero (other GoldSRC games don't support colored chat)
- Check that you're using compatible color codes (`^1`, `^3`, `^4` only)
- Check hlstatsnext.cfg color settings
- Ensure colors are enabled in configuration
- Verify formatter is applying colors to parsed events
- Make sure `client_print_color()` is used instead of `client_print()` for supported games

### Events Not Processing

- Check daemon is sending structured commands with correct format
- Verify parser recognizes event types (KILL, SUICIDE, etc.)
- Check that event data fields match expected format
- Review plugin logs for parsing errors
- Ensure quoted arguments are properly handled by daemon

### Compilation Issues

- Use AMX Mod X 1.9.0 or higher for best compatibility
- Avoid using `equal()` function due to compiler memory allocation issues
- Replace `strlower()` with manual character conversion if undefined
- Ensure all buffer sizes use `sizeof() - 1` calculations

## Support

For issues and feature requests, please refer to the main HLStatsNext project documentation.

## License

This plugin is part of the HLStatsNext project and is subject to its licensing terms.

## Credits

- HLStatsNext Team
- AMX Mod X Community
- Original HLStats contributors
