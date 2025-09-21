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
#include "hlstatsnext_parser.inc"
#include "hlstatsnext_formatter.inc"

// Command access levels
#define ACCESS_PUBLIC 0
#define ACCESS_PLAYER ADMIN_ALL
#define ACCESS_MODERATOR (ADMIN_KICK | ADMIN_BAN)
#define ACCESS_ADMIN ADMIN_RCON

// Commands initialization
stock hlstatsnext_commands_init() {
    log_amx("%s Commands system initialized", HLSTATSNEXT_TAG);
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

    log_amx("%s Commands registered successfully", HLSTATSNEXT_TAG);
}

// Direct event processing functions - leveraging read_argv's quote handling

// Process KILL event: hlx_event <target> KILL <killerId> "<killerName>" <killerSkill> <victimId> "<victimName>" <victimSkill> <points> <weapon> <headshot>
stock bool:process_kill_event(data[EventData]) {
    data[event_type] = EVT_KILL;

    // Read arguments directly - read_argv handles quotes automatically
    new temp_str[16];

    read_argv(3, temp_str, sizeof(temp_str) - 1);
    data[killer_id] = str_to_num(temp_str);

    read_argv(4, data[killer_name], sizeof(data[killer_name]) - 1);

    read_argv(5, temp_str, sizeof(temp_str) - 1);
    data[killer_skill] = str_to_num(temp_str);

    read_argv(6, temp_str, sizeof(temp_str) - 1);
    data[victim_id] = str_to_num(temp_str);

    read_argv(7, data[victim_name], sizeof(data[victim_name]) - 1);

    read_argv(8, temp_str, sizeof(temp_str) - 1);
    data[victim_skill] = str_to_num(temp_str);

    read_argv(9, temp_str, sizeof(temp_str) - 1);
    data[points] = str_to_num(temp_str);

    read_argv(10, data[weapon], sizeof(data[weapon]) - 1);

    read_argv(11, temp_str, sizeof(temp_str) - 1);
    data[headshot] = bool:str_to_num(temp_str);

    log_amx("%s KILL: %s (%d) killed %s (%d) with %s for %d points", HLSTATSNEXT_TAG,
           data[killer_name], data[killer_id], data[victim_name], data[victim_id], data[weapon], data[points]);

    return true;
}

// Process CONNECT event: hlx_event <target> CONNECT <playerId> "<playerName>" "<country>"
stock bool:process_connect_event(data[EventData]) {
    data[event_type] = EVT_CONNECT;

    new temp_str[16];

    read_argv(3, temp_str, sizeof(temp_str) - 1);
    data[player_id] = str_to_num(temp_str);

    read_argv(4, data[player_name], sizeof(data[player_name]) - 1);
    read_argv(5, data[country], sizeof(data[country]) - 1);

    log_amx("%s CONNECT: %s (%d) from %s", HLSTATSNEXT_TAG, data[player_name], data[player_id], data[country]);

    return true;
}

// Process TEAM_ACTION event: hlx_event <target> TEAM_ACTION "<teamName>" "<actionCode>" "<actionDesc>" <points> <playerCount>
stock bool:process_team_action_event(data[EventData]) {
    data[event_type] = EVT_TEAM_ACTION;

    new temp_str[16];

    read_argv(3, data[team_name], sizeof(data[team_name]) - 1);
    read_argv(4, data[action_code], sizeof(data[action_code]) - 1);
    read_argv(5, data[action_desc], sizeof(data[action_desc]) - 1);

    read_argv(6, temp_str, sizeof(temp_str) - 1);
    data[points] = str_to_num(temp_str);

    read_argv(7, temp_str, sizeof(temp_str) - 1);
    data[player_count] = str_to_num(temp_str);

    log_amx("%s TEAM_ACTION: %s - %s (%s) for %d points (%d players)", HLSTATSNEXT_TAG,
           data[team_name], data[action_desc], data[action_code], data[points], data[player_count]);

    return true;
}

// Process DISCONNECT event: hlx_event <target> DISCONNECT <playerId> "<playerName>" <sessionTime>
stock bool:process_disconnect_event(data[EventData]) {
    data[event_type] = EVT_DISCONNECT;

    new temp_str[16];

    read_argv(3, temp_str, sizeof(temp_str) - 1);
    data[player_id] = str_to_num(temp_str);

    read_argv(4, data[player_name], sizeof(data[player_name]) - 1);

    read_argv(5, temp_str, sizeof(temp_str) - 1);
    data[session_time] = str_to_num(temp_str);

    log_amx("%s DISCONNECT: %s (%d) session time: %d", HLSTATSNEXT_TAG, data[player_name], data[player_id], data[session_time]);

    return true;
}

// Process SUICIDE event: hlx_event <target> SUICIDE <playerId> "<playerName>" <playerSkill> <penalty>
stock bool:process_suicide_event(data[EventData]) {
    data[event_type] = EVT_SUICIDE;

    new temp_str[16];

    read_argv(3, temp_str, sizeof(temp_str) - 1);
    data[player_id] = str_to_num(temp_str);

    read_argv(4, data[player_name], sizeof(data[player_name]) - 1);

    read_argv(5, temp_str, sizeof(temp_str) - 1);
    data[player_skill] = str_to_num(temp_str);

    read_argv(6, temp_str, sizeof(temp_str) - 1);
    data[penalty] = str_to_num(temp_str);

    log_amx("%s SUICIDE: %s (%d) penalty: %d", HLSTATSNEXT_TAG, data[player_name], data[player_id], data[penalty]);

    return true;
}

