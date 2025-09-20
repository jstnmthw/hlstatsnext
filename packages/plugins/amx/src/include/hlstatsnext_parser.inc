/*
 * HLStatsNext Parser Module
 *
 * Parses structured event commands from the daemon
 */

#if defined _hlstatsnext_parser_included
    #endinput
#endif
#define _hlstatsnext_parser_included

#include "hlstatsnext_events.inc"

// Parse main event command
// Format: hlx_event <EVENT_TYPE> <DATA_FIELDS...>
stock bool:parse_event_command(const command[], EventData:data) {
    init_event_data(data);

    new event_type_str[32];
    new remaining[256];

    // Parse event type
    if (parse(command, event_type_str, charsmax(event_type_str), remaining, charsmax(remaining)) < 1) {
        return false;
    }

    data[event_type] = get_event_type(event_type_str);

    if (data[event_type] == EVT_UNKNOWN) {
        // Fallback to generic message
        copy(data[message], charsmax(data[message]), command);
        return true;
    }

    // Parse event-specific data
    switch (data[event_type]) {
        case EVT_KILL: return parse_kill_event(remaining, data);
        case EVT_SUICIDE: return parse_suicide_event(remaining, data);
        case EVT_TEAMKILL: return parse_teamkill_event(remaining, data);
        case EVT_ACTION: return parse_action_event(remaining, data);
        case EVT_TEAM_ACTION: return parse_team_action_event(remaining, data);
        case EVT_RANK: return parse_rank_event(remaining, data);
        case EVT_STATS: return parse_stats_event(remaining, data);
        case EVT_CONNECT: return parse_connect_event(remaining, data);
        case EVT_DISCONNECT: return parse_disconnect_event(remaining, data);
        case EVT_MESSAGE: {
            copy(data[message], charsmax(data[message]), remaining);
            return true;
        }
    }

    return false;
}

// Parse kill event
// Format: <killerId> "<killerName>" <killerSkill> <victimId> "<victimName>" <victimSkill> <points> <weapon> <headshot>
stock bool:parse_kill_event(const params[], EventData:data) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;
    new token[64];

    // Parse killer ID
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[killer_id] = str_to_num(token);

    // Parse killer name (quoted)
    pos = parse_quoted_token(temp, pos, data[killer_name], charsmax(data[killer_name]));
    if (pos == -1) return false;

    // Parse killer skill
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[killer_skill] = str_to_num(token);

    // Parse victim ID
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[victim_id] = str_to_num(token);

    // Parse victim name (quoted)
    pos = parse_quoted_token(temp, pos, data[victim_name], charsmax(data[victim_name]));
    if (pos == -1) return false;

    // Parse victim skill
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[victim_skill] = str_to_num(token);

    // Parse points
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[points] = str_to_num(token);

    // Parse weapon
    pos = parse_token(temp, pos, data[weapon], charsmax(data[weapon]));
    if (pos == -1) return false;

    // Parse headshot (0 or 1)
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos != -1) {
        data[headshot] = bool:str_to_num(token);
    }

    return true;
}

// Parse suicide event
// Format: <playerId> "<playerName>" <playerSkill> <penalty>
stock bool:parse_suicide_event(const params[], EventData:data) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;
    new token[64];

    // Parse player ID
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[player_id] = str_to_num(token);

    // Parse player name (quoted)
    pos = parse_quoted_token(temp, pos, data[player_name], charsmax(data[player_name]));
    if (pos == -1) return false;

    // Parse player skill
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[player_skill] = str_to_num(token);

    // Parse penalty
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[penalty] = str_to_num(token);

    return true;
}

// Parse teamkill event
// Format: <killerId> "<killerName>" <victimId> "<victimName>" <penalty>
stock bool:parse_teamkill_event(const params[], EventData:data) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;
    new token[64];

    // Parse killer ID
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[killer_id] = str_to_num(token);

    // Parse killer name (quoted)
    pos = parse_quoted_token(temp, pos, data[killer_name], charsmax(data[killer_name]));
    if (pos == -1) return false;

    // Parse victim ID
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[victim_id] = str_to_num(token);

    // Parse victim name (quoted)
    pos = parse_quoted_token(temp, pos, data[victim_name], charsmax(data[victim_name]));
    if (pos == -1) return false;

    // Parse penalty
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[penalty] = str_to_num(token);

    return true;
}

