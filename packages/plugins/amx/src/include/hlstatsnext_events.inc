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
    EVT_SESSION,
    EVT_TOP10,
    EVT_CONNECT,
    EVT_DISCONNECT,
    EVT_MESSAGE  // Generic message
}

// Note: EventData structure removed - using global variables for AMX optimization

// Get event type from string
stock EventType:get_event_type(const event_str[]) {
    if (equal(event_str, "KILL")) return EVT_KILL;
    if (equal(event_str, "SUICIDE")) return EVT_SUICIDE;
    if (equal(event_str, "TEAMKILL")) return EVT_TEAMKILL;
    if (equal(event_str, "ACTION")) return EVT_ACTION;
    if (equal(event_str, "TEAM_ACTION")) return EVT_TEAM_ACTION;
    if (equal(event_str, "RANK")) return EVT_RANK;
    if (equal(event_str, "STATS")) return EVT_STATS;
    if (equal(event_str, "SESSION")) return EVT_SESSION;
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
        case EVT_SESSION: copy(output, maxlen, "SESSION");
        case EVT_TOP10: copy(output, maxlen, "TOP10");
        case EVT_CONNECT: copy(output, maxlen, "CONNECT");
        case EVT_DISCONNECT: copy(output, maxlen, "DISCONNECT");
        case EVT_MESSAGE: copy(output, maxlen, "MESSAGE");
        default: copy(output, maxlen, "UNKNOWN");
    }
}