// Process TEAMKILL event: hlx_event <target> TEAMKILL <killerId> "<killerName>" <victimId> "<victimName>" <penalty>
stock bool:process_teamkill_event(data[EventData]) {
    data[event_type] = EVT_TEAMKILL;

    new temp_str[16];

    read_argv(3, temp_str, sizeof(temp_str) - 1);
    data[killer_id] = str_to_num(temp_str);

    read_argv(4, data[killer_name], sizeof(data[killer_name]) - 1);

    read_argv(5, temp_str, sizeof(temp_str) - 1);
    data[victim_id] = str_to_num(temp_str);

    read_argv(6, data[victim_name], sizeof(data[victim_name]) - 1);

    read_argv(7, temp_str, sizeof(temp_str) - 1);
    data[penalty] = str_to_num(temp_str);

    log_amx("%s TEAMKILL: %s (%d) killed %s (%d) penalty: %d", HLSTATSNEXT_TAG,
           data[killer_name], data[killer_id], data[victim_name], data[victim_id], data[penalty]);

    return true;
}

// Process ACTION event: hlx_event <target> ACTION <playerId> "<playerName>" <playerSkill> "<actionCode>" "<actionDesc>" <points>
stock bool:process_action_event(data[EventData]) {
    data[event_type] = EVT_ACTION;

    new temp_str[16];

    read_argv(3, temp_str, sizeof(temp_str) - 1);
    data[player_id] = str_to_num(temp_str);

    read_argv(4, data[player_name], sizeof(data[player_name]) - 1);

    read_argv(5, temp_str, sizeof(temp_str) - 1);
    data[player_skill] = str_to_num(temp_str);

    read_argv(6, data[action_code], sizeof(data[action_code]) - 1);
    read_argv(7, data[action_desc], sizeof(data[action_desc]) - 1);

    read_argv(8, temp_str, sizeof(temp_str) - 1);
    data[points] = str_to_num(temp_str);

    log_amx("%s ACTION: %s (%d) - %s (%s) for %d points", HLSTATSNEXT_TAG,
           data[player_name], data[player_id], data[action_desc], data[action_code], data[points]);

    return true;
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

    // Get target player ID
    new target_str[8];
    read_argv(1, target_str, sizeof(target_str) - 1);
    new target = str_to_num(target_str);

    // Get event type
    new event_type_str[32];
    read_argv(2, event_type_str, sizeof(event_type_str) - 1);

    // Debug logging
    log_amx("%s Processing event: %s for target: %d", HLSTATSNEXT_TAG, event_type_str, target);

    // Process event using direct argument parsing
    new event_data[EventData];
    new bool:success = false;

    if (equal(event_type_str, "KILL")) {
        success = process_kill_event(event_data);
    } else if (equal(event_type_str, "CONNECT")) {
        success = process_connect_event(event_data);
    } else if (equal(event_type_str, "DISCONNECT")) {
        success = process_disconnect_event(event_data);
    } else if (equal(event_type_str, "SUICIDE")) {
        success = process_suicide_event(event_data);
    } else if (equal(event_type_str, "TEAMKILL")) {
        success = process_teamkill_event(event_data);
    } else if (equal(event_type_str, "ACTION")) {
        success = process_action_event(event_data);
    } else if (equal(event_type_str, "TEAM_ACTION")) {
        success = process_team_action_event(event_data);
    } else {
        log_amx("%s Unknown event type: %s", HLSTATSNEXT_TAG, event_type_str);
        console_print(id, "%s Unknown event type: %s", HLSTATSNEXT_TAG, event_type_str);
        return PLUGIN_HANDLED;
    }

    if (!success) {
        log_amx("%s Failed to process event: %s", HLSTATSNEXT_TAG, event_type_str);
        console_print(id, "%s Failed to process event: %s", HLSTATSNEXT_TAG, event_type_str);
        return PLUGIN_HANDLED;
    }

    // Format the message
    new formatted_message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    format_event_message(event_data, formatted_message, charsmax(formatted_message));

    // Send the message based on target using client_print_color for CS 1.6 compatibility
    if (target == 0) {
        // Broadcast to all players
        client_print_color(0, print_team_red, formatted_message);
        log_amx("%s Sent to all players: %s", HLSTATSNEXT_TAG, formatted_message);
    } else if (is_user_connected(target)) {
        // Send to specific player
        client_print_color(target, print_team_red, formatted_message);
        log_amx("%s Sent to player %d: %s", HLSTATSNEXT_TAG, target, formatted_message);
    } else {
        console_print(id, "%s Target player %d is not connected", HLSTATSNEXT_TAG, target);
    }

    // Debug logging
    if (is_debug_enabled()) {
        new event_type_name[32];
        get_event_type_name(event_data[event_type], event_type_name, charsmax(event_type_name));
        log_amx("%s Event processed: %s (target: %d)", HLSTATSNEXT_TAG, event_type_name, target);
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

    // Reload configuration
    hlstatsnext_load_config();

    console_print(id, "%s Configuration reloaded", HLSTATSNEXT_TAG);
    log_amx("%s Configuration reloaded by admin", HLSTATSNEXT_TAG);

    return PLUGIN_HANDLED;
}