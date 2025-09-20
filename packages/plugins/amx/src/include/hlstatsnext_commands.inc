/*
 * HLStatsNext Commands Module
 *
 * Handles command registration and execution for structured events
 */

#if defined _hlstatsnext_commands_included
    #endinput
#endif
#define _hlstatsnext_commands_included

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
    log_amx("[HLStatsNext] Commands system initialized");
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

    log_amx("[HLStatsNext] Commands registered successfully");
}

// Command: hlx_event - Main structured event handler
// Format: hlx_event <target> <EVENT_TYPE> <DATA...>
// Target: 0 = all players, >0 = specific player ID
public cmd_hlx_event(id, level, cid) {
    if (!cmd_access(id, level, cid, 2)) {
        return PLUGIN_HANDLED;
    }

    if (!is_plugin_active()) {
        console_print(id, "[HLStatsNext] Plugin is not active");
        return PLUGIN_HANDLED;
    }

    // Get target player ID
    new target_str[8];
    read_argv(1, target_str, charsmax(target_str));
    new target = str_to_num(target_str);

    // Get the rest of the command (event type and data)
    new event_command[256];
    read_args(event_command, charsmax(event_command));

    // Remove the target ID from the command
    new pos = contain(event_command, target_str);
    if (pos != -1) {
        new start = pos + strlen(target_str);
        while (event_command[start] == ' ') start++;
        copy(event_command, charsmax(event_command), event_command[start]);
    }

    // Parse the event
    new EventData:event_data;
    if (!parse_event_command(event_command, event_data)) {
        console_print(id, "[HLStatsNext] Failed to parse event command: %s", event_command);
        return PLUGIN_HANDLED;
    }

    // Format the message
    new formatted_message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    format_event_message(event_data, formatted_message, charsmax(formatted_message));

    // Send the message based on target
    if (target == 0) {
        // Broadcast to all players
        client_print(0, print_chat, formatted_message);
    } else if (is_user_connected(target)) {
        // Send to specific player
        client_print(target, print_chat, formatted_message);
    } else {
        console_print(id, "[HLStatsNext] Target player %d is not connected", target);
    }

    // Debug logging
    if (is_debug_enabled()) {
        new event_type_name[32];
        get_event_type_name(event_data[event_type], event_type_name, charsmax(event_type_name));
        log_amx("[HLStatsNext] Event processed: %s (target: %d)", event_type_name, target);
    }

    return PLUGIN_HANDLED;
}

// Command: hlx_announce - Public announcement
public cmd_hlx_announce(id, level, cid) {
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
        console_print(id, "Usage: hlx_announce <message>");
        return PLUGIN_HANDLED;
    }

    // Format as simple announcement
    new formatted_message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
    new tag[32];
    format_colored_tag(tag, charsmax(tag));
    format(formatted_message, charsmax(formatted_message), "%s %s", tag, message);

    // Send to all players
    client_print(0, print_chat, formatted_message);

    // Log the command execution
    new admin_name[32];
    get_user_name(id, admin_name, charsmax(admin_name));
    log_amx("[HLStatsNext] %s used hlx_announce: %s", admin_name, message);

    return PLUGIN_HANDLED;
}

// Command: hlstatsnext_status - Show plugin status
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

    console_print(id, "[HLStatsNext] Configuration reloaded");
    log_amx("[HLStatsNext] Configuration reloaded by admin");

    return PLUGIN_HANDLED;
}