/*
 * HLStatsNext Parser Module
 *
 * Parses structured event commands from the daemon
 * Uses global variables for AMX memory optimization
 */

#if defined _hlstatsnext_parser_included
    #endinput
#endif
#define _hlstatsnext_parser_included

#include "hlstatsnext_events.inc"
#include "hlstatsnext_globals.inc"

// Parse main event command - now uses global variables
// Format: hlx_event <EVENT_TYPE> <DATA_FIELDS...>
stock EventType:parse_event_command(const command[]) {
    new event_type_str[32];
    new remaining[256];

    // Parse event type
    if (parse(command, event_type_str, charsmax(event_type_str), remaining, charsmax(remaining)) < 1) {
        return EVT_UNKNOWN;
    }

    new EventType:event_type = get_event_type(event_type_str);

    if (event_type == EVT_UNKNOWN) {
        return EVT_UNKNOWN;
    }

    // Parse event-specific data into globals
    switch (event_type) {
        case EVT_KILL: {
            if (parse_kill_event(remaining)) return EVT_KILL;
        }
        case EVT_SUICIDE: {
            if (parse_suicide_event(remaining)) return EVT_SUICIDE;
        }
        case EVT_TEAMKILL: {
            if (parse_teamkill_event(remaining)) return EVT_TEAMKILL;
        }
        case EVT_ACTION: {
            if (parse_action_event(remaining)) return EVT_ACTION;
        }
        case EVT_TEAM_ACTION: {
            if (parse_team_action_event(remaining)) return EVT_TEAM_ACTION;
        }
        case EVT_RANK: {
            if (parse_rank_event(remaining)) return EVT_RANK;
        }
        case EVT_STATS: {
            if (parse_stats_event(remaining)) return EVT_STATS;
        }
        case EVT_CONNECT: {
            if (parse_connect_event(remaining)) return EVT_CONNECT;
        }
        case EVT_DISCONNECT: {
            if (parse_disconnect_event(remaining)) return EVT_DISCONNECT;
        }
    }

    return EVT_UNKNOWN;
}

// Parse kill event - uses global variables
// Format: <killerId> "<killerName>" <killerSkill> <victimId> "<victimName>" <victimSkill> <points> <weapon> <headshot>
stock bool:parse_kill_event(const params[]) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;

    // Parse killer ID
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_killer_id = str_to_num(g_temp_str);

    // Parse killer name (quoted)
    pos = parse_quoted_token(temp, pos, g_killer_name, charsmax(g_killer_name));
    if (pos == -1) return false;

    // Parse killer skill
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_killer_skill = str_to_num(g_temp_str);

    // Parse victim ID
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_victim_id = str_to_num(g_temp_str);

    // Parse victim name (quoted)
    pos = parse_quoted_token(temp, pos, g_victim_name, charsmax(g_victim_name));
    if (pos == -1) return false;

    // Parse victim skill
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_victim_skill = str_to_num(g_temp_str);

    // Parse points
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_points = str_to_num(g_temp_str);

    // Parse weapon
    pos = parse_token(temp, pos, g_weapon, charsmax(g_weapon));
    if (pos == -1) return false;

    // Parse headshot (0 or 1)
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos != -1) {
        g_headshot = bool:str_to_num(g_temp_str);
    }

    return true;
}

// Parse suicide event - uses global variables
// Format: <playerId> "<playerName>" <playerSkill> <penalty>
stock bool:parse_suicide_event(const params[]) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;

    // Parse player ID
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_player_id = str_to_num(g_temp_str);

    // Parse player name (quoted)
    pos = parse_quoted_token(temp, pos, g_player_name, charsmax(g_player_name));
    if (pos == -1) return false;

    // Parse player skill
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_player_skill = str_to_num(g_temp_str);

    // Parse penalty
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_penalty = str_to_num(g_temp_str);

    return true;
}

// Parse teamkill event - uses global variables
// Format: <killerId> "<killerName>" <victimId> "<victimName>" <penalty>
stock bool:parse_teamkill_event(const params[]) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;

    // Parse killer ID
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_killer_id = str_to_num(g_temp_str);

    // Parse killer name (quoted)
    pos = parse_quoted_token(temp, pos, g_killer_name, charsmax(g_killer_name));
    if (pos == -1) return false;

    // Parse victim ID
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_victim_id = str_to_num(g_temp_str);

    // Parse victim name (quoted)
    pos = parse_quoted_token(temp, pos, g_victim_name, charsmax(g_victim_name));
    if (pos == -1) return false;

    // Parse penalty
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_penalty = str_to_num(g_temp_str);

    return true;
}

