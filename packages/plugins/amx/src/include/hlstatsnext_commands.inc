/*
 * HLStatsNext Commands Module
 *
 * Handles command registration and execution for structured events
 */

#if defined _hlstatsnext_commands_included
    #endinput
#endif
#define _hlstatsnext_commands_included

#include "hlstatsnext_core.inc"
#include "hlstatsnext_events.inc"
#include "hlstatsnext_globals.inc"
#include "hlstatsnext_parser.inc"
#include "hlstatsnext_formatter.inc"
#include "hlstatsnext_hud.inc"

// Command access levels
#define ACCESS_PUBLIC 0
#define ACCESS_PLAYER ADMIN_ALL
#define ACCESS_MODERATOR (ADMIN_KICK | ADMIN_BAN)
#define ACCESS_ADMIN ADMIN_RCON

// Message format constants - AMX optimization pattern to reduce data section duplication
new const RANK_MSG_FORMAT[] = "%s Rank: #%d of %d players (Skill: %d)";
new const STATS_MSG_FORMAT[] = "%s Stats: #%d/%d | K/D: %d/%d (%.2f) | Skill: %d";
new const SESSION_MSG_HOURS[] = "%s Session: %d kills, %d deaths (%.2f) | Time: %dh %dm %ds";
new const SESSION_MSG_MINUTES[] = "%s Session: %d kills, %d deaths (%.2f) | Time: %dm %ds";
new const SESSION_MSG_SECONDS[] = "%s Session: %d kills, %d deaths (%.2f) | Time: %ds";

// Commands initialization
stock hlstatsnext_commands_init() {
    hlstatsnext_hud_init();
    log_amx("%s Commands system initialized", HLSTATSNEXT_TAG);
}

// Find player by Steam ID
stock find_player_by_steamid(const steam_id[]) {
    if (steam_id[0] == 0) {
        return 0; // Empty Steam ID
    }

    // Cache expensive function call - AMX optimization pattern
    new max_players = get_maxplayers();
    new player_steamid[32];
    for (new i = 1; i <= max_players; i++) {
        if (is_user_connected(i)) {
            get_user_authid(i, player_steamid, charsmax(player_steamid));
            if (equal(player_steamid, steam_id)) {
                return i;
            }
        }
    }
    return 0; // Player not found
}

// Register all HLStatsNext commands
stock register_hlstatsnext_commands() {
    // Main event command from daemon
    register_concmd("hlx_event", "cmd_hlx_event", ACCESS_ADMIN,
                    "hlx_event <target> <EVENT_TYPE> <DATA...> - Process structured event from daemon");

    // Announcement command for public messages
    register_concmd("hlx_announce", "cmd_hlx_announce", ACCESS_ADMIN,
                    "hlx_announce <message> - Send announcement to all players");

    // Status command
    register_concmd("hlstatsnext_status", "cmd_hlstatsnext_status", ACCESS_ADMIN,
                    "hlstatsnext_status - Show plugin status");

    // Reload command
    register_concmd("hlstatsnext_reload", "cmd_hlstatsnext_reload", ACCESS_ADMIN,
                    "hlstatsnext_reload - Reload plugin configuration");

    // HUD announce commands
    register_concmd("hlx_csay", "cmd_hlx_csay", ACCESS_ADMIN,
                    "hlx_csay <RRGGBB> <message...> - Send center HUD message");
    register_concmd("hlx_tsay", "cmd_hlx_tsay", ACCESS_ADMIN,
                    "hlx_tsay <RRGGBB> <message...> - Send top HUD message");
    register_concmd("hlx_typehud", "cmd_hlx_typehud", ACCESS_ADMIN,
                    "hlx_typehud <RRGGBB> <message...> - Send typewriter HUD message");

    log_amx("%s Commands registered successfully", HLSTATSNEXT_TAG);
}

// Optimized event processing functions using global variables

