/*
 * HLStatsNext Events Module
 *
 * Event type definitions and data structures for structured command protocol
 */

#if defined _hlstatsnext_events_included
    #endinput
#endif
#define _hlstatsnext_events_included

// Event type enumeration
enum EventType {
    EVT_UNKNOWN = 0,
    EVT_KILL,
    EVT_SUICIDE,
    EVT_TEAMKILL,
    EVT_ACTION,
    EVT_TEAM_ACTION,
    EVT_RANK,
    EVT_STATS,
    EVT_TOP10,
    EVT_CONNECT,
    EVT_DISCONNECT,
    EVT_MESSAGE  // Generic message
}

// Event data structure - stores parsed event data
enum EventData {
    EventType:event_type,

    // Player IDs (game user IDs, not database IDs)
    player_id,
    killer_id,
    victim_id,

    // Player names
    player_name[32],
    killer_name[32],
    victim_name[32],

    // Skills and points
    player_skill,
    killer_skill,
    victim_skill,
    points,
    penalty,

    // Action data
    action_code[32],
    action_desc[64],

    // Team data
    team_name[32],
    player_count,

    // Weapon data
    weapon[32],
    bool:headshot,

    // Stats data
    rank,
    total_players,
    kills,
    deaths,
    Float:kdr,
    accuracy,
    headshots_percent,

    // Session data
    session_time,

    // Country data
    country[32],

    // Generic message (for fallback)
    message[192]
}

// Initialize event data structure
stock init_event_data(data[EventData]) {
    data[event_type] = EVT_UNKNOWN;
    data[player_id] = 0;
    data[killer_id] = 0;
    data[victim_id] = 0;
    data[player_name][0] = 0;
    data[killer_name][0] = 0;
    data[victim_name][0] = 0;
    data[player_skill] = 0;
    data[killer_skill] = 0;
    data[victim_skill] = 0;
    data[points] = 0;
    data[penalty] = 0;
    data[action_code][0] = 0;
    data[action_desc][0] = 0;
    data[team_name][0] = 0;
    data[player_count] = 0;
    data[weapon][0] = 0;
    data[headshot] = false;
    data[rank] = 0;
    data[total_players] = 0;
    data[kills] = 0;
    data[deaths] = 0;
    data[kdr] = 0.0;
    data[accuracy] = 0;
    data[headshots_percent] = 0;
    data[session_time] = 0;
    data[country][0] = 0;
    data[message][0] = 0;
}

// Get event type from string
stock EventType:get_event_type(const event_str[]) {
    if (equal(event_str, "KILL")) return EVT_KILL;
    if (equal(event_str, "SUICIDE")) return EVT_SUICIDE;
    if (equal(event_str, "TEAMKILL")) return EVT_TEAMKILL;
    if (equal(event_str, "ACTION")) return EVT_ACTION;
    if (equal(event_str, "TEAM_ACTION")) return EVT_TEAM_ACTION;
    if (equal(event_str, "RANK")) return EVT_RANK;
    if (equal(event_str, "STATS")) return EVT_STATS;
    if (equal(event_str, "TOP10")) return EVT_TOP10;
    if (equal(event_str, "CONNECT")) return EVT_CONNECT;
    if (equal(event_str, "DISCONNECT")) return EVT_DISCONNECT;
    if (equal(event_str, "MESSAGE")) return EVT_MESSAGE;
    return EVT_UNKNOWN;
}

// Get event type name
stock get_event_type_name(EventType:type, output[], maxlen) {
    switch (type) {
        case EVT_KILL: copy(output, maxlen, "KILL");
        case EVT_SUICIDE: copy(output, maxlen, "SUICIDE");
        case EVT_TEAMKILL: copy(output, maxlen, "TEAMKILL");
        case EVT_ACTION: copy(output, maxlen, "ACTION");
        case EVT_TEAM_ACTION: copy(output, maxlen, "TEAM_ACTION");
        case EVT_RANK: copy(output, maxlen, "RANK");
        case EVT_STATS: copy(output, maxlen, "STATS");
        case EVT_TOP10: copy(output, maxlen, "TOP10");
        case EVT_CONNECT: copy(output, maxlen, "CONNECT");
        case EVT_DISCONNECT: copy(output, maxlen, "DISCONNECT");
        case EVT_MESSAGE: copy(output, maxlen, "MESSAGE");
        default: copy(output, maxlen, "UNKNOWN");
    }
}