// Parse action event - uses global variables
// Format: <playerId> "<playerName>" <playerSkill> "<actionCode>" "<actionDesc>" <points>
stock bool:parse_action_event(const params[]) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;

    // Parse player ID
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_player_id = str_to_num(g_temp_str);

    // Parse player name (quoted)
    pos = parse_quoted_token(temp, pos, g_player_name, charsmax(g_player_name));
    if (pos == -1) return false;

    // Parse player skill
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_player_skill = str_to_num(g_temp_str);

    // Parse action code (quoted)
    pos = parse_quoted_token(temp, pos, g_action_code, charsmax(g_action_code));
    if (pos == -1) return false;

    // Parse action description (quoted)
    pos = parse_quoted_token(temp, pos, g_action_desc, charsmax(g_action_desc));
    if (pos == -1) return false;

    // Parse points
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_points = str_to_num(g_temp_str);

    return true;
}

// Parse team action event - uses global variables
// Format: "<teamName>" "<actionCode>" "<actionDesc>" <points> <playerCount>
stock bool:parse_team_action_event(const params[]) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;

    // Parse team name (quoted)
    pos = parse_quoted_token(temp, pos, g_team_name, charsmax(g_team_name));
    if (pos == -1) return false;

    // Parse action code (quoted)
    pos = parse_quoted_token(temp, pos, g_action_code, charsmax(g_action_code));
    if (pos == -1) return false;

    // Parse action description (quoted)
    pos = parse_quoted_token(temp, pos, g_action_desc, charsmax(g_action_desc));
    if (pos == -1) return false;

    // Parse points
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_points = str_to_num(g_temp_str);

    // Parse player count
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_player_count = str_to_num(g_temp_str);

    return true;
}

// Parse rank event - uses global variables
// Format: <playerId> <rank> <totalPlayers> <skill>
stock bool:parse_rank_event(const params[]) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;

    // Parse player ID
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_player_id = str_to_num(g_temp_str);

    // Parse rank
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_rank = str_to_num(g_temp_str);

    // Parse total players
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_total_players = str_to_num(g_temp_str);

    // Parse skill
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_player_skill = str_to_num(g_temp_str);

    return true;
}

// Parse stats event - uses global variables
// Format: <playerId> <rank> <total> <skill> <kills> <deaths> <kdr> <accuracy> <headshots>
stock bool:parse_stats_event(const params[]) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;

    // Parse player ID
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_player_id = str_to_num(g_temp_str);

    // Parse rank
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_rank = str_to_num(g_temp_str);

    // Parse total players
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_total_players = str_to_num(g_temp_str);

    // Parse skill
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_player_skill = str_to_num(g_temp_str);

    // Parse kills
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_kills = str_to_num(g_temp_str);

    // Parse deaths
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_deaths = str_to_num(g_temp_str);

    // Parse KDR (float)
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_kdr = str_to_float(g_temp_str);

    // Parse accuracy
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_accuracy = str_to_num(g_temp_str);

    // Parse headshots
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_headshots_percent = str_to_num(g_temp_str);

    return true;
}

// Parse connect event - uses global variables
// Format: <playerId> "<playerName>" "<country>"
stock bool:parse_connect_event(const params[]) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;

    // Parse player ID
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_player_id = str_to_num(g_temp_str);

    // Parse player name (quoted)
    pos = parse_quoted_token(temp, pos, g_player_name, charsmax(g_player_name));
    if (pos == -1) return false;

    // Parse country (quoted)
    pos = parse_quoted_token(temp, pos, g_country, charsmax(g_country));
    if (pos == -1) return false;

    return true;
}

// Parse disconnect event - uses global variables
// Format: <playerId> "<playerName>" <sessionTime>
stock bool:parse_disconnect_event(const params[]) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;

    // Parse player ID
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_player_id = str_to_num(g_temp_str);

    // Parse player name (quoted)
    pos = parse_quoted_token(temp, pos, g_player_name, charsmax(g_player_name));
    if (pos == -1) return false;

    // Parse session time
    pos = parse_token(temp, pos, g_temp_str, charsmax(g_temp_str));
    if (pos == -1) return false;
    g_session_time = str_to_num(g_temp_str);

    return true;
}

// Utility: Parse a simple token
stock parse_token(const input[], start, output[], maxlen) {
    new i = start;
    new j = 0;

    // Skip leading spaces
    while (input[i] == ' ' && input[i] != EOS) i++;

    if (input[i] == EOS) return -1;

    // Copy until space or end
    while (input[i] != ' ' && input[i] != EOS && j < maxlen - 1) {
        output[j++] = input[i++];
    }
    output[j] = EOS;

    return i;
}

// Utility: Parse a quoted token
stock parse_quoted_token(const input[], start, output[], maxlen) {
    new i = start;
    new j = 0;

    // Skip leading spaces
    while (input[i] == ' ' && input[i] != EOS) i++;

    if (input[i] == EOS) return -1;

    // Expect opening quote
    if (input[i] != '"') return -1;
    i++;

    // Copy until closing quote
    while (input[i] != '"' && input[i] != EOS && j < maxlen - 1) {
        output[j++] = input[i++];
    }
    output[j] = EOS;

    // Expect closing quote
    if (input[i] != '"') return -1;
    i++;

    return i;
}