// Process KILL event: hlx_event <target> KILL <killerId> "<killerName>" <killerSkill> <victimId> "<victimName>" <victimSkill> <points> <weapon> <headshot>
stock bool:process_kill_event() {
    // No Steam ID in KILL events from daemon
    g_steam_id[0] = 0;

    read_argv(3, g_temp_str, charsmax(g_temp_str));
    g_killer_id = str_to_num(g_temp_str);

    read_argv(4, g_killer_name, charsmax(g_killer_name));

    read_argv(5, g_temp_str, charsmax(g_temp_str));
    g_killer_skill = str_to_num(g_temp_str);

    read_argv(6, g_temp_str, charsmax(g_temp_str));
    g_victim_id = str_to_num(g_temp_str);

    read_argv(7, g_victim_name, charsmax(g_victim_name));

    read_argv(8, g_temp_str, charsmax(g_temp_str));
    g_victim_skill = str_to_num(g_temp_str);

    read_argv(9, g_temp_str, charsmax(g_temp_str));
    g_points = str_to_num(g_temp_str);

    read_argv(10, g_weapon, charsmax(g_weapon));

    read_argv(11, g_temp_str, charsmax(g_temp_str));
    g_headshot = bool:str_to_num(g_temp_str);
    #pragma unused g_headshot  // Stored for future use but not currently displayed

    log_amx("%s KILL: %s (%d) killed %s (%d) with %s for %d points", HLSTATSNEXT_TAG,
           g_killer_name, g_killer_id, g_victim_name, g_victim_id, g_weapon, g_points);

    return true;
}

// Process CONNECT event: hlx_event <target> CONNECT <playerId> "<playerName>" "<country>"
stock bool:process_connect_event() {
    // No Steam ID in CONNECT events from daemon
    g_steam_id[0] = 0;

    read_argv(3, g_temp_str, charsmax(g_temp_str));
    g_player_id = str_to_num(g_temp_str);

    read_argv(4, g_player_name, charsmax(g_player_name));
    read_argv(5, g_country, charsmax(g_country));

    log_amx("%s CONNECT: %s (%d) from %s", HLSTATSNEXT_TAG, g_player_name, g_player_id, g_country);

    return true;
}

// Process TEAM_ACTION event: hlx_event <target> TEAM_ACTION "<teamName>" "<actionCode>" "<actionDesc>" <points> <playerCount>
stock bool:process_team_action_event() {
    // No Steam ID in TEAM_ACTION events from daemon
    g_steam_id[0] = 0;

    read_argv(3, g_team_name, charsmax(g_team_name));
    read_argv(4, g_action_code, charsmax(g_action_code));
    read_argv(5, g_action_desc, charsmax(g_action_desc));

    read_argv(6, g_temp_str, charsmax(g_temp_str));
    g_points = str_to_num(g_temp_str);

    read_argv(7, g_temp_str, charsmax(g_temp_str));
    g_player_count = str_to_num(g_temp_str);

    log_amx("%s TEAM_ACTION: %s - %s (%s) for %d points (%d players)", HLSTATSNEXT_TAG,
           g_team_name, g_action_desc, g_action_code, g_points, g_player_count);

    return true;
}

// Process DISCONNECT event: hlx_event <target> DISCONNECT <playerId> "<playerName>" <sessionTime>
stock bool:process_disconnect_event() {
    // No Steam ID in DISCONNECT events from daemon
    g_steam_id[0] = 0;

    read_argv(3, g_temp_str, charsmax(g_temp_str));
    g_player_id = str_to_num(g_temp_str);

    read_argv(4, g_player_name, charsmax(g_player_name));

    read_argv(5, g_temp_str, charsmax(g_temp_str));
    g_session_time = str_to_num(g_temp_str);

    log_amx("%s DISCONNECT: %s (%d) session time: %d", HLSTATSNEXT_TAG, g_player_name, g_player_id, g_session_time);

    return true;
}

// Process SUICIDE event: hlx_event <target> SUICIDE <playerId> "<playerName>" <playerSkill> <penalty>
stock bool:process_suicide_event() {
    // No Steam ID in SUICIDE events from daemon
    g_steam_id[0] = 0;

    read_argv(3, g_temp_str, charsmax(g_temp_str));
    g_player_id = str_to_num(g_temp_str);

    read_argv(4, g_player_name, charsmax(g_player_name));

    read_argv(5, g_temp_str, charsmax(g_temp_str));
    g_player_skill = str_to_num(g_temp_str);

    read_argv(6, g_temp_str, charsmax(g_temp_str));
    g_penalty = str_to_num(g_temp_str);

    log_amx("%s SUICIDE: %s (%d) penalty: %d", HLSTATSNEXT_TAG, g_player_name, g_player_id, g_penalty);

    return true;
}