// Parse action event
// Format: <playerId> "<playerName>" <playerSkill> "<actionCode>" "<actionDesc>" <points>
stock bool:parse_action_event(const params[], EventData:data) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;
    new token[64];

    // Parse player ID
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[player_id] = str_to_num(token);

    // Parse player name (quoted)
    pos = parse_quoted_token(temp, pos, data[player_name], charsmax(data[player_name]));
    if (pos == -1) return false;

    // Parse player skill
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[player_skill] = str_to_num(token);

    // Parse action code (quoted)
    pos = parse_quoted_token(temp, pos, data[action_code], charsmax(data[action_code]));
    if (pos == -1) return false;

    // Parse action description (quoted)
    pos = parse_quoted_token(temp, pos, data[action_desc], charsmax(data[action_desc]));
    if (pos == -1) return false;

    // Parse points
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[points] = str_to_num(token);

    return true;
}

// Parse team action event
// Format: "<teamName>" "<actionCode>" "<actionDesc>" <points> <playerCount>
stock bool:parse_team_action_event(const params[], EventData:data) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;
    new token[64];

    // Parse team name (quoted)
    pos = parse_quoted_token(temp, pos, data[team_name], charsmax(data[team_name]));
    if (pos == -1) return false;

    // Parse action code (quoted)
    pos = parse_quoted_token(temp, pos, data[action_code], charsmax(data[action_code]));
    if (pos == -1) return false;

    // Parse action description (quoted)
    pos = parse_quoted_token(temp, pos, data[action_desc], charsmax(data[action_desc]));
    if (pos == -1) return false;

    // Parse points
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[points] = str_to_num(token);

    // Parse player count
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[player_count] = str_to_num(token);

    return true;
}

// Parse rank event
// Format: <playerId> <rank> <totalPlayers> <skill>
stock bool:parse_rank_event(const params[], EventData:data) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;
    new token[64];

    // Parse player ID
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[player_id] = str_to_num(token);

    // Parse rank
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[rank] = str_to_num(token);

    // Parse total players
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[total_players] = str_to_num(token);

    // Parse skill
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[player_skill] = str_to_num(token);

    return true;
}

// Parse stats event
// Format: <playerId> <rank> <total> <skill> <kills> <deaths> <kdr> <accuracy> <headshots>
stock bool:parse_stats_event(const params[], EventData:data) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;
    new token[64];

    // Parse player ID
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[player_id] = str_to_num(token);

    // Parse rank
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[rank] = str_to_num(token);

    // Parse total players
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[total_players] = str_to_num(token);

    // Parse skill
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[player_skill] = str_to_num(token);

    // Parse kills
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[kills] = str_to_num(token);

    // Parse deaths
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[deaths] = str_to_num(token);

    // Parse KDR (float)
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[kdr] = str_to_float(token);

    // Parse accuracy
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[accuracy] = str_to_num(token);

    // Parse headshots
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[headshots_percent] = str_to_num(token);

    return true;
}

// Parse connect event
// Format: <playerId> "<playerName>" "<country>"
stock bool:parse_connect_event(const params[], EventData:data) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;
    new token[64];

    // Parse player ID
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[player_id] = str_to_num(token);

    // Parse player name (quoted)
    pos = parse_quoted_token(temp, pos, data[player_name], charsmax(data[player_name]));
    if (pos == -1) return false;

    // Parse country (quoted)
    pos = parse_quoted_token(temp, pos, data[country], charsmax(data[country]));
    if (pos == -1) return false;

    return true;
}

// Parse disconnect event
// Format: <playerId> "<playerName>" <sessionTime>
stock bool:parse_disconnect_event(const params[], EventData:data) {
    new temp[256];
    copy(temp, charsmax(temp), params);

    new pos = 0;
    new token[64];

    // Parse player ID
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[player_id] = str_to_num(token);

    // Parse player name (quoted)
    pos = parse_quoted_token(temp, pos, data[player_name], charsmax(data[player_name]));
    if (pos == -1) return false;

    // Parse session time
    pos = parse_token(temp, pos, token, charsmax(token));
    if (pos == -1) return false;
    data[session_time] = str_to_num(token);

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