// Process TEAMKILL event: hlx_event <target> TEAMKILL <killerId> "<killerName>" <victimId> "<victimName>" <penalty>
stock bool:process_teamkill_event() {
    // No Steam ID in TEAMKILL events from daemon
    g_steam_id[0] = 0;

    read_argv(3, g_temp_str, charsmax(g_temp_str));
    g_killer_id = str_to_num(g_temp_str);

    read_argv(4, g_killer_name, charsmax(g_killer_name));

    read_argv(5, g_temp_str, charsmax(g_temp_str));
    g_victim_id = str_to_num(g_temp_str);

    read_argv(6, g_victim_name, charsmax(g_victim_name));

    read_argv(7, g_temp_str, charsmax(g_temp_str));
    g_penalty = str_to_num(g_temp_str);

    log_amx("%s TEAMKILL: %s (%d) killed %s (%d) penalty: %d", HLSTATSNEXT_TAG,
           g_killer_name, g_killer_id, g_victim_name, g_victim_id, g_penalty);

    return true;
}

// Process ACTION event: hlx_event <target> ACTION <playerId> "<playerName>" <playerSkill> "<actionCode>" "<actionDesc>" <points>
stock bool:process_action_event() {
    // No Steam ID in ACTION events from daemon
    g_steam_id[0] = 0;

    read_argv(3, g_temp_str, charsmax(g_temp_str));
    g_player_id = str_to_num(g_temp_str);

    read_argv(4, g_player_name, charsmax(g_player_name));

    read_argv(5, g_temp_str, charsmax(g_temp_str));
    g_player_skill = str_to_num(g_temp_str);

    read_argv(6, g_action_code, charsmax(g_action_code));
    read_argv(7, g_action_desc, charsmax(g_action_desc));

    read_argv(8, g_temp_str, charsmax(g_temp_str));
    g_points = str_to_num(g_temp_str);

    log_amx("%s ACTION: %s (%d) - %s (%s) for %d points", HLSTATSNEXT_TAG,
           g_player_name, g_player_id, g_action_desc, g_action_code, g_points);

    return true;
}

// Process RANK event: hlx_event <target> RANK <steamId> <playerId> <rank> <totalPlayers> <skill>
stock bool:process_rank_event() {
    read_argv(3, g_steam_id, charsmax(g_steam_id));

    read_argv(4, g_temp_str, charsmax(g_temp_str));
    g_player_id = str_to_num(g_temp_str);

    read_argv(5, g_temp_str, charsmax(g_temp_str));
    g_rank = str_to_num(g_temp_str);

    read_argv(6, g_temp_str, charsmax(g_temp_str));
    g_total_players = str_to_num(g_temp_str);

    read_argv(7, g_temp_str, charsmax(g_temp_str));
    g_player_skill = str_to_num(g_temp_str);

    log_amx("%s RANK: Player %d - rank #%d of %d with skill %d", HLSTATSNEXT_TAG,
           g_player_id, g_rank, g_total_players, g_player_skill);

    return true;
}

// Process STATS event: hlx_event <target> STATS <steamId> <playerId> <rank> <total> <skill> <kills> <deaths> <kdr> <accuracy> <headshots>
stock bool:process_stats_event() {
    read_argv(3, g_steam_id, charsmax(g_steam_id));

    read_argv(4, g_temp_str, charsmax(g_temp_str));
    g_player_id = str_to_num(g_temp_str);

    read_argv(5, g_temp_str, charsmax(g_temp_str));
    g_rank = str_to_num(g_temp_str);

    read_argv(6, g_temp_str, charsmax(g_temp_str));
    g_total_players = str_to_num(g_temp_str);

    read_argv(7, g_temp_str, charsmax(g_temp_str));
    g_player_skill = str_to_num(g_temp_str);

    read_argv(8, g_temp_str, charsmax(g_temp_str));
    g_kills = str_to_num(g_temp_str);

    read_argv(9, g_temp_str, charsmax(g_temp_str));
    g_deaths = str_to_num(g_temp_str);

    read_argv(10, g_temp_str, charsmax(g_temp_str));
    g_kdr = str_to_float(g_temp_str);

    read_argv(11, g_temp_str, charsmax(g_temp_str));
    g_accuracy = str_to_num(g_temp_str);

    read_argv(12, g_temp_str, charsmax(g_temp_str));
    g_headshots_percent = str_to_num(g_temp_str);

    log_amx("%s STATS: Player %d - K/D: %d/%d (%.2f) | Acc: %d%% | HS: %d%%", HLSTATSNEXT_TAG,
           g_player_id, g_kills, g_deaths, g_kdr, g_accuracy, g_headshots_percent);

    return true;
}

// Process SESSION event: hlx_event <target> SESSION <steamId> <playerId> <sessionKills> <sessionDeaths> <sessionKdr> <sessionTime>
stock bool:process_session_event() {
    read_argv(3, g_steam_id, charsmax(g_steam_id));

    read_argv(4, g_temp_str, charsmax(g_temp_str));
    g_player_id = str_to_num(g_temp_str);

    read_argv(5, g_temp_str, charsmax(g_temp_str));
    g_session_kills = str_to_num(g_temp_str);

    read_argv(6, g_temp_str, charsmax(g_temp_str));
    g_session_deaths = str_to_num(g_temp_str);

    read_argv(7, g_temp_str, charsmax(g_temp_str));
    g_session_kdr = str_to_float(g_temp_str);

    read_argv(8, g_temp_str, charsmax(g_temp_str));
    g_session_time = str_to_num(g_temp_str);

    log_amx("%s SESSION: Player %d - %d kills, %d deaths, %.2f K/D, %d seconds", HLSTATSNEXT_TAG,
           g_player_id, g_session_kills, g_session_deaths, g_session_kdr, g_session_time);

    return true;
}

// Handler functions for player commands using global data

// RANK command handler
stock handle_rank_command() {
    new tag[32];
    format_colored_tag(tag, charsmax(tag));

    new msg[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    format(msg, charsmax(msg), RANK_MSG_FORMAT,
           tag, g_rank, g_total_players, g_player_skill);

    new player = find_player_by_steamid(g_steam_id);
    if (player > 0) {
        client_print_color(player, print_team_red, msg);
    }
}

// STATS command handler
stock handle_stats_command() {
    new tag[32];
    format_colored_tag(tag, charsmax(tag));

    new msg[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    format(msg, charsmax(msg), STATS_MSG_FORMAT,
           tag, g_rank, g_total_players, g_kills, g_deaths, g_kdr, g_player_skill);

    new player = find_player_by_steamid(g_steam_id);
    if (player > 0) {
        client_print_color(player, print_team_red, msg);
    }
}

// SESSION command handler
stock handle_session_command() {
    new tag[32];
    format_colored_tag(tag, charsmax(tag));

    new hours = g_session_time / 3600;
    new minutes = (g_session_time % 3600) / 60;
    new seconds = g_session_time % 60;

    new msg[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    if (hours > 0) {
        format(msg, charsmax(msg), SESSION_MSG_HOURS,
               tag, g_session_kills, g_session_deaths, g_session_kdr, hours, minutes, seconds);
    } else if (minutes > 0) {
        format(msg, charsmax(msg), SESSION_MSG_MINUTES,
               tag, g_session_kills, g_session_deaths, g_session_kdr, minutes, seconds);
    } else {
        format(msg, charsmax(msg), SESSION_MSG_SECONDS,
               tag, g_session_kills, g_session_deaths, g_session_kdr, seconds);
    }

    new player = find_player_by_steamid(g_steam_id);
    if (player > 0) {
        client_print_color(player, print_team_red, msg);
    }
}

// Broadcasting functions - send formatted messages to all players

// Broadcast KILL event to all players
stock broadcast_kill_event() {
    new message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    format_kill_event(message, charsmax(message));

    // Cache expensive function call - AMX optimization pattern
    new max_players = get_maxplayers();
    for (new i = 1; i <= max_players; i++) {
        if (is_user_connected(i)) {
            client_print_color(i, print_team_red, message);
        }
    }
}

// Broadcast SUICIDE event to all players
stock broadcast_suicide_event() {
    new message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    format_suicide_event(message, charsmax(message));

    new max_players = get_maxplayers();
    for (new i = 1; i <= max_players; i++) {
        if (is_user_connected(i)) {
            client_print_color(i, print_team_red, message);
        }
    }
}

// Broadcast TEAMKILL event to all players
stock broadcast_teamkill_event() {
    new message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    format_teamkill_event(message, charsmax(message));

    new max_players = get_maxplayers();
    for (new i = 1; i <= max_players; i++) {
        if (is_user_connected(i)) {
            client_print_color(i, print_team_red, message);
        }
    }
}

// Broadcast ACTION event to all players
stock broadcast_action_event() {
    new message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    format_action_event(message, charsmax(message));

    new max_players = get_maxplayers();
    for (new i = 1; i <= max_players; i++) {
        if (is_user_connected(i)) {
            client_print_color(i, print_team_red, message);
        }
    }
}

// Broadcast TEAM_ACTION event to all players
stock broadcast_team_action_event() {
    new message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    format_team_action_event(message, charsmax(message));

    new max_players = get_maxplayers();
    for (new i = 1; i <= max_players; i++) {
        if (is_user_connected(i)) {
            client_print_color(i, print_team_red, message);
        }
    }
}

// Broadcast CONNECT event to all players
stock broadcast_connect_event() {
    new message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    format_connect_event(message, charsmax(message));

    new max_players = get_maxplayers();
    for (new i = 1; i <= max_players; i++) {
        if (is_user_connected(i)) {
            client_print_color(i, print_team_red, message);
        }
    }
}

// Broadcast DISCONNECT event to all players
stock broadcast_disconnect_event() {
    new message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    format_disconnect_event(message, charsmax(message));

    new max_players = get_maxplayers();
    for (new i = 1; i <= max_players; i++) {
        if (is_user_connected(i)) {
            client_print_color(i, print_team_red, message);
        }
    }
}

// Command: hlx_event - Main structured event handler
// Format: hlx_event <target> <EVENT_TYPE> <DATA...>
// Target: 0 = all players, >0 = specific player ID
public cmd_hlx_event(id, level, cid) {
    if (!cmd_access(id, level, cid, 2)) {
        return PLUGIN_HANDLED;
    }

    if (!is_plugin_active()) {
        console_print(id, "%s Plugin is not active", HLSTATSNEXT_TAG);
        return PLUGIN_HANDLED;
    }

    // Get target player ID (unused for now but part of protocol)
    new target_str[8];
    read_argv(1, target_str, charsmax(target_str));
    #pragma unused target_str

    // Get event type
    new event_type_str[32];
    read_argv(2, event_type_str, charsmax(event_type_str));

    // Process events using optimized functions
    if (equal(event_type_str, "RANK")) {
        process_rank_event();
        handle_rank_command();
    } else if (equal(event_type_str, "STATS")) {
        process_stats_event();
        handle_stats_command();
    } else if (equal(event_type_str, "SESSION")) {
        process_session_event();
        handle_session_command();
    } else if (equal(event_type_str, "KILL")) {
        process_kill_event();
        broadcast_kill_event();
    } else if (equal(event_type_str, "CONNECT")) {
        process_connect_event();
        broadcast_connect_event();
    } else if (equal(event_type_str, "DISCONNECT")) {
        process_disconnect_event();
        broadcast_disconnect_event();
    } else if (equal(event_type_str, "SUICIDE")) {
        process_suicide_event();
        broadcast_suicide_event();
    } else if (equal(event_type_str, "TEAMKILL")) {
        process_teamkill_event();
        broadcast_teamkill_event();
    } else if (equal(event_type_str, "ACTION")) {
        process_action_event();
        broadcast_action_event();
    } else if (equal(event_type_str, "TEAM_ACTION")) {
        process_team_action_event();
        broadcast_team_action_event();
    } else {
        log_amx("%s Event type %s not implemented", HLSTATSNEXT_TAG, event_type_str);
    }

    return PLUGIN_HANDLED;
}

// Command: hlx_announce - Public announcement
public cmd_hlx_announce(id, level, cid) {
    if (!cmd_access(id, level, cid, 1)) {
        return PLUGIN_HANDLED;
    }

    if (!is_plugin_active()) {
        console_print(id, "%s Plugin is not active", HLSTATSNEXT_TAG);
        return PLUGIN_HANDLED;
    }

    // Simplified for now - just send a test message
    console_print(id, "%s Announce command called", HLSTATSNEXT_TAG);

    return PLUGIN_HANDLED;
}

// Command: hlstatsnext_status - Show plugin status
public cmd_hlstatsnext_status(id, level, cid) {
    if (!cmd_access(id, level, cid, 0)) {
        return PLUGIN_HANDLED;
    }

    console_print(id, "=== HLStatsNext Plugin Status ===");
    console_print(id, "Version: %s", "1.0.0");
    console_print(id, "State: %s", is_plugin_active() ? "Active" : "Inactive");
    console_print(id, "Colors: %s", are_colors_enabled() ? "Enabled" : "Disabled");
    console_print(id, "Debug: %s", is_debug_enabled() ? "Enabled" : "Disabled");
    console_print(id, "Server ID: %d", get_server_id());
    console_print(id, "Connected Players: %d", get_playersnum());
    console_print(id, "Command: hlx_event (structured events)");

    return PLUGIN_HANDLED;
}

// Command: hlstatsnext_reload - Reload configuration
public cmd_hlstatsnext_reload(id, level, cid) {
    if (!cmd_access(id, level, cid, 0)) {
        return PLUGIN_HANDLED;
    }

    // Re-apply cvar values to plugin state
    hlstatsnext_apply_config();

    console_print(id, "%s Configuration reloaded from cvars", HLSTATSNEXT_TAG);
    log_amx("%s Configuration reloaded by admin", HLSTATSNEXT_TAG);

    return PLUGIN_HANDLED;
}

// Parse HUD command arguments using global variables
stock bool:parse_hud_args(argc) {
    if (argc < 2) {
        return false;
    }

    // Read entire argument string
    read_args(g_hud_message, charsmax(g_hud_message));
    remove_quotes(g_hud_message);

    // Extract first word as potential color
    new pos = strfind(g_hud_message, " ");
    if (pos == -1) {
        // Only one argument, use as message with default color
        get_default_color(g_hud_r, g_hud_g, g_hud_b);
        return true;
    }

    // Extract color part
    copy(g_hud_color_str, charsmax(g_hud_color_str), g_hud_message);
    g_hud_color_str[pos] = 0; // Null terminate at space

    // Try to parse as color
    if (parse_color(g_hud_color_str, g_hud_r, g_hud_g, g_hud_b)) {
        // Valid color found, extract message after color
        copy(g_hud_message, charsmax(g_hud_message), g_hud_message[pos + 1]);
        trim(g_hud_message); // Remove leading/trailing spaces
    } else {
        // Not a valid color, use default and keep full message
        get_default_color(g_hud_r, g_hud_g, g_hud_b);
        // g_hud_message already contains the full message
    }

    return true;
}

// Command: hlx_csay - Center HUD message
public cmd_hlx_csay(id, level, cid) {
    if (!cmd_access(id, level, cid, 1)) {
        return PLUGIN_HANDLED;
    }

    if (!is_plugin_active()) {
        console_print(id, "%s Plugin is not active", HLSTATSNEXT_TAG);
        return PLUGIN_HANDLED;
    }

    new argc = read_argc();
    if (!parse_hud_args(argc)) {
        console_print(id, "Usage: hlx_csay <RRGGBB> <message...>");
        return PLUGIN_HANDLED;
    }

    display_hud_csay(g_hud_message, g_hud_r, g_hud_g, g_hud_b);

    return PLUGIN_HANDLED;
}

// Command: hlx_tsay - Top HUD message
public cmd_hlx_tsay(id, level, cid) {
    if (!cmd_access(id, level, cid, 1)) {
        return PLUGIN_HANDLED;
    }

    if (!is_plugin_active()) {
        console_print(id, "%s Plugin is not active", HLSTATSNEXT_TAG);
        return PLUGIN_HANDLED;
    }

    new argc = read_argc();
    if (!parse_hud_args(argc)) {
        console_print(id, "Usage: hlx_tsay <RRGGBB> <message...>");
        return PLUGIN_HANDLED;
    }

    display_hud_tsay(g_hud_message, g_hud_r, g_hud_g, g_hud_b);

    return PLUGIN_HANDLED;
}

// Command: hlx_typehud - Typewriter HUD message
public cmd_hlx_typehud(id, level, cid) {
    if (!cmd_access(id, level, cid, 1)) {
        return PLUGIN_HANDLED;
    }

    if (!is_plugin_active()) {
        console_print(id, "%s Plugin is not active", HLSTATSNEXT_TAG);
        return PLUGIN_HANDLED;
    }

    new argc = read_argc();
    if (!parse_hud_args(argc)) {
        console_print(id, "Usage: hlx_typehud <RRGGBB> <message...>");
        return PLUGIN_HANDLED;
    }

    display_hud_typehud(g_hud_message, g_hud_r, g_hud_g, g_hud_b);

    return PLUGIN_HANDLED;
}